import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inject } from 'vitest';
import type { Comfort, ComfortCatalogueUpload, IngestBatch } from '../../src/lib/api/types';
import { signBatch, signMap } from '../../src/lib/server/ingest/signature';
import { generateHistory, toBatches } from '../../scripts/simulator/generator';
import { getTableName, is, sql } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';
import { getDb } from '../../src/lib/server/db/client';
import * as schema from '../../src/lib/server/db/schema';

export async function resetDatabase(): Promise<void> {
  const names = Object.values(schema)
    .filter((value) => is(value, PgTable))
    .map((table) => getTableName(table as PgTable))
    .filter((name) => name !== 'meta');
  const list = names.map((name) => `"${name}"`).join(', ');
  await getDb().execute(sql.raw(`truncate table ${list} restart identity`));
}

export function useTestDatabase(): string {
  const url = inject('databaseUrl');
  process.env.DATABASE_URL = url;
  process.env.BACKUP_DIR = mkdtempSync(join(tmpdir(), 'valheim-backups-'));
  process.env.PG_DUMP = pgDumpCommand();
  return url;
}

export function pgDumpCommand(): string {
  if (process.env.PG_DUMP) return process.env.PG_DUMP;
  const probe = spawnSync('pg_dump --version', { shell: true, stdio: 'ignore' });
  return probe.status === 0 ? 'pg_dump' : 'docker exec -i muninn-db-1 pg_dump';
}

export function pgRestoreCommand(): string[] {
  const dump = pgDumpCommand();
  if (dump === 'pg_dump') return ['pg_restore'];
  return dump.replace(/pg_dump$/, 'pg_restore').split(' ');
}

export const testSecret = () => process.env.TELEMETRY_SECRET ?? '';

export function seededHistory(days = 6) {
  return generateHistory({ days, seed: 4242, endAt: new Date() });
}

export function seededBatches(days = 6): IngestBatch[] {
  return toBatches(seededHistory(days));
}

export function signedRequest(
  batch: IngestBatch | string,
  overrides: Record<string, string> = {}
): Request {
  const body = typeof batch === 'string' ? batch : JSON.stringify(batch);
  const timestamp = overrides['x-telemetry-timestamp'] ?? String(Math.floor(Date.now() / 1000));
  return new Request('http://test/api/ingest', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-telemetry-timestamp': timestamp,
      'x-telemetry-signature': signBatch(testSecret(), Number(timestamp), body),
      ...overrides
    },
    body
  });
}

export function signedMapRequest(png: Buffer, headers: Record<string, string> = {}): Request {
  const timestamp = String(Math.floor(Date.now() / 1000));
  return new Request('http://test/api/ingest/map', {
    method: 'POST',
    headers: {
      'content-type': 'image/png',
      'x-telemetry-timestamp': timestamp,
      'x-telemetry-signature': signMap(testSecret(), Number(timestamp), png),
      'x-world-uid': '7130451826379422',
      'x-map-size': '64',
      'x-map-radius': '10000',
      ...headers
    },
    body: new Uint8Array(png)
  });
}

export function signedCatalogueRequest(
  document: unknown,
  overrides: Record<string, string> = {}
): Request {
  const body = Buffer.from(
    typeof document === 'string' ? document : JSON.stringify(document),
    'utf8'
  );
  const timestamp = overrides['x-telemetry-timestamp'] ?? String(Math.floor(Date.now() / 1000));
  return new Request('http://test/api/ingest/catalogue', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-telemetry-timestamp': timestamp,
      'x-telemetry-signature': signMap(testSecret(), Number(timestamp), body),
      ...overrides
    },
    body: new Uint8Array(body)
  });
}

export function comfortUpload(): ComfortCatalogueUpload {
  const { catalogue } = JSON.parse(
    readFileSync(new URL('../../fixtures/api/comfort.json', import.meta.url), 'utf8')
  ) as Comfort;
  if (!catalogue) throw new Error('the comfort fixture has no catalogue');
  return {
    game_version: catalogue.game_version,
    plugin_version: catalogue.plugin_version,
    generated_at: catalogue.generated_at,
    radius_m: catalogue.radius_m,
    rested_base_s: catalogue.rested_base_s,
    rested_per_level_s: catalogue.rested_per_level_s,
    groups: catalogue.groups,
    seasons: catalogue.seasons,
    pieces: catalogue.items.map((item) => ({
      prefab: item.prefab,
      token: item.token,
      name: item.name,
      comfort: item.comfort,
      group: item.group,
      condition: item.condition,
      season: item.season
    }))
  };
}

export function routeEvent(request: Request, params: Record<string, string> = {}) {
  return {
    request,
    url: new URL(request.url),
    params,
    cookies: { get: () => undefined },
    getClientAddress: () => '127.0.0.1'
  } as unknown as import('@sveltejs/kit').RequestEvent;
}
