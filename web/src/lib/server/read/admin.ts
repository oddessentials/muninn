import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { AdminHealth, AdminPlayer } from '$lib/api/types';
import { getDb, type Database } from '../db/client';
import {
  biomeVisits,
  bossEvents,
  bossKills,
  characters,
  chatMessages,
  deaths,
  eventPlayers,
  events,
  kills,
  playerAliases,
  players,
  positions,
  raids,
  sessions,
  structureEvents,
  structuresDaily
} from '../db/schema';
import { badRequest, conflict, notFound } from '../http/respond';
import { ingestStats } from '../ingest/ingest';
import { backupSummary } from '../jobs/backup';
import { eventCount } from './events';
import { adminItem, playerRow } from './players';
import { latestRun, runToContract, statusRecord } from './status';
import { latestMapGeneratedAt } from './world';

export interface PlayerPatchInput {
  display_name_override?: string | null;
  hidden?: boolean;
}

export function parsePatch(body: unknown): PlayerPatchInput {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw badRequest('body must be a JSON object');
  }
  const record = body as Record<string, unknown>;
  const patch: PlayerPatchInput = {};
  for (const key of Object.keys(record)) {
    if (key !== 'display_name_override' && key !== 'hidden')
      throw badRequest(`unknown field ${key}`);
  }
  if ('display_name_override' in record) {
    const value = record.display_name_override;
    if (value !== null && typeof value !== 'string') {
      throw badRequest('display_name_override must be a string or null');
    }
    if (typeof value === 'string' && (value.trim().length < 1 || value.length > 64)) {
      throw badRequest('display_name_override must be between 1 and 64 characters');
    }
    patch.display_name_override = value === null ? null : value.trim();
  }
  if ('hidden' in record) {
    if (typeof record.hidden !== 'boolean') throw badRequest('hidden must be a boolean');
    patch.hidden = record.hidden;
  }
  return patch;
}

export async function patchPlayer(
  db: Database,
  id: number,
  patch: PlayerPatchInput
): Promise<AdminPlayer> {
  await playerRow(db, id, true);
  const values: Partial<typeof players.$inferInsert> = {};
  if ('display_name_override' in patch)
    values.displayNameOverride = patch.display_name_override ?? null;
  if ('hidden' in patch) values.hidden = patch.hidden;
  if (Object.keys(values).length > 0)
    await db.update(players).set(values).where(eq(players.id, id));
  return adminItem(db, await playerRow(db, id, true));
}

function replaceIds(list: number[], from: number, to: number): number[] {
  const out: number[] = [];
  for (const id of list) {
    const mapped = id === from ? to : id;
    if (!out.includes(mapped)) out.push(mapped);
  }
  return out;
}

export async function mergePlayers(
  db: Database,
  sourceId: number,
  targetId: number
): Promise<AdminPlayer> {
  if (sourceId === targetId) throw conflict('a player cannot be merged into itself');
  const source = await playerRow(db, sourceId, true);
  const target = await playerRow(db, targetId, true);
  await db.transaction(async (tx) => {
    await tx.update(sessions).set({ playerId: targetId }).where(eq(sessions.playerId, sourceId));
    await tx.update(deaths).set({ playerId: targetId }).where(eq(deaths.playerId, sourceId));
    await tx
      .update(deaths)
      .set({ attackerPlayerId: targetId })
      .where(eq(deaths.attackerPlayerId, sourceId));
    await tx
      .update(chatMessages)
      .set({ playerId: targetId })
      .where(eq(chatMessages.playerId, sourceId));
    await tx
      .update(structureEvents)
      .set({ playerId: targetId })
      .where(eq(structureEvents.playerId, sourceId));
    await tx.update(events).set({ playerId: targetId }).where(eq(events.playerId, sourceId));
    await tx
      .update(bossKills)
      .set({ senderPlayerId: targetId })
      .where(eq(bossKills.senderPlayerId, sourceId));
    await tx
      .update(bossEvents)
      .set({ summonerPlayerId: targetId })
      .where(eq(bossEvents.summonerPlayerId, sourceId));
    const killRows = await tx.select().from(kills).where(eq(kills.playerId, sourceId));
    for (const row of killRows) {
      const clash = await tx
        .select({ id: kills.id })
        .from(kills)
        .where(and(eq(kills.eventId, row.eventId), eq(kills.playerId, targetId)))
        .limit(1);
      if (clash.length > 0) await tx.delete(kills).where(eq(kills.id, row.id));
      else await tx.update(kills).set({ playerId: targetId }).where(eq(kills.id, row.id));
    }
    const characterRows = await tx
      .select()
      .from(characters)
      .where(eq(characters.playerId, sourceId));
    for (const row of characterRows) {
      const clash = await tx
        .select({
          id: characters.id,
          firstSeen: characters.firstSeen,
          lastSeen: characters.lastSeen
        })
        .from(characters)
        .where(and(eq(characters.playerId, targetId), eq(characters.characterId, row.characterId)))
        .limit(1);
      if (clash[0]) {
        await tx
          .update(characters)
          .set({
            firstSeen: clash[0].firstSeen < row.firstSeen ? clash[0].firstSeen : row.firstSeen,
            lastSeen: clash[0].lastSeen > row.lastSeen ? clash[0].lastSeen : row.lastSeen
          })
          .where(eq(characters.id, clash[0].id));
        await tx.delete(characters).where(eq(characters.id, row.id));
      } else {
        await tx.update(characters).set({ playerId: targetId }).where(eq(characters.id, row.id));
      }
    }
    const visits = await tx.select().from(biomeVisits).where(eq(biomeVisits.playerId, sourceId));
    for (const visit of visits) {
      await tx
        .insert(biomeVisits)
        .values({ ...visit, playerId: targetId })
        .onConflictDoUpdate({
          target: [biomeVisits.playerId, biomeVisits.biome],
          set: {
            firstAt: sql`least(${biomeVisits.firstAt}, ${visit.firstAt.toISOString()}::timestamptz)`,
            firstDay: sql`least(${biomeVisits.firstDay}, ${visit.firstDay})`,
            lastAt: sql`greatest(${biomeVisits.lastAt}, ${visit.lastAt.toISOString()}::timestamptz)`,
            count: sql`${biomeVisits.count} + ${visit.count}`
          }
        });
    }
    await tx.delete(biomeVisits).where(eq(biomeVisits.playerId, sourceId));
    await tx.execute(
      sql`insert into ${positions} (player_id, ts, x, z, biome) select ${targetId}, ts, x, z, biome from ${positions} where player_id = ${sourceId} on conflict do nothing`
    );
    await tx.delete(positions).where(eq(positions.playerId, sourceId));
    await tx.execute(
      sql`insert into ${eventPlayers} (event_id, player_id, ts) select event_id, ${targetId}, ts from ${eventPlayers} where player_id = ${sourceId} on conflict do nothing`
    );
    await tx.delete(eventPlayers).where(eq(eventPlayers.playerId, sourceId));
    const daily = await tx
      .select()
      .from(structuresDaily)
      .where(eq(structuresDaily.builderPlayerId, sourceId));
    for (const row of daily) {
      await tx
        .insert(structuresDaily)
        .values({ ...row, builderPlayerId: targetId })
        .onConflictDoUpdate({
          target: [structuresDaily.date, structuresDaily.prefab, structuresDaily.builderPlayerId],
          set: {
            built: sql`${structuresDaily.built} + ${row.built}`,
            destroyed: sql`${structuresDaily.destroyed} + ${row.destroyed}`,
            placed: sql`${structuresDaily.placed} + ${row.placed}`
          }
        });
    }
    await tx.delete(structuresDaily).where(eq(structuresDaily.builderPlayerId, sourceId));
    const killsWithSource = await tx
      .select()
      .from(bossKills)
      .where(
        sql`${bossKills.participantPlayerIds} @> ${JSON.stringify([sourceId])}::jsonb or ${bossKills.nearbyPlayerIds} @> ${JSON.stringify([sourceId])}::jsonb`
      );
    for (const row of killsWithSource) {
      await tx
        .update(bossKills)
        .set({
          participantPlayerIds: replaceIds(row.participantPlayerIds, sourceId, targetId),
          nearbyPlayerIds: replaceIds(row.nearbyPlayerIds, sourceId, targetId)
        })
        .where(eq(bossKills.id, row.id));
    }
    const bossEventsWithSource = await tx
      .select()
      .from(bossEvents)
      .where(
        sql`${bossEvents.participantPlayerIds} @> ${JSON.stringify([sourceId])}::jsonb or ${bossEvents.nearbyPlayerIds} @> ${JSON.stringify([sourceId])}::jsonb`
      );
    for (const row of bossEventsWithSource) {
      await tx
        .update(bossEvents)
        .set({
          participantPlayerIds: replaceIds(row.participantPlayerIds, sourceId, targetId),
          nearbyPlayerIds: replaceIds(row.nearbyPlayerIds, sourceId, targetId)
        })
        .where(eq(bossEvents.id, row.id));
    }
    const raidsWithSource = await tx
      .select()
      .from(raids)
      .where(sql`${raids.participantIds} @> ${JSON.stringify([sourceId])}::jsonb`);
    for (const row of raidsWithSource) {
      await tx
        .update(raids)
        .set({ participantIds: replaceIds(row.participantIds, sourceId, targetId) })
        .where(eq(raids.id, row.id));
    }
    const openTarget = target.currentSessionId;
    await tx
      .update(players)
      .set({
        firstSeen: source.firstSeen < target.firstSeen ? source.firstSeen : target.firstSeen,
        lastSeen: source.lastSeen > target.lastSeen ? source.lastSeen : target.lastSeen,
        playtimeS: sql`${players.playtimeS} + ${source.playtimeS}`,
        sessions: sql`${players.sessions} + ${source.sessions}`,
        deaths: sql`${players.deaths} + ${source.deaths}`,
        killsCredited: sql`${players.killsCredited} + ${source.killsCredited}`,
        killsNearby: sql`${players.killsNearby} + ${source.killsNearby}`,
        bossKills: sql`${players.bossKills} + ${source.bossKills}`,
        raids: sql`${players.raids} + ${source.raids}`,
        structuresBuilt: sql`${players.structuresBuilt} + ${source.structuresBuilt}`,
        structuresDestroyed: sql`${players.structuresDestroyed} + ${source.structuresDestroyed}`,
        shouts: sql`${players.shouts} + ${source.shouts}`,
        distanceM: sql`${players.distanceM} + ${source.distanceM}`,
        online: target.online || source.online,
        currentSessionId: openTarget ?? source.currentSessionId,
        lastBiome: target.lastBiome ?? source.lastBiome,
        lastX: target.lastX ?? source.lastX,
        lastZ: target.lastZ ?? source.lastZ,
        lastCharacterName: target.lastCharacterName ?? source.lastCharacterName
      })
      .where(eq(players.id, targetId));
    await tx
      .update(playerAliases)
      .set({ playerId: targetId })
      .where(eq(playerAliases.playerId, sourceId));
    await tx
      .insert(playerAliases)
      .values({
        platformUserId: source.platformUserId,
        playerId: targetId,
        displayId: source.displayId,
        platform: source.platform
      })
      .onConflictDoUpdate({ target: playerAliases.platformUserId, set: { playerId: targetId } });
    await tx.delete(players).where(eq(players.id, sourceId));
  });
  return adminItem(db, await playerRow(db, targetId, true));
}

export async function deleteAlias(db: Database, id: number, alias: string): Promise<void> {
  await playerRow(db, id, true);
  const deleted = await db
    .delete(playerAliases)
    .where(and(eq(playerAliases.playerId, id), eq(playerAliases.platformUserId, alias)))
    .returning({ platformUserId: playerAliases.platformUserId });
  if (deleted.length === 0) throw notFound(`alias ${alias} does not belong to player ${id}`);
}

export interface SchedulerJobStatus {
  name: string;
  lastRunAt: string | null;
  lastOk: boolean | null;
  lastError: string | null;
}

export async function adminHealth(
  db: Database,
  schedulerJobs: SchedulerJobStatus[],
  now = new Date()
): Promise<AdminHealth> {
  const [run, status, ingest, total, backup, mapGeneratedAt] = await Promise.all([
    latestRun(db),
    statusRecord(db),
    ingestStats(new Date(now.getTime() - 24 * 3600 * 1000)),
    eventCount(db),
    backupSummary(db),
    latestMapGeneratedAt(db)
  ]);
  const sizeRows = await db.execute(
    sql`select pg_database_size(current_database())::bigint as size`
  );
  const sizeBytes = Number((sizeRows[0] as { size?: string | number } | undefined)?.size ?? 0);
  const heartbeatAge = run?.lastHeartbeatAt
    ? Math.max(0, (now.getTime() - run.lastHeartbeatAt.getTime()) / 1000)
    : null;
  return {
    run: run ? runToContract(run) : null,
    last_heartbeat_at: run?.lastHeartbeatAt ? run.lastHeartbeatAt.toISOString() : null,
    heartbeat_age_s: heartbeatAge === null ? null : Math.round(heartbeatAge),
    plugin_version: run?.pluginVersion ?? null,
    game_version: run?.gameVersion ?? null,
    missing_hooks: run?.missingHooks ?? [],
    queue_depth: run?.queueDepth ?? null,
    dropped_events: run?.droppedEvents ?? null,
    a2s: {
      last_ok_at: status?.a2sLastOkAt ? status.a2sLastOkAt.toISOString() : null,
      last_error: status?.a2sLastError ?? null,
      online: status?.a2sOnline ?? null,
      player_count: status?.a2sPlayerCount ?? null
    },
    ingest: {
      last_batch_at: ingest.lastBatchAt ? ingest.lastBatchAt.toISOString() : null,
      batches_24h: ingest.batches,
      events_24h: ingest.events,
      duplicates_24h: ingest.duplicates,
      rejected_24h: ingest.rejected
    },
    db: { events_total: total, size_mb: Math.round((sizeBytes / 1024 / 1024) * 10) / 10 },
    backup,
    map: {
      available: mapGeneratedAt !== null,
      generated_at: mapGeneratedAt ? mapGeneratedAt.toISOString() : null
    },
    jobs: schedulerJobs.map((job) => ({
      name: job.name,
      last_run_at: job.lastRunAt,
      last_ok: job.lastOk,
      last_error: job.lastError
    }))
  };
}

export async function listAdminPlayers(
  db: Database,
  includeHidden: boolean,
  limit: number,
  offset: number
) {
  const rows = await db
    .select()
    .from(players)
    .where(includeHidden ? undefined : eq(players.hidden, false))
    .orderBy(desc(players.lastSeen), desc(players.id))
    .limit(limit + 1)
    .offset(offset);
  const page = rows.slice(0, limit);
  const items: AdminPlayer[] = [];
  for (const row of page) items.push(await adminItem(db, row));
  return { items, hasMore: rows.length > limit };
}

export async function playersById(db: Database, ids: number[]) {
  if (ids.length === 0) return [];
  return db.select().from(players).where(inArray(players.id, ids));
}

export function database(): Database {
  return getDb();
}
