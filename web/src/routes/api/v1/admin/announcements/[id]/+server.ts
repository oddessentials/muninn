import { empty, parsePathId } from '#lib/server/http/respond.ts';
import { adminMutation } from '#lib/server/http/routes.ts';
import { cancelAnnouncement } from '#lib/server/read/announcements.ts';

export const DELETE = adminMutation(async (event, db) => {
  await cancelAnnouncement(db, parsePathId(event.params.id, 'id'));
  return empty();
});
