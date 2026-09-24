import { attempt } from '$lib/ui/load';
import { pickBoolean, pickEnum, pickText } from '$lib/ui/query';
import { serverApi } from '$lib/ui/server';
import type { PageServerLoad } from './$types';

const sorts = ['playtime', 'last_seen', 'deaths', 'kills', 'name', 'first_seen'] as const;
const orders = ['asc', 'desc'] as const;

export const load: PageServerLoad = async ({ fetch, url }) => {
  const { api } = serverApi(fetch, url);
  const sort = pickEnum(url.searchParams, 'sort', sorts, 'last_seen');
  const order = pickEnum(url.searchParams, 'order', orders, sort === 'name' ? 'asc' : 'desc');
  const q = pickText(url.searchParams, 'q');
  const online = pickBoolean(url.searchParams, 'online');
  const cursor = pickText(url.searchParams, 'cursor');
  const players = await attempt(
    api.listPlayers({ sort, order, q, online: online || undefined, cursor, limit: 50 })
  );
  return { players, sort, order, q: q ?? '', online };
};
