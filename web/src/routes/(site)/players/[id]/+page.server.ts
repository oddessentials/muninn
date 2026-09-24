import { error } from '@sveltejs/kit';
import { ApiError, type PositionsRange } from '$lib/api/client';
import { attempt } from '$lib/ui/load';
import { pickEnum, pickText } from '$lib/ui/query';
import { assetUrl, serverApi } from '$lib/ui/server';
import type { PageServerLoad } from './$types';

const ranges: readonly NonNullable<PositionsRange>[] = ['1h', '6h', '24h', '7d'];

export const load: PageServerLoad = async ({ fetch, url, params }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) error(404, 'player ids are positive integers');
  const server = serverApi(fetch, url);
  const { api } = server;
  const range = pickEnum(url.searchParams, 'range', ranges, '24h');
  const cursor = pickText(url.searchParams, 'cursor');
  let player;
  try {
    player = await api.getPlayer(id);
  } catch (caught) {
    if (caught instanceof ApiError && caught.status === 404)
      error(404, 'this player does not exist or is hidden');
    if (caught instanceof ApiError)
      error(caught.status >= 500 ? 503 : caught.status, caught.message);
    throw caught;
  }
  const [sessions, deaths, kills, positions, structures, activity, world] = await Promise.all([
    attempt(api.listPlayerSessions(id, { limit: 25, cursor })),
    attempt(api.listPlayerDeaths(id, { limit: 50 })),
    attempt(api.getPlayerKills(id)),
    attempt(api.getPlayerPositions(id, { range, limit: 2000 })),
    attempt(api.getPlayerStructures(id)),
    attempt(api.listPlayerActivity(id, { limit: 30 })),
    attempt(api.getWorld())
  ]);
  return {
    player,
    sessions,
    deaths,
    kills,
    positions,
    range,
    structures,
    activity,
    world,
    mapSrc: assetUrl(server, world.ok ? (world.data.map?.image_url ?? null) : null)
  };
};
