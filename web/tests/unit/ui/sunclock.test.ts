import { describe, expect, it } from 'vitest';
import {
  clockCountdown,
  clockNote,
  compactDuration,
  phaseLabel,
  stripClock
} from '$lib/ui/sunclock';
import { readingOf, type ClockState } from '$lib/ui/worldclock.svelte';

const noon = 290 * 1800 + 900;
const bell = 290 * 1800 + 1425;
const midnight = 291 * 1800;

describe('the sun clock labels', () => {
  it('names the phases', () => {
    expect(phaseLabel('night')).toBe('Night');
    expect(phaseLabel('morning')).toBe('Morning');
    expect(phaseLabel('afternoon')).toBe('Afternoon');
    expect(phaseLabel('evening')).toBe('Evening');
  });

  it('keeps the countdown to one unit', () => {
    expect(compactDuration(0)).toBe('0 s');
    expect(compactDuration(59.4)).toBe('59 s');
    expect(compactDuration(60)).toBe('1 min');
    expect(compactDuration(89)).toBe('1 min');
    expect(compactDuration(105)).toBe('2 min');
    expect(compactDuration(630)).toBe('11 min');
    expect(compactDuration(1260)).toBe('21 min');
  });

  it('counts down to nightfall by day and to dawn by night', () => {
    expect(clockCountdown(readingOf(noon, 'live'))).toBe('Nightfall in 11 min');
    expect(clockCountdown(readingOf(bell, 'live'))).toBe('Nightfall in 2 min');
    expect(clockCountdown(readingOf(midnight, 'live'))).toBe('Dawn in 5 min');
  });

  it('explains a clock that is not running', () => {
    expect(clockNote(readingOf(noon, 'live'))).toBe('Nightfall in 11 min');
    const notes: Record<Exclude<ClockState, 'live'>, string> = {
      still: 'Time stands still, nobody is on',
      lost: 'Last known, the plugin is silent',
      stale: 'Last known, out of touch'
    };
    for (const [state, note] of Object.entries(notes)) {
      expect(clockNote(readingOf(noon, state as ClockState))).toBe(note);
    }
  });

  it('writes the strip as day and time', () => {
    expect(stripClock(readingOf(bell, 'live'))).toBe('Day 290 · 17:00');
    expect(stripClock(readingOf(midnight, 'still'))).toBe('Day 291 · 00:00');
  });
});
