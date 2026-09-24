import { beforeAll, describe, expect, it, vi } from 'vitest';
import { getDb } from '../../src/lib/server/db/client';
import { ApiHttpError } from '../../src/lib/server/http/respond';
import { validateAgainst } from '../../src/lib/server/ingest/validate';
import {
  deleteZoneResult,
  listZoneResults,
  upsertZoneResult
} from '../../src/lib/server/read/zone';
import { makeMeasurements, makeResult } from '../unit/zone/fixtures';
import { resetDatabase, useTestDatabase } from './setup';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

beforeAll(async () => {
  useTestDatabase();
  await resetDatabase();
});

async function failure(promise: Promise<unknown>): Promise<ApiHttpError> {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught
  );
  expect(error).toBeInstanceOf(ApiHttpError);
  return error as ApiHttpError;
}

describe('zone results', () => {
  it('starts empty and validates against the contract', async () => {
    const list = await listZoneResults(getDb());
    expect(list.items).toEqual([]);
    expect(validateAgainst('ZoneResultList', list)).toBeNull();
  });

  it('stores measurements under the normalised name, ranked and recomputed', async () => {
    const db = getDb();
    const now = new Date('2026-09-11T10:00:00.000Z');
    const tampered = makeResult({ name: 'pete' });
    tampered.scores = { ...tampered.scores, overall: 100, network: 100 };
    const pete = await upsertZoneResult(db, 'PETE', tampered, now);
    expect(validateAgainst('ZoneRankedResult', pete)).toBeNull();
    expect(pete.name).toBe('PETE');
    expect(pete.result.player.name).toBe('PETE');
    expect(pete.tested_at).toBe(now.toISOString());
    expect(pete.scores).toEqual(makeResult({ name: 'PETE' }).scores);
    expect(pete.rank).toBe(1);

    const dave = await upsertZoneResult(
      db,
      'DAVE',
      makeResult({
        name: 'Dave',
        measurements: makeMeasurements({
          cpu: { singleThread: 184000, multiThread: 540000, workersUsed: 4, variance: 0.05 },
          network: {
            latencyMedianMs: 55,
            latencyP95Ms: 78,
            jitterMs: 11,
            uploadMbps: 10,
            downloadMbps: 25
          },
          stability: { frameTimeP95Ms: 22, stallCount: 2 }
        })
      })
    );
    expect(dave.rank).toBe(2);
    expect(dave.recommendation).toBe('backup');

    const list = await listZoneResults(db);
    expect(validateAgainst('ZoneResultList', list)).toBeNull();
    expect(list.items.map((item) => [item.rank, item.name])).toEqual([
      [1, 'PETE'],
      [2, 'DAVE']
    ]);
    expect(list.items[0]?.explanation.summary).toContain('PETE');
  });

  it('replaces an earlier result for the same name and keeps one row', async () => {
    const db = getDb();
    const later = new Date('2026-09-11T11:00:00.000Z');
    const replaced = await upsertZoneResult(
      db,
      'PETE',
      makeResult({
        name: ' Pete ',
        measurements: makeMeasurements({ network: { latencyMedianMs: 60, latencyP95Ms: 90 } })
      }),
      later
    );
    expect(replaced.tested_at).toBe(later.toISOString());
    const list = await listZoneResults(db);
    expect(list.items.filter((item) => item.name === 'PETE')).toHaveLength(1);
    expect(
      list.items.find((item) => item.name === 'PETE')?.result.measurements.network.latencyMedianMs
    ).toBe(60);
  });

  it('rejects bodies for another name, malformed shapes and incomplete runs', async () => {
    const db = getDb();
    const other = await failure(upsertZoneResult(db, 'PETE', makeResult({ name: 'Dave' })));
    expect(other.status).toBe(400);
    const shape = await failure(upsertZoneResult(db, 'PETE', { schemaVersion: 1 }));
    expect(shape.status).toBe(400);
    expect(shape.code).toBe('bad_request');
    const incomplete = await failure(
      upsertZoneResult(db, 'PETE', makeResult({ name: 'Pete', completion: { interrupted: true } }))
    );
    expect(incomplete.status).toBe(422);
    expect(incomplete.code).toBe('unprocessable');
    const impossible = makeResult({ name: 'Pete' });
    impossible.measurements.network.failureRate = 2;
    const rejected = await failure(upsertZoneResult(db, 'PETE', impossible));
    expect(rejected.status).toBe(422);
    const version = await failure(
      upsertZoneResult(db, 'PETE', { ...makeResult({ name: 'Pete' }), diagnosticVersion: '3.0.0' })
    );
    expect(version.status).toBe(422);
  });

  it('removes a result once and answers not found afterwards', async () => {
    const db = getDb();
    await deleteZoneResult(db, 'DAVE');
    expect((await listZoneResults(db)).items.map((item) => item.name)).toEqual(['PETE']);
    const missing = await failure(deleteZoneResult(db, 'DAVE'));
    expect(missing.status).toBe(404);
  });
});
