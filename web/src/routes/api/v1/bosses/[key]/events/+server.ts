import { encodeCursor, notFound, parsePage } from '$lib/server/http/respond';
import { publicGet } from '$lib/server/http/routes';
import { bossEventItems, bossExists } from '$lib/server/read/bosses';

export const GET = publicGet(async ({ params, url }, db) => {
  const key = params.key ?? '';
  if (!(await bossExists(db, key))) throw notFound(`boss ${key} does not exist`);
  const page = parsePage(url);
  const result = await bossEventItems(db, key, page.limit, page.offset);
  return {
    items: result.items,
    next_cursor: result.hasMore ? encodeCursor(page.offset + page.limit) : null
  };
});
