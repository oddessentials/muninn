<script lang="ts">
  import { formatNumber } from '$lib/ui/format';
  import GameIcon from '$lib/ui/GameIcon.svelte';
  import {
    materialIcon,
    materialName,
    stationIcon,
    stationName,
    type Recipe
  } from '$lib/world/recipes';

  let {
    recipe,
    size = 22,
    station = false
  }: { recipe: Recipe; size?: number; station?: boolean } = $props();
</script>

<span class="recipe">
  {#if station && recipe.station}
    <span class="recipe-station">
      <GameIcon icon={stationIcon(recipe.station)} {size} />
      {stationName(recipe.station)}<span class="sr-only">:</span>
    </span>
  {/if}
  {#each recipe.materials as material (material.item)}
    <span class="recipe-part" title={materialName(material.item)}>
      <GameIcon icon={materialIcon(material.item)} {size} />
      <span class="recipe-amount">{formatNumber(material.amount)}</span>
      <span class="sr-only">{materialName(material.item)}</span>
    </span>
  {/each}
</span>

<style>
  .recipe {
    position: relative;
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.3rem 0.65rem;
  }

  .recipe-station {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding-right: 0.65rem;
    border-right: 1px solid var(--color-line-strong);
    font-size: 0.72rem;
    white-space: nowrap;
    color: var(--color-ink-muted);
  }

  .recipe-part {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    white-space: nowrap;
  }

  .recipe-amount {
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--color-ink);
  }
</style>
