import { publicGet } from '#lib/server/http/routes.ts';
import { comfortCatalogue } from '#lib/server/read/comfort.ts';

export const GET = publicGet(async (_event, db) => comfortCatalogue(db));
