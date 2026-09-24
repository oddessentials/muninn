<script lang="ts">
  import type { ActivityItem } from '$lib/api/types';
  import { activityMentions } from '$lib/ui/activity';
  import ActivityFeed from '$lib/ui/ActivityFeed.svelte';
  import Card from '$lib/ui/Card.svelte';
  import ErrorNote from '$lib/ui/ErrorNote.svelte';
  import { activityGroups, activityTypeLabel, noisyActivityTypes } from '$lib/ui/labels';
  import { mergeActivity } from '$lib/ui/feed';
  import { useLive } from '$lib/ui/live.svelte';
  import Meta from '$lib/ui/Meta.svelte';
  import PageHeader from '$lib/ui/PageHeader.svelte';
  import Pager from '$lib/ui/Pager.svelte';
  import { dateInputValue } from '$lib/ui/query';

  let { data } = $props();
  const live = useLive();

  const selected = $derived(new Set(data.types));
  const accept = $derived((item: ActivityItem) => {
    if (selected.size > 0 ? !selected.has(item.type) : noisyActivityTypes.includes(item.type))
      return false;
    if (data.player !== undefined && !activityMentions(item, data.player)) return false;
    if (data.since && item.at < data.since) return false;
    return true;
  });
  const items = $derived(
    data.live
      ? mergeActivity(live.activity, data.activity.ok ? data.activity.data.items : [], 60, accept)
      : data.activity.ok
        ? data.activity.data.items
        : []
  );
  const filtered = $derived(
    data.types.length > 0 || data.player !== undefined || Boolean(data.since || data.until)
  );
  const noisySelected = $derived(data.types.some((type) => noisyActivityTypes.includes(type)));
</script>

<Meta
  title="Activity"
  description="Everything the server plugin has reported, newest first, filtered by type and player."
/>

<div class="flex flex-col gap-6">
  <PageHeader
    eyebrow="The ledger"
    note="Every event the server reported, newest first. Heartbeats, position samples, building and creature kills are left out unless you ask for them."
  >
    {#snippet heading()}Activity{/snippet}
  </PageHeader>

  <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
    <Card flush>
      <div class="px-5">
        {#if !data.activity.ok && items.length === 0}
          <div class="py-4"><ErrorNote error={data.activity.error} what="the activity feed" /></div>
        {:else}
          <ActivityFeed
            {items}
            empty={filtered ? 'No events match this filter.' : 'No events recorded yet.'}
            timeMode="absolute"
          />
        {/if}
      </div>
      {#if data.activity.ok}
        <div class="px-3 pb-3">
          <Pager nextCursor={data.activity.data.next_cursor} count={items.length} label="events" />
        </div>
      {/if}
    </Card>

    <form method="get" class="card flex h-fit flex-col gap-4 p-5 text-[0.8125rem]">
      <div class="flex flex-col gap-1">
        <label for="player" class="label">Player</label>
        <select id="player" name="player" class="field">
          <option value="" selected={data.player === undefined}>Anyone</option>
          {#each data.players as player (player.id)}
            <option value={player.id} selected={data.player === player.id}
              >{player.display_name}</option
            >
          {/each}
        </select>
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
      <fieldset class="flex flex-col gap-3">
        <legend class="label mb-2">Event types (none checked shows the usual feed)</legend>
        {#each activityGroups as group (group.label)}
          <div>
            <p class="eyebrow text-[0.6rem] text-accent-deep">{group.label}</p>
            <div class="flex flex-wrap gap-x-3 gap-y-0.5">
              {#each group.types as type (type)}
                <label class="inline-flex items-center gap-1">
                  <input type="checkbox" name="types" value={type} checked={selected.has(type)} />
                  {activityTypeLabel(type)}
                </label>
              {/each}
            </div>
          </div>
        {/each}
      </fieldset>
      {#if noisySelected}
        <p class="text-[0.75rem] text-warning">
          Noisy types can bury everything else; combine them with a player or a time window.
        </p>
      {/if}
      <div class="flex flex-wrap items-center gap-3">
        <button type="submit" class="btn btn-primary">Apply</button>
        {#if filtered}
          <a href="/activity" class="seg">Clear</a>
        {/if}
      </div>
      <p class="note">
        {#if data.live}
          New events appear here as they arrive.
        {:else}
          Live updates pause while you look at older pages.
        {/if}
      </p>
    </form>
  </div>
</div>
