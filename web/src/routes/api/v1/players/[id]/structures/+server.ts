import { parsePathId } from '$lib/server/http/respond';
import { publicGet } from '$lib/server/http/routes';
import { playerStructures } from '$lib/server/read/players';

export const GET = publicGet(async ({ params }, db) =>
  playerStructures(db, parsePathId(params.id, 'id'))
);
