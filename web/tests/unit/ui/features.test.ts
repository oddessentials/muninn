import { describe, expect, it } from 'vitest';
import type { AdminSettings, SiteFeatures } from '$lib/api/types';
import { feedTypes, switchedOffTypes } from '$lib/server/read/activity';
import { hasPosition } from '$lib/ui/map';
import { navigation, navigationFor } from '$lib/ui/navigation';
import { buildSettingsUpdate, settingsForm } from '$lib/ui/settings';

const allOn: SiteFeatures = { chat: true, positions: true, map: true, platform_ids: true };

describe('the navigation', () => {
  it('shows every page while every feature is on', () => {
    expect(navigationFor(allOn)).toEqual(navigation);
    expect(navigationFor(null)).toEqual(navigation);
  });

  it('drops Chat and World when their features are off', () => {
    const labels = navigationFor({ ...allOn, chat: false, map: false }).map((entry) => entry.label);
    expect(labels).not.toContain('Chat');
    expect(labels).not.toContain('World');
    expect(labels).toContain('Players');
  });
});

describe('the activity feed', () => {
  it('leaves out the event types of features that are off', () => {
    expect(switchedOffTypes(allOn)).toEqual([]);
    const off = switchedOffTypes({ chat: false, positions: false });
    expect(off).toEqual(['chat.message', 'player.position']);
    expect(feedTypes(null, off)).not.toContain('chat.message');
    expect(feedTypes(['chat.message', 'player.position', 'player.died'], off)).toEqual([
      'player.died'
    ]);
  });
});

describe('map markers', () => {
  it('need both coordinates', () => {
    expect(hasPosition({ x: 1, z: 2 })).toBe(true);
    expect(hasPosition({ x: null, z: null })).toBe(false);
  });
});

describe('feature switches in the settings form', () => {
  const current: AdminSettings = {
    site_name: 'Valheim guild',
    steam_query_host: '',
    steam_query_port: 2457,
    features: allOn,
    locked: []
  };

  it('send only the switches that changed', () => {
    const form = settingsForm(current);
    form.features.chat = false;
    expect(buildSettingsUpdate(form, current)).toEqual({
      ok: true,
      body: { features: { chat: false } }
    });
    expect(current.features.chat).toBe(true);
  });
});
