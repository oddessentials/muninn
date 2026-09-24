<script lang="ts">
  import BiomeTag from '$lib/ui/BiomeTag.svelte';
  import Card from '$lib/ui/Card.svelte';
  import EmptyState from '$lib/ui/EmptyState.svelte';
  import ErrorNote from '$lib/ui/ErrorNote.svelte';
  import { formatDuration, formatNumber, formatPosition } from '$lib/ui/format';
  import { raidEndNote, raidLength, raidStanding, raidStartNote } from '$lib/ui/raids';
  import Meta from '$lib/ui/Meta.svelte';
  import PageHeader from '$lib/ui/PageHeader.svelte';
  import Pager from '$lib/ui/Pager.svelte';
  import PlayerNames from '$lib/ui/PlayerNames.svelte';
  import { dateInputValue } from '$lib/ui/query';
  import Time from '$lib/ui/Time.svelte';

  let { data } = $props();

  const raids = $derived(data.raids.ok ? data.raids.data.items : []);
</script>

<Meta title="Raids" description="Raids that hit the server and who lived through them." />

<div class="flex flex-col gap-6">
  <PageHeader
    eyebrow="Random events"
    note="The game's random events. Participants were near the centre when the raid began; deaths count everyone who died anywhere while it ran."
  >
    {#snippet heading()}Raids{/snippet}
    {#snippet aside()}
      <form method="get" class="flex flex-wrap items-end gap-2 text-[0.8125rem]">
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
        {#if data.since || data.until}
          <a href="/raids" class="seg">Clear</a>
        {/if}
      </form>
    {/snippet}
  </PageHeader>

  <Card flush>
    {#if !data.raids.ok}
      <div class="p-4"><ErrorNote error={data.raids.error} what="the raid list" /></div>
    {:else if raids.length === 0}
      <EmptyState
        message={data.since || data.until
          ? 'No raids in this window.'
          : 'No raids have hit the guild yet.'}
      />
    {:else}
      <div class="overflow-x-auto">
        <table class="data-table">
          <thead>
            <tr>
              <th>Raid</th>
              <th>Started</th>
              <th class="num">Day</th>
              <th>Biome</th>
              <th>Centre</th>
              <th class="num">Lasted</th>
              <th>Nearby</th>
              <th class="num">Deaths</th>
            </tr>
          </thead>
          <tbody>
            {#each raids as raid (raid.id)}
              <tr>
                <td>
                  <a
                    href="/raids/{raid.id}"
                    class="font-semibold text-accent hover:text-accent-bright hover:underline"
                    >{raid.label}</a
                  >
                  <div class="text-[0.72rem] text-ink-muted">
                    <code>{raid.name}</code>
                  </div>
                </td>
                <td>
                  <Time at={raid.started_at} />
                  {#if raidStartNote(raid)}
                    <div class="text-[0.72rem] text-ink-muted">{raidStartNote(raid)}</div>
                  {/if}
                </td>
                <td class="num">{formatNumber(raid.day)}</td>
                <td><BiomeTag biome={raid.biome} /></td>
                <td class="whitespace-nowrap">{formatPosition(raid.x, raid.z)}</td>
                <td class="num">
                  {#if raidStanding(raid) === 'running'}
                    <span class="text-warning">running</span>
                  {:else if raidStanding(raid) === 'cut short'}
                    cut short
                  {:else}
                    {raidLength(raid)}
                  {/if}
                  <div class="text-[0.72rem] text-ink-muted">
                    {#if raidStanding(raid) === 'cut short'}
                      {raidEndNote(raid)}
                    {:else}
                      of {formatDuration(raid.planned_duration_s)}
                    {/if}
                  </div>
                </td>
                <td><PlayerNames players={raid.participants} empty="nobody" /></td>
                <td class="num {raid.deaths_during > 0 ? 'text-offline' : ''}"
                  >{formatNumber(raid.deaths_during)}</td
                >
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <div class="px-3 pb-3">
        <Pager nextCursor={data.raids.data.next_cursor} count={raids.length} label="raids" />
      </div>
    {/if}
  </Card>
</div>
