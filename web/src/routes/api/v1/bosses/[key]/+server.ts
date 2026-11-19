import { publicGet } from '#lib/server/http/routes.ts';
import { bossDetail } from '#lib/server/read/bosses.ts';

export const GET = publicGet(async ({ params }, db) => bossDetail(db, params.key ?? ''));
