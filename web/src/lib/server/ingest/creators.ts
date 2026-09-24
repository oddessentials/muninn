import { desc, eq, sql } from 'drizzle-orm';
import { characters, creatorAccounts } from '../db/schema';
import { findPlayer, type ProjectionContext } from './context';

export async function learnCreator(
  ctx: ProjectionContext,
  creatorId: number | null | undefined,
  platformUserId: string | null | undefined
): Promise<void> {
  if (!creatorId || !platformUserId) return;
  await ctx.tx
    .insert(creatorAccounts)
    .values({ creatorId, platformUserId })
    .onConflictDoUpdate({
      target: creatorAccounts.creatorId,
      set: { platformUserId, updatedAt: sql`now()` },
      setWhere: sql`${creatorAccounts.platformUserId} <> excluded.platform_user_id`
    });
}

export async function builderForCreator(
  ctx: ProjectionContext,
  creatorId: number | null | undefined
): Promise<number | null> {
  if (!creatorId) return null;
  const accounts = await ctx.tx
    .select({ platformUserId: creatorAccounts.platformUserId })
    .from(creatorAccounts)
    .where(eq(creatorAccounts.creatorId, creatorId))
    .limit(1);
  const account = accounts[0] ? await findPlayer(ctx, accounts[0].platformUserId) : null;
  if (account) return account.id;
  const known = await ctx.tx
    .select({ playerId: characters.playerId })
    .from(characters)
    .where(eq(characters.characterId, creatorId))
    .orderBy(desc(characters.lastSeen))
    .limit(1);
  return known[0]?.playerId ?? null;
}
