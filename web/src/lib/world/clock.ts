import type { Status } from '$lib/api/types';

export const dayLengthSeconds = 1800;
export const dawnRawFraction = 0.15;
export const duskRawFraction = 0.85;
export const sunriseSunFraction = 0.25;
export const sunsetSunFraction = 0.75;
export const bellSunFraction = 17 / 24;
export const crowSunFraction = 5 / 24;
export const naturalStepSeconds = 30;

export type Phase = 'night' | 'morning' | 'afternoon' | 'evening';

export function worldDay(netTime: number): number {
  return Math.floor(netTime / dayLengthSeconds);
}

export function rawFraction(netTime: number): number {
  const fraction = (netTime / dayLengthSeconds) % 1;
  return fraction < 0 ? fraction + 1 : fraction;
}

export function sunFraction(raw: number): number {
  if (raw >= dawnRawFraction && raw <= duskRawFraction) {
    return sunriseSunFraction + ((raw - dawnRawFraction) / 0.7) * 0.5;
  }
  if (raw < 0.5) return (raw / dawnRawFraction) * sunriseSunFraction;
  return sunsetSunFraction + ((raw - duskRawFraction) / 0.15) * 0.25;
}

export function rawFromSun(sun: number): number {
  if (sun >= sunriseSunFraction && sun <= sunsetSunFraction) {
    return dawnRawFraction + ((sun - sunriseSunFraction) / 0.5) * 0.7;
  }
  if (sun < 0.5) return (sun / sunriseSunFraction) * dawnRawFraction;
  return duskRawFraction + ((sun - sunsetSunFraction) / 0.25) * 0.15;
}

export const dawnOffsetSeconds = dawnRawFraction * dayLengthSeconds;
export const duskOffsetSeconds = duskRawFraction * dayLengthSeconds;
export const bellOffsetSeconds = Math.round(rawFromSun(bellSunFraction) * dayLengthSeconds);
export const bellLeadSeconds = duskOffsetSeconds - bellOffsetSeconds;
export const crowOffsetSeconds = Math.round(rawFromSun(crowSunFraction) * dayLengthSeconds);
export const crowLeadSeconds = dawnOffsetSeconds - crowOffsetSeconds;

export function sunOf(netTime: number): number {
  return sunFraction(rawFraction(netTime));
}

export function phaseOf(sun: number): Phase {
  if (sun < sunriseSunFraction || sun >= sunsetSunFraction) return 'night';
  if (sun < 0.5) return 'morning';
  if (sun < bellSunFraction) return 'afternoon';
  return 'evening';
}

export function sunMinutes(sun: number): number {
  const turn = ((sun % 1) + 1) % 1;
  return Math.floor(turn * 24 * 60 + 1e-6) % (24 * 60);
}

export function sunClock(sun: number): string {
  const minutes = sunMinutes(sun);
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mm = String(minutes % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function secondsUntilOffset(netTime: number, offsetSeconds: number): number {
  const into = ((netTime % dayLengthSeconds) + dayLengthSeconds) % dayLengthSeconds;
  const ahead = offsetSeconds - into;
  return ahead > 0 ? ahead : ahead + dayLengthSeconds;
}

export interface Turn {
  kind: 'nightfall' | 'dawn';
  inSeconds: number;
}

export function nextTurn(netTime: number): Turn {
  const night = phaseOf(sunOf(netTime)) === 'night';
  return night
    ? { kind: 'dawn', inSeconds: secondsUntilOffset(netTime, dawnOffsetSeconds) }
    : { kind: 'nightfall', inSeconds: secondsUntilOffset(netTime, duskOffsetSeconds) };
}

export function crossedOffset(
  previous: number,
  current: number,
  offsetSeconds: number,
  maxStepSeconds = naturalStepSeconds
): number | null {
  const step = current - previous;
  if (!(step > 0) || step > maxStepSeconds) return null;
  const day = Math.floor((previous - offsetSeconds) / dayLengthSeconds) + 1;
  const crossing = day * dayLengthSeconds + offsetSeconds;
  return crossing > previous && crossing <= current ? crossing : null;
}

export function isWorldTimeAdvancing(status: Status): boolean {
  return status.source === 'plugin' && status.online && status.player_count > 0;
}
