<script lang="ts">
  import type { StructuresSeriesPoint } from '$lib/api/types';
  import { formatNumber } from './format';

  let { series }: { series: StructuresSeriesPoint[] } = $props();

  let width = $state(640);
  const height = 170;
  const padLeft = 34;
  const padRight = 8;
  const padTop = 8;
  const padBottom = 22;
  const plotWidth = $derived(width - padLeft - padRight);
  const plotHeight = height - padTop - padBottom;

  const ordered = $derived([...series].sort((a, b) => (a.date < b.date ? -1 : 1)));
  const peak = $derived(
    Math.max(1, ...ordered.map((point) => Math.max(point.built, point.destroyed)))
  );
  const slot = $derived(plotWidth / Math.max(1, ordered.length));
  const barWidth = $derived(Math.max(1, slot * 0.36));
  const totalBuilt = $derived(ordered.reduce((sum, point) => sum + point.built, 0));
  const totalDestroyed = $derived(ordered.reduce((sum, point) => sum + point.destroyed, 0));

  function yOf(value: number): number {
    return padTop + plotHeight - (value / peak) * plotHeight;
  }

  function labelFor(date: string): string {
    return date.slice(5);
  }

  const labelEvery = $derived(
    Math.max(1, Math.ceil(ordered.length / Math.max(2, Math.floor(width / 90))))
  );
</script>

{#if ordered.length === 0}
  <p class="note">No building activity in this window.</p>
{:else}
  <div bind:clientWidth={width}>
    <svg
      viewBox="0 0 {width} {height}"
      {height}
      class="block w-full font-sans text-ink-muted"
      role="img"
      aria-label="Pieces built and destroyed per day: {formatNumber(
        totalBuilt
      )} built and {formatNumber(totalDestroyed)} destroyed over {ordered.length} days"
    >
      {#each [0, Math.round(peak / 2), peak] as tick (tick)}
        <line
          x1={padLeft}
          x2={width - padRight}
          y1={yOf(tick)}
          y2={yOf(tick)}
          stroke="var(--color-line-strong)"
        />
        <text x={padLeft - 6} y={yOf(tick) + 3} text-anchor="end" font-size="10" fill="currentColor"
          >{formatNumber(tick)}</text
        >
      {/each}
      {#each ordered as point, index (point.date)}
        {@const x = padLeft + index * slot + slot / 2}
        <rect
          x={x - barWidth}
          y={yOf(point.built)}
          width={barWidth}
          height={plotHeight + padTop - yOf(point.built)}
          fill="var(--color-online)"
        >
          <title>{point.date}: {formatNumber(point.built)} built</title>
        </rect>
        <rect
          {x}
          y={yOf(point.destroyed)}
          width={barWidth}
          height={plotHeight + padTop - yOf(point.destroyed)}
          fill="var(--color-offline)"
        >
          <title>{point.date}: {formatNumber(point.destroyed)} destroyed</title>
        </rect>
        {#if index % labelEvery === 0}
          <text {x} y={height - 6} text-anchor="middle" font-size="10" fill="currentColor"
            >{labelFor(point.date)}</text
          >
        {/if}
      {/each}
    </svg>
  </div>
  <p class="mt-1.5 flex flex-wrap gap-x-4 text-[0.72rem] text-ink-muted">
    <span class="inline-flex items-center gap-1"
      ><span class="inline-block size-2.5 bg-online" aria-hidden="true"></span> Built</span
    >
    <span class="inline-flex items-center gap-1"
      ><span class="inline-block size-2.5 bg-offline" aria-hidden="true"></span> Destroyed</span
    >
    <span>Days in UTC</span>
  </p>
{/if}
