import type {
  ComfortCatalogue,
  ComfortCondition,
  ComfortPiece,
  ComfortSeason
} from '$lib/api/types';

export const baseComfort = 1;
export const shelterComfort = 1;
export const ungrouped = 'None';

export const comfortSorts = ['group', 'name', 'comfort', 'built'] as const;
export type ComfortSort = (typeof comfortSorts)[number];
export const sortOrders = ['asc', 'desc'] as const;
export type SortOrder = (typeof sortOrders)[number];

export interface ComfortFilter {
  q: string | null;
  group: string | null;
  lit: boolean;
  built: boolean;
}

export interface GroupStanding {
  group: string;
  stacks: boolean;
  adds: number;
  best: ComfortPiece[];
  built: number;
}

export function defaultOrder(sort: ComfortSort): SortOrder {
  return sort === 'comfort' || sort === 'built' ? 'desc' : 'asc';
}

export function groupLabel(group: string): string {
  return group === ungrouped ? 'No group' : group;
}

export function conditionLabel(condition: ComfortCondition | null): string | null {
  if (condition === 'lit') return 'While lit';
  if (condition === 'lit_dry') return 'While lit and dry';
  return null;
}

export function groupOrder(groups: readonly string[], items: readonly ComfortPiece[]): string[] {
  const present = new Set(items.map((item) => item.group));
  const known = groups.filter((group) => group !== ungrouped && present.has(group));
  const unknown = [...present]
    .filter((group) => group !== ungrouped && !groups.includes(group))
    .sort((a, b) => a.localeCompare(b, 'en'));
  return [...known, ...unknown, ...(present.has(ungrouped) ? [ungrouped] : [])];
}

function byName(a: ComfortPiece, b: ComfortPiece): number {
  return a.name.localeCompare(b.name, 'en') || a.prefab.localeCompare(b.prefab, 'en');
}

export function sortPieces(
  items: readonly ComfortPiece[],
  sort: ComfortSort,
  order: SortOrder,
  groups: readonly string[]
): ComfortPiece[] {
  const rank = new Map(groupOrder(groups, items).map((group, index) => [group, index]));
  const groupRank = (piece: ComfortPiece) => rank.get(piece.group) ?? rank.size;
  const direction = order === 'asc' ? 1 : -1;
  const primary = (a: ComfortPiece, b: ComfortPiece): number => {
    if (sort === 'name') return byName(a, b);
    if (sort === 'comfort') return a.comfort - b.comfort;
    if (sort === 'built') return a.built - b.built;
    return groupRank(a) - groupRank(b);
  };
  return [...items].sort(
    (a, b) =>
      direction * primary(a, b) ||
      groupRank(a) - groupRank(b) ||
      b.comfort - a.comfort ||
      byName(a, b)
  );
}

export function filterPieces(
  items: readonly ComfortPiece[],
  filter: ComfortFilter
): ComfortPiece[] {
  const needle = filter.q?.trim().toLowerCase() ?? '';
  return items.filter(
    (item) =>
      (!filter.group || item.group === filter.group) &&
      (!filter.lit || item.condition !== null) &&
      (!filter.built || item.built > 0) &&
      (!needle ||
        item.name.toLowerCase().includes(needle) ||
        item.prefab.toLowerCase().includes(needle))
  );
}

function mergeByToken(pieces: readonly ComfortPiece[]): ComfortPiece[] {
  const merged = new Map<string, ComfortPiece>();
  for (const piece of pieces) {
    const current = merged.get(piece.token);
    if (!current) {
      merged.set(piece.token, { ...piece });
      continue;
    }
    const stronger = piece.comfort > current.comfort ? piece : current;
    merged.set(piece.token, { ...stronger, built: current.built + piece.built });
  }
  return [...merged.values()];
}

export function groupStandings(
  groups: readonly string[],
  items: readonly ComfortPiece[]
): GroupStanding[] {
  return groupOrder(groups, items).map((group) => {
    const members = items.filter((item) => item.group === group);
    const stacks = group === ungrouped;
    const top = Math.max(...members.map((item) => item.comfort));
    const best = mergeByToken(
      stacks ? members : members.filter((item) => item.comfort === top)
    ).sort(byName);
    return {
      group,
      stacks,
      adds: stacks ? best.reduce((sum, item) => sum + item.comfort, 0) : top,
      best,
      built: best.filter((item) => item.built > 0).length
    };
  });
}

export function peakComfort(
  groups: readonly string[],
  items: readonly ComfortPiece[],
  withSeasonal: boolean
): number {
  const pool = withSeasonal ? items : items.filter((item) => item.season === null);
  return groupStandings(groups, pool).reduce(
    (sum, standing) => sum + standing.adds,
    baseComfort + shelterComfort
  );
}

export function topOfGroup(
  standings: readonly GroupStanding[],
  items: readonly ComfortPiece[]
): Set<string> {
  const byGroup = new Map(standings.map((standing) => [standing.group, standing]));
  return new Set(
    items
      .filter((item) => {
        const standing = byGroup.get(item.group);
        return standing !== undefined && (standing.stacks || item.comfort === standing.adds);
      })
      .map((item) => item.prefab)
  );
}

export function restedSeconds(
  catalogue: Pick<ComfortCatalogue, 'rested_base_s' | 'rested_per_level_s'>,
  comfort: number
): number {
  return (
    catalogue.rested_base_s + Math.max(0, comfort - baseComfort) * catalogue.rested_per_level_s
  );
}

const monthDay = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC'
});

const calendarDay = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC'
});

export function seasonWindow(season: ComfortSeason): string {
  const start = monthDay.format(Date.UTC(2000, season.start_month - 1, season.start_day));
  const end = monthDay.format(Date.UTC(2000, season.end_month - 1, season.end_day));
  return `${start} – ${end}`;
}

export function formatBuiltDay(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return date;
  return calendarDay.format(Date.UTC(year, month - 1, day));
}

export function isStale(
  catalogue: Pick<ComfortCatalogue, 'game_version'>,
  runningVersion: string | null | undefined
): boolean {
  return Boolean(runningVersion) && catalogue.game_version !== runningVersion;
}
