import { getTableName, sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { EventType } from '../../src/lib/api/types';
import { getDb } from '../../src/lib/server/db/client';
import * as schema from '../../src/lib/server/db/schema';
import { applyBatchInTransaction } from '../../src/lib/server/ingest/ingest';
import { rebuildProjections } from '../../src/lib/server/jobs/rebuild';
import { seededBatches, seededHistory, resetDatabase, useTestDatabase } from './setup';

vi.setConfig({ testTimeout: 240_000, hookTimeout: 240_000 });

beforeAll(async () => {
  useTestDatabase();
  await resetDatabase();
});

const expectedByType: Record<EventType, { table: string; where?: string } | null> = {
  'server.started': { table: 'server_runs' },
  'server.stopping': { table: 'server_runs', where: "stop_reason = 'graceful'" },
  'server.heartbeat': { table: 'heartbeats' },
  'server.lost': null,
  'world.save_started': null,
  'world.saved': { table: 'saves' },
  'world.rollback_detected': { table: 'events', where: "type = 'world.rollback_detected'" },
  'world.dusk_approaching': null,
  'world.dawn_approaching': null,
  'player.joined': { table: 'sessions' },
  'player.spawned': { table: 'characters' },
  'player.died': { table: 'deaths' },
  'player.left': { table: 'sessions', where: 'left_at is not null' },
  'player.biome_changed': { table: 'biome_visits' },
  'player.position': { table: 'positions' },
  'boss.summoned': { table: 'boss_events', where: "kind = 'summoned'" },
  'boss.engaged': { table: 'boss_events', where: "kind = 'engaged'" },
  'boss.defeated': { table: 'boss_kills' },
  'global_key.set': { table: 'global_keys' },
  'raid.started': { table: 'raids' },
  'raid.ended': { table: 'raids', where: 'ended_at is not null' },
  'structure.built': { table: 'structure_events', where: "kind = 'built'" },
  'structure.destroyed': { table: 'structure_events', where: "kind = 'destroyed'" },
  'creature.died': { table: 'kills' },
  'chat.message': { table: 'chat_messages' },
  'announcement.shown': { table: 'announcements', where: 'shown_at is not null' }
};

async function countRows(table: string, where?: string): Promise<number> {
  const rows = await getDb().execute(
    sql.raw(`select count(*)::int as count from ${table}${where ? ` where ${where}` : ''}`)
  );
  return Number((rows[0] as { count: number }).count);
}

async function dumpProjections(): Promise<string> {
  const chunks: string[] = [];
  for (const table of [...schema.projectionTables, schema.players]) {
    const name = getTableName(table);
    const rows = await getDb().execute(sql.raw(`select * from ${name}`));
    const normalized = [...(rows as unknown as Record<string, unknown>[])]
      .map((row) => {
        const copy: Record<string, unknown> = { ...row };
        delete copy.id;
        delete copy.current_session_id;
        delete copy.join_event_id;
        delete copy.left_event_id;
        return JSON.stringify(copy, Object.keys(copy).sort());
      })
      .sort();
    chunks.push(`${name}:${normalized.join('\n')}`);
  }
  return chunks.join('\n\n');
}

describe('projections', () => {
  const history = seededHistory(6);
  const batches = seededBatches(6);

  it('produces rows for every event type the simulator emits', async () => {
    const db = getDb();
    for (const batch of batches) {
      await db.transaction((tx) => applyBatchInTransaction(tx, batch, new Date()));
    }
    const emitted = new Set<string>(history.events.map((event) => event.type));
    for (const [type, expectation] of Object.entries(expectedByType)) {
      if (!expectation) continue;
      if (!emitted.has(type) && type !== 'world.rollback_detected') continue;
      expect(await countRows(expectation.table, expectation.where), type).toBeGreaterThan(0);
    }
    const restarts = await countRows('server_runs', "stop_reason = 'graceful'");
    expect(restarts).toBe(1);
    const rollbacks = await countRows('events', "type = 'world.rollback_detected'");
    expect(rollbacks).toBe(1);
  });

  it('changes nothing when the same batches are applied again', async () => {
    const before = await dumpProjections();
    const db = getDb();
    let duplicates = 0;
    for (const batch of batches) {
      const outcome = await db.transaction((tx) => applyBatchInTransaction(tx, batch, new Date()));
      duplicates += outcome.duplicates;
      expect(outcome.accepted).toBe(0);
    }
    expect(duplicates).toBe(history.events.length);
    expect(await dumpProjections()).toBe(before);
  });

  it('reproduces identical projection tables on rebuild', async () => {
    const before = await dumpProjections();
    const result = await rebuildProjections(getDb());
    expect(result.replayed).toBe(history.events.length + 1);
    expect(await dumpProjections()).toBe(before);
  });
});
