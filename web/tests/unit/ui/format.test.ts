import { describe, expect, it } from 'vitest';
import {
  formatDistance,
  formatDuration,
  formatHours,
  formatMillis,
  formatPerHour,
  formatPosition,
  relativeTime
} from '$lib/ui/format';

describe('durations', () => {
  it('rounds to the units a player cares about', () => {
    expect(formatDuration(0)).toBe('0 s');
    expect(formatDuration(45)).toBe('45 s');
    expect(formatDuration(107)).toBe('1 min 47 s');
    expect(formatDuration(1800)).toBe('30 min');
    expect(formatDuration(4620)).toBe('1 h 17 min');
    expect(formatDuration(987955)).toBe('11 d 10 h');
    expect(formatDuration(null)).toBe('');
  });

  it('shows playtime in hours', () => {
    expect(formatHours(600)).toBe('10 min');
    expect(formatHours(5400)).toBe('1.5 h');
    expect(formatHours(236820)).toBe('66 h');
  });

  it('shows save durations in milliseconds or seconds', () => {
    expect(formatMillis(996)).toBe('996 ms');
    expect(formatMillis(1037)).toBe('1.0 s');
  });
});

describe('rates', () => {
  it('divides a count by the hours played and stays blank without playtime', () => {
    expect(formatPerHour(8, 236820)).toBe('0.12');
    expect(formatPerHour(0, 5400)).toBe('0.00');
    expect(formatPerHour(1, 600)).toBe('6.00');
    expect(formatPerHour(30, 600)).toBe('180.0');
    expect(formatPerHour(3, 0)).toBe('');
    expect(formatPerHour(null, 3600)).toBe('');
  });
});

describe('distances and positions', () => {
  it('switches to kilometres past a thousand metres', () => {
    expect(formatDistance(812)).toBe('812 m');
    expect(formatDistance(6410)).toBe('6.4 km');
    expect(formatDistance(217121)).toBe('217 km');
  });

  it('rounds positions to whole metres', () => {
    expect(formatPosition(76.1, -253.1)).toBe('76, -253');
    expect(formatPosition(null, 1)).toBe('');
  });
});

describe('relative time', () => {
  const now = Date.parse('2026-09-10T20:00:00Z');

  it('describes the past and the future', () => {
    expect(relativeTime('2026-09-10T19:59:50Z', now)).toBe('just now');
    expect(relativeTime('2026-09-10T20:00:20Z', now)).toBe('just now');
    expect(relativeTime('2026-09-10T20:01:00Z', now)).toBe('in 1 min');
    expect(relativeTime('2026-09-10T19:30:00Z', now)).toBe('30 min ago');
    expect(relativeTime('2026-09-10T11:00:00Z', now)).toBe('9 h ago');
    expect(relativeTime('2026-09-07T20:00:00Z', now)).toBe('3 d ago');
    expect(relativeTime('2026-09-11T08:00:00Z', now)).toBe('in 12 h');
    expect(relativeTime(null, now)).toBe('');
  });
});
