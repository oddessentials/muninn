import { publicGet } from '#lib/server/http/routes.ts';
import { computeStatus } from '#lib/server/read/status.ts';

export const GET = publicGet(async (_event, db) => computeStatus(db));
