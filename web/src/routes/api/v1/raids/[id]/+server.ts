import { parsePathId } from '#lib/server/http/respond.ts';
import { publicGet } from '#lib/server/http/routes.ts';
import { raidDetail } from '#lib/server/read/raids.ts';

export const GET = publicGet(async ({ params }, db) =>
  raidDetail(db, parsePathId(params.id, 'id'))
);
