import { parseEnum, parsePage, parsePathId } from '#lib/server/http/respond.ts';
import { publicGet, requireFeature } from '#lib/server/http/routes.ts';
import { playerPositions } from '#lib/server/read/players.ts';

export const GET = publicGet(async ({ params, url }, db) => {
  await requireFeature('positions', db);
  const range = parseEnum(url, 'range', ['1h', '6h', '24h', '7d'] as const, '24h');
  const page = parsePage(url, 500, 5000);
  return { items: await playerPositions(db, parsePathId(params.id, 'id'), range, page.limit) };
});
