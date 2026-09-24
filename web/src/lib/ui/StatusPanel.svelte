<script lang="ts">
  import type { Status } from '$lib/api/types';
  import { formatDuration } from './format';
  import { sourceLabel } from './labels';
  import { popOutWidget } from './popout';
  import Stat from './Stat.svelte';
  import SunDial from './SunDial.svelte';
  import Time from './Time.svelte';

  let { status }: { status: Status } = $props();

  const headline = $derived(
    status.online
      ? status.telemetry.live
        ? 'Online'
        : status.source === 'a2s'
          ? 'Online, telemetry delayed'
          : 'Online, telemetry lost'
      : 'Offline'
  );
  const tone = $derived(
    status.online ? (status.telemetry.live ? 'text-online' : 'text-warning') : 'text-offline'
  );
  const words = $derived(status.server_name.trim().split(/\s+/));
  const lead = $derived(words.length > 1 ? `${words.slice(0, -1).join(' ')} ` : '');
  const last = $derived(words[words.length - 1] ?? '');
</script>

<div class="flex flex-col gap-6">
  <div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-10">
    <div class="flex min-w-0 flex-col gap-3">
      <p class="eyebrow rise">
        Valheim dedicated server, seen through {sourceLabel(status.source)}
      </p>
      <p class="hero-title rise rise-2">{lead}<em>{last}</em></p>
      <p class="rise rise-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        <span class="ticker flex items-center gap-2 text-[0.78rem] {tone}">
          <span class="lamp" aria-hidden="true"></span>
          <span>{headline}</span>
        </span>
        {#if status.world}
          <span class="ticker">World {status.world.name}</span>
        {/if}
      </p>
    </div>
    <div id="clock" class="rise rise-2 flex justify-center lg:justify-end">
      <div class="flex flex-col items-center gap-3">
        <SunDial {status} />
        <button type="button" class="seg" onclick={popOutWidget}>Pop out the clock</button>
      </div>
    </div>
  </div>
  {#if !status.telemetry.live}
    <p
      class="glass rise rise-3 border-l-2 border-l-warning px-4 py-3 text-[0.8125rem] leading-relaxed"
    >
      <span class="font-semibold text-warning">The plugin has stopped reporting.</span>
      {#if status.telemetry.delayed_since}
        Marked delayed <Time at={status.telemetry.delayed_since} mode="both" />.
      {/if}
      {#if status.telemetry.last_heartbeat_at}
        The last heartbeat arrived <Time at={status.telemetry.last_heartbeat_at} mode="relative" />.
      {:else}
        No heartbeat has arrived yet.
      {/if}
      {#if status.source === 'a2s'}
        The Steam query still answers, so the server itself is up; player statistics pause until
        heartbeats resume, and the journaled events arrive later.
      {:else if status.source === 'none'}
        Neither the plugin nor the Steam query answers.
      {/if}
    </p>
  {/if}
  <div class="glass rise rise-4 grid grid-cols-2 gap-x-6 gap-y-4 px-5 py-4 sm:grid-cols-4">
    <Stat label="Players online" value="{status.player_count} of {status.max_players}" size="lg" />
    {#if status.world}
      <Stat label="World" value={status.world.name} detail="uid {status.world.uid}" />
    {:else}
      <Stat label="World" value="Not reported yet" />
    {/if}
    {#if status.run}
      <Stat label="Up for" value={formatDuration(status.run.uptime_s)}>
        {formatDuration(status.run.uptime_s)}
      </Stat>
      <Stat label="Started" detail="plugin {status.run.plugin_version}">
        <Time at={status.run.started_at} />
      </Stat>
    {:else}
      <Stat label="Current run" value="None" detail="no run is open" />
    {/if}
    <Stat label="Last save">
      <Time at={status.last_save_at} mode="relative" fallback="Not seen yet" />
    </Stat>
    <Stat
      label="Game version"
      value={status.game_version ?? 'unknown'}
      detail={status.network_version === null ? '' : `network ${status.network_version}`}
    />
    <Stat label="Last heartbeat">
      <Time at={status.telemetry.last_heartbeat_at} mode="relative" fallback="Never" />
    </Stat>
    <Stat label="Status updated">
      <Time at={status.updated_at} mode="relative" />
    </Stat>
  </div>
</div>
