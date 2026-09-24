<script lang="ts">
  import { page } from '$app/state';
  import type { ComfortCatalogue, ComfortPiece } from '$lib/api/types';
  import {
    conditionLabel,
    groupLabel,
    groupOrder,
    groupStandings,
    peakComfort,
    restedSeconds,
    topOfGroup,
    ungrouped
  } from '$lib/ui/comfort';
  import { formatDistance, formatDuration, formatNumber } from '$lib/ui/format';
  import GameIcon from '$lib/ui/GameIcon.svelte';
  import {
    changeCount,
    countOf,
    mostComfortPlan,
    planLimit,
    planMaterials,
    plannedPieces,
    planStations,
    serializePlan,
    totalPieces,
    withoutRecipe,
    type PlanEntry
  } from '$lib/ui/plan';
  import RecipeLine from '$lib/ui/RecipeLine.svelte';
  import {
    materialIcon,
    materialName,
    pieceIcon,
    recipeOf,
    recipesVersion,
    stationIcon,
    stationName,
    statusIcon
  } from '$lib/world/recipes';

  let {
    catalogue,
    plan,
    onchange
  }: {
    catalogue: ComfortCatalogue;
    plan: PlanEntry[];
    onchange: (next: PlanEntry[]) => void;
  } = $props();

  const items = $derived(catalogue.items);
  const byPrefab = $derived(new Map(items.map((item) => [item.prefab, item])));
  const best = $derived(topOfGroup(groupStandings(catalogue.groups, items), items));
  const palette = $derived(
    groupOrder(catalogue.groups, items).map((group) => {
      const pieces = items
        .filter((item) => item.group === group)
        .sort((a, b) => b.comfort - a.comfort || a.name.localeCompare(b.name, 'en'));
      return { group, pieces, top: Math.max(...pieces.map((piece) => piece.comfort)) };
    })
  );
  const suggestion = $derived(mostComfortPlan(catalogue.groups, items, recipeOf));
  const suggestedComfort = $derived(
    peakComfort(catalogue.groups, plannedPieces(suggestion, items), true)
  );

  let inspected = $state<string | null>(null);
  let active = $state<string | null>(null);
  let announcement = $state('');
  let copied = $state(false);
  let cleared = $state<PlanEntry[] | null>(null);

  const reachable = $derived(
    active && byPrefab.has(active) ? active : (palette[0]?.pieces[0]?.prefab ?? null)
  );
  const shown = $derived(inspected ? (byPrefab.get(inspected) ?? null) : null);
  const shownRecipe = $derived(shown ? recipeOf(shown.prefab) : null);
  const pieces = $derived(totalPieces(plan));
  const materials = $derived(planMaterials(plan, recipeOf));
  const stations = $derived(planStations(plan, recipeOf));
  const unknown = $derived(
    withoutRecipe(plan, recipeOf).map((prefab) => byPrefab.get(prefab)?.name ?? prefab)
  );
  const planned = $derived(plannedPieces(plan, items));
  const comfort = $derived(peakComfort(catalogue.groups, planned, true));
  const needsFire = $derived(planned.some((piece) => piece.condition !== null));
  const reach = $derived(catalogue.radius_m ? formatDistance(catalogue.radius_m) : 'reach');

  $effect(() => {
    if (!copied) return;
    const timer = setTimeout(() => (copied = false), 2000);
    return () => clearTimeout(timer);
  });

  function nameOf(prefab: string): string {
    return byPrefab.get(prefab)?.name ?? prefab;
  }

  function slotLabel(piece: ComfortPiece, count: number): string {
    const parts = [`Add ${piece.name}`];
    if (best.has(piece.prefab)) parts.push('best of its group');
    if (count > 0) parts.push(`${formatNumber(count)} planned`);
    return parts.join(', ');
  }

  function below(slots: HTMLElement[], from: HTMLElement, direction: 1 | -1): HTMLElement | null {
    const origin = from.getBoundingClientRect();
    const centre = origin.left + origin.width / 2;
    let found: HTMLElement | null = null;
    let nearestRow = Infinity;
    let nearestColumn = Infinity;
    for (const slot of slots) {
      const rect = slot.getBoundingClientRect();
      const row = direction > 0 ? rect.top - origin.bottom : origin.top - rect.bottom;
      if (row < 0) continue;
      const column = Math.abs(rect.left + rect.width / 2 - centre);
      if (row < nearestRow - 1 || (Math.abs(row - nearestRow) <= 1 && column < nearestColumn)) {
        found = slot;
        nearestRow = row;
        nearestColumn = column;
      }
    }
    return found;
  }

  function navigate(event: KeyboardEvent): void {
    const from = event.currentTarget as HTMLElement;
    const slots = [
      ...(from.closest('[data-palette]')?.querySelectorAll<HTMLElement>('[data-slot]') ?? [])
    ];
    const index = slots.indexOf(from);
    const targets: Record<string, () => HTMLElement | null | undefined> = {
      ArrowRight: () => slots[index + 1],
      ArrowLeft: () => slots[index - 1],
      ArrowDown: () => below(slots, from, 1),
      ArrowUp: () => below(slots, from, -1),
      Home: () => slots[0],
      End: () => slots.at(-1)
    };
    const target = Object.hasOwn(targets, event.key) ? targets[event.key] : undefined;
    if (!target) return;
    event.preventDefault();
    target()?.focus();
  }

  function add(piece: ComfortPiece): void {
    inspected = piece.prefab;
    cleared = null;
    const next = changeCount(plan, piece.prefab, 1);
    onchange(next);
    announcement = `${piece.name} added, ${formatNumber(countOf(next, piece.prefab))} planned.`;
  }

  function step(prefab: string, delta: number): void {
    const next = changeCount(plan, prefab, delta);
    onchange(next);
    const count = countOf(next, prefab);
    announcement =
      count > 0
        ? `${nameOf(prefab)}: ${formatNumber(count)} planned.`
        : `${nameOf(prefab)} removed from the plan.`;
  }

  function suggest(): void {
    cleared = null;
    onchange(suggestion);
    announcement = `Planned one best piece from each group, comfort ${formatNumber(suggestedComfort)}.`;
  }

  function clear(): void {
    cleared = plan;
    onchange([]);
    announcement = 'Plan cleared.';
  }

  function undo(): void {
    if (cleared) onchange(cleared);
    cleared = null;
    announcement = 'Plan restored.';
  }

  async function copyLink(): Promise<void> {
    const query = new URLSearchParams({ plan: serializePlan(plan) });
    try {
      await navigator.clipboard.writeText(`${page.url.origin}/comfort?${query}#planner`);
      copied = true;
      announcement = 'Link to this plan copied.';
    } catch {
      announcement = 'Copying failed. The address bar holds the same link.';
    }
  }
</script>

<div class="grid gap-6 lg:grid-cols-12 lg:gap-8">
  <div class="flex min-w-0 flex-col gap-4 lg:col-span-7">
    <div class="planner-inspector" aria-hidden="true">
      {#if shown}
        <span class="slot h-16 w-16"><GameIcon icon={pieceIcon(shown.prefab)} size={56} /></span>
        <div class="flex min-w-0 flex-col gap-1">
          <div class="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <span class="display text-[0.95rem] tracking-wide text-ink">{shown.name}</span>
            <span class="text-[0.72rem] whitespace-nowrap text-ink-muted"
              >{groupLabel(shown.group)}
              <span class="font-semibold text-accent">+{formatNumber(shown.comfort)}</span></span
            >
            {#if shown.condition}
              <span class="text-[0.72rem] whitespace-nowrap text-ember"
                >{conditionLabel(shown.condition)?.toLowerCase()}</span
              >
            {/if}
            {#if shown.season}
              <span class="text-[0.72rem] whitespace-nowrap text-info">{shown.season} only</span>
            {/if}
          </div>
          {#if shownRecipe?.description}
            <p class="note line-clamp-2 text-[1.05rem] leading-snug">{shownRecipe.description}</p>
          {/if}
          {#if shownRecipe}
            <RecipeLine recipe={shownRecipe} station />
          {/if}
        </div>
      {:else}
        <span class="slot h-16 w-16"><GameIcon icon={statusIcon('Resting')} size={48} /></span>
        <p class="note">
          <span class="[@media(pointer:fine)]:hidden"
            >Tap a piece to add it to the plan and see what it costs.</span
          >
          <span class="hidden [@media(pointer:fine)]:inline"
            >Point at a piece to see what it costs. Click it to add it to the plan.</span
          >
        </p>
      {/if}
    </div>

    <div class="flex flex-col gap-3" data-palette>
      {#each palette as row (row.group)}
        <div class="grid gap-x-4 gap-y-1.5 sm:grid-cols-[6.5rem_minmax(0,1fr)]">
          <div class="flex items-baseline gap-2 sm:flex-col sm:gap-0 sm:pt-2">
            <span class="display text-[0.8rem] tracking-wider text-ink"
              >{groupLabel(row.group)}</span
            >
            <span class="text-[0.68rem] text-ink-faint">
              {row.group === ungrouped ? 'each adds' : `up to +${formatNumber(row.top)}`}
            </span>
          </div>
          <ul class="flex flex-wrap gap-1.5" aria-label={groupLabel(row.group)}>
            {#each row.pieces as piece (piece.prefab)}
              {@const count = countOf(plan, piece.prefab)}
              <li>
                <button
                  type="button"
                  class="slot slot-button"
                  data-slot
                  data-selected={count > 0 || undefined}
                  aria-label={slotLabel(piece, count)}
                  tabindex={piece.prefab === reachable ? 0 : -1}
                  onclick={() => add(piece)}
                  onkeydown={navigate}
                  onpointerenter={() => (inspected = piece.prefab)}
                  onfocus={() => {
                    active = piece.prefab;
                    inspected = piece.prefab;
                  }}
                >
                  <GameIcon icon={pieceIcon(piece.prefab)} size={40} />
                  {#if best.has(piece.prefab)}
                    <span class="slot-mark" aria-hidden="true"></span>
                  {/if}
                  {#if count > 0}
                    {#key count}
                      <span class="slot-count" aria-hidden="true">{formatNumber(count)}</span>
                    {/key}
                  {/if}
                </button>
              </li>
            {/each}
          </ul>
        </div>
      {/each}
    </div>

    {#if plan.length > 0}
      <a href="#plan" class="plan-bar glass lg:hidden">
        <span class="text-ink"
          >{formatNumber(pieces)}
          {pieces === 1 ? 'piece' : 'pieces'}</span
        >
        <span class="text-ink-muted"
          >{formatNumber(materials.length)}
          {materials.length === 1 ? 'material' : 'materials'}</span
        >
        <span class="label ml-auto text-accent">See the plan</span>
      </a>
    {/if}
  </div>

  <aside id="plan" class="plan-panel lg:col-span-5" aria-labelledby="plan-title">
    <header class="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-3">
      <h3 id="plan-title" class="text-[0.95rem] tracking-wider text-ink">Your plan</h3>
      {#if pieces > 0}
        <span class="text-[0.72rem] text-ink-muted"
          >{formatNumber(pieces)} {pieces === 1 ? 'piece' : 'pieces'}</span
        >
        <div class="ml-auto flex gap-2">
          <button type="button" class="btn" onclick={copyLink}>
            {copied ? 'Link copied' : 'Copy link'}
          </button>
          <button type="button" class="btn" onclick={clear}>Clear</button>
        </div>
      {/if}
    </header>

    {#if plan.length === 0}
      <div class="flex flex-col items-start gap-3 px-4 py-5">
        {#if cleared}
          <p class="text-[0.8125rem] text-ink-muted">Plan cleared.</p>
          <button type="button" class="btn" onclick={undo}>Undo</button>
        {:else}
          <p class="text-[0.8125rem] leading-relaxed text-ink-muted">
            Pick pieces from the build menu and every material they take adds up here.
          </p>
        {/if}
        <button type="button" class="btn btn-primary" onclick={suggest}
          >Plan the most comfort</button
        >
        <p class="text-[0.72rem] leading-relaxed text-ink-faint">
          One best piece from each group, comfort {formatNumber(suggestedComfort)} and Rested for {formatDuration(
            restedSeconds(catalogue, suggestedComfort)
          )}.
        </p>
      </div>
    {:else}
      <div class="flex flex-wrap gap-x-4 gap-y-2 border-b border-line px-4 py-3">
        <div class="flex min-w-[8.5rem] flex-1 items-center gap-2.5">
          <GameIcon icon={statusIcon('Resting')} size={32} />
          <div class="flex flex-col">
            <span class="stat-label">Comfort</span>
            <span class="stat-value">{formatNumber(comfort)}</span>
          </div>
        </div>
        <div class="flex min-w-[8.5rem] flex-1 items-center gap-2.5">
          <GameIcon icon={statusIcon('Rested')} size={32} />
          <div class="flex flex-col">
            <span class="stat-label">Rested</span>
            <span class="stat-value whitespace-nowrap"
              >{formatDuration(restedSeconds(catalogue, comfort))}</span
            >
          </div>
        </div>
        <p class="w-full text-[0.72rem] leading-relaxed text-ink-muted">
          Resting under a roof with all of it within {reach}{needsFire ? ' and the fires lit' : ''}.
        </p>
      </div>

      <section class="px-4 py-3" aria-labelledby="plan-materials">
        <h4 id="plan-materials" class="label mb-2">Materials</h4>
        {#if materials.length > 0}
          <ul class="grid gap-x-5 gap-y-1 sm:grid-cols-2">
            {#each materials as material (material.item)}
              <li class="flex min-w-0 items-center gap-2.5 py-0.5">
                <GameIcon icon={materialIcon(material.item)} size={28} />
                <span class="min-w-0 flex-1 text-[0.8125rem] leading-tight text-ink"
                  >{materialName(material.item)}</span
                >
                <span class="text-[0.8125rem] font-semibold text-accent"
                  >{formatNumber(material.amount)}</span
                >
              </li>
            {/each}
          </ul>
        {/if}
        {#if unknown.length > 0}
          <p class="mt-2 text-[0.72rem] text-warning">
            This site has no recipe for {unknown.join(', ')} yet.
          </p>
        {/if}
      </section>

      <section class="border-t border-line px-4 py-3" aria-labelledby="plan-stations">
        <h4 id="plan-stations" class="label mb-2">Crafting stations</h4>
        {#if stations.length > 0}
          <ul class="flex flex-wrap gap-x-5 gap-y-2">
            {#each stations as need (need.station)}
              <li class="flex items-center gap-2 text-[0.8125rem] text-ink">
                <GameIcon icon={stationIcon(need.station)} size={28} />
                {stationName(need.station)}
              </li>
            {/each}
          </ul>
        {:else}
          <p class="text-[0.8125rem] text-ink-muted">None needed.</p>
        {/if}
      </section>

      <section class="border-t border-line px-4 py-3" aria-labelledby="plan-pieces">
        <h4 id="plan-pieces" class="label mb-1">Pieces</h4>
        <ul class="flex flex-col">
          {#each plan as entry (entry.prefab)}
            <li class="flex items-center gap-3 py-1">
              <span class="slot h-9 w-9"><GameIcon icon={pieceIcon(entry.prefab)} size={30} /></span
              >
              <span class="min-w-0 flex-1 text-[0.8125rem] leading-tight text-ink"
                >{nameOf(entry.prefab)}</span
              >
              <span class="stepper">
                <button
                  type="button"
                  aria-label="One fewer {nameOf(entry.prefab)}"
                  onclick={() => step(entry.prefab, -1)}>−</button
                >
                <span class="stepper-count">{formatNumber(entry.count)}</span>
                <button
                  type="button"
                  aria-label="One more {nameOf(entry.prefab)}"
                  disabled={entry.count >= planLimit}
                  onclick={() => step(entry.prefab, 1)}>+</button
                >
              </span>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    <p class="border-t border-line px-4 py-2.5 text-[0.68rem] text-ink-faint">
      Recipes and icons from game version {recipesVersion}.
    </p>
  </aside>
</div>

<p class="sr-only" role="status">{announcement}</p>
