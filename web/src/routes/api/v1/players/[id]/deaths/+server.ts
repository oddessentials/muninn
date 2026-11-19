import { encodeCursor, parsePage, parsePathId } from '#lib/server/http/respond.ts';
import { publicGet } from '#lib/server/http/routes.ts';
import { playerDeaths } from '#lib/server/read/players.ts';

export const GET = publicGet(async ({ params, url }, db) => {
  const page = parsePage(url);
  const result = await playerDeaths(db, parsePathId(params.id, 'id'), page.limit, page.offset);
  return {
    items: result.items,
    next_cursor: result.hasMore ? encodeCursor(page.offset + page.limit) : null
  };
});
