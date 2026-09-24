<script lang="ts">
  import { onDestroy } from 'svelte';
  import { invalidateAll } from '$app/navigation';
  import { ApiError, api } from '$lib/api/client';
  import type { Job } from '$lib/api/types';
  import Card from '$lib/ui/Card.svelte';
  import EmptyState from '$lib/ui/EmptyState.svelte';
  import Meta from '$lib/ui/Meta.svelte';
  import PageHeader from '$lib/ui/PageHeader.svelte';
  import ErrorNote from '$lib/ui/ErrorNote.svelte';
  import { formatBytes, formatDuration, formatMegabytes, formatNumber } from '$lib/ui/format';
  import { stopReasonLabel } from '$lib/ui/labels';
  import Stat from '$lib/ui/Stat.svelte';
  import Time from '$lib/ui/Time.svelte';

  let { data } = $props();

  let job = $state<Job | null>(null);
  let message = $state('');
  let busy = $state(false);
  let timer: ReturnType<typeof setTimeout> | null = null;

  const health = $derived(data.health.ok ? data.health.data : null);
  const heartbeatTone = $derived(
    health?.heartbeat_age_s === null || health?.heartbeat_age_s === undefined
      ? 'text-offline'
      : health.heartbeat_age_s > 180
        ? 'text-warning'
        : 'text-online'
  );

  async function poll(id: number) {
    try {
      job = await api.getJob(id);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
      return;
    }
    if (job.state === 'queued' || job.state === 'running') {
      timer = setTimeout(() => poll(id), 2000);
    } else {
      await invalidateAll();
    }
  }

  async function run(kind: 'projections_rebuild' | 'backup') {
    busy = true;
    message = '';
    try {
      const accepted = kind === 'backup' ? await api.runBackup() : await api.rebuildProjections();
      job = {
        id: accepted.job_id,
        kind,
        state: 'queued',
        progress: null,
        started_at: null,
        finished_at: null,
        error: null
      };
      await poll(accepted.job_id);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409)
        message = 'A job is already running. Wait for it to finish.';
      else message = error instanceof Error ? error.message : String(error);
    } finally {
      busy = false;
    }
  }

  onDestroy(() => {
    if (timer) clearTimeout(timer);
  });
</script>

<Meta title="Admin health" description="Telemetry health, backups and jobs." />

<div class="flex flex-col gap-6">
  <PageHeader eyebrow="Admin">
    {#snippet heading()}Telemetry health{/snippet}
  </PageHeader>

  {#if !health}
    {#if !data.health.ok}<ErrorNote error={data.health.error} what="the health report" />{/if}
  {:else}
    <Card title="Plugin">
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Last heartbeat">
          <span class={heartbeatTone}>
            {#if health.heartbeat_age_s === null}
              never
            {:else}
              {formatDuration(health.heartbeat_age_s)} ago
            {/if}
          </span>
        </Stat>
        <Stat label="Heartbeat at"><Time at={health.last_heartbeat_at} fallback="never" /></Stat>
        <Stat
          label="Plugin"
          value={health.plugin_version ?? 'unknown'}
          detail="game {health.game_version ?? 'unknown'}"
        />
        <Stat
          label="Queue depth"
          value={health.queue_depth === null ? 'unknown' : formatNumber(health.queue_depth)}
          detail="events waiting on the game server"
        />
        <Stat
          label="Dropped events"
          value={health.dropped_events === null ? 'unknown' : formatNumber(health.dropped_events)}
        >
          <span class={health.dropped_events ? 'text-offline' : ''}
            >{health.dropped_events === null
              ? 'unknown'
              : formatNumber(health.dropped_events)}</span
          >
        </Stat>
      </div>
      {#if health.missing_hooks.length > 0}
        <p class="mt-4 text-[0.8125rem] text-warning">
          Hooks the plugin could not attach: {health.missing_hooks.join(', ')}. The events they feed
          are missing.
        </p>
      {/if}
      {#if health.plugin_version && data.version && health.plugin_version !== data.version}
        <p class="mt-4 text-[0.8125rem] text-warning">
          The game server runs plugin {health.plugin_version} and this site is {data.version}. Get
          the matching DLL on the
          <a href="/admin/plugin" class="text-accent hover:underline">Plugin page</a>.
        </p>
      {/if}
      {#if health.run}
        <p class="mt-4 text-[0.8125rem] text-ink-muted">
          Latest run started <Time at={health.run.started_at} />, {stopReasonLabel(
            health.run.stop_reason
          )}, peak {health.run.peak_players} players, {health.run.saves} saves.
        </p>
      {:else}
        <p class="note mt-4">No server run is open.</p>
      {/if}
    </Card>

    <div class="grid gap-6 lg:grid-cols-2">
      <Card title="Steam query">
        <div class="grid grid-cols-2 gap-4">
          <Stat label="Answering">
            <span
              class={health.a2s.online === true
                ? 'text-online'
                : health.a2s.online === false
                  ? 'text-offline'
                  : 'text-ink-muted'}
            >
              {health.a2s.online === null ? 'not polled yet' : health.a2s.online ? 'yes' : 'no'}
            </span>
          </Stat>
          <Stat
            label="Players reported"
            value={health.a2s.player_count === null
              ? 'unknown'
              : formatNumber(health.a2s.player_count)}
          />
          <Stat label="Last success"
            ><Time at={health.a2s.last_ok_at} mode="relative" fallback="never" /></Stat
          >
          <Stat label="Last error"
            ><span class={health.a2s.last_error ? 'text-offline' : 'text-ink-muted'}
              >{health.a2s.last_error ?? 'none'}</span
            ></Stat
          >
        </div>
      </Card>
      <Card title="Ingest, last 24 hours">
        <div class="grid grid-cols-2 gap-4">
          <Stat label="Batches" value={formatNumber(health.ingest.batches_24h)} />
          <Stat label="Events" value={formatNumber(health.ingest.events_24h)} />
          <Stat label="Duplicates" value={formatNumber(health.ingest.duplicates_24h)} />
          <Stat label="Rejected">
            <span class={health.ingest.rejected_24h > 0 ? 'text-offline' : ''}
              >{formatNumber(health.ingest.rejected_24h)}</span
            >
          </Stat>
          <Stat label="Last batch"
            ><Time at={health.ingest.last_batch_at} mode="relative" fallback="never" /></Stat
          >
        </div>
      </Card>
      <Card title="Database and map">
        <div class="grid grid-cols-2 gap-4">
          <Stat label="Events stored" value={formatNumber(health.db.events_total)} />
          <Stat label="Database size" value={formatMegabytes(health.db.size_mb)} />
          <Stat label="World map">
            {#if health.map.available}
              rendered <Time at={health.map.generated_at} mode="relative" />
            {:else}
              <span class="text-warning">not rendered yet</span>
            {/if}
          </Stat>
        </div>
      </Card>
      <Card title="Backups">
        <div class="grid grid-cols-2 gap-4">
          <Stat label="Last backup"
            ><Time at={health.backup.last_at} mode="relative" fallback="never" /></Stat
          >
          <Stat
            label="Size"
            value={health.backup.size_mb === null
              ? 'unknown'
              : formatMegabytes(health.backup.size_mb)}
          />
          <Stat
            label="Kept"
            value={formatNumber(health.backup.kept)}
            detail="nightly dumps on the volume"
          />
        </div>
      </Card>
    </div>

    <Card title="Background jobs" flush>
      {#if health.jobs.length === 0}
        <EmptyState message="No jobs registered." />
      {:else}
        <div class="overflow-x-auto">
          <table class="data-table">
            <thead><tr><th>Job</th><th>Last run</th><th>Result</th></tr></thead>
            <tbody>
              {#each health.jobs as entry (entry.name)}
                <tr>
                  <td><code class="text-xs">{entry.name}</code></td>
                  <td><Time at={entry.last_run_at} mode="relative" fallback="never" /></td>
                  <td>
                    {#if entry.last_ok === null}
                      <span class="text-ink-muted">not run yet</span>
                    {:else if entry.last_ok}
                      <span class="text-online">ok</span>
                    {:else}
                      <span class="text-offline">failed: {entry.last_error ?? 'unknown error'}</span
                      >
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </Card>
  {/if}

  <Card title="Maintenance">
    <div class="flex flex-wrap items-center gap-3 text-[0.8125rem]">
      <button type="button" class="btn" disabled={busy} onclick={() => run('projections_rebuild')}
        >Rebuild projections</button
      >
      <button type="button" class="btn" disabled={busy} onclick={() => run('backup')}
        >Run a backup now</button
      >
      {#if job}
        <span role="status">
          Job {job.id} ({job.kind === 'backup' ? 'backup' : 'projection rebuild'}):
          <span
            class={job.state === 'failed'
              ? 'text-offline'
              : job.state === 'done'
                ? 'text-online'
                : 'text-warning'}>{job.state}</span
          >
          {#if job.progress !== null && job.state === 'running'}{Math.round(
              job.progress * 100
            )}%{/if}
          {#if job.finished_at}<span class="text-ink-muted"
              >finished <Time at={job.finished_at} mode="relative" /></span
            >{/if}
          {#if job.error}<span class="text-offline">{job.error}</span>{/if}
        </span>
      {/if}
      {#if message}<span class="text-danger" role="alert">{message}</span>{/if}
    </div>
    <p class="mt-4 text-[0.75rem] leading-relaxed text-ink-muted">
      A rebuild replays every stored event into the players, sessions, bosses and other tables; use
      it after fixing a projection or merging players. Only one job runs at a time.
    </p>
  </Card>

  <Card title="Backup files" flush>
    {#if !data.backups.ok}
      <div class="p-4"><ErrorNote error={data.backups.error} what="the backup list" /></div>
    {:else if data.backups.data.items.length === 0}
      <EmptyState message="No backup has been written yet." />
    {:else}
      <div class="overflow-x-auto">
        <table class="data-table">
          <thead><tr><th>Taken</th><th>File</th><th class="num">Size</th><th>Result</th></tr></thead
          >
          <tbody>
            {#each data.backups.data.items as backup (backup.file)}
              <tr>
                <td><Time at={backup.at} /></td>
                <td><code class="text-xs">{backup.file}</code></td>
                <td class="num">{formatBytes(backup.size_bytes)}</td>
                <td class={backup.ok ? 'text-online' : 'text-offline'}
                  >{backup.ok ? 'ok' : 'failed'}</td
                >
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </Card>
</div>
