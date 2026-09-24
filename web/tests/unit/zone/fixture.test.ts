import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ZoneResultList } from '$lib/api/types';
import { rankResults } from '$lib/zone/ranking';
import { normalizeZoneName } from '$lib/zone/stats';
import { checkResult } from '$lib/zone/validate';

const fixture = JSON.parse(
  readFileSync(new URL('../../../fixtures/api/zone/results.json', import.meta.url), 'utf8')
) as ZoneResultList;

describe('zone results fixture', () => {
  it('holds results the library accepts unchanged', () => {
    for (const item of fixture.items) {
      const checked = checkResult(item.result);
      expect(checked.ok, item.name).toBe(true);
      if (checked.ok) expect(checked.tampered, item.name).toBe(false);
    }
  });

  it('is ranked and annotated exactly as the library would rank it', () => {
    const ranked = rankResults(fixture.items.map((item) => item.result));
    expect(fixture.items).toEqual(
      ranked.map((entry) => ({
        rank: entry.rank,
        name: entry.result.player.name,
        tested_at: entry.result.testedAt,
        rating: entry.result.rating,
        recommendation: entry.recommendation,
        scores: entry.result.scores,
        explanation: entry.explanation,
        result: entry.result
      }))
    );
  });

  it('stores every result under its normalised name, once', () => {
    const names = fixture.items.map((item) => item.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(normalizeZoneName(name)).toBe(name);
  });

  it('covers every rating and recommendation the card can show', () => {
    const ratings = new Set(fixture.items.map((item) => item.rating));
    const recommendations = new Set(fixture.items.map((item) => item.recommendation));
    expect([...ratings].sort()).toEqual(['acceptable', 'excellent', 'poor', 'strong', 'weak']);
    expect([...recommendations].sort()).toEqual(['avoid', 'backup', 'primary']);
    expect(fixture.items.some((item) => item.result.completion.tabLostFocus)).toBe(true);
    expect(fixture.items.some((item) => item.result.penalties.length > 1)).toBe(true);
  });
});
