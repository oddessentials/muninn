import type { ExtractTablesWithRelations } from 'drizzle-orm';
import { eq, sql } from 'drizzle-orm';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import type { PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js';
import type { EventEnvelope } from '$lib/api/types';
import * as schema from '../db/schema';
import { playerAliases, players } from '../db/schema';
import { displayIdOf, platformOf } from '../names';

export type Tx = PgTransaction<
  PostgresJsQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

export type StoredEnvelope = EventEnvelope;

export interface ResolvedPlayer {
  id: number;
  platformUserId: string;
  displayName: string;
  displayNameOverride: string | null;
  platform: string;
  hidden: boolean;
  online: boolean;
  currentSessionId: number | null;
  lastBiome: string | null;
  lastX: number | null;
  lastZ: number | null;
  lastSeen: Date;
  firstSeen: Date;
}

export interface ProjectionEffects {
  statusChanged: boolean;
  onlineChanged: boolean;
  syntheticEvents: StoredEnvelope[];
}

export interface ProjectionContext {
  tx: Tx;
  receivedAt: Date;
  rebuild: boolean;
  players: Map<string, ResolvedPlayer>;
  effects: ProjectionEffects;
}

export function createContext(tx: Tx, receivedAt: Date, rebuild = false): ProjectionContext {
  return {
    tx,
    receivedAt,
    rebuild,
    players: new Map(),
    effects: { statusChanged: false, onlineChanged: false, syntheticEvents: [] }
  };
}

interface PlayerHints {
  name?: string | null;
  displayId?: string | null;
  platform?: string | null;
}

function toResolved(row: typeof players.$inferSelect): ResolvedPlayer {
  return {
    id: row.id,
    platformUserId: row.platformUserId,
    displayName: row.displayName,
    displayNameOverride: row.displayNameOverride,
    platform: row.platform,
    hidden: row.hidden,
    online: row.online,
    currentSessionId: row.currentSessionId,
    lastBiome: row.lastBiome,
    lastX: row.lastX,
    lastZ: row.lastZ,
    lastSeen: row.lastSeen,
    firstSeen: row.firstSeen
  };
}

export async function findPlayer(
  ctx: ProjectionContext,
  platformUserId: string
): Promise<ResolvedPlayer | null> {
  const cached = ctx.players.get(platformUserId);
  if (cached) return cached;
  const alias = await ctx.tx
    .select({ playerId: playerAliases.playerId })
    .from(playerAliases)
    .where(eq(playerAliases.platformUserId, platformUserId))
    .limit(1);
  const rows = alias[0]
    ? await ctx.tx.select().from(players).where(eq(players.id, alias[0].playerId)).limit(1)
    : await ctx.tx
        .select()
        .from(players)
        .where(eq(players.platformUserId, platformUserId))
        .limit(1);
  const row = rows[0];
  if (!row) return null;
  const resolved = toResolved(row);
  ctx.players.set(platformUserId, resolved);
  return resolved;
}

export async function resolvePlayer(
  ctx: ProjectionContext,
  platformUserId: string,
  seenAt: Date,
  hints: PlayerHints = {}
): Promise<ResolvedPlayer> {
  const existing = await findPlayer(ctx, platformUserId);
  if (existing) {
    const updates: Partial<typeof players.$inferInsert> = {};
    if (seenAt > existing.lastSeen) {
      updates.lastSeen = seenAt;
      existing.lastSeen = seenAt;
    }
    if (seenAt < existing.firstSeen) {
      updates.firstSeen = seenAt;
      existing.firstSeen = seenAt;
    }
    if (hints.name && hints.name !== existing.displayName && !existing.displayNameOverride) {
      updates.displayName = hints.name;
      existing.displayName = hints.name;
    }
    if (hints.name) updates.lastCharacterName = hints.name;
    if (Object.keys(updates).length > 0) {
      await ctx.tx.update(players).set(updates).where(eq(players.id, existing.id));
    }
    return existing;
  }
  const platform = platformOf(platformUserId, hints.platform);
  const displayId = hints.displayId ?? displayIdOf(platformUserId);
  const displayName = hints.name && hints.name !== '' ? hints.name : platformUserId;
  const inserted = await ctx.tx
    .insert(players)
    .values({
      platformUserId,
      displayId,
      platform,
      displayName,
      firstSeen: seenAt,
      lastSeen: seenAt,
      lastCharacterName: hints.name ?? null
    })
    .onConflictDoNothing()
    .returning();
  const row =
    inserted[0] ??
    (
      await ctx.tx.select().from(players).where(eq(players.platformUserId, platformUserId)).limit(1)
    )[0];
  if (!row) throw new Error(`player ${platformUserId} could not be created`);
  if (row.firstSeen > seenAt) {
    await ctx.tx.update(players).set({ firstSeen: seenAt }).where(eq(players.id, row.id));
    row.firstSeen = seenAt;
  }
  const resolved = toResolved(row);
  ctx.players.set(platformUserId, resolved);
  return resolved;
}

export async function bumpCounter(
  ctx: ProjectionContext,
  playerId: number,
  column: keyof Pick<
    typeof players.$inferSelect,
    | 'deaths'
    | 'killsCredited'
    | 'killsNearby'
    | 'bossKills'
    | 'raids'
    | 'structuresBuilt'
    | 'structuresDestroyed'
    | 'shouts'
    | 'sessions'
  >,
  amount = 1
): Promise<void> {
  const target = players[column];
  await ctx.tx
    .update(players)
    .set({ [column]: sql`${target} + ${amount}` })
    .where(eq(players.id, playerId));
}

export function eventDate(ts: Date): string {
  return ts.toISOString().slice(0, 10);
}

export function parseInstant(value: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`invalid timestamp ${value}`);
  return parsed;
}
