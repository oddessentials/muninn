import { parseEnum } from '$lib/server/http/respond';
import { publicGet } from '$lib/server/http/routes';
import { statusHistory } from '$lib/server/read/status';

export const GET = publicGet(async ({ url }, db) =>
  statusHistory(db, parseEnum(url, 'range', ['24h', '7d', '30d'] as const, '24h'))
);
