import { publicGet } from '#lib/server/http/routes.ts';
import { worldSummary } from '#lib/server/read/world.ts';

export const GET = publicGet(async (_event, db) => worldSummary(db));
