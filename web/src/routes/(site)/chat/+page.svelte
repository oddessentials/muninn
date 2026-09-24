<script lang="ts">
  import BiomeTag from '$lib/ui/BiomeTag.svelte';
  import Card from '$lib/ui/Card.svelte';
  import EmptyState from '$lib/ui/EmptyState.svelte';
  import ErrorNote from '$lib/ui/ErrorNote.svelte';
  import { formatNumber, formatPosition } from '$lib/ui/format';
  import type { MapMarker } from '$lib/ui/map';
  import Meta from '$lib/ui/Meta.svelte';
  import PageHeader from '$lib/ui/PageHeader.svelte';
  import Pager from '$lib/ui/Pager.svelte';
  import PlayerLink from '$lib/ui/PlayerLink.svelte';
  import { dateInputValue } from '$lib/ui/query';
  import Time from '$lib/ui/Time.svelte';
  import WorldMap from '$lib/ui/WorldMap.svelte';

  let { data } = $props();

  const messages = $derived(data.chat.ok ? data.chat.data.items : []);
  const markers = $derived<MapMarker[]>(
    messages.map((message) => ({
      x: message.x,
      z: message.z,
      label: `${message.player?.display_name ?? 'Someone'} ${message.kind === 'ping' ? 'pinged here' : `said: ${message.text ?? ''}`}`,
      kind: 'chat',
      href: message.player ? `/players/${message.player.id}` : undefined
    }))
  );
  const filtered = $derived(Boolean(data.kind || data.player || data.since || data.until));
</script>

<Meta title="Chat" description="Shouts, whispers and pings from the in-game chat." />

<div class="flex flex-col gap-6">
  <PageHeader
    eyebrow="Shouts and pings"
    note="Shouts and map pings the server relayed, with where they were made. Normal speech only reaches the server when a player is out of local range."
  >
    {#snippet heading()}Chat{/snippet}
    {#snippet aside()}
      <form method="get" class="flex flex-wrap items-end gap-2 text-[0.8125rem]">
        <label class="flex flex-col gap-1">
          <span class="label">Kind</span>
          <select name="kind" class="field">
            <option value="" selected={!data.kind}>All</option>
            <option value="shout" selected={data.kind === 'shout'}>Shouts</option>
            <option value="ping" selected={data.kind === 'ping'}>Pings</option>
            <option value="say" selected={data.kind === 'say'}>Speech</option>
          </select>
        </label>
        <label class="flex flex-col gap-1">
          <span class="label">Player</span>
          <select name="player" class="field">
            <option value="" selected={!data.player}>Anyone</option>
            {#each data.players as player (player.id)}
              <option value={player.id} selected={data.player === player.id}
                >{player.display_name}</option
              >
            {/each}
          </select>
        </label>
        <label class="flex flex-col gap-1">
          <span class="label">From</span>
          <input
            type="datetime-local"
            name="since"
            value={dateInputValue(data.since)}
            class="field"
          />
        </label>
        <label class="flex flex-col gap-1">
          <span class="label">Until</span>
          <input
            type="datetime-local"
            name="until"
            value={dateInputValue(data.until)}
            class="field"
          />
        </label>
        <button type="submit" class="btn">Filter</button>
        {#if filtered}
          <a href="/chat" class="seg">Clear</a>
        {/if}
      </form>
    {/snippet}
  </PageHeader>

  <div class="grid gap-6 lg:grid-cols-[3fr_2fr]">
    <Card flush>
      {#if !data.chat.ok}
        <div class="p-4"><ErrorNote error={data.chat.error} what="the chat log" /></div>
      {:else if messages.length === 0}
        <EmptyState
          message={filtered
            ? 'No messages match this filter.'
            : 'Nobody has shouted or pinged yet.'}
        />
      {:else}
        <ul class="divide-y divide-line/60 px-5">
          {#each messages as message (message.id)}
            <li class="flex flex-col gap-0.5 py-3 text-[0.8125rem]">
              <p>
                <PlayerLink player={message.player} />
                {#if message.kind === 'ping'}
                  <span class="text-ink-muted"
                    >pinged the map at {formatPosition(message.x, message.z)}</span
                  >
                {:else if message.kind === 'shout'}
                  <span class="text-ink-muted">shouted</span>
                  <q class="note text-[1.15rem] text-ink">{message.text ?? ''}</q>
                {:else}
                  <span class="text-ink-muted">said</span>
                  <q class="note text-[1.15rem] text-ink">{message.text ?? ''}</q>
                {/if}
              </p>
              <p class="flex flex-wrap gap-x-3 text-[0.72rem] text-ink-muted">
                <Time at={message.at} />
                <span>day {formatNumber(message.day)}</span>
                <BiomeTag biome={message.biome} />
                <span>at {formatPosition(message.x, message.z)}</span>
              </p>
            </li>
          {/each}
        </ul>
        <div class="px-3 pb-3">
          <Pager nextCursor={data.chat.data.next_cursor} count={messages.length} label="messages" />
        </div>
      {/if}
    </Card>
    <div class="self-start lg:sticky lg:top-6">
      <Card title="Where the messages were made">
        <WorldMap
          map={data.world.ok ? data.world.data.map : null}
          src={data.mapSrc}
          {markers}
          caption="Positions of the messages on this page"
        />
        {#if !data.world.ok}
          <div class="mt-2"><ErrorNote error={data.world.error} what="the world map" /></div>
        {/if}
      </Card>
    </div>
  </div>
</div>
