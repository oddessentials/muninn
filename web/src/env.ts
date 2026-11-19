import { defineEnvVars } from '@sveltejs/kit/env';

const optional = { schema: (value: string | undefined) => value };

export const variables = defineEnvVars({
  DATABASE_URL: optional,
  TELEMETRY_SECRET: optional,
  ADMIN_PASSWORD: optional,
  ADMIN_SESSION_SECRET: optional,
  STEAM_QUERY_HOST: optional,
  STEAM_QUERY_PORT: optional,
  PUBLIC_SITE_NAME: optional,
  ORIGIN: optional,
  PORT: optional,
  API_MOCK: optional,
  LOG_LEVEL: optional,
  BACKUP_DIR: optional,
  PG_DUMP: optional,
  BACKUPS_KEPT: optional,
  PLUGIN_DLL: optional,
  PLUGIN_EXPORT_DIR: optional,
  PLUGIN_EXPORT_ORIGIN: optional,
  API_BASE_URL: optional
});
