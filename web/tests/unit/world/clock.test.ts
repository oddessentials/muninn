import { describe, expect, it } from 'vitest';
import type { Status } from '$lib/api/types';
import {
  bellLeadSeconds,
  bellOffsetSeconds,
  crossedOffset,
  crowLeadSeconds,
  crowOffsetSeconds,
  dawnOffsetSeconds,
  duskOffsetSeconds,
  isWorldTimeAdvancing,
  nextTurn,
  phaseOf,
  rawFraction,
  rawFromSun,
  secondsUntilOffset,
  sunClock,
  sunFraction,
  sunOf,
  worldDay
} from '$lib/world/clock';

const status = (over: Partial<Status>): Status =>
  ({
    online: true,
    source: 'plugin',
    player_count: 2,
    max_players: 10,
    game_version: '1.0.12',
    network_version: 40,
    server_name: 'Ravenhold',
    world: { name: 'savegame', uid: 1, day: 290, time_of_day: 0.5, net_time: 522900 },
    run: null,
    last_save_at: null,
    telemetry: { live: true, last_heartbeat_at: null, delayed_since: null },
    updated_at: '2026-09-19T00:00:00Z',
    ...over
  }) as Status;

describe('the sun clock', () => {
  it('numbers the day from midnight of a 1800 s day', () => {
    expect(worldDay(522136)).toBe(290);
    expect(worldDay(522000)).toBe(290);
    expect(worldDay(521999.9)).toBe(289);
    expect(rawFraction(522000)).toBe(0);
    expect(rawFraction(522136)).toBeCloseTo(0.0756, 4);
  });

  it('rescales the raw fraction the way the game does', () => {
    expect(sunFraction(0)).toBe(0);
    expect(sunFraction(0.15)).toBeCloseTo(0.25);
    expect(sunFraction(0.5)).toBeCloseTo(0.5);
    expect(sunFraction(0.85)).toBeCloseTo(0.75);
    expect(sunFraction(0.925)).toBeCloseTo(0.875);
    expect(sunFraction(0.075)).toBeCloseTo(0.125);
    for (const raw of [0, 0.05, 0.15, 0.3, 0.5, 0.7, 0.85, 0.9, 0.999]) {
      expect(rawFromSun(sunFraction(raw))).toBeCloseTo(raw, 10);
    }
  });

  it('reads dawn at 06:00, noon at 12:00 and nightfall at 18:00', () => {
    expect(sunClock(sunOf(270))).toBe('06:00');
    expect(sunClock(sunOf(900))).toBe('12:00');
    expect(sunClock(sunOf(1530))).toBe('18:00');
    expect(sunClock(sunOf(0))).toBe('00:00');
    expect(sunClock(sunOf(1799.9))).toBe('23:59');
    expect(sunClock(17 / 24)).toBe('17:00');
  });

  it('runs a clock hour in 105 real seconds by day and 45 by night', () => {
    expect(rawFromSun(7 / 24) * 1800 - rawFromSun(6 / 24) * 1800).toBeCloseTo(105);
    expect(rawFromSun(23 / 24) * 1800 - rawFromSun(22 / 24) * 1800).toBeCloseTo(45);
  });

  it('places the bell at 17:00, 105 real seconds before nightfall', () => {
    expect(bellOffsetSeconds).toBe(1425);
    expect(duskOffsetSeconds).toBe(1530);
    expect(dawnOffsetSeconds).toBe(270);
    expect(bellLeadSeconds).toBe(105);
    expect(sunClock(sunOf(1425))).toBe('17:00');
  });

  it('places the crow at 05:00, 45 real seconds before dawn', () => {
    expect(crowOffsetSeconds).toBe(225);
    expect(crowLeadSeconds).toBe(45);
    expect(sunClock(sunOf(225))).toBe('05:00');
    expect(phaseOf(sunOf(225))).toBe('night');
  });

  it('names the phases at the game boundaries', () => {
    expect(phaseOf(0.2499)).toBe('night');
    expect(phaseOf(0.25)).toBe('morning');
    expect(phaseOf(0.4999)).toBe('morning');
    expect(phaseOf(0.5)).toBe('afternoon');
    expect(phaseOf(17 / 24 - 0.0001)).toBe('afternoon');
    expect(phaseOf(17 / 24)).toBe('evening');
    expect(phaseOf(0.7499)).toBe('evening');
    expect(phaseOf(0.75)).toBe('night');
  });

  it('counts real seconds to the next turn of the day', () => {
    expect(secondsUntilOffset(522000 + 1000, duskOffsetSeconds)).toBe(530);
    expect(secondsUntilOffset(522000 + 1530, duskOffsetSeconds)).toBe(1800);
    expect(secondsUntilOffset(522000 + 1600, dawnOffsetSeconds)).toBe(470);
    expect(nextTurn(522000 + 1000)).toEqual({ kind: 'nightfall', inSeconds: 530 });
    expect(nextTurn(522000 + 1600)).toEqual({ kind: 'dawn', inSeconds: 470 });
    expect(nextTurn(522000 + 100)).toEqual({ kind: 'dawn', inSeconds: 170 });
  });

  it('detects a natural crossing of the bell and ignores jumps', () => {
    expect(crossedOffset(522000 + 1420, 522000 + 1426, bellOffsetSeconds)).toBe(523425);
    expect(crossedOffset(522000 + 1425, 522000 + 1430, bellOffsetSeconds)).toBeNull();
    expect(crossedOffset(522000 + 1424, 522000 + 1425, bellOffsetSeconds)).toBe(523425);
    expect(crossedOffset(522000 + 1400, 522000 + 1420, bellOffsetSeconds)).toBeNull();
    expect(crossedOffset(522000 + 1420, 522000 + 1420, bellOffsetSeconds)).toBeNull();
    expect(crossedOffset(522000 + 1426, 522000 + 1420, bellOffsetSeconds)).toBeNull();
    expect(crossedOffset(522000 + 1000, 523800 + 270, bellOffsetSeconds)).toBeNull();
    expect(crossedOffset(522000 + 1420, 522000 + 1460, bellOffsetSeconds)).toBeNull();
    expect(crossedOffset(522000 + 1420, 522000 + 1450, bellOffsetSeconds)).toBe(523425);
  });

  it('lets the clock run only on live plugin data with players on', () => {
    expect(isWorldTimeAdvancing(status({}))).toBe(true);
    expect(isWorldTimeAdvancing(status({ player_count: 0 }))).toBe(false);
    expect(isWorldTimeAdvancing(status({ source: 'a2s' }))).toBe(false);
    expect(isWorldTimeAdvancing(status({ online: false }))).toBe(false);
  });
});
