import { secrets } from '#lib/server/auth/secrets.ts';
import { privateJson } from '#lib/server/http/respond.ts';
import { adminMutation } from '#lib/server/http/routes.ts';
import { exportConfiguredPlugin } from '#lib/server/plugin.ts';

export const POST = adminMutation(async (_event, db) => {
  const telemetrySecret = await secrets.regenerateTelemetrySecret();
  await exportConfiguredPlugin(db);
  return privateJson({ telemetry_secret: telemetrySecret });
});
