<script lang="ts">
  import Card from '$lib/ui/Card.svelte';
  import EmptyState from '$lib/ui/EmptyState.svelte';
  import ErrorNote from '$lib/ui/ErrorNote.svelte';
  import { formatDuration, formatMillis, formatNumber } from '$lib/ui/format';
  import { stopReasonLabel } from '$lib/ui/labels';
  import { useLive } from '$lib/ui/live.svelte';
  import type { MapMarker } from '$lib/ui/map';
  import Meta from '$lib/ui/Meta.svelte';
  import PageHeader from '$lib/ui/PageHeader.svelte';
  import Pager from '$lib/ui/Pager.svelte';
  import Stat from '$lib/ui/Stat.svelte';
  import Time from '$lib/ui/Time.svelte';
  import WorldMap from '$lib/ui/WorldMap.svelte';
  import { phaseLabel } from '$lib/ui/sunclock';
  import { worldClock } from '$lib/ui/worldclock.svelte';

  let { data } = $props();
  const live = useLive();

  const world = $derived(data.world.ok ? data.world.data : null);
  const status = $derived(live.status ?? data.status);
  const reading = $derived(worldClock.reading(status));
  const online = $derived(live.online?.items ?? (data.online.ok ? data.online.data.items : []));
  const markers = $derived<MapMarker[]>(
    online.map((player) => ({
      x: player.x,
      z: player.z,
      label: player.character_name,
      kind: 'player',
      href: `/players/${player.player_id}`
    }))
  );
  const runs = $derived(data.runs.ok ? data.runs.data.items : []);
  const restarts = $derived(Math.max(0, runs.length - 1));
</script>

<Meta
  title="World"
  description="Server runs, restarts, saves, rollbacks and the biome map of the world."
/>

<div class="flex flex-col gap-6">
  <PageHeader
    eyebrow="The realm"
    note="Days, saves, restarts and rollbacks, and the biome map the plugin rendered once for this world."
  >
    {#snippet heading()}{#if world}The world of {world.name}{:else}World{/if}{/snippet}
  </PageHeader>

  {#if !data.world.ok}
    <ErrorNote error={data.world.error} what="the world summary" />
  {:else if world}
    <Card>
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Stat
          label="World day"
          value={formatNumber(reading?.day ?? world.day)}
          detail={reading
            ? `${reading.clock} in-game, ${phaseLabel(reading.phase).toLowerCase()}`
            : ''}
        />
        <Stat label="A day lasts" value={formatDuration(world.day_length_s)} detail="real time" />
        <Stat
          label="World time"
          value="{formatNumber(Math.round(world.net_time))} s"
          detail="uid {world.uid}"
        />
        <Stat label="Last save">
          <Time at={world.saves.last_at} mode="relative" fallback="Not seen yet" />
        </Stat>
        <Stat
          label="Saves in 24 h"
          value={formatNumber(world.saves.count_24h)}
          detail={world.saves.avg_duration_ms === null
            ? ''
            : `${formatMillis(world.saves.avg_duration_ms)} each on average`}
        />
        <Stat
          label="Rollbacks"
          value={formatNumber(world.rollbacks.length)}
          detail="restarts that lost time"
        />
      </div>
    </Card>
  {/if}

  <Card
    title="Map"
    description="North is up. The disc is 20 km across; players online now are marked."
    flush
  >
    <div class="p-5">
      <WorldMap
        map={world?.map ?? null}
        src={data.mapSrc}
        {markers}
        legend
        caption="Biome map of the world"
      />
      {#if world?.map?.generated_at}
        <p class="mt-3 text-[0.72rem] text-ink-muted">
          Rendered <Time at={world.map.generated_at} /> at {world.map.size_px} by {world.map
            .size_px} pixels. Water is drawn wherever the terrain lies below sea level.
        </p>
      {/if}
    </div>
  </Card>

  <div class="flex flex-col gap-6">
    <Card
      title="Server runs"
      description="One run per server process; {restarts} restarts on this page."
      flush
    >
      {#if !data.runs.ok}
        <div class="p-4"><ErrorNote error={data.runs.error} what="the run list" /></div>
      {:else if runs.length === 0}
        <EmptyState message="The plugin has not reported a server start yet." />
      {:else}
        <div class="overflow-x-auto">
          <table class="data-table">
            <thead>
              <tr
                ><th>Started</th><th>Stopped</th><th>How it ended</th><th class="num">Peak</th><th
                  class="num">Saves</th
                ><th>Versions</th></tr
              >
            </thead>
            <tbody>
              {#each runs as run (run.run_id)}
                <tr>
                  <td><Time at={run.started_at} /></td>
                  <td><Time at={run.stopped_at} fallback="running" /></td>
                  <td class={run.stop_reason === 'inferred' ? 'text-warning' : ''}
                    >{stopReasonLabel(run.stop_reason)}</td
                  >
                  <td class="num">{formatNumber(run.peak_players)}</td>
                  <td class="num">{formatNumber(run.saves)}</td>
                  <td class="text-[0.72rem] text-ink-muted">
                    game {run.game_version ?? '?'}, plugin {run.plugin_version ?? '?'}
                    <div>
                      <code title={run.run_id}>{run.run_id.slice(0, 8)}</code>
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <div class="px-3 pb-3">
          <Pager nextCursor={data.runs.data.next_cursor} count={runs.length} label="runs" />
        </div>
      {/if}
    </Card>

    <div class="grid min-w-0 gap-6 lg:grid-cols-2">
      <Card
        title="Rollbacks"
        description="A restart whose world time went backwards by more than 60 s."
        flush
      >
        {#if !world}
          <EmptyState message="Unknown until the world summary loads." />
        {:else if world.rollbacks.length === 0}
          <EmptyState message="No rollback has been detected." />
        {:else}
          <table class="data-table">
            <thead><tr><th>Detected</th><th class="num">Lost</th><th>World time</th></tr></thead>
            <tbody>
              {#each world.rollbacks as rollback (rollback.detected_at)}
                <tr>
                  <td><Time at={rollback.detected_at} /></td>
                  <td class="num text-offline"
                    >{formatDuration(rollback.from_net_time - rollback.to_net_time)}</td
                  >
                  <td class="text-[0.72rem] text-ink-muted"
                    >{formatNumber(Math.round(rollback.from_net_time))} s back to {formatNumber(
                      Math.round(rollback.to_net_time)
                    )} s</td
                  >
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </Card>

      <Card title="Recent saves" flush>
        {#if !data.saves.ok}
          <div class="p-4"><ErrorNote error={data.saves.error} what="the save list" /></div>
        {:else if data.saves.data.items.length === 0}
          <EmptyState message="No world save has been reported yet." />
        {:else}
          <table class="data-table">
            <thead><tr><th>Saved</th><th class="num">Took</th></tr></thead>
            <tbody>
              {#each data.saves.data.items as save (save.at)}
                <tr>
                  <td><Time at={save.at} /></td>
                  <td class="num">{formatMillis(save.duration_ms)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </Card>
    </div>
  </div>
</div>
