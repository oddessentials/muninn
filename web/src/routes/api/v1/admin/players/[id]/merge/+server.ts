import { badRequest, parsePathId, privateJson } from '#lib/server/http/respond.ts';
import { adminMutation, readJsonBody } from '#lib/server/http/routes.ts';
import { mergePlayers } from '#lib/server/read/admin.ts';

export const POST = adminMutation(async (event, db) => {
  const body = (await readJsonBody(event)) as { into?: unknown } | undefined;
  if (!body || typeof body !== 'object' || !Number.isInteger(body.into))
    throw badRequest('into must be a player id');
  return privateJson(
    await mergePlayers(db, parsePathId(event.params.id, 'id'), body.into as number)
  );
});
