import type { ActivityItem, EventType } from '$lib/api/types';
import { getDb } from '../db/client';
import { events, type EventRow } from '../db/schema';
import { bus } from '../events/bus';
import type { StoredEnvelope } from '../ingest/context';
import { buildActivityItems, feedIncludes } from '../read/activity';
import { computeOnline, computeStatus } from '../read/status';
import { inArray } from 'drizzle-orm';

let lastStatusJson: string | null = null;
let lastOnlineJson: string | null = null;

export async function publishSnapshots(force = false): Promise<void> {
  const db = getDb();
  const [status, online] = await Promise.all([computeStatus(db), computeOnline(db)]);
  const statusJson = JSON.stringify({ ...status, updated_at: null });
  const onlineJson = JSON.stringify(online);
  if (force || statusJson !== lastStatusJson) {
    lastStatusJson = statusJson;
    bus.publish({ channel: 'status', data: status });
  }
  if (force || onlineJson !== lastOnlineJson) {
    lastOnlineJson = onlineJson;
    bus.publish({ channel: 'online', data: online });
  }
}

export async function publishEvents(envelopes: StoredEnvelope[]): Promise<ActivityItem[]> {
  const included = envelopes.filter((event) => feedIncludes(event.type as EventType, null));
  if (included.length === 0) return [];
  const db = getDb();
  const rows: EventRow[] = await db
    .select()
    .from(events)
    .where(
      inArray(
        events.id,
        included.map((event) => event.id)
      )
    );
  const order = new Map(included.map((event, index) => [event.id, index]));
  rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  const items = await buildActivityItems(db, rows);
  for (const item of items) bus.publish({ channel: 'activity', id: item.id, data: item });
  return items;
}

export async function publishAfterIngest(
  envelopes: StoredEnvelope[],
  effects: { statusChanged: boolean; onlineChanged: boolean }
): Promise<void> {
  try {
    await publishEvents(envelopes);
    if (effects.statusChanged || effects.onlineChanged) await publishSnapshots();
  } catch (error) {
    console.error('stream publish failed', error);
  }
}
