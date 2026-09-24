import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { PluginInfo } from '$lib/api/types';
import type { Database } from './db/client';
import { env } from './env';
import { secrets } from './auth/secrets';
import { latestRun } from './read/status';

export const pluginFileName = 'GuildTelemetry.dll';
export const imagePluginPath = `/app/plugin/${pluginFileName}`;

export function pluginDllCandidates(configured = env.pluginDll, cwd = process.cwd()): string[] {
  return [
    configured,
    imagePluginPath,
    resolve(cwd, 'plugin', 'out', pluginFileName),
    resolve(cwd, '..', 'plugin', 'out', pluginFileName)
  ].filter((path) => path !== '');
}

export function pluginDllPath(candidates = pluginDllCandidates()): string | null {
  return candidates.find((path) => existsSync(path)) ?? null;
}

export async function pluginInfo(db: Database): Promise<PluginInfo> {
  const run = await latestRun(db);
  return {
    version: __APP_VERSION__,
    telemetry_secret: await secrets.telemetrySecret(),
    secret_from_environment: secrets.telemetrySecretFromEnvironment(),
    dll_available: pluginDllPath() !== null,
    last_start: run
      ? {
          at: run.startedAt.toISOString(),
          plugin_version: run.pluginVersion,
          game_version: run.gameVersion
        }
      : null
  };
}
