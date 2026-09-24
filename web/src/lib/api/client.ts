import createClient from 'openapi-fetch';
import { endpoints, resolvePath } from './endpoints';
import type { components, paths } from './types';

export type ErrorCode = components['schemas']['Error']['error']['code'];

export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;

  constructor(status: number, code: ErrorCode, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }

  static async fromResponse(response: Response, body: unknown): Promise<ApiError> {
    const fallback = codeForStatus(response.status);
    const parsed = body ?? (await response.text().catch(() => ''));
    const record =
      typeof parsed === 'object' && parsed !== null
        ? (parsed as { error?: { code?: string; message?: string } })
        : undefined;
    const code = (record?.error?.code as ErrorCode | undefined) ?? fallback;
    const message =
      record?.error?.message ??
      (typeof parsed === 'string' && parsed ? parsed : `${response.status} ${response.statusText}`);
    return new ApiError(response.status, code, message);
  }
}

function codeForStatus(status: number): ErrorCode {
  switch (status) {
    case 400:
      return 'bad_request';
    case 401:
      return 'unauthorized';
    case 403:
      return 'forbidden';
    case 404:
      return 'not_found';
    case 409:
      return 'conflict';
    case 413:
      return 'payload_too_large';
    case 422:
      return 'unprocessable';
    case 429:
      return 'rate_limited';
    case 501:
      return 'not_implemented';
    default:
      return 'unavailable';
  }
}

type Get<P extends keyof paths> = paths[P] extends { get: infer O } ? O : never;
type QueryOf<O> = O extends { parameters: { query?: infer Q } } ? Q : never;

export type PlayersQuery = QueryOf<Get<'/api/v1/players'>>;
export type ActivityQuery = QueryOf<Get<'/api/v1/activity'>>;
export type PlayerActivityQuery = QueryOf<Get<'/api/v1/players/{id}/activity'>>;
export type ChatQuery = QueryOf<Get<'/api/v1/chat'>>;
export type RaidsQuery = QueryOf<Get<'/api/v1/raids'>>;
export type Pagination = { limit?: number; cursor?: string };
export type StatusHistoryRange = NonNullable<QueryOf<Get<'/api/v1/status/history'>>>['range'];
export type PositionsRange = NonNullable<QueryOf<Get<'/api/v1/players/{id}/positions'>>>['range'];
export type StructuresRange = NonNullable<QueryOf<Get<'/api/v1/structures'>>>['range'];
export type AdminEventsQuery = QueryOf<Get<'/api/v1/admin/events'>>;
export type AdminPlayersQuery = QueryOf<Get<'/api/v1/admin/players'>>;

export interface ApiOptions {
  fetch?: typeof globalThis.fetch;
  baseUrl?: string;
}

interface Outcome<T> {
  data?: T;
  error?: unknown;
  response: Response;
}

async function unwrap<T>(outcome: Promise<Outcome<T>>): Promise<T> {
  const { data, error, response } = await outcome;
  if (!response.ok || error !== undefined) throw await ApiError.fromResponse(response, error);
  return data as T;
}

async function unwrapVoid(outcome: Promise<Outcome<unknown>>): Promise<void> {
  const { error, response } = await outcome;
  if (!response.ok || (error !== undefined && response.status >= 400)) {
    throw await ApiError.fromResponse(response, error);
  }
}

export function createApi(options: ApiOptions = {}) {
  const client = createClient<paths>({
    baseUrl: options.baseUrl ?? '',
    fetch: options.fetch ?? globalThis.fetch
  });

  return {
    getStatus: () => unwrap(client.GET('/api/v1/status')),
    getStatusHistory: (range?: StatusHistoryRange) =>
      unwrap(client.GET('/api/v1/status/history', { params: { query: { range } } })),
    getOnline: () => unwrap(client.GET('/api/v1/online')),
    listRuns: (page: Pagination = {}) =>
      unwrap(client.GET('/api/v1/runs', { params: { query: page } })),
    listPlayers: (query: PlayersQuery = {}) =>
      unwrap(client.GET('/api/v1/players', { params: { query } })),
    getPlayer: (id: number) =>
      unwrap(client.GET('/api/v1/players/{id}', { params: { path: { id } } })),
    listPlayerSessions: (id: number, page: Pagination = {}) =>
      unwrap(
        client.GET('/api/v1/players/{id}/sessions', { params: { path: { id }, query: page } })
      ),
    listPlayerDeaths: (id: number, page: Pagination = {}) =>
      unwrap(client.GET('/api/v1/players/{id}/deaths', { params: { path: { id }, query: page } })),
    getPlayerKills: (id: number) =>
      unwrap(client.GET('/api/v1/players/{id}/kills', { params: { path: { id } } })),
    getPlayerPositions: (id: number, query: { range?: PositionsRange; limit?: number } = {}) =>
      unwrap(client.GET('/api/v1/players/{id}/positions', { params: { path: { id }, query } })),
    getPlayerStructures: (id: number) =>
      unwrap(client.GET('/api/v1/players/{id}/structures', { params: { path: { id } } })),
    listPlayerActivity: (id: number, query: PlayerActivityQuery = {}) =>
      unwrap(client.GET('/api/v1/players/{id}/activity', { params: { path: { id }, query } })),
    listBosses: () => unwrap(client.GET('/api/v1/bosses')),
    getBoss: (key: string) =>
      unwrap(client.GET('/api/v1/bosses/{key}', { params: { path: { key } } })),
    listBossEvents: (key: string, page: Pagination = {}) =>
      unwrap(client.GET('/api/v1/bosses/{key}/events', { params: { path: { key }, query: page } })),
    listRaids: (query: RaidsQuery = {}) =>
      unwrap(client.GET('/api/v1/raids', { params: { query } })),
    getRaid: (id: number) => unwrap(client.GET('/api/v1/raids/{id}', { params: { path: { id } } })),
    getProgression: () => unwrap(client.GET('/api/v1/progression')),
    getWorld: () => unwrap(client.GET('/api/v1/world')),
    getWorldMap: () =>
      unwrap(client.GET('/api/v1/world/map.png', { parseAs: 'blob' })) as Promise<Blob>,
    listSaves: (page: Pagination = {}) =>
      unwrap(client.GET('/api/v1/saves', { params: { query: page } })),
    listChat: (query: ChatQuery = {}) => unwrap(client.GET('/api/v1/chat', { params: { query } })),
    getStructures: (range?: StructuresRange) =>
      unwrap(client.GET('/api/v1/structures', { params: { query: { range } } })),
    listStructureEvents: (page: Pagination = {}) =>
      unwrap(client.GET('/api/v1/structures/recent', { params: { query: page } })),
    getComfort: () => unwrap(client.GET('/api/v1/comfort')),
    listActivity: (query: ActivityQuery = {}) =>
      unwrap(client.GET('/api/v1/activity', { params: { query } })),
    getHealth: () => unwrap(client.GET('/api/v1/health')),
    getOpenApi: () => unwrap(client.GET('/api/v1/openapi.json')),
    adminLogin: (password: string) =>
      unwrapVoid(client.POST('/api/v1/admin/login', { body: { password } })),
    adminLogout: () => unwrapVoid(client.POST('/api/v1/admin/logout')),
    getAdminSession: () => unwrap(client.GET('/api/v1/admin/session')),
    listAdminPlayers: (query: AdminPlayersQuery = {}) =>
      unwrap(client.GET('/api/v1/admin/players', { params: { query } })),
    updateAdminPlayer: (id: number, patch: components['schemas']['PlayerPatch']) =>
      unwrap(client.PATCH('/api/v1/admin/players/{id}', { params: { path: { id } }, body: patch })),
    mergeAdminPlayer: (id: number, into: number) =>
      unwrap(
        client.POST('/api/v1/admin/players/{id}/merge', {
          params: { path: { id } },
          body: { into }
        })
      ),
    deleteAdminPlayerAlias: (id: number, alias: string) =>
      unwrapVoid(
        client.DELETE('/api/v1/admin/players/{id}/aliases/{alias}', {
          params: { path: { id, alias } }
        })
      ),
    listAdminEvents: (query: AdminEventsQuery = {}) =>
      unwrap(client.GET('/api/v1/admin/events', { params: { query } })),
    getAdminEvent: (id: string) =>
      unwrap(client.GET('/api/v1/admin/events/{id}', { params: { path: { id } } })),
    rebuildProjections: () => unwrap(client.POST('/api/v1/admin/projections/rebuild')),
    runBackup: () => unwrap(client.POST('/api/v1/admin/backups/run')),
    listBackups: () => unwrap(client.GET('/api/v1/admin/backups')),
    getJob: (id: number) =>
      unwrap(client.GET('/api/v1/admin/jobs/{id}', { params: { path: { id } } })),
    getAdminHealth: () => unwrap(client.GET('/api/v1/admin/health')),
    listAnnouncements: () => unwrap(client.GET('/api/v1/admin/announcements')),
    createAnnouncement: (body: components['schemas']['AnnouncementCreate']) =>
      unwrap(client.POST('/api/v1/admin/announcements', { body })),
    cancelAnnouncement: (id: number) =>
      unwrapVoid(client.DELETE('/api/v1/admin/announcements/{id}', { params: { path: { id } } })),
    listZoneResults: () => unwrap(client.GET('/api/v1/zone/results')),
    putZoneResult: (name: string, result: components['schemas']['ZoneResult']) =>
      unwrap(
        client.PUT('/api/v1/zone/results/{name}', { params: { path: { name } }, body: result })
      ),
    deleteZoneResult: (name: string) =>
      unwrapVoid(client.DELETE('/api/v1/zone/results/{name}', { params: { path: { name } } })),
    worldMapUrl: endpoints.worldMap,
    streamUrl: endpoints.stream,
    zoneProbeUrl: endpoints.zoneProbe,
    pathFor: resolvePath
  };
}

export type Api = ReturnType<typeof createApi>;

export const api: Api = createApi();
