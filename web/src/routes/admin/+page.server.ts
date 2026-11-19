import { attempt } from '#lib/ui/load.ts';
import { serverApi } from '#lib/ui/server.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, url }) => {
  const { api } = serverApi(fetch, url);
  const [health, backups] = await Promise.all([
    attempt(api.getAdminHealth()),
    attempt(api.listBackups())
  ]);
  return { health, backups };
};
