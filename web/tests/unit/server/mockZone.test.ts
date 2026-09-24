import type { RequestEvent } from '@sveltejs/kit';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ZoneRankedResult, ZoneResultList } from '$lib/api/types';
import { answerMockZone, resetMockZone } from '$lib/server/mock/zone';
import { makeResult } from '../zone/fixtures';

function event(method: string, path: string, body?: unknown, admin = false): RequestEvent {
  const request = new Request(`http://mock${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(admin ? { cookie: 'admin_session=mock' } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  return { request, url: new URL(request.url) } as unknown as RequestEvent;
}

async function list(): Promise<ZoneResultList> {
  const response = await answerMockZone(event('GET', '/api/v1/zone/results'));
  expect(response?.status).toBe(200);
  return (await response!.json()) as ZoneResultList;
}

describe('mock zone results', () => {
  beforeEach(() => resetMockZone());

  it('serves the fixture ranking with public cache headers', async () => {
    const response = await answerMockZone(event('GET', '/api/v1/zone/results'));
    expect(response?.headers.get('cache-control')).toBe('public, max-age=15');
    expect(response?.headers.get('etag')).toBeTruthy();
    const ranking = (await response!.json()) as ZoneResultList;
    expect(ranking.items.map((item) => item.rank)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(ranking.items[0]?.name).toBe('BJORN');
  });

  it('stores a measurement under its normalised name and re-ranks', async () => {
    const before = (await list()).items.length;
    const submitted = makeResult({ name: '  new   Comer ' });
    const response = await answerMockZone(
      event('PUT', '/api/v1/zone/results/NEW%20COMER', submitted)
    );
    expect(response?.status).toBe(200);
    expect(response?.headers.get('cache-control')).toBe('no-store');
    const stored = (await response!.json()) as ZoneRankedResult;
    expect(stored.name).toBe('NEW COMER');
    expect(stored.result.player.name).toBe('NEW COMER');
    expect(stored.rank).toBeGreaterThanOrEqual(1);
    expect(Date.parse(stored.tested_at)).toBeGreaterThan(Date.now() - 60_000);
    const after = await list();
    expect(after.items).toHaveLength(before + 1);
    expect(after.items.find((item) => item.name === 'NEW COMER')?.rank).toBe(stored.rank);

    const again = await answerMockZone(
      event('PUT', '/api/v1/zone/results/new%20comer', makeResult({ name: 'New Comer' }))
    );
    expect(again?.status).toBe(200);
    expect((await list()).items).toHaveLength(before + 1);
  });

  it('rejects a body that names someone else, a bad shape and an incomplete run', async () => {
    const other = await answerMockZone(
      event('PUT', '/api/v1/zone/results/PETE', makeResult({ name: 'Dave' }))
    );
    expect(other?.status).toBe(400);
    const shape = await answerMockZone(event('PUT', '/api/v1/zone/results/PETE', { nope: 1 }));
    expect(shape?.status).toBe(400);
    const incomplete = await answerMockZone(
      event(
        'PUT',
        '/api/v1/zone/results/PETE',
        makeResult({ name: 'Pete', completion: { interrupted: true } })
      )
    );
    expect(incomplete?.status).toBe(422);
    expect(await incomplete!.json()).toMatchObject({ error: { code: 'unprocessable' } });
    const empty = await answerMockZone(
      event('PUT', '/api/v1/zone/results/%20%20', makeResult({ name: 'Pete' }))
    );
    expect(empty?.status).toBe(400);
  });

  it('refuses to remove an entry without an admin session', async () => {
    const refused = await answerMockZone(event('DELETE', '/api/v1/zone/results/torvald'));
    expect(refused?.status).toBe(401);
    expect(await refused!.json()).toMatchObject({ error: { code: 'unauthorized' } });
    expect((await list()).items.some((item) => item.name === 'TORVALD')).toBe(true);
  });

  it('removes an entry once for an admin and answers 404 afterwards', async () => {
    const removed = await answerMockZone(
      event('DELETE', '/api/v1/zone/results/torvald', undefined, true)
    );
    expect(removed?.status).toBe(204);
    expect((await list()).items.some((item) => item.name === 'TORVALD')).toBe(false);
    const missing = await answerMockZone(
      event('DELETE', '/api/v1/zone/results/TORVALD', undefined, true)
    );
    expect(missing?.status).toBe(404);
  });

  it('leaves the probe routes and unknown methods to the real handlers', async () => {
    expect(answerMockZone(event('GET', '/api/v1/zone/probe/ping'))).toBeNull();
    expect(answerMockZone(event('POST', '/api/v1/zone/results'))).toBeNull();
  });
});
