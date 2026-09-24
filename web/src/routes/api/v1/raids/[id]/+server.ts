import { parsePathId } from '$lib/server/http/respond';
import { publicGet } from '$lib/server/http/routes';
import { raidDetail } from '$lib/server/read/raids';

export const GET = publicGet(async ({ params }, db) =>
  raidDetail(db, parsePathId(params.id, 'id'))
);
