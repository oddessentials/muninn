import { publicGet } from '$lib/server/http/routes';
import { comfortCatalogue } from '$lib/server/read/comfort';

export const GET = publicGet(async (_event, db) => comfortCatalogue(db));
