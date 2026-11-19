import { publicGet } from '#lib/server/http/routes.ts';
import { computeOnline } from '#lib/server/read/status.ts';

export const GET = publicGet(async (_event, db) => computeOnline(db));
