import { digestActivityTypes } from '#lib/ui/labels.ts';
import { attempt } from '#lib/ui/load.ts';
import { serverApi } from '#lib/ui/server.ts';
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
