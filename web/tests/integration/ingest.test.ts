import { beforeAll, describe, expect, it, vi } from 'vitest';
import { placeholderMap } from '../../scripts/lib/png';
import { getDb } from '../../src/lib/server/db/client';
import { events, mapImages } from '../../src/lib/server/db/schema';
import { POST as ingest } from '../../src/routes/api/ingest/+server';
import { POST as ingestMap } from '../../src/routes/api/ingest/map/+server';
import { latestJob, startJob } from '../../src/lib/server/jobs/runner';
import {
  routeEvent,
  seededBatches,
  signedMapRequest,
  signedRequest,
  resetDatabase,
  useTestDatabase
} from './setup';
import { sql } from 'drizzle-orm';

vi.setConfig({ testTimeout: 240_000, hookTimeout: 240_000 });

beforeAll(async () => {
  useTestDatabase();
  await resetDatabase();
});

describe('POST /api/ingest', () => {
  const batches = seededBatches(3);

  it('rejects bad signatures and stale timestamps with 401', async () => {
    const batch = batches[0]!;
    const forged = signedRequest(batch, { 'x-telemetry-signature': 'sha256=' + '0'.repeat(64) });
    expect((await ingest(routeEvent(forged))).status).toBe(401);
    const stale = signedRequest(batch, {
      'x-telemetry-timestamp': String(Math.floor(Date.now() / 1000) - 3600)
    });
    expect((await ingest(routeEvent(stale))).status).toBe(401);
    const missing = new Request('http://test/api/ingest', {
      method: 'POST',
      body: JSON.stringify(batch)
    });
    expect((await ingest(routeEvent(missing))).status).toBe(401);
  });

  it('rejects malformed batches with 422 and oversized bodies with 413', async () => {
    const malformed = signedRequest('{"plugin":{}}');
    expect((await ingest(routeEvent(malformed))).status).toBe(422);
    const badEvent = signedRequest({
      ...batches[0]!,
      events: [{ ...batches[0]!.events[0]!, type: 'player.teleported' } as never]
    });
    expect((await ingest(routeEvent(badEvent))).status).toBe(422);
    const tooMany = signedRequest({
      ...batches[0]!,
      events: Array.from({ length: 201 }, (_, i) => ({
        ...batches[0]!.events[0]!,
        id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
        seq: i
      }))
    });
    expect((await ingest(routeEvent(tooMany))).status).toBe(422);
    const huge = signedRequest(
      JSON.stringify({ ...batches[0]!, padding: 'x'.repeat(1024 * 1024) })
    );
    expect((await ingest(routeEvent(huge))).status).toBe(413);
  });

  it('accepts batches in seq order, deduplicates replays and reports counts', async () => {
    const first = batches[0]!;
    const shuffled = { ...first, events: [...first.events].reverse() };
    const response = await ingest(routeEvent(signedRequest(shuffled)));
    expect(response.status).toBe(200);
    const result = (await response.json()) as {
      accepted: number;
      duplicates: number;
      last_seq: number;
    };
    expect(result.accepted).toBe(first.events.length);
    expect(result.duplicates).toBe(0);
    expect(result.last_seq).toBe(Math.max(...first.events.map((event) => event.seq)));
    const replay = await ingest(routeEvent(signedRequest(first)));
    const replayed = (await replay.json()) as { accepted: number; duplicates: number };
    expect(replayed.accepted).toBe(0);
    expect(replayed.duplicates).toBe(first.events.length);
    const stored = await getDb()
      .select({ count: sql<number>`count(*)::int` })
      .from(events);
    const nonHeartbeat = first.events.filter((event) => event.type !== 'server.heartbeat').length;
    expect(stored[0]?.count).toBe(nonHeartbeat);
    for (const batch of batches.slice(1)) {
      expect((await ingest(routeEvent(signedRequest(batch)))).status).toBe(200);
    }
  });

  it('turns batches away with 503 while projections are being rebuilt', async () => {
    const { finished } = await startJob('projections_rebuild');
    const during = await ingest(routeEvent(signedRequest(batches[0]!)));
    expect(during.status).toBe(503);
    await finished;
    const after = await ingest(routeEvent(signedRequest(batches[0]!)));
    expect(after.status).toBe(200);
    const job = await latestJob('projections_rebuild');
    expect(job?.state).toBe('done');
    expect(job?.progress).toBe(1);
  });

  it('stores map uploads per world uid and validates the PNG', async () => {
    const png = placeholderMap(64);
    expect((await ingestMap(routeEvent(signedMapRequest(png)))).status).toBe(204);
    expect((await ingestMap(routeEvent(signedMapRequest(png)))).status).toBe(204);
    const rows = await getDb().select().from(mapImages);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.size).toBe(64);
    expect(
      (await ingestMap(routeEvent(signedMapRequest(png, { 'x-map-size': '128' })))).status
    ).toBe(422);
    expect((await ingestMap(routeEvent(signedMapRequest(Buffer.from('not a png'))))).status).toBe(
      422
    );
    const wrongSignature = signedMapRequest(png, {
      'x-telemetry-signature': 'sha256=' + '1'.repeat(64)
    });
    expect((await ingestMap(routeEvent(wrongSignature))).status).toBe(401);
  });
});
