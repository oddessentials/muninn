import { asc, desc, eq, sql } from 'drizzle-orm';
import type { Boss, BossDetail, BossEvent } from '$lib/api/types';
import type { Database } from '../db/client';
import { bossEvents, bossKills, bossState, globalKeys } from '../db/schema';
import { notFound, round } from '../http/respond';
import { biomeName, bossName, knownBosses } from '../names';
import { bossForKey, isFinalKey, phaseOfPrefab, type BossTier } from '$lib/world/bosses';
import { playerRefs } from './players';

interface BossAggregate {
  key: string;
  tier: BossTier;
  prefab: string | null;
  nameKey: string | null;
  summons: number;
  engaged: number;
  kills: number;
  firstKill: typeof bossKills.$inferSelect | null;
  lastKillAt: Date | null;
  active: boolean;
  keySeen: { at: Date; day: number } | null;
}

function defeatOf(aggregate: BossAggregate): Boss['defeat'] {
  const kill = aggregate.firstKill;
  if (kill?.firstTime) {
    return { since: kill.killedAt.toISOString(), day: kill.worldDay, observed: true };
  }
  const evidence = [
    ...(aggregate.keySeen ? [aggregate.keySeen] : []),
    ...(kill ? [{ at: kill.killedAt, day: kill.worldDay }] : [])
  ].sort((a, b) => a.at.getTime() - b.at.getTime());
  const earliest = evidence[0];
  if (!earliest) return null;
  return { since: earliest.at.toISOString(), day: earliest.day, observed: false };
}

function defeatTime(aggregate: BossAggregate): number {
  const at = defeatOf(aggregate)?.since;
  return at ? Date.parse(at) : Number.MAX_SAFE_INTEGER;
}

export const bossFightWindowSeconds = 3600;

function stillFighting(state: typeof bossState.$inferSelect, now: Date): boolean {
  if (!state.active || !state.engagedAt) return false;
  return (now.getTime() - state.engagedAt.getTime()) / 1000 <= bossFightWindowSeconds;
}

function countsForRow(key: string, prefab: string | null): boolean {
  const known = bossForKey(key);
  if (!known || prefab === null) return true;
  return prefab.toLowerCase() === known.prefab.toLowerCase();
}

async function aggregates(db: Database, now: Date): Promise<Map<string, BossAggregate>> {
  const out = new Map<string, BossAggregate>();
  const ensure = (key: string): BossAggregate => {
    const existing = out.get(key);
    if (existing) return existing;
    const created: BossAggregate = {
      key,
      tier: bossForKey(key)?.tier ?? 'other',
      prefab: null,
      nameKey: null,
      summons: 0,
      engaged: 0,
      kills: 0,
      firstKill: null,
      lastKillAt: null,
      active: false,
      keySeen: null
    };
    out.set(key, created);
    return created;
  };
  for (const boss of knownBosses) ensure(boss.key);
  const eventCounts = await db
    .select({
      key: bossEvents.key,
      kind: bossEvents.kind,
      prefab: bossEvents.prefab,
      count: sql<number>`count(*)::int`,
      nameKey: sql<string | null>`max(${bossEvents.nameKey})`
    })
    .from(bossEvents)
    .groupBy(bossEvents.key, bossEvents.kind, bossEvents.prefab);
  for (const row of eventCounts) {
    const aggregate = ensure(row.key);
    if (countsForRow(row.key, row.prefab)) {
      if (row.kind === 'summoned') aggregate.summons += row.count;
      if (row.kind === 'engaged') aggregate.engaged += row.count;
      aggregate.prefab = aggregate.prefab ?? row.prefab;
      aggregate.nameKey = aggregate.nameKey ?? row.nameKey;
    }
  }
  const killRows = await db
    .select()
    .from(bossKills)
    .orderBy(asc(bossKills.killedAt), asc(bossKills.id));
  for (const kill of killRows) {
    const aggregate = ensure(kill.key);
    aggregate.kills += 1;
    if (!aggregate.firstKill) aggregate.firstKill = kill;
    if (!aggregate.lastKillAt || kill.killedAt > aggregate.lastKillAt)
      aggregate.lastKillAt = kill.killedAt;
    aggregate.prefab = aggregate.prefab ?? kill.prefab;
    aggregate.nameKey = aggregate.nameKey ?? kill.nameKey;
  }
  const states = await db.select().from(bossState);
  for (const state of states) {
    if (out.has(state.key)) out.get(state.key)!.active = stillFighting(state, now);
  }
  const keys = await db.select().from(globalKeys);
  for (const key of keys) {
    const known = bossForKey(key.key);
    if (!known || !isFinalKey(key.key)) continue;
    ensure(known.key).keySeen = { at: key.firstSetAt, day: key.worldDay };
  }
  for (const [key, aggregate] of out) {
    if (aggregate.tier === 'other' && aggregate.kills === 0 && !aggregate.keySeen) out.delete(key);
  }
  return out;
}

function definitionOrder(key: string): number {
  return bossForKey(key)?.order ?? 0;
}

function orderKeys(map: Map<string, BossAggregate>): BossAggregate[] {
  const forsaken = [...map.values()].filter((entry) => entry.tier === 'forsaken');
  forsaken.sort((a, b) => definitionOrder(a.key) - definitionOrder(b.key));
  const mini = [...map.values()].filter((entry) => entry.tier === 'mini');
  mini.sort((a, b) => definitionOrder(a.key) - definitionOrder(b.key));
  const other = [...map.values()].filter((entry) => entry.tier === 'other');
  other.sort((a, b) => defeatTime(a) - defeatTime(b) || a.key.localeCompare(b.key));
  return [...forsaken, ...mini, ...other];
}

async function toBoss(db: Database, aggregate: BossAggregate, order: number): Promise<Boss> {
  let firstKill: Boss['first_kill'] = null;
  if (aggregate.firstKill) {
    const ids =
      aggregate.firstKill.participantPlayerIds.length > 0
        ? aggregate.firstKill.participantPlayerIds
        : aggregate.firstKill.nearbyPlayerIds;
    const refs = await playerRefs(db, ids);
    firstKill = {
      at: aggregate.firstKill.killedAt.toISOString(),
      day: aggregate.firstKill.worldDay,
      participants: ids.map((id) => refs.get(id) ?? null)
    };
  }
  return {
    key: aggregate.key,
    name: bossName(aggregate.key, aggregate.prefab, aggregate.nameKey),
    tier: aggregate.tier,
    order,
    summons: aggregate.summons,
    engaged: aggregate.engaged,
    kills: aggregate.kills,
    first_kill: firstKill,
    last_kill_at: aggregate.lastKillAt ? aggregate.lastKillAt.toISOString() : null,
    active: aggregate.active,
    defeat: defeatOf(aggregate)
  };
}

export async function listBosses(db: Database, now = new Date()): Promise<Boss[]> {
  const ordered = orderKeys(await aggregates(db, now));
  const items: Boss[] = [];
  let others = 0;
  for (const aggregate of ordered) {
    const order = aggregate.tier === 'other' ? ++others : definitionOrder(aggregate.key);
    items.push(await toBoss(db, aggregate, order));
  }
  return items;
}

export async function bossEventItems(
  db: Database,
  key: string,
  limit: number,
  offset: number
): Promise<{ items: BossEvent[]; hasMore: boolean }> {
  const rows = await db
    .select()
    .from(bossEvents)
    .where(eq(bossEvents.key, key))
    .orderBy(desc(bossEvents.at), desc(bossEvents.id))
    .limit(limit + 1)
    .offset(offset);
  const page = rows.slice(0, limit);
  const refs = await playerRefs(
    db,
    page.flatMap((row) => [
      ...row.participantPlayerIds,
      ...row.nearbyPlayerIds,
      ...(row.summonerPlayerId ? [row.summonerPlayerId] : [])
    ])
  );
  const items: BossEvent[] = page.map((row) => ({
    id: row.eventId,
    kind: row.kind as BossEvent['kind'],
    phase: row.prefab ? phaseOfPrefab(row.prefab) : null,
    at: row.at.toISOString(),
    day: row.worldDay,
    x: row.x === null ? null : round(row.x),
    z: row.z === null ? null : round(row.z),
    biome: row.biome ? biomeName(row.biome) : null,
    participants: row.participantPlayerIds.map((id) => refs.get(id) ?? null),
    nearby: row.nearbyPlayerIds.map((id) => refs.get(id) ?? null),
    summoner: row.summonerPlayerId ? (refs.get(row.summonerPlayerId) ?? null) : null,
    first_time: row.firstTime
  }));
  return { items, hasMore: rows.length > limit };
}

export async function bossDetail(db: Database, key: string, now = new Date()): Promise<BossDetail> {
  const bosses = await listBosses(db, now);
  const boss = bosses.find((entry) => entry.key === key);
  if (!boss) throw notFound(`boss ${key} does not exist`);
  const events = await bossEventItems(db, key, 50, 0);
  return { ...boss, events: events.items };
}

export async function bossExists(db: Database, key: string): Promise<boolean> {
  return (await listBosses(db)).some((entry) => entry.key === key);
}
