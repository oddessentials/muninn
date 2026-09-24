import { publicGet } from '$lib/server/http/routes';
import { listZoneResults } from '$lib/server/read/zone';

export const GET = publicGet(async (_event, db) => listZoneResults(db));
