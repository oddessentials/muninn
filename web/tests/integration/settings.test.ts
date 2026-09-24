import { eq, inArray } from 'drizzle-orm';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Site } from '../../src/lib/api/types';
import { createSecrets, secretKeys } from '../../src/lib/server/auth/secrets';
import { getDb } from '../../src/lib/server/db/client';
import { meta } from '../../src/lib/server/db/schema';
import { batchMetaKeys } from '../../src/lib/server/ingest/ingest';
import { pollA2s, queryDisabled } from '../../src/lib/server/jobs/a2s';
import { computeStatus } from '../../src/lib/server/read/status';
import {
  createSettingsStore,
  siteSettings,
  type SettingsEnvironment
} from '../../src/lib/server/settings';
import { GET as getSite } from '../../src/routes/api/v1/site/+server';
import { resetDatabase, routeEvent, useTestDatabase } from './setup';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 120_000 });

const noSecrets = { telemetrySecret: '', adminSessionSecret: '', adminPassword: '' };
const noSettings: SettingsEnvironment = {
  publicSiteName: '',
  steamQueryHost: '',
  steamQueryPort: null
};

beforeAll(() => {
  useTestDatabase();
});

beforeEach(async () => {
  await resetDatabase();
  await getDb()
    .delete(meta)
    .where(inArray(meta.key, Object.values(secretKeys)));
});

describe('generated secrets', () => {
  it('are made once, stored and reused after a restart', async () => {
    const first = createSecrets(noSecrets);
    const telemetry = await first.telemetrySecret();
    const session = await first.sessionSecret();
    expect(telemetry).toMatch(/^[\w-]{43}$/);
    expect(session).toMatch(/^[\w-]{43}$/);
    expect(session).not.toBe(telemetry);
    const restarted = createSecrets(noSecrets);
    expect(await restarted.telemetrySecret()).toBe(telemetry);
    expect(await restarted.sessionSecret()).toBe(session);
  });

  it('come from the environment when set, and those cannot be regenerated', async () => {
    const secrets = createSecrets({ ...noSecrets, telemetrySecret: 'from-the-environment' });
    expect(await secrets.telemetrySecret()).toBe('from-the-environment');
    await expect(secrets.regenerateTelemetrySecret()).rejects.toThrow(/set in the environment/);
    const stored = await getDb().select().from(meta).where(eq(meta.key, secretKeys.telemetry));
    expect(stored).toHaveLength(0);
  });

  it('replace the telemetry secret on request', async () => {
    const secrets = createSecrets(noSecrets);
    const before = await secrets.telemetrySecret();
    const after = await secrets.regenerateTelemetrySecret();
    expect(after).not.toBe(before);
    expect(await createSecrets(noSecrets).telemetrySecret()).toBe(after);
  });
});

describe('the first admin password', () => {
  it('is set once and then checked against its hash', async () => {
    const secrets = createSecrets(noSecrets);
    expect(await secrets.passwordSource()).toBe('unset');
    expect(await secrets.verifyPassword('anything at all')).toBe(false);
    expect(await secrets.setInitialPassword('first password')).toBe(true);
    expect(await secrets.setInitialPassword('second password')).toBe(false);
    const restarted = createSecrets(noSecrets);
    expect(await restarted.passwordSource()).toBe('stored');
    expect(await restarted.verifyPassword('first password')).toBe(true);
    expect(await restarted.verifyPassword('second password')).toBe(false);
    const [row] = await getDb().select().from(meta).where(eq(meta.key, secretKeys.password));
    expect(row?.value).toMatch(/^scrypt\$/);
    expect(row?.value).not.toContain('first password');
  });

  it('comes from ADMIN_PASSWORD when that is set', async () => {
    const secrets = createSecrets({ ...noSecrets, adminPassword: 'from-the-environment' });
    expect(await secrets.passwordSource()).toBe('environment');
    expect(await secrets.setInitialPassword('another password')).toBe(false);
    expect(await secrets.verifyPassword('from-the-environment')).toBe(true);
  });
});

describe('site settings', () => {
  it('store changes and keep the features that were not sent', async () => {
    const store = createSettingsStore(noSettings);
    expect((await store.read()).site_name).toBe('Valheim guild');
    expect(await store.write({ site_name: 'Ravenhold', features: { chat: false } })).toMatchObject({
      site_name: 'Ravenhold',
      features: { chat: false, positions: true, map: true, platform_ids: true }
    });
    expect((await store.write({ features: { map: false } })).features).toEqual({
      chat: false,
      positions: true,
      map: false,
      platform_ids: true
    });
    expect((await createSettingsStore(noSettings).read()).site_name).toBe('Ravenhold');
  });

  it('refuse to change a setting the environment gives', async () => {
    const store = createSettingsStore({ ...noSettings, publicSiteName: 'From the environment' });
    await expect(store.write({ site_name: 'Ravenhold' })).rejects.toThrow(/PUBLIC_SITE_NAME/);
    expect(await store.read()).toMatchObject({
      site_name: 'From the environment',
      locked: ['site_name']
    });
  });

  it('are served to the site with the version and features', async () => {
    const response = await getSite(routeEvent(new Request('http://test/api/v1/site')));
    expect(response.status).toBe(200);
    const site = (await response.json()) as Site;
    const settings = await siteSettings.read();
    expect(site).toEqual({
      name: settings.site_name,
      version: __APP_VERSION__,
      features: settings.features
    });
  });
});

describe('without a Steam query host', () => {
  it('the poller stays off and the status names the server after the site', async () => {
    expect(await pollA2s(getDb(), '', 2457)).toEqual({
      ok: false,
      error: queryDisabled,
      online: null,
      playerCount: null
    });
    await getDb()
      .delete(meta)
      .where(inArray(meta.key, Object.values(batchMetaKeys)));
    const status = await computeStatus(getDb());
    expect(status.server_name).toBe((await siteSettings.read()).site_name);
  });
});
