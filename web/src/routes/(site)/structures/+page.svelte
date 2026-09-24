<script lang="ts">
  import { page } from '$app/state';
  import BiomeTag from '$lib/ui/BiomeTag.svelte';
  import Card from '$lib/ui/Card.svelte';
  import EmptyState from '$lib/ui/EmptyState.svelte';
  import ErrorNote from '$lib/ui/ErrorNote.svelte';
  import { formatNumber, formatPosition } from '$lib/ui/format';
  import Meta from '$lib/ui/Meta.svelte';
  import PageHeader from '$lib/ui/PageHeader.svelte';
  import Pager from '$lib/ui/Pager.svelte';
  import PlayerLink from '$lib/ui/PlayerLink.svelte';
  import { withParams } from '$lib/ui/query';
  import SeriesChart from '$lib/ui/SeriesChart.svelte';
  import Stat from '$lib/ui/Stat.svelte';
  import Time from '$lib/ui/Time.svelte';

  let { data } = $props();

  const summary = $derived(data.structures.ok ? data.structures.data : null);
  const rangeLabel: Record<string, string> = { '7d': '7 days', '30d': '30 days', all: 'Whole log' };
</script>

<Meta title="Structures" description="Pieces built and destroyed over time, and who built them." />

<div class="flex flex-col gap-6">
  <PageHeader
    eyebrow="The build"
    note="Building pieces placed and destroyed, from the creator id the game stamps on every piece. Pieces that already stood when the log began are not counted as built, though their destruction is. Furniture the game places while it generates villages, camps and forts counts as generated with the world. Individual events are kept for 30 days; daily totals stay."
  >
    {#snippet heading()}Structures{/snippet}
  </PageHeader>

  <Card title="Built and destroyed" flush>
    {#snippet actions()}
      {#each ['7d', '30d', 'all'] as range (range)}
        <a
          href={withParams(page.url, { range, cursor: null })}
          class="seg"
          aria-current={data.range === range ? 'true' : undefined}>{rangeLabel[range]}</a
        >
      {/each}
    {/snippet}
    <div class="flex flex-col gap-5 p-5">
      {#if !summary}
        {#if !data.structures.ok}<ErrorNote
            error={data.structures.error}
            what="the building totals"
          />{/if}
      {:else}
        <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat
            label="Pieces built"
            value={formatNumber(summary.built_total)}
            detail={rangeLabel[data.range]}
          />
          <Stat
            label="Pieces destroyed"
            value={formatNumber(summary.destroyed_total)}
            detail={rangeLabel[data.range]}
          />
          <Stat
            label="Builders"
            value={formatNumber(summary.by_builder.filter((row) => row.player).length)}
          />
          <Stat label="Piece types" value={formatNumber(summary.by_prefab.length)} />
        </div>
        <SeriesChart series={summary.series} />
      {/if}
    </div>
  </Card>

  {#if summary}
    <div class="grid gap-6 lg:grid-cols-2">
      <Card title="By builder" flush>
        {#if summary.by_builder.length === 0}
          <EmptyState message="Nothing built in this window." />
        {:else}
          <table class="data-table">
            <thead><tr><th>Builder</th><th class="num">Pieces</th></tr></thead>
            <tbody>
              {#each summary.by_builder as row, index (index)}
                <tr>
                  <td>
                    {#if row.player}
                      <PlayerLink player={row.player} />
                    {:else if row.world}
                      <span class="text-ink-muted">Generated with the world</span>
                    {:else}
                      <span class="text-ink-muted">Unknown or hidden builder</span>
                    {/if}
                  </td>
                  <td class="num">{formatNumber(row.built)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </Card>
      <Card title="By piece" flush>
        {#if summary.by_prefab.length === 0}
          <EmptyState message="Nothing built in this window." />
        {:else}
          <table class="data-table">
            <thead><tr><th>Piece (game id)</th><th class="num">Built</th></tr></thead>
            <tbody>
              {#each summary.by_prefab as row (row.prefab)}
                <tr>
                  <td><code class="text-xs">{row.prefab}</code></td>
                  <td class="num">{formatNumber(row.built)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </Card>
    </div>
  {/if}

  <Card title="Recent pieces" description="Newest first, last 30 days." flush>
    {#if !data.recent.ok}
      <div class="p-4"><ErrorNote error={data.recent.error} what="the recent pieces" /></div>
    {:else if data.recent.data.items.length === 0}
      <EmptyState message="No piece has been placed or destroyed in the last 30 days." />
    {:else}
      <div class="overflow-x-auto">
        <table class="data-table">
          <thead>
            <tr
              ><th>When</th><th>What</th><th>Piece</th><th>Builder</th><th>Biome</th><th
                >Position</th
              ></tr
            >
          </thead>
          <tbody>
            {#each data.recent.data.items as event, index (index)}
              <tr>
                <td><Time at={event.at} /></td>
                <td class={event.kind === 'destroyed' ? 'text-offline' : ''}>{event.kind}</td>
                <td><code class="text-xs">{event.prefab}</code></td>
                <td>
                  {#if event.player}
                    <PlayerLink player={event.player} />
                  {:else}
                    <span class="text-ink-muted">{event.kind === 'destroyed' ? '' : 'unknown'}</span
                    >
                  {/if}
                </td>
                <td><BiomeTag biome={event.biome} /></td>
                <td class="whitespace-nowrap">{formatPosition(event.x, event.z)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <div class="px-3 pb-3">
        <Pager
          nextCursor={data.recent.data.next_cursor}
          count={data.recent.data.items.length}
          label="pieces"
        />
      </div>
    {/if}
  </Card>
</div>
