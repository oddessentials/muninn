import { badRequest } from '$lib/server/http/respond';
import { adminGet } from '$lib/server/http/routes';
import { adminEvent } from '$lib/server/read/events';

export const GET = adminGet(async ({ params }, db) => {
  const id = params.id ?? '';
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw badRequest('id must be a UUID');
  return adminEvent(db, id);
});
