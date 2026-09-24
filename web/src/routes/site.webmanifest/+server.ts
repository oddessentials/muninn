import type { RequestHandler } from '@sveltejs/kit';
import { attempt } from '$lib/ui/load';
import { webManifest } from '$lib/ui/manifest';
import { serverApi } from '$lib/ui/server';

export const GET: RequestHandler = async ({ fetch, url }) => {
  const site = await attempt(serverApi(fetch, url).api.getSite());
  const manifest = webManifest(site.ok ? site.data.name : 'Valheim guild');
  return new Response(JSON.stringify(manifest), {
    headers: {
      'content-type': 'application/manifest+json',
      'cache-control': 'public, max-age=300'
    }
  });
};
