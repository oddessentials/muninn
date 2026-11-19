import { attempt } from '#lib/ui/load.ts';
import { serverApi } from '#lib/ui/server.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, url }) => {
  const { api } = serverApi(fetch, url);
  const plugin = await attempt(api.getAdminPlugin());
  return { plugin };
};
