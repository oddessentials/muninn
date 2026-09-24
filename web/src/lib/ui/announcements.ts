import type { Announcement, AnnouncementCreate, AnnouncementStatus } from '$lib/api/types';
import { formatDuration, parseInstant } from './format';

export const restartPresets: readonly number[] = [5, 10, 15, 30];
export const minLeadMinutes = 2;
export const maxLeadHours = 24;
export const maxTextLength = 200;
export const pickupSeconds = 60;

export interface AnnounceForm {
  kind: 'message' | 'restart';
  text: string;
  lead: 'preset' | 'time';
  minutes: number;
  time: string;
}

export function emptyForm(): AnnounceForm {
  return { kind: 'message', text: '', lead: 'preset', minutes: 15, time: '' };
}

const pad = (value: number) => String(value).padStart(2, '0');

export function localDateTimeValue(ms: number): string {
  const date = new Date(ms);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function restartAtFromMinutes(now: number, minutes: number): string {
  return new Date(now + minutes * 60_000).toISOString();
}

export function restartAtFromLocalTime(input: string, now: number): string | null {
  const value = input.trim();
  const clock = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (clock) {
    const hours = Number(clock[1]);
    const minutes = Number(clock[2]);
    if (hours > 23 || minutes > 59) return null;
    const candidate = new Date(now);
    candidate.setHours(hours, minutes, 0, 0);
    if (candidate.getTime() < now + 60_000) candidate.setDate(candidate.getDate() + 1);
    return candidate.toISOString();
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setSeconds(0, 0);
  return parsed.toISOString();
}

export type BuildResult = { ok: true; body: AnnouncementCreate } | { ok: false; error: string };

export function buildAnnouncement(form: AnnounceForm, now: number): BuildResult {
  const text = form.text.trim();
  if (text.length > maxTextLength)
    return { ok: false, error: `Keep the text to ${maxTextLength} characters.` };
  if (form.kind === 'message') {
    if (text === '') return { ok: false, error: 'Write the message first.' };
    return { ok: true, body: { kind: 'message', text } };
  }
  const restartAt =
    form.lead === 'preset'
      ? restartAtFromMinutes(now, form.minutes)
      : restartAtFromLocalTime(form.time, now);
  if (restartAt === null) return { ok: false, error: 'Enter a time as HH:MM or pick one.' };
  const lead = Date.parse(restartAt) - now;
  if (lead < minLeadMinutes * 60_000)
    return {
      ok: false,
      error: `Give the server at least ${minLeadMinutes} minutes; it checks in about once a minute.`
    };
  if (lead > maxLeadHours * 3600_000)
    return { ok: false, error: `Schedule the restart within the next ${maxLeadHours} hours.` };
  return { ok: true, body: { kind: 'restart', restart_at: restartAt, text: text || null } };
}

export function statusLabel(status: AnnouncementStatus): string {
  switch (status) {
    case 'pending':
      return 'waiting for the server';
    case 'delivered':
      return 'on the server';
    case 'shown':
      return 'shown';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'expired';
  }
}

export function statusTone(status: AnnouncementStatus): string {
  switch (status) {
    case 'pending':
      return 'text-warning';
    case 'delivered':
      return 'text-accent';
    case 'shown':
      return 'text-online';
    case 'cancelled':
      return 'text-ink-muted';
    default:
      return 'text-offline';
  }
}

export function canCancel(item: Pick<Announcement, 'status'>): boolean {
  return item.status === 'pending' || item.status === 'delivered';
}

export function isLive(items: readonly Pick<Announcement, 'status'>[]): boolean {
  return items.some((item) => canCancel(item));
}

export function restartLead(item: Pick<Announcement, 'kind' | 'restart_at'>, now: number): string {
  const at = parseInstant(item.restart_at);
  if (item.kind !== 'restart' || at === null) return '';
  const seconds = Math.round((at - now) / 1000);
  if (seconds <= 0) return 'time passed';
  if (seconds < 60) return 'in under a minute';
  return `in ${formatDuration(seconds)}`;
}

export function announcementSummary(item: Pick<Announcement, 'kind' | 'text'>): string {
  if (item.kind === 'message') return item.text ?? '';
  return item.text ? `Server restart: ${item.text}` : 'Server restart';
}

export function queuedNote(body: AnnouncementCreate): string {
  return body.kind === 'message'
    ? 'Queued. The server shows it the next time it checks in, within about a minute.'
    : 'Restart scheduled. The countdown banners start once the server checks in, within about a minute.';
}
