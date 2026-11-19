import type { RequestHandler } from '@sveltejs/kit';
import { readSession } from '#lib/server/auth/admin.ts';
import { secrets } from '#lib/server/auth/secrets.ts';
import { guarded, privateJson } from '#lib/server/http/respond.ts';

export const GET: RequestHandler = (event) =>
  guarded(async () => {
    const session = await readSession(event);
    return privateJson({
      authenticated: session.authenticated,
      expires_at: session.expiresAt ? session.expiresAt.toISOString() : null,
      setup_required: (await secrets.passwordSource()) === 'unset'
    });
  });
