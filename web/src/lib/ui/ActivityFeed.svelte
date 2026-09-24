<script lang="ts">
  import type { ActivityItem } from '$lib/api/types';
  import ActivityLine from './ActivityLine.svelte';
  import EmptyState from './EmptyState.svelte';

  let {
    items,
    empty = 'Nothing has happened yet.',
    showDay = true,
    timeMode = 'relative',
    compact = false
  }: {
    items: ActivityItem[];
    empty?: string;
    showDay?: boolean;
    timeMode?: 'relative' | 'absolute';
    compact?: boolean;
  } = $props();
</script>

{#if items.length === 0}
  <EmptyState message={empty} />
{:else}
  <ul class="divide-y divide-line/60">
    {#each items as item (item.id)}
      <ActivityLine {item} {showDay} {timeMode} {compact} />
    {/each}
  </ul>
{/if}
