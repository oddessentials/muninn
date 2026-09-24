import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import {
  bellLeadSeconds,
  bellOffsetSeconds,
  crossedOffset,
  crowLeadSeconds,
  crowOffsetSeconds,
  isWorldTimeAdvancing,
  worldDay
} from '$lib/world/clock';
import { getDb, type Database } from '../db/client';
import { events } from '../db/schema';
import { createContext, type StoredEnvelope } from '../ingest/context';
import { applyEvent } from '../ingest/projections';
import { computeStatus, latestRun } from '../read/status';

export const duskEventType = 'world.dusk_approaching';
export const dawnEventType = 'world.dawn_approaching';

type HeraldEvent = Extract<StoredEnvelope, { type: typeof duskEventType | typeof dawnEventType }>;
type HeraldBase = Omit<HeraldEvent, 'type' | 'data'>;

interface Herald {
  type: HeraldEvent['type'];
  offsetSeconds: number;
  event(base: HeraldBase, crossing: number, at: Date): HeraldEvent;
}

const turnAt = (at: Date, leadSeconds: number) =>
  new Date(at.getTime() + leadSeconds * 1000).toISOString();

export const heraldsOfTheDay: readonly Herald[] = [
  {
    type: duskEventType,
    offsetSeconds: bellOffsetSeconds,
    event: (base, crossing, at) => ({
      ...base,
      type: duskEventType,
      data: { net_time: crossing, dusk_at: turnAt(at, bellLeadSeconds), dusk_in_s: bellLeadSeconds }
    })
  },
  {
    type: dawnEventType,
    offsetSeconds: crowOffsetSeconds,
    event: (base, crossing, at) => ({
      ...base,
      type: dawnEventType,
      data: { net_time: crossing, dawn_at: turnAt(at, crowLeadSeconds), dawn_in_s: crowLeadSeconds }
    })
  }
];

interface Sample {
  runId: string;
  netTime: number;
}

export interface HeraldsResult {
  syntheticEvents: StoredEnvelope[];
}

export interface Heralds {
  tick(now?: Date): Promise<HeraldsResult>;
  reset(): void;
}

export function createHeralds(db: Database = getDb()): Heralds {
  let previous: Sample | null = null;

  async function alreadyHeralded(
    type: HeraldEvent['type'],
    runId: string,
    day: number
  ): Promise<boolean> {
    const rows = await db
      .select({ id: events.id })
      .from(events)
      .where(and(eq(events.type, type), eq(events.runId, runId), eq(events.worldDay, day)))
      .limit(1);
    return rows.length > 0;
  }

  async function announce(
    herald: Herald,
    sample: Sample,
    crossing: number,
    now: Date
  ): Promise<StoredEnvelope> {
    const run = await latestRun(db);
    const at = new Date(now.getTime() - (sample.netTime - crossing) * 1000);
    const synthetic = herald.event(
      {
        id: randomUUID(),
        seq: (run?.lastSeq ?? 0) + 1,
        run_id: sample.runId,
        ts: at.toISOString(),
        world_day: worldDay(crossing)
      },
      crossing,
      at
    );
    await db.transaction(async (tx) => {
      await tx.insert(events).values({
        id: synthetic.id,
        runId: synthetic.run_id,
        seq: synthetic.seq,
        type: synthetic.type,
        ts: at,
        receivedAt: now,
        worldDay: synthetic.world_day,
        data: synthetic.data
      });
      await applyEvent(createContext(tx, now), synthetic);
    });
    return synthetic;
  }

  return {
    async tick(now = new Date()): Promise<HeraldsResult> {
      const result: HeraldsResult = { syntheticEvents: [] };
      const status = await computeStatus(db, now);
      if (!status.world || !status.run || !isWorldTimeAdvancing(status)) {
        previous = null;
        return result;
      }
      const sample: Sample = { runId: status.run.run_id, netTime: status.world.net_time };
      const last = previous;
      previous = sample;
      if (!last || last.runId !== sample.runId) return result;
      for (const each of heraldsOfTheDay) {
        const crossing = crossedOffset(last.netTime, sample.netTime, each.offsetSeconds);
        if (crossing === null) continue;
        if (await alreadyHeralded(each.type, sample.runId, worldDay(crossing))) continue;
        result.syntheticEvents.push(await announce(each, sample, crossing, now));
      }
      return result;
    },
    reset() {
      previous = null;
    }
  };
}

let instance: Heralds | null = null;

export function heralds(): Heralds {
  if (!instance) instance = createHeralds();
  return instance;
}
