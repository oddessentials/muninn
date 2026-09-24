export const API_BASE = '/api/v1';
export const INGEST_BASE = '/api/ingest';

export const endpoints = {
  status: `${API_BASE}/status`,
  statusHistory: `${API_BASE}/status/history`,
  online: `${API_BASE}/online`,
  runs: `${API_BASE}/runs`,
  players: `${API_BASE}/players`,
  player: `${API_BASE}/players/{id}`,
  playerSessions: `${API_BASE}/players/{id}/sessions`,
  playerDeaths: `${API_BASE}/players/{id}/deaths`,
  playerKills: `${API_BASE}/players/{id}/kills`,
  playerPositions: `${API_BASE}/players/{id}/positions`,
  playerStructures: `${API_BASE}/players/{id}/structures`,
  playerActivity: `${API_BASE}/players/{id}/activity`,
  bosses: `${API_BASE}/bosses`,
  boss: `${API_BASE}/bosses/{key}`,
  bossEvents: `${API_BASE}/bosses/{key}/events`,
  raids: `${API_BASE}/raids`,
  raid: `${API_BASE}/raids/{id}`,
  progression: `${API_BASE}/progression`,
  world: `${API_BASE}/world`,
  worldMap: `${API_BASE}/world/map.png`,
  saves: `${API_BASE}/saves`,
  chat: `${API_BASE}/chat`,
  structures: `${API_BASE}/structures`,
  structuresRecent: `${API_BASE}/structures/recent`,
  comfort: `${API_BASE}/comfort`,
  activity: `${API_BASE}/activity`,
  health: `${API_BASE}/health`,
  site: `${API_BASE}/site`,
  openapi: `${API_BASE}/openapi.json`,
  stream: `${API_BASE}/stream`,
  adminLogin: `${API_BASE}/admin/login`,
  adminLogout: `${API_BASE}/admin/logout`,
  adminSession: `${API_BASE}/admin/session`,
  adminSetup: `${API_BASE}/admin/setup`,
  adminSettings: `${API_BASE}/admin/settings`,
  adminPlayers: `${API_BASE}/admin/players`,
  adminPlayer: `${API_BASE}/admin/players/{id}`,
  adminPlayerMerge: `${API_BASE}/admin/players/{id}/merge`,
  adminPlayerAlias: `${API_BASE}/admin/players/{id}/aliases/{alias}`,
  adminEvents: `${API_BASE}/admin/events`,
  adminEvent: `${API_BASE}/admin/events/{id}`,
  adminProjectionsRebuild: `${API_BASE}/admin/projections/rebuild`,
  adminBackupsRun: `${API_BASE}/admin/backups/run`,
  adminBackups: `${API_BASE}/admin/backups`,
  adminJob: `${API_BASE}/admin/jobs/{id}`,
  adminHealth: `${API_BASE}/admin/health`,
  adminAnnouncements: `${API_BASE}/admin/announcements`,
  adminAnnouncement: `${API_BASE}/admin/announcements/{id}`,
  zoneResults: `${API_BASE}/zone/results`,
  zoneResult: `${API_BASE}/zone/results/{name}`,
  zoneProbe: `${API_BASE}/zone/probe`,
  zoneProbeHealth: `${API_BASE}/zone/probe/health`,
  zoneProbePing: `${API_BASE}/zone/probe/ping`,
  zoneProbeDownload: `${API_BASE}/zone/probe/download`,
  zoneProbeUpload: `${API_BASE}/zone/probe/upload`,
  ingest: INGEST_BASE,
  ingestMap: `${INGEST_BASE}/map`,
  ingestCatalogue: `${INGEST_BASE}/catalogue`
} as const;

export type EndpointName = keyof typeof endpoints;

export function resolvePath(
  template: string,
  params: Record<string, string | number> = {}
): string {
  return template.replace(/\{(\w+)\}/g, (_match, name: string) => {
    const value = params[name];
    if (value === undefined) throw new Error(`missing path parameter ${name} for ${template}`);
    return encodeURIComponent(String(value));
  });
}
