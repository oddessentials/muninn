import { privateJson } from '#lib/server/http/respond.ts';
import { adminGet, adminMutation, readJsonBody } from '#lib/server/http/routes.ts';
import {
  createAnnouncement,
  listAnnouncements,
  parseAnnouncement
} from '#lib/server/read/announcements.ts';

export const GET = adminGet(async (_event, db) => ({ items: await listAnnouncements(db) }));

export const POST = adminMutation(async (event, db) => {
  const now = new Date();
  const input = parseAnnouncement(await readJsonBody(event), now);
  return privateJson(await createAnnouncement(db, input, now), 201);
});
