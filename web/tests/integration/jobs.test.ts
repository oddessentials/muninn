import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { and, eq, isNull, sql } from 'drizzle-orm';
import postgres from 'postgres';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { IngestBatch } from '../../src/lib/api/types';
import { getDb } from '../../src/lib/server/db/client';
import {
  events,
  positions,
  serverRuns,
  sessions,
  statusSamples
} from '../../src/lib/server/db/schema';
import { applyBatchInTransaction } from '../../src/lib/server/ingest/ingest';
import { pollA2s } from '../../src/lib/server/jobs/a2s';
import { backupOptions, runBackup } from '../../src/lib/server/jobs/backup';
import { runPrune } from '../../src/lib/server/jobs/prune';
import { runWatchdog } from '../../src/lib/server/jobs/watchdog';
import { computeStatus } from '../../src/lib/server/read/status';
import { withDatabaseName } from './harness';
import { pgRestoreCommand, resetDatabase, seededBatches, useTestDatabase } from './setup';

let databaseUrl = '';

vi.setConfig({ testTimeout: 240_000, hookTimeout: 240_000 });

beforeAll(async () => {
  databaseUrl = useTestDatabase();
  await resetDatabase();
  const db = getDb();
  for (const batch of seededBatches(4)) {
    await db.transaction((tx) => applyBatchInTransaction(tx, batch, new Date()));
  }
});

describe('background jobs', () => {
  it('closes a lost run and its sessions after the heartbeat window', async () => {
    const db = getDb();
    const open = await db.select().from(serverRuns).where(isNull(serverRuns.stoppedAt));
    expect(open).toHaveLength(1);
    const run = open[0]!;
    const openSessions = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.runId, run.runId), isNull(sessions.leftAt)));
    expect(openSessions.length).toBeGreaterThan(0);
    const quiet = await runWatchdog(db, new Date(), new Date(0));
    expect(quiet.lostRuns).toHaveLength(0);
    const later = new Date(Date.now() + 10 * 60_000);
    const justRestarted = await runWatchdog(db, later, new Date(later.getTime() - 60_000));
    expect(justRestarted.lostRuns).toHaveLength(0);
    const result = await runWatchdog(db, later, new Date(0));
    expect(result.lostRuns).toEqual([run.runId]);
    const closed = await db.select().from(serverRuns).where(eq(serverRuns.runId, run.runId));
    expect(closed[0]?.stopReason).toBe('inferred');
    const stillOpen = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.runId, run.runId), isNull(sessions.leftAt)));
    expect(stillOpen).toHaveLength(0);
    const lostEvents = await db.select().from(events).where(eq(events.type, 'server.lost'));
    expect(lostEvents).toHaveLength(1);
    const status = await computeStatus(db, later);
    expect(status.online).toBe(false);
    expect(status.telemetry.delayed_since).not.toBeNull();
  });

  it('judges liveness by when a heartbeat arrived, not by the plugin clock', async () => {
    const db = getDb();
    const run = (
      await db.select().from(serverRuns).where(eq(serverRuns.stopReason, 'inferred'))
    )[0]!;
    const staleTs = new Date(run.lastHeartbeatAt!.getTime() + 60_000);
    const receivedAt = new Date(Date.now() + 20 * 60_000);
    const batch: IngestBatch = {
      plugin: { name: 'GuildTelemetry', version: '0.2.0' },
      game: { version: '1.0.12', network_version: 39 },
      server: { name: 'Ravenhold', world: 'savegame', world_uid: -198757517 },
      events: [
        {
          id: randomUUID(),
          run_id: run.runId,
          seq: run.lastSeq + 2,
          ts: staleTs.toISOString(),
          type: 'server.heartbeat',
          world_day: run.lastWorldDay ?? 1,
          data: {
            uptime_s: (run.uptimeS ?? 0) + 60,
            net_time: (run.lastNetTime ?? 0) + 60,
            world_day: run.lastWorldDay ?? 1,
            last_save_age_s: 30,
            queue_depth: 0,
            dropped_events: 0,
            players: []
          }
        }
      ]
    };
    await db.transaction((tx) => applyBatchInTransaction(tx, batch, receivedAt));
    const reopened = (
      await db.select().from(serverRuns).where(eq(serverRuns.runId, run.runId))
    )[0]!;
    expect(reopened.stoppedAt).toBeNull();
    expect(reopened.lastHeartbeatAt?.toISOString()).toBe(staleTs.toISOString());
    expect(reopened.lastHeartbeatReceivedAt?.toISOString()).toBe(receivedAt.toISOString());
    const soon = await runWatchdog(db, new Date(receivedAt.getTime() + 30_000), new Date(0));
    expect(soon.lostRuns).toHaveLength(0);
    const much = await runWatchdog(db, new Date(receivedAt.getTime() + 10 * 60_000), new Date(0));
    expect(much.lostRuns).toEqual([run.runId]);
  });

  it('prunes old positions and status samples', async () => {
    const db = getDb();
    const old = new Date(Date.now() - 20 * 24 * 3600 * 1000);
    await db.insert(positions).values({ playerId: 1, ts: old, x: 0, z: 0, biome: 'Meadows' });
    await db.insert(statusSamples).values({
      ts: new Date(Date.now() - 100 * 24 * 3600 * 1000),
      online: true,
      playerCount: 1,
      source: 'a2s'
    });
    const result = await runPrune(db);
    expect(result.positions).toBeGreaterThanOrEqual(1);
    expect(result.statusSamples).toBe(1);
    const remaining = await db.select({ count: sql<number>`count(*)::int` }).from(positions);
    expect(remaining[0]?.count).toBeGreaterThan(0);
  });

  it('records the A2S state and a status sample', async () => {
    const db = getDb();
    const result = await pollA2s(db, '127.0.0.1', 1, new Date());
    expect(result.ok).toBe(false);
    const samples = await db.select({ count: sql<number>`count(*)::int` }).from(statusSamples);
    expect(samples[0]?.count).toBeGreaterThan(0);
  });

  it('produces a restorable dump', async () => {
    const db = getDb();
    const options = backupOptions();
    const backup = await runBackup(db, options);
    expect(backup.ok).toBe(true);
    const file = join(options.directory, backup.file);
    expect(existsSync(file)).toBe(true);
    expect(statSync(file).size).toBeGreaterThan(1000);
    expect(readdirSync(options.directory).filter((name) => name.endsWith('.dump'))).toHaveLength(1);
    const restoreName = `valheim_restore_${randomBytes(4).toString('hex')}`;
    const admin = postgres(withDatabaseName(databaseUrl, 'postgres'), {
      max: 1,
      onnotice: () => {}
    });
    await admin.unsafe(`create database "${restoreName}"`);
    try {
      const [command, ...args] = pgRestoreCommand();
      const restoreUrl = withDatabaseName(databaseUrl, restoreName);
      execFileSync(command!, [...args, '--no-owner', `--dbname=${restoreUrl}`], {
        input: readFileSync(file),
        stdio: ['pipe', 'ignore', 'pipe'],
        shell: process.platform === 'win32'
      });
      const restored = postgres(restoreUrl, { max: 1, onnotice: () => {} });
      const original = await db.select({ count: sql<number>`count(*)::int` }).from(events);
      const copy = await restored<{ count: number }[]>`select count(*)::int as count from events`;
      expect(copy[0]?.count).toBe(original[0]?.count);
      await restored.end({ timeout: 5 });
    } finally {
      await admin.unsafe(`drop database "${restoreName}" with (force)`);
      await admin.end({ timeout: 5 });
    }
  });
});
