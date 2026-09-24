import { empty, parsePathId } from '$lib/server/http/respond';
import { adminMutation } from '$lib/server/http/routes';
import { deleteAlias } from '$lib/server/read/admin';

export const DELETE = adminMutation(async (event, db) => {
  await deleteAlias(
    db,
    parsePathId(event.params.id, 'id'),
    decodeURIComponent(event.params.alias ?? '')
  );
  return empty(204);
});
