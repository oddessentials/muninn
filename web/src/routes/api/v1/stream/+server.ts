import type { RequestHandler } from '@sveltejs/kit';
import { guarded } from '#lib/server/http/respond.ts';
import { openStream } from '#lib/server/stream/sse.ts';

export const GET: RequestHandler = ({ request }) => guarded(() => openStream(request));
