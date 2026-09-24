import { publicGet } from '$lib/server/http/routes';
import { worldSummary } from '$lib/server/read/world';

export const GET = publicGet(async (_event, db) => worldSummary(db));
