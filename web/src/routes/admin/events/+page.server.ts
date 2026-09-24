import { activityTypes } from '$lib/ui/labels';
import { attempt } from '$lib/ui/load';
import { pickInstant, pickInt, pickOptionalEnum, pickText } from '$lib/ui/query';
import { serverApi } from '$lib/ui/server';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, url }) => {
  const { api } = serverApi(fetch, url);
  const type = pickOptionalEnum(url.searchParams, 'type', activityTypes);
  const runId = pickText(url.searchParams, 'run_id');
  const player = pickInt(url.searchParams, 'player');
  const since = pickInstant(url.searchParams, 'since');
  const until = pickInstant(url.searchParams, 'until');
  const cursor = pickText(url.searchParams, 'cursor');
  const lookup = pickText(url.searchParams, 'id');
  const [events, single] = await Promise.all([
    attempt(api.listAdminEvents({ type, run_id: runId, player, since, until, cursor, limit: 50 })),
    lookup ? attempt(api.getAdminEvent(lookup)) : Promise.resolve(null)
  ]);
  return { events, single, lookup: lookup ?? '', type, runId: runId ?? '', player, since, until };
};
