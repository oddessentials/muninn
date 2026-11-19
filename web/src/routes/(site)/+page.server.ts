import type { StatusHistoryRange } from '#lib/api/client.ts';
import { digestActivityTypes } from '#lib/ui/labels.ts';
import { attempt } from '#lib/ui/load.ts';
import { pickEnum } from '#lib/ui/query.ts';
import { serverApi } from '#lib/ui/server.ts';
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
