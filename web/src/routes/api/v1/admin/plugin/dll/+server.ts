import { readFile } from 'node:fs/promises';
import type { RequestHandler } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/auth/admin';
import { errorResponse, guarded, noStore } from '$lib/server/http/respond';
import { pluginDllPath, pluginFileName } from '$lib/server/plugin';

export const GET: RequestHandler = (event) =>
  guarded(async () => {
    await requireAdmin(event);
    const path = pluginDllPath();
    if (!path) return errorResponse(404, 'not_found', 'this build has no plugin DLL');
    const dll = await readFile(path);
    return new Response(new Uint8Array(dll), {
      headers: {
        ...noStore,
        'content-type': 'application/octet-stream',
        'content-disposition': `attachment; filename="${pluginFileName}"`,
        'content-length': String(dll.length)
      }
    });
  });
