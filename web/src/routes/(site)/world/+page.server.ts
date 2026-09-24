import { attempt } from '$lib/ui/load';
import { pickText } from '$lib/ui/query';
import { assetUrl, serverApi } from '$lib/ui/server';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, url, parent }) => {
  const server = serverApi(fetch, url);
  const { api } = server;
  const cursor = pickText(url.searchParams, 'cursor');
  const [layout, world, runs, saves, online] = await Promise.all([
    parent(),
    attempt(api.getWorld()),
    attempt(api.listRuns({ limit: 20, cursor })),
    attempt(api.listSaves({ limit: 12 })),
    attempt(api.getOnline())
  ]);
  return {
    status: layout.status,
    world,
    runs,
    saves,
    online,
    mapSrc: assetUrl(server, world.ok ? (world.data.map?.image_url ?? null) : null)
  };
};
