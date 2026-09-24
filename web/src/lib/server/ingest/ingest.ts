import { sql } from 'drizzle-orm';
import type { IngestBatch } from '$lib/api/types';
import { getDb } from '../db/client';
import { events, heartbeats, ingestBatches, meta } from '../db/schema';
import { createContext, type ProjectionEffects, type StoredEnvelope, type Tx } from './context';
import { applyEvent } from './projections';

export const maxBatchBytes = 1024 * 1024;
export const maxBatchEvents = 200;

export interface IngestOutcome {
  accepted: number;
  duplicates: number;
  lastSeq: number | null;
  acceptedEvents: StoredEnvelope[];
  effects: ProjectionEffects;
}

export const batchMetaKeys = {
  serverName: 'batch.server_name',
  worldName: 'batch.world_name',
  worldUid: 'batch.world_uid',
  pluginName: 'batch.plugin_name',
  pluginVersion: 'batch.plugin_version',
  gameVersion: 'batch.game_version',
  networkVersion: 'batch.network_version',
  lastBatchAt: 'batch.last_at'
} as const;

async function rememberBatch(tx: Tx, batch: IngestBatch, receivedAt: Date) {
  const rows: { key: string; value: string }[] = [
    { key: batchMetaKeys.serverName, value: batch.server.name },
    { key: batchMetaKeys.worldName, value: batch.server.world },
    { key: batchMetaKeys.worldUid, value: String(batch.server.world_uid) },
    { key: batchMetaKeys.pluginName, value: batch.plugin.name },
    { key: batchMetaKeys.pluginVersion, value: batch.plugin.version },
    { key: batchMetaKeys.gameVersion, value: batch.game.version },
    { key: batchMetaKeys.networkVersion, value: String(batch.game.network_version) },
    { key: batchMetaKeys.lastBatchAt, value: receivedAt.toISOString() }
  ];
  for (const row of rows) {
    await tx
      .insert(meta)
      .values({ key: row.key, value: row.value, updatedAt: receivedAt })
      .onConflictDoUpdate({ target: meta.key, set: { value: row.value, updatedAt: receivedAt } });
  }
}

export async function applyBatchInTransaction(
  tx: Tx,
  batch: IngestBatch,
  receivedAt: Date
): Promise<IngestOutcome> {
  const ctx = createContext(tx, receivedAt);
  const runOrder = new Map<string, number>();
  for (const event of batch.events) {
    if (!runOrder.has(event.run_id)) runOrder.set(event.run_id, runOrder.size);
  }
  const sorted = [...batch.events].sort(
    (a, b) => (runOrder.get(a.run_id) ?? 0) - (runOrder.get(b.run_id) ?? 0) || a.seq - b.seq
  );
  const acceptedEvents: StoredEnvelope[] = [];
  let duplicates = 0;
  for (const event of sorted) {
    const ts = new Date(event.ts);
    const row = {
      id: event.id,
      runId: event.run_id,
      seq: event.seq,
      type: event.type,
      ts,
      receivedAt,
      worldDay: event.world_day,
      data: event.data
    };
    const target = event.type === 'server.heartbeat' ? heartbeats : events;
    const inserted = await tx
      .insert(target)
      .values(row)
      .onConflictDoNothing()
      .returning({ id: target.id });
    if (inserted.length === 0) {
      duplicates += 1;
      continue;
    }
    await applyEvent(ctx, event);
    acceptedEvents.push(event);
  }
  await rememberBatch(tx, batch, receivedAt);
  const lastSeq = sorted.length > 0 ? sorted[sorted.length - 1]!.seq : null;
  return {
    accepted: acceptedEvents.length,
    duplicates,
    lastSeq,
    acceptedEvents,
    effects: ctx.effects
  };
}

export async function ingestBatch(
  batch: IngestBatch,
  receivedAt = new Date()
): Promise<IngestOutcome> {
  const db = getDb();
  const outcome = await db.transaction(async (tx) =>
    applyBatchInTransaction(tx, batch, receivedAt)
  );
  await db.insert(ingestBatches).values({
    receivedAt,
    status: 200,
    accepted: outcome.accepted,
    duplicates: outcome.duplicates,
    events: batch.events.length
  });
  return outcome;
}

export async function recordRejectedBatch(status: number, receivedAt = new Date()): Promise<void> {
  try {
    await getDb()
      .insert(ingestBatches)
      .values({ receivedAt, status, accepted: 0, duplicates: 0, events: 0 });
  } catch (error) {
    console.error('ingest: could not record the rejected batch', error);
  }
}

export async function ingestStats(since: Date) {
  const rows = await getDb()
    .select({
      batches: sql<number>`count(*) filter (where ${ingestBatches.status} = 200)::int`,
      events: sql<number>`coalesce(sum(${ingestBatches.accepted}), 0)::int`,
      duplicates: sql<number>`coalesce(sum(${ingestBatches.duplicates}), 0)::int`,
      rejected: sql<number>`count(*) filter (where ${ingestBatches.status} <> 200)::int`,
      lastBatchAt: sql<Date | null>`max(${ingestBatches.receivedAt}) filter (where ${ingestBatches.status} = 200)`
    })
    .from(ingestBatches)
    .where(sql`${ingestBatches.receivedAt} >= ${since.toISOString()}::timestamptz`);
  const row = rows[0];
  return {
    batches: row?.batches ?? 0,
    events: row?.events ?? 0,
    duplicates: row?.duplicates ?? 0,
    rejected: row?.rejected ?? 0,
    lastBatchAt: row?.lastBatchAt ? new Date(row.lastBatchAt) : null
  };
}
