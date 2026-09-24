import { env } from '$env/dynamic/public';
import { attempt } from '$lib/ui/load';
import { navigation } from '$lib/ui/navigation';
import { serverApi } from '$lib/ui/server';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ fetch, url }) => {
  const server = serverApi(fetch, url);
  const status = await attempt(server.api.getStatus());
  return {
    siteName: env.PUBLIC_SITE_NAME ?? 'Valheim guild',
    status: status.ok ? status.data : null,
    statusError: status.ok ? null : status.error,
    streamEnabled: !server.external,
    navigation
  };
};
