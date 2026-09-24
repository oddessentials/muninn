import type { ComfortPiece } from '$lib/api/types';
import { groupStandings } from '$lib/ui/comfort';
import type { MaterialAmount, Recipe } from '$lib/world/recipes';

export interface PlanEntry {
  prefab: string;
  count: number;
}

export interface StationNeed {
  station: string;
  pieces: number;
}

export type RecipeLookup = (prefab: string) => Recipe | null;

export const planLimit = 999;
export const planStorageKey = 'comfort-plan';

export function rememberPlan(text: string): void {
  try {
    if (text) localStorage.setItem(planStorageKey, text);
    else localStorage.removeItem(planStorageKey);
  } catch {
    return;
  }
}

export function rememberedPlan(): string | null {
  try {
    return localStorage.getItem(planStorageKey);
  } catch {
    return null;
  }
}

export function parsePlan(
  text: string | null | undefined,
  known: ReadonlySet<string>
): PlanEntry[] {
  if (!text) return [];
  const counts = new Map<string, number>();
  for (const part of text.split('.')) {
    const [prefab = '', amount, ...rest] = part.split('*');
    if (rest.length > 0 || !known.has(prefab)) continue;
    const count = amount === undefined ? 1 : Number(amount);
    if (!Number.isSafeInteger(count) || count < 1) continue;
    counts.set(prefab, Math.min(planLimit, (counts.get(prefab) ?? 0) + count));
  }
  return [...counts].map(([prefab, count]) => ({ prefab, count }));
}

export function serializePlan(plan: readonly PlanEntry[]): string {
  return plan.map(({ prefab, count }) => (count === 1 ? prefab : `${prefab}*${count}`)).join('.');
}

export function countOf(plan: readonly PlanEntry[], prefab: string): number {
  return plan.find((entry) => entry.prefab === prefab)?.count ?? 0;
}

export function changeCount(
  plan: readonly PlanEntry[],
  prefab: string,
  delta: number
): PlanEntry[] {
  const count = Math.min(planLimit, countOf(plan, prefab) + delta);
  if (count <= 0) return plan.filter((entry) => entry.prefab !== prefab);
  if (plan.some((entry) => entry.prefab === prefab))
    return plan.map((entry) => (entry.prefab === prefab ? { prefab, count } : entry));
  return [...plan, { prefab, count }];
}

export function totalPieces(plan: readonly PlanEntry[]): number {
  return plan.reduce((sum, entry) => sum + entry.count, 0);
}

export function planMaterials(
  plan: readonly PlanEntry[],
  recipeOf: RecipeLookup
): MaterialAmount[] {
  const totals = new Map<string, number>();
  for (const { prefab, count } of plan) {
    for (const { item, amount } of recipeOf(prefab)?.materials ?? []) {
      totals.set(item, (totals.get(item) ?? 0) + amount * count);
    }
  }
  return [...totals]
    .map(([item, amount]) => ({ item, amount }))
    .sort((a, b) => b.amount - a.amount || a.item.localeCompare(b.item, 'en'));
}

export function planStations(plan: readonly PlanEntry[], recipeOf: RecipeLookup): StationNeed[] {
  const needs = new Map<string, number>();
  for (const { prefab, count } of plan) {
    const station = recipeOf(prefab)?.station;
    if (station) needs.set(station, (needs.get(station) ?? 0) + count);
  }
  return [...needs]
    .map(([station, pieces]) => ({ station, pieces }))
    .sort((a, b) => b.pieces - a.pieces || a.station.localeCompare(b.station, 'en'));
}

export function withoutRecipe(plan: readonly PlanEntry[], recipeOf: RecipeLookup): string[] {
  return plan.filter((entry) => recipeOf(entry.prefab) === null).map((entry) => entry.prefab);
}

export function plannedPieces(
  plan: readonly PlanEntry[],
  items: readonly ComfortPiece[]
): ComfortPiece[] {
  const planned = new Set(plan.map((entry) => entry.prefab));
  return items.filter((item) => planned.has(item.prefab));
}

function materialCount(recipe: Recipe | null): number {
  return recipe ? recipe.materials.reduce((sum, material) => sum + material.amount, 0) : Infinity;
}

export function mostComfortPlan(
  groups: readonly string[],
  items: readonly ComfortPiece[],
  recipeOf: RecipeLookup
): PlanEntry[] {
  const year = items.filter((item) => item.season === null);
  const easiest = (a: ComfortPiece, b: ComfortPiece) =>
    b.built - a.built ||
    materialCount(recipeOf(a.prefab)) - materialCount(recipeOf(b.prefab)) ||
    a.name.localeCompare(b.name, 'en');
  return groupStandings(groups, year).flatMap((standing) => {
    const members = year.filter((item) => item.group === standing.group);
    if (standing.stacks) {
      const byToken = new Map<string, ComfortPiece>();
      for (const piece of members.sort((a, b) => b.comfort - a.comfort || easiest(a, b)))
        if (!byToken.has(piece.token)) byToken.set(piece.token, piece);
      return [...byToken.values()].map((piece) => ({ prefab: piece.prefab, count: 1 }));
    }
    const [choice] = members.filter((item) => item.comfort === standing.adds).sort(easiest);
    return choice ? [{ prefab: choice.prefab, count: 1 }] : [];
  });
}
