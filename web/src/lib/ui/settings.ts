import type { AdminSettings, AdminSettingsUpdate, SiteFeatures } from '$lib/api/types';

export type LockableField = AdminSettings['locked'][number];
export type FeatureName = keyof SiteFeatures;

export interface SettingsForm {
  site_name: string;
  steam_query_host: string;
  steam_query_port: string;
  features: SiteFeatures;
}

export const siteNameMaxLength = 60;

export const environmentVariables: Record<LockableField, string> = {
  site_name: 'PUBLIC_SITE_NAME',
  steam_query_host: 'STEAM_QUERY_HOST',
  steam_query_port: 'STEAM_QUERY_PORT'
};

export const featureOptions: { name: FeatureName; label: string; description: string }[] = [
  {
    name: 'chat',
    label: 'Chat',
    description: 'The Chat page and chat messages in the activity feed.'
  },
  {
    name: 'positions',
    label: 'Player positions',
    description:
      'Where players are right now on the World map, and the paths on player pages. Deaths stay on the map.'
  },
  {
    name: 'map',
    label: 'World map',
    description:
      'The World page and the map image. Plugin configs downloaded while it is off stop rendering the map.'
  },
  {
    name: 'platform_ids',
    label: 'Platform ids',
    description: "Players' Steam ids on public pages and in the public API. Admins always see them."
  }
];

const allFeaturesOn: SiteFeatures = { chat: true, positions: true, map: true, platform_ids: true };

export function settingsForm(settings: AdminSettings | null): SettingsForm {
  return {
    site_name: settings?.site_name ?? '',
    steam_query_host: settings?.steam_query_host ?? '',
    steam_query_port: settings ? String(settings.steam_query_port) : '',
    features: { ...(settings?.features ?? allFeaturesOn) }
  };
}

export type SettingsUpdateResult =
  { ok: true; body: AdminSettingsUpdate } | { ok: false; error: string };

export function buildSettingsUpdate(
  form: SettingsForm,
  current: AdminSettings
): SettingsUpdateResult {
  const locked = new Set<LockableField>(current.locked);
  const body: AdminSettingsUpdate = {};
  if (!locked.has('site_name')) {
    const name = form.site_name.trim();
    if (name.length === 0) return { ok: false, error: 'Give the site a name.' };
    if (name.length > siteNameMaxLength) {
      return { ok: false, error: `Keep the name to ${siteNameMaxLength} characters.` };
    }
    if (name !== current.site_name) body.site_name = name;
  }
  if (!locked.has('steam_query_host')) {
    const host = form.steam_query_host.trim();
    if (host !== '' && !/^[A-Za-z0-9.-]{1,253}$/.test(host)) {
      return { ok: false, error: 'The query host must be a host name or an IPv4 address.' };
    }
    if (host !== current.steam_query_host) body.steam_query_host = host;
  }
  if (!locked.has('steam_query_port')) {
    const port = Number(form.steam_query_port.trim());
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return { ok: false, error: 'The query port must be a whole number from 1 to 65535.' };
    }
    if (port !== current.steam_query_port) body.steam_query_port = port;
  }
  const features: AdminSettingsUpdate['features'] = {};
  for (const { name } of featureOptions) {
    if (form.features[name] !== current.features[name]) features[name] = form.features[name];
  }
  if (Object.keys(features).length > 0) body.features = features;
  return { ok: true, body };
}
