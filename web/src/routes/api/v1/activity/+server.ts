import {
  badRequest,
  encodeCursor,
  parseInstant,
  parseIntegerParam,
  parsePage
} from '$lib/server/http/respond';
import { publicGet } from '$lib/server/http/routes';
import { buildActivityItems, parseTypes, queryActivity } from '$lib/server/read/activity';

export const GET = publicGet(async ({ url }, db) => {
  const page = parsePage(url);
  let types;
  try {
    types = parseTypes(url.searchParams.get('types'));
  } catch (error) {
    throw badRequest(error instanceof Error ? error.message : 'types is invalid');
  }
  const result = await queryActivity(db, {
    types,
    playerId: parseIntegerParam(url, 'player'),
    since: parseInstant(url, 'since'),
    until: parseInstant(url, 'until'),
    limit: page.limit,
    offset: page.offset
  });
  return {
    items: await buildActivityItems(db, result.rows),
    next_cursor: result.hasMore ? encodeCursor(page.offset + page.limit) : null
  };
});
