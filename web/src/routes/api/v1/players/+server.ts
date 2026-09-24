import { encodeCursor, parseBooleanParam, parseEnum, parsePage } from '$lib/server/http/respond';
import { publicGet } from '$lib/server/http/routes';
import { listPlayers, playerSorts } from '$lib/server/read/players';

export const GET = publicGet(async ({ url }, db) => {
  const page = parsePage(url);
  const result = await listPlayers(db, {
    q: url.searchParams.get('q')?.trim() || null,
    sort: parseEnum(url, 'sort', playerSorts, 'last_seen'),
    order: parseEnum(url, 'order', ['asc', 'desc'] as const, 'desc'),
    online: parseBooleanParam(url, 'online'),
    includeHidden: false,
    limit: page.limit,
    offset: page.offset
  });
  return {
    items: result.items,
    next_cursor: result.hasMore ? encodeCursor(page.offset + page.limit) : null
  };
});
