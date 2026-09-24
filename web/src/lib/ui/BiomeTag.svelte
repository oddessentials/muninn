<script lang="ts">
  import type { Biome } from '$lib/api/types';
  import { biomeColors, biomeLabel, isBiome } from './labels';

  let { biome }: { biome: Biome | string | null | undefined } = $props();
  const color = $derived(isBiome(biome) ? biomeColors[biome] : biomeColors.None);
</script>

<span class="inline-flex items-center gap-1.5 whitespace-nowrap">
  <span
    class="inline-block size-2.5 border border-black/40 shadow-[0_0_0_1px_rgba(255,255,255,0.12)]"
    style="background: {color}"
    aria-hidden="true"
  ></span>
  {biomeLabel(biome)}
</span>
