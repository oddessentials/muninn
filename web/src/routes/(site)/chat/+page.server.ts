import { error } from '@sveltejs/kit';
import { attempt } from '$lib/ui/load';
import { pickInstant, pickInt, pickOptionalEnum, pickText } from '$lib/ui/query';
import { assetUrl, serverApi } from '$lib/ui/server';
import type { PageServerLoad } from './$types';

const kinds = ['shout', 'ping', 'say'] as const;

export const load: PageServerLoad = async ({ fetch, url, parent }) => {
  const { features } = await parent();
  if (features && !features.chat) error(404, 'Chat is switched off on this site');
  const server = serverApi(fetch, url);
  const { api } = server;
  const kind = pickOptionalEnum(url.searchParams, 'kind', kinds);
  const player = pickInt(url.searchParams, 'player');
  const since = pickInstant(url.searchParams, 'since');
  const until = pickInstant(url.searchParams, 'until');
  const cursor = pickText(url.searchParams, 'cursor');
  const [chat, players, world] = await Promise.all([
    attempt(api.listChat({ kind, player, since, until, cursor, limit: 50 })),
    attempt(api.listPlayers({ sort: 'name', order: 'asc', limit: 200 })),
    attempt(api.getWorld())
  ]);
  return {
    chat,
    players: players.ok ? players.data.items : [],
    world,
    mapSrc: assetUrl(server, world.ok ? (world.data.map?.image_url ?? null) : null),
    kind,
    player,
    since,
    until
  };
};
