import { describe, expect, it } from 'vitest';
import type { AdminSettings } from '$lib/api/types';
import { buildSettingsUpdate, settingsForm } from '$lib/ui/settings';

const current: AdminSettings = {
  site_name: 'Valheim guild',
  steam_query_host: '',
  steam_query_port: 2457,
  features: { chat: true, positions: true, map: true, platform_ids: true },
  locked: []
};

describe('the settings form', () => {
  it('sends only what changed', () => {
    const form = { ...settingsForm(current), site_name: ' Ravenhold ' };
    expect(buildSettingsUpdate(form, current)).toEqual({
      ok: true,
      body: { site_name: 'Ravenhold' }
    });
    expect(buildSettingsUpdate(settingsForm(current), current)).toEqual({ ok: true, body: {} });
    expect(
      buildSettingsUpdate(
        {
          ...settingsForm(current),
          steam_query_host: 'game.example.com',
          steam_query_port: '27066'
        },
        current
      )
    ).toEqual({
      ok: true,
      body: { steam_query_host: 'game.example.com', steam_query_port: 27066 }
    });
  });

  it('explains what it cannot send', () => {
    const form = settingsForm(current);
    expect(buildSettingsUpdate({ ...form, site_name: '' }, current)).toEqual({
      ok: false,
      error: 'Give the site a name.'
    });
    expect(buildSettingsUpdate({ ...form, steam_query_host: 'a b' }, current).ok).toBe(false);
    expect(buildSettingsUpdate({ ...form, steam_query_port: '99999' }, current).ok).toBe(false);
  });

  it('leaves settings from the environment alone', () => {
    const lockedSettings: AdminSettings = { ...current, locked: ['site_name'] };
    expect(
      buildSettingsUpdate({ ...settingsForm(lockedSettings), site_name: '' }, lockedSettings)
    ).toEqual({ ok: true, body: {} });
  });
});
