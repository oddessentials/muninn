<script lang="ts">
  import ActivityFeed from '$lib/ui/ActivityFeed.svelte';
  import BiomeTag from '$lib/ui/BiomeTag.svelte';
  import { mergeActivity } from '$lib/ui/feed';
  import { digestActivityTypes } from '$lib/ui/labels';
  import { useLive } from '$lib/ui/live.svelte';
  import Meta from '$lib/ui/Meta.svelte';
  import SunDial from '$lib/ui/SunDial.svelte';

  let { data } = $props();
  const live = useLive();

  const status = $derived(live.status ?? data.status);
  const online = $derived(live.online?.items ?? (data.online.ok ? data.online.data.items : []));
  const activity = $derived(
    mergeActivity(
      live.activity,
      data.activity.ok ? data.activity.data.items : [],
      data.feedLength,
      (item) => digestActivityTypes.includes(item.type)
    )
  );

  function openElsewhere(event: MouseEvent): void {
    const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!(anchor instanceof HTMLAnchorElement)) return;
    event.preventDefault();
    window.open(anchor.href, '_blank', 'noopener');
  }
</script>

<Meta
  title="Watch"
  description="The sun clock, who is on and the latest events, sized for a corner of the screen."
/>

<svelte:document onclickcapture={openElsewhere} />

<main
  class="widget mx-auto flex w-full max-w-sm flex-col gap-3 px-4 pt-2 pb-2"
  data-sveltekit-preload-data="off"
>
  <h1 class="sr-only">Watch</h1>
  {#if status}
    <p class="ticker flex flex-wrap items-center gap-x-3 gap-y-1">
      <span class="flex items-center gap-2 {status.online ? 'text-online' : 'text-offline'}">
        <span class="lamp" aria-hidden="true"></span>
        {status.online ? 'Online' : 'Offline'}
      </span>
      <span>{status.player_count} of {status.max_players}</span>
      {#if !status.telemetry.live}
        <span class="text-warning">telemetry {status.source === 'none' ? 'lost' : 'delayed'}</span>
      {/if}
      {#if live.stream === 'reconnecting'}
        <span class="ml-auto text-warning">reconnecting</span>
      {/if}
    </p>
  {:else}
    <p class="ticker text-warning">Status unavailable</p>
  {/if}
  <div class="flex justify-center">
    <SunDial {status} />
  </div>
  {#if online.length > 0}
    <ul class="flex flex-wrap gap-x-4 gap-y-1 text-[0.8125rem]" aria-label="Online now">
      {#each online as player (player.player_id)}
        <li class="flex items-center gap-2">
          <span class="font-semibold text-ink">{player.display_name}</span>
          <span class="text-[0.72rem] text-ink-muted"><BiomeTag biome={player.biome} /></span>
        </li>
      {/each}
    </ul>
  {/if}
  <ActivityFeed items={activity} compact empty="Nothing has happened yet." />
</main>
