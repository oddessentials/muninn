import { and, asc, desc, eq, gte, sql } from 'drizzle-orm';
import type { ProgressionKey, Save, World, WorldMap } from '$lib/api/types';
import type { Database } from '../db/client';
import { events, globalKeys, mapImages, saves } from '../db/schema';
import { iso, round } from '../http/respond';
import { keyCategory, worldDayLengthSeconds } from '../names';
import { computeStatus, statusRecord } from './status';
import { siteFeatures } from '../settings';

export async function progression(db: Database): Promise<ProgressionKey[]> {
  const rows = await db
    .select()
    .from(globalKeys)
    .orderBy(asc(globalKeys.firstSetAt), asc(globalKeys.key));
  return rows.map((row) => ({
    key: row.key,
    value: row.value,
    category: keyCategory(row.key),
    first_set_at: row.firstSetAt.toISOString(),
    day: row.worldDay
  }));
}

export async function mapInfo(db: Database, worldUid: number | null): Promise<WorldMap> {
  if (worldUid === null || !Number.isFinite(worldUid)) {
    return { available: false, image_url: null, size_px: null, radius_m: null, generated_at: null };
  }
  const rows = await db
    .select({
      size: mapImages.size,
      radius: mapImages.radius,
      generatedAt: mapImages.generatedAt
    })
    .from(mapImages)
    .where(eq(mapImages.worldUid, worldUid))
    .limit(1);
  const row = rows[0];
  if (!row)
    return { available: false, image_url: null, size_px: null, radius_m: null, generated_at: null };
  return {
    available: true,
    image_url: '/api/v1/world/map.png',
    size_px: row.size,
    radius_m: row.radius,
    generated_at: row.generatedAt.toISOString()
  };
}

export async function currentWorldUid(db: Database): Promise<number | null> {
  const status = await statusRecord(db);
  if (status?.worldUid !== null && status?.worldUid !== undefined) return status.worldUid;
  const latest = await db
    .select({ worldUid: mapImages.worldUid })
    .from(mapImages)
    .orderBy(desc(mapImages.generatedAt))
    .limit(1);
  return latest[0]?.worldUid ?? null;
}

export async function worldSummary(db: Database, now = new Date()): Promise<World> {
  const status = await computeStatus(db, now);
  const record = await statusRecord(db);
  const dayAgo = new Date(now.getTime() - 24 * 3600 * 1000);
  const saveStats = await db
    .select({
      count: sql<number>`count(*)::int`,
      avg: sql<number | null>`avg(${saves.durationMs})`
    })
    .from(saves)
    .where(gte(saves.at, dayAgo));
  const lastSave = await db.select().from(saves).orderBy(desc(saves.at)).limit(1);
  const rollbacks = await db
    .select()
    .from(events)
    .where(eq(events.type, 'world.rollback_detected'))
    .orderBy(desc(events.ts))
    .limit(50);
  const worldUid = await currentWorldUid(db);
  const netTime = status.world?.net_time ?? record?.netTime ?? 0;
  return {
    name: status.world?.name ?? record?.worldName ?? '',
    uid: status.world?.uid ?? worldUid ?? 0,
    day: status.world?.day ?? Math.floor(netTime / worldDayLengthSeconds),
    net_time: round(netTime, 1),
    day_length_s: worldDayLengthSeconds,
    saves: {
      last_at: iso(lastSave[0]?.at ?? record?.lastSaveAt ?? null),
      count_24h: saveStats[0]?.count ?? 0,
      avg_duration_ms:
        saveStats[0]?.avg === null || saveStats[0]?.avg === undefined
          ? null
          : round(Number(saveStats[0].avg), 0)
    },
    rollbacks: rollbacks.map((row) => {
      const data = row.data as { from_net_time?: number; to_net_time?: number };
      return {
        detected_at: row.ts.toISOString(),
        from_net_time: Number(data.from_net_time ?? 0),
        to_net_time: Number(data.to_net_time ?? 0)
      };
    }),
    map: (await siteFeatures(db)).map ? await mapInfo(db, worldUid) : null
  };
}

export async function mapImage(db: Database, worldUid: number | null) {
  if (worldUid === null) return null;
  const rows = await db.select().from(mapImages).where(eq(mapImages.worldUid, worldUid)).limit(1);
  return rows[0] ?? null;
}

export async function listSaves(db: Database, limit: number, offset: number) {
  const rows = await db
    .select()
    .from(saves)
    .orderBy(desc(saves.at), desc(saves.id))
    .limit(limit + 1)
    .offset(offset);
  const items: Save[] = rows.slice(0, limit).map((row) => ({
    at: row.at.toISOString(),
    duration_ms: row.durationMs
  }));
  return { items, hasMore: rows.length > limit };
}

export async function storeMapImage(
  db: Database,
  worldUid: number,
  png: Buffer,
  size: number,
  radius: number,
  generatedAt = new Date()
) {
  await db
    .insert(mapImages)
    .values({ worldUid, png, size, radius, generatedAt })
    .onConflictDoUpdate({
      target: mapImages.worldUid,
      set: { png, size, radius, generatedAt }
    });
}

export async function latestMapGeneratedAt(db: Database): Promise<Date | null> {
  const rows = await db
    .select({ generatedAt: mapImages.generatedAt })
    .from(mapImages)
    .orderBy(desc(mapImages.generatedAt))
    .limit(1);
  return rows[0]?.generatedAt ?? null;
}

export async function saveCountFor(db: Database, runId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(saves)
    .where(and(eq(saves.runId, runId)));
  return rows[0]?.count ?? 0;
}
