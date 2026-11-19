import { encodeCursor, parseBooleanParam, parsePage } from '#lib/server/http/respond.ts';
import { adminGet } from '#lib/server/http/routes.ts';
import { listAdminPlayers } from '#lib/server/read/admin.ts';

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
