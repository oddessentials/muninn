import { parseEnum } from '#lib/server/http/respond.ts';
import { publicGet } from '#lib/server/http/routes.ts';
import { structureRanges, structureSummary } from '#lib/server/read/structures.ts';

export const GET = publicGet(async ({ url }, db) =>
  structureSummary(db, parseEnum(url, 'range', structureRanges, '30d'))
);
