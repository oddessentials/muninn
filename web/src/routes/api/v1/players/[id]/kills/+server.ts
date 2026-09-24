import { parsePathId } from '$lib/server/http/respond';
import { publicGet } from '$lib/server/http/routes';
import { playerKills } from '$lib/server/read/players';

export const GET = publicGet(async ({ params }, db) =>
  playerKills(db, parsePathId(params.id, 'id'))
);
