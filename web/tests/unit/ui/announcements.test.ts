import { describe, expect, it } from 'vitest';
import type { Announcement } from '$lib/api/types';
import {
  announcementSummary,
  buildAnnouncement,
  canCancel,
  emptyForm,
  isLive,
  localDateTimeValue,
  restartAtFromLocalTime,
  restartAtFromMinutes,
  restartLead,
  statusLabel,
  statusTone
} from '$lib/ui/announcements';
import { describeActivity } from '$lib/ui/activity';
import { activityTypeLabel } from '$lib/ui/labels';

const now = Date.UTC(2026, 8, 12, 20, 0, 0);

function announcement(overrides: Partial<Announcement>): Announcement {
  return {
    id: 1,
    kind: 'message',
    text: 'Hello',
    restart_at: null,
    created_at: '2026-09-12T19:59:00Z',
    delivered_at: null,
    shown_at: null,
    completed_at: null,
    cancelled_at: null,
    status: 'pending',
    ...overrides
  };
}

describe('announcement form', () => {
  it('builds a trimmed message and refuses an empty or oversized one', () => {
    expect(buildAnnouncement({ ...emptyForm(), text: '  Portal hub is back  ' }, now)).toEqual({
      ok: true,
      body: { kind: 'message', text: 'Portal hub is back' }
    });
    expect(buildAnnouncement({ ...emptyForm(), text: '   ' }, now)).toMatchObject({
      ok: false,
      error: 'Write the message first.'
    });
    expect(buildAnnouncement({ ...emptyForm(), text: 'x'.repeat(201) }, now)).toMatchObject({
      ok: false
    });
  });

  it('schedules a restart from a preset lead with an optional note', () => {
    const result = buildAnnouncement(
      { kind: 'restart', text: ' patch day ', lead: 'preset', minutes: 15, time: '' },
      now
    );
    expect(result).toEqual({
      ok: true,
      body: { kind: 'restart', restart_at: '2026-09-12T20:15:00.000Z', text: 'patch day' }
    });
    expect(restartAtFromMinutes(now, 5)).toBe('2026-09-12T20:05:00.000Z');
    const noNote = buildAnnouncement(
      { kind: 'restart', text: '', lead: 'preset', minutes: 5, time: '' },
      now
    );
    expect(noNote.ok && noNote.body.text).toBeNull();
  });

  it('reads a clock time as today or tomorrow and a datetime-local value as given', () => {
    const local = new Date(now);
    local.setHours(local.getHours() + 3, 30, 0, 0);
    const hhmm = `${String(local.getHours()).padStart(2, '0')}:30`;
    expect(restartAtFromLocalTime(hhmm, now)).toBe(local.toISOString());
    const earlier = new Date(now);
    earlier.setHours(earlier.getHours() - 1, 0, 0, 0);
    const past = `${String(earlier.getHours()).padStart(2, '0')}:00`;
    const tomorrow = new Date(earlier);
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(restartAtFromLocalTime(past, now)).toBe(tomorrow.toISOString());
    const value = localDateTimeValue(now + 90 * 60_000);
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(restartAtFromLocalTime(value, now)).toBe(new Date(now + 90 * 60_000).toISOString());
    expect(restartAtFromLocalTime('25:00', now)).toBeNull();
    expect(restartAtFromLocalTime('soon', now)).toBeNull();
    expect(restartAtFromLocalTime('', now)).toBeNull();
  });

  it('enforces the lead time window', () => {
    const tooSoon = buildAnnouncement(
      { kind: 'restart', text: '', lead: 'preset', minutes: 1, time: '' },
      now
    );
    expect(tooSoon).toMatchObject({
      ok: false,
      error: expect.stringContaining('at least 2 minutes')
    });
    const tooFar = buildAnnouncement(
      { kind: 'restart', text: '', lead: 'preset', minutes: 25 * 60, time: '' },
      now
    );
    expect(tooFar).toMatchObject({ ok: false, error: expect.stringContaining('24 hours') });
    const unreadable = buildAnnouncement(
      { kind: 'restart', text: '', lead: 'time', minutes: 15, time: 'later' },
      now
    );
    expect(unreadable).toMatchObject({ ok: false, error: expect.stringContaining('HH:MM') });
  });
});

describe('announcement list helpers', () => {
  it('labels statuses, tones and which rows can still be cancelled', () => {
    expect(statusLabel('pending')).toBe('waiting for the server');
    expect(statusLabel('delivered')).toBe('on the server');
    expect(statusLabel('shown')).toBe('shown');
    expect(statusLabel('cancelled')).toBe('cancelled');
    expect(statusLabel('expired')).toBe('expired');
    expect(statusTone('shown')).toBe('text-online');
    expect(statusTone('expired')).toBe('text-offline');
    expect(canCancel(announcement({ status: 'pending' }))).toBe(true);
    expect(canCancel(announcement({ status: 'delivered' }))).toBe(true);
    expect(canCancel(announcement({ status: 'shown' }))).toBe(false);
    expect(canCancel(announcement({ status: 'cancelled' }))).toBe(false);
    expect(isLive([announcement({ status: 'shown' }), announcement({ status: 'expired' })])).toBe(
      false
    );
    expect(isLive([announcement({ status: 'shown' }), announcement({ status: 'pending' })])).toBe(
      true
    );
  });

  it('summarises rows and the time left before a restart', () => {
    expect(announcementSummary(announcement({ kind: 'message', text: 'Hello' }))).toBe('Hello');
    expect(announcementSummary(announcement({ kind: 'restart', text: null }))).toBe(
      'Server restart'
    );
    expect(announcementSummary(announcement({ kind: 'restart', text: 'patch day' }))).toBe(
      'Server restart: patch day'
    );
    const restart = announcement({ kind: 'restart', restart_at: '2026-09-12T20:12:00Z' });
    expect(restartLead(restart, now)).toBe('in 12 min');
    expect(restartLead(restart, now + 11 * 60_000 + 30_000)).toBe('in under a minute');
    expect(restartLead(restart, now + 13 * 60_000)).toBe('time passed');
    expect(restartLead(announcement({ kind: 'message' }), now)).toBe('');
  });
});

describe('announcement.shown in the feed', () => {
  const base = {
    id: 'a',
    at: '2026-09-12T20:00:00Z',
    day: 40,
    type: 'announcement.shown' as const,
    player: null,
    links: { raid_id: null, boss_key: null, run_id: null, session_id: null }
  };
  const text = (summary: Record<string, unknown>) =>
    describeActivity({ ...base, summary })
      .parts.map((part) => ('text' in part ? part.text : ''))
      .join('');

  it('quotes the banner and notes the countdown position', () => {
    expect(text({ kind: 'message', text: 'Hello', remaining_s: null, final: true })).toBe(
      'Announced in game Hello'
    );
    expect(
      text({ kind: 'restart', text: 'Server restart in 10 min', remaining_s: 600, final: false })
    ).toBe('Announced in game Server restart in 10 min (restart in 10 min)');
    expect(
      text({ kind: 'restart', text: 'Server restarting now', remaining_s: 0, final: true })
    ).toBe('Announced in game Server restarting now (restart countdown finished)');
    expect(describeActivity({ ...base, summary: { kind: 'message', text: 'x' } }).tone).toBe(
      'info'
    );
    expect(activityTypeLabel('announcement.shown')).toBe('Announcement');
  });
});
