import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { Announcement, IngestBatch, TelemetryEvent } from '../../src/lib/api/types';
import { cookieName, createSession } from '../../src/lib/server/auth/admin';
import { getDb } from '../../src/lib/server/db/client';
import { announcements } from '../../src/lib/server/db/schema';
import { env } from '../../src/lib/server/env';
import { ApiHttpError } from '../../src/lib/server/http/respond';
import { applyBatchInTransaction } from '../../src/lib/server/ingest/ingest';
import { validateAgainst } from '../../src/lib/server/ingest/validate';
import { buildActivityItems, queryActivity } from '../../src/lib/server/read/activity';
import {
  activeAnnouncements,
  cancelAnnouncement,
  collectForPlugin,
  createAnnouncement,
  listAnnouncements,
  parseAnnouncement
} from '../../src/lib/server/read/announcements';
import { POST as ingest } from '../../src/routes/api/ingest/+server';
import {
  GET as listRoute,
  POST as createRoute
} from '../../src/routes/api/v1/admin/announcements/+server';
import { DELETE as cancelRoute } from '../../src/routes/api/v1/admin/announcements/[id]/+server';
import { resetDatabase, routeEvent, signedRequest, useTestDatabase } from './setup';

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

beforeAll(async () => {
  useTestDatabase();
  await resetDatabase();
});

const runId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const now = new Date();
const inMinutes = (minutes: number, from = now) => new Date(from.getTime() + minutes * 60_000);

function envelope(
  seq: number,
  ts: Date,
  type: TelemetryEvent['type'],
  data: Record<string, unknown>
): TelemetryEvent {
  return {
    id: `dddddddd-0000-4000-8000-${String(seq).padStart(12, '0')}`,
    run_id: runId,
    seq,
    ts: ts.toISOString(),
    type,
    world_day: 40,
    data
  } as TelemetryEvent;
}

function batchOf(events: TelemetryEvent[]): IngestBatch {
  return {
    plugin: { name: 'GuildTelemetry', version: '0.3.0' },
    game: { version: '1.0.12', network_version: 40 },
    server: { name: 'Ravenhold', world: 'savegame', world_uid: -198757517 },
    events
  };
}

function heartbeat(seq: number, ts: Date): TelemetryEvent {
  return envelope(seq, ts, 'server.heartbeat', {
    uptime_s: 600,
    net_time: 42344.5,
    world_day: 40,
    last_save_age_s: 60,
    queue_depth: 0,
    dropped_events: 0,
    players: []
  });
}

function shown(
  seq: number,
  ts: Date,
  announcementId: number,
  kind: 'message' | 'restart',
  text: string,
  remaining: number | null,
  final: boolean
): TelemetryEvent {
  return envelope(seq, ts, 'announcement.shown', {
    announcement_id: announcementId,
    kind,
    text,
    remaining_s: remaining,
    final
  });
}

async function failure(work: () => unknown): Promise<ApiHttpError> {
  let caught: unknown = null;
  try {
    await work();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(ApiHttpError);
  return caught as ApiHttpError;
}

async function adminRequest(method: string, path: string, body?: unknown, origin = env.origin) {
  const session = await createSession();
  const cookie = session.setCookie.split(';')[0]!.slice(cookieName.length + 1);
  const request = new Request(`http://test${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(origin ? { origin } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const match = /\/announcements\/([^/]+)$/.exec(path);
  const event = routeEvent(request, match ? { id: match[1]! } : {});
  (event as { cookies: unknown }).cookies = {
    get: (name: string) => (name === cookieName ? cookie : undefined)
  };
  return event;
}

describe('announcement validation', () => {
  it('accepts a message and a restart with the documented limits', () => {
    expect(parseAnnouncement({ kind: 'message', text: '  Portal hub rebuilt  ' }, now)).toEqual({
      kind: 'message',
      text: 'Portal hub rebuilt',
      restartAt: null
    });
    expect(
      parseAnnouncement({ kind: 'restart', restart_at: inMinutes(15).toISOString(), text: '' }, now)
    ).toEqual({ kind: 'restart', text: null, restartAt: inMinutes(15) });
  });

  it('rejects malformed bodies with 400', async () => {
    const cases: [unknown, string][] = [
      [null, 'JSON object'],
      [{ kind: 'shout' }, 'kind must be'],
      [{ kind: 'message', text: '   ' }, 'text is required'],
      [{ kind: 'message', text: 'x'.repeat(201) }, 'at most 200'],
      [{ kind: 'message', text: 'hi', restart_at: inMinutes(5).toISOString() }, 'only applies'],
      [{ kind: 'message', text: 'hi', colour: 'red' }, 'unknown field'],
      [{ kind: 'restart' }, 'restart_at is required'],
      [{ kind: 'restart', restart_at: 'tomorrow' }, 'ISO 8601'],
      [{ kind: 'restart', restart_at: inMinutes(0.5).toISOString() }, 'at least 60 seconds'],
      [{ kind: 'restart', restart_at: inMinutes(25 * 60).toISOString() }, 'within 24 hours'],
      [{ kind: 'restart', restart_at: inMinutes(5).toISOString(), text: 7 }, 'string or null']
    ];
    for (const [body, message] of cases) {
      const error = await failure(() => parseAnnouncement(body, now));
      expect(error.status, JSON.stringify(body)).toBe(400);
      expect(error.message, JSON.stringify(body)).toContain(message);
    }
  });
});

describe('admin announcement routes', () => {
  it('creates, lists and cancels through the handlers with the admin guards', async () => {
    await resetDatabase();
    const anonymous = routeEvent(
      new Request('http://test/api/v1/admin/announcements', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'message', text: 'hello' })
      })
    );
    expect((await createRoute(anonymous)).status).toBe(401);
    const wrongOrigin = await adminRequest(
      'POST',
      '/api/v1/admin/announcements',
      { kind: 'message', text: 'hello' },
      'https://elsewhere.example'
    );
    expect((await createRoute(wrongOrigin)).status).toBe(403);

    const created = await createRoute(
      await adminRequest('POST', '/api/v1/admin/announcements', { kind: 'message', text: 'hello' })
    );
    expect(created.status).toBe(201);
    const announcement = (await created.json()) as Announcement;
    expect(validateAgainst('Announcement', announcement)).toBeNull();
    expect(announcement).toMatchObject({ kind: 'message', text: 'hello', status: 'pending' });

    const bad = await createRoute(
      await adminRequest('POST', '/api/v1/admin/announcements', { kind: 'restart' })
    );
    expect(bad.status).toBe(400);

    const listed = await listRoute(await adminRequest('GET', '/api/v1/admin/announcements'));
    expect(listed.status).toBe(200);
    const list = (await listed.json()) as { items: Announcement[] };
    expect(validateAgainst('AnnouncementList', list)).toBeNull();
    expect(list.items.map((item) => item.id)).toEqual([announcement.id]);

    const cancelled = await cancelRoute(
      await adminRequest('DELETE', `/api/v1/admin/announcements/${announcement.id}`)
    );
    expect(cancelled.status).toBe(204);
    const again = await cancelRoute(
      await adminRequest('DELETE', `/api/v1/admin/announcements/${announcement.id}`)
    );
    expect(again.status).toBe(409);
    const missing = await cancelRoute(
      await adminRequest('DELETE', '/api/v1/admin/announcements/999')
    );
    expect(missing.status).toBe(404);
    const notANumber = await cancelRoute(
      await adminRequest('DELETE', '/api/v1/admin/announcements/abc')
    );
    expect(notANumber.status).toBe(400);
    const after = await listAnnouncements(getDb());
    expect(after[0]).toMatchObject({ id: announcement.id, status: 'cancelled' });
    expect(after[0]?.cancelled_at).not.toBeNull();
  });
});

describe('announcements ride back to the plugin', () => {
  it('hands every active announcement to the ingest response and stamps delivery', async () => {
    await resetDatabase();
    const db = getDb();
    const message = await createAnnouncement(
      db,
      { kind: 'message', text: 'Bring stag horns', restartAt: null },
      now
    );
    const restart = await createAnnouncement(
      db,
      { kind: 'restart', text: 'Patch day', restartAt: inMinutes(5) },
      now
    );
    const stale = await createAnnouncement(
      db,
      { kind: 'message', text: 'too old', restartAt: null },
      inMinutes(-11)
    );
    const past = await createAnnouncement(
      db,
      { kind: 'restart', text: null, restartAt: inMinutes(-3) },
      inMinutes(-20)
    );
    const withdrawn = await createAnnouncement(
      db,
      { kind: 'message', text: 'withdrawn', restartAt: null },
      now
    );
    await cancelAnnouncement(db, withdrawn.id, now);

    const active = await activeAnnouncements(db, now);
    expect(active.map((row) => row.id)).toEqual([message.id, restart.id]);

    const response = await ingest(routeEvent(signedRequest(batchOf([heartbeat(1, now)]))));
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      accepted: number;
      announcements: {
        id: number;
        kind: string;
        restart_in_s: number | null;
        text: string | null;
      }[];
    };
    expect(validateAgainst('IngestResult', body)).toBeNull();
    expect(body.accepted).toBe(1);
    expect(body.announcements.map((item) => item.id)).toEqual([message.id, restart.id]);
    expect(body.announcements[0]).toMatchObject({
      kind: 'message',
      text: 'Bring stag horns',
      restart_in_s: null
    });
    const restartOut = body.announcements[1]!;
    expect(restartOut.kind).toBe('restart');
    const expectedLead = Math.round((inMinutes(5).getTime() - Date.now()) / 1000);
    expect(Math.abs((restartOut.restart_in_s ?? 0) - expectedLead)).toBeLessThanOrEqual(5);

    const listed = await listAnnouncements(db, now);
    const byId = new Map(listed.map((item) => [item.id, item]));
    expect(byId.get(message.id)?.status).toBe('delivered');
    expect(byId.get(message.id)?.delivered_at).not.toBeNull();
    expect(byId.get(restart.id)?.status).toBe('delivered');
    expect(byId.get(stale.id)?.status).toBe('expired');
    expect(byId.get(past.id)?.status).toBe('expired');
    expect(byId.get(withdrawn.id)?.status).toBe('cancelled');

    const firstDelivery = byId.get(message.id)?.delivered_at;
    const again = await collectForPlugin(db, inMinutes(1));
    expect(again.map((item) => item.id)).toEqual([message.id, restart.id]);
    const relisted = await listAnnouncements(db, inMinutes(1));
    expect(relisted.find((item) => item.id === message.id)?.delivered_at).toBe(firstDelivery);
  });
});

describe('announcement.shown projection', () => {
  it('records banners on the announcement, completes it on the final one and feeds the activity list', async () => {
    await resetDatabase();
    const db = getDb();
    const message = await createAnnouncement(
      db,
      { kind: 'message', text: 'Bring stag horns', restartAt: null },
      now
    );
    const restart = await createAnnouncement(
      db,
      { kind: 'restart', text: null, restartAt: inMinutes(15) },
      now
    );
    await collectForPlugin(db, now);

    const first = batchOf([
      shown(1, inMinutes(0.5), message.id, 'message', 'Bring stag horns', null, true),
      shown(2, inMinutes(0.5), restart.id, 'restart', 'Server restart in 15 min', 870, false),
      shown(3, inMinutes(5), restart.id, 'restart', 'Server restart in 10 min', 600, false)
    ]);
    expect(validateAgainst('IngestBatch', first)).toBeNull();
    const outcome = await db.transaction((tx) => applyBatchInTransaction(tx, first, inMinutes(5)));
    expect(outcome.accepted).toBe(3);

    let listed = await listAnnouncements(db, inMinutes(5));
    let byId = new Map(listed.map((item) => [item.id, item]));
    expect(byId.get(message.id)).toMatchObject({
      status: 'shown',
      shown_at: inMinutes(0.5).toISOString(),
      completed_at: inMinutes(0.5).toISOString()
    });
    expect(byId.get(restart.id)).toMatchObject({
      status: 'delivered',
      shown_at: inMinutes(0.5).toISOString(),
      completed_at: null
    });
    expect(await activeAnnouncements(db, inMinutes(5))).toHaveLength(1);

    const final = batchOf([
      shown(4, inMinutes(15), restart.id, 'restart', 'Server restarting now', 0, true)
    ]);
    await db.transaction((tx) => applyBatchInTransaction(tx, final, inMinutes(15)));
    listed = await listAnnouncements(db, inMinutes(15));
    byId = new Map(listed.map((item) => [item.id, item]));
    expect(byId.get(restart.id)).toMatchObject({
      status: 'shown',
      completed_at: inMinutes(15).toISOString()
    });
    expect(await activeAnnouncements(db, inMinutes(15))).toHaveLength(0);

    const replay = await db.transaction((tx) => applyBatchInTransaction(tx, first, inMinutes(16)));
    expect(replay.duplicates).toBe(3);
    const rows = await db.select().from(announcements).where(eq(announcements.id, restart.id));
    expect(rows[0]?.shownAt?.toISOString()).toBe(inMinutes(0.5).toISOString());
    expect(rows[0]?.completedAt?.toISOString()).toBe(inMinutes(15).toISOString());

    const feed = await queryActivity(db, {
      types: ['announcement.shown'],
      playerId: null,
      since: null,
      until: null,
      limit: 10,
      offset: 0
    });
    expect(feed.rows).toHaveLength(4);
    const items = await buildActivityItems(db, feed.rows);
    for (const item of items) expect(validateAgainst('ActivityItem', item)).toBeNull();
    expect(items[0]).toMatchObject({
      type: 'announcement.shown',
      player: null,
      summary: {
        announcement_id: restart.id,
        kind: 'restart',
        text: 'Server restarting now',
        remaining_s: 0,
        final: true
      }
    });
    const everything = await queryActivity(db, {
      types: null,
      playerId: null,
      since: null,
      until: null,
      limit: 10,
      offset: 0
    });
    expect(everything.rows.map((row) => row.type)).toContain('announcement.shown');
  });
});
