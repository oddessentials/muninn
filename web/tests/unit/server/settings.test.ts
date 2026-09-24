import { describe, expect, it } from 'vitest';
import { ApiHttpError } from '$lib/server/http/respond';
import {
  defaultSettings,
  lockedFields,
  parseSettingsUpdate,
  resolveSettings,
  type SettingsEnvironment
} from '$lib/server/settings';

const unset: SettingsEnvironment = { publicSiteName: '', steamQueryHost: '', steamQueryPort: null };

function rejection(body: unknown): string {
  try {
    parseSettingsUpdate(body);
  } catch (error) {
    expect(error).toBeInstanceOf(ApiHttpError);
    expect((error as ApiHttpError).status).toBe(400);
    return (error as ApiHttpError).message;
  }
  throw new Error('the update was accepted');
}

describe('settings updates', () => {
  it('accepts each setting and trims text', () => {
    expect(
      parseSettingsUpdate({
        site_name: '  Ravenhold ',
        steam_query_host: ' game.example.com ',
        steam_query_port: 2457,
        features: { chat: false }
      })
    ).toEqual({
      site_name: 'Ravenhold',
      steam_query_host: 'game.example.com',
      steam_query_port: 2457,
      features: { chat: false }
    });
    expect(parseSettingsUpdate({ steam_query_host: '' })).toEqual({ steam_query_host: '' });
  });

  it('rejects what it cannot store', () => {
    expect(rejection(null)).toMatch(/JSON object/);
    expect(rejection({ theme: 'dark' })).toMatch(/theme is not a setting/);
    expect(rejection({ site_name: '   ' })).toMatch(/1 to 60 characters/);
    expect(rejection({ site_name: 'x'.repeat(61) })).toMatch(/1 to 60 characters/);
    expect(rejection({ steam_query_host: 'game server' })).toMatch(/host name/);
    expect(rejection({ steam_query_port: 0 })).toMatch(/1 to 65535/);
    expect(rejection({ steam_query_port: '2457' })).toMatch(/1 to 65535/);
    expect(rejection({ features: { weather: true } })).toMatch(/weather is not a feature/);
    expect(rejection({ features: { chat: 'off' } })).toMatch(/true or false/);
  });
});

describe('resolved settings', () => {
  it('falls back to the defaults', () => {
    expect(resolveSettings({}, unset)).toEqual({ ...defaultSettings, locked: [] });
  });

  it('uses stored values and ignores malformed ones', () => {
    expect(
      resolveSettings(
        {
          site_name: 'Ravenhold',
          steam_query_host: 'game.example.com',
          steam_query_port: 'many',
          features: { chat: false, map: 'no' }
        },
        unset
      )
    ).toEqual({
      site_name: 'Ravenhold',
      steam_query_host: 'game.example.com',
      steam_query_port: defaultSettings.steam_query_port,
      features: { ...defaultSettings.features, chat: false },
      locked: []
    });
  });

  it('lets environment variables win and marks them locked', () => {
    const environment: SettingsEnvironment = {
      publicSiteName: 'From the environment',
      steamQueryHost: '10.0.0.5',
      steamQueryPort: 27066
    };
    expect(lockedFields(environment)).toEqual([
      'site_name',
      'steam_query_host',
      'steam_query_port'
    ]);
    expect(
      resolveSettings(
        { site_name: 'Stored', steam_query_host: 'stored.example.com', steam_query_port: 2457 },
        environment
      )
    ).toMatchObject({
      site_name: 'From the environment',
      steam_query_host: '10.0.0.5',
      steam_query_port: 27066
    });
  });
});
