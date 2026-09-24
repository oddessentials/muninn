<script lang="ts">
  import { SvelteSet } from 'svelte/reactivity';
  import Card from '$lib/ui/Card.svelte';
  import EmptyState from '$lib/ui/EmptyState.svelte';
  import ErrorNote from '$lib/ui/ErrorNote.svelte';
  import { formatNumber } from '$lib/ui/format';
  import JsonView from '$lib/ui/JsonView.svelte';
  import { activityTypeLabel, activityTypes } from '$lib/ui/labels';
  import Meta from '$lib/ui/Meta.svelte';
  import PageHeader from '$lib/ui/PageHeader.svelte';
  import Pager from '$lib/ui/Pager.svelte';
  import { dateInputValue } from '$lib/ui/query';
  import Time from '$lib/ui/Time.svelte';

  let { data } = $props();

  const open = new SvelteSet<string>();

  function toggle(id: string) {
    if (open.has(id)) open.delete(id);
    else open.add(id);
  }

  const events = $derived(data.events.ok ? data.events.data.items : []);
  const filtered = $derived(
    Boolean(data.type || data.runId || data.player !== undefined || data.since || data.until)
  );

  function subject(event: (typeof events)[number]): string {
    const payload = event.data as Record<string, unknown>;
    for (const key of ['platform_user_id', 'name', 'prefab', 'key', 'summoner_platform_user_id']) {
      const value = payload[key];
      if (typeof value === 'string') return value;
    }
    return '';
  }
</script>

<Meta title="Admin events" description="Raw telemetry events as the plugin sent them." />

<div class="flex flex-col gap-6">
  <PageHeader
    eyebrow="Admin"
    note="Every envelope the plugin sent, including heartbeats and position samples, exactly as stored. Console chat shows its Server_ platform id here."
  >
    {#snippet heading()}Raw events{/snippet}
  </PageHeader>

  <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
    <div class="flex min-w-0 flex-col gap-4">
      {#if data.single}
        <Card title="Event {data.lookup}">
          {#if data.single.ok}
            <JsonView data={data.single.data} />
          {:else}
            <ErrorNote error={data.single.error} what="that event" />
          {/if}
        </Card>
      {/if}
      <Card flush>
        {#if !data.events.ok}
          <div class="p-4"><ErrorNote error={data.events.error} what="the event list" /></div>
        {:else if events.length === 0}
          <EmptyState
            message={filtered ? 'No events match this filter.' : 'No events stored yet.'}
          />
        {:else}
          <div class="overflow-x-auto">
            <table class="data-table">
              <thead>
                <tr
                  ><th>Received</th><th>Type</th><th>Subject</th><th class="num">Seq</th><th
                    class="num">Day</th
                  ><th>Run</th><th></th></tr
                >
              </thead>
              <tbody>
                {#each events as event (event.id)}
                  <tr>
                    <td class="whitespace-nowrap">
                      <Time at={event.ts} />
                      {#if event.received_at && Math.abs(Date.parse(event.received_at) - Date.parse(event.ts)) > 120_000}
                        <div class="text-xs text-warning">
                          arrived <Time at={event.received_at} mode="relative" />
                        </div>
                      {/if}
                    </td>
                    <td
                      ><span class="chip">{activityTypeLabel(event.type)}</span>
                      <div class="text-[0.72rem] text-ink-muted">{event.type}</div></td
                    >
                    <td class="text-xs">{subject(event)}</td>
                    <td class="num">{formatNumber(event.seq)}</td>
                    <td class="num">{formatNumber(event.world_day)}</td>
                    <td
                      ><a
                        href="?run_id={event.run_id}"
                        class="text-xs text-accent hover:underline"
                        title={event.run_id}>{event.run_id.slice(0, 8)}</a
                      ></td
                    >
                    <td>
                      <button
                        type="button"
                        class="text-accent hover:underline"
                        onclick={() => toggle(event.id)}
                        aria-expanded={open.has(event.id)}
                      >
                        {open.has(event.id) ? 'hide' : 'show'}
                      </button>
                    </td>
                  </tr>
                  {#if open.has(event.id)}
                    <tr>
                      <td colspan="7" class="max-w-0"><JsonView data={event} /></td>
                    </tr>
                  {/if}
                {/each}
              </tbody>
            </table>
          </div>
          <div class="px-3 pb-3">
            <Pager nextCursor={data.events.data.next_cursor} count={events.length} label="events" />
          </div>
        {/if}
      </Card>
    </div>

    <div class="flex min-w-0 flex-col gap-4">
      <form method="get" class="card flex flex-col gap-3 p-5 text-[0.8125rem]">
        <div class="flex flex-col gap-1">
          <label for="type" class="label">Type</label>
          <select id="type" name="type" class="field">
            <option value="" selected={!data.type}>Any</option>
            {#each activityTypes as type (type)}
              <option value={type} selected={data.type === type}>{type}</option>
            {/each}
          </select>
        </div>
        <div class="flex flex-col gap-1">
          <label for="run_id" class="label">Run id</label>
          <input id="run_id" type="text" name="run_id" value={data.runId} class="field" />
        </div>
        <div class="flex flex-col gap-1">
          <label for="player" class="label">Player id</label>
          <input
            id="player"
            type="number"
            min="1"
            name="player"
            value={data.player ?? ''}
            class="field"
          />
        </div>
        <div class="flex flex-col gap-1">
          <label for="since" class="label">From</label>
          <input
            id="since"
            type="datetime-local"
            name="since"
            value={dateInputValue(data.since)}
            class="field"
          />
        </div>
        <div class="flex flex-col gap-1">
          <label for="until" class="label">Until</label>
          <input
            id="until"
            type="datetime-local"
            name="until"
            value={dateInputValue(data.until)}
            class="field"
          />
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <button type="submit" class="btn btn-primary">Apply</button>
          {#if filtered}<a href="/admin/events" class="seg">Clear</a>{/if}
        </div>
      </form>
      <form method="get" class="card flex flex-col gap-3 p-5 text-[0.8125rem]">
        <div class="flex flex-col gap-1">
          <label for="id" class="label">Look up one event by id</label>
          <input
            id="id"
            type="text"
            name="id"
            value={data.lookup}
            class="field"
            placeholder="uuid"
          />
        </div>
        <button type="submit" class="btn self-start">Fetch</button>
      </form>
    </div>
  </div>
</div>
