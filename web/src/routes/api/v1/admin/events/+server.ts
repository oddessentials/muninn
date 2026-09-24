import {
  badRequest,
  encodeCursor,
  parseInstant,
  parseIntegerParam,
  parseOptionalEnum,
  parsePage
} from '$lib/server/http/respond';
import { adminGet } from '$lib/server/http/routes';
import { allEventTypes } from '$lib/server/read/activity';
import { listAdminEvents } from '$lib/server/read/events';

export const GET = adminGet(async ({ url }, db) => {
  const page = parsePage(url);
  const runId = url.searchParams.get('run_id');
  if (runId !== null && runId !== '' && !/^[0-9a-f-]{36}$/i.test(runId))
    throw badRequest('run_id must be a UUID');
  const result = await listAdminEvents(db, {
    type: parseOptionalEnum(url, 'type', allEventTypes),
    runId: runId ? runId : null,
    playerId: parseIntegerParam(url, 'player'),
    since: parseInstant(url, 'since'),
    until: parseInstant(url, 'until'),
    limit: page.limit,
    offset: page.offset
  });
  return {
    items: result.items,
    next_cursor: result.hasMore ? encodeCursor(page.offset + page.limit) : null
  };
});
