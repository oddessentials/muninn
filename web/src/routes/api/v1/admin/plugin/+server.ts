import { adminGet } from '#lib/server/http/routes.ts';
import { pluginInfo } from '#lib/server/plugin.ts';

export const GET = adminGet((_event, db) => pluginInfo(db));
