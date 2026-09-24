import type { RequestHandler } from '@sveltejs/kit';
import { guarded, noStore } from '$lib/server/http/respond';
import { parseProbeBytes, patternBytes } from '$lib/server/zone/probe';

export const GET: RequestHandler = (event) =>
  guarded(() => {
    const size = parseProbeBytes(event.url);
    return new Response(patternBytes(size), {
      headers: {
        'content-type': 'application/octet-stream',
        'content-length': String(size),
        ...noStore
      }
    });
  });
