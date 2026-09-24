import { attempt } from '$lib/ui/load';
import { pickInstant, pickText } from '$lib/ui/query';
import { serverApi } from '$lib/ui/server';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, url }) => {
  const { api } = serverApi(fetch, url);
  const since = pickInstant(url.searchParams, 'since');
  const until = pickInstant(url.searchParams, 'until');
  const cursor = pickText(url.searchParams, 'cursor');
  const raids = await attempt(api.listRaids({ since, until, cursor, limit: 50 }));
  return { raids, since, until };
};
