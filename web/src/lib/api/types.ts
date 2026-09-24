export interface paths {
  '/api/ingest': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['ingestBatch'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/ingest/catalogue': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['ingestCatalogue'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/ingest/map': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['ingestMap'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/activity': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['listActivity'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/admin/announcements': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['listAnnouncements'];
    put?: never;
    post: operations['createAnnouncement'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/admin/announcements/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    delete: operations['cancelAnnouncement'];
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/admin/backups': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['listBackups'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/admin/backups/run': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['runBackup'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/admin/events': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['listAdminEvents'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/admin/events/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['getAdminEvent'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/admin/health': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['getAdminHealth'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/admin/jobs/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['getJob'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/admin/login': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['adminLogin'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/admin/logout': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['adminLogout'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/admin/players': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['listAdminPlayers'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/admin/players/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch: operations['updateAdminPlayer'];
    trace?: never;
  };
  '/api/v1/admin/players/{id}/aliases/{alias}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    delete: operations['deleteAdminPlayerAlias'];
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/admin/players/{id}/merge': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['mergeAdminPlayer'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/admin/projections/rebuild': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['rebuildProjections'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/admin/session': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['getAdminSession'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/bosses': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['listBosses'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/bosses/{key}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['getBoss'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/bosses/{key}/events': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['listBossEvents'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/chat': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['listChat'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/comfort': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['getComfort'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/health': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['getHealth'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/online': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['getOnline'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/openapi.json': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['getOpenApi'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/players': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['listPlayers'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/players/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['getPlayer'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/players/{id}/activity': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['listPlayerActivity'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/players/{id}/deaths': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['listPlayerDeaths'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/players/{id}/kills': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['getPlayerKills'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/players/{id}/positions': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['getPlayerPositions'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/players/{id}/sessions': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['listPlayerSessions'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/players/{id}/structures': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['getPlayerStructures'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/progression': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['getProgression'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/raids': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['listRaids'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/raids/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['getRaid'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/runs': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['listRuns'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/saves': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['listSaves'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/status': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['getStatus'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/status/history': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['getStatusHistory'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/stream': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['streamEvents'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/structures': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['getStructures'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/structures/recent': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['listStructureEvents'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/world': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['getWorld'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/world/map.png': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['getWorldMap'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/zone/probe/download': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['getZoneProbeDownload'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/zone/probe/health': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['getZoneProbeHealth'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/zone/probe/ping': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['getZoneProbePing'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/zone/probe/upload': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['postZoneProbeUpload'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/zone/results': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['listZoneResults'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/zone/results/{name}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put: operations['putZoneResult'];
    post?: never;
    delete: operations['deleteZoneResult'];
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
}
export type webhooks = Record<string, never>;
export interface components {
  schemas: {
    ActivityItem: {
      at: string;
      day: number;
      id: string;
      links: components['schemas']['ActivityLinks'];
      player: components['schemas']['PlayerRef'] | null;
      summary: {
        [key: string]: unknown;
      };
      type: components['schemas']['EventType'];
    };
    ActivityLinks: {
      boss_key: string | null;
      raid_id: number | null;
      run_id: string | null;
      session_id: number | null;
    };
    ActivityPage: {
      items: components['schemas']['ActivityItem'][];
      next_cursor: string | null;
    };
    AdminHealth: {
      a2s: components['schemas']['AdminHealthA2s'];
      backup: components['schemas']['AdminHealthBackup'];
      db: components['schemas']['AdminHealthDb'];
      dropped_events: number | null;
      game_version: string | null;
      heartbeat_age_s: number | null;
      ingest: components['schemas']['AdminHealthIngest'];
      jobs: components['schemas']['AdminHealthJob'][];
      last_heartbeat_at: string | null;
      map: components['schemas']['AdminHealthMap'];
      missing_hooks: string[];
      plugin_version: string | null;
      queue_depth: number | null;
      run: components['schemas']['Run'] | null;
    };
    AdminHealthA2s: {
      last_error: string | null;
      last_ok_at: string | null;
      online: boolean | null;
      player_count: number | null;
    };
    AdminHealthBackup: {
      kept: number;
      last_at: string | null;
      size_mb: number | null;
    };
    AdminHealthDb: {
      events_total: number;
      size_mb: number;
    };
    AdminHealthIngest: {
      batches_24h: number;
      duplicates_24h: number;
      events_24h: number;
      last_batch_at: string | null;
      rejected_24h: number;
    };
    AdminHealthJob: {
      last_error: string | null;
      last_ok: boolean | null;
      last_run_at: string | null;
      name: string;
    };
    AdminHealthMap: {
      available: boolean;
      generated_at: string | null;
    };
    AdminPlayer: {
      aliases: string[];
      boss_kills: number;
      characters: string[];
      current_biome: components['schemas']['Biome'] | null;
      deaths: number;
      display_id: string;
      display_name: string;
      display_name_override: string | null;
      distance_m: number;
      first_seen: string;
      hidden: boolean;
      id: number;
      kills: number;
      last_seen: string;
      online: boolean;
      platform: components['schemas']['Platform'];
      platform_user_id: string;
      playtime_s: number;
      sessions: number;
      structures_built: number;
    };
    AdminPlayerPage: {
      items: components['schemas']['AdminPlayer'][];
      next_cursor: string | null;
    };
    AdminSession: {
      authenticated: boolean;
      expires_at: string | null;
    };
    Announcement: {
      cancelled_at: string | null;
      completed_at: string | null;
      created_at: string;
      delivered_at: string | null;
      id: number;
      kind: components['schemas']['AnnouncementKind'];
      restart_at: string | null;
      shown_at: string | null;
      status: components['schemas']['AnnouncementStatus'];
      text: string | null;
    };
    AnnouncementCreate: {
      kind: components['schemas']['AnnouncementKind'];
      restart_at?: string | null;
      text?: string | null;
    };
    AnnouncementKind: 'message' | 'restart';
    AnnouncementList: {
      items: components['schemas']['Announcement'][];
    };
    AnnouncementShownData: {
      announcement_id: number;
      final: boolean;
      kind: components['schemas']['AnnouncementKind'];
      remaining_s: number | null;
      text: string;
    };
    AnnouncementShownEvent: {
      data: components['schemas']['AnnouncementShownData'];
      id: string;
      received_at?: string;
      run_id: string;
      seq: number;
      ts: string;
      type: 'announcement.shown';
      world_day: number;
    };
    AnnouncementStatus: 'pending' | 'delivered' | 'shown' | 'cancelled' | 'expired';
    Backup: {
      at: string;
      file: string;
      ok: boolean;
      size_bytes: number;
    };
    BackupList: {
      items: components['schemas']['Backup'][];
    };
    Biome:
      | 'Meadows'
      | 'BlackForest'
      | 'Swamp'
      | 'Mountain'
      | 'Plains'
      | 'Mistlands'
      | 'AshLands'
      | 'DeepNorth'
      | 'Ocean'
      | 'None';
    Boss: {
      active: boolean;
      defeat: components['schemas']['BossDefeat'] | null;
      engaged: number;
      first_kill: components['schemas']['FirstKill'] | null;
      key: string;
      kills: number;
      last_kill_at: string | null;
      name: string;
      order: number;
      summons: number;
      tier: 'forsaken' | 'mini' | 'other';
    };
    BossDefeat: {
      day: number;
      observed: boolean;
      since: string;
    };
    BossDefeatedData: {
      first_time: boolean;
      key: string;
      name_key: string | null;
      nearby: string[];
      participants: string[];
      prefab: string | null;
      sender_platform_user_id: string | null;
    };
    BossDefeatedEvent: {
      data: components['schemas']['BossDefeatedData'];
      id: string;
      received_at?: string;
      run_id: string;
      seq: number;
      ts: string;
      type: 'boss.defeated';
      world_day: number;
    };
    BossDetail: {
      active: boolean;
      defeat: components['schemas']['BossDefeat'] | null;
      engaged: number;
      events: components['schemas']['BossEvent'][];
      first_kill: components['schemas']['FirstKill'] | null;
      key: string;
      kills: number;
      last_kill_at: string | null;
      name: string;
      order: number;
      summons: number;
      tier: 'forsaken' | 'mini' | 'other';
    };
    BossEngagedData: {
      alert_message: string;
      biome: components['schemas']['Biome'];
      name_key: string;
      nearby: string[];
      prefab: string;
      x: number;
      z: number;
    };
    BossEngagedEvent: {
      data: components['schemas']['BossEngagedData'];
      id: string;
      received_at?: string;
      run_id: string;
      seq: number;
      ts: string;
      type: 'boss.engaged';
      world_day: number;
    };
    BossEvent: {
      at: string;
      biome: components['schemas']['Biome'] | null;
      day: number;
      first_time: boolean | null;
      id: string;
      kind: 'summoned' | 'engaged' | 'phase' | 'defeated';
      nearby: (components['schemas']['PlayerRef'] | null)[];
      participants: (components['schemas']['PlayerRef'] | null)[];
      phase: number | null;
      summoner: components['schemas']['PlayerRef'] | null;
      x: number | null;
      z: number | null;
    };
    BossEventPage: {
      items: components['schemas']['BossEvent'][];
      next_cursor: string | null;
    };
    BossList: {
      items: components['schemas']['Boss'][];
    };
    BossParticipation: {
      at: string;
      day: number;
      key: string;
      name: string;
      role: 'credited' | 'nearby';
    };
    BossSummonedData: {
      biome: components['schemas']['Biome'];
      method: 'spawn_rpc' | 'zdo';
      name_key: string;
      prefab: string;
      summoner_platform_user_id: string | null;
      x: number;
      z: number;
    };
    BossSummonedEvent: {
      data: components['schemas']['BossSummonedData'];
      id: string;
      received_at?: string;
      run_id: string;
      seq: number;
      ts: string;
      type: 'boss.summoned';
      world_day: number;
    };
    Character: {
      character_id: number;
      first_seen: string;
      last_seen: string;
      name: string;
    };
    ChatMessage: {
      at: string;
      biome: components['schemas']['Biome'];
      day: number;
      id: number;
      kind: 'shout' | 'ping' | 'say';
      player: components['schemas']['PlayerRef'] | null;
      text: string | null;
      x: number;
      z: number;
    };
    ChatMessageData: {
      biome: components['schemas']['Biome'];
      kind: 'shout' | 'ping' | 'say';
      platform_user_id: string;
      text: string | null;
      x: number;
      z: number;
    };
    ChatMessageEvent: {
      data: components['schemas']['ChatMessageData'];
      id: string;
      received_at?: string;
      run_id: string;
      seq: number;
      ts: string;
      type: 'chat.message';
      world_day: number;
    };
    ChatPage: {
      items: components['schemas']['ChatMessage'][];
      next_cursor: string | null;
    };
    Comfort: {
      catalogue: components['schemas']['ComfortCatalogue'] | null;
    };
    ComfortCatalogue: {
      game_version: string;
      generated_at: string;
      groups: string[];
      items: components['schemas']['ComfortPiece'][];
      plugin_version: string;
      radius_m: number | null;
      received_at: string;
      rested_base_s: number;
      rested_per_level_s: number;
      seasons: components['schemas']['ComfortSeason'][];
    };
    ComfortCatalogueEntry: {
      comfort: number;
      condition: components['schemas']['ComfortCondition'] | null;
      group: string;
      name: string;
      prefab: string;
      season: string | null;
      token: string;
    };
    ComfortCatalogueUpload: {
      game_version: string;
      generated_at: string;
      groups: string[];
      pieces: components['schemas']['ComfortCatalogueEntry'][];
      plugin_version: string;
      radius_m: number | null;
      rested_base_s: number;
      rested_per_level_s: number;
      seasons: components['schemas']['ComfortSeason'][];
    };
    ComfortCondition: 'lit' | 'lit_dry';
    ComfortPiece: {
      built: number;
      comfort: number;
      condition: components['schemas']['ComfortCondition'] | null;
      group: string;
      last_built: string | null;
      name: string;
      prefab: string;
      season: string | null;
      token: string;
    };
    ComfortSeason: {
      end_day: number;
      end_month: number;
      name: string;
      start_day: number;
      start_month: number;
    };
    CreatorAccount: {
      creator_id: number;
      platform_user_id: string;
    };
    CreatureDiedData: {
      biome: components['schemas']['Biome'];
      credited: string[];
      level: number;
      nearby: string[];
      prefab: string;
      x: number;
      z: number;
    };
    CreatureDiedEvent: {
      data: components['schemas']['CreatureDiedData'];
      id: string;
      received_at?: string;
      run_id: string;
      seq: number;
      ts: string;
      type: 'creature.died';
      world_day: number;
    };
    CurrentSession: {
      biome: components['schemas']['Biome'];
      character_name: string;
      joined_at: string;
      x: number;
      z: number;
    };
    Death: {
      at: string;
      biome: components['schemas']['Biome'];
      cause: components['schemas']['DeathCause'] | null;
      day: number;
      id: number;
      x: number;
      z: number;
    };
    DeathCause: {
      attacker: components['schemas']['PlayerRef'] | null;
      attacker_prefab: string | null;
      hit_type: components['schemas']['HitType'];
    };
    DeathPage: {
      items: components['schemas']['Death'][];
      next_cursor: string | null;
    };
    Error: {
      error: {
        code:
          | 'bad_request'
          | 'unauthorized'
          | 'forbidden'
          | 'not_found'
          | 'conflict'
          | 'payload_too_large'
          | 'unprocessable'
          | 'rate_limited'
          | 'unavailable'
          | 'not_implemented';
        message: string;
      };
    };
    EventEnvelope:
      | components['schemas']['ServerStartedEvent']
      | components['schemas']['ServerStoppingEvent']
      | components['schemas']['ServerHeartbeatEvent']
      | components['schemas']['ServerLostEvent']
      | components['schemas']['WorldSaveStartedEvent']
      | components['schemas']['WorldSavedEvent']
      | components['schemas']['WorldRollbackDetectedEvent']
      | components['schemas']['WorldDuskApproachingEvent']
      | components['schemas']['WorldDawnApproachingEvent']
      | components['schemas']['PlayerJoinedEvent']
      | components['schemas']['PlayerSpawnedEvent']
      | components['schemas']['PlayerDiedEvent']
      | components['schemas']['PlayerLeftEvent']
      | components['schemas']['PlayerBiomeChangedEvent']
      | components['schemas']['PlayerPositionEvent']
      | components['schemas']['BossSummonedEvent']
      | components['schemas']['BossEngagedEvent']
      | components['schemas']['BossDefeatedEvent']
      | components['schemas']['GlobalKeySetEvent']
      | components['schemas']['RaidStartedEvent']
      | components['schemas']['RaidEndedEvent']
      | components['schemas']['StructureBuiltEvent']
      | components['schemas']['StructureDestroyedEvent']
      | components['schemas']['CreatureDiedEvent']
      | components['schemas']['ChatMessageEvent']
      | components['schemas']['AnnouncementShownEvent'];
    EventPage: {
      items: components['schemas']['EventEnvelope'][];
      next_cursor: string | null;
    };
    EventType:
      | 'server.started'
      | 'server.stopping'
      | 'server.heartbeat'
      | 'server.lost'
      | 'world.save_started'
      | 'world.saved'
      | 'world.rollback_detected'
      | 'world.dusk_approaching'
      | 'world.dawn_approaching'
      | 'player.joined'
      | 'player.spawned'
      | 'player.died'
      | 'player.left'
      | 'player.biome_changed'
      | 'player.position'
      | 'boss.summoned'
      | 'boss.engaged'
      | 'boss.defeated'
      | 'global_key.set'
      | 'raid.started'
      | 'raid.ended'
      | 'structure.built'
      | 'structure.destroyed'
      | 'creature.died'
      | 'chat.message'
      | 'announcement.shown';
    FirstKill: {
      at: string;
      day: number;
      participants: (components['schemas']['PlayerRef'] | null)[];
    };
    GlobalKeySetData: {
      first_time: boolean;
      key: string;
      name_key?: string | null;
      nearby?: string[];
      prefab?: string | null;
      sender_platform_user_id?: string | null;
      value: string | null;
    };
    GlobalKeySetEvent: {
      data: components['schemas']['GlobalKeySetData'];
      id: string;
      received_at?: string;
      run_id: string;
      seq: number;
      ts: string;
      type: 'global_key.set';
      world_day: number;
    };
    Health: {
      db: boolean;
      mock: boolean;
      ok: boolean;
      version: string;
    };
    HeartbeatPlayer: {
      biome: components['schemas']['Biome'];
      character_id: number;
      distance_since_last_m: number;
      name: string;
      platform_user_id: string;
      x: number;
      z: number;
    };
    HitType:
      | 'EnemyHit'
      | 'PlayerHit'
      | 'Fall'
      | 'Drowning'
      | 'Burning'
      | 'Freezing'
      | 'Poisoned'
      | 'Water'
      | 'Smoke'
      | 'EdgeOfWorld'
      | 'Impact'
      | 'Cart'
      | 'Tree'
      | 'Self'
      | 'Structural'
      | 'Turret'
      | 'Boat'
      | 'Stalagtite'
      | 'Catapult'
      | 'CinderFire'
      | 'AshlandsOcean'
      | 'AshlandsLava'
      | 'Incinerator'
      | 'DrawBridge'
      | 'Undefined';
    IngestBatch: {
      events: components['schemas']['TelemetryEvent'][];
      game: {
        network_version: number;
        version: string;
      };
      plugin: {
        name: string;
        version: string;
      };
      server: {
        name: string;
        world: string;
        world_uid: number;
      };
    };
    IngestResult: {
      accepted: number;
      announcements: components['schemas']['PluginAnnouncement'][];
      duplicates: number;
      last_seq: number | null;
    };
    Job: {
      error: string | null;
      finished_at: string | null;
      id: number;
      kind: 'projections_rebuild' | 'backup';
      progress: number | null;
      started_at: string | null;
      state: 'queued' | 'running' | 'done' | 'failed';
    };
    JobAccepted: {
      job_id: number;
    };
    KillsByCreature: {
      creature: string;
      credited: number;
      nearby: number;
    };
    LeftReason: 'disconnect' | 'timeout' | 'kicked' | 'server_stop' | 'reconciled' | 'server_lost';
    LoginRequest: {
      password: string;
    };
    MergeRequest: {
      into: number;
    };
    ObservedCause: {
      at: string;
      attacker_platform_user_id: string | null;
      attacker_prefab: string | null;
      hit_type: components['schemas']['HitType'];
    };
    OnlineList: {
      items: components['schemas']['OnlinePlayer'][];
    };
    OnlinePlayer: {
      biome: components['schemas']['Biome'];
      character_name: string;
      display_name: string;
      platform: components['schemas']['Platform'];
      player_id: number;
      since: string;
      x: number;
      z: number;
    };
    Platform: 'Steam' | 'Xbox' | 'PlayStation' | 'Nintendo';
    Player: {
      aliases: string[];
      biomes: components['schemas']['PlayerBiome'][];
      boss_kills: number;
      boss_participation: components['schemas']['BossParticipation'][];
      characters: components['schemas']['Character'][];
      current_biome: components['schemas']['Biome'] | null;
      current_session: components['schemas']['CurrentSession'] | null;
      deaths: number;
      deaths_by_cause: {
        [key: string]: number;
      };
      display_id: string;
      display_name: string;
      distance_m: number;
      first_seen: string;
      id: number;
      kills: number;
      kills_by_creature: components['schemas']['KillsByCreature'][];
      last_seen: string;
      online: boolean;
      platform: components['schemas']['Platform'];
      platform_user_id: string;
      playtime_s: number;
      raids: components['schemas']['PlayerRaid'][];
      sessions: number;
      stats: components['schemas']['PlayerStats'];
      structures_built: number;
    };
    PlayerBiome: {
      biome: components['schemas']['Biome'];
      first_at: string;
      first_day: number;
      last_at: string;
      visits: number;
    };
    PlayerBiomeChangedData: {
      from: components['schemas']['Biome'];
      platform_user_id: string;
      to: components['schemas']['Biome'];
      x: number;
      z: number;
    };
    PlayerBiomeChangedEvent: {
      data: components['schemas']['PlayerBiomeChangedData'];
      id: string;
      received_at?: string;
      run_id: string;
      seq: number;
      ts: string;
      type: 'player.biome_changed';
      world_day: number;
    };
    PlayerDiedData: {
      biome: components['schemas']['Biome'];
      character_id: number;
      name: string;
      observed_cause: components['schemas']['ObservedCause'] | null;
      platform_user_id: string;
      x: number;
      z: number;
    };
    PlayerDiedEvent: {
      data: components['schemas']['PlayerDiedData'];
      id: string;
      received_at?: string;
      run_id: string;
      seq: number;
      ts: string;
      type: 'player.died';
      world_day: number;
    };
    PlayerJoinedData: {
      display_id: string;
      name: string;
      peer_uid: number;
      platform: components['schemas']['Platform'];
      platform_user_id: string;
      playfab_id: string | null;
    };
    PlayerJoinedEvent: {
      data: components['schemas']['PlayerJoinedData'];
      id: string;
      received_at?: string;
      run_id: string;
      seq: number;
      ts: string;
      type: 'player.joined';
      world_day: number;
    };
    PlayerKills: {
      by_creature: components['schemas']['KillsByCreature'][];
      credited: number;
      nearby: number;
      recent: components['schemas']['RecentKill'][];
    };
    PlayerLeftData: {
      name: string;
      platform_user_id: string;
      reason: 'disconnect' | 'timeout' | 'kicked' | 'server_stop';
      session_s: number;
    };
    PlayerLeftEvent: {
      data: components['schemas']['PlayerLeftData'];
      id: string;
      received_at?: string;
      run_id: string;
      seq: number;
      ts: string;
      type: 'player.left';
      world_day: number;
    };
    PlayerListItem: {
      boss_kills: number;
      characters: string[];
      current_biome: components['schemas']['Biome'] | null;
      deaths: number;
      display_id: string;
      display_name: string;
      distance_m: number;
      first_seen: string;
      id: number;
      kills: number;
      last_seen: string;
      online: boolean;
      platform: components['schemas']['Platform'];
      platform_user_id: string;
      playtime_s: number;
      sessions: number;
      structures_built: number;
    };
    PlayerPage: {
      items: components['schemas']['PlayerListItem'][];
      next_cursor: string | null;
    };
    PlayerPatch: {
      display_name_override?: string | null;
      hidden?: boolean;
    };
    PlayerPositionData: {
      biome: components['schemas']['Biome'];
      platform_user_id: string;
      x: number;
      z: number;
    };
    PlayerPositionEvent: {
      data: components['schemas']['PlayerPositionData'];
      id: string;
      received_at?: string;
      run_id: string;
      seq: number;
      ts: string;
      type: 'player.position';
      world_day: number;
    };
    PlayerRaid: {
      at: string;
      day: number;
      id: number;
      label: string;
      name: string;
      survived: boolean;
    };
    PlayerRef: {
      display_name: string;
      id: number;
      platform: components['schemas']['Platform'];
    };
    PlayerSpawnedData: {
      biome: components['schemas']['Biome'];
      character_id: number;
      name: string;
      platform_user_id: string;
      respawn: boolean;
      x: number;
      z: number;
    };
    PlayerSpawnedEvent: {
      data: components['schemas']['PlayerSpawnedData'];
      id: string;
      received_at?: string;
      run_id: string;
      seq: number;
      ts: string;
      type: 'player.spawned';
      world_day: number;
    };
    PlayerStats: {
      boss_kills: number;
      deaths: number;
      distance_m: number;
      kills_credited: number;
      kills_nearby: number;
      playtime_s: number;
      raids: number;
      sessions: number;
      shouts: number;
      structures_built: number;
      structures_destroyed: number;
    };
    PlayerStructures: {
      built: number;
      by_prefab: components['schemas']['StructuresByPrefab'][];
      destroyed: number;
      recent: components['schemas']['RecentStructure'][];
    };
    PluginAnnouncement: {
      id: number;
      kind: components['schemas']['AnnouncementKind'];
      restart_at: string | null;
      restart_in_s: number | null;
      text: string | null;
    };
    Position: {
      biome: components['schemas']['Biome'];
      ts: string;
      x: number;
      z: number;
    };
    PositionList: {
      items: components['schemas']['Position'][];
    };
    ProbeHealth: {
      ok: boolean;
      service: string;
      version: string;
    };
    ProbePing: {
      t: number;
    };
    ProbeUpload: {
      received: number;
    };
    ProgressionKey: {
      category: 'boss' | 'mini_boss' | 'modifier' | 'other';
      day: number;
      first_set_at: string;
      key: string;
      value: string | null;
    };
    ProgressionList: {
      items: components['schemas']['ProgressionKey'][];
    };
    Raid: {
      active_s: number | null;
      biome: components['schemas']['Biome'];
      day: number;
      deaths_during: number;
      duration_s: number | null;
      end_reason: 'ended' | 'server_stop' | 'server_lost' | null;
      ended_at: string | null;
      id: number;
      label: string;
      name: string;
      participants: (components['schemas']['PlayerRef'] | null)[];
      planned_duration_s: number;
      restored: boolean;
      started_at: string;
      x: number;
      z: number;
    };
    RaidDeath: {
      at: string;
      player: components['schemas']['PlayerRef'] | null;
      x: number;
      z: number;
    };
    RaidDetail: {
      active_s: number | null;
      biome: components['schemas']['Biome'];
      day: number;
      deaths: components['schemas']['RaidDeath'][];
      deaths_during: number;
      duration_s: number | null;
      end_reason: 'ended' | 'server_stop' | 'server_lost' | null;
      ended_at: string | null;
      id: number;
      label: string;
      name: string;
      participants: (components['schemas']['PlayerRef'] | null)[];
      planned_duration_s: number;
      restored: boolean;
      started_at: string;
      x: number;
      z: number;
    };
    RaidEndedData: {
      active_s?: number | null;
      elapsed_s: number;
      name: string;
    };
    RaidEndedEvent: {
      data: components['schemas']['RaidEndedData'];
      id: string;
      received_at?: string;
      run_id: string;
      seq: number;
      ts: string;
      type: 'raid.ended';
      world_day: number;
    };
    RaidPage: {
      items: components['schemas']['Raid'][];
      next_cursor: string | null;
    };
    RaidStartedData: {
      biome: components['schemas']['Biome'];
      duration_s: number;
      name: string;
      nearby: string[];
      x: number;
      z: number;
    };
    RaidStartedEvent: {
      data: components['schemas']['RaidStartedData'];
      id: string;
      received_at?: string;
      run_id: string;
      seq: number;
      ts: string;
      type: 'raid.started';
      world_day: number;
    };
    RecentKill: {
      at: string;
      basis: 'credited' | 'nearby';
      boss: boolean;
      creature: string;
      level: number;
    };
    RecentStructure: {
      at: string;
      biome: components['schemas']['Biome'];
      prefab: string;
      x: number;
      z: number;
    };
    Run: {
      game_version: string | null;
      peak_players: number;
      plugin_version: string | null;
      run_id: string;
      saves: number;
      started_at: string;
      stop_reason: 'graceful' | 'inferred' | null;
      stopped_at: string | null;
    };
    RunPage: {
      items: components['schemas']['Run'][];
      next_cursor: string | null;
    };
    Save: {
      at: string;
      duration_ms: number;
    };
    SavePage: {
      items: components['schemas']['Save'][];
      next_cursor: string | null;
    };
    ServerHeartbeatData: {
      dropped_events: number;
      last_save_age_s: number | null;
      net_time: number;
      players: components['schemas']['HeartbeatPlayer'][];
      queue_depth: number;
      uptime_s: number;
      world_day: number;
    };
    ServerHeartbeatEvent: {
      data: components['schemas']['ServerHeartbeatData'];
      id: string;
      received_at?: string;
      run_id: string;
      seq: number;
      ts: string;
      type: 'server.heartbeat';
      world_day: number;
    };
    ServerLostData: {
      last_heartbeat_at: string;
    };
    ServerLostEvent: {
      data: components['schemas']['ServerLostData'];
      id: string;
      received_at?: string;
      run_id: string;
      seq: number;
      ts: string;
      type: 'server.lost';
      world_day: number;
    };
    ServerStartedData: {
      bepinex_version: string;
      creators?: components['schemas']['CreatorAccount'][];
      game_version: string;
      global_keys: string[];
      missing_hooks: string[];
      net_time: number;
      network_version: number;
      plugin_version: string;
      unity_version: string;
      world_day: number;
      world_name: string;
      world_uid: number;
    };
    ServerStartedEvent: {
      data: components['schemas']['ServerStartedData'];
      id: string;
      received_at?: string;
      run_id: string;
      seq: number;
      ts: string;
      type: 'server.started';
      world_day: number;
    };
    ServerStoppingData: {
      online_count: number;
      uptime_s: number;
    };
    ServerStoppingEvent: {
      data: components['schemas']['ServerStoppingData'];
      id: string;
      received_at?: string;
      run_id: string;
      seq: number;
      ts: string;
      type: 'server.stopping';
      world_day: number;
    };
    Session: {
      character_name: string;
      duration_s: number | null;
      id: number;
      joined_at: string;
      left_at: string | null;
      left_reason: components['schemas']['LeftReason'] | null;
      run_id: string;
    };
    SessionPage: {
      items: components['schemas']['Session'][];
      next_cursor: string | null;
    };
    Status: {
      game_version: string | null;
      last_save_at: string | null;
      max_players: number;
      network_version: number | null;
      online: boolean;
      player_count: number;
      run: components['schemas']['StatusRun'] | null;
      server_name: string;
      source: 'plugin' | 'a2s' | 'none';
      telemetry: components['schemas']['StatusTelemetry'];
      updated_at: string;
      world: components['schemas']['StatusWorld'] | null;
    };
    StatusHistory: {
      items: components['schemas']['StatusHistoryPoint'][];
      range: '24h' | '7d' | '30d';
      step_s: number;
    };
    StatusHistoryPoint: {
      online: boolean;
      player_count: number;
      ts: string;
    };
    StatusRun: {
      plugin_version: string;
      run_id: string;
      started_at: string;
      uptime_s: number;
    };
    StatusTelemetry: {
      delayed_since: string | null;
      last_heartbeat_at: string | null;
      live: boolean;
    };
    StatusWorld: {
      day: number;
      name: string;
      net_time: number;
      time_of_day: number;
      uid: number;
    };
    StoredEvent: {
      type: 'StoredEvent';
    } & (Omit<components['schemas']['EventEnvelope'], 'type'> & {
      received_at: string;
    });
    StreamFrame: {
      data:
        | components['schemas']['Status']
        | components['schemas']['OnlineList']
        | components['schemas']['ActivityItem'];
      event: 'status' | 'online' | 'activity';
      id: string | null;
    };
    StructureBuiltData: {
      biome: components['schemas']['Biome'];
      creator_character_id: number;
      creator_platform_user_id: string | null;
      prefab: string;
      x: number;
      z: number;
    };
    StructureBuiltEvent: {
      data: components['schemas']['StructureBuiltData'];
      id: string;
      received_at?: string;
      run_id: string;
      seq: number;
      ts: string;
      type: 'structure.built';
      world_day: number;
    };
    StructureDestroyedData: {
      biome: components['schemas']['Biome'];
      creator_character_id: number | null;
      creator_platform_user_id?: string | null;
      prefab: string;
      x: number;
      z: number;
    };
    StructureDestroyedEvent: {
      data: components['schemas']['StructureDestroyedData'];
      id: string;
      received_at?: string;
      run_id: string;
      seq: number;
      ts: string;
      type: 'structure.destroyed';
      world_day: number;
    };
    StructureEvent: {
      at: string;
      biome: components['schemas']['Biome'];
      kind: 'built' | 'destroyed';
      player: components['schemas']['PlayerRef'] | null;
      prefab: string;
      x: number;
      z: number;
    };
    StructureEventPage: {
      items: components['schemas']['StructureEvent'][];
      next_cursor: string | null;
    };
    Structures: {
      built_total: number;
      by_builder: components['schemas']['StructuresByBuilder'][];
      by_prefab: components['schemas']['StructuresByPrefab'][];
      destroyed_total: number;
      series: components['schemas']['StructuresSeriesPoint'][];
    };
    StructuresByBuilder: {
      built: number;
      player: components['schemas']['PlayerRef'] | null;
      world: boolean;
    };
    StructuresByPrefab: {
      built: number;
      prefab: string;
    };
    StructuresSeriesPoint: {
      built: number;
      date: string;
      destroyed: number;
    };
    TelemetryEvent:
      | components['schemas']['ServerStartedEvent']
      | components['schemas']['ServerStoppingEvent']
      | components['schemas']['ServerHeartbeatEvent']
      | components['schemas']['WorldSaveStartedEvent']
      | components['schemas']['WorldSavedEvent']
      | components['schemas']['PlayerJoinedEvent']
      | components['schemas']['PlayerSpawnedEvent']
      | components['schemas']['PlayerDiedEvent']
      | components['schemas']['PlayerLeftEvent']
      | components['schemas']['PlayerBiomeChangedEvent']
      | components['schemas']['PlayerPositionEvent']
      | components['schemas']['BossSummonedEvent']
      | components['schemas']['BossEngagedEvent']
      | components['schemas']['BossDefeatedEvent']
      | components['schemas']['GlobalKeySetEvent']
      | components['schemas']['RaidStartedEvent']
      | components['schemas']['RaidEndedEvent']
      | components['schemas']['StructureBuiltEvent']
      | components['schemas']['StructureDestroyedEvent']
      | components['schemas']['CreatureDiedEvent']
      | components['schemas']['ChatMessageEvent']
      | components['schemas']['AnnouncementShownEvent'];
    World: {
      day: number;
      day_length_s: number;
      map: components['schemas']['WorldMap'] | null;
      name: string;
      net_time: number;
      rollbacks: components['schemas']['WorldRollback'][];
      saves: components['schemas']['WorldSaves'];
      uid: number;
    };
    WorldDawnApproachingData: {
      dawn_at: string;
      dawn_in_s: number;
      net_time: number;
    };
    WorldDawnApproachingEvent: {
      data: components['schemas']['WorldDawnApproachingData'];
      id: string;
      received_at?: string;
      run_id: string;
      seq: number;
      ts: string;
      type: 'world.dawn_approaching';
      world_day: number;
    };
    WorldDuskApproachingData: {
      dusk_at: string;
      dusk_in_s: number;
      net_time: number;
    };
    WorldDuskApproachingEvent: {
      data: components['schemas']['WorldDuskApproachingData'];
      id: string;
      received_at?: string;
      run_id: string;
      seq: number;
      ts: string;
      type: 'world.dusk_approaching';
      world_day: number;
    };
    WorldMap: {
      available: boolean;
      generated_at: string | null;
      image_url: string | null;
      radius_m: number | null;
      size_px: number | null;
    };
    WorldRollback: {
      detected_at: string;
      from_net_time: number;
      to_net_time: number;
    };
    WorldRollbackDetectedData: {
      from_net_time: number;
      to_net_time: number;
    };
    WorldRollbackDetectedEvent: {
      data: components['schemas']['WorldRollbackDetectedData'];
      id: string;
      received_at?: string;
      run_id: string;
      seq: number;
      ts: string;
      type: 'world.rollback_detected';
      world_day: number;
    };
    WorldSavedData: {
      duration_ms: number;
    };
    WorldSavedEvent: {
      data: components['schemas']['WorldSavedData'];
      id: string;
      received_at?: string;
      run_id: string;
      seq: number;
      ts: string;
      type: 'world.saved';
      world_day: number;
    };
    WorldSaves: {
      avg_duration_ms: number | null;
      count_24h: number;
      last_at: string | null;
    };
    WorldSaveStartedData: Record<string, never>;
    WorldSaveStartedEvent: {
      data: components['schemas']['WorldSaveStartedData'];
      id: string;
      received_at?: string;
      run_id: string;
      seq: number;
      ts: string;
      type: 'world.save_started';
      world_day: number;
    };
    ZoneCompletion: {
      cpu: components['schemas']['ZoneTestStatus'];
      interrupted: boolean;
      network: components['schemas']['ZoneTestStatus'];
      stability: components['schemas']['ZoneTestStatus'];
      tabLostFocus: boolean;
      warnings: string[];
    };
    ZoneCpu: {
      kernel: 'vzd-cpu-1.0.0';
      multiThread: number | null;
      samples: number[];
      singleThread: number | null;
      variance: number | null;
      workersUsed: number | null;
    };
    ZoneExplanation: {
      limiting: string[];
      reason: string;
      strongest: string[];
      summary: string;
    };
    ZoneMeasurements: {
      cpu: components['schemas']['ZoneCpu'];
      network: components['schemas']['ZoneNetwork'];
      stability: components['schemas']['ZoneStability'];
    };
    ZoneNetwork: {
      downloadMbps: number | null;
      endpointReachable: boolean;
      failedRequests: number;
      failureRate: number | null;
      jitterMs: number | null;
      latencyMedianMs: number | null;
      latencyP95Ms: number | null;
      latencySamplesMs: number[];
      totalRequests: number;
      uploadMbps: number | null;
    };
    ZonePenalty: {
      amount: number;
      id: components['schemas']['ZonePenaltyId'];
      message: string;
    };
    ZonePenaltyId:
      | 'net-fail-severe'
      | 'net-fail-high'
      | 'net-fail-moderate'
      | 'jitter-extreme'
      | 'jitter-high'
      | 'latency-extreme'
      | 'latency-high'
      | 'cpu-failed'
      | 'network-failed'
      | 'unstable-bench';
    ZoneRankedResult: {
      explanation: components['schemas']['ZoneExplanation'];
      name: string;
      rank: number;
      rating: components['schemas']['ZoneRating'];
      recommendation: components['schemas']['ZoneRecommendation'];
      result: components['schemas']['ZoneResult'];
      scores: components['schemas']['ZoneScores'];
      tested_at: string;
    };
    ZoneRating: 'excellent' | 'strong' | 'acceptable' | 'weak' | 'poor';
    ZoneRecommendation: 'primary' | 'backup' | 'avoid';
    ZoneResult: {
      completion: components['schemas']['ZoneCompletion'];
      diagnosticTarget: components['schemas']['ZoneTarget'];
      diagnosticVersion: string;
      measurements: components['schemas']['ZoneMeasurements'];
      penalties: components['schemas']['ZonePenalty'][];
      player: {
        name: string;
      };
      rating: components['schemas']['ZoneRating'];
      schemaVersion: 1;
      scores: components['schemas']['ZoneScores'];
      system: components['schemas']['ZoneSystem'];
      testedAt: string;
    };
    ZoneResultList: {
      items: components['schemas']['ZoneRankedResult'][];
    };
    ZoneScores: {
      cpu: number;
      network: number;
      overall: number;
      secondary: number;
      stability: number;
    };
    ZoneStability: {
      frameTimeMedianMs: number | null;
      frameTimeP95Ms: number | null;
      gpuApi: 'webgl2' | 'webgl' | 'none';
      gpuFrameMs: number | null;
      stallCount: number | null;
    };
    ZoneSystem: {
      browser: string | null;
      browserSource: components['schemas']['ZoneValueSource'];
      deviceMemoryGB: number | null;
      deviceMemorySource: components['schemas']['ZoneValueSource'];
      gpuRenderer: string | null;
      gpuSource: components['schemas']['ZoneValueSource'];
      gpuVendor: string | null;
      hardwareConcurrency: number | null;
      logicalProcessors: number | null;
      logicalProcessorsSource: components['schemas']['ZoneValueSource'];
      platform: string | null;
      platformSource: components['schemas']['ZoneValueSource'];
      userAgentDataBrands: string[] | null;
    };
    ZoneTarget: {
      endpoint: string;
      label: string;
    };
    ZoneTestStatus: 'ok' | 'failed' | 'partial' | 'skipped';
    ZoneValueSource: 'measured' | 'reported' | 'unavailable';
  };
  responses: never;
  parameters: {
    Alias: string;
    AnnouncementId: number;
    BossKey: string;
    Cursor: string;
    EventId: string;
    JobId: number;
    LastEventId: string;
    Limit: number;
    PlayerFilter: number;
    PlayerId: number;
    RaidId: number;
    Since: string;
    TelemetrySignature: string;
    TelemetryTimestamp: number;
    Types: string;
    Until: string;
    ZoneName: string;
  };
  requestBodies: never;
  headers: {
    CacheControl: string;
    ETag: string;
    NoStore: string;
  };
  pathItems: never;
}
export type ActivityItem = components['schemas']['ActivityItem'];
export type ActivityLinks = components['schemas']['ActivityLinks'];
export type ActivityPage = components['schemas']['ActivityPage'];
export type AdminHealth = components['schemas']['AdminHealth'];
export type AdminHealthA2s = components['schemas']['AdminHealthA2s'];
export type AdminHealthBackup = components['schemas']['AdminHealthBackup'];
export type AdminHealthDb = components['schemas']['AdminHealthDb'];
export type AdminHealthIngest = components['schemas']['AdminHealthIngest'];
export type AdminHealthJob = components['schemas']['AdminHealthJob'];
export type AdminHealthMap = components['schemas']['AdminHealthMap'];
export type AdminPlayer = components['schemas']['AdminPlayer'];
export type AdminPlayerPage = components['schemas']['AdminPlayerPage'];
export type AdminSession = components['schemas']['AdminSession'];
export type Announcement = components['schemas']['Announcement'];
export type AnnouncementCreate = components['schemas']['AnnouncementCreate'];
export type AnnouncementKind = components['schemas']['AnnouncementKind'];
export type AnnouncementList = components['schemas']['AnnouncementList'];
export type AnnouncementShownData = components['schemas']['AnnouncementShownData'];
export type AnnouncementShownEvent = components['schemas']['AnnouncementShownEvent'];
export type AnnouncementStatus = components['schemas']['AnnouncementStatus'];
export type Backup = components['schemas']['Backup'];
export type BackupList = components['schemas']['BackupList'];
export type Biome = components['schemas']['Biome'];
export type Boss = components['schemas']['Boss'];
export type BossDefeat = components['schemas']['BossDefeat'];
export type BossDefeatedData = components['schemas']['BossDefeatedData'];
export type BossDefeatedEvent = components['schemas']['BossDefeatedEvent'];
export type BossDetail = components['schemas']['BossDetail'];
export type BossEngagedData = components['schemas']['BossEngagedData'];
export type BossEngagedEvent = components['schemas']['BossEngagedEvent'];
export type BossEvent = components['schemas']['BossEvent'];
export type BossEventPage = components['schemas']['BossEventPage'];
export type BossList = components['schemas']['BossList'];
export type BossParticipation = components['schemas']['BossParticipation'];
export type BossSummonedData = components['schemas']['BossSummonedData'];
export type BossSummonedEvent = components['schemas']['BossSummonedEvent'];
export type Character = components['schemas']['Character'];
export type ChatMessage = components['schemas']['ChatMessage'];
export type ChatMessageData = components['schemas']['ChatMessageData'];
export type ChatMessageEvent = components['schemas']['ChatMessageEvent'];
export type ChatPage = components['schemas']['ChatPage'];
export type Comfort = components['schemas']['Comfort'];
export type ComfortCatalogue = components['schemas']['ComfortCatalogue'];
export type ComfortCatalogueEntry = components['schemas']['ComfortCatalogueEntry'];
export type ComfortCatalogueUpload = components['schemas']['ComfortCatalogueUpload'];
export type ComfortCondition = components['schemas']['ComfortCondition'];
export type ComfortPiece = components['schemas']['ComfortPiece'];
export type ComfortSeason = components['schemas']['ComfortSeason'];
export type CreatorAccount = components['schemas']['CreatorAccount'];
export type CreatureDiedData = components['schemas']['CreatureDiedData'];
export type CreatureDiedEvent = components['schemas']['CreatureDiedEvent'];
export type CurrentSession = components['schemas']['CurrentSession'];
export type Death = components['schemas']['Death'];
export type DeathCause = components['schemas']['DeathCause'];
export type DeathPage = components['schemas']['DeathPage'];
export type Error = components['schemas']['Error'];
export type EventEnvelope = components['schemas']['EventEnvelope'];
export type EventPage = components['schemas']['EventPage'];
export type EventType = components['schemas']['EventType'];
export type FirstKill = components['schemas']['FirstKill'];
export type GlobalKeySetData = components['schemas']['GlobalKeySetData'];
export type GlobalKeySetEvent = components['schemas']['GlobalKeySetEvent'];
export type Health = components['schemas']['Health'];
export type HeartbeatPlayer = components['schemas']['HeartbeatPlayer'];
export type HitType = components['schemas']['HitType'];
export type IngestBatch = components['schemas']['IngestBatch'];
export type IngestResult = components['schemas']['IngestResult'];
export type Job = components['schemas']['Job'];
export type JobAccepted = components['schemas']['JobAccepted'];
export type KillsByCreature = components['schemas']['KillsByCreature'];
export type LeftReason = components['schemas']['LeftReason'];
export type LoginRequest = components['schemas']['LoginRequest'];
export type MergeRequest = components['schemas']['MergeRequest'];
export type ObservedCause = components['schemas']['ObservedCause'];
export type OnlineList = components['schemas']['OnlineList'];
export type OnlinePlayer = components['schemas']['OnlinePlayer'];
export type Platform = components['schemas']['Platform'];
export type Player = components['schemas']['Player'];
export type PlayerBiome = components['schemas']['PlayerBiome'];
export type PlayerBiomeChangedData = components['schemas']['PlayerBiomeChangedData'];
export type PlayerBiomeChangedEvent = components['schemas']['PlayerBiomeChangedEvent'];
export type PlayerDiedData = components['schemas']['PlayerDiedData'];
export type PlayerDiedEvent = components['schemas']['PlayerDiedEvent'];
export type PlayerJoinedData = components['schemas']['PlayerJoinedData'];
export type PlayerJoinedEvent = components['schemas']['PlayerJoinedEvent'];
export type PlayerKills = components['schemas']['PlayerKills'];
export type PlayerLeftData = components['schemas']['PlayerLeftData'];
export type PlayerLeftEvent = components['schemas']['PlayerLeftEvent'];
export type PlayerListItem = components['schemas']['PlayerListItem'];
export type PlayerPage = components['schemas']['PlayerPage'];
export type PlayerPatch = components['schemas']['PlayerPatch'];
export type PlayerPositionData = components['schemas']['PlayerPositionData'];
export type PlayerPositionEvent = components['schemas']['PlayerPositionEvent'];
export type PlayerRaid = components['schemas']['PlayerRaid'];
export type PlayerRef = components['schemas']['PlayerRef'];
export type PlayerSpawnedData = components['schemas']['PlayerSpawnedData'];
export type PlayerSpawnedEvent = components['schemas']['PlayerSpawnedEvent'];
export type PlayerStats = components['schemas']['PlayerStats'];
export type PlayerStructures = components['schemas']['PlayerStructures'];
export type PluginAnnouncement = components['schemas']['PluginAnnouncement'];
export type Position = components['schemas']['Position'];
export type PositionList = components['schemas']['PositionList'];
export type ProbeHealth = components['schemas']['ProbeHealth'];
export type ProbePing = components['schemas']['ProbePing'];
export type ProbeUpload = components['schemas']['ProbeUpload'];
export type ProgressionKey = components['schemas']['ProgressionKey'];
export type ProgressionList = components['schemas']['ProgressionList'];
export type Raid = components['schemas']['Raid'];
export type RaidDeath = components['schemas']['RaidDeath'];
export type RaidDetail = components['schemas']['RaidDetail'];
export type RaidEndedData = components['schemas']['RaidEndedData'];
export type RaidEndedEvent = components['schemas']['RaidEndedEvent'];
export type RaidPage = components['schemas']['RaidPage'];
export type RaidStartedData = components['schemas']['RaidStartedData'];
export type RaidStartedEvent = components['schemas']['RaidStartedEvent'];
export type RecentKill = components['schemas']['RecentKill'];
export type RecentStructure = components['schemas']['RecentStructure'];
export type Run = components['schemas']['Run'];
export type RunPage = components['schemas']['RunPage'];
export type Save = components['schemas']['Save'];
export type SavePage = components['schemas']['SavePage'];
export type ServerHeartbeatData = components['schemas']['ServerHeartbeatData'];
export type ServerHeartbeatEvent = components['schemas']['ServerHeartbeatEvent'];
export type ServerLostData = components['schemas']['ServerLostData'];
export type ServerLostEvent = components['schemas']['ServerLostEvent'];
export type ServerStartedData = components['schemas']['ServerStartedData'];
export type ServerStartedEvent = components['schemas']['ServerStartedEvent'];
export type ServerStoppingData = components['schemas']['ServerStoppingData'];
export type ServerStoppingEvent = components['schemas']['ServerStoppingEvent'];
export type Session = components['schemas']['Session'];
export type SessionPage = components['schemas']['SessionPage'];
export type Status = components['schemas']['Status'];
export type StatusHistory = components['schemas']['StatusHistory'];
export type StatusHistoryPoint = components['schemas']['StatusHistoryPoint'];
export type StatusRun = components['schemas']['StatusRun'];
export type StatusTelemetry = components['schemas']['StatusTelemetry'];
export type StatusWorld = components['schemas']['StatusWorld'];
export type StoredEvent = components['schemas']['StoredEvent'];
export type StreamFrame = components['schemas']['StreamFrame'];
export type StructureBuiltData = components['schemas']['StructureBuiltData'];
export type StructureBuiltEvent = components['schemas']['StructureBuiltEvent'];
export type StructureDestroyedData = components['schemas']['StructureDestroyedData'];
export type StructureDestroyedEvent = components['schemas']['StructureDestroyedEvent'];
export type StructureEvent = components['schemas']['StructureEvent'];
export type StructureEventPage = components['schemas']['StructureEventPage'];
export type Structures = components['schemas']['Structures'];
export type StructuresByBuilder = components['schemas']['StructuresByBuilder'];
export type StructuresByPrefab = components['schemas']['StructuresByPrefab'];
export type StructuresSeriesPoint = components['schemas']['StructuresSeriesPoint'];
export type TelemetryEvent = components['schemas']['TelemetryEvent'];
export type World = components['schemas']['World'];
export type WorldDawnApproachingData = components['schemas']['WorldDawnApproachingData'];
export type WorldDawnApproachingEvent = components['schemas']['WorldDawnApproachingEvent'];
export type WorldDuskApproachingData = components['schemas']['WorldDuskApproachingData'];
export type WorldDuskApproachingEvent = components['schemas']['WorldDuskApproachingEvent'];
export type WorldMap = components['schemas']['WorldMap'];
export type WorldRollback = components['schemas']['WorldRollback'];
export type WorldRollbackDetectedData = components['schemas']['WorldRollbackDetectedData'];
export type WorldRollbackDetectedEvent = components['schemas']['WorldRollbackDetectedEvent'];
export type WorldSavedData = components['schemas']['WorldSavedData'];
export type WorldSavedEvent = components['schemas']['WorldSavedEvent'];
export type WorldSaves = components['schemas']['WorldSaves'];
export type WorldSaveStartedData = components['schemas']['WorldSaveStartedData'];
export type WorldSaveStartedEvent = components['schemas']['WorldSaveStartedEvent'];
export type ZoneCompletion = components['schemas']['ZoneCompletion'];
export type ZoneCpu = components['schemas']['ZoneCpu'];
export type ZoneExplanation = components['schemas']['ZoneExplanation'];
export type ZoneMeasurements = components['schemas']['ZoneMeasurements'];
export type ZoneNetwork = components['schemas']['ZoneNetwork'];
export type ZonePenalty = components['schemas']['ZonePenalty'];
export type ZonePenaltyId = components['schemas']['ZonePenaltyId'];
export type ZoneRankedResult = components['schemas']['ZoneRankedResult'];
export type ZoneRating = components['schemas']['ZoneRating'];
export type ZoneRecommendation = components['schemas']['ZoneRecommendation'];
export type ZoneResult = components['schemas']['ZoneResult'];
export type ZoneResultList = components['schemas']['ZoneResultList'];
export type ZoneScores = components['schemas']['ZoneScores'];
export type ZoneStability = components['schemas']['ZoneStability'];
export type ZoneSystem = components['schemas']['ZoneSystem'];
export type ZoneTarget = components['schemas']['ZoneTarget'];
export type ZoneTestStatus = components['schemas']['ZoneTestStatus'];
export type ZoneValueSource = components['schemas']['ZoneValueSource'];
export type ParameterAlias = components['parameters']['Alias'];
export type ParameterAnnouncementId = components['parameters']['AnnouncementId'];
export type ParameterBossKey = components['parameters']['BossKey'];
export type ParameterCursor = components['parameters']['Cursor'];
export type ParameterEventId = components['parameters']['EventId'];
export type ParameterJobId = components['parameters']['JobId'];
export type ParameterLastEventId = components['parameters']['LastEventId'];
export type ParameterLimit = components['parameters']['Limit'];
export type ParameterPlayerFilter = components['parameters']['PlayerFilter'];
export type ParameterPlayerId = components['parameters']['PlayerId'];
export type ParameterRaidId = components['parameters']['RaidId'];
export type ParameterSince = components['parameters']['Since'];
export type ParameterTelemetrySignature = components['parameters']['TelemetrySignature'];
export type ParameterTelemetryTimestamp = components['parameters']['TelemetryTimestamp'];
export type ParameterTypes = components['parameters']['Types'];
export type ParameterUntil = components['parameters']['Until'];
export type ParameterZoneName = components['parameters']['ZoneName'];
export type HeaderCacheControl = components['headers']['CacheControl'];
export type HeaderETag = components['headers']['ETag'];
export type HeaderNoStore = components['headers']['NoStore'];
export type $defs = Record<string, never>;
export interface operations {
  ingestBatch: {
    parameters: {
      query?: never;
      header: {
        'X-Telemetry-Signature': components['parameters']['TelemetrySignature'];
        'X-Telemetry-Timestamp': components['parameters']['TelemetryTimestamp'];
      };
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['IngestBatch'];
      };
    };
    responses: {
      200: {
        headers: {
          'Cache-Control': components['headers']['NoStore'];
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['IngestResult'];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      413: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      501: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  ingestCatalogue: {
    parameters: {
      query?: never;
      header: {
        'X-Telemetry-Signature': components['parameters']['TelemetrySignature'];
        'X-Telemetry-Timestamp': components['parameters']['TelemetryTimestamp'];
      };
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['ComfortCatalogueUpload'];
      };
    };
    responses: {
      204: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      413: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      501: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  ingestMap: {
    parameters: {
      query?: never;
      header: {
        'X-Map-Radius': number;
        'X-Map-Size': number;
        'X-Telemetry-Signature': components['parameters']['TelemetrySignature'];
        'X-Telemetry-Timestamp': components['parameters']['TelemetryTimestamp'];
        'X-World-Uid': number;
      };
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'image/png': string;
      };
    };
    responses: {
      204: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      413: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      501: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  listActivity: {
    parameters: {
      query?: {
        cursor?: components['parameters']['Cursor'];
        limit?: components['parameters']['Limit'];
        player?: components['parameters']['PlayerFilter'];
        since?: components['parameters']['Since'];
        types?: components['parameters']['Types'];
        until?: components['parameters']['Until'];
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          'Cache-Control': components['headers']['CacheControl'];
          ETag: components['headers']['ETag'];
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ActivityPage'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      501: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  listAnnouncements: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          'Cache-Control': components['headers']['NoStore'];
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['AnnouncementList'];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      501: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  createAnnouncement: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['AnnouncementCreate'];
      };
    };
    responses: {
      201: {
        headers: {
          'Cache-Control': components['headers']['NoStore'];
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Announcement'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      501: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  cancelAnnouncement: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: components['parameters']['AnnouncementId'];
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      204: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      501: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  listBackups: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          'Cache-Control': components['headers']['NoStore'];
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['BackupList'];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      501: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  runBackup: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      202: {
        headers: {
          'Cache-Control': components['headers']['NoStore'];
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['JobAccepted'];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      501: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  listAdminEvents: {
    parameters: {
      query?: {
        cursor?: components['parameters']['Cursor'];
        limit?: components['parameters']['Limit'];
        player?: components['parameters']['PlayerFilter'];
        run_id?: string;
        since?: components['parameters']['Since'];
        type?: components['schemas']['EventType'];
        until?: components['parameters']['Until'];
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          'Cache-Control': components['headers']['NoStore'];
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['EventPage'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      501: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  getAdminEvent: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: components['parameters']['EventId'];
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          'Cache-Control': components['headers']['NoStore'];
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['StoredEvent'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      501: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  getAdminHealth: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          'Cache-Control': components['headers']['NoStore'];
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['AdminHealth'];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      501: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  getJob: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: components['parameters']['JobId'];
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          'Cache-Control': components['headers']['NoStore'];
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Job'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      501: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  adminLogin: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['LoginRequest'];
      };
    };
    responses: {
      204: {
        headers: {
          'Set-Cookie'?: string;
          [name: string]: unknown;
        };
        content?: never;
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      501: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  adminLogout: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      204: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      501: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  listAdminPlayers: {
    parameters: {
      query?: {
        cursor?: components['parameters']['Cursor'];
        include_hidden?: boolean;
        limit?: components['parameters']['Limit'];
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          'Cache-Control': components['headers']['NoStore'];
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['AdminPlayerPage'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      501: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  updateAdminPlayer: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: components['parameters']['PlayerId'];
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['PlayerPatch'];
      };
    };
    responses: {
      200: {
        headers: {
          'Cache-Control': components['headers']['NoStore'];
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['AdminPlayer'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      501: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  deleteAdminPlayerAlias: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        alias: components['parameters']['Alias'];
        id: components['parameters']['PlayerId'];
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      204: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      501: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  mergeAdminPlayer: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: components['parameters']['PlayerId'];
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['MergeRequest'];
      };
    };
    responses: {
      200: {
        headers: {
          'Cache-Control': components['headers']['NoStore'];
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['AdminPlayer'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      501: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  rebuildProjections: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      202: {
        headers: {
          'Cache-Control': components['headers']['NoStore'];
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['JobAccepted'];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      501: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  getAdminSession: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          'Cache-Control': components['headers']['NoStore'];
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['AdminSession'];
        };
      };
      501: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  listBosses: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          'Cache-Control': components['headers']['CacheControl'];
          ETag: components['headers']['ETag'];
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['BossList'];
        };
      };
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      501: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  getBoss: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        key: components['parameters']['BossKey'];
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          'Cache-Control': components['headers']['CacheControl'];
          ETag: components['headers']['ETag'];
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['BossDetail'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      501: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  listBossEvents: {
    parameters: {
      query?: {
        cursor?: components['parameters']['Cursor'];
        limit?: components['parameters']['Limit'];
      };
      header?: never;
      path: {
        key: components['parameters']['BossKey'];
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          'Cache-Control': components['headers']['CacheControl'];
          ETag: components['headers']['ETag'];
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['BossEventPage'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      501: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  listChat: {
    parameters: {
      query?: {
        cursor?: components['parameters']['Cursor'];
        kind?: 'shout' | 'ping' | 'say';
        limit?: components['parameters']['Limit'];
        player?: components['parameters']['PlayerFilter'];
        since?: components['parameters']['Since'];
        until?: components['parameters']['Until'];
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          'Cache-Control': components['headers']['CacheControl'];
          ETag: components['headers']['ETag'];
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ChatPage'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      501: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  getComfort: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          'Cache-Control': components['headers']['CacheControl'];
          ETag: components['headers']['ETag'];
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Comfort'];
        };
      };
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      501: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  getHealth: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          'Cache-Control': components['headers']['NoStore'];
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Health'];
        };
      };
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  getOnline: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          'Cache-Control': components['headers']['CacheControl'];
          ETag: components['headers']['ETag'];
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['OnlineList'];
        };
      };
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      501: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  getOpenApi: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          'Cache-Control': components['headers']['CacheControl'];
          ETag: components['headers']['ETag'];
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            [key: string]: unknown;
          };
        };
      };
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  listPlayers: {
    parameters: {
      query?: {
        cursor?: components['parameters']['Cursor'];
        limit?: components['parameters']['Limit'];
        online?: boolean;
        order?: 'asc' | 'desc';
        q?: string;
        sort?: 'playtime' | 'last_seen' | 'deaths' | 'kills' | 'name' | 'first_seen';
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          'Cache-Control': components['headers']['CacheControl'];
          ETag: components['headers']['ETag'];
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['PlayerPage'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      501: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  getPlayer: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: components['parameters']['PlayerId'];
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          'Cache-Control': components['headers']['CacheControl'];
          ETag: components['headers']['ETag'];
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Player'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      501: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  listPlayerActivity: {
    parameters: {
      query?: {
        cursor?: components['parameters']['Cursor'];
        limit?: components['parameters']['Limit'];
        since?: components['parameters']['Since'];
        types?: components['parameters']['Types'];
        until?: components['parameters']['Until'];
      };
      header?: never;
      path: {
        id: components['parameters']['PlayerId'];
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          'Cache-Control': components['headers']['CacheControl'];
          ETag: components['headers']['ETag'];
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ActivityPage'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      501: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  listPlayerDeaths: {
    parameters: {
      query?: {
        cursor?: components['parameters']['Cursor'];
        limit?: components['parameters']['Limit'];
      };
      header?: never;
      path: {
        id: components['parameters']['PlayerId'];
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          'Cache-Control': components['headers']['CacheControl'];
          ETag: components['headers']['ETag'];
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['DeathPage'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      501: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  getPlayerKills: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: components['parameters']['PlayerId'];
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          'Cache-Control': components['headers']['CacheControl'];
          ETag: components['headers']['ETag'];
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['PlayerKills'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      501: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  getPlayerPositions: {
    parameters: {
      query?: {
        limit?: number;
        range?: '1h' | '6h' | '24h' | '7d';
      };
      header?: never;
      path: {
        id: components['parameters']['PlayerId'];
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          'Cache-Control': components['headers']['CacheControl'];
          ETag: components['headers']['ETag'];
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['PositionList'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      501: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  listPlayerSessions: {
    parameters: {
      query?: {
        cursor?: components['parameters']['Cursor'];
        limit?: components['parameters']['Limit'];
      };
      header?: never;
      path: {
        id: components['parameters']['PlayerId'];
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          'Cache-Control': components['headers']['CacheControl'];
          ETag: components['headers']['ETag'];
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['SessionPage'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      501: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  getPlayerStructures: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: components['parameters']['PlayerId'];
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          'Cache-Control': components['headers']['CacheControl'];
          ETag: components['headers']['ETag'];
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['PlayerStructures'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      501: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  getProgression: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          'Cache-Control': components['headers']['CacheControl'];
          ETag: components['headers']['ETag'];
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ProgressionList'];
        };
      };
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      501: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  listRaids: {
    parameters: {
      query?: {
        cursor?: components['parameters']['Cursor'];
        limit?: components['parameters']['Limit'];
        since?: components['parameters']['Since'];
        until?: components['parameters']['Until'];
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          'Cache-Control': components['headers']['CacheControl'];
          ETag: components['headers']['ETag'];
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['RaidPage'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      501: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  getRaid: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: components['parameters']['RaidId'];
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          'Cache-Control': components['headers']['CacheControl'];
          ETag: components['headers']['ETag'];
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['RaidDetail'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      501: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  listRuns: {
    parameters: {
      query?: {
        cursor?: components['parameters']['Cursor'];
        limit?: components['parameters']['Limit'];
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          'Cache-Control': components['headers']['CacheControl'];
          ETag: components['headers']['ETag'];
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['RunPage'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      501: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  listSaves: {
    parameters: {
      query?: {
        cursor?: components['parameters']['Cursor'];
        limit?: components['parameters']['Limit'];
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          'Cache-Control': components['headers']['CacheControl'];
          ETag: components['headers']['ETag'];
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['SavePage'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      501: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  getStatus: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          'Cache-Control': components['headers']['CacheControl'];
          ETag: components['headers']['ETag'];
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Status'];
        };
      };
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      501: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  getStatusHistory: {
    parameters: {
      query?: {
        range?: '24h' | '7d' | '30d';
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          'Cache-Control': components['headers']['CacheControl'];
          ETag: components['headers']['ETag'];
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['StatusHistory'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      501: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  streamEvents: {
    parameters: {
      query?: {
        last_event_id?: string;
      };
      header?: {
        'Last-Event-ID'?: components['parameters']['LastEventId'];
      };
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          'Cache-Control': components['headers']['NoStore'];
          [name: string]: unknown;
        };
        content: {
          'text/event-stream': components['schemas']['StreamFrame'];
        };
      };
      501: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  getStructures: {
    parameters: {
      query?: {
        range?: '7d' | '30d' | 'all';
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          'Cache-Control': components['headers']['CacheControl'];
          ETag: components['headers']['ETag'];
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Structures'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      501: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  listStructureEvents: {
    parameters: {
      query?: {
        cursor?: components['parameters']['Cursor'];
        limit?: components['parameters']['Limit'];
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          'Cache-Control': components['headers']['CacheControl'];
          ETag: components['headers']['ETag'];
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['StructureEventPage'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      501: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  getWorld: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          'Cache-Control': components['headers']['CacheControl'];
          ETag: components['headers']['ETag'];
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['World'];
        };
      };
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      501: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  getWorldMap: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          'Cache-Control': components['headers']['CacheControl'];
          ETag: components['headers']['ETag'];
          [name: string]: unknown;
        };
        content: {
          'image/png': string;
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      501: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  getZoneProbeDownload: {
    parameters: {
      query?: {
        bytes?: number;
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          'Cache-Control': components['headers']['NoStore'];
          [name: string]: unknown;
        };
        content: {
          'application/octet-stream': string;
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      501: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  getZoneProbeHealth: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          'Cache-Control': components['headers']['NoStore'];
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ProbeHealth'];
        };
      };
      501: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  getZoneProbePing: {
    parameters: {
      query?: {
        t?: string;
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          'Cache-Control': components['headers']['NoStore'];
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ProbePing'];
        };
      };
      501: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  postZoneProbeUpload: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/octet-stream': string;
      };
    };
    responses: {
      200: {
        headers: {
          'Cache-Control': components['headers']['NoStore'];
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ProbeUpload'];
        };
      };
      413: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      501: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  listZoneResults: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          'Cache-Control': components['headers']['CacheControl'];
          ETag: components['headers']['ETag'];
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ZoneResultList'];
        };
      };
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      501: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  putZoneResult: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        name: components['parameters']['ZoneName'];
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['ZoneResult'];
      };
    };
    responses: {
      200: {
        headers: {
          'Cache-Control': components['headers']['NoStore'];
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ZoneRankedResult'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      501: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  deleteZoneResult: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        name: components['parameters']['ZoneName'];
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      204: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      501: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
}
