import { pollA2s, queryDisabled } from './a2s';
import { nightlyBackupDue, runBackup } from './backup';
import { creditStructures } from './credits';
import { heralds } from './heralds';
import { runPrune } from './prune';
import { isRunning } from './runner';
import { runWatchdog } from './watchdog';
import { env } from '../env';
import { publishAfterIngest, publishSnapshots } from '../stream/publish';
import type { JobDefinition } from './scheduler';

export const jobNames = {
  a2sPoller: 'a2s_poller',
  heartbeatWatchdog: 'heartbeat_watchdog',
  retentionPrune: 'retention_prune',
  nightlyBackup: 'nightly_backup',
  streamBroadcaster: 'stream_broadcaster',
  heralds: 'heralds',
  structureCredits: 'structure_credits'
} as const;

const unlessMock = (run: () => Promise<void>) => async (): Promise<void> => {
  if (env.apiMock) return;
  await run();
};

export const jobs: JobDefinition[] = [
  {
    name: jobNames.a2sPoller,
    intervalMs: 60_000,
    runOnStart: true,
    run: unlessMock(async () => {
      const result = await pollA2s();
      if (!result.ok && result.error !== queryDisabled) {
        throw new Error(result.error ?? 'A2S query failed');
      }
    })
  },
  {
    name: jobNames.heartbeatWatchdog,
    intervalMs: 30_000,
    runOnStart: true,
    run: unlessMock(async () => {
      const result = await runWatchdog();
      if (result.syntheticEvents.length > 0) {
        await publishAfterIngest(result.syntheticEvents, {
          statusChanged: true,
          onlineChanged: true
        });
      }
    })
  },
  {
    name: jobNames.retentionPrune,
    intervalMs: 60 * 60_000,
    runOnStart: true,
    run: unlessMock(async () => {
      await runPrune();
    })
  },
  {
    name: jobNames.nightlyBackup,
    intervalMs: 10 * 60_000,
    runOnStart: false,
    run: unlessMock(async () => {
      if (isRunning('backup') || !(await nightlyBackupDue())) return;
      await runBackup();
    })
  },
  {
    name: jobNames.streamBroadcaster,
    intervalMs: 5_000,
    runOnStart: true,
    run: unlessMock(async () => {
      await publishSnapshots();
    })
  },
  {
    name: jobNames.structureCredits,
    intervalMs: 60_000,
    runOnStart: true,
    run: unlessMock(async () => {
      await creditStructures();
    })
  },
  {
    name: jobNames.heralds,
    intervalMs: 5_000,
    runOnStart: true,
    run: unlessMock(async () => {
      const result = await heralds().tick();
      if (result.syntheticEvents.length > 0) {
        await publishAfterIngest(result.syntheticEvents, {
          statusChanged: false,
          onlineChanged: false
        });
      }
    })
  }
];
