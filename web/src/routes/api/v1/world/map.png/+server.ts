import type { RequestHandler } from '@sveltejs/kit';
import { getDb } from '#lib/server/db/client.ts';
import { errorResponse, etagOf, guarded } from '#lib/server/http/respond.ts';
import { requireFeature } from '#lib/server/http/routes.ts';
import { currentWorldUid, mapImage } from '#lib/server/read/world.ts';

export const GET: RequestHandler = ({ request }) =>
  guarded(async () => {
    const db = getDb();
    await requireFeature('map', db);
    const image = await mapImage(db, await currentWorldUid(db));
    if (!image) return errorResponse(404, 'not_found', 'no map image has been uploaded');
    const etag = etagOf(`${image.worldUid}:${image.generatedAt.toISOString()}`);
    if (request.headers.get('if-none-match') === etag) {
      return new Response(null, {
        status: 304,
        headers: { etag, 'cache-control': 'public, max-age=15' }
      });
    }
    return new Response(new Uint8Array(image.png), {
      headers: {
        'content-type': 'image/png',
        'cache-control': 'public, max-age=15',
        etag,
        'content-length': String(image.png.length)
      }
    });
  });
