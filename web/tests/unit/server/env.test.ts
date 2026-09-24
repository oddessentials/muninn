import { describe, expect, it } from 'vitest';
import { validateEnvironment } from '$lib/server/env';

const database = { DATABASE_URL: 'postgres://valheim:valheim@db:5432/valheim' };

describe('the environment', () => {
  it('needs only the database address and defaults everything else', () => {
    const env = validateEnvironment(database);
    expect(env).toMatchObject({
      databaseUrl: database.DATABASE_URL,
      telemetrySecret: '',
      adminPassword: '',
      adminSessionSecret: '',
      steamQueryHost: '',
      steamQueryPort: null,
      publicSiteName: '',
      origin: '',
      port: 3000,
      apiMock: false,
      logLevel: 'info',
      backupDir: '/backups',
      backupsKept: 14
    });
  });

  it('reports a missing database address', () => {
    expect(() => validateEnvironment({})).toThrow(/missing environment variables: DATABASE_URL/);
  });

  it('keeps the values that are set', () => {
    const env = validateEnvironment({
      ...database,
      TELEMETRY_SECRET: 'telemetry',
      STEAM_QUERY_HOST: 'game.example.com',
      STEAM_QUERY_PORT: '27066',
      PUBLIC_SITE_NAME: 'Ravenhold',
      API_MOCK: '1',
      LOG_LEVEL: 'debug'
    });
    expect(env).toMatchObject({
      telemetrySecret: 'telemetry',
      steamQueryHost: 'game.example.com',
      steamQueryPort: 27066,
      publicSiteName: 'Ravenhold',
      apiMock: true,
      logLevel: 'debug'
    });
  });

  it('rejects values that cannot work', () => {
    expect(() => validateEnvironment({ ...database, STEAM_QUERY_PORT: '70000' })).toThrow(
      /STEAM_QUERY_PORT must be a port number/
    );
    expect(() => validateEnvironment({ ...database, API_MOCK: 'yes' })).toThrow(
      /API_MOCK must be 0, 1, true or false/
    );
    expect(() => validateEnvironment({ ...database, LOG_LEVEL: 'loud' })).toThrow(
      /LOG_LEVEL must be one of/
    );
  });
});
