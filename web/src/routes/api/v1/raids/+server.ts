import { encodeCursor, parseInstant, parsePage } from '$lib/server/http/respond';
import { publicGet } from '$lib/server/http/routes';
import { listRaids } from '$lib/server/read/raids';

export const GET = publicGet(async ({ url }, db) => {
  const page = parsePage(url);
  const result = await listRaids(
    db,
    parseInstant(url, 'since'),
    parseInstant(url, 'until'),
    page.limit,
    page.offset
  );
  return {
    items: result.items,
    next_cursor: result.hasMore ? encodeCursor(page.offset + page.limit) : null
  };
});
