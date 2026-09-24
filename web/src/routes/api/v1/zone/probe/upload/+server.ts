import type { RequestHandler } from '@sveltejs/kit';
import { guarded } from '$lib/server/http/respond';
import { countUploadBytes, probeJson } from '$lib/server/zone/probe';

export const POST: RequestHandler = (event) =>
  guarded(async () => probeJson({ received: await countUploadBytes(event.request) }));
