import { publicGet } from '#lib/server/http/routes.ts';
import { listZoneResults } from '#lib/server/read/zone.ts';

export const GET = publicGet(async (_event, db) => listZoneResults(db));
