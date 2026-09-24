<script lang="ts">
  import { ApiError, createApi } from '$lib/api/client';
  import type { ZoneRankedResult, ZoneResultList } from '$lib/api/types';
  import type { DiagnosticProgress } from '$lib/zone/run-all';
  import { normalizeZoneName } from '$lib/zone/stats';
  import { atmosphere } from './atmosphere.svelte';
  import Emblem from './Emblem.svelte';
  import ErrorNote from './ErrorNote.svelte';
  import type { Loaded, LoadFailure } from './load';
  import ScoreRing from './ScoreRing.svelte';
  import Stat from './Stat.svelte';
  import Time from './Time.svelte';
  import ZoneDetails from './ZoneDetails.svelte';
  import {
    formatMs,
    formatThroughput,
    ordinal,
    phaseIndex,
    phaseSteps,
    ratingLabels,
    ratingTones,
    recommendationLabels,
    recommendationTones
  } from './zone';

  let { loaded, canRemove = false }: { loaded: Loaded<ZoneResultList>; canRemove?: boolean } =
    $props();

  const api = createApi({ fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) });

  let refreshed = $state<ZoneRankedResult[] | null>(null);
  let name = $state('');
  let stage = $state<'idle' | 'running' | 'saving' | 'done'>('idle');
  let progress = $state<DiagnosticProgress | null>(null);
  let outcome = $state<ZoneRankedResult | null>(null);
  let failure = $state<string | null>(null);
  let expanded = $state<string | null>(null);
  let confirming = $state<string | null>(null);
  let removing = $state<string | null>(null);
  let cancelled = $state(false);
  let confirmTimer: ReturnType<typeof setTimeout> | null = null;

  const items = $derived(refreshed ?? (loaded.ok ? loaded.data.items : []));
  const listError = $derived<LoadFailure | null>(
    refreshed === null && !loaded.ok ? loaded.error : null
  );
  const key = $derived(normalizeZoneName(name));
  const busy = $derived(stage === 'running' || stage === 'saving');
  const stepIndex = $derived(
    stage === 'saving' ? phaseSteps.length : progress ? phaseIndex(progress.phase) : -1
  );
  const fraction = $derived(stage === 'saving' ? 1 : (progress?.fraction ?? 0));

  function describe(error: unknown): string {
    if (error instanceof ApiError) return `${error.message} (${error.status} ${error.code}).`;
    return error instanceof Error ? error.message : String(error);
  }

  async function refresh(): Promise<void> {
    refreshed = (await api.listZoneResults()).items;
  }

  async function measure(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (!key || busy) return;
    failure = null;
    outcome = null;
    cancelled = false;
    stage = 'running';
    progress = { phase: 'cpu', label: 'Loading the benchmark', fraction: 0 };
    const resumeAtmosphere = atmosphere.suspend();
    try {
      const { runFullDiagnostic } = await import('$lib/zone/run-all');
      const result = await runFullDiagnostic({
        playerName: key,
        target: {
          label: 'Guild site',
          endpoint: new URL(api.zoneProbeUrl, location.origin).toString()
        },
        onProgress: (update) => {
          progress = update;
        },
        shouldAbort: () => cancelled
      });
      if (cancelled) {
        stage = 'idle';
        return;
      }
      stage = 'saving';
      outcome = await api.putZoneResult(key, result);
      await refresh();
      expanded = outcome.name;
      stage = 'done';
    } catch (error) {
      failure = describe(error);
      stage = 'idle';
    } finally {
      progress = null;
      resumeAtmosphere();
    }
  }

  function reset(): void {
    outcome = null;
    failure = null;
    stage = 'idle';
  }

  function toggle(entryName: string): void {
    expanded = expanded === entryName ? null : entryName;
  }

  function askRemove(entryName: string): void {
    confirming = entryName;
    if (confirmTimer) clearTimeout(confirmTimer);
    confirmTimer = setTimeout(() => {
      confirming = null;
    }, 4000);
  }

  async function remove(entryName: string): Promise<void> {
    if (confirmTimer) clearTimeout(confirmTimer);
    removing = entryName;
    try {
      await api.deleteZoneResult(entryName);
      if (outcome?.name === entryName) reset();
      if (expanded === entryName) expanded = null;
      await refresh();
    } catch (error) {
      failure = describe(error);
    } finally {
      removing = null;
      confirming = null;
    }
  }

  async function download(entry: ZoneRankedResult): Promise<void> {
    const { downloadResult } = await import('$lib/zone/download');
    downloadResult(entry.result);
  }
</script>

<div class="flex flex-col gap-6">
  <p class="note max-w-2xl">
    Valheim hands every area to one player's machine and connection. Measure yours; the guild picks
    its zone leaders from the roll below.
  </p>

  {#if stage === 'idle'}
    <form class="flex flex-col gap-3 sm:flex-row sm:items-end" onsubmit={measure}>
      <label class="flex min-w-0 flex-1 flex-col gap-1.5">
        <span class="label">Character name</span>
        <input
          class="field"
          name="name"
          bind:value={name}
          maxlength="48"
          autocomplete="off"
          spellcheck="false"
          placeholder="As it reads in the game"
          required
        />
      </label>
      <button type="submit" class="btn btn-primary min-h-[2.4rem] px-6" disabled={!key}>
        Measure
      </button>
    </form>
    <p class="ticker -mt-3">
      Run it on the machine you play on. About twenty seconds with this tab in front and nothing
      heavy running.
    </p>
    {#if failure}
      <p
        class="border-l-2 border-danger bg-surface-sunken/60 px-3.5 py-2.5 text-[0.8125rem] leading-relaxed"
        role="status"
      >
        <span class="font-semibold text-danger">Nothing was recorded.</span>
        {failure}
      </p>
    {/if}
  {:else if stage === 'running' || stage === 'saving'}
    <div class="glass flex flex-col gap-4 px-5 py-4" role="status" aria-live="polite">
      <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span class="display text-[0.95rem] tracking-wider text-ink">{key}</span>
        <span class="ticker text-accent">
          {stage === 'saving' ? 'Recording the result' : progress?.label}
        </span>
      </div>
      <ol class="flex flex-wrap gap-x-5 gap-y-2">
        {#each phaseSteps as step, index (step.id)}
          <li
            class="label flex items-center gap-2 {index < stepIndex
              ? 'text-ink'
              : index === stepIndex
                ? 'text-accent'
                : 'text-ink-faint'}"
          >
            <span
              class="diamond {index < stepIndex
                ? 'bg-ink'
                : index === stepIndex
                  ? 'live-dot bg-accent shadow-[0_0_8px_var(--color-accent)]'
                  : 'border border-line-strong'}"
              aria-hidden="true"
            ></span>
            {step.label}
          </li>
        {/each}
      </ol>
      <div class="progress-track" aria-hidden="true">
        <div class="progress-fill" style="width: {Math.round(fraction * 100)}%"></div>
      </div>
      <button
        type="button"
        class="btn self-start"
        onclick={() => (cancelled = true)}
        disabled={cancelled || stage === 'saving'}
      >
        {cancelled ? 'Stopping after this step' : 'Cancel'}
      </button>
    </div>
  {:else if outcome}
    {@const network = outcome.result.measurements.network}
    {@const cpu = outcome.result.measurements.cpu}
    {@const stability = outcome.result.measurements.stability}
    <div class="rise flex flex-col gap-5" role="status">
      <div class="flex flex-col gap-5 sm:flex-row sm:items-center">
        <ScoreRing score={outcome.scores.overall} rating={outcome.rating} />
        <div class="flex min-w-0 flex-1 flex-col gap-2">
          <p class="eyebrow">Your result</p>
          <p class="display text-[1.35rem] leading-tight text-ink">{outcome.name}</p>
          <p class="flex flex-wrap items-center gap-2">
            <span class="chip {ratingTones[outcome.rating]}">{ratingLabels[outcome.rating]}</span>
            <span class="chip {recommendationTones[outcome.recommendation]}"
              >{recommendationLabels[outcome.recommendation]}</span
            >
            <span class="ticker">{ordinal(outcome.rank)} of {items.length}</span>
          </p>
          <p class="note">{outcome.explanation.reason}</p>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        <Stat
          label="Network"
          value={outcome.scores.network}
          detail="{formatMs(network.latencyMedianMs)} round trip, {formatMs(
            network.jitterMs
          )} jitter"
        />
        <Stat
          label="CPU"
          value={outcome.scores.cpu}
          detail="{formatThroughput(cpu.singleThread)} single-thread"
        />
        <Stat
          label="Stability"
          value={outcome.scores.stability}
          detail="{formatMs(stability.frameTimeP95Ms)} frame p95"
        />
        <Stat
          label="System"
          value={outcome.scores.secondary}
          detail={outcome.result.system.gpuRenderer ?? 'GPU not reported'}
        />
      </div>
      {#if outcome.result.completion.warnings.length > 0}
        <ul
          class="flex flex-col gap-1 border-l-2 border-warning bg-surface-sunken/60 px-3.5 py-2.5 text-[0.8125rem] leading-relaxed"
        >
          {#each outcome.result.completion.warnings as warning (warning)}
            <li>{warning}</li>
          {/each}
        </ul>
      {/if}
      <div class="flex flex-wrap items-center gap-x-5 gap-y-2">
        <button type="button" class="btn" onclick={reset}>Measure again</button>
        <button
          type="button"
          class="text-[0.72rem] text-ink-muted hover:text-accent hover:underline"
          onclick={() => outcome && download(outcome)}
        >
          Download the JSON
        </button>
      </div>
    </div>
  {/if}

  <div class="flex flex-col gap-3">
    <div class="divider"><span class="label text-accent-deep">Roll of zone leaders</span></div>
    {#if listError && items.length === 0}
      <ErrorNote error={listError} what="the zone-leader roll" />
    {:else if items.length === 0}
      <div class="flex flex-col items-center gap-3 py-6 text-center">
        <Emblem size={44} class="text-ink-faint" />
        <p class="note">No one has measured yet. Step up.</p>
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="data-table data-table-tight">
          <thead>
            <tr>
              <th class="num">#</th>
              <th>Name</th>
              <th class="num">Overall</th>
              <th class="hidden sm:table-cell">Rating</th>
              <th class="num hidden sm:table-cell">Net</th>
              <th class="num hidden sm:table-cell">CPU</th>
              <th class="num hidden sm:table-cell">Frames</th>
              <th class="hidden md:table-cell">Tested</th>
              {#if canRemove}
                <th class="relative text-right"><span class="sr-only">Remove</span></th>
              {/if}
            </tr>
          </thead>
          <tbody>
            {#each items as entry (entry.name)}
              {@const own = outcome?.name === entry.name}
              {@const open = expanded === entry.name}
              <tr class={own ? 'zone-own' : ''} aria-current={own ? 'true' : undefined}>
                <td class="num text-ink-muted">{entry.rank}</td>
                <td class="py-1">
                  <button
                    type="button"
                    class="zone-name group flex w-full items-center gap-2 py-1.5 text-left"
                    aria-expanded={open}
                    aria-controls="zone-details-{entry.rank}"
                    onclick={() => toggle(entry.name)}
                  >
                    <span
                      class="zone-caret text-ink-faint transition-transform group-hover:text-accent {open
                        ? 'rotate-90 text-accent'
                        : ''}"
                      aria-hidden="true">›</span
                    >
                    {#if entry.rank === 1}
                      <Emblem
                        size={18}
                        class="shrink-0 text-accent drop-shadow-[0_0_6px_rgba(217,171,74,0.5)]"
                      />
                    {/if}
                    <span class="flex min-w-0 flex-col gap-1">
                      <span
                        class="display text-[0.8rem] tracking-wider text-ink group-hover:text-accent"
                        >{entry.name}</span
                      >
                      <span class="chip self-start sm:hidden {ratingTones[entry.rating]}"
                        >{ratingLabels[entry.rating]}</span
                      >
                    </span>
                  </button>
                </td>
                <td class="num">
                  <span class="display text-[1.05rem] {ratingTones[entry.rating]}"
                    >{entry.scores.overall}</span
                  >
                </td>
                <td class="hidden sm:table-cell">
                  <span class="chip {ratingTones[entry.rating]}">{ratingLabels[entry.rating]}</span>
                </td>
                <td class="num hidden sm:table-cell">{entry.scores.network}</td>
                <td class="num hidden sm:table-cell">{entry.scores.cpu}</td>
                <td class="num hidden sm:table-cell">{entry.scores.stability}</td>
                <td class="hidden whitespace-nowrap text-ink-muted md:table-cell">
                  <Time at={entry.tested_at} mode="relative" />
                </td>
                {#if canRemove}
                  <td class="text-right whitespace-nowrap">
                    {#if confirming === entry.name}
                      <button
                        type="button"
                        class="-my-1 min-h-9 px-1 font-semibold text-danger hover:underline"
                        disabled={removing === entry.name}
                        onclick={() => remove(entry.name)}
                      >
                        Really remove?
                      </button>
                    {:else}
                      <button
                        type="button"
                        class="-my-1 inline-flex size-9 items-center justify-center text-[1.15rem] leading-none text-ink-faint transition-colors hover:text-danger"
                        aria-label="Remove {entry.name}"
                        title="Remove {entry.name}"
                        onclick={() => askRemove(entry.name)}
                      >
                        ×
                      </button>
                    {/if}
                  </td>
                {/if}
              </tr>
              {#if open}
                <tr class="zone-details" id="zone-details-{entry.rank}">
                  <td colspan={canRemove ? 9 : 8}>
                    <ZoneDetails {entry} ondownload={() => download(entry)} />
                  </td>
                </tr>
              {/if}
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>
