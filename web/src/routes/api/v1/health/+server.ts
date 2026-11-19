import type { RequestHandler } from '@sveltejs/kit';
import type { Health } from '#lib/api/types.ts';
import { pingDatabase } from '#lib/server/db/client.ts';
import { env } from '#lib/server/env.ts';

export const GET: RequestHandler = async () => {
  const body: Health = {
    ok: true,
    db: await pingDatabase(),
    version: __APP_VERSION__,
    mock: env.apiMock
  };
  return Response.json(body, { headers: { 'cache-control': 'no-store' } });
};
