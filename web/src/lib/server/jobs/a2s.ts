import { eq } from 'drizzle-orm';
import { queryInfo } from '../a2s';
import { getDb, type Database } from '../db/client';
import { serverStatus } from '../db/schema';
import { env } from '../env';
import { computeStatus, recordStatusSample } from '../read/status';

export interface A2sPollResult {
  ok: boolean;
  error: string | null;
  online: boolean | null;
  playerCount: number | null;
}

export async function pollA2s(
  db: Database = getDb(),
  host = env.steamQueryHost,
  port = env.steamQueryPort,
  now = new Date()
): Promise<A2sPollResult> {
  await db.insert(serverStatus).values({ id: 1 }).onConflictDoNothing();
  try {
    const info = await queryInfo(host, port);
    await db
      .update(serverStatus)
      .set({
        a2sOnline: true,
        a2sPlayerCount: info.players,
        a2sMaxPlayers: info.maxPlayers,
        a2sGameVersion: info.gameVersion,
        a2sNetworkVersion: info.networkVersion,
        a2sServerName: info.name,
        a2sLastOkAt: now,
        a2sLastError: null,
        a2sCheckedAt: now,
        updatedAt: now
      })
      .where(eq(serverStatus.id, 1));
    const status = await computeStatus(db, now);
    await recordStatusSample(db, status.online, status.player_count, status.source, now);
    return { ok: true, error: null, online: true, playerCount: info.players };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db
      .update(serverStatus)
      .set({
        a2sOnline: false,
        a2sPlayerCount: 0,
        a2sLastError: message,
        a2sCheckedAt: now,
        updatedAt: now
      })
      .where(eq(serverStatus.id, 1));
    const status = await computeStatus(db, now);
    await recordStatusSample(db, status.online, status.player_count, status.source, now);
    return { ok: false, error: message, online: false, playerCount: null };
  }
}
