import { and, asc, desc, eq, exists, gt, gte, inArray, lt, or, sql } from 'drizzle-orm';
import type { ActivityItem, EventType, PlayerRef } from '$lib/api/types';
import type { Database } from '../db/client';
import {
  biomeVisits,
  bossEvents,
  eventPlayers,
  events,
  playerAliases,
  players,
  raids,
  sessions,
  type EventRow
} from '../db/schema';
import { bossName, creatureName, raidLabel } from '../names';
import { phaseOfPrefab } from '$lib/world/bosses';

export const feedDefaultExclusions: readonly EventType[] = [
  'server.heartbeat',
  'player.position',
  'structure.built',
  'structure.destroyed',
  'creature.died'
];

export const allEventTypes: readonly EventType[] = [
  'server.started',
  'server.stopping',
  'server.heartbeat',
  'server.lost',
  'world.save_started',
  'world.saved',
  'world.rollback_detected',
  'world.dusk_approaching',
  'world.dawn_approaching',
  'player.joined',
  'player.spawned',
  'player.died',
  'player.left',
  'player.biome_changed',
  'player.position',
  'boss.summoned',
  'boss.engaged',
  'boss.defeated',
  'global_key.set',
  'raid.started',
  'raid.ended',
  'structure.built',
  'structure.destroyed',
  'creature.died',
  'chat.message',
  'announcement.shown'
];

export function feedTypes(requested: readonly EventType[] | null): EventType[] {
  if (requested && requested.length > 0) return [...requested];
  return allEventTypes.filter((type) => !feedDefaultExclusions.includes(type));
}

export function feedIncludes(type: EventType, requested: readonly EventType[] | null): boolean {
  return feedTypes(requested).includes(type);
}

type Data = Record<string, unknown>;

export interface PlayerRefSource {
  id: number;
  displayName: string;
  displayNameOverride: string | null;
  platform: string;
  hidden: boolean;
}

export function toPlayerRef(row: PlayerRefSource | null | undefined): PlayerRef | null {
  if (!row || row.hidden) return null;
  return {
    id: row.id,
    display_name: row.displayNameOverride ?? row.displayName,
    platform: row.platform as PlayerRef['platform']
  };
}

function collectPlatformIds(data: Data, into: Set<string>) {
  for (const field of [
    'platform_user_id',
    'sender_platform_user_id',
    'summoner_platform_user_id',
    'creator_platform_user_id'
  ]) {
    const value = data[field];
    if (typeof value === 'string' && value !== '') into.add(value);
  }
  for (const field of ['nearby', 'credited', 'participants']) {
    const value = data[field];
    if (Array.isArray(value)) for (const id of value) if (typeof id === 'string') into.add(id);
  }
  const cause = data.observed_cause;
  if (cause && typeof cause === 'object') {
    const attacker = (cause as Data).attacker_platform_user_id;
    if (typeof attacker === 'string' && attacker !== '') into.add(attacker);
  }
}

export interface ActivityLookup {
  refs: Map<string, PlayerRef | null>;
  sessionByEvent: Map<string, number>;
  raidByEvent: Map<string, number>;
  bossKeyByEvent: Map<string, string>;
  firstDiscoveries: Set<string>;
}

export async function loadPlayerRefs(
  db: Database,
  platformIds: Iterable<string>
): Promise<Map<string, PlayerRef | null>> {
  const ids = [...new Set(platformIds)];
  const refs = new Map<string, PlayerRef | null>();
  if (ids.length === 0) return refs;
  const aliasRows = await db
    .select({ platformUserId: playerAliases.platformUserId, playerId: playerAliases.playerId })
    .from(playerAliases)
    .where(inArray(playerAliases.platformUserId, ids));
  const aliasTargets = aliasRows.map((row) => row.playerId);
  const rows = await db
    .select({
      id: players.id,
      platformUserId: players.platformUserId,
      displayName: players.displayName,
      displayNameOverride: players.displayNameOverride,
      platform: players.platform,
      hidden: players.hidden
    })
    .from(players)
    .where(
      aliasTargets.length > 0
        ? or(inArray(players.platformUserId, ids), inArray(players.id, aliasTargets))
        : inArray(players.platformUserId, ids)
    );
  const byId = new Map(rows.map((row) => [row.id, row]));
  for (const row of rows) refs.set(row.platformUserId, toPlayerRef(row));
  for (const alias of aliasRows)
    refs.set(alias.platformUserId, toPlayerRef(byId.get(alias.playerId)));
  for (const id of ids) if (!refs.has(id)) refs.set(id, null);
  return refs;
}

export async function buildLookup(db: Database, rows: EventRow[]): Promise<ActivityLookup> {
  const platformIds = new Set<string>();
  for (const row of rows) collectPlatformIds(row.data as Data, platformIds);
  const refs = await loadPlayerRefs(db, platformIds);
  const ids = rows.map((row) => row.id);
  const sessionByEvent = new Map<string, number>();
  const raidByEvent = new Map<string, number>();
  const bossKeyByEvent = new Map<string, string>();
  const firstDiscoveries = new Set<string>();
  if (ids.length === 0)
    return { refs, sessionByEvent, raidByEvent, bossKeyByEvent, firstDiscoveries };
  const sessionRows = await db
    .select({
      id: sessions.id,
      joinEventId: sessions.joinEventId,
      leftEventId: sessions.leftEventId
    })
    .from(sessions)
    .where(or(inArray(sessions.joinEventId, ids), inArray(sessions.leftEventId, ids)));
  for (const row of sessionRows) {
    if (row.joinEventId) sessionByEvent.set(row.joinEventId, row.id);
    if (row.leftEventId) sessionByEvent.set(row.leftEventId, row.id);
  }
  const raidRows = await db
    .select({ id: raids.id, startEventId: raids.startEventId, endEventId: raids.endEventId })
    .from(raids)
    .where(or(inArray(raids.startEventId, ids), inArray(raids.endEventId, ids)));
  for (const row of raidRows) {
    raidByEvent.set(row.startEventId, row.id);
    if (row.endEventId) raidByEvent.set(row.endEventId, row.id);
  }
  const resumedRows = await db
    .select({ id: raids.id, resumeEventIds: raids.resumeEventIds })
    .from(raids)
    .where(sql`jsonb_array_length(${raids.resumeEventIds}) > 0`);
  const wanted = new Set(ids);
  for (const row of resumedRows) {
    for (const eventId of row.resumeEventIds) {
      if (wanted.has(eventId)) raidByEvent.set(eventId, row.id);
    }
  }
  const bossRows = await db
    .select({ eventId: bossEvents.eventId, key: bossEvents.key })
    .from(bossEvents)
    .where(inArray(bossEvents.eventId, ids));
  for (const row of bossRows) bossKeyByEvent.set(row.eventId, row.key);
  const biomeRows = rows.filter(
    (row) => row.type === 'player.biome_changed' && row.playerId !== null
  );
  if (biomeRows.length > 0) {
    const playerIds = [...new Set(biomeRows.map((row) => row.playerId as number))];
    const visits = await db
      .select({
        playerId: biomeVisits.playerId,
        biome: biomeVisits.biome,
        firstAt: biomeVisits.firstAt
      })
      .from(biomeVisits)
      .where(inArray(biomeVisits.playerId, playerIds));
    const firstAt = new Map(
      visits.map((visit) => [`${visit.playerId}:${visit.biome}`, visit.firstAt.getTime()])
    );
    for (const row of biomeRows) {
      const to = (row.data as Data).to;
      const key = `${row.playerId}:${String(to)}`;
      if (firstAt.get(key) === row.ts.getTime()) firstDiscoveries.add(row.id);
    }
  }
  return { refs, sessionByEvent, raidByEvent, bossKeyByEvent, firstDiscoveries };
}

function ref(lookup: ActivityLookup, value: unknown): PlayerRef | null {
  return typeof value === 'string' ? (lookup.refs.get(value) ?? null) : null;
}

function refList(lookup: ActivityLookup, value: unknown): (PlayerRef | null)[] {
  return Array.isArray(value) ? value.map((entry) => ref(lookup, entry)) : [];
}

function pick(data: Data, fields: string[]): Data {
  const out: Data = {};
  for (const field of fields) if (field in data) out[field] = data[field];
  return out;
}

function causeLabel(cause: Data | null, attacker: PlayerRef | null): string | null {
  if (!cause) return null;
  const hitType = String(cause.hit_type ?? 'Undefined');
  const prefab = typeof cause.attacker_prefab === 'string' ? cause.attacker_prefab : null;
  if (hitType === 'EnemyHit' && prefab) return creatureName(prefab);
  if (hitType === 'PlayerHit') return attacker ? attacker.display_name : 'another player';
  if (prefab) return creatureName(prefab);
  return hitType;
}

export function summarize(
  row: EventRow,
  lookup: ActivityLookup
): {
  player: PlayerRef | null;
  summary: Data;
  links: ActivityItem['links'];
} {
  const data = (row.data ?? {}) as Data;
  const links: ActivityItem['links'] = {
    raid_id: null,
    boss_key: null,
    run_id: null,
    session_id: null
  };
  let player: PlayerRef | null = null;
  let summary: Data;
  switch (row.type) {
    case 'server.started':
    case 'server.stopping':
    case 'server.heartbeat':
    case 'server.lost':
      summary = { ...data };
      links.run_id = row.runId;
      break;
    case 'player.joined':
      player = ref(lookup, data.platform_user_id);
      summary = pick(data, ['display_id', 'platform', 'name', 'peer_uid', 'playfab_id']);
      links.session_id = lookup.sessionByEvent.get(row.id) ?? null;
      break;
    case 'player.left':
      player = ref(lookup, data.platform_user_id);
      summary = pick(data, ['name', 'session_s', 'reason']);
      links.session_id = lookup.sessionByEvent.get(row.id) ?? null;
      break;
    case 'player.spawned':
      player = ref(lookup, data.platform_user_id);
      summary = pick(data, ['name', 'character_id', 'respawn', 'x', 'z', 'biome']);
      break;
    case 'player.died': {
      player = ref(lookup, data.platform_user_id);
      const cause =
        data.observed_cause && typeof data.observed_cause === 'object'
          ? (data.observed_cause as Data)
          : null;
      const attacker = cause ? ref(lookup, cause.attacker_platform_user_id) : null;
      summary = {
        ...pick(data, ['name', 'character_id', 'x', 'z', 'biome']),
        observed_cause: cause
          ? {
              hit_type: cause.hit_type,
              attacker_prefab: cause.attacker_prefab ?? null,
              attacker,
              at: cause.at
            }
          : null,
        cause: causeLabel(cause, attacker),
        attacker
      };
      break;
    }
    case 'player.biome_changed':
      player = ref(lookup, data.platform_user_id);
      summary = {
        ...pick(data, ['from', 'to', 'x', 'z']),
        first_discovery: lookup.firstDiscoveries.has(row.id)
      };
      break;
    case 'player.position':
      player = ref(lookup, data.platform_user_id);
      summary = pick(data, ['x', 'z', 'biome']);
      break;
    case 'boss.summoned': {
      const key = lookup.bossKeyByEvent.get(row.id) ?? null;
      player = ref(lookup, data.summoner_platform_user_id);
      summary = {
        ...pick(data, ['prefab', 'name_key', 'x', 'z', 'biome', 'method']),
        summoner: player,
        boss_name: bossName(key ?? '', String(data.prefab ?? ''), String(data.name_key ?? '')),
        phase: phaseOfPrefab(String(data.prefab ?? ''))
      };
      links.boss_key = key;
      break;
    }
    case 'boss.engaged': {
      const key = lookup.bossKeyByEvent.get(row.id) ?? null;
      summary = {
        ...pick(data, ['prefab', 'name_key', 'x', 'z', 'biome', 'alert_message']),
        nearby: refList(lookup, data.nearby),
        boss_name: bossName(key ?? '', String(data.prefab ?? ''), String(data.name_key ?? '')),
        phase: phaseOfPrefab(String(data.prefab ?? ''))
      };
      links.boss_key = key;
      break;
    }
    case 'boss.defeated': {
      const participants = refList(lookup, data.participants);
      const sender = ref(lookup, data.sender_platform_user_id);
      const nearby = refList(lookup, data.nearby);
      player =
        participants.find((entry) => entry !== null) ??
        sender ??
        nearby.find((entry) => entry !== null) ??
        null;
      summary = {
        ...pick(data, ['key', 'first_time', 'prefab', 'name_key']),
        nearby,
        participants,
        sender,
        boss_name: bossName(
          String(data.key ?? ''),
          typeof data.prefab === 'string' ? data.prefab : null,
          typeof data.name_key === 'string' ? data.name_key : null
        ),
        phase: typeof data.prefab === 'string' ? phaseOfPrefab(data.prefab) : null
      };
      links.boss_key = lookup.bossKeyByEvent.get(row.id) ?? String(data.key ?? '');
      break;
    }
    case 'global_key.set': {
      summary = pick(data, ['key', 'value', 'first_time', 'prefab', 'name_key']);
      const key = lookup.bossKeyByEvent.get(row.id) ?? null;
      if (key) {
        const nearby = refList(lookup, data.nearby);
        const sender = ref(lookup, data.sender_platform_user_id);
        player = sender ?? nearby.find((entry) => entry !== null) ?? null;
        summary = {
          ...summary,
          nearby,
          sender,
          boss_name: bossName(
            key,
            typeof data.prefab === 'string' ? data.prefab : null,
            typeof data.name_key === 'string' ? data.name_key : null
          )
        };
        links.boss_key = key;
      }
      break;
    }
    case 'raid.started':
      summary = {
        ...pick(data, ['name', 'x', 'z', 'biome', 'duration_s']),
        nearby: refList(lookup, data.nearby),
        raid_label: raidLabel(String(data.name ?? ''))
      };
      links.raid_id = lookup.raidByEvent.get(row.id) ?? null;
      break;
    case 'raid.ended':
      summary = {
        ...pick(data, ['name', 'elapsed_s', 'active_s']),
        raid_label: raidLabel(String(data.name ?? ''))
      };
      links.raid_id = lookup.raidByEvent.get(row.id) ?? null;
      break;
    case 'structure.built':
      player = ref(lookup, data.creator_platform_user_id);
      summary = {
        ...pick(data, ['prefab', 'x', 'z', 'biome', 'creator_character_id']),
        creator: player
      };
      break;
    case 'structure.destroyed':
      summary = pick(data, ['prefab', 'x', 'z', 'biome', 'creator_character_id']);
      break;
    case 'creature.died': {
      const credited = refList(lookup, data.credited);
      const nearby = refList(lookup, data.nearby);
      player =
        credited.find((entry) => entry !== null) ?? nearby.find((entry) => entry !== null) ?? null;
      summary = {
        ...pick(data, ['prefab', 'level', 'x', 'z', 'biome']),
        credited,
        nearby,
        creature: creatureName(String(data.prefab ?? ''))
      };
      break;
    }
    case 'chat.message':
      player = ref(lookup, data.platform_user_id);
      summary = pick(data, ['kind', 'text', 'x', 'z', 'biome']);
      break;
    case 'announcement.shown':
      summary = pick(data, ['announcement_id', 'kind', 'text', 'remaining_s', 'final']);
      break;
    default:
      summary = { ...data };
  }
  return { player, summary, links };
}

export function toActivityItem(row: EventRow, lookup: ActivityLookup): ActivityItem {
  const { player, summary, links } = summarize(row, lookup);
  return {
    id: row.id,
    at: row.ts.toISOString(),
    day: row.worldDay,
    type: row.type as EventType,
    player,
    summary,
    links
  };
}

export async function buildActivityItems(db: Database, rows: EventRow[]): Promise<ActivityItem[]> {
  const lookup = await buildLookup(db, rows);
  return rows.map((row) => toActivityItem(row, lookup));
}

export function parseTypes(raw: string | null): EventType[] | null {
  if (raw === null || raw.trim() === '') return null;
  const parts = raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '');
  const invalid = parts.filter((part) => !(allEventTypes as readonly string[]).includes(part));
  if (invalid.length > 0) throw new Error(`unknown event type ${invalid[0]}`);
  return parts as EventType[];
}

export interface ActivityQueryOptions {
  types: EventType[] | null;
  playerId: number | null;
  since: Date | null;
  until: Date | null;
  limit: number;
  offset: number;
}

export async function queryActivity(
  db: Database,
  options: ActivityQueryOptions
): Promise<{ rows: EventRow[]; hasMore: boolean }> {
  const types = feedTypes(options.types);
  const conditions = [inArray(events.type, types)];
  if (options.since) conditions.push(gte(events.ts, options.since));
  if (options.until) conditions.push(lt(events.ts, options.until));
  if (options.playerId !== null) {
    conditions.push(
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
  const rows = await db
    .select()
    .from(events)
    .where(and(...conditions))
    .orderBy(desc(events.ts), desc(events.seq))
    .limit(options.limit + 1)
    .offset(options.offset);
  return { rows: rows.slice(0, options.limit), hasMore: rows.length > options.limit };
}

export async function eventsAfter(
  db: Database,
  lastEventId: string,
  limit: number
): Promise<EventRow[]> {
  const anchor = await db.select().from(events).where(eq(events.id, lastEventId)).limit(1);
  const row = anchor[0];
  if (!row) return [];
  const types = feedTypes(null);
  const rows = await db
    .select()
    .from(events)
    .where(
      and(
        inArray(events.type, types),
        or(gt(events.ts, row.ts), and(eq(events.ts, row.ts), gt(events.seq, row.seq)))
      )
    )
    .orderBy(asc(events.ts), asc(events.seq))
    .limit(limit);
  return rows;
}
