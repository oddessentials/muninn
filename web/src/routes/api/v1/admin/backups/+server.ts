import { adminGet } from '#lib/server/http/routes.ts';
import { listBackups } from '#lib/server/jobs/backup.ts';

export const GET = adminGet(async (_event, db) => ({ items: await listBackups(db) }));
