<script lang="ts">
  import type { ZoneRankedResult } from '$lib/api/types';
  import { formatPercent } from './format';
  import Time from './Time.svelte';
  import {
    formatMbps,
    formatMs,
    formatThroughput,
    recommendationLabels,
    recommendationNotes,
    recommendationTones
  } from './zone';

  let { entry, ondownload }: { entry: ZoneRankedResult; ondownload: () => void } = $props();

  const network = $derived(entry.result.measurements.network);
  const cpu = $derived(entry.result.measurements.cpu);
  const stability = $derived(entry.result.measurements.stability);
  const system = $derived(entry.result.system);
  const warnings = $derived(entry.result.completion.warnings);
  const failures = $derived(
    network.failureRate === null
      ? 'failures unknown'
      : `${formatPercent(network.failureRate)} failed`
  );
  const gpu = $derived(
    stability.gpuApi === 'none'
      ? 'no WebGL'
      : `${formatMs(stability.gpuFrameMs)} per frame (${stability.gpuApi})`
  );
  const machine = $derived(
    [
      system.logicalProcessors === null ? null : `${system.logicalProcessors} threads`,
      system.deviceMemoryGB === null ? null : `${system.deviceMemoryGB} GB reported`,
      system.gpuRenderer,
      [system.browser, system.platform].filter(Boolean).join(' on ')
    ]
      .filter(Boolean)
      .join(' · ')
  );
</script>

<div class="flex flex-col gap-4 py-2">
  <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
    <span class="chip {recommendationTones[entry.recommendation]}"
      >{recommendationLabels[entry.recommendation]}</span
    >
    <span class="note">{recommendationNotes[entry.recommendation]}.</span>
    <span class="ticker ml-auto">tested <Time at={entry.tested_at} mode="both" /></span>
  </div>
  <p class="max-w-2xl text-[0.8125rem] leading-relaxed text-ink">{entry.explanation.reason}</p>
  <div class="grid gap-4 sm:grid-cols-2">
    <div class="flex flex-col gap-1.5">
      <p class="label text-online">Strongest</p>
      {#if entry.explanation.strongest.length === 0}
        <p class="text-[0.8125rem] text-ink-muted">Nothing stood out.</p>
      {:else}
        <ul class="flex flex-col gap-1 text-[0.8125rem] leading-relaxed">
          {#each entry.explanation.strongest as line (line)}
            <li class="flex gap-2">
              <span class="diamond mt-[0.45em] bg-online" aria-hidden="true"></span>
              <span>{line}</span>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
    <div class="flex flex-col gap-1.5">
      <p class="label text-warning">Limiting</p>
      {#if entry.explanation.limiting.length === 0}
        <p class="text-[0.8125rem] text-ink-muted">No serious limits found.</p>
      {:else}
        <ul class="flex flex-col gap-1 text-[0.8125rem] leading-relaxed">
          {#each entry.explanation.limiting as line (line)}
            <li class="flex gap-2">
              <span class="diamond mt-[0.45em] bg-warning" aria-hidden="true"></span>
              <span>{line}</span>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </div>
  <dl class="charfile">
    <dt>Network</dt>
    <dd>
      {entry.scores.network} of 100: {formatMs(network.latencyMedianMs)} round trip, {formatMs(
        network.latencyP95Ms
      )} at p95, {formatMs(network.jitterMs)} jitter, {failures},
      {formatMbps(network.uploadMbps)} up, {formatMbps(network.downloadMbps)} down
    </dd>
    <dt>CPU</dt>
    <dd>
      {entry.scores.cpu} of 100: {formatThroughput(cpu.singleThread)} single-thread, {formatThroughput(
        cpu.multiThread
      )} across {cpu.workersUsed ?? '?'} workers, variance {cpu.variance ?? '—'}
    </dd>
    <dt>Frames</dt>
    <dd>
      {entry.scores.stability} of 100: {formatMs(stability.frameTimeP95Ms)} p95, {formatMs(
        stability.frameTimeMedianMs
      )} median, {stability.stallCount ?? '—'} stalls, GPU {gpu}
    </dd>
    <dt>System</dt>
    <dd>{entry.scores.secondary} of 100: {machine || 'nothing reported'}</dd>
    {#if warnings.length > 0}
      <dt class="text-warning">Warnings</dt>
      <dd class="text-ink-muted">{warnings.join(' ')}</dd>
    {/if}
  </dl>
  <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.72rem] text-ink-muted">
    <span>Measured against {entry.result.diagnosticTarget.label.toLowerCase()}</span>
    <button type="button" class="hover:text-accent hover:underline" onclick={ondownload}>
      Download the JSON
    </button>
  </div>
</div>
