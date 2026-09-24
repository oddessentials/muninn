import type { RequestHandler } from '@sveltejs/kit';
import { probeHealth, probeJson } from '$lib/server/zone/probe';

export const GET: RequestHandler = () => probeJson(probeHealth);
