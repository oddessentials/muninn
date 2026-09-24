import { parseEnum } from '$lib/server/http/respond';
import { publicGet } from '$lib/server/http/routes';
import { structureRanges, structureSummary } from '$lib/server/read/structures';

export const GET = publicGet(async ({ url }, db) =>
  structureSummary(db, parseEnum(url, 'range', structureRanges, '30d'))
);
