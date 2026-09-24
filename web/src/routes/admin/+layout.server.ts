import { redirect } from '@sveltejs/kit';
import { attempt } from '$lib/ui/load';
import { serverApi } from '$lib/ui/server';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ fetch, url }) => {
  const { api } = serverApi(fetch, url);
  const session = await attempt(api.getAdminSession());
  const authenticated = session.ok && session.data.authenticated;
  if (!authenticated && url.pathname !== '/admin/login') redirect(303, '/admin/login');
  return {
    authenticated,
    expiresAt: session.ok ? session.data.expires_at : null,
    sessionError: session.ok ? null : session.error
  };
};
