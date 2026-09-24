<script lang="ts">
  import type { PlayerRef } from '$lib/api/types';

  let { player, online = null }: { player: PlayerRef | null; online?: boolean | null } = $props();
</script>

{#if player}
  <a
    href="/players/{player.id}"
    class="font-semibold text-accent hover:text-accent-bright hover:underline"
  >
    {#if online !== null}
      <span
        class="mr-1.5 inline-block size-2 rounded-full align-middle {online
          ? 'bg-online shadow-[0_0_6px_var(--color-online)]'
          : 'bg-line-strong'}"
        aria-hidden="true"
      ></span>
    {/if}{player.display_name}</a
  >
{:else}
  <span
    class="text-ink-muted italic"
    title="This player is hidden or the message came from the server console">someone</span
  >
{/if}
