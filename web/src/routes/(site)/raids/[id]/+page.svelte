<script lang="ts">
  import BiomeTag from '$lib/ui/BiomeTag.svelte';
  import Card from '$lib/ui/Card.svelte';
  import ErrorNote from '$lib/ui/ErrorNote.svelte';
  import Meta from '$lib/ui/Meta.svelte';
  import PageHeader from '$lib/ui/PageHeader.svelte';
  import { formatDuration, formatNumber, formatPosition } from '$lib/ui/format';
  import {
    raidEndNote,
    raidLength,
    raidPauseNote,
    raidStanding,
    raidStartNote
  } from '$lib/ui/raids';
  import type { MapMarker } from '$lib/ui/map';
  import PlayerLink from '$lib/ui/PlayerLink.svelte';
  import PlayerNames from '$lib/ui/PlayerNames.svelte';
  import Stat from '$lib/ui/Stat.svelte';
  import Time from '$lib/ui/Time.svelte';
  import WorldMap from '$lib/ui/WorldMap.svelte';

  let { data } = $props();

  const raid = $derived(data.raid);
  const markers = $derived<MapMarker[]>([
    { x: raid.x, z: raid.z, label: `${raid.label} centre`, kind: 'raid' },
    ...raid.deaths.map((death) => ({
      x: death.x,
      z: death.z,
      label: `${death.player?.display_name ?? 'Someone'} died`,
      kind: 'death' as const,
      href: death.player ? `/players/${death.player.id}` : undefined
    }))
  ]);
</script>

<Meta title={raid.label} description={`${raid.label}: who was there and who died.`} />

<div class="flex flex-col gap-6">
  <PageHeader eyebrow="Raid on day {formatNumber(raid.day)}">
    {#snippet heading()}{raid.label}{/snippet}
    {#snippet aside()}
      <a href="/raids" class="btn">All raids</a>
    {/snippet}
    <p class="text-[0.8125rem] text-ink-muted [text-shadow:0_1px_12px_rgba(0,0,0,0.85)]">
      Event <code class="text-accent-bright/90">{raid.name}</code>, <Time at={raid.started_at} />.
    </p>
  </PageHeader>

  <Card>
    <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <Stat label="Lasted">
        {#if raidStanding(raid) === 'running'}
          <span class="text-warning">still running</span>
        {:else if raidStanding(raid) === 'cut short'}
          cut short
        {:else}
          {raidLength(raid)}
        {/if}
      </Stat>
      <Stat label="Planned" value={formatDuration(raid.planned_duration_s)} />
      <Stat label="Biome"><BiomeTag biome={raid.biome} /></Stat>
      <Stat label="Centre" value={formatPosition(raid.x, raid.z)} />
      <Stat label="Started">
        <Time at={raid.started_at} />
        {#if raidStartNote(raid)}
          <div class="text-[0.72rem] font-normal text-ink-muted">{raidStartNote(raid)}</div>
        {/if}
      </Stat>
      <Stat label="Ended">
        <Time at={raid.ended_at} fallback="not yet" />
        {#if raidEndNote(raid)}
          <div class="text-[0.72rem] font-normal text-ink-muted">{raidEndNote(raid)}</div>
        {/if}
      </Stat>
      <Stat label="Deaths during" value={formatNumber(raid.deaths_during)} />
      <Stat label="Players nearby" value={formatNumber(raid.participants.length)} />
    </div>
    {#if raidPauseNote(raid)}
      <p class="mt-3 text-[0.8125rem] text-ink-muted">{raidPauseNote(raid)}</p>
    {/if}
    <p class="mt-5 border-t border-line pt-4 text-[0.8125rem]">
      Near the centre when it started: <PlayerNames players={raid.participants} empty="nobody" />.
    </p>
  </Card>

  <div class="grid gap-6 lg:grid-cols-2">
    <Card title="Where">
      <WorldMap
        map={data.world.ok ? data.world.data.map : null}
        src={data.mapSrc}
        {markers}
        focus="markers"
        caption="Raid centre and deaths during {raid.label}"
      />
      {#if !data.world.ok}
        <div class="mt-2"><ErrorNote error={data.world.error} what="the world map" /></div>
      {/if}
    </Card>
    <Card title="Deaths while it ran" flush>
      {#if raid.deaths.length === 0}
        <p class="note p-5">Nobody died during this raid.</p>
      {:else}
        <table class="data-table">
          <thead><tr><th>Player</th><th>When</th><th>Position</th></tr></thead>
          <tbody>
            {#each raid.deaths as death, index (index)}
              <tr>
                <td><PlayerLink player={death.player} /></td>
                <td><Time at={death.at} /></td>
                <td class="whitespace-nowrap">{formatPosition(death.x, death.z)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </Card>
  </div>
</div>
