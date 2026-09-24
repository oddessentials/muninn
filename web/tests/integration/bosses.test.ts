import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { IngestBatch, TelemetryEvent } from '../../src/lib/api/types';
import { getDb } from '../../src/lib/server/db/client';
import { players } from '../../src/lib/server/db/schema';
import { applyBatchInTransaction } from '../../src/lib/server/ingest/ingest';
import { validateAgainst } from '../../src/lib/server/ingest/validate';
import { bossDetail, listBosses } from '../../src/lib/server/read/bosses';
import { progression } from '../../src/lib/server/read/world';
import { resetDatabase, useTestDatabase } from './setup';

vi.setConfig({ testTimeout: 240_000, hookTimeout: 240_000 });

beforeAll(async () => {
  useTestDatabase();
  await resetDatabase();
});

const firstRun = '11111111-1111-4111-8111-111111111111';
const secondRun = '22222222-2222-4222-8222-222222222222';
const firstBootAt = '2026-09-11T03:31:56.391Z';

function eventId(runId: string, seq: number): string {
  return `${runId.slice(0, 8)}-0000-4000-8000-${String(seq).padStart(12, '0')}`;
}

function started(
  runId: string,
  seq: number,
  ts: string,
  day: number,
  keys: string[]
): TelemetryEvent {
  return {
    id: eventId(runId, seq),
    run_id: runId,
    seq,
    ts,
    type: 'server.started',
    world_day: day,
    data: {
      game_version: '1.0.7',
      network_version: 39,
      plugin_version: '0.1.0',
      bepinex_version: '5.4.23.5',
      unity_version: '6000.0.75f1',
      world_name: 'savegame',
      world_uid: -198757517,
      net_time: day * 1800,
      world_day: day,
      global_keys: keys,
      missing_hooks: []
    }
  };
}

interface Creature {
  prefab: string;
  nameKey: string;
  participants?: string[];
}

function defeated(
  seq: number,
  ts: string,
  day: number,
  key: string,
  firstTime: boolean,
  creature: Creature | null = null
): TelemetryEvent {
  return {
    id: eventId(firstRun, seq),
    run_id: firstRun,
    seq,
    ts,
    type: 'boss.defeated',
    world_day: day,
    data: {
      key,
      first_time: firstTime,
      sender_platform_user_id: creature?.participants?.[0] ?? null,
      nearby: creature?.participants ?? [],
      prefab: creature?.prefab ?? null,
      name_key: creature?.nameKey ?? null,
      participants: creature?.participants ?? []
    }
  };
}

interface KeyedCreature {
  prefab: string;
  nameKey: string;
  sender: string;
  nearby: string[];
}

function keySet(
  seq: number,
  ts: string,
  day: number,
  key: string,
  firstTime: boolean,
  creature: KeyedCreature | null = null
): TelemetryEvent {
  return {
    id: eventId(firstRun, seq),
    run_id: firstRun,
    seq,
    ts,
    type: 'global_key.set',
    world_day: day,
    data: {
      key,
      value: null,
      first_time: firstTime,
      ...(creature
        ? {
            prefab: creature.prefab,
            name_key: creature.nameKey,
            sender_platform_user_id: creature.sender,
            nearby: creature.nearby
          }
        : {})
    }
  };
}

function summoned(
  seq: number,
  ts: string,
  day: number,
  prefab: string,
  nameKey: string,
  method: 'spawn_rpc' | 'zdo',
  summoner: string | null
): TelemetryEvent {
  return {
    id: eventId(firstRun, seq),
    run_id: firstRun,
    seq,
    ts,
    type: 'boss.summoned',
    world_day: day,
    data: {
      prefab,
      name_key: nameKey,
      x: -9200.5,
      z: 8100.2,
      biome: 'DeepNorth',
      summoner_platform_user_id: summoner,
      method
    }
  };
}

function engagedPrefab(
  seq: number,
  ts: string,
  day: number,
  prefab: string,
  nameKey: string,
  nearby: string[]
): TelemetryEvent {
  return {
    id: eventId(firstRun, seq),
    run_id: firstRun,
    seq,
    ts,
    type: 'boss.engaged',
    world_day: day,
    data: {
      prefab,
      name_key: nameKey,
      x: -9201.1,
      z: 8099.7,
      biome: 'DeepNorth',
      alert_message: '$enemy_boss_frozenking_alertmessage',
      nearby
    }
  };
}

function engaged(runId: string, seq: number, ts: string, day: number): TelemetryEvent {
  return {
    id: eventId(runId, seq),
    run_id: runId,
    seq,
    ts,
    type: 'boss.engaged',
    world_day: day,
    data: {
      prefab: 'gd_king',
      name_key: '$enemy_gdking',
      x: 105.6,
      z: -255.4,
      biome: 'BlackForest',
      alert_message: 'The Elder is awake',
      nearby: []
    }
  };
}

function stopping(runId: string, seq: number, ts: string): TelemetryEvent {
  return {
    id: eventId(runId, seq),
    run_id: runId,
    seq,
    ts,
    type: 'server.stopping',
    world_day: 28,
    data: { uptime_s: 3600, online_count: 0 }
  };
}

async function apply(events: TelemetryEvent[], now = new Date()) {
  const batch: IngestBatch = {
    plugin: { name: 'GuildTelemetry', version: '0.1.0' },
    game: { version: '1.0.7', network_version: 39 },
    server: { name: 'Ravenhold', world: 'savegame', world_uid: -198757517 },
    events
  };
  expect(validateAgainst('IngestBatch', batch)).toBeNull();
  await getDb().transaction((tx) => applyBatchInTransaction(tx, batch, new Date()));
  const items = await listBosses(getDb(), now);
  expect(validateAgainst('BossList', { items })).toBeNull();
  return new Map(items.map((boss) => [boss.key, boss]));
}

async function bossKillsOf(platformUserId: string): Promise<number> {
  const rows = await getDb()
    .select({ bossKills: players.bossKills })
    .from(players)
    .where(eq(players.platformUserId, platformUserId));
  return rows[0]?.bossKills ?? 0;
}

async function categoryOf(key: string): Promise<string | undefined> {
  const keys = await progression(getDb());
  return keys.find((entry) => entry.key === key)?.category;
}

describe('bosses defeated before the log began', () => {
  it('counts a key carried by the first server start as a defeat the plugin never saw', async () => {
    const bosses = await apply([
      started(firstRun, 1, firstBootAt, 23, ['defeated_eikthyr', 'activebosses 0'])
    ]);
    const eikthyr = bosses.get('defeated_eikthyr')!;
    expect(eikthyr.kills).toBe(0);
    expect(eikthyr.first_kill).toBeNull();
    expect(eikthyr.defeat).toEqual({ since: firstBootAt, day: 23, observed: false });
    for (const key of ['defeated_gdking', 'defeated_bonemass', 'defeated_dragon']) {
      expect(bosses.get(key)!.defeat).toBeNull();
    }
    expect(bosses.size).toBe(14);
    expect([...bosses.values()].filter((boss) => boss.tier === 'forsaken')).toHaveLength(8);
    expect([...bosses.values()].filter((boss) => boss.tier === 'mini')).toHaveLength(6);
    expect(bosses.get('defeated_frozenking_p3')).toMatchObject({
      name: 'Kall Fimbulbringer',
      tier: 'forsaken',
      order: 8,
      defeat: null
    });
    const detail = await bossDetail(getDb(), 'defeated_eikthyr');
    expect(validateAgainst('BossDetail', detail)).toBeNull();
    expect(detail.defeat).toEqual(eikthyr.defeat);
  });

  it('keeps the earlier evidence when a repeat kill is seen and takes an observed first kill', async () => {
    const bosses = await apply([
      defeated(2, '2026-09-11T08:00:00.000Z', 25, 'defeated_eikthyr', false),
      defeated(3, '2026-09-11T09:00:00.000Z', 26, 'defeated_gdking', true)
    ]);
    const eikthyr = bosses.get('defeated_eikthyr')!;
    expect(eikthyr.kills).toBe(1);
    expect(eikthyr.first_kill?.day).toBe(25);
    expect(eikthyr.defeat).toEqual({ since: firstBootAt, day: 23, observed: false });
    const elder = bosses.get('defeated_gdking')!;
    expect(elder.kills).toBe(1);
    expect(elder.defeat).toEqual({ since: '2026-09-11T09:00:00.000Z', day: 26, observed: true });
  });

  it('changes nothing for known keys on a later start and counts a saved mini-boss key as its defeat', async () => {
    const bosses = await apply([
      started(secondRun, 1, '2026-09-11T10:00:00.000Z', 27, [
        'defeated_eikthyr',
        'defeated_gdking',
        'defeated_serpent',
        'defeated_frozenking'
      ])
    ]);
    expect(bosses.get('defeated_eikthyr')!.defeat).toEqual({
      since: firstBootAt,
      day: 23,
      observed: false
    });
    expect(bosses.get('defeated_gdking')!.defeat?.observed).toBe(true);
    const serpent = bosses.get('defeated_serpent')!;
    expect(serpent.name).toBe('Serpent');
    expect(serpent.tier).toBe('mini');
    expect(serpent.order).toBe(1);
    expect(serpent.kills).toBe(0);
    expect(serpent.defeat).toEqual({ since: '2026-09-11T10:00:00.000Z', day: 27, observed: false });
    expect(bosses.get('defeated_frozenking_p3')!.defeat).toBeNull();
    expect(bosses.has('defeated_frozenking')).toBe(false);
  });
});

describe('a boss fight that nobody finishes', () => {
  const engagedAt = '2026-09-11T11:00:00.000Z';

  it('is shown as fighting only for an hour after the engagement', async () => {
    const during = await apply(
      [engaged(secondRun, 2, engagedAt, 28)],
      new Date('2026-09-11T11:30:00.000Z')
    );
    expect(during.get('defeated_bonemass')!.active).toBe(false);
    const later = await listBosses(getDb(), new Date('2026-09-11T12:01:00.000Z'));
    expect(later.find((boss) => boss.key === 'defeated_gdking')!.active).toBe(false);
    const detail = await bossDetail(
      getDb(),
      'defeated_gdking',
      new Date('2026-09-11T11:59:00.000Z')
    );
    expect(detail.active).toBe(true);
    expect(detail.engaged).toBe(1);
  });

  it('is over when the server run stops', async () => {
    const bosses = await apply(
      [stopping(secondRun, 3, '2026-09-11T11:10:00.000Z')],
      new Date('2026-09-11T11:11:00.000Z')
    );
    expect(bosses.get('defeated_gdking')!.active).toBe(false);
    expect(bosses.get('defeated_gdking')!.engaged).toBe(1);
  });
});

describe('mini-bosses', () => {
  const busto = 'Steam_76561198000000001';
  const freya = 'Steam_76561198000000002';

  it('records a defeat the old plugin reported as a boss kill under the mini tier', async () => {
    const bosses = await apply([
      defeated(20, '2026-09-20T02:10:57.218Z', 316, 'defeated_writhan', true, {
        prefab: 'Writhan',
        nameKey: 'Writhan',
        participants: [busto]
      })
    ]);
    const writhan = bosses.get('defeated_writhan')!;
    expect(writhan).toMatchObject({ name: 'Writhan', tier: 'mini', order: 3, kills: 1 });
    expect(writhan.defeat).toEqual({ since: '2026-09-20T02:10:57.218Z', day: 316, observed: true });
    expect(writhan.first_kill?.participants).toHaveLength(1);
    expect(await bossKillsOf(busto)).toBe(0);
    expect(await categoryOf('defeated_writhan')).toBe('mini_boss');
    expect(await categoryOf('defeated_eikthyr')).toBe('boss');
  });

  it('records a defeat the plugin reports as an enriched global key the same way', async () => {
    const bosses = await apply([
      keySet(21, '2026-09-20T02:13:55.711Z', 316, 'defeated_writhan', false, {
        prefab: 'Writhan',
        nameKey: '$enemy_writhan',
        sender: busto,
        nearby: [busto, freya]
      }),
      keySet(22, '2026-09-20T03:00:00.000Z', 317, 'bosshildir1', true, {
        prefab: 'Skeleton_Hildir_nochest',
        nameKey: '$enemy_skeletonfire',
        sender: freya,
        nearby: [freya]
      }),
      keySet(23, '2026-09-20T03:05:00.000Z', 317, 'killedtroll', true, {
        prefab: 'Troll',
        nameKey: '$enemy_troll',
        sender: freya,
        nearby: []
      })
    ]);
    const writhan = bosses.get('defeated_writhan')!;
    expect(writhan.kills).toBe(2);
    expect(writhan.last_kill_at).toBe('2026-09-20T02:13:55.711Z');
    const brenna = bosses.get('bosshildir1')!;
    expect(brenna).toMatchObject({ name: 'Brenna', tier: 'mini', kills: 1 });
    expect(brenna.first_kill?.participants).toHaveLength(1);
    expect(bosses.has('killedtroll')).toBe(false);
    const detail = await bossDetail(getDb(), 'bosshildir1');
    expect(validateAgainst('BossDetail', detail)).toBeNull();
    expect(detail.events.map((event) => event.kind)).toEqual(['defeated']);
    expect(await categoryOf('killedtroll')).toBe('other');
    expect(await bossKillsOf(freya)).toBe(0);
  });
});

describe('Kall Fimbulbringer', () => {
  const party = ['Steam_76561198000000001', 'Steam_76561198000000002'];
  const at = (minute: number, second = 0) =>
    `2026-09-22T20:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}.000Z`;

  it('folds the three phases into one Forsaken and counts the fight once', async () => {
    const bosses = await apply(
      [
        summoned(30, at(0), 400, 'FrozenKing', '$enemy_frozenking', 'spawn_rpc', party[0]!),
        engagedPrefab(31, at(0, 5), 400, 'FrozenKing', '$enemy_frozenking', party),
        engagedPrefab(32, at(0, 6), 400, 'FrozenKing', '$enemy_frozenking', party),
        defeated(33, at(6), 400, 'defeated_frozenking', true, {
          prefab: 'FrozenKing',
          nameKey: '$enemy_frozenking',
          participants: party
        }),
        summoned(34, at(6, 1), 400, 'FrozenKing_p2', '$enemy_frozenking', 'zdo', null),
        engagedPrefab(35, at(6, 4), 400, 'FrozenKing_p2', '$enemy_frozenking', party),
        summoned(36, at(11), 400, 'FrozenKing_p3', '$enemy_frozenking_p3', 'zdo', null),
        engagedPrefab(37, at(11, 3), 400, 'FrozenKing_p3', '$enemy_frozenking_p3', party)
      ],
      new Date(at(12))
    );
    const kall = bosses.get('defeated_frozenking_p3')!;
    expect(kall).toMatchObject({
      name: 'Kall Fimbulbringer',
      tier: 'forsaken',
      order: 8,
      summons: 1,
      engaged: 1,
      kills: 0,
      active: true,
      defeat: null
    });
    expect(bosses.has('defeated_frozenking')).toBe(false);
    expect(bosses.has('defeated_frozenking_p2')).toBe(false);
    expect(await bossKillsOf(party[0]!)).toBe(0);
    expect(await categoryOf('defeated_frozenking')).toBe('boss');

    const after = await apply(
      [
        defeated(38, at(19), 401, 'defeated_frozenking_p3', true, {
          prefab: 'FrozenKing_p3',
          nameKey: '$enemy_frozenking_p3',
          participants: party
        })
      ],
      new Date(at(20))
    );
    const slain = after.get('defeated_frozenking_p3')!;
    expect(slain).toMatchObject({ summons: 1, engaged: 1, kills: 1, active: false });
    expect(slain.defeat).toEqual({ since: at(19), day: 401, observed: true });
    expect(slain.first_kill?.participants).toHaveLength(2);
    expect(await bossKillsOf(party[0]!)).toBe(1);

    const detail = await bossDetail(getDb(), 'defeated_frozenking_p3');
    expect(validateAgainst('BossDetail', detail)).toBeNull();
    expect(detail.events.map((event) => [event.kind, event.phase])).toEqual([
      ['defeated', 3],
      ['engaged', 3],
      ['summoned', 3],
      ['engaged', 2],
      ['summoned', 2],
      ['phase', 1],
      ['engaged', 1],
      ['summoned', 1]
    ]);
    expect(await categoryOf('defeated_frozenking_p3')).toBe('boss');
  });

  it('ignores the Aesir Passage gate the plugin reports as a summon', async () => {
    const bosses = await apply([
      summoned(40, at(30), 401, 'vfx_LastBossGate_destroyed', '', 'spawn_rpc', party[0]!),
      keySet(41, at(30, 1), 401, 'lastbossgate_open', true)
    ]);
    expect([...bosses.keys()].some((key) => key.includes('lastbossgate'))).toBe(false);
    expect(bosses.size).toBe(14);
    expect(await categoryOf('lastbossgate_open')).toBe('other');
  });
});
