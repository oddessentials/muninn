import type { RequestEvent } from '@sveltejs/kit';
import type { ZoneResult, ZoneResultList } from '$lib/api/types';
import { empty, guarded, notFound, privateJson, publicJson, unauthorized } from '../http/respond';
import { readJsonBody } from '../http/routes';
import { parseZoneName, parseZoneResult, rankZoneResults } from '../zone/results';
import { cloneFixture } from './fixtures';
import { hasAdminSession } from './session';

let roster: Map<string, ZoneResult> | null = null;

function getRoster(): Map<string, ZoneResult> {
  if (!roster) {
    roster = new Map();
    const seed = cloneFixture<ZoneResultList>('zone/results');
    for (const item of seed?.items ?? []) roster.set(item.name, item.result);
  }
  return roster;
}

export function resetMockZone(): void {
  roster = null;
}

export function answerMockZone(event: RequestEvent): Promise<Response> | null {
  const { pathname } = event.url;
  const method = event.request.method;
  const entry = /^\/api\/v1\/zone\/results\/([^/]+)$/.exec(pathname);

  if (pathname === '/api/v1/zone/results' && (method === 'GET' || method === 'HEAD')) {
    return guarded(() =>
      publicJson({ items: rankZoneResults([...getRoster().values()]) }, event.request)
    );
  }
  if (entry && method === 'PUT') {
    return guarded(async () => {
      const name = parseZoneName(decodeURIComponent(entry[1] as string));
      const result = parseZoneResult(await readJsonBody(event), name, new Date());
      getRoster().set(name, result);
      const ranked = rankZoneResults([...getRoster().values()]);
      return privateJson(ranked.find((item) => item.name === name));
    });
  }
  if (entry && method === 'DELETE') {
    return guarded(async () => {
      if (!hasAdminSession(event.request)) throw unauthorized('an admin session is required');
      const name = parseZoneName(decodeURIComponent(entry[1] as string));
      if (!getRoster().delete(name)) throw notFound(`no result for ${name}`);
      return empty();
    });
  }
  return null;
}
