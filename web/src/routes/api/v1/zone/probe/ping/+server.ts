import type { RequestHandler } from '@sveltejs/kit';
import { probeJson } from '$lib/server/zone/probe';

export const GET: RequestHandler = () => probeJson({ t: Date.now() });
