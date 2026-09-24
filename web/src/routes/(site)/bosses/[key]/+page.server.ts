import { error } from '@sveltejs/kit';
import { ApiError } from '$lib/api/client';
import { attempt } from '$lib/ui/load';
import { pickText } from '$lib/ui/query';
import { assetUrl, serverApi } from '$lib/ui/server';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, url, params }) => {
  const server = serverApi(fetch, url);
  const { api } = server;
  const cursor = pickText(url.searchParams, 'cursor');
  let boss;
  try {
    boss = await api.getBoss(params.key);
  } catch (caught) {
    if (caught instanceof ApiError && caught.status === 404) error(404, 'no boss has this key');
    if (caught instanceof ApiError)
      error(caught.status >= 500 ? 503 : caught.status, caught.message);
    throw caught;
  }
  const [events, world] = await Promise.all([
    attempt(api.listBossEvents(params.key, { limit: 50, cursor })),
    attempt(api.getWorld())
  ]);
  return {
    boss,
    events,
    world,
    mapSrc: assetUrl(server, world.ok ? (world.data.map?.image_url ?? null) : null)
  };
};
