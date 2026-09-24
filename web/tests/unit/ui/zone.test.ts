import { describe, expect, it } from 'vitest';
import {
  formatMbps,
  formatMs,
  formatThroughput,
  ordinal,
  phaseIndex,
  phaseSteps,
  ratingLabels,
  ratingTones,
  recommendationTones
} from '$lib/ui/zone';

describe('zone labels', () => {
  it('formats measurements with a dash for missing values', () => {
    expect(formatMs(18.234)).toBe('18.2 ms');
    expect(formatMs(null)).toBe('—');
    expect(formatMbps(38.44)).toBe('38 Mbps');
    expect(formatMbps(7.44)).toBe('7.4 Mbps');
    expect(formatMbps(undefined)).toBe('—');
    expect(formatThroughput(2412.4)).toBe('2,412/ms');
    expect(formatThroughput(null)).toBe('—');
  });

  it('orders the phases and names every rating and recommendation tone', () => {
    expect(phaseSteps.map((step) => step.id)).toEqual(['cpu', 'stability', 'network', 'score']);
    expect(phaseIndex('network')).toBe(2);
    expect(Object.keys(ratingLabels)).toEqual([
      'excellent',
      'strong',
      'acceptable',
      'weak',
      'poor'
    ]);
    for (const tone of Object.values(ratingTones)) expect(tone).toMatch(/^text-/);
    for (const tone of Object.values(recommendationTones)) expect(tone).toMatch(/^text-/);
  });

  it('spells ordinals', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101, 111].map(ordinal)).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '11th',
      '12th',
      '13th',
      '21st',
      '22nd',
      '101st',
      '111th'
    ]);
  });
});
