import { and, asc, desc, eq, gt, inArray, isNull, or } from 'drizzle-orm';
import type { Announcement, AnnouncementStatus, PluginAnnouncement } from '$lib/api/types';
import type { Database } from '../db/client';
import { announcements, type AnnouncementKind, type AnnouncementRow } from '../db/schema';
import { badRequest, conflict, iso, notFound } from '../http/respond';

export const messageLifetimeMs = 10 * 60 * 1000;
export const restartGraceMs = 2 * 60 * 1000;
export const minRestartLeadMs = 60 * 1000;
export const maxRestartLeadMs = 24 * 60 * 60 * 1000;
export const maxTextLength = 200;
export const listLimit = 50;

export interface AnnouncementInput {
  kind: AnnouncementKind;
  text: string | null;
  restartAt: Date | null;
}

function expiredAt(row: AnnouncementRow, now: Date): boolean {
  if (row.kind === 'restart') {
    return row.restartAt !== null && row.restartAt.getTime() + restartGraceMs < now.getTime();
  }
  return row.createdAt.getTime() + messageLifetimeMs < now.getTime();
}

export function announcementStatus(row: AnnouncementRow, now: Date): AnnouncementStatus {
  if (row.cancelledAt) return 'cancelled';
  if (row.completedAt) return 'shown';
  if (expiredAt(row, now)) return 'expired';
  return row.deliveredAt ? 'delivered' : 'pending';
}

export function toAnnouncement(row: AnnouncementRow, now: Date): Announcement {
  return {
    id: row.id,
    kind: row.kind,
    text: row.text,
    restart_at: iso(row.restartAt),
    created_at: row.createdAt.toISOString(),
    delivered_at: iso(row.deliveredAt),
    shown_at: iso(row.shownAt),
    completed_at: iso(row.completedAt),
    cancelled_at: iso(row.cancelledAt),
    status: announcementStatus(row, now)
  };
}

export function parseAnnouncement(body: unknown, now: Date): AnnouncementInput {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw badRequest('body must be a JSON object');
  }
  const record = body as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (key !== 'kind' && key !== 'text' && key !== 'restart_at')
      throw badRequest(`unknown field ${key}`);
  }
  const kind = record.kind;
  if (kind !== 'message' && kind !== 'restart') throw badRequest('kind must be message or restart');
  const rawText = record.text;
  if (rawText !== undefined && rawText !== null && typeof rawText !== 'string')
    throw badRequest('text must be a string or null');
  const text = typeof rawText === 'string' ? rawText.trim() : '';
  if (text.length > maxTextLength)
    throw badRequest(`text must be at most ${maxTextLength} characters`);
  if (kind === 'message') {
    if (text === '') throw badRequest('text is required for a message');
    if (record.restart_at !== undefined && record.restart_at !== null)
      throw badRequest('restart_at only applies to a restart');
    return { kind, text, restartAt: null };
  }
  const rawRestart = record.restart_at;
  if (typeof rawRestart !== 'string' || rawRestart === '')
    throw badRequest('restart_at is required for a restart');
  const restartAt = new Date(rawRestart);
  if (Number.isNaN(restartAt.getTime()))
    throw badRequest('restart_at must be an ISO 8601 timestamp');
  const lead = restartAt.getTime() - now.getTime();
  if (lead < minRestartLeadMs) throw badRequest('restart_at must be at least 60 seconds ahead');
  if (lead > maxRestartLeadMs) throw badRequest('restart_at must be within 24 hours');
  return { kind, text: text === '' ? null : text, restartAt };
}

export async function createAnnouncement(
  db: Database,
  input: AnnouncementInput,
  now = new Date()
): Promise<Announcement> {
  const inserted = await db
    .insert(announcements)
    .values({ kind: input.kind, text: input.text, restartAt: input.restartAt, createdAt: now })
    .returning();
  const row = inserted[0];
  if (!row) throw new Error('the announcement could not be stored');
  return toAnnouncement(row, now);
}

export async function listAnnouncements(db: Database, now = new Date()): Promise<Announcement[]> {
  const rows = await db
    .select()
    .from(announcements)
    .orderBy(desc(announcements.createdAt), desc(announcements.id))
    .limit(listLimit);
  return rows.map((row) => toAnnouncement(row, now));
}

export async function cancelAnnouncement(
  db: Database,
  id: number,
  now = new Date()
): Promise<void> {
  const rows = await db.select().from(announcements).where(eq(announcements.id, id)).limit(1);
  const row = rows[0];
  if (!row) throw notFound(`announcement ${id} does not exist`);
  const status = announcementStatus(row, now);
  if (status !== 'pending' && status !== 'delivered')
    throw conflict(`announcement ${id} is already ${status}`);
  await db.update(announcements).set({ cancelledAt: now }).where(eq(announcements.id, id));
}

export async function activeAnnouncements(
  db: Database,
  now = new Date()
): Promise<AnnouncementRow[]> {
  return db
    .select()
    .from(announcements)
    .where(
      and(
        isNull(announcements.cancelledAt),
        isNull(announcements.completedAt),
        or(
          and(
            eq(announcements.kind, 'message'),
            gt(announcements.createdAt, new Date(now.getTime() - messageLifetimeMs))
          ),
          and(
            eq(announcements.kind, 'restart'),
            gt(announcements.restartAt, new Date(now.getTime() - restartGraceMs))
          )
        )
      )
    )
    .orderBy(asc(announcements.createdAt), asc(announcements.id));
}

export function toPluginAnnouncement(row: AnnouncementRow, now: Date): PluginAnnouncement {
  return {
    id: row.id,
    kind: row.kind,
    text: row.text,
    restart_at: iso(row.restartAt),
    restart_in_s: row.restartAt
      ? Math.round((row.restartAt.getTime() - now.getTime()) / 1000)
      : null
  };
}

export async function collectForPlugin(
  db: Database,
  now = new Date()
): Promise<PluginAnnouncement[]> {
  const rows = await activeAnnouncements(db, now);
  const undelivered = rows.filter((row) => row.deliveredAt === null).map((row) => row.id);
  if (undelivered.length > 0) {
    await db
      .update(announcements)
      .set({ deliveredAt: now })
      .where(and(inArray(announcements.id, undelivered), isNull(announcements.deliveredAt)));
  }
  return rows.map((row) => toPluginAnnouncement(row, now));
}
