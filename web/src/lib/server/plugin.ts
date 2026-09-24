import { existsSync } from 'node:fs';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { PluginInfo } from '$lib/api/types';
import type { Database } from './db/client';
import { env } from './env';
import { secrets } from './auth/secrets';
import { latestRun } from './read/status';
import { siteFeatures } from './settings';
import { configFileName, pluginConfig } from '$lib/ui/plugin';

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

export async function exportPlugin(
  db: Database,
  directory: string,
  origin: string,
  dll = pluginDllPath()
): Promise<string[]> {
  const written: string[] = [];
  await mkdir(directory, { recursive: true });
  if (dll) {
    await mkdir(join(directory, 'plugins'), { recursive: true });
    await copyFile(dll, join(directory, 'plugins', pluginFileName));
    written.push(`plugins/${pluginFileName}`);
  }
  const config = pluginConfig({
    origin,
    secret: await secrets.telemetrySecret(),
    mapEnabled: (await siteFeatures(db)).map
  });
  await writeFile(join(directory, configFileName), config);
  written.push(configFileName);
  return written;
}

export async function exportConfiguredPlugin(db: Database): Promise<void> {
  if (!env.pluginExportDir || env.apiMock) return;
  try {
    const written = await exportPlugin(db, env.pluginExportDir, env.pluginExportOrigin);
    console.log(`plugin exported to ${env.pluginExportDir}: ${written.join(', ')}`);
  } catch (error) {
    console.error('plugin export failed', error instanceof Error ? error.message : error);
  }
}
