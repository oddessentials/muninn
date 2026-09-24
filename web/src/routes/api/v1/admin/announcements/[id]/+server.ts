import { empty, parsePathId } from '$lib/server/http/respond';
import { adminMutation } from '$lib/server/http/routes';
import { cancelAnnouncement } from '$lib/server/read/announcements';

export const DELETE = adminMutation(async (event, db) => {
  await cancelAnnouncement(db, parsePathId(event.params.id, 'id'));
  return empty();
});
