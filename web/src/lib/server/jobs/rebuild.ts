import { and, asc, eq, getTableName, gt, or, sql } from 'drizzle-orm';
import { getDb, type Database } from '../db/client';
import { events, heartbeats, players, projectionTables } from '../db/schema';
import { createContext, type StoredEnvelope, type Tx } from '../ingest/context';
import { applyEvent } from '../ingest/projections';
import { toEnvelope } from '../read/events';

export const rebuildLockKey = 424242;

interface Cursor {
  ts: Date;
  seq: number;
  id: string;
}

async function nextChunk(tx: Tx, cursor: Cursor | null, size: number) {
  const after = cursor
    ? or(
        gt(events.ts, cursor.ts),
        and(eq(events.ts, cursor.ts), gt(events.seq, cursor.seq)),
        and(eq(events.ts, cursor.ts), eq(events.seq, cursor.seq), gt(events.id, cursor.id))
      )
    : undefined;
  const afterHeartbeat = cursor
    ? or(
        gt(heartbeats.ts, cursor.ts),
        and(eq(heartbeats.ts, cursor.ts), gt(heartbeats.seq, cursor.seq)),
        and(
          eq(heartbeats.ts, cursor.ts),
          eq(heartbeats.seq, cursor.seq),
          gt(heartbeats.id, cursor.id)
        )
      )
    : undefined;
  const eventRows = await tx
    .select()
    .from(events)
    .where(after)
    .orderBy(asc(events.ts), asc(events.seq), asc(events.id))
    .limit(size);
  const heartbeatRows = await tx
    .select()
    .from(heartbeats)
    .where(afterHeartbeat)
    .orderBy(asc(heartbeats.ts), asc(heartbeats.seq), asc(heartbeats.id))
    .limit(size);
  return [...eventRows, ...heartbeatRows.map((row) => ({ ...row, type: 'server.heartbeat' }))]
    .sort((a, b) => a.ts.getTime() - b.ts.getTime() || a.seq - b.seq || a.id.localeCompare(b.id))
    .slice(0, size);
}

export async function rebuildProjections(
  db: Database = getDb(),
  onProgress?: (done: number, total: number) => Promise<void> | void
): Promise<{ replayed: number }> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${rebuildLockKey})`);
    const totals = await tx
      .select({
        count: sql<number>`(select count(*) from ${events}) + (select count(*) from ${heartbeats})`
      })
      .from(sql`(select 1) as one`);
    const total = Number(totals[0]?.count ?? 0);
    for (const table of projectionTables) {
      await tx.execute(sql`delete from ${table}`);
      await tx.execute(
        sql.raw(
          `do $$ declare seq text; begin begin seq := pg_get_serial_sequence('${getTableName(table)}', 'id'); exception when undefined_column then seq := null; end; if seq is not null then execute format('alter sequence %s restart with 1', seq); end if; end $$`
        )
      );
    }
    await tx.update(players).set({
      firstSeen: sql`now()`,
      lastSeen: sql`'epoch'::timestamptz`,
      playtimeS: 0,
      sessions: 0,
      deaths: 0,
      killsCredited: 0,
      killsNearby: 0,
      bossKills: 0,
      raids: 0,
      structuresBuilt: 0,
      structuresDestroyed: 0,
      shouts: 0,
      distanceM: 0,
      online: false,
      currentSessionId: null,
      lastBiome: null,
      lastX: null,
      lastZ: null,
      lastPositionAt: null
    });
    await tx.update(events).set({ playerId: null });
    const ctx = createContext(tx, new Date(), true);
    let cursor: Cursor | null = null;
    let replayed = 0;
    for (;;) {
      const chunk = await nextChunk(tx, cursor, 500);
      if (chunk.length === 0) break;
      for (const row of chunk) {
        const envelope = toEnvelope(row, false) as StoredEnvelope;
        ctx.receivedAt = row.receivedAt;
        await applyEvent(ctx, envelope);
        replayed += 1;
      }
      const last = chunk[chunk.length - 1]!;
      cursor = { ts: last.ts, seq: last.seq, id: last.id };
      if (onProgress) await onProgress(replayed, total);
    }
    await tx.execute(
      sql`delete from ${players} where sessions = 0 and hidden = false and display_name_override is null and last_seen = 'epoch'::timestamptz and not exists (select 1 from event_players where event_players.player_id = players.id)`
    );
    return { replayed };
  });
}
