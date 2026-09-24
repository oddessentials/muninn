import type { Biome, IngestBatch, TelemetryEvent } from '../../src/lib/api/types.ts';

export interface SimulatedPlayer {
  platformUserId: string;
  displayId: string;
  platform: 'Steam' | 'Xbox';
  name: string;
  characterId: number;
  peerUid: number;
  home: { x: number; z: number };
}

export interface GeneratorOptions {
  seed?: number;
  days?: number;
  endAt?: Date;
  worldName?: string;
  worldUid?: number;
  serverName?: string;
  pluginVersion?: string;
  gameVersion?: string;
  networkVersion?: number;
  positionIntervalS?: number;
  heartbeatIntervalS?: number;
}

export interface SimulatedHistory {
  events: TelemetryEvent[];
  players: SimulatedPlayer[];
  runIds: string[];
  world: { name: string; uid: number };
  serverName: string;
  plugin: { name: string; version: string };
  game: { version: string; network_version: number };
  endAt: Date;
  onlineAtEnd: SimulatedPlayer[];
}

export const dayLengthS = 1800;

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function uuidFrom(random: () => number): string {
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) bytes[i] = Math.floor(random() * 256);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export const simulatedPlayers: SimulatedPlayer[] = [
  {
    platformUserId: 'Steam_76561198012345678',
    displayId: 'V_76561198012345678',
    platform: 'Steam',
    name: 'Bjorn',
    characterId: 3187264590123456,
    peerUid: 11,
    home: { x: 110, z: -250 }
  },
  {
    platformUserId: 'Steam_76561198087654321',
    displayId: 'V_76561198087654321',
    platform: 'Steam',
    name: 'Freya',
    characterId: 5023871234567890,
    peerUid: 12,
    home: { x: 140, z: -220 }
  },
  {
    platformUserId: 'Steam_76561198011223344',
    displayId: 'V_76561198011223344',
    platform: 'Steam',
    name: 'Ragnar',
    characterId: 4412398765432109,
    peerUid: 13,
    home: { x: 95, z: -300 }
  },
  {
    platformUserId: 'Steam_76561198099887766',
    displayId: 'V_76561198099887766',
    platform: 'Steam',
    name: 'Astrid',
    characterId: 2938475610293847,
    peerUid: 14,
    home: { x: 160, z: -280 }
  },
  {
    platformUserId: 'Steam_76561198055667788',
    displayId: 'V_76561198055667788',
    platform: 'Steam',
    name: 'Ulf',
    characterId: 1122334455667788,
    peerUid: 15,
    home: { x: 80, z: -210 }
  },
  {
    platformUserId: 'Steam_76561198033445566',
    displayId: 'V_76561198033445566',
    platform: 'Steam',
    name: 'Sigrid',
    characterId: 8877665544332211,
    peerUid: 16,
    home: { x: 125, z: -190 }
  },
  {
    platformUserId: 'Xbox_2533274812345678',
    displayId: 'X_13643906355176095590',
    platform: 'Xbox',
    name: 'Torvald',
    characterId: 6655443322110099,
    peerUid: 17,
    home: { x: 175, z: -240 }
  },
  {
    platformUserId: 'Steam_76561198077665544',
    displayId: 'V_76561198077665544',
    platform: 'Steam',
    name: 'Hilde',
    characterId: 2287654321098765,
    peerUid: 18,
    home: { x: 60, z: -270 }
  }
];

interface BossScript {
  key: string;
  prefab: string;
  nameKey: string;
  alert: string;
  biome: Biome;
  at: { x: number; z: number };
  day: number;
  raid: { name: string; biome: Biome; duration: number } | null;
}

const bossScript: BossScript[] = [
  {
    key: 'defeated_eikthyr',
    prefab: 'Eikthyr',
    nameKey: '$enemy_eikthyr',
    alert: '$enemy_eikthyr_alert',
    biome: 'Meadows',
    at: { x: -407.7, z: 1133.6 },
    day: 6,
    raid: { name: 'army_eikthyr', biome: 'Meadows', duration: 120 }
  },
  {
    key: 'defeated_gdking',
    prefab: 'gd_king',
    nameKey: '$enemy_gdking',
    alert: '$enemy_gdking_alert',
    biome: 'BlackForest',
    at: { x: 1250.3, z: -1380.9 },
    day: 14,
    raid: { name: 'army_theelder', biome: 'BlackForest', duration: 120 }
  },
  {
    key: 'defeated_bonemass',
    prefab: 'Bonemass',
    nameKey: '$enemy_bonemass',
    alert: '$enemy_bonemass_alert',
    biome: 'Swamp',
    at: { x: -2310.5, z: 640.2 },
    day: 24,
    raid: { name: 'army_bonemass', biome: 'Swamp', duration: 100 }
  },
  {
    key: 'defeated_dragon',
    prefab: 'Dragon',
    nameKey: '$enemy_dragon',
    alert: '$enemy_dragon_alert',
    biome: 'Mountain',
    at: { x: 2210.8, z: 3140.4 },
    day: 36,
    raid: null
  }
];

const creaturesByBiome: Record<string, { prefab: string; maxLevel: number }[]> = {
  Meadows: [
    { prefab: 'Boar', maxLevel: 3 },
    { prefab: 'Deer', maxLevel: 2 },
    { prefab: 'Neck', maxLevel: 3 },
    { prefab: 'Greyling', maxLevel: 1 }
  ],
  BlackForest: [
    { prefab: 'Greydwarf', maxLevel: 3 },
    { prefab: 'Greydwarf_Shaman', maxLevel: 2 },
    { prefab: 'Greydwarf_Elite', maxLevel: 2 },
    { prefab: 'Skeleton', maxLevel: 3 },
    { prefab: 'Troll', maxLevel: 2 }
  ],
  Swamp: [
    { prefab: 'Draugr', maxLevel: 3 },
    { prefab: 'Draugr_Elite', maxLevel: 2 },
    { prefab: 'Blob', maxLevel: 2 },
    { prefab: 'Leech', maxLevel: 3 },
    { prefab: 'Wraith', maxLevel: 1 },
    { prefab: 'Abomination', maxLevel: 1 },
    { prefab: 'Surtling', maxLevel: 2 }
  ],
  Mountain: [
    { prefab: 'Wolf', maxLevel: 3 },
    { prefab: 'Hatchling', maxLevel: 2 },
    { prefab: 'StoneGolem', maxLevel: 1 },
    { prefab: 'Fenring', maxLevel: 2 }
  ],
  Plains: [
    { prefab: 'Goblin', maxLevel: 3 },
    { prefab: 'GoblinArcher', maxLevel: 2 },
    { prefab: 'Deathsquito', maxLevel: 1 },
    { prefab: 'Lox', maxLevel: 2 }
  ]
};

const structurePrefabs = [
  'wood_wall',
  'wood_floor',
  'wood_beam',
  'wood_pole2',
  'wood_roof_45',
  'wood_door',
  'wood_stair',
  'wood_fence',
  'stone_wall_2x1',
  'stone_floor',
  'stone_arch',
  'piece_workbench',
  'forge',
  'piece_chest_wood',
  'piece_bed',
  'fire_pit',
  'cauldron',
  'piece_sharpening_stone',
  'piece_banner01',
  'darkwood_roof'
];

const shouts = [
  'Anyone want to sail to the swamp tonight?',
  'Found a swamp crypt north of the river',
  'Portal is up at the mountain base',
  'Who took the bronze?',
  'Troll near the black forest outpost, careful',
  'Boss fight in ten minutes, bring poison mead',
  'Building the great hall, need wood',
  'Rest at the base, raid incoming'
];

const biomeSpots: Record<string, { x: number; z: number }> = {
  Meadows: { x: 120, z: -240 },
  BlackForest: { x: 780, z: -1500 },
  Swamp: { x: -2350, z: 600 },
  Mountain: { x: 2160, z: 3200 },
  Plains: { x: -3650, z: -2180 }
};

const biomeUnlockDay: Record<string, number> = {
  Meadows: 0,
  BlackForest: 2,
  Swamp: 12,
  Mountain: 20,
  Plains: 34
};

export function generateHistory(options: GeneratorOptions = {}): SimulatedHistory {
  const random = mulberry32(options.seed ?? 20260910);
  const days = options.days ?? 45;
  const endAt = options.endAt ?? new Date();
  const startAt = new Date(endAt.getTime() - days * 24 * 3600 * 1000);
  const world = {
    name: options.worldName ?? 'Ravenhold',
    uid: options.worldUid ?? 7130451826379422
  };
  const serverName = options.serverName ?? 'Ravenhold';
  const plugin = { name: 'GuildTelemetry', version: options.pluginVersion ?? '0.1.0' };
  const game = {
    version: options.gameVersion ?? '1.0.7',
    network_version: options.networkVersion ?? 39
  };
  const positionInterval = options.positionIntervalS ?? 60;
  const heartbeatInterval = options.heartbeatIntervalS ?? 120;
  const players = simulatedPlayers;
  const events: TelemetryEvent[] = [];
  const runIds: string[] = [];
  const knownKeys = new Set<string>();

  let runId = '';
  let seq = 0;
  let netTime = 3600 * 3;
  let uptimeS = 0;
  let lastSaveAt = startAt;

  const worldDay = () => Math.floor(netTime / dayLengthS);
  const push = (ts: Date, type: TelemetryEvent['type'], data: unknown): TelemetryEvent => {
    seq += 1;
    const event = {
      id: uuidFrom(random),
      seq,
      run_id: runId,
      ts: ts.toISOString(),
      type,
      world_day: worldDay(),
      data
    } as TelemetryEvent;
    events.push(event);
    return event;
  };

  const online = new Map<
    string,
    {
      player: SimulatedPlayer;
      joinedAt: Date;
      biome: Biome;
      x: number;
      z: number;
      lastPositionAt: Date;
      distance: number;
    }
  >();
  const positionOf = (player: SimulatedPlayer) => online.get(player.platformUserId)!;
  const idsNear = (x: number, z: number, radius: number) =>
    [...online.values()]
      .filter((entry) => Math.hypot(entry.x - x, entry.z - z) <= radius)
      .map((entry) => entry.player.platformUserId);

  const heartbeat = (ts: Date) => {
    push(ts, 'server.heartbeat', {
      uptime_s: Math.round(uptimeS),
      net_time: Math.round(netTime),
      world_day: worldDay(),
      last_save_age_s: Math.max(0, (ts.getTime() - lastSaveAt.getTime()) / 1000),
      queue_depth: 0,
      dropped_events: 0,
      players: [...online.values()].map((entry) => {
        const distance = entry.distance;
        entry.distance = 0;
        return {
          platform_user_id: entry.player.platformUserId,
          name: entry.player.name,
          character_id: entry.player.characterId,
          biome: entry.biome,
          x: round1(entry.x),
          z: round1(entry.z),
          distance_since_last_m: round1(distance)
        };
      })
    });
  };

  const startRun = (ts: Date, rollback: boolean) => {
    runId = uuidFrom(random);
    runIds.push(runId);
    seq = 0;
    uptimeS = 0;
    if (rollback) netTime = Math.max(0, netTime - 5400);
    push(ts, 'server.started', {
      game_version: game.version,
      network_version: game.network_version,
      plugin_version: plugin.version,
      bepinex_version: '5.4.23.5',
      unity_version: '6000.0.75f1',
      world_name: world.name,
      world_uid: world.uid,
      net_time: Math.round(netTime),
      world_day: worldDay(),
      global_keys: [...knownKeys],
      missing_hooks: []
    });
  };

  const save = (ts: Date) => {
    push(ts, 'world.save_started', {});
    const duration = 400 + Math.floor(random() * 1100);
    push(new Date(ts.getTime() + duration), 'world.saved', { duration_ms: duration });
    lastSaveAt = ts;
  };

  const join = (player: SimulatedPlayer, ts: Date, biome: Biome) => {
    const spot = biome === 'Meadows' ? player.home : biomeSpots[biome]!;
    const x = spot.x + (random() - 0.5) * 60;
    const z = spot.z + (random() - 0.5) * 60;
    push(ts, 'player.joined', {
      platform_user_id: player.platformUserId,
      display_id: player.displayId,
      platform: player.platform,
      name: player.name,
      peer_uid: player.peerUid,
      playfab_id: null
    });
    online.set(player.platformUserId, {
      player,
      joinedAt: ts,
      biome,
      x,
      z,
      lastPositionAt: ts,
      distance: 0
    });
    push(new Date(ts.getTime() + 15_000), 'player.spawned', {
      platform_user_id: player.platformUserId,
      name: player.name,
      character_id: player.characterId,
      respawn: false,
      x: round1(x),
      z: round1(z),
      biome
    });
  };

  const leave = (
    player: SimulatedPlayer,
    ts: Date,
    reason: 'disconnect' | 'timeout' | 'server_stop'
  ) => {
    const entry = online.get(player.platformUserId);
    if (!entry) return;
    push(ts, 'player.left', {
      platform_user_id: player.platformUserId,
      name: player.name,
      session_s: Math.round((ts.getTime() - entry.joinedAt.getTime()) / 1000),
      reason
    });
    online.delete(player.platformUserId);
  };

  const move = (player: SimulatedPlayer, ts: Date, biome: Biome | null) => {
    const entry = positionOf(player);
    const target =
      biome && biome !== entry.biome
        ? biome === 'Meadows'
          ? player.home
          : biomeSpots[biome]!
        : null;
    const dx = target ? target.x - entry.x : (random() - 0.5) * 80;
    const dz = target ? target.z - entry.z : (random() - 0.5) * 80;
    const stepX = target ? dx : dx;
    const stepZ = target ? dz : dz;
    const travelled = Math.hypot(stepX, stepZ);
    entry.x += stepX;
    entry.z += stepZ;
    entry.distance += travelled > 500 ? 0 : travelled;
    if (biome && biome !== entry.biome) {
      push(ts, 'player.biome_changed', {
        platform_user_id: player.platformUserId,
        from: entry.biome,
        to: biome,
        x: round1(entry.x),
        z: round1(entry.z)
      });
      entry.biome = biome;
    }
  };

  const sample = (ts: Date) => {
    for (const entry of online.values()) {
      push(ts, 'player.position', {
        platform_user_id: entry.player.platformUserId,
        x: round1(entry.x),
        z: round1(entry.z),
        biome: entry.biome
      });
    }
  };

  const creatureDeath = (ts: Date, killer: SimulatedPlayer) => {
    const entry = positionOf(killer);
    const pool = creaturesByBiome[entry.biome] ?? creaturesByBiome.Meadows!;
    const creature = pool[Math.floor(random() * pool.length)]!;
    const near = idsNear(entry.x, entry.z, 40);
    const credited =
      random() < 0.35 && near.length > 1
        ? [near.find((id) => id !== killer.platformUserId)!]
        : random() < 0.2
          ? [killer.platformUserId]
          : [];
    push(ts, 'creature.died', {
      prefab: creature.prefab,
      level: 1 + Math.floor(random() * creature.maxLevel),
      x: round1(entry.x + (random() - 0.5) * 10),
      z: round1(entry.z + (random() - 0.5) * 10),
      biome: entry.biome,
      credited,
      nearby: near
    });
  };

  const build = (ts: Date, builder: SimulatedPlayer) => {
    const entry = positionOf(builder);
    const prefab = structurePrefabs[Math.floor(random() * structurePrefabs.length)]!;
    push(ts, 'structure.built', {
      prefab,
      x: round1(entry.x + (random() - 0.5) * 12),
      z: round1(entry.z + (random() - 0.5) * 12),
      biome: entry.biome,
      creator_character_id: builder.characterId,
      creator_platform_user_id: builder.platformUserId
    });
    if (random() < 0.06) {
      push(new Date(ts.getTime() + 30_000), 'structure.destroyed', {
        prefab,
        x: round1(entry.x),
        z: round1(entry.z),
        biome: entry.biome,
        creator_character_id: random() < 0.7 ? builder.characterId : null
      });
    }
  };

  const chat = (ts: Date, player: SimulatedPlayer) => {
    const entry = positionOf(player);
    const ping = random() < 0.4;
    push(ts, 'chat.message', {
      platform_user_id: player.platformUserId,
      kind: ping ? 'ping' : 'shout',
      text: ping ? null : shouts[Math.floor(random() * shouts.length)]!,
      x: round1(entry.x),
      z: round1(entry.z),
      biome: entry.biome
    });
  };

  const die = (ts: Date, victim: SimulatedPlayer, observed: boolean) => {
    const entry = positionOf(victim);
    const pool = creaturesByBiome[entry.biome] ?? creaturesByBiome.Meadows!;
    const attacker = pool[Math.floor(random() * pool.length)]!;
    push(ts, 'player.died', {
      platform_user_id: victim.platformUserId,
      name: victim.name,
      character_id: victim.characterId,
      x: round1(entry.x),
      z: round1(entry.z),
      biome: entry.biome,
      observed_cause: observed
        ? {
            hit_type: 'EnemyHit',
            attacker_prefab: attacker.prefab,
            attacker_platform_user_id: null,
            at: new Date(ts.getTime() - 4000).toISOString()
          }
        : null
    });
    push(new Date(ts.getTime() + 12_000), 'player.spawned', {
      platform_user_id: victim.platformUserId,
      name: victim.name,
      character_id: victim.characterId,
      respawn: true,
      x: round1(victim.home.x),
      z: round1(victim.home.z),
      biome: 'Meadows'
    });
    entry.x = victim.home.x;
    entry.z = victim.home.z;
    entry.biome = 'Meadows';
  };

  const raid = (
    ts: Date,
    name: string,
    biome: Biome,
    duration: number,
    withDeath: boolean
  ): Date => {
    const entries = [...online.values()];
    const centre = entries[0] ?? null;
    const x = centre ? centre.x : 100;
    const z = centre ? centre.z : -240;
    push(ts, 'raid.started', {
      name,
      x: round1(x),
      z: round1(z),
      biome,
      duration_s: duration,
      nearby: idsNear(x, z, 96)
    });
    if (withDeath && entries.length > 0) {
      const victim = entries[Math.floor(random() * entries.length)]!.player;
      die(new Date(ts.getTime() + 48_000), victim, true);
    }
    const ended = new Date(ts.getTime() + (duration + 2 + Math.floor(random() * 8)) * 1000);
    push(ended, 'raid.ended', {
      name,
      elapsed_s: Math.round((ended.getTime() - ts.getTime()) / 1000)
    });
    return ended;
  };

  const boss = (ts: Date, script: BossScript, participants: SimulatedPlayer[]): Date => {
    const summoner = participants[0]!;
    for (const participant of participants) {
      const entry = positionOf(participant);
      entry.x = script.at.x + (random() - 0.5) * 30;
      entry.z = script.at.z + (random() - 0.5) * 30;
      if (entry.biome !== script.biome) {
        push(ts, 'player.biome_changed', {
          platform_user_id: participant.platformUserId,
          from: entry.biome,
          to: script.biome,
          x: round1(entry.x),
          z: round1(entry.z)
        });
        entry.biome = script.biome;
      }
    }
    push(ts, 'boss.summoned', {
      prefab: script.prefab,
      name_key: script.nameKey,
      x: round1(script.at.x),
      z: round1(script.at.z),
      biome: script.biome,
      summoner_platform_user_id: summoner.platformUserId,
      method: 'spawn_rpc'
    });
    const engaged = new Date(ts.getTime() + 45_000);
    push(engaged, 'boss.engaged', {
      prefab: script.prefab,
      name_key: script.nameKey,
      x: round1(script.at.x),
      z: round1(script.at.z),
      biome: script.biome,
      alert_message: script.alert,
      nearby: idsNear(script.at.x, script.at.z, 200)
    });
    const defeated = new Date(engaged.getTime() + (240 + Math.floor(random() * 300)) * 1000);
    const first = !knownKeys.has(script.key);
    knownKeys.add(script.key);
    push(defeated, 'boss.defeated', {
      key: script.key,
      first_time: first,
      sender_platform_user_id: summoner.platformUserId,
      nearby: idsNear(script.at.x, script.at.z, 200),
      prefab: script.prefab,
      name_key: script.nameKey,
      participants: participants.map((participant) => participant.platformUserId)
    });
    for (const participant of participants) {
      const entry = positionOf(participant);
      entry.x = participant.home.x;
      entry.z = participant.home.z;
      push(new Date(defeated.getTime() + 120_000), 'player.biome_changed', {
        platform_user_id: participant.platformUserId,
        from: entry.biome,
        to: 'Meadows',
        x: round1(entry.x),
        z: round1(entry.z)
      });
      entry.biome = 'Meadows';
    }
    return new Date(defeated.getTime() + 150_000);
  };

  const globalKey = (ts: Date, key: string) => {
    const first = !knownKeys.has(key);
    knownKeys.add(key);
    push(ts, 'global_key.set', { key, value: null, first_time: first });
  };

  startRun(startAt, false);
  const bossQueue = [...bossScript];
  const extraKeys = [
    { day: 4, key: 'KilledTroll' },
    { day: 16, key: 'Hildir1' },
    { day: 28, key: 'killed_surtling' },
    { day: 31, key: 'KilledBat' }
  ];
  let restartDone = false;
  let lastPositionSample = startAt;
  let lastHeartbeat = startAt;
  let cursor = new Date(startAt.getTime() + 6 * 3600 * 1000);

  while (cursor < endAt) {
    const dayIndex = Math.floor((cursor.getTime() - startAt.getTime()) / (24 * 3600 * 1000));
    const eveningSlots = 1 + Math.floor(random() * 2);
    for (let slot = 0; slot < eveningSlots && cursor < endAt; slot++) {
      const joinersCount = 2 + Math.floor(random() * 4);
      const shuffled = [...players].sort(() => random() - 0.5);
      const eligible = shuffled
        .filter((player) => player.name !== 'Hilde' || dayIndex > days * 0.7)
        .filter((player) => player.name !== 'Torvald' || dayIndex > days * 0.4);
      const joiners = eligible.slice(0, joinersCount);
      const sessionStart = new Date(cursor.getTime() + (12 + slot * 5) * 3600 * 1000 * 0.35);
      let t = sessionStart;
      for (const player of joiners) {
        join(player, t, 'Meadows');
        t = new Date(t.getTime() + (20 + Math.floor(random() * 240)) * 1000);
      }
      const sessionMinutes = 45 + Math.floor(random() * 90);
      const sessionEnd = new Date(sessionStart.getTime() + sessionMinutes * 60_000);
      const unlocked = (Object.keys(biomeUnlockDay) as Biome[]).filter(
        (biome) => biomeUnlockDay[biome]! <= worldDay()
      );
      while (t < sessionEnd && t < endAt) {
        const step = 15 + Math.floor(random() * 60);
        t = new Date(t.getTime() + step * 1000);
        netTime += step;
        uptimeS += step;
        if (t.getTime() - lastPositionSample.getTime() >= positionInterval * 1000) {
          sample(t);
          lastPositionSample = t;
        }
        if (t.getTime() - lastHeartbeat.getTime() >= heartbeatInterval * 1000) {
          heartbeat(t);
          lastHeartbeat = t;
        }
        if (t.getTime() - lastSaveAt.getTime() >= 30 * 60_000) save(t);
        const actors = [...online.values()].map((entry) => entry.player);
        if (actors.length === 0) break;
        const actor = actors[Math.floor(random() * actors.length)]!;
        const roll = random();
        if (roll < 0.08) {
          const biome = unlocked[Math.floor(random() * unlocked.length)]!;
          move(actor, t, biome);
        } else if (roll < 0.45) {
          move(actor, t, null);
          creatureDeath(t, actor);
        } else if (roll < 0.75) {
          build(t, actor);
        } else if (roll < 0.82) {
          chat(t, actor);
        } else if (roll < 0.845) {
          die(t, actor, random() < 0.6);
        } else {
          move(actor, t, null);
        }
        const nextBoss = bossQueue[0];
        if (nextBoss && worldDay() >= nextBoss.day && actors.length >= 2) {
          bossQueue.shift();
          const participants = actors.slice(
            0,
            Math.min(actors.length, 2 + Math.floor(random() * 3))
          );
          const after = boss(t, nextBoss, participants);
          netTime += (after.getTime() - t.getTime()) / 1000;
          uptimeS += (after.getTime() - t.getTime()) / 1000;
          t = after;
          if (nextBoss.raid) {
            const raidAt = new Date(t.getTime() + 600_000);
            const ended = raid(
              raidAt,
              nextBoss.raid.name,
              nextBoss.raid.biome,
              nextBoss.raid.duration,
              nextBoss.key === 'defeated_gdking'
            );
            netTime += (ended.getTime() - t.getTime()) / 1000;
            uptimeS += (ended.getTime() - t.getTime()) / 1000;
            t = ended;
          }
        }
        const extra = extraKeys[0];
        if (extra && worldDay() >= extra.day) {
          extraKeys.shift();
          globalKey(t, extra.key);
        }
      }
      const leavers = [...online.values()].map((entry) => entry.player);
      const keepOnline =
        cursor.getTime() + 24 * 3600 * 1000 >= endAt.getTime() && slot === eveningSlots - 1;
      let leaveAt = new Date(Math.min(t.getTime(), endAt.getTime() - 60_000));
      for (const player of leavers) {
        if (keepOnline && leavers.indexOf(player) < 2) continue;
        leaveAt = new Date(leaveAt.getTime() + (10 + Math.floor(random() * 120)) * 1000);
        leave(player, leaveAt, random() < 0.12 ? 'timeout' : 'disconnect');
      }
      if (!restartDone && dayIndex >= Math.floor(days * 0.55) && online.size === 0) {
        restartDone = true;
        const stopAt = new Date(leaveAt.getTime() + 300_000);
        push(stopAt, 'server.stopping', { uptime_s: Math.round(uptimeS), online_count: 0 });
        const restartAt = new Date(stopAt.getTime() + 180_000);
        startRun(restartAt, true);
        lastHeartbeat = restartAt;
      }
      cursor = new Date(cursor.getTime() + 8 * 3600 * 1000);
    }
    cursor = new Date(
      cursor.getTime() +
        24 * 3600 * 1000 -
        ((cursor.getTime() - startAt.getTime()) % (24 * 3600 * 1000))
    );
  }

  const finalTs = new Date(
    Math.max(
      events.length > 0 ? new Date(events[events.length - 1]!.ts).getTime() : startAt.getTime(),
      endAt.getTime() - 30_000
    )
  );
  if (online.size > 0) {
    sample(finalTs);
    heartbeat(new Date(finalTs.getTime() + 5_000));
  }
  events.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime() || a.seq - b.seq);
  return {
    events,
    players,
    runIds,
    world,
    serverName,
    plugin,
    game,
    endAt,
    onlineAtEnd: [...online.values()].map((entry) => entry.player)
  };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function toBatches(
  history: SimulatedHistory,
  maxEvents = 200,
  maxBytes = 512 * 1024
): IngestBatch[] {
  const batches: IngestBatch[] = [];
  let current: TelemetryEvent[] = [];
  let currentBytes = 0;
  const flush = () => {
    if (current.length === 0) return;
    batches.push({
      plugin: history.plugin,
      game: history.game,
      server: { name: history.serverName, world: history.world.name, world_uid: history.world.uid },
      events: current
    });
    current = [];
    currentBytes = 0;
  };
  for (const event of history.events) {
    const size = JSON.stringify(event).length + 1;
    if (current.length >= maxEvents || currentBytes + size > maxBytes) flush();
    current.push(event);
    currentBytes += size;
  }
  flush();
  return batches;
}
