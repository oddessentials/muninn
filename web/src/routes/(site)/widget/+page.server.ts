import { digestActivityTypes } from '$lib/ui/labels';
import { attempt } from '$lib/ui/load';
import { serverApi } from '$lib/ui/server';
import type { PageServerLoad } from './$types';

const feedLength = 5;

export const load: PageServerLoad = async ({ fetch, url }) => {
  const { api } = serverApi(fetch, url);
  const [online, activity] = await Promise.all([
    attempt(api.getOnline()),
    attempt(api.listActivity({ limit: feedLength, types: digestActivityTypes.join(',') }))
  ]);
  return { online, activity, feedLength };
};
