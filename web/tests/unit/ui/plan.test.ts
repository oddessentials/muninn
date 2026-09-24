import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Comfort, ComfortPiece } from '$lib/api/types';
import { peakComfort } from '$lib/ui/comfort';
import {
  changeCount,
  countOf,
  mostComfortPlan,
  parsePlan,
  planLimit,
  planMaterials,
  plannedPieces,
  planStations,
  serializePlan,
  totalPieces,
  withoutRecipe
} from '$lib/ui/plan';
import { recipeOf, type Recipe } from '$lib/world/recipes';

const fixture = JSON.parse(
  readFileSync(new URL('../../../fixtures/api/comfort.json', import.meta.url), 'utf8')
) as Comfort;
const catalogue = fixture.catalogue!;
const items = catalogue.items;
const known = new Set(items.map((item) => item.prefab));

function piece(overrides: Partial<ComfortPiece>): ComfortPiece {
  return {
    prefab: 'piece',
    token: '$piece',
    name: 'Piece',
    comfort: 1,
    group: 'Chair',
    condition: null,
    season: null,
    built: 0,
    last_built: null,
    ...overrides
  };
}

function costing(amounts: Record<string, number>) {
  return (prefab: string): Recipe | null =>
    prefab in amounts
      ? { station: null, description: '', materials: [{ item: 'Wood', amount: amounts[prefab]! }] }
      : null;
}

describe('plan links', () => {
  it('reads each piece once with its count and skips anything it cannot trust', () => {
    expect(parsePlan('hearth*2.piece_bed02', known)).toEqual([
      { prefab: 'hearth', count: 2 },
      { prefab: 'piece_bed02', count: 1 }
    ]);
    expect(parsePlan('nothing.hearth*0.hearth*x.hearth*.hearth*-1.hearth*1*2.bed', known)).toEqual([
      { prefab: 'bed', count: 1 }
    ]);
    expect(parsePlan('bed.bed*3', known)).toEqual([{ prefab: 'bed', count: 4 }]);
    expect(parsePlan('bed*5000', known)).toEqual([{ prefab: 'bed', count: planLimit }]);
    expect(parsePlan('constructor.__proto__.toString', known)).toEqual([]);
    expect(parsePlan('', known)).toEqual([]);
    expect(parsePlan(null, known)).toEqual([]);
  });

  it('writes a plan into a link that reads back the same and needs no escaping', () => {
    const plan = [
      { prefab: 'hearth', count: 2 },
      { prefab: 'piece_bed02', count: 1 }
    ];
    expect(serializePlan(plan)).toBe('hearth*2.piece_bed02');
    expect(parsePlan(serializePlan(plan), known)).toEqual(plan);
    expect(new URLSearchParams({ plan: serializePlan(plan) }).toString()).toBe(
      'plan=hearth*2.piece_bed02'
    );
    expect(serializePlan([])).toBe('');
  });
});

describe('changing a plan', () => {
  it('adds, counts and removes pieces in the order they were first added', () => {
    let plan = changeCount([], 'hearth', 1);
    plan = changeCount(plan, 'bed', 1);
    plan = changeCount(plan, 'hearth', 1);
    expect(plan).toEqual([
      { prefab: 'hearth', count: 2 },
      { prefab: 'bed', count: 1 }
    ]);
    expect(countOf(plan, 'hearth')).toBe(2);
    expect(countOf(plan, 'bonfire')).toBe(0);
    expect(totalPieces(plan)).toBe(3);
    plan = changeCount(plan, 'hearth', -2);
    expect(plan).toEqual([{ prefab: 'bed', count: 1 }]);
    expect(changeCount(plan, 'hearth', -1)).toEqual(plan);
  });

  it('stops at the most a plan can hold', () => {
    const full = [{ prefab: 'bed', count: planLimit }];
    expect(changeCount(full, 'bed', 1)).toEqual(full);
  });
});

describe('what a plan takes', () => {
  const plan = [
    { prefab: 'hearth', count: 2 },
    { prefab: 'piece_bed02', count: 1 },
    { prefab: 'piece_throne01', count: 1 },
    { prefab: 'fire_pit', count: 1 }
  ];

  it('adds up every material times the count of its piece, largest first', () => {
    expect(planMaterials(plan, recipeOf)).toEqual([
      { item: 'FineWood', amount: 60 },
      { item: 'Stone', amount: 35 },
      { item: 'IronNails', amount: 25 },
      { item: 'Feathers', amount: 10 },
      { item: 'DeerHide', amount: 7 },
      { item: 'WolfPelt', amount: 4 },
      { item: 'Wood', amount: 2 }
    ]);
  });

  it('lists each crafting station once with how many planned pieces need it', () => {
    expect(planStations(plan, recipeOf)).toEqual([
      { station: 'piece_stonecutter', pieces: 2 },
      { station: 'piece_workbench', pieces: 2 }
    ]);
  });

  it('names the pieces it has no recipe for and leaves them out of the totals', () => {
    const lookup = costing({ hearth: 3 });
    const partial = [
      { prefab: 'hearth', count: 1 },
      { prefab: 'bed', count: 2 }
    ];
    expect(withoutRecipe(partial, lookup)).toEqual(['bed']);
    expect(planMaterials(partial, lookup)).toEqual([{ item: 'Wood', amount: 3 }]);
    expect(planStations(partial, lookup)).toEqual([]);
  });
});

describe('the most comfort plan', () => {
  it('plans one year-round piece per group and reaches the most comfort', () => {
    const plan = mostComfortPlan(catalogue.groups, items, recipeOf);
    const pieces = plannedPieces(plan, items);
    expect(plan.every((entry) => entry.count === 1)).toBe(true);
    expect(pieces.every((item) => item.season === null)).toBe(true);
    expect(new Set(pieces.map((item) => item.group)).size).toBe(pieces.length);
    expect(peakComfort(catalogue.groups, pieces, true)).toBe(22);
    expect(plan[0]).toEqual({ prefab: 'hearth', count: 1 });
  });

  it('prefers a piece the guild has built, then the one that takes the fewest materials', () => {
    const chairs = [
      piece({ prefab: 'costly', name: 'Costly', comfort: 3 }),
      piece({ prefab: 'cheap', name: 'Cheap', comfort: 3 }),
      piece({ prefab: 'weak', name: 'Weak', comfort: 1 })
    ];
    const lookup = costing({ costly: 30, cheap: 5, weak: 1 });
    expect(mostComfortPlan(['Chair'], chairs, lookup)).toEqual([{ prefab: 'cheap', count: 1 }]);
    chairs[0] = { ...chairs[0]!, built: 4 };
    expect(mostComfortPlan(['Chair'], chairs, lookup)).toEqual([{ prefab: 'costly', count: 1 }]);
  });

  it('takes every different piece without a group, the strongest of each name', () => {
    const loose = [
      piece({ group: 'None', token: '$a', prefab: 'a', name: 'A' }),
      piece({ group: 'None', token: '$a', prefab: 'a2', name: 'A', comfort: 2 }),
      piece({ group: 'None', token: '$b', prefab: 'b', name: 'B' }),
      piece({ group: 'None', token: '$c', prefab: 'c', name: 'C', season: 'Yule' })
    ];
    expect(mostComfortPlan(['None'], loose, () => null)).toEqual([
      { prefab: 'a2', count: 1 },
      { prefab: 'b', count: 1 }
    ]);
  });
});
