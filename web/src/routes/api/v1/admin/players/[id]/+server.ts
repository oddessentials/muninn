import { parsePathId, privateJson } from '$lib/server/http/respond';
import { adminMutation, readJsonBody } from '$lib/server/http/routes';
import { parsePatch, patchPlayer } from '$lib/server/read/admin';

export const PATCH = adminMutation(async (event, db) => {
  const patch = parsePatch(await readJsonBody(event));
  return privateJson(await patchPlayer(db, parsePathId(event.params.id, 'id'), patch));
});
