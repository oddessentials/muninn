import { env as privateEnv } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';

const logLevels = ['debug', 'info', 'warn', 'error'] as const;
export type LogLevel = (typeof logLevels)[number];

export interface Env {
  readonly databaseUrl: string;
  readonly telemetrySecret: string;
  readonly adminPassword: string;
  readonly adminSessionSecret: string;
  readonly steamQueryHost: string;
  readonly steamQueryPort: number;
  readonly publicSiteName: string;
  readonly origin: string;
  readonly port: number;
  readonly apiMock: boolean;
  readonly logLevel: LogLevel;
  readonly backupDir: string;
  readonly pgDumpCommand: string;
  readonly backupsKept: number;
}

export const requiredVariables = [
  'DATABASE_URL',
  'TELEMETRY_SECRET',
  'ADMIN_PASSWORD',
  'ADMIN_SESSION_SECRET',
  'STEAM_QUERY_HOST',
  'STEAM_QUERY_PORT',
  'PUBLIC_SITE_NAME',
  'ORIGIN',
  'PORT',
  'API_MOCK',
  'LOG_LEVEL'
] as const;

export const optionalVariables = ['BACKUP_DIR', 'PG_DUMP', 'BACKUPS_KEPT'] as const;

export function validateEnvironment(source: Record<string, string | undefined>): Env {
  const missing: string[] = [];
  const invalid: string[] = [];

  const required = (name: string): string => {
    const value = source[name];
    if (value === undefined || value === '') {
      missing.push(name);
      return '';
    }
    return value;
  };

  const optional = (name: string, fallback: string): string => {
    const value = source[name];
    return value === undefined || value === '' ? fallback : value;
  };

  const integer = (name: string): number => {
    const raw = required(name);
    const value = Number(raw);
    if (raw !== '' && (!Number.isInteger(value) || value < 0)) {
      invalid.push(`${name} must be a non-negative integer`);
    }
    return value;
  };

  const optionalInteger = (name: string, fallback: number): number => {
    const raw = optional(name, String(fallback));
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 0) {
      invalid.push(`${name} must be a non-negative integer`);
      return fallback;
    }
    return value;
  };

  const flag = (name: string): boolean => {
    const raw = required(name).toLowerCase();
    if (raw !== '' && !['0', '1', 'true', 'false'].includes(raw)) {
      invalid.push(`${name} must be 0, 1, true or false`);
    }
    return raw === '1' || raw === 'true';
  };

  const logLevel = (name: string): LogLevel => {
    const raw = required(name);
    if (raw !== '' && !(logLevels as readonly string[]).includes(raw)) {
      invalid.push(`${name} must be one of ${logLevels.join(', ')}`);
    }
    return raw as LogLevel;
  };

  const values: Env = {
    databaseUrl: required('DATABASE_URL'),
    telemetrySecret: required('TELEMETRY_SECRET'),
    adminPassword: required('ADMIN_PASSWORD'),
    adminSessionSecret: required('ADMIN_SESSION_SECRET'),
    steamQueryHost: required('STEAM_QUERY_HOST'),
    steamQueryPort: integer('STEAM_QUERY_PORT'),
    publicSiteName: required('PUBLIC_SITE_NAME'),
    origin: required('ORIGIN'),
    port: integer('PORT'),
    apiMock: flag('API_MOCK'),
    logLevel: logLevel('LOG_LEVEL'),
    backupDir: optional('BACKUP_DIR', '/backups'),
    pgDumpCommand: optional('PG_DUMP', 'pg_dump'),
    backupsKept: optionalInteger('BACKUPS_KEPT', 14)
  };

  if (missing.length > 0 || invalid.length > 0) {
    const parts: string[] = [];
    if (missing.length > 0) parts.push(`missing environment variables: ${missing.join(', ')}`);
    if (invalid.length > 0) parts.push(invalid.join('; '));
    throw new Error(
      `Environment validation failed: ${parts.join('; ')}. See .env.example for every variable and its local default.`
    );
  }
  return Object.freeze(values);
}

let cached: Env | null = null;

export function loadEnv(): Env {
  if (!cached) cached = validateEnvironment({ ...privateEnv, ...publicEnv, ...process.env });
  return cached;
}

export const env: Env = new Proxy({} as Env, {
  get: (_target, property) => loadEnv()[property as keyof Env],
  has: (_target, property) => property in loadEnv(),
  ownKeys: () => Reflect.ownKeys(loadEnv()),
  getOwnPropertyDescriptor: (_target, property) => ({
    value: loadEnv()[property as keyof Env],
    enumerable: true,
    configurable: true
  })
});
