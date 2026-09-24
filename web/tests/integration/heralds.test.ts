import { eq, isNull } from 'drizzle-orm';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { getDb } from '../../src/lib/server/db/client';
import { events, serverRuns, serverStatus } from '../../src/lib/server/db/schema';
import { applyBatchInTransaction } from '../../src/lib/server/ingest/ingest';
import { createHeralds, dawnEventType, duskEventType } from '../../src/lib/server/jobs/heralds';
import { buildActivityItems, feedIncludes } from '../../src/lib/server/read/activity';
import { bellOffsetSeconds, crowOffsetSeconds, dayLengthSeconds } from '../../src/lib/world/clock';
import { resetDatabase, seededBatches, useTestDatabase } from './setup';

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const day = 400;
const at = (base: Date, seconds: number) => new Date(base.getTime() + seconds * 1000);

async function primeWorld(base: Date, netTime: number, playerCount: number): Promise<void> {
  const db = getDb();
  await db
    .update(serverStatus)
    .set({
      online: true,
      source: 'plugin',
      playerCount,
      netTime,
      netTimeAt: base,
      lastPluginAt: base,
      telemetryDelayedSince: null
    })
    .where(eq(serverStatus.id, 1));
  await db
    .update(serverRuns)
    .set({ lastHeartbeatAt: base, lastHeartbeatReceivedAt: base })
    .where(isNull(serverRuns.stoppedAt));
}

async function heralded(type: string) {
  return getDb().select().from(events).where(eq(events.type, type));
}

beforeAll(async () => {
  useTestDatabase();
  await resetDatabase();
  const db = getDb();
  for (const batch of seededBatches(3)) {
    await db.transaction((tx) => applyBatchInTransaction(tx, batch, new Date()));
  }
});

describe('the heralds of the day', () => {
  it('ring the bell once when the world clock passes 17:00 between two ticks', async () => {
    const base = new Date();
    const start = day * dayLengthSeconds + bellOffsetSeconds - 5;
    await primeWorld(base, start, 2);
    const heralds = createHeralds(getDb());
    expect((await heralds.tick(at(base, 2))).syntheticEvents).toHaveLength(0);
    const rung = await heralds.tick(at(base, 7));
    expect(rung.syntheticEvents).toHaveLength(1);
    const event = rung.syntheticEvents[0]!;
    expect(event.type).toBe(duskEventType);
    expect(event.world_day).toBe(day);
    expect(event.ts).toBe(at(base, 5).toISOString());
    expect(event.data).toEqual({
      net_time: day * dayLengthSeconds + bellOffsetSeconds,
      dusk_at: at(base, 110).toISOString(),
      dusk_in_s: 105
    });
    expect((await heralds.tick(at(base, 12))).syntheticEvents).toHaveLength(0);
    const stored = await heralded(duskEventType);
    expect(stored).toHaveLength(1);
    expect(stored[0]?.runId).toBe(event.run_id);
    expect(feedIncludes(duskEventType, null)).toBe(true);
    const [item] = await buildActivityItems(getDb(), stored);
    expect(item?.type).toBe(duskEventType);
    expect(item?.summary).toMatchObject({ dusk_in_s: 105 });
  });

  it('crow once when the world clock passes 05:00 between two ticks', async () => {
    const base = new Date();
    const start = (day + 1) * dayLengthSeconds + crowOffsetSeconds - 3;
    await primeWorld(base, start, 1);
    const heralds = createHeralds(getDb());
    expect((await heralds.tick(at(base, 1))).syntheticEvents).toHaveLength(0);
    const crowed = await heralds.tick(at(base, 6));
    expect(crowed.syntheticEvents).toHaveLength(1);
    const event = crowed.syntheticEvents[0]!;
    expect(event.type).toBe(dawnEventType);
    expect(event.world_day).toBe(day + 1);
    expect(event.ts).toBe(at(base, 3).toISOString());
    expect(event.data).toEqual({
      net_time: (day + 1) * dayLengthSeconds + crowOffsetSeconds,
      dawn_at: at(base, 48).toISOString(),
      dawn_in_s: 45
    });
    expect((await heralds.tick(at(base, 11))).syntheticEvents).toHaveLength(0);
    const stored = await heralded(dawnEventType);
    expect(stored).toHaveLength(1);
    expect(feedIncludes(dawnEventType, null)).toBe(true);
    const [item] = await buildActivityItems(getDb(), stored);
    expect(item?.type).toBe(dawnEventType);
    expect(item?.summary).toMatchObject({ dawn_in_s: 45 });
  });

  it('do not sound twice for the same day of the same run', async () => {
    const base = new Date();
    const start = day * dayLengthSeconds + bellOffsetSeconds - 3;
    await primeWorld(base, start, 1);
    const heralds = createHeralds(getDb());
    await heralds.tick(at(base, 1));
    expect((await heralds.tick(at(base, 6))).syntheticEvents).toHaveLength(0);
    expect(await heralded(duskEventType)).toHaveLength(1);
  });

  it('ignore a jump across a turn and stay silent with nobody on', async () => {
    const base = new Date();
    const later = (day + 2) * dayLengthSeconds + bellOffsetSeconds - 100;
    await primeWorld(base, later, 2);
    const heralds = createHeralds(getDb());
    await heralds.tick(at(base, 1));
    await primeWorld(at(base, 2), later + 400, 2);
    expect((await heralds.tick(at(base, 3))).syntheticEvents).toHaveLength(0);
    await primeWorld(base, later + 95, 0);
    const idle = createHeralds(getDb());
    await idle.tick(at(base, 1));
    expect((await idle.tick(at(base, 10))).syntheticEvents).toHaveLength(0);
    expect(await heralded(duskEventType)).toHaveLength(1);
    expect(await heralded(dawnEventType)).toHaveLength(1);
  });
});
