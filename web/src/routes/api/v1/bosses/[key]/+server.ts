import { publicGet } from '$lib/server/http/routes';
import { bossDetail } from '$lib/server/read/bosses';

export const GET = publicGet(async ({ params }, db) => bossDetail(db, params.key ?? ''));
