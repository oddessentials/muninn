import { getDb, type Database } from './db/client';
import { settings as settingsTable } from './db/schema';
import { env } from './env';
import { badRequest, conflict } from './http/respond';

export const featureNames = ['chat', 'positions', 'map', 'platform_ids'] as const;
export type FeatureName = (typeof featureNames)[number];
export type Features = Record<FeatureName, boolean>;

export interface SiteSettings {
  site_name: string;
  steam_query_host: string;
  steam_query_port: number;
  features: Features;
}

export const lockableFields = ['site_name', 'steam_query_host', 'steam_query_port'] as const;
export type LockableField = (typeof lockableFields)[number];

export interface ResolvedSettings extends SiteSettings {
  locked: LockableField[];
}

export interface SettingsUpdate {
  site_name?: string;
  steam_query_host?: string;
  steam_query_port?: number;
  features?: Partial<Features>;
}

export interface SettingsEnvironment {
  readonly publicSiteName: string;
  readonly steamQueryHost: string;
  readonly steamQueryPort: number | null;
}

export const environmentVariables: Record<LockableField, string> = {
  site_name: 'PUBLIC_SITE_NAME',
  steam_query_host: 'STEAM_QUERY_HOST',
  steam_query_port: 'STEAM_QUERY_PORT'
};

export const defaultSettings: SiteSettings = {
  site_name: 'Valheim guild',
  steam_query_host: '',
  steam_query_port: 2457,
  features: { chat: true, positions: true, map: true, platform_ids: true }
};

export const siteNameMaxLength = 60;

const hostPattern = /^[A-Za-z0-9.-]{1,253}$/;
const updatableKeys = new Set(['site_name', 'steam_query_host', 'steam_query_port', 'features']);

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validPort(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 65535;
}

export function parseSettingsUpdate(body: unknown): SettingsUpdate {
  if (!isObject(body)) throw badRequest('body must be a JSON object');
  for (const key of Object.keys(body)) {
    if (!updatableKeys.has(key)) throw badRequest(`${key} is not a setting`);
  }
  const update: SettingsUpdate = {};
  if ('site_name' in body) {
    if (typeof body.site_name !== 'string') throw badRequest('site_name must be a string');
    const name = body.site_name.trim();
    if (name.length === 0 || name.length > siteNameMaxLength) {
      throw badRequest(`site_name must be 1 to ${siteNameMaxLength} characters`);
    }
    update.site_name = name;
  }
  if ('steam_query_host' in body) {
    if (typeof body.steam_query_host !== 'string') {
      throw badRequest('steam_query_host must be a string');
    }
    const host = body.steam_query_host.trim();
    if (host !== '' && !hostPattern.test(host)) {
      throw badRequest('steam_query_host must be a host name or an IPv4 address, or empty');
    }
    update.steam_query_host = host;
  }
  if ('steam_query_port' in body) {
    if (!validPort(body.steam_query_port)) {
      throw badRequest('steam_query_port must be an integer from 1 to 65535');
    }
    update.steam_query_port = body.steam_query_port;
  }
  if ('features' in body) {
    if (!isObject(body.features)) throw badRequest('features must be an object');
    const features: Partial<Features> = {};
    for (const [name, value] of Object.entries(body.features)) {
      if (!(featureNames as readonly string[]).includes(name)) {
        throw badRequest(`${name} is not a feature`);
      }
      if (typeof value !== 'boolean') throw badRequest(`features.${name} must be true or false`);
      features[name as FeatureName] = value;
    }
    update.features = features;
  }
  return update;
}

export function lockedFields(environment: SettingsEnvironment): LockableField[] {
  const locked: LockableField[] = [];
  if (environment.publicSiteName) locked.push('site_name');
  if (environment.steamQueryHost) locked.push('steam_query_host');
  if (environment.steamQueryPort !== null) locked.push('steam_query_port');
  return locked;
}

export function resolveSettings(
  stored: Record<string, unknown>,
  environment: SettingsEnvironment
): ResolvedSettings {
  const storedName = typeof stored.site_name === 'string' ? stored.site_name.trim() : '';
  const storedHost = typeof stored.steam_query_host === 'string' ? stored.steam_query_host : null;
  const storedPort = validPort(stored.steam_query_port) ? stored.steam_query_port : null;
  const storedFeatures = isObject(stored.features) ? stored.features : {};
  const features = { ...defaultSettings.features };
  for (const name of featureNames) {
    const value = storedFeatures[name];
    if (typeof value === 'boolean') features[name] = value;
  }
  return {
    site_name: environment.publicSiteName || storedName || defaultSettings.site_name,
    steam_query_host:
      environment.steamQueryHost || (storedHost ?? defaultSettings.steam_query_host),
    steam_query_port: environment.steamQueryPort ?? storedPort ?? defaultSettings.steam_query_port,
    features,
    locked: lockedFields(environment)
  };
}

export function createSettingsStore(
  environment: SettingsEnvironment,
  database: () => Database = () => getDb()
) {
  async function stored(db: Database): Promise<Record<string, unknown>> {
    const rows = await db.select().from(settingsTable);
    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  }

  async function read(db: Database = database()): Promise<ResolvedSettings> {
    return resolveSettings(await stored(db), environment);
  }

  async function write(update: SettingsUpdate): Promise<ResolvedSettings> {
    for (const field of lockedFields(environment)) {
      if (update[field] !== undefined) {
        throw conflict(
          `${field} is set by the ${environmentVariables[field]} environment variable`
        );
      }
    }
    const current = await read();
    const rows: { key: string; value: unknown }[] = [];
    if (update.site_name !== undefined) rows.push({ key: 'site_name', value: update.site_name });
    if (update.steam_query_host !== undefined) {
      rows.push({ key: 'steam_query_host', value: update.steam_query_host });
    }
    if (update.steam_query_port !== undefined) {
      rows.push({ key: 'steam_query_port', value: update.steam_query_port });
    }
    if (update.features !== undefined) {
      rows.push({ key: 'features', value: { ...current.features, ...update.features } });
    }
    const now = new Date();
    for (const row of rows) {
      await database()
        .insert(settingsTable)
        .values({ key: row.key, value: row.value, updatedAt: now })
        .onConflictDoUpdate({
          target: settingsTable.key,
          set: { value: row.value, updatedAt: now }
        });
    }
    return read();
  }

  return { read, write };
}

export type SettingsStore = ReturnType<typeof createSettingsStore>;

export const featureLabels: Record<FeatureName, string> = {
  chat: 'Chat',
  positions: 'Player positions',
  map: 'The world map',
  platform_ids: 'Platform ids'
};

export const siteSettings: SettingsStore = createSettingsStore(env);

export async function siteFeatures(db?: Database): Promise<Features> {
  return (await siteSettings.read(db)).features;
}
