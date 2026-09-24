import { eq } from 'drizzle-orm';
import type { ZoneRankedResult, ZoneResultList } from '$lib/api/types';
import type { Database } from '../db/client';
import { zoneResults } from '../db/schema';
import { notFound } from '../http/respond';
import { parseZoneResult, rankZoneResults } from '../zone/results';

async function ranked(db: Database): Promise<ZoneRankedResult[]> {
  const rows = await db.select({ result: zoneResults.result }).from(zoneResults);
  return rankZoneResults(rows.map((row) => row.result));
}

export async function listZoneResults(db: Database): Promise<ZoneResultList> {
  return { items: await ranked(db) };
}

export async function upsertZoneResult(
  db: Database,
  name: string,
  body: unknown,
  now = new Date()
): Promise<ZoneRankedResult> {
  const result = parseZoneResult(body, name, now);
  const row = {
    name,
    testedAt: new Date(result.testedAt),
    overall: result.scores.overall,
    rating: result.rating,
    result,
    updatedAt: now
  };
  await db
    .insert(zoneResults)
    .values(row)
    .onConflictDoUpdate({ target: zoneResults.name, set: row });
  const entry = (await ranked(db)).find((item) => item.name === name);
  if (!entry) throw notFound(`no result for ${name}`);
  return entry;
}

export async function deleteZoneResult(db: Database, name: string): Promise<void> {
  const removed = await db
    .delete(zoneResults)
    .where(eq(zoneResults.name, name))
    .returning({ name: zoneResults.name });
  if (removed.length === 0) throw notFound(`no result for ${name}`);
}
