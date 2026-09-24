import { describe, expect, it } from 'vitest';
import type { Status } from '$lib/api/types';
import {
  settleMs,
  staleAfterMs,
  sweepMs,
  tickMs,
  WorldClock,
  type TimeSource
} from '$lib/ui/worldclock.svelte';

function fakeSource(reduced = false) {
  let now = 10_000;
  let hidden = false;
  const frames: (() => void)[] = [];
  const waits: { callback: () => void; due: number }[] = [];
  const visible: (() => void)[] = [];
  const source: TimeSource = {
    now: () => now,
    hidden: () => hidden,
    frame: (callback) => {
      frames.push(callback);
      return () => {
        const index = frames.indexOf(callback);
        if (index >= 0) frames.splice(index, 1);
      };
    },
    wait: (callback, ms) => {
      const entry = { callback, due: now + ms };
      waits.push(entry);
      return () => {
        const index = waits.indexOf(entry);
        if (index >= 0) waits.splice(index, 1);
      };
    },
    onVisible: (callback) => {
      visible.push(callback);
      return () => visible.splice(visible.indexOf(callback), 1);
    },
    reducedMotion: () => reduced
  };
  return {
    source,
    frames,
    waits,
    advance(ms: number) {
      now += ms;
    },
    hide(value: boolean) {
      hidden = value;
      if (!value) for (const callback of [...visible]) callback();
    },
    runDue() {
      const due = waits.filter((entry) => entry.due <= now);
      for (const entry of due) waits.splice(waits.indexOf(entry), 1);
      for (const entry of due) entry.callback();
      const pending = frames.splice(0, frames.length);
      for (const callback of pending) callback();
    }
  };
}

const status = (netTime: number, over: Partial<Status> = {}, updated = 'a'): Status =>
  ({
    online: true,
    source: 'plugin',
    player_count: 2,
    max_players: 10,
    game_version: '1.0.12',
    network_version: 40,
    server_name: 'Ravenhold',
    world: { name: 'savegame', uid: 1, day: 290, time_of_day: 0.5, net_time: netTime },
    run: null,
    last_save_at: null,
    telemetry: { live: true, last_heartbeat_at: null, delayed_since: null },
    updated_at: updated,
    ...over
  }) as Status;

const noon = 290 * 1800 + 900;

describe('the world clock store', () => {
  it('reads straight from the status without a time source', () => {
    const clock = new WorldClock(null);
    const reading = clock.reading(status(noon));
    expect(reading).toMatchObject({ state: 'live', day: 290, clock: '12:00', phase: 'afternoon' });
    expect(clock.reading(null)).toBeNull();
    expect(clock.reading(status(noon, { player_count: 0 }))?.state).toBe('still');
    expect(
      clock.reading(
        status(noon, { telemetry: { live: false, last_heartbeat_at: null, delayed_since: null } })
      )?.state
    ).toBe('lost');
  });

  it('runs one second of world time per real second while players are on', () => {
    const fake = fakeSource();
    const clock = new WorldClock(fake.source);
    const frame = status(noon);
    clock.observe(frame);
    fake.advance(105_000);
    expect(clock.reading(frame)?.clock).toBe('13:00');
    expect(clock.reading(frame)?.turn).toEqual({ kind: 'nightfall', inSeconds: 525 });
    const idle = status(noon + 105, { player_count: 0 }, 'b');
    clock.observe(idle);
    fake.advance(60_000);
    expect(clock.reading(idle)).toMatchObject({ state: 'still', clock: '13:00' });
  });

  it('falls back to the status when the frame it holds is not the one shown', () => {
    const fake = fakeSource();
    const clock = new WorldClock(fake.source);
    clock.observe(status(noon));
    fake.advance(5000);
    expect(clock.reading(status(noon + 7, {}, 'b'))?.netTime).toBe(noon + 7);
  });

  it('settles a small correction and sweeps a jump', () => {
    const fake = fakeSource();
    const clock = new WorldClock(fake.source);
    clock.observe(status(noon));
    fake.advance(5000);
    const nudged = status(noon + 7, {}, 'b');
    clock.observe(nudged);
    expect(clock.reading(nudged)?.netTime).toBeCloseTo(noon + 5, 3);
    fake.advance(settleMs / 2);
    const midway = clock.reading(nudged)?.netTime ?? 0;
    expect(midway).toBeGreaterThan(noon + 5.3);
    expect(midway).toBeLessThan(noon + 7.3);
    fake.advance(settleMs / 2);
    expect(clock.reading(nudged)?.netTime).toBeCloseTo(noon + 7 + settleMs / 1000, 3);
    const slept = status(noon + 8 + 1170, {}, 'c');
    clock.observe(slept);
    expect(clock.easing(fake.source.now())).toBe(true);
    fake.advance(sweepMs);
    expect(clock.easing(fake.source.now())).toBe(false);
    expect(clock.reading(slept)?.netTime).toBeCloseTo(noon + 8 + 1170 + sweepMs / 1000, 3);
  });

  it('snaps instead of easing under reduced motion', () => {
    const fake = fakeSource(true);
    const clock = new WorldClock(fake.source);
    clock.observe(status(noon));
    fake.advance(5000);
    const nudged = status(noon + 9, {}, 'b');
    clock.observe(nudged);
    expect(clock.reading(nudged)?.netTime).toBe(noon + 9);
  });

  it('freezes as stale when no frame has arrived for three minutes', () => {
    const fake = fakeSource();
    const clock = new WorldClock(fake.source);
    const frame = status(noon);
    clock.observe(frame);
    fake.advance(staleAfterMs + 60_000);
    const reading = clock.reading(frame);
    expect(reading?.state).toBe('stale');
    expect(reading?.netTime).toBe(noon + staleAfterMs / 1000);
  });

  it('ticks on a timer, on frames while easing, and pauses while hidden', () => {
    const fake = fakeSource();
    const clock = new WorldClock(fake.source);
    const stop = clock.start();
    expect(fake.waits).toHaveLength(1);
    expect(fake.frames).toHaveLength(0);
    fake.advance(tickMs);
    fake.runDue();
    expect(fake.waits).toHaveLength(1);
    clock.observe(status(noon));
    fake.advance(tickMs);
    fake.runDue();
    clock.observe(status(noon + 20, {}, 'b'));
    fake.advance(tickMs);
    fake.runDue();
    expect(fake.frames).toHaveLength(1);
    expect(fake.waits).toHaveLength(0);
    fake.advance(settleMs);
    fake.runDue();
    expect(fake.frames).toHaveLength(0);
    expect(fake.waits).toHaveLength(1);
    fake.hide(true);
    fake.advance(tickMs);
    fake.runDue();
    expect(fake.waits).toHaveLength(0);
    fake.hide(false);
    expect(fake.waits).toHaveLength(1);
    stop();
    expect(fake.waits).toHaveLength(0);
  });
});
