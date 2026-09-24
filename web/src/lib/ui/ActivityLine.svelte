<script lang="ts">
  import type { ActivityItem } from '$lib/api/types';
  import { describeActivity, type ActivityTone } from './activity';
  import { formatPosition } from './format';
  import { activityTypeLabel } from './labels';
  import PlayerLink from './PlayerLink.svelte';
  import PlayerNames from './PlayerNames.svelte';
  import Time from './Time.svelte';

  let {
    item,
    showDay = true,
    timeMode = 'relative',
    compact = false
  }: {
    item: ActivityItem;
    showDay?: boolean;
    timeMode?: 'relative' | 'absolute';
    compact?: boolean;
  } = $props();

  const view = $derived(describeActivity(item));
  const toneClass: Record<ActivityTone, string> = {
    neutral: 'bg-line-strong',
    good: 'bg-online',
    bad: 'bg-offline',
    warn: 'bg-warning',
    info: 'bg-info'
  };
</script>

<li class="flex gap-3.5 {compact ? 'py-1.5' : 'py-2.5'} text-[0.8125rem]" data-type={item.type}>
  <span class="diamond mt-2 {toneClass[view.tone]}" aria-hidden="true"></span>
  <div class="min-w-0 flex-1">
    <p class="leading-snug">
      {#each view.parts as part, index (index)}
        {#if part.kind === 'text'}{part.text}{:else if part.kind === 'player'}<PlayerLink
            player={part.player}
          />{:else if part.kind === 'players'}<PlayerNames
            players={part.players}
            empty={part.empty}
          />{:else if part.kind === 'link'}<a
            href={part.href}
            class="font-semibold text-accent hover:text-accent-bright hover:underline"
            >{part.text}</a
          >{:else if part.kind === 'code'}<code
            class="bg-surface-sunken px-1 text-xs text-accent-bright/90">{part.text}</code
          >{:else}<q class="note text-[1.05rem] text-ink">{part.text}</q>{/if}
      {/each}
    </p>
    <p class="mt-0.5 flex flex-wrap gap-x-3 text-[0.7rem] text-ink-muted">
      {#if !compact}<span class="label whitespace-nowrap">{activityTypeLabel(item.type)}</span>{/if}
      <Time at={item.at} mode={timeMode} />
      {#if showDay && !compact}<span>day {item.day}</span>{/if}
      {#if view.place && !compact}<span title="World position x, z"
          >at {formatPosition(view.place.x, view.place.z)}</span
        >{/if}
    </p>
  </div>
</li>
