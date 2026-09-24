import { eq } from 'drizzle-orm';
import { queryInfo } from '../a2s';
import { getDb, type Database } from '../db/client';
import { serverStatus } from '../db/schema';
import { computeStatus, recordStatusSample } from '../read/status';
import { siteSettings } from '../settings';

export interface A2sPollResult {
  ok: boolean;
  error: string | null;
  online: boolean | null;
  playerCount: number | null;
}

export const queryDisabled = 'no Steam query address is set';

export async function pollA2s(
  db: Database = getDb(),
  host?: string,
  port?: number,
  now = new Date()
): Promise<A2sPollResult> {
  if (host === undefined || port === undefined) {
    const settings = await siteSettings.read(db);
    host ??= settings.steam_query_host;
    port ??= settings.steam_query_port;
  }
  if (host === '') return { ok: false, error: queryDisabled, online: null, playerCount: null };
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
