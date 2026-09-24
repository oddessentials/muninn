import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { RequestEvent } from '@sveltejs/kit';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { cookieName, createSession } from '../../src/lib/server/auth/admin';
import { getDb } from '../../src/lib/server/db/client';
import { env } from '../../src/lib/server/env';
import { applyBatchInTransaction } from '../../src/lib/server/ingest/ingest';
import {
  exportPlugin,
  imagePluginPath,
  pluginDllCandidates,
  pluginDllPath,
  pluginInfo
} from '../../src/lib/server/plugin';
import { POST as regenerate } from '../../src/routes/api/v1/admin/plugin/secret/+server';
import { resetDatabase, routeEvent, seededBatches, useTestDatabase } from './setup';

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

beforeAll(async () => {
  useTestDatabase();
  await resetDatabase();
  const db = getDb();
  for (const batch of seededBatches(1)) {
    await db.transaction((tx) => applyBatchInTransaction(tx, batch, new Date()));
  }
});

async function adminPost(path: string): Promise<RequestEvent> {
  const session = await createSession();
  const cookie = session.setCookie.split(';')[0]!.slice(cookieName.length + 1);
  const event = routeEvent(
    new Request(`http://test${path}`, { method: 'POST', headers: { origin: env.origin } })
  );
  (event as { cookies: unknown }).cookies = {
    get: (name: string) => (name === cookieName ? cookie : undefined)
  };
  return event;
}

describe('the plugin page', () => {
  it('reports the version to install, the secret and the latest server start', async () => {
    const info = await pluginInfo(getDb());
    expect(info.version).toBe(__APP_VERSION__);
    expect(info.telemetry_secret).toBe(process.env.TELEMETRY_SECRET);
    expect(info.secret_from_environment).toBe(true);
    expect(info.last_start).toMatchObject({
      at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      plugin_version: expect.any(String),
      game_version: expect.any(String)
    });
  });

  it('finds the DLL where the image keeps it, or next to the build', () => {
    expect(pluginDllCandidates('', '/srv/muninn')).toEqual([
      imagePluginPath,
      resolve('/srv/muninn', 'plugin', 'out', 'GuildTelemetry.dll'),
      resolve('/srv/muninn', '..', 'plugin', 'out', 'GuildTelemetry.dll')
    ]);
    const folder = mkdtempSync(join(tmpdir(), 'muninn-plugin-'));
    const dll = join(folder, 'GuildTelemetry.dll');
    writeFileSync(dll, 'MZ');
    expect(pluginDllPath([join(folder, 'missing.dll'), dll])).toBe(dll);
    expect(pluginDllPath([join(folder, 'missing.dll')])).toBeNull();
  });

  it('exports the DLL and a config for a game server on the same network', async () => {
    const source = mkdtempSync(join(tmpdir(), 'muninn-dll-'));
    const dll = join(source, 'GuildTelemetry.dll');
    writeFileSync(dll, 'MZ plugin');
    const target = join(mkdtempSync(join(tmpdir(), 'muninn-export-')), 'bepinex');
    expect(await exportPlugin(getDb(), target, 'http://web:3000', dll)).toEqual([
      'plugins/GuildTelemetry.dll',
      'com.guildsite.telemetry.cfg'
    ]);
    expect(readFileSync(join(target, 'plugins', 'GuildTelemetry.dll'), 'utf8')).toBe('MZ plugin');
    const config = readFileSync(join(target, 'com.guildsite.telemetry.cfg'), 'utf8');
    expect(config).toContain('Url = http://web:3000/api/ingest');
    expect(config).toContain(`Secret = ${process.env.TELEMETRY_SECRET}`);
    expect(config).toContain('AllowInsecureHttp = true');
    expect(await exportPlugin(getDb(), target, 'http://web:3000', null)).toEqual([
      'com.guildsite.telemetry.cfg'
    ]);
  });

  it('will not replace a secret that TELEMETRY_SECRET sets', async () => {
    const response = await regenerate(await adminPost('/api/v1/admin/plugin/secret'));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: 'conflict' } });
  });
});
