import data from './comfort-recipes.json';

export interface MaterialAmount {
  item: string;
  amount: number;
}

export interface Recipe {
  station: string | null;
  materials: MaterialAmount[];
  description: string;
}

export interface IconPosition {
  x: number;
  y: number;
}

export type StatusEffect = 'Resting' | 'Rested' | 'Shelter' | 'CampFire';

const pieces: Record<string, Recipe> = data.pieces;
const materials: Record<string, string> = data.materials;
const stations: Record<string, string> = data.stations;
const icons: Record<string, number> = data.icons;
const pitch = data.atlas.cell + 2 * data.atlas.gutter;

export const recipesVersion: string = data.game_version;

export const atlas = {
  cell: data.atlas.cell,
  width: data.atlas.columns * pitch,
  height: data.atlas.rows * pitch
};

function own<T>(record: Record<string, T>, key: string): T | undefined {
  return Object.hasOwn(record, key) ? record[key] : undefined;
}

export function recipeOf(prefab: string): Recipe | null {
  return own(pieces, prefab) ?? null;
}

export function materialName(item: string): string {
  return own(materials, item) ?? item;
}

export function stationName(station: string): string {
  return own(stations, station) ?? station;
}

export function pieceIcon(prefab: string): string {
  return `piece:${prefab}`;
}

export function materialIcon(item: string): string {
  return `item:${item}`;
}

export function stationIcon(station: string): string {
  return `station:${station}`;
}

export function statusIcon(effect: StatusEffect): string {
  return `status:${effect}`;
}

export function iconPosition(key: string): IconPosition | null {
  const index = own(icons, key);
  if (index === undefined) return null;
  return {
    x: (index % data.atlas.columns) * pitch + data.atlas.gutter,
    y: Math.floor(index / data.atlas.columns) * pitch + data.atlas.gutter
  };
}
