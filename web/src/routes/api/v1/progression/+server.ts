import { publicGet } from '#lib/server/http/routes.ts';
import { progression } from '#lib/server/read/world.ts';

export const GET = publicGet(async (_event, db) => ({ items: await progression(db) }));
