import { encodeCursor, parsePage } from '#lib/server/http/respond.ts';
import { publicGet } from '#lib/server/http/routes.ts';
import { listSaves } from '#lib/server/read/world.ts';

export const GET = publicGet(async ({ url }, db) => {
  const page = parsePage(url);
  const result = await listSaves(db, page.limit, page.offset);
  return {
    items: result.items,
    next_cursor: result.hasMore ? encodeCursor(page.offset + page.limit) : null
  };
});
