import {
  comfortSorts,
  defaultOrder,
  filterPieces,
  sortOrders,
  sortPieces,
  type ComfortFilter
} from '$lib/ui/comfort';
import { attempt } from '$lib/ui/load';
import { pickBoolean, pickEnum, pickText } from '$lib/ui/query';
import { serverApi } from '$lib/ui/server';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, url, parent }) => {
  const { api } = serverApi(fetch, url);
  const [layout, comfort] = await Promise.all([parent(), attempt(api.getComfort())]);
  const sort = pickEnum(url.searchParams, 'sort', comfortSorts, 'group');
  const order = pickEnum(url.searchParams, 'order', sortOrders, defaultOrder(sort));
  const filter: ComfortFilter = {
    q: pickText(url.searchParams, 'q') ?? null,
    group: pickText(url.searchParams, 'group') ?? null,
    lit: pickBoolean(url.searchParams, 'lit'),
    built: pickBoolean(url.searchParams, 'built')
  };
  const catalogue = comfort.ok ? comfort.data.catalogue : null;
  const rows = catalogue
    ? sortPieces(filterPieces(catalogue.items, filter), sort, order, catalogue.groups)
    : [];
  return {
    comfort,
    rows,
    sort,
    order,
    filter,
    runningVersion: layout.status?.game_version ?? null
  };
};
