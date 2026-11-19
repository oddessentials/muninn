import { empty, parsePathId } from '#lib/server/http/respond.ts';
import { adminMutation } from '#lib/server/http/routes.ts';
import { deleteAlias } from '#lib/server/read/admin.ts';

export const DELETE = adminMutation(async (event, db) => {
  await deleteAlias(
    db,
    parsePathId(event.params.id, 'id'),
    decodeURIComponent(event.params.alias ?? '')
  );
  return empty(204);
});
