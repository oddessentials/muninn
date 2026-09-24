import {
  encodeCursor,
  parseInstant,
  parseIntegerParam,
  parseOptionalEnum,
  parsePage
} from '$lib/server/http/respond';
import { publicGet, requireFeature } from '$lib/server/http/routes';
import { chatKinds, listChat } from '$lib/server/read/chat';

export const GET = publicGet(async ({ url }, db) => {
  await requireFeature('chat', db);
  const page = parsePage(url);
  const result = await listChat(db, {
    kind: parseOptionalEnum(url, 'kind', chatKinds),
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
