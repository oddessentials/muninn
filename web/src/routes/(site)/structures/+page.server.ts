import type { StructuresRange } from '$lib/api/client';
import { attempt } from '$lib/ui/load';
import { pickEnum, pickText } from '$lib/ui/query';
import { serverApi } from '$lib/ui/server';
import type { PageServerLoad } from './$types';

const ranges: readonly NonNullable<StructuresRange>[] = ['7d', '30d', 'all'];

export const load: PageServerLoad = async ({ fetch, url }) => {
  const { api } = serverApi(fetch, url);
  const range = pickEnum(url.searchParams, 'range', ranges, '30d');
  const cursor = pickText(url.searchParams, 'cursor');
  const [structures, recent] = await Promise.all([
    attempt(api.getStructures(range)),
    attempt(api.listStructureEvents({ limit: 50, cursor }))
  ]);
  return { structures, recent, range };
};
