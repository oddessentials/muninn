import { describe, expect, it } from 'vitest';
import { raidEndNote, raidLength, raidPauseNote, raidStanding, raidStartNote } from '$lib/ui/raids';

const ended = { duration_s: 125, end_reason: 'ended' as const, active_s: 120, restored: false };
const paused = { duration_s: 15005, end_reason: 'ended' as const, active_s: 120.1, restored: true };
const legacy = { duration_s: 122, end_reason: 'ended' as const, active_s: null, restored: false };
const running = { duration_s: null, end_reason: null, active_s: null, restored: false };
const stopped = {
  duration_s: 600,
  end_reason: 'server_stop' as const,
  active_s: null,
  restored: false
};
const lost = {
  duration_s: 1802,
  end_reason: 'server_lost' as const,
  active_s: null,
  restored: true
};

describe('raid standing', () => {
  it('tells running, ended and cut-short raids apart', () => {
    expect(raidStanding(running)).toBe('running');
    expect(raidStanding(ended)).toBe('ended');
    expect(raidStanding(stopped)).toBe('cut short');
    expect(raidStanding(lost)).toBe('cut short');
  });

  it('prefers the raid timer over the clock and falls back for older plugins', () => {
    expect(raidLength(ended)).toBe('2 min');
    expect(raidLength(paused)).toBe('2 min');
    expect(raidLength(legacy)).toBe('2 min 2 s');
    expect(raidLength(running)).toBe('');
    expect(raidLength(stopped)).toBe('');
  });

  it('explains a cut-short raid and a paused one', () => {
    expect(raidEndNote(stopped)).toBe('the server stopped while it was pending');
    expect(raidEndNote(lost)).toBe('the server was lost while it was pending');
    expect(raidEndNote(ended)).toBe('');
    expect(raidPauseNote(paused)).toBe(
      '4 h 10 min passed on the clock; the raid timer pauses while nobody is in range'
    );
    expect(raidPauseNote(ended)).toBe('');
    expect(raidPauseNote(legacy)).toBe('');
  });

  it('marks a raid that was already under way at a server start', () => {
    expect(raidStartNote(paused)).toBe('already under way when the server started');
    expect(raidStartNote(ended)).toBe('');
  });
});
