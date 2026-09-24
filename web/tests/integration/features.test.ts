import type { RequestEvent, RequestHandler } from '@sveltejs/kit';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { SiteFeatures } from '../../src/lib/api/types';
import { getDb } from '../../src/lib/server/db/client';
import { applyBatchInTransaction } from '../../src/lib/server/ingest/ingest';
import { queryActivity, type ActivityQueryOptions } from '../../src/lib/server/read/activity';
import { adminItem, listPlayers, playerDetail, playerRow } from '../../src/lib/server/read/players';
import { computeOnline } from '../../src/lib/server/read/status';
import { worldSummary } from '../../src/lib/server/read/world';
import { siteSettings } from '../../src/lib/server/settings';
import { GET as chatRoute } from '../../src/routes/api/v1/chat/+server';
import { GET as positionsRoute } from '../../src/routes/api/v1/players/[id]/positions/+server';
import { GET as mapRoute } from '../../src/routes/api/v1/world/map.png/+server';
import { resetDatabase, routeEvent, seededBatches, useTestDatabase } from './setup';

vi.setConfig({ testTimeout: 240_000, hookTimeout: 240_000 });

const allOn: SiteFeatures = { chat: true, positions: true, map: true, platform_ids: true };
const page = { limit: 200, offset: 0 };

beforeAll(async () => {
  useTestDatabase();
  await resetDatabase();
  const db = getDb();
  for (const batch of seededBatches(6)) {
    await db.transaction((tx) => applyBatchInTransaction(tx, batch, new Date()));
  }
});

async function switchTo(features: Partial<SiteFeatures>) {
  await siteSettings.write({ features: { ...allOn, ...features } });
}

function get(route: RequestHandler, path: string, params: Record<string, string> = {}) {
  return route(
    routeEvent(new Request(`http://test${path}`), params) as RequestEvent
  ) as Promise<Response>;
}

function activity(types: ActivityQueryOptions['types']) {
  return queryActivity(getDb(), {
    types,
    playerId: null,
    since: null,
    until: null,
    ...page
  });
}

function players(q: string | null = null) {
  return listPlayers(getDb(), {
    q,
    sort: 'last_seen',
    order: 'desc',
    online: null,
    includeHidden: false,
    ...page
  });
}

describe('site features', () => {
  it('serve chat, positions and platform ids while they are on', async () => {
    await switchTo({});
    expect((await get(chatRoute, '/api/v1/chat')).status).toBe(200);
    expect((await activity(['chat.message'])).rows.length).toBeGreaterThan(0);
    expect((await activity(['player.position'])).rows.length).toBeGreaterThan(0);
    const online = await computeOnline(getDb());
    expect(online.items.length).toBeGreaterThan(0);
    expect(online.items.every((item) => typeof item.x === 'number')).toBe(true);
    const listed = await players();
    expect(listed.items.every((item) => typeof item.platform_user_id === 'string')).toBe(true);
  });

  it('answer 404 for chat and drop chat from the feed when chat is off', async () => {
    await switchTo({ chat: false });
    const response = await get(chatRoute, '/api/v1/chat');
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { code: 'not_found', message: 'Chat is switched off on this site' }
    });
    expect((await activity(null)).rows.some((row) => row.type === 'chat.message')).toBe(false);
    expect((await activity(['chat.message'])).rows).toEqual([]);
  });

  it('hide where players are when positions are off', async () => {
    await switchTo({ positions: false });
    const online = await computeOnline(getDb());
    expect(online.items.length).toBeGreaterThan(0);
    expect(online.items.every((item) => item.x === null && item.z === null)).toBe(true);
    const onlineId = online.items[0]!.player_id;
    const detail = await playerDetail(getDb(), onlineId);
    expect(detail.current_session).toMatchObject({ x: null, z: null });
    const response = await get(positionsRoute, `/api/v1/players/${onlineId}/positions`, {
      id: String(onlineId)
    });
    expect(response.status).toBe(404);
    expect((await activity(['player.position'])).rows).toEqual([]);
  });

  it('answer 404 for the map image and drop it from the world when the map is off', async () => {
    await switchTo({ map: false });
    expect((await get(mapRoute, '/api/v1/world/map.png')).status).toBe(404);
    expect((await worldSummary(getDb())).map).toBeNull();
  });

  it('keep platform ids from the public and from its search when they are off', async () => {
    await switchTo({});
    const known = (await players()).items[0]!;
    const steamId = known.platform_user_id!;
    expect((await players(steamId)).items.map((item) => item.id)).toContain(known.id);
    await switchTo({ platform_ids: false });
    expect((await players()).items.every((item) => item.platform_user_id === null)).toBe(true);
    expect((await players(steamId)).items).toEqual([]);
    expect((await playerDetail(getDb(), known.id)).platform_user_id).toBeNull();
    const admin = await adminItem(getDb(), await playerRow(getDb(), known.id));
    expect(admin.platform_user_id).toBe(steamId);
  });
});
