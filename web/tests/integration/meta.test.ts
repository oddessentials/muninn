import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { meta } from '../../src/lib/server/db/schema';
import { connectTestDatabase, type TestDatabase } from './harness';

describe('meta table', () => {
  let handle: TestDatabase;

  beforeAll(() => {
    handle = connectTestDatabase();
  });

  afterAll(async () => {
    await handle.close();
  });

  it('writes, reads and updates a row in a fresh database', async () => {
    await handle.db.insert(meta).values({ key: 'setup_check', value: 'first' });
    const inserted = await handle.db.select().from(meta).where(eq(meta.key, 'setup_check'));
    expect(inserted).toHaveLength(1);
    expect(inserted[0]?.value).toBe('first');
    expect(inserted[0]?.updatedAt).toBeInstanceOf(Date);

    await handle.db
      .update(meta)
      .set({ value: 'second', updatedAt: new Date() })
      .where(eq(meta.key, 'setup_check'));
    const updated = await handle.db.select().from(meta).where(eq(meta.key, 'setup_check'));
    expect(updated[0]?.value).toBe('second');

    const counted = await handle.sql<
      { count: string }[]
    >`select count(*) from meta where key = 'setup_check'`;
    expect(Number(counted[0]?.count)).toBe(1);
  });

  it('starts from the migrated schema', async () => {
    const tables = await handle.sql<{ table_name: string }[]>`
      select table_name from information_schema.tables where table_schema = 'public' order by 1
    `;
    const names = tables.map((row) => row.table_name);
    for (const expected of [
      'meta',
      'events',
      'heartbeats',
      'players',
      'sessions',
      'deaths',
      'boss_kills',
      'raids',
      'map_images',
      'jobs',
      'backups'
    ]) {
      expect(names).toContain(expected);
    }
  });
});
