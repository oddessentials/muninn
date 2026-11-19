import { publicGet } from '#lib/server/http/routes.ts';
import { listBosses } from '#lib/server/read/bosses.ts';

export const GET = publicGet(async (_event, db) => ({ items: await listBosses(db) }));
