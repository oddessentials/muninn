import { browser } from '$app/environment';
import type { Status } from '$lib/api/types';
import {
  isWorldTimeAdvancing,
  nextTurn,
  phaseOf,
  sunClock,
  sunOf,
  worldDay,
  type Phase,
  type Turn
} from '$lib/world/clock';

export type ClockState = 'live' | 'still' | 'stale' | 'lost';

export interface ClockReading {
  state: ClockState;
  netTime: number;
  day: number;
  sun: number;
  clock: string;
  phase: Phase;
  turn: Turn;
}

export const staleAfterMs = 180_000;
export const settleMs = 600;
export const sweepMs = 1200;
export const smallCorrectionSeconds = 60;
export const tickMs = 200;

export interface TimeSource {
  now(): number;
  hidden(): boolean;
  frame(callback: () => void): () => void;
  wait(callback: () => void, ms: number): () => void;
  onVisible(callback: () => void): () => void;
  reducedMotion(): boolean;
}

const browserSource: TimeSource = {
  now: () => performance.now(),
  hidden: () => document.hidden,
  frame: (callback) => {
    const handle = requestAnimationFrame(callback);
    return () => cancelAnimationFrame(handle);
  },
  wait: (callback, ms) => {
    const handle = setTimeout(callback, ms);
    return () => clearTimeout(handle);
  },
  onVisible: (callback) => {
    const listener = () => {
      if (!document.hidden) callback();
    };
    document.addEventListener('visibilitychange', listener);
    return () => document.removeEventListener('visibilitychange', listener);
  },
  reducedMotion: () => matchMedia('(prefers-reduced-motion: reduce)').matches
};

interface Anchor {
  key: string;
  netTime: number;
  at: number;
  advancing: boolean;
}

function keyOf(status: Status): string {
  return `${status.world?.net_time}|${status.updated_at}|${isWorldTimeAdvancing(status)}`;
}

function easeOut(progress: number): number {
  return 1 - Math.pow(1 - progress, 3);
}

function stateOf(status: Status): ClockState {
  if (!status.telemetry.live) return 'lost';
  return isWorldTimeAdvancing(status) ? 'live' : 'still';
}

export function readingOf(netTime: number, state: ClockState): ClockReading {
  const sun = sunOf(netTime);
  return {
    state,
    netTime,
    day: worldDay(netTime),
    sun,
    clock: sunClock(sun),
    phase: phaseOf(sun),
    turn: nextTurn(netTime)
  };
}

export class WorldClock {
  #source: TimeSource | null;
  #anchor: Anchor | null = null;
  #correction = 0;
  #correctionAt = 0;
  #correctionMs = 0;
  #tick = $state(0);
  #cancel: (() => void) | null = null;

  constructor(source: TimeSource | null = browser ? browserSource : null) {
    this.#source = source;
  }

  easing(now: number): boolean {
    return this.#correctionMs > 0 && now - this.#correctionAt < this.#correctionMs;
  }

  start(): () => void {
    const source = this.#source;
    if (!source) return () => {};
    let stopped = false;
    const loop = () => {
      this.#cancel = null;
      if (stopped || source.hidden()) return;
      this.#tick += 1;
      this.#cancel = this.easing(source.now()) ? source.frame(loop) : source.wait(loop, tickMs);
    };
    const offVisible = source.onVisible(() => {
      if (this.#cancel === null && !stopped) this.#cancel = source.wait(loop, 0);
    });
    this.#cancel = source.wait(loop, 0);
    return () => {
      stopped = true;
      offVisible();
      this.#cancel?.();
      this.#cancel = null;
    };
  }

  displayed(now: number): number | null {
    const anchor = this.#anchor;
    if (!anchor) return null;
    const base = anchor.netTime + (anchor.advancing ? (now - anchor.at) / 1000 : 0);
    if (!this.easing(now)) return base;
    const progress = (now - this.#correctionAt) / this.#correctionMs;
    return base - this.#correction * (1 - easeOut(progress));
  }

  observe(status: Status | null): void {
    const source = this.#source;
    if (!source) return;
    if (!status?.world) {
      this.#anchor = null;
      this.#correctionMs = 0;
      return;
    }
    const key = keyOf(status);
    if (this.#anchor?.key === key) return;
    const now = source.now();
    const shown = this.displayed(now);
    this.#anchor = {
      key,
      netTime: status.world.net_time,
      at: now,
      advancing: isWorldTimeAdvancing(status)
    };
    if (shown === null) return;
    const delta = status.world.net_time - shown;
    if (Math.abs(delta) < 0.05 || source.reducedMotion()) {
      this.#correctionMs = 0;
      return;
    }
    this.#correction = delta;
    this.#correctionAt = now;
    this.#correctionMs = Math.abs(delta) < smallCorrectionSeconds ? settleMs : sweepMs;
  }

  reading(status: Status | null): ClockReading | null {
    if (!status?.world) return null;
    const source = this.#source;
    let state = stateOf(status);
    if (!source) return readingOf(status.world.net_time, state);
    void this.#tick;
    const anchor = this.#anchor;
    if (!anchor || anchor.key !== keyOf(status)) return readingOf(status.world.net_time, state);
    const now = source.now();
    if (state === 'live' && now - anchor.at > staleAfterMs) state = 'stale';
    const netTime =
      state === 'stale' ? anchor.netTime + staleAfterMs / 1000 : (this.displayed(now) ?? 0);
    return readingOf(netTime, state);
  }
}

export const worldClock = new WorldClock();
