import { randomUUID } from 'node:crypto';
import { eq, inArray, sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  IngestBatch,
  ServerStartedEvent,
  StructureBuiltEvent,
  StructureDestroyedEvent
} from '../../src/lib/api/types';
import { getDb, getSql } from '../../src/lib/server/db/client';
import {
  creatorAccounts,
  eventPlayers,
  events,
  players,
  structureEvents,
  structuresDaily
} from '../../src/lib/server/db/schema';
import { applyBatchInTransaction } from '../../src/lib/server/ingest/ingest';
import { creditStructures } from '../../src/lib/server/jobs/credits';
import { rebuildProjections } from '../../src/lib/server/jobs/rebuild';
import { mergePlayers } from '../../src/lib/server/read/admin';
import { structureSummary } from '../../src/lib/server/read/structures';
import { resetDatabase, seededBatches, useTestDatabase } from './setup';

vi.setConfig({ testTimeout: 240_000, hookTimeout: 240_000 });

beforeEach(async () => {
  useTestDatabase();
  await resetDatabase();
});

const structureTypes = ['structure.built', 'structure.destroyed'];

function asLive(batches: IngestBatch[]): IngestBatch[] {
  return batches.map((batch) => ({
    ...batch,
    events: batch.events.map((event) => {
      const data = JSON.parse(
        JSON.stringify(event.data).replace(/"character_id":-?\d+/g, '"character_id":0')
      ) as Record<string, unknown>;
      if (event.type === 'structure.built') data.creator_platform_user_id = null;
      return { ...event, data } as typeof event;
    })
  }));
}

function accountsOf(batches: IngestBatch[]): Map<number, string> {
  const accounts = new Map<number, string>();
  for (const batch of batches) {
    for (const event of batch.events) {
      if (event.type !== 'structure.built') continue;
      const data = (event as StructureBuiltEvent).data;
      if (data.creator_character_id && data.creator_platform_user_id) {
        accounts.set(data.creator_character_id, data.creator_platform_user_id);
      }
    }
  }
  return accounts;
}

async function ingest(batches: IngestBatch[]) {
  const db = getDb();
  for (const batch of batches) {
    await db.transaction((tx) => applyBatchInTransaction(tx, batch, new Date()));
  }
}

async function structureCredits() {
  const db = getDb();
  const structureEventIds = db
    .select({ id: events.id })
    .from(events)
    .where(inArray(events.type, structureTypes));
  return {
    daily: await db
      .select()
      .from(structuresDaily)
      .orderBy(structuresDaily.date, structuresDaily.prefab, structuresDaily.builderPlayerId),
    rows: await db
      .select({ eventId: structureEvents.eventId, playerId: structureEvents.playerId })
      .from(structureEvents)
      .orderBy(structureEvents.eventId),
    subjects: await db
      .select({ id: events.id, playerId: events.playerId })
      .from(events)
      .where(inArray(events.type, structureTypes))
      .orderBy(events.id),
    involved: await db
      .select({ eventId: eventPlayers.eventId, playerId: eventPlayers.playerId })
      .from(eventPlayers)
      .where(inArray(eventPlayers.eventId, structureEventIds))
      .orderBy(eventPlayers.eventId, eventPlayers.playerId),
    counters: await db
      .select({
        id: players.id,
        built: players.structuresBuilt,
        destroyed: players.structuresDestroyed
      })
      .from(players)
      .orderBy(players.id)
  };
}

describe('structure credits', () => {
  it('credits past builds once the creator accounts are known, exactly as a full rebuild does', async () => {
    const seeded = seededBatches(3);
    await ingest(asLive(seeded));
    const db = getDb();
    const before = await structureSummary(db, 'all');
    expect(before.built_total).toBeGreaterThan(0);
    expect(before.by_builder.every((row) => row.player === null)).toBe(true);
    expect(await creditStructures(db)).toBeNull();

    const accounts = accountsOf(seeded);
    expect(accounts.size).toBeGreaterThan(1);
    await db
      .insert(creatorAccounts)
      .values([...accounts].map(([creatorId, platformUserId]) => ({ creatorId, platformUserId })));
    const outcome = await creditStructures(db);
    expect(outcome?.credited).toBeGreaterThan(0);
    expect(await creditStructures(db)).toBeNull();

    const after = await structureSummary(db, 'all');
    expect(after.built_total).toBe(before.built_total);
    const named = after.by_builder.filter((row) => row.player !== null);
    expect(named.length).toBeGreaterThan(1);
    expect(after.by_builder.reduce((sum, row) => sum + row.built, 0)).toBe(after.built_total);
    const credited = await structureCredits();
    expect(credited.counters.some((row) => row.built > 0)).toBe(true);

    await rebuildProjections(db);
    expect(await structureCredits()).toEqual(credited);
  });

  it('learns creator accounts from server.started and from builds that carry one', async () => {
    const [batch] = seededBatches(1);
    const started = batch!.events.find(
      (event): event is ServerStartedEvent => event.type === 'server.started'
    )!;
    const built = batch!.events.find(
      (event): event is StructureBuiltEvent => event.type === 'structure.built'
    )!;
    const top = Math.max(...batch!.events.map((event) => event.seq));
    const announced: ServerStartedEvent = {
      ...started,
      id: randomUUID(),
      seq: top + 1,
      data: { ...started.data, creators: [{ creator_id: 111, platform_user_id: 'Steam_111' }] }
    };
    const placed: StructureBuiltEvent = {
      ...built,
      id: randomUUID(),
      seq: top + 2,
      data: { ...built.data, creator_character_id: 222, creator_platform_user_id: 'Steam_222' }
    };
    const db = getDb();
    await db.transaction((tx) =>
      applyBatchInTransaction(tx, { ...batch!, events: [announced, placed] }, new Date())
    );
    const learned = await db.select().from(creatorAccounts).orderBy(creatorAccounts.creatorId);
    expect(learned.map((row) => [row.creatorId, row.platformUserId])).toEqual([
      [111, 'Steam_111'],
      [222, 'Steam_222']
    ]);
    const again: StructureBuiltEvent = { ...placed, id: randomUUID(), seq: top + 3 };
    await db.transaction((tx) =>
      applyBatchInTransaction(tx, { ...batch!, events: [again] }, new Date())
    );
    const unchanged = await db
      .select()
      .from(creatorAccounts)
      .where(eq(creatorAccounts.creatorId, 222));
    expect(unchanged[0]?.updatedAt.getTime()).toBe(learned[1]?.updatedAt.getTime());
  });

  it('credits a removal to the account it carries and keeps world pieces apart on Structures', async () => {
    const seeded = seededBatches(1);
    await ingest(seeded);
    const db = getDb();
    const batch = seeded.find((candidate) =>
      candidate.events.some((event) => event.type === 'structure.built')
    )!;
    const built = batch.events.find(
      (event): event is StructureBuiltEvent => event.type === 'structure.built'
    )!;
    const top = Math.max(...seeded.flatMap((each) => each.events.map((event) => event.seq)));
    const removed: StructureDestroyedEvent = {
      ...built,
      type: 'structure.destroyed',
      id: randomUUID(),
      seq: top + 1,
      data: {
        prefab: built.data.prefab,
        x: built.data.x,
        z: built.data.z,
        biome: built.data.biome,
        creator_character_id: 987654,
        creator_platform_user_id: built.data.creator_platform_user_id
      }
    };
    const generated: StructureBuiltEvent = {
      ...built,
      id: randomUUID(),
      seq: top + 2,
      data: { ...built.data, creator_character_id: 0, creator_platform_user_id: null }
    };
    await db.transaction((tx) =>
      applyBatchInTransaction(tx, { ...batch, events: [removed, generated] }, new Date())
    );
    const row = await db
      .select({ playerId: structureEvents.playerId })
      .from(structureEvents)
      .where(eq(structureEvents.eventId, removed.id));
    expect(row[0]?.playerId).not.toBeNull();
    const summary = await structureSummary(db, 'all');
    const world = summary.by_builder.filter((entry) => entry.world);
    expect(world).toEqual([{ player: null, built: 1, world: true }]);
    expect(summary.by_builder.reduce((sum, entry) => sum + entry.built, 0)).toBe(
      summary.built_total
    );
  });

  it('skips a tick instead of waiting while ingest holds the structure tables', async () => {
    await ingest(seededBatches(1));
    const db = getDb();
    expect((await db.select().from(creatorAccounts)).length).toBeGreaterThan(0);
    await getSql().begin(async (held) => {
      await held`lock table structures_daily in row exclusive mode`;
      expect(await creditStructures(db)).toBeNull();
    });
    expect(await creditStructures(db)).not.toBeNull();
  });

  it('keeps placed counts when an admin merges two builders', async () => {
    await ingest(seededBatches(1));
    const db = getDb();
    const builders = await db.select({ id: players.id }).from(players).orderBy(players.id).limit(2);
    const [source, target] = builders;
    await db.insert(structuresDaily).values([
      {
        date: '2026-09-01',
        prefab: 'piece_bench01',
        builderPlayerId: source!.id,
        built: 2,
        placed: 2
      },
      {
        date: '2026-09-01',
        prefab: 'piece_bench01',
        builderPlayerId: target!.id,
        built: 3,
        placed: 3
      }
    ]);
    await mergePlayers(db, source!.id, target!.id);
    const merged = await db
      .select({ built: structuresDaily.built, placed: structuresDaily.placed })
      .from(structuresDaily)
      .where(
        sql`${structuresDaily.prefab} = 'piece_bench01' and ${structuresDaily.date} = '2026-09-01'`
      );
    expect(merged).toEqual([{ built: 5, placed: 5 }]);
  });
});
