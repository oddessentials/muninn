import { isEventType } from '$lib/ui/labels';
import { attempt } from '$lib/ui/load';
import { pickInstant, pickInt, pickList, pickText } from '$lib/ui/query';
import { serverApi } from '$lib/ui/server';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, url }) => {
  const { api } = serverApi(fetch, url);
  const types = pickList(url.searchParams, 'types', isEventType);
  const player = pickInt(url.searchParams, 'player');
  const since = pickInstant(url.searchParams, 'since');
  const until = pickInstant(url.searchParams, 'until');
  const cursor = pickText(url.searchParams, 'cursor');
  const [activity, players] = await Promise.all([
    attempt(
      api.listActivity({
        types: types.length > 0 ? types.join(',') : undefined,
        player,
        since,
        until,
        cursor,
        limit: 50
      })
    ),
    attempt(api.listPlayers({ sort: 'name', order: 'asc', limit: 200 }))
  ]);
  return {
    activity,
    players: players.ok ? players.data.items : [],
    types,
    player,
    since,
    until,
    live: !cursor && !until
  };
};
