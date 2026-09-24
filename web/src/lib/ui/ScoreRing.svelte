<script lang="ts">
  import { onMount } from 'svelte';
  import type { ZoneRating } from '$lib/api/types';
  import { ratingColors } from './zone';

  let {
    score,
    rating,
    size = 128,
    label = 'Overall score'
  }: { score: number; rating: ZoneRating; size?: number; label?: string } = $props();

  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const clamped = $derived(Math.max(0, Math.min(100, score)));
  const target = $derived(circumference - (clamped / 100) * circumference);
  let drawn = $state(false);
  onMount(() => {
    const frame = requestAnimationFrame(() => {
      drawn = true;
    });
    return () => cancelAnimationFrame(frame);
  });
</script>

<div
  class="score-ring relative shrink-0"
  style="width: {size}px; height: {size}px; --ring-color: {ratingColors[rating]}"
  role="img"
  aria-label="{label}: {clamped} out of 100"
>
  <svg viewBox="0 0 120 120" class="block h-full w-full -rotate-90">
    <circle
      cx="60"
      cy="60"
      r={radius}
      fill="none"
      stroke="var(--color-line-strong)"
      stroke-width="4"
    />
    <circle
      cx="60"
      cy="60"
      r={radius + 8}
      fill="none"
      stroke="color-mix(in srgb, var(--ring-color) 22%, transparent)"
      stroke-width="1"
      stroke-dasharray="1 5"
    />
    <circle
      cx="60"
      cy="60"
      r={radius}
      fill="none"
      stroke="var(--ring-color)"
      stroke-width="4"
      stroke-linecap="butt"
      stroke-dasharray={circumference}
      stroke-dashoffset={drawn ? target : circumference}
      class="score-ring-arc"
    />
  </svg>
  <div class="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
    <span class="display leading-none text-ink" style="font-size: {size * 0.28}px">{clamped}</span>
    <span class="label" style="font-size: {Math.max(8, size * 0.075)}px">of 100</span>
  </div>
</div>
