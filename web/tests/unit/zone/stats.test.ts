import { describe, expect, it } from 'vitest';
import {
  coefficientOfVariation,
  interpolateScore,
  median,
  normalizeZoneName,
  percentile,
  slugifyName,
  successiveJitter
} from '$lib/zone/stats';

describe('stats', () => {
  it('computes the median for odd and even lists', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBeNull();
  });

  it('computes p95 by linear interpolation', () => {
    const p95 = percentile([10, 12, 14, 16, 18, 20, 22, 24, 26, 80], 0.95);
    expect(p95).not.toBeNull();
    expect(p95 as number).toBeGreaterThan(26);
    expect(p95 as number).toBeLessThanOrEqual(80);
  });

  it('measures successive jitter', () => {
    expect(successiveJitter([10, 12, 11, 13])).toBe((2 + 1 + 2) / 3);
    expect(successiveJitter([20])).toBeNull();
  });

  it('interpolates score tables and clamps to the ends', () => {
    const table = [
      [10, 100],
      [20, 50],
      [30, 0]
    ] as const;
    expect(interpolateScore(10, table)).toBe(100);
    expect(interpolateScore(20, table)).toBe(50);
    expect(interpolateScore(15, table)).toBe(75);
    expect(interpolateScore(0, table)).toBe(100);
    expect(interpolateScore(40, table)).toBe(0);
  });

  it('slugifies player names for filenames', () => {
    expect(slugifyName('Pete')).toBe('pete');
    expect(slugifyName('  Olaf the  Red  ')).toBe('olaf-the-red');
    expect(slugifyName('@@@')).toBe('player');
  });

  it('normalises zone names by trimming, collapsing whitespace and uppercasing', () => {
    expect(normalizeZoneName('  olaf   the red ')).toBe('OLAF THE RED');
    expect(normalizeZoneName('Björn')).toBe('BJÖRN');
    expect(normalizeZoneName('   ')).toBe('');
  });

  it('computes the coefficient of variation', () => {
    const cv = coefficientOfVariation([100, 102, 101, 99, 100]);
    expect(cv).not.toBeNull();
    expect(cv as number).toBeLessThan(0.03);
    expect(coefficientOfVariation([0, 0])).toBe(0);
  });
});
