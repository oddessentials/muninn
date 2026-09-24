<script lang="ts">
  import { page } from '$app/state';
  import BiomeTag from '$lib/ui/BiomeTag.svelte';
  import Card from '$lib/ui/Card.svelte';
  import EmptyState from '$lib/ui/EmptyState.svelte';
  import ErrorNote from '$lib/ui/ErrorNote.svelte';
  import { formatDistance, formatHours, formatNumber, formatPerHour } from '$lib/ui/format';
  import Meta from '$lib/ui/Meta.svelte';
  import PageHeader from '$lib/ui/PageHeader.svelte';
  import Pager from '$lib/ui/Pager.svelte';
  import PlatformTag from '$lib/ui/PlatformTag.svelte';
  import PlayerLink from '$lib/ui/PlayerLink.svelte';
  import { withParams } from '$lib/ui/query';
  import Time from '$lib/ui/Time.svelte';

  let { data } = $props();

  const columns: { key: string; label: string; sort?: string; numeric?: boolean }[] = [
    { key: 'name', label: 'Player', sort: 'name' },
    { key: 'playtime', label: 'Playtime', sort: 'playtime', numeric: true },
    { key: 'sessions', label: 'Sessions', numeric: true },
    { key: 'deaths', label: 'Deaths', sort: 'deaths', numeric: true },
    { key: 'dph', label: 'DPH', numeric: true },
    { key: 'kills', label: 'Kills', sort: 'kills', numeric: true },
    { key: 'bosses', label: 'Boss kills', numeric: true },
    { key: 'built', label: 'Built', numeric: true },
    { key: 'distance', label: 'Travelled', numeric: true },
    { key: 'first_seen', label: 'First seen', sort: 'first_seen' },
    { key: 'last_seen', label: 'Last seen', sort: 'last_seen' }
  ];

  function sortHref(sort: string): string {
    const flipped = data.sort === sort && data.order === 'desc' ? 'asc' : 'desc';
    const order = data.sort === sort ? flipped : sort === 'name' ? 'asc' : 'desc';
    return withParams(page.url, { sort, order, cursor: null });
  }

  const items = $derived(data.players.ok ? data.players.data.items : []);
</script>

<Meta
  title="Players"
  description="Every player seen on the server, with playtime, deaths, kills and who is online right now."
/>

<div class="flex flex-col gap-6">
  <PageHeader
    eyebrow="The roster"
    note="Everyone who has joined the server since the log began, keyed by platform account. Kills count credited hits plus creatures that died nearby. DPH is deaths per hour played."
  >
    {#snippet heading()}Players{/snippet}
    {#snippet aside()}
      <form method="get" class="flex flex-wrap items-center gap-3 text-[0.8125rem]">
        <input type="hidden" name="sort" value={data.sort} />
        <input type="hidden" name="order" value={data.order} />
        <label class="flex items-center gap-2">
          <span class="sr-only">Search players</span>
          <input
            type="search"
            name="q"
            value={data.q}
            placeholder="Name, character or id"
            class="field w-56"
          />
        </label>
        <label class="label flex items-center gap-2 whitespace-nowrap text-ink">
          <input type="checkbox" name="online" value="true" checked={data.online} />
          Online now
        </label>
        <button type="submit" class="btn">Filter</button>
        {#if data.q || data.online}
          <a href="/players" class="seg">Clear</a>
        {/if}
      </form>
    {/snippet}
  </PageHeader>

  <Card flush>
    {#if !data.players.ok}
      <div class="p-4"><ErrorNote error={data.players.error} what="the player list" /></div>
    {:else if items.length === 0}
      <EmptyState
        message={data.q || data.online
          ? 'No players match this filter.'
          : 'Nobody has joined the server yet.'}
      />
    {:else}
      <div class="overflow-x-auto">
        <table class="data-table">
          <thead>
            <tr>
              {#each columns as column (column.key)}
                <th
                  class={column.numeric ? 'num' : ''}
                  aria-sort={data.sort === column.sort
                    ? data.order === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : undefined}
                >
                  {#if column.sort}
                    <a href={sortHref(column.sort)} class="hover:text-accent hover:underline">
                      {column.label}{data.sort === column.sort
                        ? data.order === 'asc'
                          ? ' ↑'
                          : ' ↓'
                        : ''}
                    </a>
                  {:else}
                    {column.label}
                  {/if}
                </th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each items as player (player.id)}
              <tr>
                <td>
                  <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <PlayerLink
                      player={{
                        id: player.id,
                        display_name: player.display_name,
                        platform: player.platform
                      }}
                      online={player.online}
                    />
                    <PlatformTag platform={player.platform} />
                    {#if player.online && player.current_biome}
                      <span class="text-[0.72rem] text-ink-muted"
                        ><BiomeTag biome={player.current_biome} /></span
                      >
                    {/if}
                  </div>
                  {#if player.characters.length > 1 || player.characters[0] !== player.display_name}
                    <div class="text-[0.72rem] text-ink-muted">
                      {player.characters.length === 0
                        ? 'No character yet'
                        : `as ${player.characters.join(', ')}`}
                    </div>
                  {/if}
                </td>
                <td class="num">{formatHours(player.playtime_s)}</td>
                <td class="num">{formatNumber(player.sessions)}</td>
                <td class="num">{formatNumber(player.deaths)}</td>
                <td class="num">{formatPerHour(player.deaths, player.playtime_s)}</td>
                <td class="num">{formatNumber(player.kills)}</td>
                <td class="num">{formatNumber(player.boss_kills)}</td>
                <td class="num">{formatNumber(player.structures_built)}</td>
                <td class="num">{formatDistance(player.distance_m)}</td>
                <td><Time at={player.first_seen} mode="date" /></td>
                <td><Time at={player.last_seen} mode="relative" /></td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <div class="px-3 pb-3">
        <Pager nextCursor={data.players.data.next_cursor} count={items.length} label="players" />
      </div>
    {/if}
  </Card>
</div>
