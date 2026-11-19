import { privateJson } from '#lib/server/http/respond.ts';
import { adminMutation } from '#lib/server/http/routes.ts';
import { startJob } from '#lib/server/jobs/runner.ts';

export const POST = adminMutation(async () => {
  const job = await startJob('backup');
  return privateJson({ job_id: job.jobId }, 202);
});
