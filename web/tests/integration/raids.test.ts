import { asc, eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { IngestBatch, TelemetryEvent } from '../../src/lib/api/types';
import { getDb } from '../../src/lib/server/db/client';
import { players, raids, serverRuns } from '../../src/lib/server/db/schema';
import { applyBatchInTransaction } from '../../src/lib/server/ingest/ingest';
import { validateAgainst } from '../../src/lib/server/ingest/validate';
import { rebuildProjections } from '../../src/lib/server/jobs/rebuild';
import { runWatchdog } from '../../src/lib/server/jobs/watchdog';
import { buildActivityItems, queryActivity } from '../../src/lib/server/read/activity';
import { listRaids, raidDetail } from '../../src/lib/server/read/raids';
import { resetDatabase, useTestDatabase } from './setup';

vi.setConfig({ testTimeout: 240_000, hookTimeout: 240_000 });

beforeAll(async () => {
  useTestDatabase();
});

const runA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const runB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const runC = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const bjorn = 'Steam_76561198000000001';
const freya = 'Steam_76561198000000002';
const centre = { x: -250.9, z: -271.1 };

function envelope(
  runId: string,
  seq: number,
  ts: string,
  type: TelemetryEvent['type'],
  data: Record<string, unknown>
): TelemetryEvent {
  return {
    id: `${runId.slice(0, 8)}-0000-4000-8000-${String(seq).padStart(12, '0')}`,
    run_id: runId,
    seq,
    ts,
    type,
    world_day: 23,
    data
  } as TelemetryEvent;
}

function started(runId: string, seq: number, ts: string): TelemetryEvent {
  return envelope(runId, seq, ts, 'server.started', {
    game_version: '1.0.12',
    network_version: 39,
    plugin_version: '0.2.0',
    bepinex_version: '5.4.23.5',
    unity_version: '6000.0.75f1',
    world_name: 'savegame',
    world_uid: -198757517,
    net_time: 42344.5,
    world_day: 23,
    global_keys: ['defeated_eikthyr'],
    missing_hooks: []
  });
}

function stopping(runId: string, seq: number, ts: string): TelemetryEvent {
  return envelope(runId, seq, ts, 'server.stopping', { uptime_s: 600, online_count: 0 });
}

function heartbeat(runId: string, seq: number, ts: string): TelemetryEvent {
  return envelope(runId, seq, ts, 'server.heartbeat', {
    uptime_s: 600,
    net_time: 42344.5,
    world_day: 23,
    last_save_age_s: 60,
    queue_depth: 0,
    dropped_events: 0,
    players: []
  });
}

function joined(runId: string, seq: number, ts: string, id: string, name: string): TelemetryEvent {
  return envelope(runId, seq, ts, 'player.joined', {
    platform_user_id: id,
    display_id: `V_${id.slice(6)}`,
    platform: 'Steam',
    name,
    peer_uid: seq,
    playfab_id: null
  });
}

function raidStarted(runId: string, seq: number, ts: string, nearby: string[]): TelemetryEvent {
  return envelope(runId, seq, ts, 'raid.started', {
    name: 'army_theelder',
    ...centre,
    biome: 'Meadows',
    duration_s: 120,
    nearby
  });
}

function raidEnded(
  runId: string,
  seq: number,
  ts: string,
  activeS: number | undefined
): TelemetryEvent {
  return envelope(runId, seq, ts, 'raid.ended', {
    name: 'army_theelder',
    elapsed_s: 15005.4,
    ...(activeS === undefined ? {} : { active_s: activeS })
  });
}

async function apply(events: TelemetryEvent[], receivedAt = new Date()) {
  const batch: IngestBatch = {
    plugin: { name: 'GuildTelemetry', version: '0.2.0' },
    game: { version: '1.0.12', network_version: 39 },
    server: { name: 'Ravenhold', world: 'savegame', world_uid: -198757517 },
    events
  };
  expect(validateAgainst('IngestBatch', batch)).toBeNull();
  await getDb().transaction((tx) => applyBatchInTransaction(tx, batch, receivedAt));
}

async function raidRows() {
  return getDb().select().from(raids).orderBy(asc(raids.id));
}

async function publicRaids() {
  const page = await listRaids(getDb(), null, null, 50, 0);
  expect(validateAgainst('RaidPage', { items: page.items, next_cursor: null })).toBeNull();
  return page.items;
}

describe('a raid that outlives a server run', () => {
  it('stays one raid across a restart and ends with the game timer', async () => {
    await resetDatabase();
    await apply([
      started(runA, 1, '2026-09-11T03:00:00.000Z'),
      joined(runA, 2, '2026-09-11T03:05:00.000Z', bjorn, 'Bjorn'),
      raidStarted(runA, 3, '2026-09-11T03:10:00.000Z', [bjorn]),
      stopping(runA, 4, '2026-09-11T03:42:40.583Z')
    ]);
    let rows = await raidRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.endedAt?.toISOString()).toBe('2026-09-11T03:42:40.583Z');
    expect(rows[0]!.endReason).toBe('server_stop');
    expect(rows[0]!.restored).toBe(false);

    await apply([
      raidStarted(runB, 1, '2026-09-11T03:42:58.851Z', []),
      started(runB, 2, '2026-09-11T03:43:01.098Z'),
      joined(runB, 3, '2026-09-11T07:51:52.886Z', freya, 'Freya'),
      raidEnded(runB, 4, '2026-09-11T07:53:04.270Z', 120.1)
    ]);
    rows = await raidRows();
    expect(rows).toHaveLength(1);
    const raid = rows[0]!;
    expect(raid.runId).toBe(runB);
    expect(raid.startedAt.toISOString()).toBe('2026-09-11T03:10:00.000Z');
    expect(raid.endedAt?.toISOString()).toBe('2026-09-11T07:53:04.270Z');
    expect(raid.endReason).toBe('ended');
    expect(raid.activeS).toBe(120.1);
    expect(raid.resumeEventIds).toEqual([`${runB.slice(0, 8)}-0000-4000-8000-000000000001`]);
    const bjornRow = (
      await getDb().select().from(players).where(eq(players.platformUserId, bjorn))
    )[0]!;
    expect(raid.participantIds).toEqual([bjornRow.id]);
    expect(bjornRow.raids).toBe(1);

    const [item] = await publicRaids();
    expect(item!.end_reason).toBe('ended');
    expect(item!.restored).toBe(false);
    expect(item!.active_s).toBe(120.1);
    expect(item!.duration_s).toBe(
      Math.round(
        (Date.parse(raid.endedAt!.toISOString()) - Date.parse('2026-09-11T03:10:00.000Z')) / 1000
      )
    );

    const feed = await queryActivity(getDb(), {
      types: ['raid.started', 'raid.ended'],
      playerId: null,
      since: null,
      until: null,
      limit: 10,
      offset: 0
    });
    const items = await buildActivityItems(getDb(), feed.rows);
    const links = items.map((entry) => [entry.at, entry.links.raid_id]);
    expect(links).toEqual([
      ['2026-09-11T07:53:04.270Z', raid.id],
      ['2026-09-11T03:42:58.851Z', raid.id],
      ['2026-09-11T03:10:00.000Z', raid.id]
    ]);
  });

  it('is cut short when no later start brings it back', async () => {
    await resetDatabase();
    await apply([
      started(runA, 1, '2026-09-11T03:00:00.000Z'),
      raidStarted(runA, 2, '2026-09-11T03:10:00.000Z', []),
      stopping(runA, 3, '2026-09-11T03:20:00.000Z'),
      started(runB, 1, '2026-09-11T03:30:00.000Z'),
      raidEnded(runB, 2, '2026-09-11T03:31:00.000Z', undefined)
    ]);
    const rows = await raidRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.runId).toBe(runA);
    expect(rows[0]!.endedAt?.toISOString()).toBe('2026-09-11T03:20:00.000Z');
    expect(rows[0]!.endReason).toBe('server_stop');
    expect(rows[0]!.activeS).toBeNull();
    const [item] = await publicRaids();
    expect(item!.end_reason).toBe('server_stop');
    expect(item!.duration_s).toBe(600);
    const detail = await raidDetail(getDb(), rows[0]!.id);
    expect(validateAgainst('RaidDetail', detail)).toBeNull();
    expect(detail.end_reason).toBe('server_stop');
  });

  it('marks a raid the plugin first saw at a server start as restored', async () => {
    await resetDatabase();
    await apply([
      raidStarted(runA, 1, '2026-09-11T03:31:54.190Z', []),
      started(runA, 2, '2026-09-11T03:31:56.391Z')
    ]);
    const rows = await raidRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.restored).toBe(true);
    expect(rows[0]!.endedAt).toBeNull();
    const [item] = await publicRaids();
    expect(item!.restored).toBe(true);
    expect(item!.end_reason).toBeNull();
    expect(item!.duration_s).toBeNull();
    const run = (await getDb().select().from(serverRuns).where(eq(serverRuns.runId, runA)))[0]!;
    expect(run.startedAt.toISOString()).toBe('2026-09-11T03:31:56.391Z');
  });

  it('does not treat a fresh raid as a resumption of an earlier one', async () => {
    await resetDatabase();
    await apply([
      started(runA, 1, '2026-09-11T03:00:00.000Z'),
      raidStarted(runA, 2, '2026-09-11T03:10:00.000Z', []),
      stopping(runA, 3, '2026-09-11T03:20:00.000Z'),
      started(runB, 1, '2026-09-11T03:30:00.000Z'),
      raidStarted(runB, 2, '2026-09-11T04:00:00.000Z', []),
      raidEnded(runB, 3, '2026-09-11T04:02:00.000Z', 120)
    ]);
    const rows = await raidRows();
    expect(rows).toHaveLength(2);
    expect(rows[0]!.endReason).toBe('server_stop');
    expect(rows[1]!.endReason).toBe('ended');
    expect(rows[1]!.restored).toBe(false);
    expect(rows[1]!.resumeEventIds).toEqual([]);
  });

  it('comes back when a heartbeat disproves a lost run, and survives a rebuild', async () => {
    await resetDatabase();
    const bootAt = new Date('2026-09-11T03:00:00.000Z');
    await apply(
      [
        started(runC, 1, '2026-09-11T03:00:00.000Z'),
        raidStarted(runC, 2, '2026-09-11T03:10:00.000Z', []),
        heartbeat(runC, 3, '2026-09-11T03:10:30.000Z')
      ],
      bootAt
    );
    const lostAt = new Date('2026-09-11T03:20:00.000Z');
    const result = await runWatchdog(getDb(), lostAt, new Date(0));
    expect(result.lostRuns).toEqual([runC]);
    let rows = await raidRows();
    expect(rows[0]!.endReason).toBe('server_lost');
    expect(rows[0]!.endedAt?.toISOString()).toBe('2026-09-11T03:10:30.000Z');

    await apply(
      [heartbeat(runC, 4, '2026-09-11T03:21:00.000Z')],
      new Date('2026-09-11T03:21:00.500Z')
    );
    rows = await raidRows();
    expect(rows[0]!.endReason).toBeNull();
    expect(rows[0]!.endedAt).toBeNull();
    const run = (await getDb().select().from(serverRuns).where(eq(serverRuns.runId, runC)))[0]!;
    expect(run.stoppedAt).toBeNull();
    expect(run.lastHeartbeatReceivedAt?.toISOString()).toBe('2026-09-11T03:21:00.500Z');

    await apply(
      [raidEnded(runC, 5, '2026-09-11T03:22:00.000Z', 119.9)],
      new Date('2026-09-11T03:22:00.500Z')
    );
    const before = JSON.stringify(await raidRows());
    expect(JSON.parse(before)[0].endReason).toBe('ended');
    await rebuildProjections(getDb());
    expect(JSON.stringify(await raidRows())).toBe(before);
  });
});
