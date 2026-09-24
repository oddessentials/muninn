<script lang="ts">
  import type { Status } from '$lib/api/types';
  import type { LiveStreamState } from './live.svelte';
  import type { LoadFailure } from './load';
  import { stripClock } from './sunclock';
  import Time from './Time.svelte';
  import { worldClock } from './worldclock.svelte';

  let {
    status,
    error,
    stream
  }: { status: Status | null; error: LoadFailure | null; stream: LiveStreamState } = $props();

  const reading = $derived(worldClock.reading(status));
  const streamLabel = $derived(
    stream === 'open'
      ? 'live'
      : stream === 'connecting'
        ? 'connecting'
        : stream === 'reconnecting'
          ? 'reconnecting'
          : stream === 'closed'
            ? 'stream closed'
            : 'not live'
  );
</script>

<div
  class="ticker relative z-10 border-y border-line/70 bg-surface/55 backdrop-blur-md"
  role="status"
  aria-live="polite"
>
  <div
    class="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-5 gap-y-1 px-(--gutter) py-1.5"
  >
    {#if status}
      <a href="/" class="flex items-center gap-2 text-ink hover:text-accent">
        <span class="lamp {status.online ? 'text-online' : 'text-offline'}" aria-hidden="true"
        ></span>
        {status.online ? 'Server online' : 'Server offline'}
      </a>
      <span>{status.player_count} of {status.max_players} players</span>
      {#if reading}
        <a href="/#clock" class="text-ink hover:text-accent" data-clock>{stripClock(reading)}</a>
      {/if}
      {#if !status.telemetry.live}
        <span class="text-warning">
          Telemetry {status.source === 'none' ? 'lost' : 'delayed'}
          {#if status.telemetry.delayed_since}
            <span>since <Time at={status.telemetry.delayed_since} mode="relative" /></span>
          {/if}
        </span>
      {/if}
    {:else}
      <span class="text-warning">Status unavailable{error ? ` (${error.code})` : ''}</span>
    {/if}
    <span class="ml-auto flex items-center gap-2" title="Server-sent events from /api/v1/stream">
      <span
        class="inline-block size-1.5 rounded-full {stream === 'open'
          ? 'live-dot bg-online shadow-[0_0_8px_var(--color-online)]'
          : stream === 'off'
            ? 'bg-line-strong'
            : 'bg-warning'}"
        aria-hidden="true"
      ></span>
      {streamLabel}
    </span>
  </div>
</div>
