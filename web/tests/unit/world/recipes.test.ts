import { readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Comfort } from '$lib/api/types';
import data from '$lib/world/comfort-recipes.json';
import {
  atlas,
  iconPosition,
  materialIcon,
  materialName,
  pieceIcon,
  recipeOf,
  recipesVersion,
  stationIcon,
  stationName,
  statusIcon
} from '$lib/world/recipes';

const root = new URL('../../../', import.meta.url);
const fixture = JSON.parse(
  readFileSync(new URL('fixtures/api/comfort.json', root), 'utf8')
) as Comfort;
const items = fixture.catalogue!.items;
const atlasFile = new URL('src/lib/world/comfort-icons.webp', root);

describe('comfort recipes', () => {
  it('has a recipe and an icon for every piece in the catalogue', () => {
    for (const item of items) {
      expect(recipeOf(item.prefab), item.prefab).not.toBeNull();
      expect(iconPosition(pieceIcon(item.prefab)), item.prefab).not.toBeNull();
    }
  });

  it('names and draws every material and crafting station a recipe uses', () => {
    for (const item of items) {
      const recipe = recipeOf(item.prefab)!;
      expect(recipe.materials.length, item.prefab).toBeGreaterThan(0);
      for (const { item: material, amount } of recipe.materials) {
        expect(amount).toBeGreaterThan(0);
        expect(Object.hasOwn(data.materials, material), material).toBe(true);
        expect(materialName(material)).toMatch(/^[^$\s]/);
        expect(iconPosition(materialIcon(material)), material).not.toBeNull();
      }
      if (recipe.station) {
        expect(Object.hasOwn(data.stations, recipe.station), recipe.station).toBe(true);
        expect(stationName(recipe.station)).toMatch(/^[^$\s]/);
        expect(iconPosition(stationIcon(recipe.station)), recipe.station).not.toBeNull();
      }
    }
  });

  it('keeps the game values it was read from', () => {
    expect(recipesVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(recipeOf('piece_bed02')).toMatchObject({
      station: 'piece_workbench',
      materials: [
        { item: 'FineWood', amount: 40 },
        { item: 'DeerHide', amount: 7 },
        { item: 'WolfPelt', amount: 4 },
        { item: 'Feathers', amount: 10 },
        { item: 'IronNails', amount: 15 }
      ]
    });
    expect(recipeOf('fire_pit')?.station).toBeNull();
    expect(stationName('piece_stonecutter')).toBe('Stonecutter');
    expect(materialName('RoundLog')).toBe('Corewood');
  });

  it('draws the status effects the page explains', () => {
    for (const effect of ['Resting', 'Rested', 'Shelter', 'CampFire'] as const) {
      expect(iconPosition(statusIcon(effect)), effect).not.toBeNull();
    }
  });

  it('answers nothing for unknown or inherited names', () => {
    expect(recipeOf('constructor')).toBeNull();
    expect(recipeOf('toString')).toBeNull();
    expect(iconPosition('piece:nothing')).toBeNull();
    expect(materialName('hasOwnProperty')).toBe('hasOwnProperty');
  });
});

describe('the icon atlas', () => {
  const bytes = readFileSync(atlasFile);

  it('is a WebP whose canvas matches the recipe geometry', () => {
    expect(bytes.subarray(0, 4).toString('latin1')).toBe('RIFF');
    expect(bytes.subarray(8, 16).toString('latin1')).toBe('WEBPVP8X');
    expect(1 + bytes.readUIntLE(24, 3)).toBe(atlas.width);
    expect(1 + bytes.readUIntLE(27, 3)).toBe(atlas.height);
  });

  it('places every icon inside the canvas', () => {
    const keys = [
      ...items.map((item) => pieceIcon(item.prefab)),
      ...['Resting', 'Rested', 'Shelter', 'CampFire'].map((effect) => `status:${effect}`)
    ];
    for (const key of keys) {
      const position = iconPosition(key)!;
      expect(position.x + atlas.cell).toBeLessThanOrEqual(atlas.width);
      expect(position.y + atlas.cell).toBeLessThanOrEqual(atlas.height);
    }
  });

  it('stays under its size budget', () => {
    expect(statSync(atlasFile).size).toBeLessThan(200_000);
  });
});
