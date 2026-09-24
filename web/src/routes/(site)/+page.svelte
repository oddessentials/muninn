<script lang="ts">
  import { page } from '$app/state';
  import ActivityFeed from '$lib/ui/ActivityFeed.svelte';
  import BiomeTag from '$lib/ui/BiomeTag.svelte';
  import Card from '$lib/ui/Card.svelte';
  import EmptyState from '$lib/ui/EmptyState.svelte';
  import ErrorNote from '$lib/ui/ErrorNote.svelte';
  import { bossDayNote, bossDayTitle } from '$lib/ui/bosses';
  import { formatNumber } from '$lib/ui/format';
  import { digestActivityTypes } from '$lib/ui/labels';
  import { raidLength, raidStanding } from '$lib/ui/raids';
  import { mergeActivity } from '$lib/ui/feed';
  import { useLive } from '$lib/ui/live.svelte';
  import Meta from '$lib/ui/Meta.svelte';
  import PlayerCountChart from '$lib/ui/PlayerCountChart.svelte';
  import PlayerLink from '$lib/ui/PlayerLink.svelte';
  import PlayerNames from '$lib/ui/PlayerNames.svelte';
  import { withParams } from '$lib/ui/query';
  import StatusPanel from '$lib/ui/StatusPanel.svelte';
  import Time from '$lib/ui/Time.svelte';
  import ZoneLeader from '$lib/ui/ZoneLeader.svelte';

  let { data } = $props();
  const live = useLive();

  const status = $derived(live.status ?? data.status);
  const online = $derived(live.online?.items ?? (data.online.ok ? data.online.data.items : []));
  const activity = $derived(
    mergeActivity(live.activity, data.activity.ok ? data.activity.data.items : [], 25, (item) =>
      digestActivityTypes.includes(item.type)
    )
  );
  const bosses = $derived(data.bosses.ok ? data.bosses.data.items : []);
  const path = $derived(bosses.filter((boss) => boss.tier === 'forsaken'));
  const others = $derived(bosses.filter((boss) => boss.tier === 'other'));
  const defeated = $derived(path.filter((boss) => boss.defeat !== null));
  const nextBoss = $derived(path.find((boss) => boss.defeat === null));
  const activeBoss = $derived(bosses.find((boss) => boss.active));
</script>

<Meta
  title={data.siteName}
  description={`Live log of the ${data.siteName} Valheim server: who is online, the zone leaders, boss progress and the latest events.`}
/>

<h1 class="sr-only">Dashboard</h1>

<div class="flex flex-col gap-8">
  {#if status}
    <StatusPanel {status} />
  {:else if data.statusError}
    <Card><ErrorNote error={data.statusError} what="the server status" /></Card>
  {/if}

  <div class="grid gap-6 lg:grid-cols-3">
    <div class="min-w-0 lg:col-span-2">
      <Card title="Zone leader" description="who should host the fight" id="zone">
        {#snippet actions()}
          {#if data.features?.map ?? true}
            <a href="/world" class="seg">World map</a>
          {/if}
        {/snippet}
        <ZoneLeader loaded={data.zone} canRemove={data.admin} />
      </Card>
    </div>
    <div class="flex flex-col gap-6">
      <Card title="Online now">
        {#if !data.online.ok && !live.online}
          <ErrorNote error={data.online.error} what="the online list" />
        {:else if online.length === 0}
          <EmptyState message="Nobody is on the server right now." />
        {:else}
          <ul class="flex flex-col gap-3.5 text-[0.8125rem]">
            {#each online as player (player.player_id)}
              <li class="flex flex-col gap-1">
                <span>
                  <PlayerLink
                    player={{
                      id: player.player_id,
                      display_name: player.display_name,
                      platform: player.platform
                    }}
                    online={true}
                  />
                  {#if player.character_name !== player.display_name}
                    <span class="text-ink-muted">as {player.character_name}</span>
                  {/if}
                </span>
                <span class="flex flex-wrap gap-x-3 text-[0.72rem] text-ink-muted">
                  <BiomeTag biome={player.biome} />
                  <span>since <Time at={player.since} mode="relative" /></span>
                </span>
              </li>
            {/each}
          </ul>
        {/if}
      </Card>
      <Card title="Players over time">
        {#snippet actions()}
          {#each ['24h', '7d', '30d'] as range (range)}
            <a
              href={withParams(page.url, { range })}
              class="seg"
              aria-current={data.range === range ? 'true' : undefined}
              >{range === '24h' ? '24 hours' : range === '7d' ? '7 days' : '30 days'}</a
            >
          {/each}
        {/snippet}
        {#if data.history.ok}
          <PlayerCountChart history={data.history.data} maxPlayers={status?.max_players ?? 10} />
        {:else}
          <ErrorNote error={data.history.error} what="the player count history" />
        {/if}
      </Card>
    </div>
  </div>

  <div class="grid gap-6 lg:grid-cols-3">
    <div class="min-w-0 lg:col-span-2">
      <Card title="Latest activity" description="without saves and samples" flush>
        {#snippet actions()}
          <a href="/activity" class="seg">Full feed and filters</a>
        {/snippet}
        <div class="px-5">
          {#if !data.activity.ok && activity.length === 0}
            <ErrorNote error={data.activity.error} what="the activity feed" />
          {:else}
            <ActivityFeed items={activity} empty="No events recorded yet." />
          {/if}
        </div>
      </Card>
    </div>
    <div class="flex flex-col gap-6">
      <Card title="Boss progression">
        {#snippet actions()}
          <a href="/bosses" class="seg">Timeline</a>
        {/snippet}
        {#if !data.bosses.ok}
          <ErrorNote error={data.bosses.error} what="the boss list" />
        {:else}
          <ol class="spine flex flex-col gap-2.5 text-[0.8125rem]">
            {#each [...path, ...others] as boss (boss.key)}
              <li class="relative flex items-center gap-3">
                <span
                  class="diamond relative z-10 size-[0.66rem] {boss.defeat
                    ? 'bg-accent shadow-[0_0_8px_rgba(217,171,74,0.6)]'
                    : boss.active
                      ? 'live-dot bg-ember shadow-[0_0_8px_var(--color-ember)]'
                      : 'border border-line-strong bg-surface-raised'}"
                  aria-hidden="true"
                ></span>
                <a
                  href="/bosses/{boss.key}"
                  class="display text-[0.8rem] tracking-wider {boss.defeat
                    ? 'text-ink'
                    : 'text-ink-muted'} hover:text-accent">{boss.name}</a
                >
                <span
                  class="ml-auto text-right text-[0.7rem] text-ink-muted"
                  title={bossDayTitle(boss)}>{bossDayNote(boss)}</span
                >
              </li>
            {/each}
          </ol>
          <p class="note mt-4">
            {#if activeBoss}
              {activeBoss.name} is engaged right now.
            {:else if defeated.length === path.length && path.length > 0}
              Every boss has fallen.
            {:else if nextBoss}
              {defeated.length} of {path.length} defeated, {nextBoss.name} is next.
            {:else}
              No bosses recorded yet.
            {/if}
          </p>
        {/if}
      </Card>
      <Card title="Latest raids">
        {#snippet actions()}
          <a href="/raids" class="seg">All raids</a>
        {/snippet}
        {#if !data.raids.ok}
          <ErrorNote error={data.raids.error} what="the raid list" />
        {:else if data.raids.data.items.length === 0}
          <EmptyState message="No raid has been recorded yet." />
        {:else}
          <ul class="flex flex-col gap-4 text-[0.8125rem]">
            {#each data.raids.data.items as raid (raid.id)}
              <li class="flex flex-col gap-1">
                <a
                  href="/raids/{raid.id}"
                  class="font-semibold text-accent hover:text-accent-bright hover:underline"
                  >{raid.label}</a
                >
                <span class="flex flex-wrap gap-x-3 text-[0.72rem] text-ink-muted">
                  <Time at={raid.started_at} mode="relative" />
                  <span>day {formatNumber(raid.day)}</span>
                  <BiomeTag biome={raid.biome} />
                  {#if raidStanding(raid) === 'ended'}
                    <span>{raidLength(raid)}</span>
                  {:else if raidStanding(raid) === 'cut short'}
                    <span>cut short</span>
                  {:else}
                    <span class="text-warning">still going</span>
                  {/if}
                  {#if raid.deaths_during > 0}
                    <span class="text-offline">{raid.deaths_during} deaths</span>
                  {/if}
                </span>
                <span class="text-[0.72rem] text-ink-muted">
                  Near <PlayerNames players={raid.participants} empty="nobody" />
                </span>
              </li>
            {/each}
          </ul>
        {/if}
      </Card>
    </div>
  </div>
</div>
