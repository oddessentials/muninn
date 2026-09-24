import { describe, expect, it } from 'vitest';
import type { Status } from '$lib/api/types';
import { versionLine } from '$lib/ui/versions';

const run = (pluginVersion: string): NonNullable<Status['run']> => ({
  run_id: 'b7e2f5c3-4d6a-4b8c-8a1d-2e3f4a5b6c7d',
  started_at: '2026-09-24T00:00:00Z',
  uptime_s: 60,
  plugin_version: pluginVersion
});

describe('the footer version line', () => {
  it('lists the site, the plugin the server runs and the game', () => {
    expect(versionLine('0.6.0', { run: run('0.6.0'), game_version: '1.0.15' })).toBe(
      'Site\u00a00.6.0 · Plugin\u00a00.6.0 · Valheim\u00a01.0.15'
    );
    expect(versionLine('0.7.0', { run: run('0.6.0'), game_version: '1.0.15' })).toBe(
      'Site\u00a00.7.0 · Plugin\u00a00.6.0 · Valheim\u00a01.0.15'
    );
  });

  it('leaves out what the server is not reporting', () => {
    expect(versionLine('0.6.0', null)).toBe('Site\u00a00.6.0');
    expect(versionLine('0.6.0', { run: null, game_version: null })).toBe('Site\u00a00.6.0');
    expect(versionLine('0.6.0', { run: run(''), game_version: '1.0.15' })).toBe(
      'Site\u00a00.6.0 · Valheim\u00a01.0.15'
    );
  });
});
