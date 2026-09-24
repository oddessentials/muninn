import type {
  Biome,
  DeathCause,
  EventType,
  HitType,
  LeftReason,
  Platform,
  Status
} from '$lib/api/types';

export const biomes: readonly Biome[] = [
  'Meadows',
  'BlackForest',
  'Swamp',
  'Mountain',
  'Plains',
  'Mistlands',
  'AshLands',
  'DeepNorth',
  'Ocean',
  'None'
];

const biomeNames: Record<Biome, string> = {
  Meadows: 'Meadows',
  BlackForest: 'Black Forest',
  Swamp: 'Swamp',
  Mountain: 'Mountains',
  Plains: 'Plains',
  Mistlands: 'Mistlands',
  AshLands: 'Ashlands',
  DeepNorth: 'Deep North',
  Ocean: 'Ocean',
  None: 'Unknown biome'
};

export const biomeColors: Record<Biome, string> = {
  Meadows: 'var(--color-biome-meadows)',
  BlackForest: 'var(--color-biome-blackforest)',
  Swamp: 'var(--color-biome-swamp)',
  Mountain: 'var(--color-biome-mountain)',
  Plains: 'var(--color-biome-plains)',
  Mistlands: 'var(--color-biome-mistlands)',
  AshLands: 'var(--color-biome-ashlands)',
  DeepNorth: 'var(--color-biome-deepnorth)',
  Ocean: 'var(--color-biome-ocean)',
  None: 'var(--color-biome-none)'
};

export const mapBiomeColors: { biome: Biome; hex: string }[] = [
  { biome: 'Meadows', hex: '#6DB86B' },
  { biome: 'BlackForest', hex: '#2F6B2A' },
  { biome: 'Swamp', hex: '#6E5A55' },
  { biome: 'Mountain', hex: '#E8E8EA' },
  { biome: 'Plains', hex: '#D9C86A' },
  { biome: 'Mistlands', hex: '#4C4A5A' },
  { biome: 'AshLands', hex: '#B0342C' },
  { biome: 'DeepNorth', hex: '#DFE9F0' },
  { biome: 'Ocean', hex: '#274B8A' }
];

export function biomeLabel(biome: Biome | string | null | undefined): string {
  if (!biome) return 'Unknown biome';
  return biomeNames[biome as Biome] ?? String(biome);
}

export function isBiome(value: unknown): value is Biome {
  return typeof value === 'string' && (biomes as readonly string[]).includes(value);
}

const platformNames: Record<Platform, string> = {
  Steam: 'Steam',
  Xbox: 'Xbox',
  PlayStation: 'PlayStation',
  Nintendo: 'Nintendo'
};

export function platformLabel(platform: Platform | string): string {
  return platformNames[platform as Platform] ?? platform;
}

const hitTypeNames: Record<HitType, string> = {
  EnemyHit: 'Killed by a creature',
  PlayerHit: 'Killed by another player',
  Fall: 'Fell to death',
  Drowning: 'Drowned',
  Burning: 'Burned',
  Freezing: 'Froze',
  Poisoned: 'Poisoned',
  Water: 'Water',
  Smoke: 'Smoke',
  EdgeOfWorld: 'Fell off the edge of the world',
  Impact: 'Impact',
  Cart: 'Crushed by a cart',
  Tree: 'Crushed by a tree',
  Self: 'Self-inflicted',
  Structural: 'Structure collapse',
  Turret: 'Turret',
  Boat: 'Boat',
  Stalagtite: 'Falling stalactite',
  Catapult: 'Catapult',
  CinderFire: 'Cinder fire',
  AshlandsOcean: 'Boiling ocean',
  AshlandsLava: 'Lava',
  Incinerator: 'Incinerator',
  DrawBridge: 'Drawbridge',
  Undefined: 'Undefined hit'
};

export function isHitType(value: unknown): value is HitType {
  return typeof value === 'string' && value in hitTypeNames;
}

export function hitTypeLabel(hitType: HitType | string): string {
  return hitTypeNames[hitType as HitType] ?? hitType;
}

export function prefabLabel(prefab: string | null | undefined): string {
  if (!prefab) return '';
  return prefab.replace(/^piece_/, '').replace(/_/g, ' ');
}

export function causeLabel(cause: DeathCause | null | undefined): string {
  if (!cause) return 'Cause not observed';
  if (cause.hit_type === 'EnemyHit' && cause.attacker_prefab)
    return `Killed by ${prefabLabel(cause.attacker_prefab)}`;
  if (cause.hit_type === 'PlayerHit')
    return cause.attacker ? `Killed by ${cause.attacker.display_name}` : 'Killed by another player';
  if (cause.attacker_prefab)
    return `${hitTypeLabel(cause.hit_type)} (${prefabLabel(cause.attacker_prefab)})`;
  return hitTypeLabel(cause.hit_type);
}

export function deathCauseKeyLabel(key: string): string {
  if (key === 'unknown') return 'Not observed';
  return hitTypeLabel(key);
}

const leftReasons: Record<LeftReason, string> = {
  disconnect: 'disconnected',
  timeout: 'timed out',
  kicked: 'kicked',
  server_stop: 'server stopped',
  reconciled: 'reconciled from heartbeat',
  server_lost: 'server lost'
};

export function leftReasonLabel(reason: LeftReason | string | null | undefined): string {
  if (!reason) return 'still online';
  return leftReasons[reason as LeftReason] ?? reason;
}

export function stopReasonLabel(reason: 'graceful' | 'inferred' | null): string {
  if (reason === 'graceful') return 'stopped cleanly';
  if (reason === 'inferred') return 'lost (no heartbeat for 180 s)';
  return 'running';
}

export function sourceLabel(source: Status['source']): string {
  if (source === 'plugin') return 'plugin heartbeats';
  if (source === 'a2s') return 'Steam query only';
  return 'no source';
}

export const activityTypes: readonly EventType[] = [
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

export const noisyActivityTypes: readonly EventType[] = [
  'server.heartbeat',
  'player.position',
  'structure.built',
  'structure.destroyed',
  'creature.died'
];

const quietActivityTypes: readonly EventType[] = [
  'world.save_started',
  'world.saved',
  'world.dusk_approaching',
  'world.dawn_approaching'
];

export const digestActivityTypes: readonly EventType[] = activityTypes.filter(
  (type) => !noisyActivityTypes.includes(type) && !quietActivityTypes.includes(type)
);

export function isEventType(value: unknown): value is EventType {
  return typeof value === 'string' && (activityTypes as readonly string[]).includes(value);
}

const activityTypeNames: Record<EventType, string> = {
  'server.started': 'Server started',
  'server.stopping': 'Server stopping',
  'server.heartbeat': 'Heartbeat',
  'server.lost': 'Server lost',
  'world.save_started': 'Save started',
  'world.saved': 'World saved',
  'world.rollback_detected': 'Rollback',
  'world.dusk_approaching': 'Dusk',
  'world.dawn_approaching': 'Dawn',
  'player.joined': 'Joined',
  'player.spawned': 'Spawned',
  'player.died': 'Death',
  'player.left': 'Left',
  'player.biome_changed': 'Biome',
  'player.position': 'Position',
  'boss.summoned': 'Boss summoned',
  'boss.engaged': 'Boss engaged',
  'boss.defeated': 'Boss defeated',
  'global_key.set': 'Global key',
  'raid.started': 'Raid',
  'raid.ended': 'Raid over',
  'structure.built': 'Built',
  'structure.destroyed': 'Destroyed',
  'creature.died': 'Kill',
  'chat.message': 'Chat',
  'announcement.shown': 'Announcement'
};

export function activityTypeLabel(type: EventType | string): string {
  return activityTypeNames[type as EventType] ?? type;
}

export interface ActivityGroup {
  label: string;
  types: EventType[];
}

export const activityGroups: ActivityGroup[] = [
  {
    label: 'Players',
    types: ['player.joined', 'player.left', 'player.spawned', 'player.died', 'player.biome_changed']
  },
  { label: 'Bosses', types: ['boss.summoned', 'boss.engaged', 'boss.defeated', 'global_key.set'] },
  { label: 'Raids', types: ['raid.started', 'raid.ended'] },
  { label: 'Chat', types: ['chat.message'] },
  {
    label: 'Server',
    types: [
      'server.started',
      'server.stopping',
      'server.lost',
      'world.save_started',
      'world.saved',
      'world.rollback_detected',
      'world.dusk_approaching',
      'world.dawn_approaching',
      'announcement.shown'
    ]
  },
  {
    label: 'Building and kills',
    types: ['structure.built', 'structure.destroyed', 'creature.died']
  },
  { label: 'Telemetry samples', types: ['server.heartbeat', 'player.position'] }
];

export function progressionCategoryLabel(
  category: 'boss' | 'mini_boss' | 'modifier' | 'other'
): string {
  if (category === 'boss') return 'Boss';
  if (category === 'mini_boss') return 'Mini-boss';
  if (category === 'modifier') return 'World modifier';
  return 'Other';
}
