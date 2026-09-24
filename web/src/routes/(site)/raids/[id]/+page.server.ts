import { error } from '@sveltejs/kit';
import { ApiError } from '$lib/api/client';
import { attempt } from '$lib/ui/load';
import { assetUrl, serverApi } from '$lib/ui/server';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, url, params }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) error(404, 'raid ids are positive integers');
  const server = serverApi(fetch, url);
  const { api } = server;
  let raid;
  try {
    raid = await api.getRaid(id);
  } catch (caught) {
    if (caught instanceof ApiError && caught.status === 404) error(404, 'no raid has this id');
    if (caught instanceof ApiError)
      error(caught.status >= 500 ? 503 : caught.status, caught.message);
    throw caught;
  }
  const world = await attempt(api.getWorld());
  return {
    raid,
    world,
    mapSrc: assetUrl(server, world.ok ? (world.data.map?.image_url ?? null) : null)
  };
};
