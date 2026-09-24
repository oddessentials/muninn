import { and, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm';
import type { OnlineList, Run, Status, StatusHistory } from '$lib/api/types';
import type { Database } from '../db/client';
import { meta, players, serverRuns, serverStatus, sessions, statusSamples } from '../db/schema';
import { batchMetaKeys } from '../ingest/ingest';
import { biomeName, worldDayLengthSeconds } from '../names';
import { iso, round } from '../http/respond';
import { siteFeatures, siteSettings } from '../settings';

export const watchdogWindowSeconds = 180;
export const a2sFreshnessSeconds = 300;

export async function readMeta(db: Database, keys: string[]): Promise<Map<string, string>> {
  if (keys.length === 0) return new Map();
  const rows = await db.select().from(meta).where(inArray(meta.key, keys));
  return new Map(rows.map((row) => [row.key, row.value]));
}

export async function latestRun(db: Database) {
  const rows = await db.select().from(serverRuns).orderBy(desc(serverRuns.startedAt)).limit(1);
  return rows[0] ?? null;
}

export async function statusRecord(db: Database) {
  const rows = await db.select().from(serverStatus).where(eq(serverStatus.id, 1)).limit(1);
  return rows[0] ?? null;
}

export function extrapolateNetTime(
  netTime: number | null,
  netTimeAt: Date | null,
  advancing: boolean,
  now: Date
): number | null {
  if (netTime === null) return null;
  if (!advancing || !netTimeAt) return netTime;
  return netTime + Math.max(0, (now.getTime() - netTimeAt.getTime()) / 1000);
}

export function runToContract(run: typeof serverRuns.$inferSelect): Run {
  return {
    run_id: run.runId,
    started_at: run.startedAt.toISOString(),
    stopped_at: iso(run.stoppedAt),
    stop_reason: (run.stopReason as Run['stop_reason']) ?? null,
    game_version: run.gameVersion,
    plugin_version: run.pluginVersion,
    peak_players: run.peakPlayers,
    saves: run.saves
  };
}

export async function computeStatus(db: Database, now = new Date()): Promise<Status> {
  const [status, run, metaValues] = await Promise.all([
    statusRecord(db),
    latestRun(db),
    readMeta(db, [
      batchMetaKeys.serverName,
      batchMetaKeys.gameVersion,
      batchMetaKeys.networkVersion,
      batchMetaKeys.worldName,
      batchMetaKeys.worldUid
    ])
  ]);
  const runOpen = run !== null && run.stoppedAt === null;
  const heartbeatAgeS = run?.lastHeartbeatAt
    ? (now.getTime() - run.lastHeartbeatAt.getTime()) / 1000
    : null;
  const pluginLive = runOpen && heartbeatAgeS !== null && heartbeatAgeS <= watchdogWindowSeconds;
  const pluginFresh =
    status?.lastPluginAt !== null &&
    status?.lastPluginAt !== undefined &&
    (now.getTime() - status.lastPluginAt.getTime()) / 1000 <= watchdogWindowSeconds;
  const a2sFresh =
    status?.a2sCheckedAt !== null &&
    status?.a2sCheckedAt !== undefined &&
    (now.getTime() - status.a2sCheckedAt.getTime()) / 1000 <= a2sFreshnessSeconds &&
    status.a2sOnline !== null;
  let source: Status['source'] = 'none';
  let online = false;
  let playerCount = 0;
  if (status && (pluginFresh || (runOpen && pluginLive))) {
    source = 'plugin';
    online = status.online;
    playerCount = status.playerCount;
  } else if (status && a2sFresh) {
    source = 'a2s';
    online = status.a2sOnline ?? false;
    playerCount = status.a2sPlayerCount ?? 0;
  } else if (status && status.lastPluginAt && status.online && runOpen) {
    source = 'plugin';
    online = false;
    playerCount = 0;
  }
  const advancing = source === 'plugin' && online && playerCount > 0;
  const netTime = status
    ? extrapolateNetTime(status.netTime, status.netTimeAt, advancing, now)
    : null;
  const worldName = status?.worldName ?? metaValues.get(batchMetaKeys.worldName) ?? null;
  const worldUid = status?.worldUid ?? Number(metaValues.get(batchMetaKeys.worldUid) ?? NaN);
  const world: Status['world'] =
    worldName !== null && netTime !== null && Number.isFinite(worldUid)
      ? {
          name: worldName,
          uid: worldUid,
          day: Math.floor(netTime / worldDayLengthSeconds),
          time_of_day: round((netTime % worldDayLengthSeconds) / worldDayLengthSeconds, 3),
          net_time: round(netTime, 1)
        }
      : null;
  const runInfo: Status['run'] =
    run && runOpen
      ? {
          run_id: run.runId,
          started_at: run.startedAt.toISOString(),
          uptime_s: Math.max(0, Math.round((now.getTime() - run.startedAt.getTime()) / 1000)),
          plugin_version: run.pluginVersion ?? ''
        }
      : null;
  return {
    online,
    source,
    player_count: playerCount,
    max_players: status?.a2sMaxPlayers ?? status?.maxPlayers ?? 10,
    game_version:
      run?.gameVersion ??
      status?.gameVersion ??
      status?.a2sGameVersion ??
      metaValues.get(batchMetaKeys.gameVersion) ??
      null,
    network_version:
      run?.networkVersion ??
      status?.networkVersion ??
      status?.a2sNetworkVersion ??
      (metaValues.has(batchMetaKeys.networkVersion)
        ? Number(metaValues.get(batchMetaKeys.networkVersion))
        : null),
    server_name:
      metaValues.get(batchMetaKeys.serverName) ??
      status?.a2sServerName ??
      status?.serverName ??
      (await siteSettings.read(db)).site_name,
    world,
    run: runInfo,
    last_save_at: iso(status?.lastSaveAt),
    telemetry: {
      live: pluginLive,
      last_heartbeat_at: iso(run?.lastHeartbeatAt),
      delayed_since: iso(status?.telemetryDelayedSince)
    },
    updated_at: (status?.updatedAt ?? now).toISOString()
  };
}

export async function computeOnline(db: Database): Promise<OnlineList> {
  const run = await latestRun(db);
  if (!run || run.stoppedAt !== null) return { items: [] };
  const rows = await db
    .select({
      playerId: players.id,
      displayName: players.displayName,
      displayNameOverride: players.displayNameOverride,
      platform: players.platform,
      hidden: players.hidden,
      characterName: sessions.characterName,
      biome: players.lastBiome,
      x: players.lastX,
      z: players.lastZ,
      since: sessions.joinedAt
    })
    .from(sessions)
    .innerJoin(players, eq(players.id, sessions.playerId))
    .where(and(eq(sessions.runId, run.runId), isNull(sessions.leftAt)))
    .orderBy(sessions.joinedAt);
  const { positions } = await siteFeatures(db);
  return {
    items: rows
      .filter((row) => !row.hidden)
      .map((row) => ({
        player_id: row.playerId,
        display_name: row.displayNameOverride ?? row.displayName,
        platform: row.platform as OnlineList['items'][number]['platform'],
        character_name: row.characterName,
        biome: biomeName(row.biome),
        x: positions ? round(row.x ?? 0) : null,
        z: positions ? round(row.z ?? 0) : null,
        since: row.since.toISOString()
      }))
  };
}

const historyRanges = { '24h': 24 * 3600, '7d': 7 * 24 * 3600, '30d': 30 * 24 * 3600 } as const;

export async function statusHistory(
  db: Database,
  range: keyof typeof historyRanges,
  now = new Date()
): Promise<StatusHistory> {
  const seconds = historyRanges[range];
  const stepS = Math.max(60, Math.ceil(seconds / 600 / 60) * 60);
  const since = new Date(now.getTime() - seconds * 1000);
  const rows = await db
    .select()
    .from(statusSamples)
    .where(gte(statusSamples.ts, since))
    .orderBy(statusSamples.ts);
  const buckets = new Map<number, { online: boolean; playerCount: number }>();
  for (const row of rows) {
    const bucket = Math.floor(row.ts.getTime() / 1000 / stepS) * stepS;
    const current = buckets.get(bucket);
    if (!current) buckets.set(bucket, { online: row.online, playerCount: row.playerCount });
    else {
      current.online = current.online || row.online;
      current.playerCount = Math.max(current.playerCount, row.playerCount);
    }
  }
  const items = [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .slice(-600)
    .map(([bucket, value]) => ({
      ts: new Date(bucket * 1000).toISOString(),
      online: value.online,
      player_count: value.playerCount
    }));
  return { range, step_s: stepS, items };
}

export async function listRuns(db: Database, limit: number, offset: number) {
  const rows = await db
    .select()
    .from(serverRuns)
    .orderBy(desc(serverRuns.startedAt))
    .limit(limit + 1)
    .offset(offset);
  return { rows: rows.slice(0, limit).map(runToContract), hasMore: rows.length > limit };
}

export async function recordStatusSample(
  db: Database,
  online: boolean,
  playerCount: number,
  source: string,
  at = new Date()
) {
  const minute = new Date(Math.floor(at.getTime() / 60_000) * 60_000);
  await db
    .insert(statusSamples)
    .values({ ts: minute, online, playerCount, source })
    .onConflictDoUpdate({
      target: statusSamples.ts,
      set: {
        online: sql`${statusSamples.online} or ${online}`,
        playerCount: sql`greatest(${statusSamples.playerCount}, ${playerCount})`,
        source
      }
    });
}
