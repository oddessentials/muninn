import type { ActivityItem } from '$lib/api/types';

export function mergeActivity(
  fresh: ActivityItem[],
  loaded: ActivityItem[],
  limit: number,
  accept: (item: ActivityItem) => boolean = () => true
): ActivityItem[] {
  const seen = new Set<string>();
  const merged: ActivityItem[] = [];
  for (const item of [...fresh.filter(accept), ...loaded]) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }
  merged.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  return merged.slice(0, limit);
}
