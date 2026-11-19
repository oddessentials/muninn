import { encodeCursor, parsePage } from '#lib/server/http/respond.ts';
import { publicGet } from '#lib/server/http/routes.ts';
import { listRuns } from '#lib/server/read/status.ts';

export const GET = publicGet(async ({ url }, db) => {
  const page = parsePage(url);
  const result = await listRuns(db, page.limit, page.offset);
  return {
    items: result.rows,
    next_cursor: result.hasMore ? encodeCursor(page.offset + page.limit) : null
  };
});
