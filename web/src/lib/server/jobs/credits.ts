import { sql } from 'drizzle-orm';
import { getDb, type Database } from '../db/client';
import {
  creatorAccounts,
  eventPlayers,
  events,
  meta,
  players,
  structureEvents,
  structuresDaily
} from '../db/schema';
import { createContext } from '../ingest/context';
import { builderForCreator } from '../ingest/creators';
import { rebuildLockKey } from './rebuild';

export const creditsAppliedKey = 'structures.creators_applied_at';
const lockUnavailable = '55P03';

export interface CreditOutcome {
  credited: number;
}

export async function creditStructures(db: Database = getDb()): Promise<CreditOutcome | null> {
  return db.transaction(async (tx) => {
    const lock = await tx.execute<{ locked: boolean }>(
      sql`select pg_try_advisory_xact_lock(${rebuildLockKey}) as locked`
    );
    if (!lock[0]?.locked) return null;
    const pending = await tx.execute<{ latest: string | null }>(sql`
      select max(updated_at)::text as latest
      from ${creatorAccounts}
      where updated_at > coalesce(
        (select value::timestamptz from ${meta} where key = ${creditsAppliedKey}),
        '-infinity'::timestamptz
      )
    `);
    const latest = pending[0]?.latest ?? null;
    if (latest === null) return null;
    const exclusive = await tx
      .transaction(async (attempt) => {
        await attempt.execute(
          sql`lock table ${players}, ${structureEvents}, ${structuresDaily} in share row exclusive mode nowait`
        );
        return true;
      })
      .catch((error: unknown) => {
        const failure = error as { code?: string; cause?: { code?: string } };
        if ((failure.code ?? failure.cause?.code) === lockUnavailable) return false;
        throw error;
      });
    if (!exclusive) return null;
    const creators = await tx.execute<{ creator_id: string }>(sql`
      select distinct (data->>'creator_character_id')::bigint as creator_id
      from ${events}
      where type in ('structure.built', 'structure.destroyed')
        and player_id is null
        and coalesce((data->>'creator_character_id')::bigint, 0) <> 0
    `);
    const ctx = createContext(tx, new Date());
    const pairs: { creatorId: number; playerId: number }[] = [];
    for (const row of creators) {
      const creatorId = Number(row.creator_id);
      const playerId = await builderForCreator(ctx, creatorId);
      if (playerId !== null) pairs.push({ creatorId, playerId });
    }
    let credited = 0;
    if (pairs.length > 0) {
      const values = sql.join(
        pairs.map((pair) => sql`(${pair.creatorId}::bigint, ${pair.playerId}::integer)`),
        sql`, `
      );
      const updated = await tx.execute<{ count: number }>(sql`
        with credited as (
          update ${events} as e set player_id = pair.player_id
          from (values ${values}) as pair(creator_id, player_id)
          where e.type in ('structure.built', 'structure.destroyed')
            and e.player_id is null
            and (e.data->>'creator_character_id')::bigint = pair.creator_id
          returning e.id, e.player_id, e.ts
        ),
        involved as (
          insert into ${eventPlayers} (event_id, player_id, ts)
          select id, player_id, ts from credited
          on conflict do nothing
        )
        select count(*)::int as count from credited
      `);
      credited = updated[0]?.count ?? 0;
      await tx.execute(sql`
        update ${structureEvents} as se set player_id = e.player_id
        from ${events} as e
        where se.event_id = e.id
          and se.player_id is null
          and e.player_id is not null
          and e.type in ('structure.built', 'structure.destroyed')
      `);
    }
    await tx.execute(sql`delete from ${structuresDaily}`);
    await tx.execute(sql`
      insert into ${structuresDaily} (date, prefab, builder_player_id, built, destroyed, placed)
      select
        (ts at time zone 'UTC')::date,
        data->>'prefab',
        coalesce(player_id, 0),
        (count(*) filter (where type = 'structure.built'))::int,
        (count(*) filter (where type = 'structure.destroyed'))::int,
        (count(*) filter (
          where type = 'structure.built'
            and coalesce((data->>'creator_character_id')::bigint, 0) <> 0
        ))::int
      from ${events}
      where type in ('structure.built', 'structure.destroyed')
      group by 1, 2, 3
    `);
    await tx.execute(sql`
      update ${players} as p set
        structures_built = coalesce(totals.built, 0),
        structures_destroyed = coalesce(totals.destroyed, 0)
      from ${players} as own
      left join (
        select builder_player_id, sum(built)::int as built, sum(destroyed)::int as destroyed
        from ${structuresDaily}
        where builder_player_id <> 0
        group by builder_player_id
      ) as totals on totals.builder_player_id = own.id
      where p.id = own.id
        and (
          p.structures_built <> coalesce(totals.built, 0)
          or p.structures_destroyed <> coalesce(totals.destroyed, 0)
        )
    `);
    await tx.execute(sql`
      insert into ${meta} (key, value, updated_at)
      values (${creditsAppliedKey}, ${latest}, now())
      on conflict (key) do update set value = excluded.value, updated_at = now()
    `);
    return { credited };
  });
}
