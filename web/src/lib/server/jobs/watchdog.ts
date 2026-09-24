import { randomUUID } from 'node:crypto';
import { and, isNull, sql } from 'drizzle-orm';
import { getDb, type Database } from '../db/client';
import { events, serverRuns } from '../db/schema';
import { createContext, type StoredEnvelope } from '../ingest/context';
import { applyEvent, markTelemetryDelayed } from '../ingest/projections';
import { watchdogWindowSeconds } from '../read/status';

export interface WatchdogResult {
  lostRuns: string[];
  syntheticEvents: StoredEnvelope[];
  statusChanged: boolean;
}

export const processObservedSince = new Date();

export async function runWatchdog(
  db: Database = getDb(),
  now = new Date(),
  observedSince: Date = processObservedSince
): Promise<WatchdogResult> {
  const cutoff = new Date(now.getTime() - watchdogWindowSeconds * 1000);
  const result: WatchdogResult = { lostRuns: [], syntheticEvents: [], statusChanged: false };
  if (observedSince > cutoff) return result;
  const lastSeen = sql`coalesce(${serverRuns.lastHeartbeatReceivedAt}, ${serverRuns.lastHeartbeatAt}, ${serverRuns.startedAt})`;
  const stale = await db
    .select()
    .from(serverRuns)
    .where(
      and(isNull(serverRuns.stoppedAt), sql`${lastSeen} < ${cutoff.toISOString()}::timestamptz`)
    );
  for (const run of stale) {
    const lastHeartbeat = run.lastHeartbeatAt ?? run.startedAt;
    const synthetic: StoredEnvelope = {
      id: randomUUID(),
      seq: run.lastSeq + 1,
      run_id: run.runId,
      ts: now.toISOString(),
      type: 'server.lost',
      world_day: run.lastWorldDay ?? 0,
      data: { last_heartbeat_at: lastHeartbeat.toISOString() }
    };
    await db.transaction(async (tx) => {
      await tx.insert(events).values({
        id: synthetic.id,
        runId: synthetic.run_id,
        seq: synthetic.seq,
        type: synthetic.type,
        ts: now,
        receivedAt: now,
        worldDay: synthetic.world_day,
        data: synthetic.data
      });
      const ctx = createContext(tx, now);
      await applyEvent(ctx, synthetic);
      await markTelemetryDelayed(ctx, lastHeartbeat);
    });
    result.lostRuns.push(run.runId);
    result.syntheticEvents.push(synthetic);
    result.statusChanged = true;
  }
  return result;
}
