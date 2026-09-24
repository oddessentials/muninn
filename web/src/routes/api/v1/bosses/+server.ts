import { publicGet } from '$lib/server/http/routes';
import { listBosses } from '$lib/server/read/bosses';

export const GET = publicGet(async (_event, db) => ({ items: await listBosses(db) }));
