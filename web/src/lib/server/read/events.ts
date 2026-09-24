import { and, desc, eq, exists, gte, lt, sql, type SQL } from 'drizzle-orm';
import type { EventEnvelope, EventType, StoredEvent } from '$lib/api/types';
import type { Database } from '../db/client';
import { eventPlayers, events, heartbeats } from '../db/schema';
import { notFound } from '../http/respond';

export interface AdminEventOptions {
  type: EventType | null;
  runId: string | null;
  playerId: number | null;
  since: Date | null;
  until: Date | null;
  limit: number;
  offset: number;
}

interface RawRow {
  id: string;
  runId: string;
  seq: number;
  type: string;
  ts: Date;
  receivedAt: Date;
  worldDay: number;
  data: unknown;
}

export function toEnvelope(row: RawRow, withReceivedAt: boolean): EventEnvelope {
  const envelope = {
    id: row.id,
    seq: row.seq,
    run_id: row.runId,
    ts: row.ts.toISOString(),
    type: row.type,
    world_day: row.worldDay,
    data: row.data,
    ...(withReceivedAt ? { received_at: row.receivedAt.toISOString() } : {})
  };
  return envelope as unknown as EventEnvelope;
}

export async function listAdminEvents(
  db: Database,
  options: AdminEventOptions
): Promise<{ items: EventEnvelope[]; hasMore: boolean }> {
  const eventConditions: SQL[] = [];
  const heartbeatConditions: SQL[] = [];
  if (options.type) {
    eventConditions.push(eq(events.type, options.type));
  }
  if (options.runId) {
    eventConditions.push(eq(events.runId, options.runId));
    heartbeatConditions.push(eq(heartbeats.runId, options.runId));
  }
  if (options.since) {
    eventConditions.push(gte(events.ts, options.since));
    heartbeatConditions.push(gte(heartbeats.ts, options.since));
  }
  if (options.until) {
    eventConditions.push(lt(events.ts, options.until));
    heartbeatConditions.push(lt(heartbeats.ts, options.until));
  }
  if (options.playerId !== null) {
    eventConditions.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(eventPlayers)
          .where(
            and(eq(eventPlayers.eventId, events.id), eq(eventPlayers.playerId, options.playerId))
          )
      )
    );
  }
  const wantHeartbeats =
    options.playerId === null && (options.type === null || options.type === 'server.heartbeat');
  const wantEvents = options.type !== 'server.heartbeat';
  const take = options.limit + 1 + options.offset;
  const eventRows = wantEvents
    ? await db
        .select()
        .from(events)
        .where(eventConditions.length > 0 ? and(...eventConditions) : undefined)
        .orderBy(desc(events.ts), desc(events.seq))
        .limit(take)
    : [];
  const heartbeatRows = wantHeartbeats
    ? await db
        .select()
        .from(heartbeats)
        .where(heartbeatConditions.length > 0 ? and(...heartbeatConditions) : undefined)
        .orderBy(desc(heartbeats.ts), desc(heartbeats.seq))
        .limit(take)
    : [];
  const merged: RawRow[] = [
    ...eventRows,
    ...heartbeatRows.map((row) => ({ ...row, type: 'server.heartbeat' }))
  ].sort((a, b) => b.ts.getTime() - a.ts.getTime() || b.seq - a.seq);
  const page = merged.slice(options.offset, options.offset + options.limit);
  return {
    items: page.map((row) => toEnvelope(row, true)),
    hasMore: merged.length > options.offset + options.limit
  };
}

export async function adminEvent(db: Database, id: string): Promise<StoredEvent> {
  const rows = await db.select().from(events).where(eq(events.id, id)).limit(1);
  const row: RawRow | undefined =
    rows[0] ??
    (await db.select().from(heartbeats).where(eq(heartbeats.id, id)).limit(1)).map((entry) => ({
      ...entry,
      type: 'server.heartbeat'
    }))[0];
  if (!row) throw notFound(`event ${id} does not exist`);
  return toEnvelope(row, true) as unknown as StoredEvent;
}

export async function eventCount(db: Database): Promise<number> {
  const rows = await db.select({ count: sql<number>`count(*)::int` }).from(events);
  return rows[0]?.count ?? 0;
}
