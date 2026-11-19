import { parsePathId, privateJson } from '#lib/server/http/respond.ts';
import { adminMutation, readJsonBody } from '#lib/server/http/routes.ts';
import { parsePatch, patchPlayer } from '#lib/server/read/admin.ts';

export const PATCH = adminMutation(async (event, db) => {
  const patch = parsePatch(await readJsonBody(event));
  return privateJson(await patchPlayer(db, parsePathId(event.params.id, 'id'), patch));
});
