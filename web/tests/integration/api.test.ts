import { beforeAll, describe, expect, it, vi } from 'vitest';
import { getDb } from '../../src/lib/server/db/client';
import { applyBatchInTransaction } from '../../src/lib/server/ingest/ingest';
import { validateAgainst } from '../../src/lib/server/ingest/validate';
import { buildActivityItems, queryActivity } from '../../src/lib/server/read/activity';
import {
  adminHealth,
  listAdminPlayers,
  mergePlayers,
  patchPlayer
} from '../../src/lib/server/read/admin';
import { bossDetail, bossEventItems, listBosses } from '../../src/lib/server/read/bosses';
import { listChat } from '../../src/lib/server/read/chat';
import { comfortCatalogue, storeComfortCatalogue } from '../../src/lib/server/read/comfort';
import { adminEvent, listAdminEvents } from '../../src/lib/server/read/events';
import {
  listPlayers,
  playerDeaths,
  playerDetail,
  playerKills,
  playerPositions,
  playerSessions,
  playerStructures
} from '../../src/lib/server/read/players';
import { listRaids, raidDetail } from '../../src/lib/server/read/raids';
import {
  computeOnline,
  computeStatus,
  listRuns,
  statusHistory
} from '../../src/lib/server/read/status';
import { recentStructures, structureSummary } from '../../src/lib/server/read/structures';
import { listSaves, progression, worldSummary } from '../../src/lib/server/read/world';
import { listZoneResults } from '../../src/lib/server/read/zone';
import { comfortUpload, seededBatches, resetDatabase, useTestDatabase } from './setup';

vi.setConfig({ testTimeout: 240_000, hookTimeout: 240_000 });

beforeAll(async () => {
  useTestDatabase();
  await resetDatabase();
});

const page = { limit: 50, offset: 0 };

async function snapshot() {
  const db = getDb();
  const players = await listPlayers(db, {
    q: null,
    sort: 'last_seen',
    order: 'desc',
    online: null,
    includeHidden: false,
    ...page
  });
  const firstPlayer = players.items[0]?.id ?? null;
  const raids = await listRaids(db, null, null, 50, 0);
  const firstRaid = raids.items[0]?.id ?? null;
  const activity = await queryActivity(db, {
    types: null,
    playerId: null,
    since: null,
    until: null,
    ...page
  });
  const adminEvents = await listAdminEvents(db, {
    type: null,
    runId: null,
    playerId: null,
    since: null,
    until: null,
    ...page
  });
  const documents: Record<string, unknown> = {
    Status: await computeStatus(db),
    StatusHistory: await statusHistory(db, '24h'),
    OnlineList: await computeOnline(db),
    RunPage: { items: (await listRuns(db, 50, 0)).rows, next_cursor: null },
    PlayerPage: { items: players.items, next_cursor: null },
    BossList: { items: await listBosses(db) },
    BossDetail: await bossDetail(db, 'defeated_eikthyr'),
    BossEventPage: {
      items: (await bossEventItems(db, 'defeated_eikthyr', 50, 0)).items,
      next_cursor: null
    },
    RaidPage: { items: raids.items, next_cursor: null },
    ProgressionList: { items: await progression(db) },
    World: await worldSummary(db),
    SavePage: { items: (await listSaves(db, 50, 0)).items, next_cursor: null },
    ChatPage: {
      items: (await listChat(db, { kind: null, playerId: null, since: null, until: null, ...page }))
        .items,
      next_cursor: null
    },
    Structures: await structureSummary(db, '30d'),
    StructureEventPage: { items: (await recentStructures(db, 50, 0)).items, next_cursor: null },
    ActivityPage: { items: await buildActivityItems(db, activity.rows), next_cursor: null },
    AdminPlayerPage: { items: (await listAdminPlayers(db, true, 50, 0)).items, next_cursor: null },
    EventPage: { items: adminEvents.items, next_cursor: null },
    AdminHealth: await adminHealth(db, [
      { name: 'a2s_poller', lastRunAt: null, lastOk: null, lastError: null }
    ]),
    ZoneResultList: await listZoneResults(db),
    Comfort: await comfortCatalogue(db)
  };
  if (firstPlayer !== null) {
    documents.Player = await playerDetail(db, firstPlayer);
    documents.SessionPage = {
      items: (await playerSessions(db, firstPlayer, 50, 0)).items,
      next_cursor: null
    };
    documents.DeathPage = {
      items: (await playerDeaths(db, firstPlayer, 50, 0)).items,
      next_cursor: null
    };
    documents.PlayerKills = await playerKills(db, firstPlayer);
    documents.PositionList = { items: await playerPositions(db, firstPlayer, '7d', 500) };
    documents.PlayerStructures = await playerStructures(db, firstPlayer);
  }
  if (firstRaid !== null) documents.RaidDetail = await raidDetail(db, firstRaid);
  if (adminEvents.items[0]) documents.StoredEvent = await adminEvent(db, adminEvents.items[0].id);
  return documents;
}

function expectValid(documents: Record<string, unknown>) {
  for (const [schema, document] of Object.entries(documents)) {
    const problem = validateAgainst(schema, document);
    expect(problem, `${schema}: ${problem ?? ''}`).toBeNull();
  }
}

describe('read API against the contract', () => {
  it('validates every response on an empty database', async () => {
    const documents = await snapshot();
    expectValid(documents);
    expect((documents.Status as { source: string }).source).toBe('none');
    const bosses = (documents.BossList as { items: { defeat: unknown }[] }).items;
    expect(bosses).toHaveLength(14);
    expect(bosses.every((boss) => boss.defeat === null)).toBe(true);
  });

  it('validates every response after the simulated history and returns data everywhere', async () => {
    const db = getDb();
    for (const batch of seededBatches(6)) {
      await db.transaction((tx) => applyBatchInTransaction(tx, batch, new Date()));
    }
    await storeComfortCatalogue(db, comfortUpload());
    const documents = await snapshot();
    expectValid(documents);
    const nonEmpty = (name: string) => {
      const document = documents[name] as { items?: unknown[] } | undefined;
      expect(document, name).toBeDefined();
      if (document && 'items' in document) expect(document.items?.length, name).toBeGreaterThan(0);
    };
    for (const name of [
      'RunPage',
      'PlayerPage',
      'RaidPage',
      'ProgressionList',
      'SavePage',
      'ChatPage',
      'StructureEventPage',
      'ActivityPage',
      'EventPage',
      'SessionPage',
      'DeathPage',
      'PositionList',
      'OnlineList',
      'BossEventPage'
    ]) {
      nonEmpty(name);
    }
    const comfort = documents.Comfort as {
      catalogue: { items: { prefab: string; built: number }[] };
    };
    expect(
      comfort.catalogue.items.find((item) => item.prefab === 'fire_pit')?.built
    ).toBeGreaterThan(0);
    const status = documents.Status as { online: boolean; source: string; player_count: number };
    expect(status.source).toBe('plugin');
    expect(status.online).toBe(true);
    expect(status.player_count).toBeGreaterThan(0);
    const player = documents.Player as {
      stats: { kills_credited: number; kills_nearby: number };
      biomes: unknown[];
    };
    expect(player.stats.kills_credited + player.stats.kills_nearby).toBeGreaterThan(0);
    expect(player.biomes.length).toBeGreaterThan(0);
    const bosses = documents.BossList as {
      items: { kills: number; defeat: { observed: boolean } | null }[];
    };
    expect(bosses.items.filter((boss) => boss.kills > 0).length).toBeGreaterThanOrEqual(1);
    expect(
      bosses.items.every((boss) =>
        boss.kills > 0 ? boss.defeat?.observed === true : boss.defeat === null
      )
    ).toBe(true);
  });

  it('applies admin renames, hiding and merges', async () => {
    const db = getDb();
    const players = await listAdminPlayers(db, true, 50, 0);
    const [first, second] = players.items;
    expect(first && second).toBeTruthy();
    const renamed = await patchPlayer(db, first!.id, {
      display_name_override: 'Chief',
      hidden: true
    });
    expect(renamed.display_name).toBe('Chief');
    expect(renamed.hidden).toBe(true);
    const visible = await listPlayers(db, {
      q: null,
      sort: 'name',
      order: 'asc',
      online: null,
      includeHidden: false,
      ...page
    });
    expect(visible.items.some((item) => item.id === first!.id)).toBe(false);
    const merged = await mergePlayers(db, second!.id, first!.id);
    expect(merged.aliases).toContain(second!.platform_user_id);
    expect(merged.sessions).toBe(first!.sessions + second!.sessions);
    await expect(mergePlayers(db, first!.id, first!.id)).rejects.toThrow();
    expect(validateAgainst('AdminPlayer', merged)).toBeNull();
  });
});
