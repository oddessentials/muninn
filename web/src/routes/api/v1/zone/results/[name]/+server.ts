import type { RequestHandler } from '@sveltejs/kit';
import { getDb } from '#lib/server/db/client.ts';
import { empty, guarded, privateJson } from '#lib/server/http/respond.ts';
import { adminMutation, readJsonBody } from '#lib/server/http/routes.ts';
import { deleteZoneResult, upsertZoneResult } from '#lib/server/read/zone.ts';
import { parseZoneName } from '#lib/server/zone/results.ts';

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
