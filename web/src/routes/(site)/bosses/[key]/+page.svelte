<script lang="ts">
  import BiomeTag from '$lib/ui/BiomeTag.svelte';
  import Card from '$lib/ui/Card.svelte';
  import EmptyState from '$lib/ui/EmptyState.svelte';
  import ErrorNote from '$lib/ui/ErrorNote.svelte';
  import { formatNumber, formatPosition } from '$lib/ui/format';
  import { bossEventLabel, bossTierEyebrow } from '$lib/ui/bosses';
  import type { MapMarker } from '$lib/ui/map';
  import Meta from '$lib/ui/Meta.svelte';
  import PageHeader from '$lib/ui/PageHeader.svelte';
  import Pager from '$lib/ui/Pager.svelte';
  import PlayerLink from '$lib/ui/PlayerLink.svelte';
  import PlayerNames from '$lib/ui/PlayerNames.svelte';
  import Stat from '$lib/ui/Stat.svelte';
  import Time from '$lib/ui/Time.svelte';
  import WorldMap from '$lib/ui/WorldMap.svelte';

  let { data } = $props();

  const boss = $derived(data.boss);
  const events = $derived(data.events.ok ? data.events.data.items : boss.events);
  const markers = $derived<MapMarker[]>(
    events
      .filter((event) => event.x !== null && event.z !== null)
      .map((event) => ({
        x: event.x as number,
        z: event.z as number,
        label: `${event.kind} on day ${event.day}`,
        kind: 'boss'
      }))
  );
</script>

<Meta
  title={boss.name}
  description={`${boss.name}: when it was summoned, engaged and defeated, and who was credited.`}
/>

<div class="flex flex-col gap-6">
  <PageHeader eyebrow={bossTierEyebrow(boss)}>
    {#snippet heading()}{boss.name}{/snippet}
    {#snippet aside()}
      <a href="/bosses" class="btn">All bosses</a>
    {/snippet}
    <p class="text-[0.8125rem] text-ink-muted [text-shadow:0_1px_12px_rgba(0,0,0,0.85)]">
      Global key <code class="text-accent-bright/90">{boss.key}</code>.
      {#if boss.active}
        <span class="text-warning">A fight is under way right now.</span>
      {/if}
    </p>
  </PageHeader>

  <Card>
    <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <Stat label="Summoned" value={formatNumber(boss.summons)} />
      <Stat label="Engaged" value={formatNumber(boss.engaged)} />
      <Stat label="Kills" value={formatNumber(boss.kills)} />
      <Stat label="Last kill">
        <Time
          at={boss.last_kill_at}
          mode="date"
          fallback={boss.defeat && !boss.defeat.observed ? 'Not recorded' : 'Never'}
        />
      </Stat>
    </div>
    {#if boss.defeat && !boss.defeat.observed}
      <p class="mt-5 border-t border-line pt-4 text-[0.8125rem] leading-relaxed">
        Fell before the log began on day {formatNumber(boss.defeat.day)}, <Time
          at={boss.defeat.since}
        />. Who brought it down, and when, is not on record.
      </p>
    {/if}
    {#if boss.first_kill}
      <p
        class="text-[0.8125rem] leading-relaxed {boss.defeat?.observed
          ? 'mt-5 border-t border-line pt-4'
          : 'mt-3'}"
      >
        First {boss.defeat?.observed ? 'defeated' : 'recorded kill'} on day {formatNumber(
          boss.first_kill.day
        )}, <Time at={boss.first_kill.at} />, credited to <PlayerNames
          players={boss.first_kill.participants}
          empty="nobody in particular"
        />.
      </p>
    {/if}
  </Card>

  <div class="grid gap-6 lg:grid-cols-[1fr_1fr]">
    <Card title="Timeline" flush>
      {#if !data.events.ok && boss.events.length === 0}
        <div class="p-4"><ErrorNote error={data.events.error} what="the boss events" /></div>
      {:else if events.length === 0}
        <EmptyState message="No summon, engagement or kill recorded yet." />
      {:else}
        <ol class="divide-y divide-line/60 px-5">
          {#each events as event (event.id)}
            <li class="flex gap-3.5 py-3.5 text-[0.8125rem]">
              <span
                class="diamond mt-2 {event.kind === 'defeated'
                  ? 'bg-online'
                  : event.kind === 'engaged' || event.kind === 'phase'
                    ? 'bg-warning'
                    : 'bg-info'}"
                aria-hidden="true"
              ></span>
              <div class="flex min-w-0 flex-1 flex-col gap-0.5">
                <p>
                  <span class="display text-[0.8rem]">{bossEventLabel(event)}</span>
                  {#if event.kind === 'defeated' && event.first_time}
                    <span class="chip text-online">first kill</span>
                  {/if}
                  {#if event.kind === 'summoned' && (event.phase === null || event.phase === 1)}
                    by <PlayerLink player={event.summoner} />
                  {/if}
                </p>
                {#if event.kind === 'defeated' || event.kind === 'phase'}
                  <p>
                    Credited: <PlayerNames players={event.participants} empty="nobody" />. Nearby: <PlayerNames
                      players={event.nearby}
                      empty="nobody"
                    />.
                  </p>
                {:else if event.nearby.length > 0}
                  <p>Nearby: <PlayerNames players={event.nearby} /></p>
                {/if}
                <p class="flex flex-wrap gap-x-3 text-[0.72rem] text-ink-muted">
                  <Time at={event.at} />
                  <span>day {formatNumber(event.day)}</span>
                  {#if event.biome}<BiomeTag biome={event.biome} />{/if}
                  {#if event.x !== null && event.z !== null}<span
                      >at {formatPosition(event.x, event.z)}</span
                    >{/if}
                </p>
              </div>
            </li>
          {/each}
        </ol>
        {#if data.events.ok}
          <div class="px-3 pb-3">
            <Pager nextCursor={data.events.data.next_cursor} count={events.length} label="events" />
          </div>
        {/if}
      {/if}
    </Card>
    <Card title="Where">
      <WorldMap
        map={data.world.ok ? data.world.data.map : null}
        src={data.mapSrc}
        {markers}
        focus={markers.length > 0 ? 'markers' : 'world'}
        caption="Summon and fight locations of {boss.name}"
      />
      {#if markers.length === 0}
        <p class="note mt-3">No positions recorded for this boss yet.</p>
      {/if}
      {#if !data.world.ok}
        <div class="mt-2"><ErrorNote error={data.world.error} what="the world map" /></div>
      {/if}
    </Card>
  </div>
</div>
