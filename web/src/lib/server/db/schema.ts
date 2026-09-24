import {
  bigint,
  boolean,
  customType,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from 'drizzle-orm/pg-core';
import type { ComfortCatalogueUpload, ZoneResult } from '$lib/api/types';

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => 'bytea'
});

const utc = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

export const meta = pgTable('meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: utc('updated_at').notNull().defaultNow()
});

export const events = pgTable(
  'events',
  {
    id: uuid('id').primaryKey(),
    runId: uuid('run_id').notNull(),
    seq: integer('seq').notNull(),
    type: text('type').notNull(),
    ts: utc('ts').notNull(),
    receivedAt: utc('received_at').notNull().defaultNow(),
    worldDay: integer('world_day').notNull(),
    data: jsonb('data').notNull(),
    playerId: integer('player_id')
  },
  (table) => [
    index('events_ts_seq_idx').on(table.ts, table.seq),
    index('events_type_ts_idx').on(table.type, table.ts),
    index('events_run_seq_idx').on(table.runId, table.seq),
    index('events_player_ts_idx').on(table.playerId, table.ts)
  ]
);

export const eventPlayers = pgTable(
  'event_players',
  {
    eventId: uuid('event_id').notNull(),
    playerId: integer('player_id').notNull(),
    ts: utc('ts').notNull()
  },
  (table) => [
    primaryKey({ columns: [table.eventId, table.playerId] }),
    index('event_players_player_ts_idx').on(table.playerId, table.ts)
  ]
);

export const heartbeats = pgTable(
  'heartbeats',
  {
    id: uuid('id').primaryKey(),
    runId: uuid('run_id').notNull(),
    seq: integer('seq').notNull(),
    ts: utc('ts').notNull(),
    receivedAt: utc('received_at').notNull().defaultNow(),
    worldDay: integer('world_day').notNull(),
    data: jsonb('data').notNull()
  },
  (table) => [index('heartbeats_ts_idx').on(table.ts)]
);

export const serverRuns = pgTable(
  'server_runs',
  {
    runId: uuid('run_id').primaryKey(),
    startedAt: utc('started_at').notNull(),
    stoppedAt: utc('stopped_at'),
    stopReason: text('stop_reason'),
    gameVersion: text('game_version'),
    networkVersion: integer('network_version'),
    pluginVersion: text('plugin_version'),
    bepinexVersion: text('bepinex_version'),
    unityVersion: text('unity_version'),
    worldName: text('world_name'),
    worldUid: bigint('world_uid', { mode: 'number' }),
    lastHeartbeatAt: utc('last_heartbeat_at'),
    lastHeartbeatReceivedAt: utc('last_heartbeat_received_at'),
    lastNetTime: doublePrecision('last_net_time'),
    lastWorldDay: integer('last_world_day'),
    lastSeq: integer('last_seq').notNull().default(0),
    peakPlayers: integer('peak_players').notNull().default(0),
    saves: integer('saves').notNull().default(0),
    missingHooks: jsonb('missing_hooks').$type<string[]>().notNull().default([]),
    queueDepth: integer('queue_depth'),
    droppedEvents: integer('dropped_events'),
    uptimeS: doublePrecision('uptime_s'),
    lastSaveAgeS: doublePrecision('last_save_age_s')
  },
  (table) => [index('server_runs_started_idx').on(table.startedAt)]
);

export const serverStatus = pgTable('server_status', {
  id: integer('id').primaryKey(),
  online: boolean('online').notNull().default(false),
  playerCount: integer('player_count').notNull().default(0),
  maxPlayers: integer('max_players').notNull().default(10),
  source: text('source').notNull().default('none'),
  gameVersion: text('game_version'),
  networkVersion: integer('network_version'),
  serverName: text('server_name'),
  worldName: text('world_name'),
  worldUid: bigint('world_uid', { mode: 'number' }),
  worldDay: integer('world_day'),
  netTime: doublePrecision('net_time'),
  netTimeAt: utc('net_time_at'),
  lastSaveAt: utc('last_save_at'),
  lastSaveDurationMs: integer('last_save_duration_ms'),
  lastPluginAt: utc('last_plugin_at'),
  telemetryDelayedSince: utc('telemetry_delayed_since'),
  a2sOnline: boolean('a2s_online'),
  a2sPlayerCount: integer('a2s_player_count'),
  a2sMaxPlayers: integer('a2s_max_players'),
  a2sGameVersion: text('a2s_game_version'),
  a2sNetworkVersion: integer('a2s_network_version'),
  a2sServerName: text('a2s_server_name'),
  a2sLastOkAt: utc('a2s_last_ok_at'),
  a2sLastError: text('a2s_last_error'),
  a2sCheckedAt: utc('a2s_checked_at'),
  updatedAt: utc('updated_at').notNull().defaultNow()
});

export const statusSamples = pgTable('status_samples', {
  ts: utc('ts').primaryKey(),
  online: boolean('online').notNull(),
  playerCount: integer('player_count').notNull(),
  source: text('source').notNull()
});

export const players = pgTable(
  'players',
  {
    id: serial('id').primaryKey(),
    platformUserId: text('platform_user_id').notNull(),
    displayId: text('display_id').notNull(),
    platform: text('platform').notNull(),
    displayName: text('display_name').notNull(),
    displayNameOverride: text('display_name_override'),
    hidden: boolean('hidden').notNull().default(false),
    firstSeen: utc('first_seen').notNull(),
    lastSeen: utc('last_seen').notNull(),
    playtimeS: doublePrecision('playtime_s').notNull().default(0),
    sessions: integer('sessions').notNull().default(0),
    deaths: integer('deaths').notNull().default(0),
    killsCredited: integer('kills_credited').notNull().default(0),
    killsNearby: integer('kills_nearby').notNull().default(0),
    bossKills: integer('boss_kills').notNull().default(0),
    raids: integer('raids').notNull().default(0),
    structuresBuilt: integer('structures_built').notNull().default(0),
    structuresDestroyed: integer('structures_destroyed').notNull().default(0),
    shouts: integer('shouts').notNull().default(0),
    distanceM: doublePrecision('distance_m').notNull().default(0),
    online: boolean('online').notNull().default(false),
    currentSessionId: integer('current_session_id'),
    lastBiome: text('last_biome'),
    lastX: doublePrecision('last_x'),
    lastZ: doublePrecision('last_z'),
    lastPositionAt: utc('last_position_at'),
    lastCharacterName: text('last_character_name')
  },
  (table) => [
    uniqueIndex('players_platform_user_id_idx').on(table.platformUserId),
    index('players_last_seen_idx').on(table.lastSeen)
  ]
);

export const playerAliases = pgTable('player_aliases', {
  platformUserId: text('platform_user_id').primaryKey(),
  playerId: integer('player_id').notNull(),
  displayId: text('display_id').notNull(),
  platform: text('platform').notNull(),
  mergedAt: utc('merged_at').notNull().defaultNow()
});

export const characters = pgTable(
  'characters',
  {
    id: serial('id').primaryKey(),
    playerId: integer('player_id').notNull(),
    characterId: bigint('character_id', { mode: 'number' }).notNull(),
    name: text('name').notNull(),
    firstSeen: utc('first_seen').notNull(),
    lastSeen: utc('last_seen').notNull()
  },
  (table) => [uniqueIndex('characters_player_character_idx').on(table.playerId, table.characterId)]
);

export const sessions = pgTable(
  'sessions',
  {
    id: serial('id').primaryKey(),
    playerId: integer('player_id').notNull(),
    characterId: bigint('character_id', { mode: 'number' }),
    characterName: text('character_name').notNull(),
    runId: uuid('run_id').notNull(),
    peerUid: bigint('peer_uid', { mode: 'number' }).notNull(),
    joinedAt: utc('joined_at').notNull(),
    leftAt: utc('left_at'),
    durationS: doublePrecision('duration_s'),
    leftReason: text('left_reason'),
    joinEventId: uuid('join_event_id'),
    leftEventId: uuid('left_event_id')
  },
  (table) => [
    uniqueIndex('sessions_run_peer_joined_idx').on(table.runId, table.peerUid, table.joinedAt),
    index('sessions_player_joined_idx').on(table.playerId, table.joinedAt),
    index('sessions_open_idx').on(table.runId, table.leftAt)
  ]
);

export const deaths = pgTable(
  'deaths',
  {
    id: serial('id').primaryKey(),
    eventId: uuid('event_id').notNull(),
    playerId: integer('player_id').notNull(),
    characterId: bigint('character_id', { mode: 'number' }),
    diedAt: utc('died_at').notNull(),
    worldDay: integer('world_day').notNull(),
    biome: text('biome').notNull(),
    x: doublePrecision('x').notNull(),
    z: doublePrecision('z').notNull(),
    hitType: text('hit_type'),
    attackerPrefab: text('attacker_prefab'),
    attackerPlayerId: integer('attacker_player_id')
  },
  (table) => [
    uniqueIndex('deaths_event_idx').on(table.eventId),
    index('deaths_player_at_idx').on(table.playerId, table.diedAt),
    index('deaths_at_idx').on(table.diedAt)
  ]
);

export const bossKills = pgTable(
  'boss_kills',
  {
    id: serial('id').primaryKey(),
    eventId: uuid('event_id').notNull(),
    key: text('key').notNull(),
    killedAt: utc('killed_at').notNull(),
    worldDay: integer('world_day').notNull(),
    firstTime: boolean('first_time').notNull(),
    senderPlayerId: integer('sender_player_id'),
    nearbyPlayerIds: jsonb('nearby_player_ids').$type<number[]>().notNull().default([]),
    participantPlayerIds: jsonb('participant_player_ids').$type<number[]>().notNull().default([]),
    prefab: text('prefab'),
    nameKey: text('name_key')
  },
  (table) => [
    uniqueIndex('boss_kills_event_idx').on(table.eventId),
    index('boss_kills_key_at_idx').on(table.key, table.killedAt)
  ]
);

export const bossEvents = pgTable(
  'boss_events',
  {
    id: serial('id').primaryKey(),
    eventId: uuid('event_id').notNull(),
    kind: text('kind').notNull(),
    key: text('key').notNull(),
    prefab: text('prefab'),
    nameKey: text('name_key'),
    at: utc('at').notNull(),
    worldDay: integer('world_day').notNull(),
    x: doublePrecision('x'),
    z: doublePrecision('z'),
    biome: text('biome'),
    nearbyPlayerIds: jsonb('nearby_player_ids').$type<number[]>().notNull().default([]),
    participantPlayerIds: jsonb('participant_player_ids').$type<number[]>().notNull().default([]),
    summonerPlayerId: integer('summoner_player_id'),
    firstTime: boolean('first_time'),
    alertMessage: text('alert_message'),
    method: text('method')
  },
  (table) => [
    uniqueIndex('boss_events_event_idx').on(table.eventId),
    index('boss_events_key_at_idx').on(table.key, table.at)
  ]
);

export const bossPrefabs = pgTable('boss_prefabs', {
  prefab: text('prefab').primaryKey(),
  key: text('key').notNull(),
  nameKey: text('name_key')
});

export const bossState = pgTable('boss_state', {
  key: text('key').primaryKey(),
  active: boolean('active').notNull().default(false),
  engagedAt: utc('engaged_at')
});

export const globalKeys = pgTable('global_keys', {
  key: text('key').primaryKey(),
  value: text('value'),
  firstSetAt: utc('first_set_at').notNull(),
  worldDay: integer('world_day').notNull(),
  eventId: uuid('event_id').notNull()
});

export type RaidEndReason = 'ended' | 'server_stop' | 'server_lost';

export const raids = pgTable(
  'raids',
  {
    id: serial('id').primaryKey(),
    startEventId: uuid('start_event_id').notNull(),
    endEventId: uuid('end_event_id'),
    runId: uuid('run_id').notNull(),
    name: text('name').notNull(),
    startedAt: utc('started_at').notNull(),
    endedAt: utc('ended_at'),
    worldDay: integer('world_day').notNull(),
    biome: text('biome').notNull(),
    x: doublePrecision('x').notNull(),
    z: doublePrecision('z').notNull(),
    plannedDurationS: doublePrecision('planned_duration_s').notNull(),
    participantIds: jsonb('participant_ids').$type<number[]>().notNull().default([]),
    endReason: text('end_reason').$type<RaidEndReason>(),
    restored: boolean('restored').notNull().default(false),
    resumeEventIds: jsonb('resume_event_ids').$type<string[]>().notNull().default([]),
    activeS: doublePrecision('active_s')
  },
  (table) => [
    uniqueIndex('raids_start_event_idx').on(table.startEventId),
    index('raids_started_idx').on(table.startedAt)
  ]
);

export const biomeVisits = pgTable(
  'biome_visits',
  {
    playerId: integer('player_id').notNull(),
    biome: text('biome').notNull(),
    firstAt: utc('first_at').notNull(),
    firstDay: integer('first_day').notNull(),
    lastAt: utc('last_at').notNull(),
    count: integer('count').notNull().default(1)
  },
  (table) => [primaryKey({ columns: [table.playerId, table.biome] })]
);

export const positions = pgTable(
  'positions',
  {
    playerId: integer('player_id').notNull(),
    ts: utc('ts').notNull(),
    x: doublePrecision('x').notNull(),
    z: doublePrecision('z').notNull(),
    biome: text('biome').notNull()
  },
  (table) => [primaryKey({ columns: [table.playerId, table.ts] })]
);

export const kills = pgTable(
  'kills',
  {
    id: serial('id').primaryKey(),
    eventId: uuid('event_id').notNull(),
    playerId: integer('player_id').notNull(),
    creature: text('creature').notNull(),
    level: integer('level').notNull(),
    at: utc('at').notNull(),
    basis: text('basis').notNull(),
    boss: boolean('boss').notNull().default(false)
  },
  (table) => [
    uniqueIndex('kills_event_player_idx').on(table.eventId, table.playerId),
    index('kills_player_at_idx').on(table.playerId, table.at)
  ]
);

export const creatureDeaths = pgTable(
  'creature_deaths',
  {
    date: date('date', { mode: 'string' }).notNull(),
    creature: text('creature').notNull(),
    count: integer('count').notNull().default(0)
  },
  (table) => [primaryKey({ columns: [table.date, table.creature] })]
);

export const structuresDaily = pgTable(
  'structures_daily',
  {
    date: date('date', { mode: 'string' }).notNull(),
    prefab: text('prefab').notNull(),
    builderPlayerId: integer('builder_player_id').notNull().default(0),
    built: integer('built').notNull().default(0),
    destroyed: integer('destroyed').notNull().default(0),
    placed: integer('placed').notNull().default(0)
  },
  (table) => [primaryKey({ columns: [table.date, table.prefab, table.builderPlayerId] })]
);

export const structureEvents = pgTable(
  'structure_events',
  {
    id: serial('id').primaryKey(),
    eventId: uuid('event_id').notNull(),
    at: utc('at').notNull(),
    kind: text('kind').notNull(),
    prefab: text('prefab').notNull(),
    x: doublePrecision('x').notNull(),
    z: doublePrecision('z').notNull(),
    biome: text('biome').notNull(),
    playerId: integer('player_id'),
    creatorCharacterId: bigint('creator_character_id', { mode: 'number' })
  },
  (table) => [
    uniqueIndex('structure_events_event_idx').on(table.eventId),
    index('structure_events_at_idx').on(table.at),
    index('structure_events_player_at_idx').on(table.playerId, table.at)
  ]
);

export const chatMessages = pgTable(
  'chat_messages',
  {
    id: serial('id').primaryKey(),
    eventId: uuid('event_id').notNull(),
    at: utc('at').notNull(),
    worldDay: integer('world_day').notNull(),
    kind: text('kind').notNull(),
    playerId: integer('player_id'),
    text: text('text'),
    x: doublePrecision('x').notNull(),
    z: doublePrecision('z').notNull(),
    biome: text('biome').notNull()
  },
  (table) => [
    uniqueIndex('chat_messages_event_idx').on(table.eventId),
    index('chat_messages_at_idx').on(table.at)
  ]
);

export const saves = pgTable(
  'saves',
  {
    id: serial('id').primaryKey(),
    eventId: uuid('event_id').notNull(),
    runId: uuid('run_id').notNull(),
    at: utc('at').notNull(),
    durationMs: integer('duration_ms').notNull()
  },
  (table) => [uniqueIndex('saves_event_idx').on(table.eventId), index('saves_at_idx').on(table.at)]
);

export const mapImages = pgTable('map_images', {
  worldUid: bigint('world_uid', { mode: 'number' }).primaryKey(),
  png: bytea('png').notNull(),
  size: integer('size').notNull(),
  radius: doublePrecision('radius').notNull(),
  generatedAt: utc('generated_at').notNull().defaultNow()
});

export const creatorAccounts = pgTable('creator_accounts', {
  creatorId: bigint('creator_id', { mode: 'number' }).primaryKey(),
  platformUserId: text('platform_user_id').notNull(),
  updatedAt: utc('updated_at').notNull().defaultNow()
});

export const comfortCatalogues = pgTable('comfort_catalogues', {
  gameVersion: text('game_version').primaryKey(),
  receivedAt: utc('received_at').notNull().defaultNow(),
  catalogue: jsonb('catalogue').$type<ComfortCatalogueUpload>().notNull()
});

export const jobs = pgTable('jobs', {
  id: serial('id').primaryKey(),
  kind: text('kind').notNull(),
  state: text('state').notNull().default('queued'),
  createdAt: utc('created_at').notNull().defaultNow(),
  startedAt: utc('started_at'),
  finishedAt: utc('finished_at'),
  progress: doublePrecision('progress'),
  error: text('error')
});

export const backups = pgTable('backups', {
  id: serial('id').primaryKey(),
  at: utc('at').notNull().defaultNow(),
  file: text('file').notNull(),
  sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull().default(0),
  ok: boolean('ok').notNull(),
  error: text('error')
});

export const ingestBatches = pgTable(
  'ingest_batches',
  {
    id: serial('id').primaryKey(),
    receivedAt: utc('received_at').notNull().defaultNow(),
    status: integer('status').notNull(),
    accepted: integer('accepted').notNull().default(0),
    duplicates: integer('duplicates').notNull().default(0),
    events: integer('events').notNull().default(0)
  },
  (table) => [index('ingest_batches_received_idx').on(table.receivedAt)]
);

export const adminSessions = pgTable('admin_sessions', {
  id: text('id').primaryKey(),
  createdAt: utc('created_at').notNull().defaultNow(),
  expiresAt: utc('expires_at').notNull()
});

export const zoneResults = pgTable('zone_results', {
  name: text('name').primaryKey(),
  testedAt: utc('tested_at').notNull(),
  overall: integer('overall').notNull(),
  rating: text('rating').notNull(),
  result: jsonb('result').$type<ZoneResult>().notNull(),
  updatedAt: utc('updated_at').notNull().defaultNow()
});

export type AnnouncementKind = 'message' | 'restart';

export const announcements = pgTable(
  'announcements',
  {
    id: serial('id').primaryKey(),
    kind: text('kind').$type<AnnouncementKind>().notNull(),
    text: text('text'),
    restartAt: utc('restart_at'),
    createdAt: utc('created_at').notNull().defaultNow(),
    deliveredAt: utc('delivered_at'),
    shownAt: utc('shown_at'),
    completedAt: utc('completed_at'),
    cancelledAt: utc('cancelled_at')
  },
  (table) => [index('announcements_created_idx').on(table.createdAt)]
);

export type MetaRow = typeof meta.$inferSelect;
export type EventRow = typeof events.$inferSelect;
export type PlayerRow = typeof players.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
export type ServerRunRow = typeof serverRuns.$inferSelect;
export type ServerStatusRow = typeof serverStatus.$inferSelect;
export type RaidRow = typeof raids.$inferSelect;
export type JobRow = typeof jobs.$inferSelect;
export type ZoneResultRow = typeof zoneResults.$inferSelect;
export type AnnouncementRow = typeof announcements.$inferSelect;

export const projectionTables = [
  eventPlayers,
  serverRuns,
  serverStatus,
  characters,
  sessions,
  deaths,
  bossKills,
  bossEvents,
  bossPrefabs,
  bossState,
  globalKeys,
  raids,
  biomeVisits,
  positions,
  kills,
  creatureDeaths,
  structuresDaily,
  structureEvents,
  chatMessages,
  saves
] as const;
