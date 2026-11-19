import type { RequestHandler } from '@sveltejs/kit';
import { guarded } from '#lib/server/http/respond.ts';
import { countUploadBytes, probeJson } from '#lib/server/zone/probe.ts';

export const POST: RequestHandler = (event) =>
  guarded(async () => probeJson({ received: await countUploadBytes(event.request) }));
