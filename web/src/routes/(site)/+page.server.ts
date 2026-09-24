import type { StatusHistoryRange } from '$lib/api/client';
import { digestActivityTypes } from '$lib/ui/labels';
import { attempt } from '$lib/ui/load';
import { pickEnum } from '$lib/ui/query';
import { serverApi } from '$lib/ui/server';
import type { PageServerLoad } from './$types';

const ranges: readonly NonNullable<StatusHistoryRange>[] = ['24h', '7d', '30d'];

export const load: PageServerLoad = async ({ fetch, url, parent }) => {
  const { api } = serverApi(fetch, url);
  const range = pickEnum(url.searchParams, 'range', ranges, '24h');
  const [layout, online, history, activity, bosses, raids, zone, session] = await Promise.all([
    parent(),
    attempt(api.getOnline()),
    attempt(api.getStatusHistory(range)),
    attempt(api.listActivity({ limit: 25, types: digestActivityTypes.join(',') })),
    attempt(api.listBosses()),
    attempt(api.listRaids({ limit: 5 })),
    attempt(api.listZoneResults()),
    attempt(api.getAdminSession())
  ]);
  return {
    status: layout.status,
    statusError: layout.statusError,
    online,
    history,
    range,
    activity,
    bosses,
    raids,
    zone,
    admin: session.ok && session.data.authenticated
  };
};
