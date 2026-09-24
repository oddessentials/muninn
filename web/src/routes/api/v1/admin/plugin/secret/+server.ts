import { secrets } from '$lib/server/auth/secrets';
import { privateJson } from '$lib/server/http/respond';
import { adminMutation } from '$lib/server/http/routes';
import { exportConfiguredPlugin } from '$lib/server/plugin';

export const POST = adminMutation(async (_event, db) => {
  const telemetrySecret = await secrets.regenerateTelemetrySecret();
  await exportConfiguredPlugin(db);
  return privateJson({ telemetry_secret: telemetrySecret });
});
