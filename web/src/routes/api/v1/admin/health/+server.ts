import { adminGet } from '#lib/server/http/routes.ts';
import { adminHealth } from '#lib/server/read/admin.ts';
import { getScheduler } from '../../../../../hooks.server';

export const GET = adminGet(async (_event, db) =>
  adminHealth(
    db,
    (getScheduler()?.status() ?? []).map((job) => ({
      name: job.name,
      lastRunAt: job.lastRunAt,
      lastOk: job.lastOk,
      lastError: job.lastError
    }))
  )
);
