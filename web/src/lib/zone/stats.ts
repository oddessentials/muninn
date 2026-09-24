import type { ScoreTable } from './config';

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function roundScore(value: number): number {
  return Math.round(clamp(value, 0, 100));
}

function finite(values: number[]): number[] {
  return values.filter((n) => Number.isFinite(n));
}

export function median(values: number[]): number | null {
  const clean = finite(values).sort((a, b) => a - b);
  if (clean.length === 0) return null;
  const mid = Math.floor(clean.length / 2);
  if (clean.length % 2 === 0) return ((clean[mid - 1] as number) + (clean[mid] as number)) / 2;
  return clean[mid] as number;
}

export function percentile(values: number[], p: number): number | null {
  const clean = finite(values).sort((a, b) => a - b);
  if (clean.length === 0) return null;
  if (clean.length === 1) return clean[0] as number;
  const index = clamp(p, 0, 1) * (clean.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const low = clean[lower] as number;
  const high = clean[upper] as number;
  if (lower === upper) return low;
  return low + (high - low) * (index - lower);
}

export function mean(values: number[]): number | null {
  const clean = finite(values);
  if (clean.length === 0) return null;
  return clean.reduce((sum, n) => sum + n, 0) / clean.length;
}

export function stddev(values: number[]): number | null {
  const m = mean(values);
  const clean = finite(values);
  if (m === null || clean.length < 2) return null;
  const variance = clean.reduce((sum, n) => sum + (n - m) * (n - m), 0) / (clean.length - 1);
  return Math.sqrt(variance);
}

export function coefficientOfVariation(values: number[]): number | null {
  const m = mean(values);
  const s = stddev(values);
  if (m === 0) return 0;
  if (m === null || s === null) return null;
  return Math.abs(s / m);
}

export function successiveJitter(values: number[]): number | null {
  const clean = finite(values);
  if (clean.length < 2) return null;
  let sum = 0;
  for (let i = 1; i < clean.length; i++) {
    sum += Math.abs((clean[i] as number) - (clean[i - 1] as number));
  }
  return sum / (clean.length - 1);
}

export function interpolateScore(value: number, table: ScoreTable): number {
  const first = table[0];
  const last = table[table.length - 1];
  if (!Number.isFinite(value) || !first || !last) return 0;
  if (value <= first[0]) return first[1];
  if (value >= last[0]) return last[1];
  for (let i = 1; i < table.length; i++) {
    const [x1, y1] = table[i - 1] as readonly [number, number];
    const [x2, y2] = table[i] as readonly [number, number];
    if (value <= x2) {
      const span = x2 - x1;
      const t = span === 0 ? 0 : (value - x1) / span;
      return y1 + t * (y2 - y1);
    }
  }
  return last[1];
}

export function mbpsFromBytes(bytes: number, elapsedMs: number): number | null {
  if (!Number.isFinite(bytes) || !Number.isFinite(elapsedMs) || elapsedMs <= 0) return null;
  return (bytes * 8) / (elapsedMs / 1000) / 1_000_000;
}

export function normalizeZoneName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toUpperCase();
}

export function slugifyName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'player';
}
