import { adminGet } from '$lib/server/http/routes';
import { pluginInfo } from '$lib/server/plugin';

export const GET = adminGet((_event, db) => pluginInfo(db));
