import { attempt } from '$lib/ui/load';
import { pickText } from '$lib/ui/query';
import { serverApi } from '$lib/ui/server';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, url }) => {
  const { api } = serverApi(fetch, url);
  const cursor = pickText(url.searchParams, 'cursor');
  const players = await attempt(api.listAdminPlayers({ include_hidden: true, cursor, limit: 200 }));
  return { players };
};
