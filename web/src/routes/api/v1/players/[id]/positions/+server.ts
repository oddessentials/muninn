import { parseEnum, parsePage, parsePathId } from '$lib/server/http/respond';
import { publicGet } from '$lib/server/http/routes';
import { playerPositions } from '$lib/server/read/players';

export const GET = publicGet(async ({ params, url }, db) => {
  const range = parseEnum(url, 'range', ['1h', '6h', '24h', '7d'] as const, '24h');
  const page = parsePage(url, 500, 5000);
  return { items: await playerPositions(db, parsePathId(params.id, 'id'), range, page.limit) };
});
