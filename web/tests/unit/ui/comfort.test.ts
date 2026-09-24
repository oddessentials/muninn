import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Comfort, ComfortPiece } from '$lib/api/types';
import {
  conditionLabel,
  defaultOrder,
  filterPieces,
  formatBuiltDay,
  groupLabel,
  groupOrder,
  groupStandings,
  isStale,
  peakComfort,
  restedSeconds,
  seasonWindow,
  sortPieces,
  topOfGroup
} from '$lib/ui/comfort';

const fixture = JSON.parse(
  readFileSync(new URL('../../../fixtures/api/comfort.json', import.meta.url), 'utf8')
) as Comfort;
const catalogue = fixture.catalogue!;
const items = catalogue.items;
const noFilter = { q: null, group: null, lit: false, built: false };

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

describe('comfort totals', () => {
  it('reaches 22 with every group at its best and 24 with the seasonal pieces', () => {
    expect(peakComfort(catalogue.groups, items, false)).toBe(22);
    expect(peakComfort(catalogue.groups, items, true)).toBe(24);
  });

  it('turns a comfort level into Rested time from the catalogue', () => {
    expect(restedSeconds(catalogue, 1)).toBe(480);
    expect(restedSeconds(catalogue, 22)).toBe(1740);
    expect(restedSeconds(catalogue, 24)).toBe(1860);
  });

  it('counts pieces without a group once per name', () => {
    const loose = [
      piece({ group: 'None', token: '$a', prefab: 'a1' }),
      piece({ group: 'None', token: '$a', prefab: 'a2' }),
      piece({ group: 'None', token: '$b', prefab: 'b', comfort: 2 })
    ];
    expect(peakComfort(['None'], loose, true)).toBe(2 + 1 + 2);
  });
});

describe('group standings', () => {
  it('keeps the group order of the game but lists the ungrouped pieces last', () => {
    const order = groupOrder(catalogue.groups, items);
    expect(order).toHaveLength(12);
    expect(order[0]).toBe('Fire');
    expect(order.at(-1)).toBe('None');
  });

  it('places a group the catalogue does not list after the known ones', () => {
    const pieces = [
      piece({ group: 'Hearthstone' }),
      piece({ group: 'Fire' }),
      piece({ group: 'None' })
    ];
    expect(groupOrder(['None', 'Fire'], pieces)).toEqual(['Fire', 'Hearthstone', 'None']);
  });

  it('merges variants that share a name and adds up what was built of them', () => {
    const stands = [
      piece({
        prefab: 'itemstand',
        token: '$piece_itemstand',
        name: 'Item Stand',
        group: 'Display',
        built: 3
      }),
      piece({
        prefab: 'itemstandh',
        token: '$piece_itemstand',
        name: 'Item Stand',
        group: 'Display',
        built: 4
      }),
      piece({
        prefab: 'ArmorStand',
        token: '$piece_armorstand',
        name: 'Armour Stand',
        group: 'Display'
      })
    ];
    const [display] = groupStandings(['Display'], stands);
    expect(display!.best.map((item) => item.name)).toEqual(['Armour Stand', 'Item Stand']);
    expect(display!.best.find((item) => item.name === 'Item Stand')?.built).toBe(7);
    expect(display!.built).toBe(1);
  });

  it('names the best pieces of each group once and says whether one was built', () => {
    const standings = groupStandings(catalogue.groups, items);
    const chair = standings.find((standing) => standing.group === 'Chair')!;
    expect(chair.adds).toBe(3);
    expect(chair.best.map((item) => item.name)).toEqual([
      'Antler Throne',
      'Black Marble Throne',
      'Bone Throne',
      'Raven Throne',
      'Stone Throne'
    ]);
    expect(chair.built).toBe(0);
    const display = standings.find((standing) => standing.group === 'Display')!;
    expect(display.best.map((item) => item.name)).toEqual(['Armour Stand', 'Item Stand']);
    const loose = standings.find((standing) => standing.group === 'None')!;
    expect(loose.stacks).toBe(true);
    expect(loose.adds).toBe(2);
    expect(loose.built).toBe(0);
  });
});

describe('the piece table', () => {
  it('sorts by group, then comfort, then name by default', () => {
    const rows = sortPieces(items, 'group', 'asc', catalogue.groups);
    expect(rows.slice(0, 3).map((item) => item.name)).toEqual([
      'Hearth',
      'Blue Standing Brazier',
      'Bonfire'
    ]);
    expect(rows.at(-1)?.group).toBe('None');
  });

  it('sorts numbers highest first and names from A unless told otherwise', () => {
    expect(defaultOrder('comfort')).toBe('desc');
    expect(defaultOrder('built')).toBe('desc');
    expect(defaultOrder('name')).toBe('asc');
    expect(defaultOrder('group')).toBe('asc');
    expect(sortPieces(items, 'comfort', 'desc', catalogue.groups)[0]?.comfort).toBe(3);
    expect(sortPieces(items, 'comfort', 'asc', catalogue.groups)[0]?.comfort).toBe(1);
    expect(sortPieces(items, 'built', 'desc', catalogue.groups)[0]?.prefab).toBe('fire_pit');
    expect(sortPieces(items, 'name', 'desc', catalogue.groups)[0]?.name).toBe('Yule Wreath');
  });

  it('filters by text, group, fire and what was built', () => {
    expect(filterPieces(items, { ...noFilter, q: 'THRONE' })).toHaveLength(5);
    expect(filterPieces(items, { ...noFilter, q: 'piece_bed02' }).map((item) => item.name)).toEqual(
      ['Dragon Bed']
    );
    expect(
      filterPieces(items, { ...noFilter, lit: true })
        .map((item) => item.prefab)
        .sort()
    ).toEqual([
      'fire_pit',
      'fire_pit_iron',
      'hearth',
      'piece_bathtub',
      'piece_brazierceiling01',
      'piece_brazierfloor01'
    ]);
    expect(
      filterPieces(items, { ...noFilter, group: 'Fire', built: true }).map((item) => item.prefab)
    ).toEqual(['fire_pit']);
    expect(filterPieces(items, { ...noFilter, group: 'Nothing' })).toEqual([]);
  });

  it('marks the pieces that top their group and every ungrouped piece', () => {
    const top = topOfGroup(groupStandings(catalogue.groups, items), items);
    expect(top.has('hearth')).toBe(true);
    expect(top.has('fire_pit')).toBe(false);
    expect(top.has('piece_maypole')).toBe(true);
    const chairs = items.filter((item) => item.group === 'Chair' && top.has(item.prefab));
    expect(chairs).toHaveLength(5);
  });
});

describe('labels', () => {
  it('describes seasons, conditions, groups and build days', () => {
    const yule = catalogue.seasons.find((season) => season.name === 'Yule')!;
    expect(seasonWindow(yule)).toBe('Dec 1 – Jan 6');
    expect(conditionLabel('lit')).toBe('While lit');
    expect(conditionLabel('lit_dry')).toBe('While lit and dry');
    expect(conditionLabel(null)).toBeNull();
    expect(groupLabel('None')).toBe('No group');
    expect(groupLabel('Chair')).toBe('Chair');
    expect(formatBuiltDay('2026-09-09')).toBe('Sep 9, 2026');
    expect(formatBuiltDay('not a date')).toBe('not a date');
  });

  it('flags a catalogue read from another game version than the running one', () => {
    expect(isStale({ game_version: '1.0.12' }, '1.0.15')).toBe(true);
    expect(isStale({ game_version: '1.0.12' }, '1.0.12')).toBe(false);
    expect(isStale({ game_version: '1.0.12' }, null)).toBe(false);
  });
});
