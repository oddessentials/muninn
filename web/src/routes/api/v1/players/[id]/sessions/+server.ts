import { encodeCursor, parsePage, parsePathId } from '$lib/server/http/respond';
import { publicGet } from '$lib/server/http/routes';
import { playerSessions } from '$lib/server/read/players';

export const GET = publicGet(async ({ params, url }, db) => {
  const page = parsePage(url);
  const result = await playerSessions(db, parsePathId(params.id, 'id'), page.limit, page.offset);
  return {
    items: result.items,
    next_cursor: result.hasMore ? encodeCursor(page.offset + page.limit) : null
  };
});
