import { describe, expect, it } from 'vitest';
import { ApiError, createApi } from '$lib/api/client';
import { endpoints, resolvePath } from '$lib/api/endpoints';

function fakeFetch(handler: (url: string, init?: RequestInit) => Response): typeof fetch {
  return async (input, init) => {
    if (input instanceof Request) {
      const body = input.method === 'GET' || input.method === 'HEAD' ? null : await input.text();
      return handler(input.url, { method: input.method, body });
    }
    return handler(String(input), init);
  };
}

describe('api client', () => {
  it('returns the parsed body of a successful call', async () => {
    const api = createApi({
      baseUrl: 'http://test',
      fetch: fakeFetch((url) => {
        expect(url).toBe('http://test/api/v1/health');
        return Response.json({ ok: true, db: false, version: '0.1.0', mock: true });
      })
    });
    await expect(api.getHealth()).resolves.toEqual({
      ok: true,
      db: false,
      version: '0.1.0',
      mock: true
    });
  });

  it('serializes path and query parameters', async () => {
    const api = createApi({
      baseUrl: 'http://test',
      fetch: fakeFetch((url) => {
        expect(url).toBe('http://test/api/v1/players/7/sessions?limit=5&cursor=abc');
        return Response.json({ items: [], next_cursor: null });
      })
    });
    await expect(api.listPlayerSessions(7, { limit: 5, cursor: 'abc' })).resolves.toEqual({
      items: [],
      next_cursor: null
    });
  });

  it('converts the JSON error shape into an ApiError', async () => {
    const api = createApi({
      baseUrl: 'http://test',
      fetch: fakeFetch(() =>
        Response.json(
          { error: { code: 'not_found', message: 'player 99 does not exist' } },
          { status: 404 }
        )
      )
    });
    const failure = await api.getPlayer(99).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ApiError);
    const apiError = failure as ApiError;
    expect(apiError.status).toBe(404);
    expect(apiError.code).toBe('not_found');
    expect(apiError.message).toBe('player 99 does not exist');
  });

  it('derives a code from the status when the body is not the error shape', async () => {
    const api = createApi({
      baseUrl: 'http://test',
      fetch: fakeFetch(() => new Response('bad gateway', { status: 502 }))
    });
    const failure = await api.getStatus().catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).code).toBe('unavailable');
    expect((failure as ApiError).status).toBe(502);
  });

  it('treats 204 answers as success without a body', async () => {
    const api = createApi({
      baseUrl: 'http://test',
      fetch: fakeFetch(() => new Response(null, { status: 204 }))
    });
    await expect(api.adminLogin('secret')).resolves.toBeUndefined();
  });

  it('sends zone results by name and reads the ranked list back', async () => {
    const api = createApi({
      baseUrl: 'http://test',
      fetch: fakeFetch((url, init) => {
        if (init?.method === 'PUT') {
          expect(url).toBe('http://test/api/v1/zone/results/OLAF%20THE%20RED');
          expect(JSON.parse(String(init.body))).toMatchObject({ player: { name: 'OLAF THE RED' } });
          return Response.json({ rank: 1, name: 'OLAF THE RED' });
        }
        if (init?.method === 'DELETE') {
          expect(url).toBe('http://test/api/v1/zone/results/OLAF%20THE%20RED');
          return new Response(null, { status: 204 });
        }
        expect(url).toBe('http://test/api/v1/zone/results');
        return Response.json({ items: [] });
      })
    });
    const result = { player: { name: 'OLAF THE RED' } } as Parameters<typeof api.putZoneResult>[1];
    await expect(api.putZoneResult('OLAF THE RED', result)).resolves.toMatchObject({ rank: 1 });
    await expect(api.listZoneResults()).resolves.toEqual({ items: [] });
    await expect(api.deleteZoneResult('OLAF THE RED')).resolves.toBeUndefined();
    expect(api.zoneProbeUrl).toBe('/api/v1/zone/probe');
  });

  it('resolves endpoint templates', () => {
    expect(resolvePath(endpoints.playerDeaths, { id: 3 })).toBe('/api/v1/players/3/deaths');
    expect(resolvePath(endpoints.zoneResult, { name: 'OLAF THE RED' })).toBe(
      '/api/v1/zone/results/OLAF%20THE%20RED'
    );
    expect(resolvePath(endpoints.adminPlayerAlias, { id: 3, alias: 'Steam_1' })).toBe(
      '/api/v1/admin/players/3/aliases/Steam_1'
    );
    expect(() => resolvePath(endpoints.boss)).toThrow('missing path parameter key');
  });
});
