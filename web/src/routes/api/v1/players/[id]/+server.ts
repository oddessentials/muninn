import { parsePathId } from '#lib/server/http/respond.ts';
import { publicGet } from '#lib/server/http/routes.ts';
import { playerDetail } from '#lib/server/read/players.ts';

export const GET = publicGet(async ({ params }, db) =>
  playerDetail(db, parsePathId(params.id, 'id'))
);
