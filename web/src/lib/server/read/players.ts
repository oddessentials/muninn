import { and, asc, desc, eq, gte, ilike, inArray, isNull, or, sql, type SQL } from 'drizzle-orm';
import type {
  AdminPlayer,
  Death,
  KillsByCreature,
  Player,
  PlayerKills,
  PlayerListItem,
  PlayerRef,
  PlayerStructures,
  Position,
  Session
} from '$lib/api/types';
import type { Database } from '../db/client';
import {
  biomeVisits,
  bossKills,
  characters,
  deaths,
  kills,
  playerAliases,
  players,
  positions,
  raids,
  sessions,
  structureEvents,
  structuresDaily,
  type PlayerRow
} from '../db/schema';
import { iso, notFound, round } from '../http/respond';
import { biomeName, bossName, bossTier, creatureName, raidLabel } from '../names';
import { toPlayerRef } from './activity';
import { siteFeatures } from '../settings';

export const playerSorts = [
  'playtime',
  'last_seen',
  'deaths',
  'kills',
  'name',
  'first_seen'
] as const;
export type PlayerSort = (typeof playerSorts)[number];

export interface PlayerListOptions {
  q: string | null;
  sort: PlayerSort;
  order: 'asc' | 'desc';
  online: boolean | null;
  includeHidden: boolean;
  limit: number;
  offset: number;
}

function sortColumn(sort: PlayerSort): SQL {
  switch (sort) {
    case 'playtime':
      return sql`${players.playtimeS}`;
    case 'deaths':
      return sql`${players.deaths}`;
    case 'kills':
      return sql`${players.killsCredited} + ${players.killsNearby}`;
    case 'name':
      return sql`lower(coalesce(${players.displayNameOverride}, ${players.displayName}))`;
    case 'first_seen':
      return sql`${players.firstSeen}`;
    default:
      return sql`${players.lastSeen}`;
  }
}

async function characterNames(db: Database, playerIds: number[]): Promise<Map<number, string[]>> {
  const out = new Map<number, string[]>();
  if (playerIds.length === 0) return out;
  const rows = await db
    .select({ playerId: characters.playerId, name: characters.name })
    .from(characters)
    .where(inArray(characters.playerId, playerIds))
    .orderBy(desc(characters.lastSeen));
  for (const row of rows) {
    const list = out.get(row.playerId) ?? [];
    if (!list.includes(row.name)) list.push(row.name);
    out.set(row.playerId, list);
  }
  return out;
}

export function listItem(row: PlayerRow, names: string[], platformIds = true): PlayerListItem {
  return {
    id: row.id,
    display_name: row.displayNameOverride ?? row.displayName,
    platform: row.platform as PlayerListItem['platform'],
    platform_user_id: platformIds ? row.platformUserId : null,
    display_id: row.displayId,
    online: row.online,
    current_biome: row.online ? biomeName(row.lastBiome) : null,
    first_seen: row.firstSeen.toISOString(),
    last_seen: row.lastSeen.toISOString(),
    playtime_s: Math.round(row.playtimeS),
    sessions: row.sessions,
    deaths: row.deaths,
    kills: row.killsCredited + row.killsNearby,
    boss_kills: row.bossKills,
    structures_built: row.structuresBuilt,
    distance_m: Math.round(row.distanceM),
    characters: names.length > 0 ? names : row.lastCharacterName ? [row.lastCharacterName] : []
  };
}

export async function listPlayers(db: Database, options: PlayerListOptions) {
  const features = await siteFeatures(db);
  const conditions: SQL[] = [];
  if (!options.includeHidden) conditions.push(eq(players.hidden, false));
  if (options.online !== null) conditions.push(eq(players.online, options.online));
  if (options.q) {
    const pattern = `%${options.q.replace(/[%_\\]/g, (match) => `\\${match}`)}%`;
    const matches = db
      .select({ playerId: characters.playerId })
      .from(characters)
      .where(ilike(characters.name, pattern));
    conditions.push(
      or(
        ilike(players.displayName, pattern),
        ilike(players.displayNameOverride, pattern),
        ...(features.platform_ids ? [ilike(players.platformUserId, pattern)] : []),
        ilike(players.displayId, pattern),
        inArray(players.id, matches)
      )!
    );
  }
  const direction = options.order === 'asc' ? asc : desc;
  const rows = await db
    .select()
    .from(players)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(direction(sortColumn(options.sort)), asc(players.id))
    .limit(options.limit + 1)
    .offset(options.offset);
  const page = rows.slice(0, options.limit);
  const names = await characterNames(
    db,
    page.map((row) => row.id)
  );
  return {
    rows: page,
    items: page.map((row) => listItem(row, names.get(row.id) ?? [], features.platform_ids)),
    hasMore: rows.length > options.limit
  };
}

export async function playerRow(
  db: Database,
  id: number,
  includeHidden = false
): Promise<PlayerRow> {
  const rows = await db.select().from(players).where(eq(players.id, id)).limit(1);
  const row = rows[0];
  if (!row || (!includeHidden && row.hidden)) throw notFound(`player ${id} does not exist`);
  return row;
}

export async function aliasesOf(db: Database, id: number): Promise<string[]> {
  const rows = await db
    .select({ platformUserId: playerAliases.platformUserId })
    .from(playerAliases)
    .where(eq(playerAliases.playerId, id))
    .orderBy(playerAliases.mergedAt);
  return rows.map((row) => row.platformUserId);
}

export async function adminItem(db: Database, row: PlayerRow): Promise<AdminPlayer> {
  const names = await characterNames(db, [row.id]);
  return {
    ...listItem(row, names.get(row.id) ?? []),
    platform_user_id: row.platformUserId,
    hidden: row.hidden,
    display_name_override: row.displayNameOverride,
    aliases: await aliasesOf(db, row.id)
  };
}

function mergeByCreatureName(
  rows: { creature: string; credited: number; nearby: number }[]
): KillsByCreature[] {
  const merged = new Map<string, { creature: string; credited: number; nearby: number }>();
  for (const row of rows) {
    const creature = creatureName(row.creature);
    const entry = merged.get(creature) ?? { creature, credited: 0, nearby: 0 };
    entry.credited += row.credited;
    entry.nearby += row.nearby;
    merged.set(creature, entry);
  }
  return [...merged.values()].sort(
    (a, b) =>
      b.credited + b.nearby - (a.credited + a.nearby) || a.creature.localeCompare(b.creature)
  );
}

export async function playerRefs(
  db: Database,
  ids: Iterable<number>
): Promise<Map<number, PlayerRef | null>> {
  const unique = [...new Set(ids)];
  const out = new Map<number, PlayerRef | null>();
  if (unique.length === 0) return out;
  const rows = await db
    .select({
      id: players.id,
      displayName: players.displayName,
      displayNameOverride: players.displayNameOverride,
      platform: players.platform,
      hidden: players.hidden
    })
    .from(players)
    .where(inArray(players.id, unique));
  for (const row of rows) out.set(row.id, toPlayerRef(row));
  for (const id of unique) if (!out.has(id)) out.set(id, null);
  return out;
}

export async function playerDetail(db: Database, id: number): Promise<Player> {
  const row = await playerRow(db, id);
  const features = await siteFeatures(db);
  const names = await characterNames(db, [id]);
  const item = listItem(row, names.get(id) ?? [], features.platform_ids);
  const characterRows = await db
    .select()
    .from(characters)
    .where(eq(characters.playerId, id))
    .orderBy(desc(characters.lastSeen));
  const openSession = row.currentSessionId
    ? (await db.select().from(sessions).where(eq(sessions.id, row.currentSessionId)).limit(1))[0]
    : undefined;
  const biomeRows = await db
    .select()
    .from(biomeVisits)
    .where(eq(biomeVisits.playerId, id))
    .orderBy(asc(biomeVisits.firstAt));
  const causeRows = await db
    .select({ hitType: deaths.hitType, count: sql<number>`count(*)::int` })
    .from(deaths)
    .where(eq(deaths.playerId, id))
    .groupBy(deaths.hitType);
  const deathsByCause: Record<string, number> = {};
  for (const cause of causeRows) deathsByCause[cause.hitType ?? 'unknown'] = cause.count;
  const killRows = await db
    .select({
      creature: kills.creature,
      credited: sql<number>`count(*) filter (where ${kills.basis} = 'credited')::int`,
      nearby: sql<number>`count(*) filter (where ${kills.basis} = 'nearby')::int`
    })
    .from(kills)
    .where(eq(kills.playerId, id))
    .groupBy(kills.creature)
    .orderBy(desc(sql`count(*)`));
  const bossRows = await db
    .select()
    .from(bossKills)
    .where(
      or(
        sql`${bossKills.participantPlayerIds} @> ${JSON.stringify([id])}::jsonb`,
        sql`${bossKills.nearbyPlayerIds} @> ${JSON.stringify([id])}::jsonb`
      )
    )
    .orderBy(asc(bossKills.killedAt));
  const raidRows = await db
    .select()
    .from(raids)
    .where(sql`${raids.participantIds} @> ${JSON.stringify([id])}::jsonb`)
    .orderBy(asc(raids.startedAt));
  const raidDeaths =
    raidRows.length > 0
      ? await db
          .select({ diedAt: deaths.diedAt })
          .from(deaths)
          .where(and(eq(deaths.playerId, id), gte(deaths.diedAt, raidRows[0]!.startedAt)))
      : [];
  return {
    ...item,
    characters: characterRows.map((character) => ({
      character_id: character.characterId,
      name: character.name,
      first_seen: character.firstSeen.toISOString(),
      last_seen: character.lastSeen.toISOString()
    })),
    current_session:
      openSession && openSession.leftAt === null
        ? {
            joined_at: openSession.joinedAt.toISOString(),
            character_name: openSession.characterName,
            biome: biomeName(row.lastBiome),
            x: features.positions ? round(row.lastX ?? 0) : null,
            z: features.positions ? round(row.lastZ ?? 0) : null
          }
        : null,
    stats: {
      playtime_s: Math.round(row.playtimeS),
      sessions: row.sessions,
      deaths: row.deaths,
      kills_credited: row.killsCredited,
      kills_nearby: row.killsNearby,
      boss_kills: row.bossKills,
      raids: row.raids,
      structures_built: row.structuresBuilt,
      structures_destroyed: row.structuresDestroyed,
      shouts: row.shouts,
      distance_m: Math.round(row.distanceM)
    },
    biomes: biomeRows.map((visit) => ({
      biome: biomeName(visit.biome),
      first_at: visit.firstAt.toISOString(),
      first_day: visit.firstDay,
      visits: visit.count,
      last_at: visit.lastAt.toISOString()
    })),
    deaths_by_cause: deathsByCause,
    kills_by_creature: mergeByCreatureName(killRows),
    boss_participation: bossRows
      .filter((kill) => bossTier(kill.key) === 'forsaken')
      .map((kill) => ({
        key: kill.key,
        name: bossName(kill.key, kill.prefab, kill.nameKey),
        at: kill.killedAt.toISOString(),
        day: kill.worldDay,
        role: kill.participantPlayerIds.includes(id) ? 'credited' : 'nearby'
      })),
    raids: raidRows.map((raid) => {
      const end = raid.endedAt ?? new Date(raid.startedAt.getTime() + raid.plannedDurationS * 1000);
      const died = raidDeaths.some(
        (death) => death.diedAt >= raid.startedAt && death.diedAt <= end
      );
      return {
        id: raid.id,
        name: raid.name,
        label: raidLabel(raid.name),
        at: raid.startedAt.toISOString(),
        day: raid.worldDay,
        survived: !died
      };
    }),
    aliases: await aliasesOf(db, id)
  };
}

export async function playerSessions(db: Database, id: number, limit: number, offset: number) {
  await playerRow(db, id);
  const rows = await db
    .select()
    .from(sessions)
    .where(eq(sessions.playerId, id))
    .orderBy(desc(sessions.joinedAt), desc(sessions.id))
    .limit(limit + 1)
    .offset(offset);
  const items: Session[] = rows.slice(0, limit).map((session) => ({
    id: session.id,
    joined_at: session.joinedAt.toISOString(),
    left_at: iso(session.leftAt),
    duration_s: session.durationS === null ? null : Math.round(session.durationS),
    left_reason: (session.leftReason as Session['left_reason']) ?? null,
    character_name: session.characterName,
    run_id: session.runId
  }));
  return { items, hasMore: rows.length > limit };
}

export async function playerDeaths(db: Database, id: number, limit: number, offset: number) {
  await playerRow(db, id);
  const rows = await db
    .select()
    .from(deaths)
    .where(eq(deaths.playerId, id))
    .orderBy(desc(deaths.diedAt), desc(deaths.id))
    .limit(limit + 1)
    .offset(offset);
  const page = rows.slice(0, limit);
  const refs = await playerRefs(
    db,
    page.flatMap((death) => (death.attackerPlayerId ? [death.attackerPlayerId] : []))
  );
  const items: Death[] = page.map((death) => ({
    id: death.id,
    at: death.diedAt.toISOString(),
    day: death.worldDay,
    biome: biomeName(death.biome),
    x: round(death.x),
    z: round(death.z),
    cause: death.hitType
      ? {
          hit_type: death.hitType as NonNullable<Death['cause']>['hit_type'],
          attacker_prefab: death.attackerPrefab,
          attacker: death.attackerPlayerId ? (refs.get(death.attackerPlayerId) ?? null) : null
        }
      : null
  }));
  return { items, hasMore: rows.length > limit };
}

export async function playerKills(db: Database, id: number): Promise<PlayerKills> {
  const row = await playerRow(db, id);
  const byCreature = await db
    .select({
      creature: kills.creature,
      credited: sql<number>`count(*) filter (where ${kills.basis} = 'credited')::int`,
      nearby: sql<number>`count(*) filter (where ${kills.basis} = 'nearby')::int`
    })
    .from(kills)
    .where(eq(kills.playerId, id))
    .groupBy(kills.creature)
    .orderBy(desc(sql`count(*)`));
  const recent = await db
    .select()
    .from(kills)
    .where(eq(kills.playerId, id))
    .orderBy(desc(kills.at), desc(kills.id))
    .limit(50);
  return {
    credited: row.killsCredited,
    nearby: row.killsNearby,
    by_creature: mergeByCreatureName(byCreature),
    recent: recent.map((kill) => ({
      at: kill.at.toISOString(),
      creature: creatureName(kill.creature),
      level: Math.max(1, kill.level),
      boss: kill.boss,
      basis: kill.basis as 'credited' | 'nearby'
    }))
  };
}

const positionRanges = {
  '1h': 3600,
  '6h': 6 * 3600,
  '24h': 24 * 3600,
  '7d': 7 * 24 * 3600
} as const;

export async function playerPositions(
  db: Database,
  id: number,
  range: keyof typeof positionRanges,
  limit: number,
  now = new Date()
): Promise<Position[]> {
  await playerRow(db, id);
  const since = new Date(now.getTime() - positionRanges[range] * 1000);
  const rows = await db
    .select()
    .from(positions)
    .where(and(eq(positions.playerId, id), gte(positions.ts, since)))
    .orderBy(asc(positions.ts));
  const sampled: typeof rows = [];
  if (rows.length <= limit) sampled.push(...rows);
  else {
    const stride = rows.length / limit;
    for (let i = 0; i < limit; i++) sampled.push(rows[Math.floor(i * stride)]!);
  }
  return sampled.map((position) => ({
    ts: position.ts.toISOString(),
    x: round(position.x),
    z: round(position.z),
    biome: biomeName(position.biome)
  }));
}

export async function playerStructures(db: Database, id: number): Promise<PlayerStructures> {
  const row = await playerRow(db, id);
  const byPrefab = await db
    .select({
      prefab: structuresDaily.prefab,
      built: sql<number>`sum(${structuresDaily.built})::int`
    })
    .from(structuresDaily)
    .where(eq(structuresDaily.builderPlayerId, id))
    .groupBy(structuresDaily.prefab)
    .orderBy(desc(sql`sum(${structuresDaily.built})`), asc(structuresDaily.prefab))
    .limit(50);
  const recent = await db
    .select()
    .from(structureEvents)
    .where(and(eq(structureEvents.playerId, id), eq(structureEvents.kind, 'built')))
    .orderBy(desc(structureEvents.at), desc(structureEvents.id))
    .limit(50);
  return {
    built: row.structuresBuilt,
    destroyed: row.structuresDestroyed,
    by_prefab: byPrefab
      .filter((entry) => entry.built > 0)
      .map((entry) => ({ prefab: entry.prefab, built: entry.built })),
    recent: recent.map((entry) => ({
      at: entry.at.toISOString(),
      prefab: entry.prefab,
      x: round(entry.x),
      z: round(entry.z),
      biome: biomeName(entry.biome)
    }))
  };
}

export async function openSessionFor(db: Database, playerId: number) {
  const rows = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.playerId, playerId), isNull(sessions.leftAt)))
    .orderBy(desc(sessions.joinedAt))
    .limit(1);
  return rows[0] ?? null;
}
