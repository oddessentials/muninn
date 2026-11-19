import { parseEnum } from '#lib/server/http/respond.ts';
import { publicGet } from '#lib/server/http/routes.ts';
import { statusHistory } from '#lib/server/read/status.ts';

export const GET = publicGet(async ({ url }, db) =>
  statusHistory(db, parseEnum(url, 'range', ['24h', '7d', '30d'] as const, '24h'))
);
