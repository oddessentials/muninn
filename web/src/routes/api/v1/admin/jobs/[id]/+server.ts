import { parsePathId } from '#lib/server/http/respond.ts';
import { adminGet } from '#lib/server/http/routes.ts';
import { getJob } from '#lib/server/jobs/runner.ts';

export const GET = adminGet(async ({ params }) => getJob(parsePathId(params.id, 'id')));
