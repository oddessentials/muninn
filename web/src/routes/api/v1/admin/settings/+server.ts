import { privateJson } from '#lib/server/http/respond.ts';
import { adminGet, adminMutation, readJsonBody } from '#lib/server/http/routes.ts';
import { parseSettingsUpdate, siteSettings } from '#lib/server/settings.ts';

export const GET = adminGet(() => siteSettings.read());

export const PUT = adminMutation(async (event) =>
  privateJson(await siteSettings.write(parseSettingsUpdate(await readJsonBody(event))))
);
