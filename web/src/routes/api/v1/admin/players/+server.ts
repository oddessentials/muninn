import { encodeCursor, parseBooleanParam, parsePage } from '$lib/server/http/respond';
import { adminGet } from '$lib/server/http/routes';
import { listAdminPlayers } from '$lib/server/read/admin';

export const GET = adminGet(async ({ url }, db) => {
  const page = parsePage(url);
  const result = await listAdminPlayers(
    db,
    parseBooleanParam(url, 'include_hidden') ?? true,
    page.limit,
    page.offset
  );
  return {
    items: result.items,
    next_cursor: result.hasMore ? encodeCursor(page.offset + page.limit) : null
  };
});
