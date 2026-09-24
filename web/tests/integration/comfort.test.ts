import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { Comfort, StructureBuiltEvent } from '../../src/lib/api/types';
import { getDb } from '../../src/lib/server/db/client';
import { comfortCatalogues, ingestBatches, structuresDaily } from '../../src/lib/server/db/schema';
import { applyBatchInTransaction } from '../../src/lib/server/ingest/ingest';
import { validateAgainst } from '../../src/lib/server/ingest/validate';
import { comfortCatalogue } from '../../src/lib/server/read/comfort';
import { POST as ingestCatalogue } from '../../src/routes/api/ingest/catalogue/+server';
import { GET as getComfort } from '../../src/routes/api/v1/comfort/+server';
import {
  comfortUpload,
  resetDatabase,
  routeEvent,
  seededBatches,
  signedCatalogueRequest,
  useTestDatabase
} from './setup';

vi.setConfig({ testTimeout: 240_000, hookTimeout: 240_000 });

beforeAll(async () => {
  useTestDatabase();
  await resetDatabase();
});

const post = async (request: Request) => (await ingestCatalogue(routeEvent(request))).status;

describe('POST /api/ingest/catalogue', () => {
  it('refuses forged, stale, malformed, unstorable and oversized uploads and records each refusal', async () => {
    const upload = comfortUpload();
    const first = upload.pieces[0]!;
    const forged = signedCatalogueRequest(upload, {
      'x-telemetry-signature': 'sha256=' + '0'.repeat(64)
    });
    expect(await post(forged)).toBe(401);
    const stale = signedCatalogueRequest(upload, {
      'x-telemetry-timestamp': String(Math.floor(Date.now() / 1000) - 3600)
    });
    expect(await post(stale)).toBe(401);
    const malformed = [
      'not json',
      { ...upload, pieces: [{ ...first, comfort: 0 }] },
      { ...upload, extra: true },
      { ...upload, pieces: [first, first] },
      { ...upload, groups: ['Fire', 'Fire'] },
      { ...upload, pieces: [] },
      { ...upload, pieces: [{ ...first, season: '' }] },
      { ...upload, generated_at: '2026-12-31T23:59:60Z' },
      { ...upload, pieces: [{ ...first, name: 'Hearth\u0000' }] }
    ];
    for (const document of malformed) {
      expect(
        await post(signedCatalogueRequest(document)),
        JSON.stringify(document).slice(0, 80)
      ).toBe(422);
    }
    const huge = { ...upload, groups: ['x'.repeat(1024 * 1024)] };
    expect(await post(signedCatalogueRequest(huge))).toBe(413);
    expect(await getDb().select().from(comfortCatalogues)).toHaveLength(0);
    const refusals = await getDb().select({ status: ingestBatches.status }).from(ingestBatches);
    expect(refusals.map((row) => row.status).sort()).toEqual([
      401,
      401,
      413,
      ...malformed.map(() => 422)
    ]);
  });

  it('stores the catalogue and serves it with the pieces players placed on this server', async () => {
    await getDb()
      .insert(structuresDaily)
      .values([
        { date: '2026-09-01', prefab: 'fire_pit', builderPlayerId: 0, built: 3, placed: 2 },
        { date: '2026-09-05', prefab: 'fire_pit', builderPlayerId: 7, built: 2, placed: 2 },
        { date: '2026-09-07', prefab: 'fire_pit', builderPlayerId: 0, built: 1, placed: 0 },
        { date: '2026-09-03', prefab: 'piece_bed02', builderPlayerId: 0, built: 1, placed: 1 },
        { date: '2026-09-08', prefab: 'rug_straw', builderPlayerId: 0, built: 4, placed: 0 },
        { date: '2026-09-04', prefab: 'wood_wall', builderPlayerId: 0, built: 50, placed: 50 }
      ]);
    const upload = comfortUpload();
    expect(await post(signedCatalogueRequest(upload))).toBe(204);
    const response = await getComfort(routeEvent(new Request('http://test/api/v1/comfort')));
    expect(response.status).toBe(200);
    const document = (await response.json()) as Comfort;
    expect(validateAgainst('Comfort', document)).toBeNull();
    const catalogue = document.catalogue!;
    expect(catalogue.game_version).toBe(upload.game_version);
    expect(catalogue.plugin_version).toBe(upload.plugin_version);
    expect(catalogue.rested_base_s).toBe(480);
    expect(catalogue.items).toHaveLength(upload.pieces.length);
    const byPrefab = new Map(catalogue.items.map((item) => [item.prefab, item]));
    expect(byPrefab.get('fire_pit')).toMatchObject({
      built: 4,
      last_built: '2026-09-05',
      condition: 'lit_dry'
    });
    expect(byPrefab.get('piece_bed02')).toMatchObject({ built: 1, last_built: '2026-09-03' });
    expect(byPrefab.get('rug_straw')).toMatchObject({ built: 0, last_built: null });
    expect(byPrefab.get('hearth')).toMatchObject({ built: 0, last_built: null, condition: 'lit' });
    expect(byPrefab.get('piece_xmastree')).toMatchObject({ season: 'Yule', group: 'None' });
    expect(byPrefab.has('wood_wall')).toBe(false);
  });

  it('replaces the catalogue of the same game version and serves the latest upload', async () => {
    const upload = comfortUpload();
    const trimmed = { ...upload, plugin_version: '0.5.1', pieces: upload.pieces.slice(0, 3) };
    expect(await post(signedCatalogueRequest(trimmed))).toBe(204);
    expect(await getDb().select().from(comfortCatalogues)).toHaveLength(1);
    const replaced = (await comfortCatalogue(getDb())).catalogue;
    expect(replaced?.plugin_version).toBe('0.5.1');
    expect(replaced?.items).toHaveLength(3);
    expect(await post(signedCatalogueRequest({ ...upload, game_version: '1.0.15' }))).toBe(204);
    expect(await getDb().select().from(comfortCatalogues)).toHaveLength(2);
    expect((await comfortCatalogue(getDb())).catalogue?.game_version).toBe('1.0.15');
  });
});

describe('structure.built projection', () => {
  it('counts a piece as placed only when it carries a player creator id', async () => {
    const batch = seededBatches(1).find((candidate) =>
      candidate.events.some((event) => event.type === 'structure.built')
    )!;
    const built = batch.events.find(
      (event): event is StructureBuiltEvent => event.type === 'structure.built'
    )!;
    const top = Math.max(...batch.events.map((event) => event.seq));
    const byPlayer: StructureBuiltEvent = {
      ...built,
      id: randomUUID(),
      seq: top + 1,
      data: { ...built.data, prefab: 'piece_chair03' }
    };
    const byWorld: StructureBuiltEvent = {
      ...byPlayer,
      id: randomUUID(),
      seq: top + 2,
      data: { ...byPlayer.data, creator_character_id: 0, creator_platform_user_id: null }
    };
    const db = getDb();
    await db.transaction((tx) =>
      applyBatchInTransaction(tx, { ...batch, events: [byPlayer, byWorld] }, new Date())
    );
    const rows = await db
      .select()
      .from(structuresDaily)
      .where(eq(structuresDaily.prefab, 'piece_chair03'));
    expect(rows.reduce((sum, row) => sum + row.built, 0)).toBe(2);
    expect(rows.reduce((sum, row) => sum + row.placed, 0)).toBe(1);
  });
});
