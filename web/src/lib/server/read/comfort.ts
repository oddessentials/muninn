import { desc, inArray, sql } from 'drizzle-orm';
import type { Comfort, ComfortCatalogueUpload } from '$lib/api/types';
import type { Database } from '../db/client';
import { comfortCatalogues, structuresDaily } from '../db/schema';

export async function storeComfortCatalogue(
  db: Database,
  upload: ComfortCatalogueUpload,
  receivedAt = new Date()
) {
  await db
    .insert(comfortCatalogues)
    .values({ gameVersion: upload.game_version, receivedAt, catalogue: upload })
    .onConflictDoUpdate({
      target: comfortCatalogues.gameVersion,
      set: { receivedAt, catalogue: upload }
    });
}

async function placements(db: Database, prefabs: string[]) {
  if (prefabs.length === 0) return new Map<string, { placed: number; lastPlaced: string | null }>();
  const rows = await db
    .select({
      prefab: structuresDaily.prefab,
      placed: sql<number>`coalesce(sum(${structuresDaily.placed}), 0)::int`,
      lastPlaced: sql<
        string | null
      >`(max(${structuresDaily.date}) filter (where ${structuresDaily.placed} > 0))::text`
    })
    .from(structuresDaily)
    .where(inArray(structuresDaily.prefab, prefabs))
    .groupBy(structuresDaily.prefab);
  return new Map(
    rows.map((row) => [row.prefab, { placed: row.placed, lastPlaced: row.lastPlaced }])
  );
}

export async function comfortCatalogue(db: Database): Promise<Comfort> {
  const rows = await db
    .select()
    .from(comfortCatalogues)
    .orderBy(desc(comfortCatalogues.receivedAt))
    .limit(1);
  const row = rows[0];
  if (!row) return { catalogue: null };
  const upload = row.catalogue;
  const records = await placements(db, [...new Set(upload.pieces.map((piece) => piece.prefab))]);
  return {
    catalogue: {
      game_version: upload.game_version,
      plugin_version: upload.plugin_version,
      generated_at: new Date(upload.generated_at).toISOString(),
      received_at: row.receivedAt.toISOString(),
      radius_m: upload.radius_m,
      rested_base_s: upload.rested_base_s,
      rested_per_level_s: upload.rested_per_level_s,
      groups: upload.groups,
      seasons: upload.seasons,
      items: upload.pieces.map((piece) => {
        const record = records.get(piece.prefab);
        return { ...piece, built: record?.placed ?? 0, last_built: record?.lastPlaced ?? null };
      })
    }
  };
}
