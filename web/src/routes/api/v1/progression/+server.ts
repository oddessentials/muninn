import { publicGet } from '$lib/server/http/routes';
import { progression } from '$lib/server/read/world';

export const GET = publicGet(async (_event, db) => ({ items: await progression(db) }));
