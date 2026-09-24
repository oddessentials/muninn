import { lt } from 'drizzle-orm';
import { getDb, type Database } from '../db/client';
import {
  heartbeats,
  ingestBatches,
  jobs,
  positions,
  statusSamples,
  structureEvents
} from '../db/schema';
import { pruneSessions } from '../auth/admin';

export const retention = {
  positionsDays: 7,
  structureEventsDays: 30,
  statusSamplesDays: 90,
  heartbeatsDays: 7,
  ingestBatchesDays: 7,
  jobsDays: 30
} as const;

export interface PruneResult {
  positions: number;
  structureEvents: number;
  statusSamples: number;
  heartbeats: number;
  ingestBatches: number;
  jobs: number;
  adminSessions: number;
}

const daysAgo = (now: Date, days: number) => new Date(now.getTime() - days * 24 * 3600 * 1000);

export async function runPrune(db: Database = getDb(), now = new Date()): Promise<PruneResult> {
  const deletedPositions = await db
    .delete(positions)
    .where(lt(positions.ts, daysAgo(now, retention.positionsDays)))
    .returning({ ts: positions.ts });
  const deletedStructures = await db
    .delete(structureEvents)
    .where(lt(structureEvents.at, daysAgo(now, retention.structureEventsDays)))
    .returning({ id: structureEvents.id });
  const deletedSamples = await db
    .delete(statusSamples)
    .where(lt(statusSamples.ts, daysAgo(now, retention.statusSamplesDays)))
    .returning({ ts: statusSamples.ts });
  const deletedHeartbeats = await db
    .delete(heartbeats)
    .where(lt(heartbeats.ts, daysAgo(now, retention.heartbeatsDays)))
    .returning({ id: heartbeats.id });
  const deletedBatches = await db
    .delete(ingestBatches)
    .where(lt(ingestBatches.receivedAt, daysAgo(now, retention.ingestBatchesDays)))
    .returning({ id: ingestBatches.id });
  const deletedJobs = await db
    .delete(jobs)
    .where(lt(jobs.createdAt, daysAgo(now, retention.jobsDays)))
    .returning({ id: jobs.id });
  return {
    positions: deletedPositions.length,
    structureEvents: deletedStructures.length,
    statusSamples: deletedSamples.length,
    heartbeats: deletedHeartbeats.length,
    ingestBatches: deletedBatches.length,
    jobs: deletedJobs.length,
    adminSessions: await pruneSessions()
  };
}
