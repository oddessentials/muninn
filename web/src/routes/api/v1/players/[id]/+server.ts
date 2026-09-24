import { parsePathId } from '$lib/server/http/respond';
import { publicGet } from '$lib/server/http/routes';
import { playerDetail } from '$lib/server/read/players';

export const GET = publicGet(async ({ params }, db) =>
  playerDetail(db, parsePathId(params.id, 'id'))
);
