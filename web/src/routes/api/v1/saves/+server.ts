import { encodeCursor, parsePage } from '$lib/server/http/respond';
import { publicGet } from '$lib/server/http/routes';
import { listSaves } from '$lib/server/read/world';

export const GET = publicGet(async ({ url }, db) => {
  const page = parsePage(url);
  const result = await listSaves(db, page.limit, page.offset);
  return {
    items: result.items,
    next_cursor: result.hasMore ? encodeCursor(page.offset + page.limit) : null
  };
});
