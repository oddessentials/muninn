import { and, asc, desc, eq, gte, lt, lte, sql, type SQL } from 'drizzle-orm';
import type { Raid, RaidDetail } from '$lib/api/types';
import type { Database } from '../db/client';
import { deaths, raids, type RaidRow } from '../db/schema';
import { notFound, round } from '../http/respond';
import { biomeName, raidLabel } from '../names';
import { playerRefs } from './players';

export function raidWindowEnd(raid: RaidRow): Date {
  return raid.endedAt ?? new Date(raid.startedAt.getTime() + raid.plannedDurationS * 1000);
}

async function deathsDuring(
  db: Database,
  rows: RaidRow[]
): Promise<Map<number, (typeof deaths.$inferSelect)[]>> {
  const out = new Map<number, (typeof deaths.$inferSelect)[]>();
  if (rows.length === 0) return out;
  const earliest = rows.reduce(
    (min, raid) => (raid.startedAt < min ? raid.startedAt : min),
    rows[0]!.startedAt
  );
  const latest = rows.reduce((max, raid) => {
    const end = raidWindowEnd(raid);
    return end > max ? end : max;
  }, raidWindowEnd(rows[0]!));
  const candidates = await db
    .select()
    .from(deaths)
    .where(and(gte(deaths.diedAt, earliest), lte(deaths.diedAt, latest)))
    .orderBy(asc(deaths.diedAt));
  for (const raid of rows) {
    const end = raidWindowEnd(raid);
    out.set(
      raid.id,
      candidates.filter((death) => death.diedAt >= raid.startedAt && death.diedAt <= end)
    );
  }
  return out;
}

async function toRaids(db: Database, rows: RaidRow[]): Promise<Raid[]> {
  const refs = await playerRefs(
    db,
    rows.flatMap((raid) => raid.participantIds)
  );
  const during = await deathsDuring(db, rows);
  return rows.map((raid) => ({
    id: raid.id,
    name: raid.name,
    label: raidLabel(raid.name),
    biome: biomeName(raid.biome),
    x: round(raid.x),
    z: round(raid.z),
    day: raid.worldDay,
    started_at: raid.startedAt.toISOString(),
    ended_at: raid.endedAt ? raid.endedAt.toISOString() : null,
    duration_s: raid.endedAt
      ? Math.round((raid.endedAt.getTime() - raid.startedAt.getTime()) / 1000)
      : null,
    planned_duration_s: Math.round(raid.plannedDurationS),
    participants: raid.participantIds.map((id) => refs.get(id) ?? null),
    deaths_during: during.get(raid.id)?.length ?? 0,
    end_reason: raid.endReason ?? null,
    restored: raid.restored,
    active_s: raid.activeS === null ? null : round(raid.activeS)
  }));
}

export async function listRaids(
  db: Database,
  since: Date | null,
  until: Date | null,
  limit: number,
  offset: number
): Promise<{ items: Raid[]; hasMore: boolean }> {
  const conditions: SQL[] = [];
  if (since) conditions.push(gte(raids.startedAt, since));
  if (until) conditions.push(lt(raids.startedAt, until));
  const rows = await db
    .select()
    .from(raids)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(raids.startedAt), desc(raids.id))
    .limit(limit + 1)
    .offset(offset);
  return { items: await toRaids(db, rows.slice(0, limit)), hasMore: rows.length > limit };
}

export async function raidDetail(db: Database, id: number): Promise<RaidDetail> {
  const rows = await db.select().from(raids).where(eq(raids.id, id)).limit(1);
  const raid = rows[0];
  if (!raid) throw notFound(`raid ${id} does not exist`);
  const [item] = await toRaids(db, [raid]);
  const during = (await deathsDuring(db, [raid])).get(raid.id) ?? [];
  const refs = await playerRefs(
    db,
    during.map((death) => death.playerId)
  );
  return {
    ...item!,
    deaths: during.map((death) => ({
      player: refs.get(death.playerId) ?? null,
      at: death.diedAt.toISOString(),
      x: round(death.x),
      z: round(death.z)
    }))
  };
}

export async function raidCount(db: Database): Promise<number> {
  const rows = await db.select({ count: sql<number>`count(*)::int` }).from(raids);
  return rows[0]?.count ?? 0;
}
