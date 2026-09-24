import { randomUUID } from 'node:crypto';
import { and, desc, eq, gt, gte, inArray, isNull, lte, ne, or, sql } from 'drizzle-orm';
import type {
  AnnouncementShownData,
  BossDefeatedData,
  BossEngagedData,
  BossSummonedData,
  ChatMessageData,
  CreatureDiedData,
  EventEnvelope,
  GlobalKeySetData,
  PlayerBiomeChangedData,
  PlayerDiedData,
  PlayerJoinedData,
  PlayerLeftData,
  PlayerPositionData,
  PlayerSpawnedData,
  RaidEndedData,
  RaidStartedData,
  ServerHeartbeatData,
  ServerLostData,
  ServerStartedData,
  ServerStoppingData,
  StructureBuiltData,
  StructureDestroyedData,
  WorldSavedData
} from '$lib/api/types';
import {
  announcements,
  biomeVisits,
  bossEvents,
  bossKills,
  bossPrefabs,
  bossState,
  characters,
  chatMessages,
  creatureDeaths,
  deaths,
  eventPlayers,
  events,
  globalKeys,
  kills,
  players,
  positions,
  raids,
  saves,
  serverRuns,
  serverStatus,
  sessions,
  structureEvents,
  structuresDaily,
  type RaidEndReason,
  type RaidRow
} from '../db/schema';
import { bossKeyForPrefab, isBossPrefab } from '../names';
import { bossForKey, bossForNameKey, bossForPrefab, isFinalKey } from '$lib/world/bosses';
import {
  bumpCounter,
  eventDate,
  findPlayer,
  parseInstant,
  resolvePlayer,
  type ProjectionContext,
  type ResolvedPlayer,
  type StoredEnvelope
} from './context';
import { builderForCreator, learnCreator } from './creators';

export const rollbackThresholdSeconds = 60;
export const maxPlayers = 10;

type Handler = (ctx: ProjectionContext, event: StoredEnvelope, ts: Date) => Promise<void>;

async function involve(ctx: ProjectionContext, event: StoredEnvelope, ts: Date, ids: number[]) {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return;
  await ctx.tx
    .insert(eventPlayers)
    .values(unique.map((playerId) => ({ eventId: event.id, playerId, ts })))
    .onConflictDoNothing();
}

async function setSubject(ctx: ProjectionContext, event: StoredEnvelope, playerId: number) {
  await ctx.tx.update(events).set({ playerId }).where(eq(events.id, event.id));
}

async function statusRow(ctx: ProjectionContext) {
  const rows = await ctx.tx.select().from(serverStatus).where(eq(serverStatus.id, 1)).limit(1);
  if (rows[0]) return rows[0];
  const inserted = await ctx.tx
    .insert(serverStatus)
    .values({ id: 1 })
    .onConflictDoNothing()
    .returning();
  return (
    inserted[0] ??
    (await ctx.tx.select().from(serverStatus).where(eq(serverStatus.id, 1)).limit(1))[0]!
  );
}

async function updateStatus(
  ctx: ProjectionContext,
  values: Partial<typeof serverStatus.$inferInsert>
) {
  await statusRow(ctx);
  await ctx.tx
    .update(serverStatus)
    .set({ ...values, updatedAt: ctx.receivedAt })
    .where(eq(serverStatus.id, 1));
  ctx.effects.statusChanged = true;
}

async function currentRun(ctx: ProjectionContext) {
  const rows = await ctx.tx.select().from(serverRuns).orderBy(desc(serverRuns.startedAt)).limit(1);
  return rows[0] ?? null;
}

async function openSessionCount(ctx: ProjectionContext, runId: string): Promise<number> {
  const rows = await ctx.tx
    .select({ count: sql<number>`count(*)::int` })
    .from(sessions)
    .where(and(eq(sessions.runId, runId), isNull(sessions.leftAt)));
  return rows[0]?.count ?? 0;
}

async function refreshPlayerCount(ctx: ProjectionContext, runId: string) {
  const count = await openSessionCount(ctx, runId);
  const run = (
    await ctx.tx.select().from(serverRuns).where(eq(serverRuns.runId, runId)).limit(1)
  )[0];
  if (run && count > run.peakPlayers) {
    await ctx.tx.update(serverRuns).set({ peakPlayers: count }).where(eq(serverRuns.runId, runId));
  }
  const latest = await currentRun(ctx);
  if (latest && latest.runId === runId) {
    await updateStatus(ctx, { playerCount: count });
  }
  ctx.effects.onlineChanged = true;
}

async function closeSession(
  ctx: ProjectionContext,
  session: typeof sessions.$inferSelect,
  leftAt: Date,
  reason: string,
  durationOverride: number | null,
  leftEventId: string | null
) {
  const duration =
    durationOverride ?? Math.max(0, (leftAt.getTime() - session.joinedAt.getTime()) / 1000);
  await ctx.tx
    .update(sessions)
    .set({ leftAt, durationS: duration, leftReason: reason, leftEventId })
    .where(eq(sessions.id, session.id));
  await ctx.tx
    .update(players)
    .set({
      playtimeS: sql`${players.playtimeS} + ${duration}`,
      online: false,
      currentSessionId: null,
      lastSeen: sql`greatest(${players.lastSeen}, ${leftAt.toISOString()}::timestamptz)`
    })
    .where(eq(players.id, session.playerId));
  const cached = [...ctx.players.values()].find((player) => player.id === session.playerId);
  if (cached) {
    cached.online = false;
    cached.currentSessionId = null;
  }
}

async function closeOpenSessions(
  ctx: ProjectionContext,
  runId: string,
  leftAt: Date,
  reason: string,
  keepPlayerIds: number[] = []
) {
  const open = await ctx.tx
    .select()
    .from(sessions)
    .where(and(eq(sessions.runId, runId), isNull(sessions.leftAt)));
  for (const session of open) {
    if (keepPlayerIds.includes(session.playerId)) continue;
    await closeSession(ctx, session, leftAt, reason, null, null);
  }
  return open.length;
}

async function closeOpenRaids(
  ctx: ProjectionContext,
  runId: string,
  endedAt: Date,
  reason: RaidEndReason
) {
  await ctx.tx
    .update(raids)
    .set({ endedAt, endReason: reason })
    .where(and(eq(raids.runId, runId), isNull(raids.endedAt)));
}

async function reopenLostRaids(ctx: ProjectionContext, runId: string) {
  await ctx.tx
    .update(raids)
    .set({ endedAt: null, endReason: null })
    .where(and(eq(raids.runId, runId), eq(raids.endReason, 'server_lost')));
}

async function stopRun(
  ctx: ProjectionContext,
  runId: string,
  stoppedAt: Date,
  reason: 'graceful' | 'inferred',
  sessionReason: string
) {
  await ctx.tx
    .update(serverRuns)
    .set({ stoppedAt, stopReason: reason })
    .where(and(eq(serverRuns.runId, runId), isNull(serverRuns.stoppedAt)));
  await closeOpenSessions(ctx, runId, stoppedAt, sessionReason);
  await closeOpenRaids(
    ctx,
    runId,
    stoppedAt,
    reason === 'graceful' ? 'server_stop' : 'server_lost'
  );
  await ctx.tx.update(bossState).set({ active: false }).where(eq(bossState.active, true));
  const latest = await currentRun(ctx);
  if (latest && latest.runId === runId) {
    await updateStatus(ctx, { online: false, playerCount: 0, source: 'plugin' });
  }
  ctx.effects.onlineChanged = true;
}

async function upsertGlobalKey(
  ctx: ProjectionContext,
  event: StoredEnvelope,
  ts: Date,
  rawKey: string,
  rawValue: string | null
) {
  const key = rawKey.trim();
  if (key === '' || key.toLowerCase() === 'activebosses') return;
  await ctx.tx
    .insert(globalKeys)
    .values({ key, value: rawValue, firstSetAt: ts, worldDay: event.world_day, eventId: event.id })
    .onConflictDoNothing();
}

async function recordRollback(
  ctx: ProjectionContext,
  event: StoredEnvelope,
  ts: Date,
  fromNetTime: number,
  toNetTime: number
) {
  if (ctx.rebuild) return;
  const synthetic: StoredEnvelope = {
    id: randomUUID(),
    seq: event.seq,
    run_id: event.run_id,
    ts: ts.toISOString(),
    type: 'world.rollback_detected',
    world_day: event.world_day,
    data: { from_net_time: fromNetTime, to_net_time: toNetTime }
  };
  await ctx.tx.insert(events).values({
    id: synthetic.id,
    runId: synthetic.run_id,
    seq: synthetic.seq,
    type: synthetic.type,
    ts,
    receivedAt: ctx.receivedAt,
    worldDay: synthetic.world_day,
    data: synthetic.data
  });
  ctx.effects.syntheticEvents.push(synthetic);
}

async function checkRollback(
  ctx: ProjectionContext,
  event: StoredEnvelope,
  ts: Date,
  netTime: number,
  reference: number | null
) {
  if (reference !== null && reference - netTime > rollbackThresholdSeconds) {
    await recordRollback(ctx, event, ts, reference, netTime);
  }
}

async function updatePlayerPosition(
  ctx: ProjectionContext,
  player: ResolvedPlayer,
  ts: Date,
  x: number,
  z: number,
  biome: string
) {
  await ctx.tx
    .update(players)
    .set({ lastX: x, lastZ: z, lastBiome: biome, lastPositionAt: ts })
    .where(eq(players.id, player.id));
  player.lastX = x;
  player.lastZ = z;
  player.lastBiome = biome;
}

async function visitBiome(
  ctx: ProjectionContext,
  player: ResolvedPlayer,
  biome: string,
  ts: Date,
  worldDay: number
): Promise<boolean> {
  const inserted = await ctx.tx
    .insert(biomeVisits)
    .values({ playerId: player.id, biome, firstAt: ts, firstDay: worldDay, lastAt: ts, count: 1 })
    .onConflictDoNothing()
    .returning({ playerId: biomeVisits.playerId });
  if (inserted.length > 0) return true;
  await ctx.tx
    .update(biomeVisits)
    .set({
      count: sql`${biomeVisits.count} + 1`,
      lastAt: sql`greatest(${biomeVisits.lastAt}, ${ts.toISOString()}::timestamptz)`
    })
    .where(and(eq(biomeVisits.playerId, player.id), eq(biomeVisits.biome, biome)));
  return false;
}

async function upsertCharacter(
  ctx: ProjectionContext,
  player: ResolvedPlayer,
  characterId: number,
  name: string,
  ts: Date
) {
  const inserted = await ctx.tx
    .insert(characters)
    .values({ playerId: player.id, characterId, name, firstSeen: ts, lastSeen: ts })
    .onConflictDoNothing()
    .returning({ id: characters.id });
  if (inserted.length === 0) {
    await ctx.tx
      .update(characters)
      .set({
        name,
        lastSeen: sql`greatest(${characters.lastSeen}, ${ts.toISOString()}::timestamptz)`
      })
      .where(and(eq(characters.playerId, player.id), eq(characters.characterId, characterId)));
  }
}

async function resolveMany(
  ctx: ProjectionContext,
  ids: string[],
  ts: Date
): Promise<ResolvedPlayer[]> {
  const out: ResolvedPlayer[] = [];
  for (const id of ids) {
    if (!id) continue;
    out.push(await resolvePlayer(ctx, id, ts));
  }
  return out;
}

async function resolveBossKey(
  ctx: ProjectionContext,
  prefab: string,
  nameKey: string | null
): Promise<string> {
  const known = bossForPrefab(prefab) ?? (nameKey ? bossForNameKey(nameKey) : null);
  if (known) return known.key;
  const learned = await ctx.tx
    .select({ key: bossPrefabs.key })
    .from(bossPrefabs)
    .where(eq(bossPrefabs.prefab, prefab))
    .limit(1);
  if (learned[0]) return learned[0].key;
  const key = bossKeyForPrefab(prefab);
  await ctx.tx.insert(bossPrefabs).values({ prefab, key, nameKey }).onConflictDoNothing();
  return key;
}

const serverStarted: Handler = async (ctx, event, ts) => {
  const data = event.data as ServerStartedData;
  for (const creator of data.creators ?? []) {
    await learnCreator(ctx, creator.creator_id, creator.platform_user_id);
  }
  const previous = (
    await ctx.tx
      .select()
      .from(serverRuns)
      .where(ne(serverRuns.runId, event.run_id))
      .orderBy(desc(serverRuns.startedAt))
      .limit(1)
  )[0];
  const others = await ctx.tx
    .select()
    .from(serverRuns)
    .where(and(ne(serverRuns.runId, event.run_id), isNull(serverRuns.stoppedAt)));
  for (const other of others) {
    await stopRun(ctx, other.runId, ts, 'inferred', 'server_lost');
  }
  await ctx.tx
    .insert(serverRuns)
    .values({
      runId: event.run_id,
      startedAt: ts,
      lastHeartbeatReceivedAt: ctx.receivedAt,
      gameVersion: data.game_version,
      networkVersion: data.network_version,
      pluginVersion: data.plugin_version,
      bepinexVersion: data.bepinex_version,
      unityVersion: data.unity_version,
      worldName: data.world_name,
      worldUid: data.world_uid,
      lastNetTime: data.net_time,
      lastWorldDay: data.world_day,
      lastSeq: event.seq,
      missingHooks: data.missing_hooks,
      lastHeartbeatAt: ts
    })
    .onConflictDoUpdate({
      target: serverRuns.runId,
      set: {
        startedAt: ts,
        lastHeartbeatReceivedAt: ctx.receivedAt,
        gameVersion: data.game_version,
        networkVersion: data.network_version,
        pluginVersion: data.plugin_version,
        bepinexVersion: data.bepinex_version,
        unityVersion: data.unity_version,
        worldName: data.world_name,
        worldUid: data.world_uid,
        missingHooks: data.missing_hooks
      }
    });
  for (const line of data.global_keys) {
    const space = line.indexOf(' ');
    const key = space > 0 ? line.slice(0, space) : line;
    const value = space > 0 ? line.slice(space + 1).trim() || null : null;
    await upsertGlobalKey(ctx, event, ts, key, value);
  }
  await checkRollback(ctx, event, ts, data.net_time, previous ? previous.lastNetTime : null);
  await updateStatus(ctx, {
    online: true,
    source: 'plugin',
    playerCount: 0,
    maxPlayers,
    gameVersion: data.game_version,
    networkVersion: data.network_version,
    worldName: data.world_name,
    worldUid: data.world_uid,
    worldDay: data.world_day,
    netTime: data.net_time,
    netTimeAt: ts,
    lastPluginAt: ts,
    telemetryDelayedSince: null
  });
  ctx.effects.onlineChanged = true;
};

const serverStopping: Handler = async (ctx, event, ts) => {
  const data = event.data as ServerStoppingData;
  await ctx.tx
    .update(serverRuns)
    .set({ uptimeS: data.uptime_s, lastSeq: sql`greatest(${serverRuns.lastSeq}, ${event.seq})` })
    .where(eq(serverRuns.runId, event.run_id));
  await stopRun(ctx, event.run_id, ts, 'graceful', 'server_stop');
};

const serverLost: Handler = async (ctx, event) => {
  const data = event.data as ServerLostData;
  await stopRun(ctx, event.run_id, parseInstant(data.last_heartbeat_at), 'inferred', 'server_lost');
};

async function ensureRun(ctx: ProjectionContext, event: StoredEnvelope, ts: Date) {
  const rows = await ctx.tx
    .select()
    .from(serverRuns)
    .where(eq(serverRuns.runId, event.run_id))
    .limit(1);
  if (rows[0]) return rows[0];
  const inserted = await ctx.tx
    .insert(serverRuns)
    .values({
      runId: event.run_id,
      startedAt: ts,
      lastHeartbeatAt: ts,
      lastHeartbeatReceivedAt: ctx.receivedAt,
      lastSeq: event.seq
    })
    .onConflictDoNothing()
    .returning();
  ctx.effects.statusChanged = true;
  return (
    inserted[0] ??
    (await ctx.tx.select().from(serverRuns).where(eq(serverRuns.runId, event.run_id)).limit(1))[0]!
  );
}

const serverHeartbeat: Handler = async (ctx, event, ts) => {
  const data = event.data as ServerHeartbeatData;
  const run = await ensureRun(ctx, event, ts);
  if (run.lastHeartbeatAt && run.lastHeartbeatAt > ts) return;
  await checkRollback(ctx, event, ts, data.net_time, run.lastNetTime);
  if (run.stoppedAt && run.stopReason === 'inferred') await reopenLostRaids(ctx, event.run_id);
  await ctx.tx
    .update(serverRuns)
    .set({
      lastHeartbeatAt: ts,
      lastHeartbeatReceivedAt: ctx.receivedAt,
      lastNetTime: data.net_time,
      lastWorldDay: data.world_day,
      lastSeq: sql`greatest(${serverRuns.lastSeq}, ${event.seq})`,
      queueDepth: data.queue_depth,
      droppedEvents: data.dropped_events,
      uptimeS: data.uptime_s,
      lastSaveAgeS: data.last_save_age_s,
      stoppedAt: null,
      stopReason: null
    })
    .where(eq(serverRuns.runId, event.run_id));
  const present: number[] = [];
  for (const entry of data.players) {
    const player = await resolvePlayer(ctx, entry.platform_user_id, ts, { name: entry.name });
    present.push(player.id);
    if (entry.character_id) await upsertCharacter(ctx, player, entry.character_id, entry.name, ts);
    const open = await ctx.tx
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.runId, event.run_id),
          eq(sessions.playerId, player.id),
          isNull(sessions.leftAt)
        )
      )
      .limit(1);
    if (open.length === 0) {
      const inserted = await ctx.tx
        .insert(sessions)
        .values({
          playerId: player.id,
          characterId: entry.character_id || null,
          characterName: entry.name,
          runId: event.run_id,
          peerUid: 0,
          joinedAt: ts
        })
        .onConflictDoNothing()
        .returning({ id: sessions.id });
      if (inserted[0]) {
        await ctx.tx
          .update(players)
          .set({
            online: true,
            currentSessionId: inserted[0].id,
            sessions: sql`${players.sessions} + 1`
          })
          .where(eq(players.id, player.id));
        player.online = true;
        player.currentSessionId = inserted[0].id;
      }
    }
    await ctx.tx
      .update(players)
      .set({
        lastX: entry.x,
        lastZ: entry.z,
        lastBiome: entry.biome,
        lastPositionAt: ts,
        distanceM: sql`${players.distanceM} + ${Math.max(0, entry.distance_since_last_m)}`,
        lastSeen: sql`greatest(${players.lastSeen}, ${ts.toISOString()}::timestamptz)`
      })
      .where(eq(players.id, player.id));
    player.lastX = entry.x;
    player.lastZ = entry.z;
    player.lastBiome = entry.biome;
  }
  await closeOpenSessions(ctx, event.run_id, ts, 'reconciled', present);
  const latest = await currentRun(ctx);
  const values: Partial<typeof serverStatus.$inferInsert> = {
    online: true,
    source: 'plugin',
    worldDay: data.world_day,
    netTime: data.net_time,
    netTimeAt: ts,
    lastPluginAt: ts,
    telemetryDelayedSince: null,
    playerCount: present.length
  };
  if (data.last_save_age_s !== null) {
    const status = await statusRow(ctx);
    if (!status.lastSaveAt)
      values.lastSaveAt = new Date(ts.getTime() - data.last_save_age_s * 1000);
  }
  if (latest && latest.runId === event.run_id) await updateStatus(ctx, values);
  await refreshPlayerCount(ctx, event.run_id);
};

const worldSaved: Handler = async (ctx, event, ts) => {
  const data = event.data as WorldSavedData;
  await ensureRun(ctx, event, ts);
  await ctx.tx
    .insert(saves)
    .values({ eventId: event.id, runId: event.run_id, at: ts, durationMs: data.duration_ms })
    .onConflictDoNothing();
  await ctx.tx
    .update(serverRuns)
    .set({ saves: sql`${serverRuns.saves} + 1` })
    .where(eq(serverRuns.runId, event.run_id));
  const status = await statusRow(ctx);
  if (!status.lastSaveAt || status.lastSaveAt <= ts) {
    await updateStatus(ctx, { lastSaveAt: ts, lastSaveDurationMs: data.duration_ms });
  }
};

const playerJoined: Handler = async (ctx, event, ts) => {
  const data = event.data as PlayerJoinedData;
  await ensureRun(ctx, event, ts);
  const player = await resolvePlayer(ctx, data.platform_user_id, ts, {
    name: data.name,
    displayId: data.display_id,
    platform: data.platform
  });
  const stale = await ctx.tx
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.runId, event.run_id),
        eq(sessions.playerId, player.id),
        isNull(sessions.leftAt)
      )
    );
  for (const session of stale) {
    await closeSession(ctx, session, ts, 'reconciled', null, null);
  }
  const inserted = await ctx.tx
    .insert(sessions)
    .values({
      playerId: player.id,
      characterName: data.name,
      runId: event.run_id,
      peerUid: data.peer_uid,
      joinedAt: ts,
      joinEventId: event.id
    })
    .onConflictDoNothing()
    .returning({ id: sessions.id });
  const sessionId = inserted[0]?.id ?? null;
  if (sessionId !== null) {
    await ctx.tx
      .update(players)
      .set({ online: true, currentSessionId: sessionId, sessions: sql`${players.sessions} + 1` })
      .where(eq(players.id, player.id));
    player.online = true;
    player.currentSessionId = sessionId;
  }
  await setSubject(ctx, event, player.id);
  await involve(ctx, event, ts, [player.id]);
  await refreshPlayerCount(ctx, event.run_id);
};

const playerSpawned: Handler = async (ctx, event, ts) => {
  const data = event.data as PlayerSpawnedData;
  const player = await resolvePlayer(ctx, data.platform_user_id, ts, { name: data.name });
  await upsertCharacter(ctx, player, data.character_id, data.name, ts);
  await ctx.tx
    .update(sessions)
    .set({ characterId: data.character_id, characterName: data.name })
    .where(
      and(
        eq(sessions.runId, event.run_id),
        eq(sessions.playerId, player.id),
        isNull(sessions.leftAt)
      )
    );
  await updatePlayerPosition(ctx, player, ts, data.x, data.z, data.biome);
  if (!data.respawn) await visitBiome(ctx, player, data.biome, ts, event.world_day);
  await setSubject(ctx, event, player.id);
  await involve(ctx, event, ts, [player.id]);
  ctx.effects.onlineChanged = true;
};

const playerDied: Handler = async (ctx, event, ts) => {
  const data = event.data as PlayerDiedData;
  const player = await resolvePlayer(ctx, data.platform_user_id, ts, { name: data.name });
  const cause = data.observed_cause;
  const attacker = cause?.attacker_platform_user_id
    ? await resolvePlayer(ctx, cause.attacker_platform_user_id, ts)
    : null;
  const inserted = await ctx.tx
    .insert(deaths)
    .values({
      eventId: event.id,
      playerId: player.id,
      characterId: data.character_id || null,
      diedAt: ts,
      worldDay: event.world_day,
      biome: data.biome,
      x: data.x,
      z: data.z,
      hitType: cause?.hit_type ?? null,
      attackerPrefab: cause?.attacker_prefab ?? null,
      attackerPlayerId: attacker?.id ?? null
    })
    .onConflictDoNothing()
    .returning({ id: deaths.id });
  if (inserted.length > 0) await bumpCounter(ctx, player.id, 'deaths');
  await updatePlayerPosition(ctx, player, ts, data.x, data.z, data.biome);
  await setSubject(ctx, event, player.id);
  await involve(ctx, event, ts, attacker ? [player.id, attacker.id] : [player.id]);
};

const playerLeft: Handler = async (ctx, event, ts) => {
  const data = event.data as PlayerLeftData;
  const player = await resolvePlayer(ctx, data.platform_user_id, ts, { name: data.name });
  const open = await ctx.tx
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.runId, event.run_id),
        eq(sessions.playerId, player.id),
        isNull(sessions.leftAt)
      )
    )
    .orderBy(desc(sessions.joinedAt))
    .limit(1);
  if (open[0]) {
    await closeSession(ctx, open[0], ts, data.reason, data.session_s, event.id);
  } else {
    await ctx.tx
      .update(players)
      .set({
        online: false,
        currentSessionId: null,
        lastSeen: sql`greatest(${players.lastSeen}, ${ts.toISOString()}::timestamptz)`
      })
      .where(eq(players.id, player.id));
    player.online = false;
    player.currentSessionId = null;
  }
  await setSubject(ctx, event, player.id);
  await involve(ctx, event, ts, [player.id]);
  await refreshPlayerCount(ctx, event.run_id);
};

const playerBiomeChanged: Handler = async (ctx, event, ts) => {
  const data = event.data as PlayerBiomeChangedData;
  const player = await resolvePlayer(ctx, data.platform_user_id, ts);
  await visitBiome(ctx, player, data.to, ts, event.world_day);
  await updatePlayerPosition(ctx, player, ts, data.x, data.z, data.to);
  await setSubject(ctx, event, player.id);
  await involve(ctx, event, ts, [player.id]);
  ctx.effects.onlineChanged = true;
};

const playerPosition: Handler = async (ctx, event, ts) => {
  const data = event.data as PlayerPositionData;
  const player = await resolvePlayer(ctx, data.platform_user_id, ts);
  await ctx.tx
    .insert(positions)
    .values({ playerId: player.id, ts, x: data.x, z: data.z, biome: data.biome })
    .onConflictDoNothing();
  await updatePlayerPosition(ctx, player, ts, data.x, data.z, data.biome);
  await setSubject(ctx, event, player.id);
  await involve(ctx, event, ts, [player.id]);
  ctx.effects.onlineChanged = true;
};

const bossSummoned: Handler = async (ctx, event, ts) => {
  const data = event.data as BossSummonedData;
  const key = await resolveBossKey(ctx, data.prefab, data.name_key);
  const summoner = data.summoner_platform_user_id
    ? await resolvePlayer(ctx, data.summoner_platform_user_id, ts)
    : null;
  await ctx.tx
    .insert(bossEvents)
    .values({
      eventId: event.id,
      kind: 'summoned',
      key,
      prefab: data.prefab,
      nameKey: data.name_key,
      at: ts,
      worldDay: event.world_day,
      x: data.x,
      z: data.z,
      biome: data.biome,
      summonerPlayerId: summoner?.id ?? null,
      method: data.method
    })
    .onConflictDoNothing();
  if (summoner) {
    await setSubject(ctx, event, summoner.id);
    await involve(ctx, event, ts, [summoner.id]);
  }
};

export const engagedDedupeSeconds = 60;

const bossEngaged: Handler = async (ctx, event, ts) => {
  const data = event.data as BossEngagedData;
  const key = await resolveBossKey(ctx, data.prefab, data.name_key);
  const nearby = await resolveMany(ctx, data.nearby, ts);
  const window = engagedDedupeSeconds * 1000;
  const recent = await ctx.tx
    .select({ id: bossEvents.id })
    .from(bossEvents)
    .where(
      and(
        eq(bossEvents.key, key),
        eq(bossEvents.kind, 'engaged'),
        eq(bossEvents.prefab, data.prefab),
        ne(bossEvents.eventId, event.id),
        gte(bossEvents.at, new Date(ts.getTime() - window)),
        lte(bossEvents.at, new Date(ts.getTime() + window))
      )
    )
    .limit(1);
  if (recent.length === 0) {
    await ctx.tx
      .insert(bossEvents)
      .values({
        eventId: event.id,
        kind: 'engaged',
        key,
        prefab: data.prefab,
        nameKey: data.name_key,
        at: ts,
        worldDay: event.world_day,
        x: data.x,
        z: data.z,
        biome: data.biome,
        nearbyPlayerIds: nearby.map((player) => player.id),
        alertMessage: data.alert_message
      })
      .onConflictDoNothing();
    await ctx.tx
      .insert(bossState)
      .values({ key, active: true, engagedAt: ts })
      .onConflictDoUpdate({ target: bossState.key, set: { active: true, engagedAt: ts } });
  }
  await involve(
    ctx,
    event,
    ts,
    nearby.map((player) => player.id)
  );
};

interface KeyedDefeat {
  key: string;
  value: string | null;
  firstTime: boolean;
  prefab: string | null;
  nameKey: string | null;
  senderPlatformUserId: string | null;
  nearby: string[];
  participants: string[];
  reportedAsBoss: boolean;
}

async function keyedDefeat(
  ctx: ProjectionContext,
  event: StoredEnvelope,
  ts: Date,
  defeat: KeyedDefeat
) {
  const rawKey = defeat.key.trim().toLowerCase();
  const known = bossForKey(rawKey);
  const tier = known?.tier ?? (defeat.reportedAsBoss ? 'other' : null);
  if (tier === null || (tier === 'forsaken' && !defeat.reportedAsBoss)) {
    await upsertGlobalKey(ctx, event, ts, rawKey, defeat.value);
    return;
  }
  const key = known?.key ?? rawKey;
  const sender = defeat.senderPlatformUserId
    ? await resolvePlayer(ctx, defeat.senderPlatformUserId, ts)
    : null;
  const nearby = await resolveMany(ctx, defeat.nearby, ts);
  const participants = await resolveMany(ctx, defeat.participants, ts);
  const credited = new Set<number>([
    ...participants.map((player) => player.id),
    ...nearby.map((player) => player.id)
  ]);
  const involved = [...credited, ...(sender ? [sender.id] : [])];
  const subject = participants[0] ?? sender ?? nearby[0] ?? null;
  const position = {
    x: sender?.lastX ?? null,
    z: sender?.lastZ ?? null,
    biome: sender?.lastBiome ?? null
  };
  if (!known && defeat.prefab) {
    await ctx.tx
      .insert(bossPrefabs)
      .values({ prefab: defeat.prefab, key, nameKey: defeat.nameKey })
      .onConflictDoUpdate({
        target: bossPrefabs.prefab,
        set: { key, nameKey: defeat.nameKey }
      });
  }
  const finalKill = known === null || isFinalKey(rawKey);
  if (!finalKill) {
    await ctx.tx
      .insert(bossEvents)
      .values({
        eventId: event.id,
        kind: 'phase',
        key,
        prefab: defeat.prefab,
        nameKey: defeat.nameKey,
        at: ts,
        worldDay: event.world_day,
        ...position,
        nearbyPlayerIds: nearby.map((player) => player.id),
        participantPlayerIds: participants.map((player) => player.id),
        firstTime: defeat.firstTime
      })
      .onConflictDoNothing();
    await upsertGlobalKey(ctx, event, ts, rawKey, defeat.value);
    if (subject) await setSubject(ctx, event, subject.id);
    await involve(ctx, event, ts, involved);
    return;
  }
  const inserted = await ctx.tx
    .insert(bossKills)
    .values({
      eventId: event.id,
      key,
      killedAt: ts,
      worldDay: event.world_day,
      firstTime: defeat.firstTime,
      senderPlayerId: sender?.id ?? null,
      nearbyPlayerIds: nearby.map((player) => player.id),
      participantPlayerIds: participants.map((player) => player.id),
      prefab: defeat.prefab,
      nameKey: defeat.nameKey
    })
    .onConflictDoNothing()
    .returning({ id: bossKills.id });
  await ctx.tx
    .insert(bossEvents)
    .values({
      eventId: event.id,
      kind: 'defeated',
      key,
      prefab: defeat.prefab,
      nameKey: defeat.nameKey,
      at: ts,
      worldDay: event.world_day,
      ...position,
      nearbyPlayerIds: nearby.map((player) => player.id),
      participantPlayerIds: participants.map((player) => player.id),
      firstTime: defeat.firstTime
    })
    .onConflictDoNothing();
  if (tier !== 'mini') {
    await ctx.tx
      .insert(bossState)
      .values({ key, active: false, engagedAt: null })
      .onConflictDoUpdate({ target: bossState.key, set: { active: false } });
  }
  await upsertGlobalKey(ctx, event, ts, rawKey, defeat.value);
  if (inserted.length > 0 && tier === 'forsaken') {
    for (const playerId of credited) await bumpCounter(ctx, playerId, 'bossKills');
  }
  if (subject) await setSubject(ctx, event, subject.id);
  await involve(ctx, event, ts, involved);
}

const bossDefeated: Handler = async (ctx, event, ts) => {
  const data = event.data as BossDefeatedData;
  await keyedDefeat(ctx, event, ts, {
    key: data.key,
    value: null,
    firstTime: data.first_time,
    prefab: data.prefab,
    nameKey: data.name_key,
    senderPlatformUserId: data.sender_platform_user_id,
    nearby: data.nearby,
    participants: data.participants,
    reportedAsBoss: true
  });
};

const globalKeySet: Handler = async (ctx, event, ts) => {
  const data = event.data as GlobalKeySetData;
  await keyedDefeat(ctx, event, ts, {
    key: data.key,
    value: data.value,
    firstTime: data.first_time,
    prefab: data.prefab ?? null,
    nameKey: data.name_key ?? null,
    senderPlatformUserId: data.sender_platform_user_id ?? null,
    nearby: data.nearby ?? [],
    participants: [],
    reportedAsBoss: false
  });
};

const raidCentreToleranceM = 0.5;

async function pendingRaidBefore(
  ctx: ProjectionContext,
  runId: string,
  data: RaidStartedData
): Promise<RaidRow | null> {
  const rows = await ctx.tx
    .select()
    .from(raids)
    .where(
      and(
        ne(raids.runId, runId),
        eq(raids.name, data.name),
        sql`abs(${raids.x} - ${data.x}) < ${raidCentreToleranceM}`,
        sql`abs(${raids.z} - ${data.z}) < ${raidCentreToleranceM}`,
        or(isNull(raids.endedAt), inArray(raids.endReason, ['server_stop', 'server_lost']))
      )
    )
    .orderBy(desc(raids.startedAt), desc(raids.id))
    .limit(1);
  return rows[0] ?? null;
}

async function resumeRaid(
  ctx: ProjectionContext,
  event: StoredEnvelope,
  ts: Date,
  raid: RaidRow,
  nearby: ResolvedPlayer[]
) {
  const newcomers = nearby.filter((player) => !raid.participantIds.includes(player.id));
  await ctx.tx
    .update(raids)
    .set({
      runId: event.run_id,
      endedAt: null,
      endEventId: null,
      endReason: null,
      activeS: null,
      resumeEventIds: [...raid.resumeEventIds, event.id],
      participantIds: [...raid.participantIds, ...newcomers.map((player) => player.id)]
    })
    .where(eq(raids.id, raid.id));
  for (const player of newcomers) await bumpCounter(ctx, player.id, 'raids');
  await involve(
    ctx,
    event,
    ts,
    nearby.map((player) => player.id)
  );
}

const raidStarted: Handler = async (ctx, event, ts) => {
  const data = event.data as RaidStartedData;
  const run = await ensureRun(ctx, event, ts);
  const restored = run.gameVersion === null;
  const nearby = await resolveMany(ctx, data.nearby, ts);
  if (restored) {
    const pending = await pendingRaidBefore(ctx, event.run_id, data);
    if (pending) {
      await resumeRaid(ctx, event, ts, pending, nearby);
      return;
    }
  }
  const inserted = await ctx.tx
    .insert(raids)
    .values({
      startEventId: event.id,
      runId: event.run_id,
      name: data.name,
      startedAt: ts,
      worldDay: event.world_day,
      biome: data.biome,
      x: data.x,
      z: data.z,
      plannedDurationS: data.duration_s,
      participantIds: nearby.map((player) => player.id),
      restored
    })
    .onConflictDoNothing()
    .returning({ id: raids.id });
  if (inserted.length > 0) {
    for (const player of nearby) await bumpCounter(ctx, player.id, 'raids');
  }
  await involve(
    ctx,
    event,
    ts,
    nearby.map((player) => player.id)
  );
};

const raidEnded: Handler = async (ctx, event, ts) => {
  const data = event.data as RaidEndedData;
  const open = await ctx.tx
    .select()
    .from(raids)
    .where(and(eq(raids.runId, event.run_id), eq(raids.name, data.name), isNull(raids.endedAt)))
    .orderBy(desc(raids.startedAt))
    .limit(1);
  if (open[0]) {
    await ctx.tx
      .update(raids)
      .set({
        endedAt: ts,
        endEventId: event.id,
        endReason: 'ended',
        activeS: typeof data.active_s === 'number' ? data.active_s : null
      })
      .where(eq(raids.id, open[0].id));
  }
};

const structureBuilt: Handler = async (ctx, event, ts) => {
  const data = event.data as StructureBuiltData;
  await learnCreator(ctx, data.creator_character_id, data.creator_platform_user_id);
  const builder = data.creator_platform_user_id
    ? await resolvePlayer(ctx, data.creator_platform_user_id, ts)
    : null;
  const builderId = builder?.id ?? (await builderForCreator(ctx, data.creator_character_id));
  const inserted = await ctx.tx
    .insert(structureEvents)
    .values({
      eventId: event.id,
      at: ts,
      kind: 'built',
      prefab: data.prefab,
      x: data.x,
      z: data.z,
      biome: data.biome,
      playerId: builderId,
      creatorCharacterId: data.creator_character_id || null
    })
    .onConflictDoNothing()
    .returning({ id: structureEvents.id });
  if (inserted.length === 0) return;
  const placed = data.creator_character_id ? 1 : 0;
  await ctx.tx
    .insert(structuresDaily)
    .values({
      date: eventDate(ts),
      prefab: data.prefab,
      builderPlayerId: builderId ?? 0,
      built: 1,
      placed
    })
    .onConflictDoUpdate({
      target: [structuresDaily.date, structuresDaily.prefab, structuresDaily.builderPlayerId],
      set: {
        built: sql`${structuresDaily.built} + 1`,
        placed: sql`${structuresDaily.placed} + ${placed}`
      }
    });
  if (builderId !== null) {
    await bumpCounter(ctx, builderId, 'structuresBuilt');
    await setSubject(ctx, event, builderId);
    await involve(ctx, event, ts, [builderId]);
  }
};

const structureDestroyed: Handler = async (ctx, event, ts) => {
  const data = event.data as StructureDestroyedData;
  await learnCreator(ctx, data.creator_character_id, data.creator_platform_user_id);
  const account = data.creator_platform_user_id
    ? await findPlayer(ctx, data.creator_platform_user_id)
    : null;
  const builderId = account?.id ?? (await builderForCreator(ctx, data.creator_character_id));
  const inserted = await ctx.tx
    .insert(structureEvents)
    .values({
      eventId: event.id,
      at: ts,
      kind: 'destroyed',
      prefab: data.prefab,
      x: data.x,
      z: data.z,
      biome: data.biome,
      playerId: builderId,
      creatorCharacterId: data.creator_character_id ?? null
    })
    .onConflictDoNothing()
    .returning({ id: structureEvents.id });
  if (inserted.length === 0) return;
  await ctx.tx
    .insert(structuresDaily)
    .values({
      date: eventDate(ts),
      prefab: data.prefab,
      builderPlayerId: builderId ?? 0,
      destroyed: 1
    })
    .onConflictDoUpdate({
      target: [structuresDaily.date, structuresDaily.prefab, structuresDaily.builderPlayerId],
      set: { destroyed: sql`${structuresDaily.destroyed} + 1` }
    });
  if (builderId !== null) {
    await bumpCounter(ctx, builderId, 'structuresDestroyed');
    await setSubject(ctx, event, builderId);
    await involve(ctx, event, ts, [builderId]);
  }
};

const creatureDied: Handler = async (ctx, event, ts) => {
  const data = event.data as CreatureDiedData;
  const creature = data.prefab.replace(/_ragdoll$/i, '');
  await ctx.tx
    .insert(creatureDeaths)
    .values({ date: eventDate(ts), creature, count: 1 })
    .onConflictDoUpdate({
      target: [creatureDeaths.date, creatureDeaths.creature],
      set: { count: sql`${creatureDeaths.count} + 1` }
    });
  const credited = await resolveMany(ctx, data.credited, ts);
  const nearby = await resolveMany(ctx, data.nearby, ts);
  const basis = credited.length > 0 ? 'credited' : 'nearby';
  const killers = credited.length > 0 ? credited : nearby;
  const boss = isBossPrefab(creature);
  for (const player of killers) {
    const inserted = await ctx.tx
      .insert(kills)
      .values({
        eventId: event.id,
        playerId: player.id,
        creature,
        level: data.level,
        at: ts,
        basis,
        boss
      })
      .onConflictDoNothing()
      .returning({ id: kills.id });
    if (inserted.length > 0) {
      await bumpCounter(ctx, player.id, basis === 'credited' ? 'killsCredited' : 'killsNearby');
    }
  }
  const subject = killers[0] ?? null;
  if (subject) await setSubject(ctx, event, subject.id);
  await involve(
    ctx,
    event,
    ts,
    [...credited, ...nearby].map((player) => player.id)
  );
};

const chatMessage: Handler = async (ctx, event, ts) => {
  const data = event.data as ChatMessageData;
  const player = data.platform_user_id.startsWith('Server_')
    ? null
    : await resolvePlayer(ctx, data.platform_user_id, ts);
  const inserted = await ctx.tx
    .insert(chatMessages)
    .values({
      eventId: event.id,
      at: ts,
      worldDay: event.world_day,
      kind: data.kind,
      playerId: player?.id ?? null,
      text: data.text,
      x: data.x,
      z: data.z,
      biome: data.biome
    })
    .onConflictDoNothing()
    .returning({ id: chatMessages.id });
  if (!player) return;
  if (inserted.length > 0 && data.kind === 'shout') await bumpCounter(ctx, player.id, 'shouts');
  await setSubject(ctx, event, player.id);
  await involve(ctx, event, ts, [player.id]);
};

const announcementShown: Handler = async (ctx, event, ts) => {
  const data = event.data as AnnouncementShownData;
  await ctx.tx
    .update(announcements)
    .set({
      deliveredAt: sql`coalesce(${announcements.deliveredAt}, ${ts.toISOString()}::timestamptz)`,
      shownAt: sql`least(coalesce(${announcements.shownAt}, ${ts.toISOString()}::timestamptz), ${ts.toISOString()}::timestamptz)`,
      ...(data.final
        ? {
            completedAt: sql`coalesce(${announcements.completedAt}, ${ts.toISOString()}::timestamptz)`
          }
        : {})
    })
    .where(eq(announcements.id, data.announcement_id));
};

const noop: Handler = async () => {};

const handlers: Record<EventEnvelope['type'], Handler> = {
  'server.started': serverStarted,
  'server.stopping': serverStopping,
  'server.heartbeat': serverHeartbeat,
  'server.lost': serverLost,
  'world.save_started': noop,
  'world.saved': worldSaved,
  'world.rollback_detected': noop,
  'world.dusk_approaching': noop,
  'world.dawn_approaching': noop,
  'player.joined': playerJoined,
  'player.spawned': playerSpawned,
  'player.died': playerDied,
  'player.left': playerLeft,
  'player.biome_changed': playerBiomeChanged,
  'player.position': playerPosition,
  'boss.summoned': bossSummoned,
  'boss.engaged': bossEngaged,
  'boss.defeated': bossDefeated,
  'global_key.set': globalKeySet,
  'raid.started': raidStarted,
  'raid.ended': raidEnded,
  'structure.built': structureBuilt,
  'structure.destroyed': structureDestroyed,
  'creature.died': creatureDied,
  'chat.message': chatMessage,
  'announcement.shown': announcementShown
};

export async function applyEvent(ctx: ProjectionContext, event: StoredEnvelope): Promise<void> {
  const ts = parseInstant(event.ts);
  const handler = handlers[event.type];
  await handler(ctx, event, ts);
  if (event.type !== 'server.heartbeat') {
    await ctx.tx
      .update(serverRuns)
      .set({ lastSeq: sql`greatest(${serverRuns.lastSeq}, ${event.seq})` })
      .where(eq(serverRuns.runId, event.run_id));
  }
}

export async function playersInvolved(ctx: ProjectionContext, ids: string[]): Promise<number[]> {
  const out: number[] = [];
  for (const id of ids) {
    const player = await findPlayer(ctx, id);
    if (player) out.push(player.id);
  }
  return out;
}

export async function markTelemetryDelayed(ctx: ProjectionContext, since: Date): Promise<void> {
  const status = await statusRow(ctx);
  if (status.telemetryDelayedSince) return;
  await updateStatus(ctx, { telemetryDelayedSince: since });
}

export async function openRuns(ctx: ProjectionContext) {
  return ctx.tx.select().from(serverRuns).where(isNull(serverRuns.stoppedAt));
}

export async function latestRunAfter(ctx: ProjectionContext, ts: Date) {
  return ctx.tx.select().from(serverRuns).where(gt(serverRuns.startedAt, ts)).limit(1);
}

export async function sessionsOf(ctx: ProjectionContext, ids: number[]) {
  if (ids.length === 0) return [];
  return ctx.tx.select().from(sessions).where(inArray(sessions.id, ids));
}
