import { asc, desc, gte, sql } from 'drizzle-orm';
import type { StructureEvent, Structures } from '$lib/api/types';
import type { Database } from '../db/client';
import { structureEvents, structuresDaily } from '../db/schema';
import { round } from '../http/respond';
import { biomeName } from '../names';
import { playerRefs } from './players';

export const structureRanges = ['7d', '30d', 'all'] as const;
export type StructureRange = (typeof structureRanges)[number];

function rangeStart(range: StructureRange, now: Date): string | null {
  if (range === 'all') return null;
  const days = range === '7d' ? 7 : 30;
  return new Date(now.getTime() - (days - 1) * 24 * 3600 * 1000).toISOString().slice(0, 10);
}

export async function structureSummary(
  db: Database,
  range: StructureRange,
  now = new Date()
): Promise<Structures> {
  const start = rangeStart(range, now);
  const where = start ? gte(structuresDaily.date, start) : undefined;
  const totals = await db
    .select({
      built: sql<number>`coalesce(sum(${structuresDaily.built}), 0)::int`,
      destroyed: sql<number>`coalesce(sum(${structuresDaily.destroyed}), 0)::int`
    })
    .from(structuresDaily)
    .where(where);
  const daily = await db
    .select({
      date: structuresDaily.date,
      built: sql<number>`sum(${structuresDaily.built})::int`,
      destroyed: sql<number>`sum(${structuresDaily.destroyed})::int`
    })
    .from(structuresDaily)
    .where(where)
    .groupBy(structuresDaily.date)
    .orderBy(asc(structuresDaily.date));
  const byDate = new Map(daily.map((row) => [row.date, row]));
  const series: Structures['series'] = [];
  const firstDate = start ?? daily[0]?.date ?? null;
  if (firstDate) {
    const end = now.toISOString().slice(0, 10);
    for (
      let cursor = new Date(`${firstDate}T00:00:00Z`);
      cursor.toISOString().slice(0, 10) <= end;
      cursor = new Date(cursor.getTime() + 24 * 3600 * 1000)
    ) {
      const date = cursor.toISOString().slice(0, 10);
      const row = byDate.get(date);
      series.push({ date, built: row?.built ?? 0, destroyed: row?.destroyed ?? 0 });
      if (series.length > 400) break;
    }
  }
  const byBuilder = await db
    .select({
      builderPlayerId: structuresDaily.builderPlayerId,
      built: sql<number>`sum(${structuresDaily.built})::int`,
      generated: sql<number>`sum(${structuresDaily.built} - ${structuresDaily.placed})::int`
    })
    .from(structuresDaily)
    .where(where)
    .groupBy(structuresDaily.builderPlayerId)
    .orderBy(desc(sql`sum(${structuresDaily.built})`))
    .limit(50);
  const refs = await playerRefs(
    db,
    byBuilder.filter((row) => row.builderPlayerId !== 0).map((row) => row.builderPlayerId)
  );
  const byPrefab = await db
    .select({
      prefab: structuresDaily.prefab,
      built: sql<number>`sum(${structuresDaily.built})::int`
    })
    .from(structuresDaily)
    .where(where)
    .groupBy(structuresDaily.prefab)
    .orderBy(desc(sql`sum(${structuresDaily.built})`), asc(structuresDaily.prefab))
    .limit(50);
  return {
    built_total: totals[0]?.built ?? 0,
    destroyed_total: totals[0]?.destroyed ?? 0,
    series,
    by_builder: byBuilder
      .flatMap((row) => {
        if (row.builderPlayerId !== 0) {
          return [
            { player: refs.get(row.builderPlayerId) ?? null, built: row.built, world: false }
          ];
        }
        return [
          { player: null, built: row.built - row.generated, world: false },
          { player: null, built: row.generated, world: true }
        ];
      })
      .filter((row) => row.built > 0)
      .sort((a, b) => b.built - a.built),
    by_prefab: byPrefab
      .filter((row) => row.built > 0)
      .map((row) => ({ prefab: row.prefab, built: row.built }))
  };
}

export async function recentStructures(db: Database, limit: number, offset: number) {
  const rows = await db
    .select()
    .from(structureEvents)
    .orderBy(desc(structureEvents.at), desc(structureEvents.id))
    .limit(limit + 1)
    .offset(offset);
  const page = rows.slice(0, limit);
  const refs = await playerRefs(
    db,
    page.flatMap((row) => (row.playerId ? [row.playerId] : []))
  );
  const items: StructureEvent[] = page.map((row) => ({
    at: row.at.toISOString(),
    kind: row.kind as StructureEvent['kind'],
    prefab: row.prefab,
    x: round(row.x),
    z: round(row.z),
    biome: biomeName(row.biome),
    player: row.playerId ? (refs.get(row.playerId) ?? null) : null
  }));
  return { items, hasMore: rows.length > limit };
}
