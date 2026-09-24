<script lang="ts">
  import type { PlayerRef } from '$lib/api/types';
  import PlayerLink from './PlayerLink.svelte';

  let { players, empty = 'nobody' }: { players: (PlayerRef | null)[]; empty?: string } = $props();
</script>

{#if players.length === 0}
  <span class="text-ink-muted">{empty}</span>
{:else}
  {#each players as player, index (index)}<span>{index > 0 ? ', ' : ''}<PlayerLink {player} /></span
    >{/each}
{/if}
