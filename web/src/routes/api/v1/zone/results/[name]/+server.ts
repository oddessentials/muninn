import type { RequestHandler } from '@sveltejs/kit';
import { getDb } from '$lib/server/db/client';
import { empty, guarded, privateJson } from '$lib/server/http/respond';
import { adminMutation, readJsonBody } from '$lib/server/http/routes';
import { deleteZoneResult, upsertZoneResult } from '$lib/server/read/zone';
import { parseZoneName } from '$lib/server/zone/results';

export const PUT: RequestHandler = (event) =>
  guarded(async () => {
    const name = parseZoneName(event.params.name);
    const body = await readJsonBody(event);
    return privateJson(await upsertZoneResult(getDb(), name, body));
  });

export const DELETE = adminMutation(async (event, db) => {
  await deleteZoneResult(db, parseZoneName(event.params.name));
  return empty();
});
