import { sequence, type Handle, type ServerInit } from '@sveltejs/kit/hooks';
import { getDb } from '#lib/server/db/client.ts';
import { loadEnv } from '#lib/server/env.ts';
import { apiNotFound, apiRateLimit } from '#lib/server/hooks/api.ts';
import { mock } from '#lib/server/hooks/mock.ts';
import { jobs } from '#lib/server/jobs/registry.ts';
import { startScheduler, type Scheduler } from '#lib/server/jobs/scheduler.ts';
import { exportConfiguredPlugin } from '#lib/server/plugin.ts';

let scheduler: Scheduler | null = null;

export function getScheduler(): Scheduler | null {
  return scheduler;
}

export const init: ServerInit = async () => {
  const env = loadEnv();
  scheduler = startScheduler(jobs);
  if (env.pluginExportDir && !env.apiMock) await exportConfiguredPlugin(getDb());
  console.log(
    `web ${__APP_VERSION__} ready: mock=${env.apiMock} log=${env.logLevel} jobs=${jobs.length}`
  );
};

export const handle: Handle = sequence(mock, apiRateLimit, apiNotFound);
