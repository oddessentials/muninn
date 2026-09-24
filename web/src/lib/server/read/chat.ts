import { and, desc, eq, gte, lt, type SQL } from 'drizzle-orm';
import type { ChatMessage } from '$lib/api/types';
import type { Database } from '../db/client';
import { chatMessages } from '../db/schema';
import { round } from '../http/respond';
import { biomeName } from '../names';
import { playerRefs } from './players';

export const chatKinds = ['shout', 'ping', 'say'] as const;

export interface ChatOptions {
  kind: (typeof chatKinds)[number] | null;
  playerId: number | null;
  since: Date | null;
  until: Date | null;
  limit: number;
  offset: number;
}

export async function listChat(db: Database, options: ChatOptions) {
  const conditions: SQL[] = [];
  if (options.kind) conditions.push(eq(chatMessages.kind, options.kind));
  if (options.playerId !== null) conditions.push(eq(chatMessages.playerId, options.playerId));
  if (options.since) conditions.push(gte(chatMessages.at, options.since));
  if (options.until) conditions.push(lt(chatMessages.at, options.until));
  const rows = await db
    .select()
    .from(chatMessages)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(chatMessages.at), desc(chatMessages.id))
    .limit(options.limit + 1)
    .offset(options.offset);
  const page = rows.slice(0, options.limit);
  const refs = await playerRefs(
    db,
    page.flatMap((row) => (row.playerId ? [row.playerId] : []))
  );
  const items: ChatMessage[] = page.map((row) => ({
    id: row.id,
    at: row.at.toISOString(),
    day: row.worldDay,
    kind: row.kind as ChatMessage['kind'],
    player: row.playerId ? (refs.get(row.playerId) ?? null) : null,
    text: row.text,
    x: round(row.x),
    z: round(row.z),
    biome: biomeName(row.biome)
  }));
  return { items, hasMore: rows.length > options.limit };
}
