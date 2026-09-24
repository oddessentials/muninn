<script lang="ts">
  import Card from '$lib/ui/Card.svelte';
  import EmptyState from '$lib/ui/EmptyState.svelte';
  import Meta from '$lib/ui/Meta.svelte';
  import PageHeader from '$lib/ui/PageHeader.svelte';
  import ErrorNote from '$lib/ui/ErrorNote.svelte';
  import { bossStanding, forsakenTotal } from '$lib/ui/bosses';
  import { formatNumber } from '$lib/ui/format';
  import { progressionCategoryLabel } from '$lib/ui/labels';
  import PlayerNames from '$lib/ui/PlayerNames.svelte';
  import Time from '$lib/ui/Time.svelte';

  let { data } = $props();

  const bosses = $derived(data.bosses.ok ? data.bosses.data.items : []);
  const path = $derived(bosses.filter((boss) => boss.tier === 'forsaken'));
  const minis = $derived(bosses.filter((boss) => boss.tier === 'mini'));
  const others = $derived(bosses.filter((boss) => boss.tier === 'other'));
  const defeated = $derived(path.filter((boss) => boss.defeat !== null).length);
  const minisDefeated = $derived(minis.filter((boss) => boss.defeat !== null).length);
  const keys = $derived(data.progression.ok ? data.progression.data.items : []);
</script>

{#snippet bossCard(boss: (typeof bosses)[number])}
  <li class="card flex flex-col gap-3 p-5">
    <div class="flex flex-wrap items-start gap-3">
      <span class="display text-2xl leading-none text-ink-faint/70"
        >{String(boss.order).padStart(2, '0')}</span
      >
      <a
        href="/bosses/{boss.key}"
        class="display mt-0.5 text-[1.05rem] leading-tight text-ink hover:text-accent"
        >{boss.name}</a
      >
      <span
        class="chip ml-auto shrink-0 {boss.defeat
          ? 'text-online'
          : boss.active
            ? 'text-warning'
            : 'text-ink-muted'}"
      >
        {bossStanding(boss)}
      </span>
    </div>
    {#if boss.defeat && !boss.defeat.observed}
      <p class="text-[0.8125rem] leading-relaxed">
        Fell before the log began on day {formatNumber(boss.defeat.day)},
        <Time at={boss.defeat.since} mode="date" />. The kill itself is not on record.
      </p>
    {/if}
    {#if boss.first_kill}
      <p class="text-[0.8125rem] leading-relaxed">
        First {boss.defeat?.observed ? 'kill' : 'recorded kill'} on day {formatNumber(
          boss.first_kill.day
        )}, <Time at={boss.first_kill.at} mode="date" />, credited to
        <PlayerNames players={boss.first_kill.participants} empty="nobody in particular" />.
      </p>
    {:else if !boss.defeat && (boss.summons > 0 || boss.engaged > 0)}
      <p class="text-[0.8125rem]">Summoned but not yet defeated.</p>
    {:else if !boss.defeat}
      <p class="note">{boss.tier === 'mini' ? 'Not slain yet.' : 'Not summoned yet.'}</p>
    {/if}
    {#if boss.tier === 'mini'}
      <dl class="mt-auto grid grid-cols-3 gap-2 border-t border-line pt-3 text-[0.8125rem]">
        <div>
          <dt class="stat-label">Kills</dt>
          <dd class="mt-0.5 font-semibold">{formatNumber(boss.kills)}</dd>
        </div>
        <div class="col-span-2">
          <dt class="stat-label">Last kill</dt>
          <dd class="mt-0.5 font-semibold">
            {#if boss.last_kill_at}<Time at={boss.last_kill_at} mode="date" />{:else}Never{/if}
          </dd>
        </div>
      </dl>
    {:else}
      <dl class="mt-auto grid grid-cols-3 gap-2 border-t border-line pt-3 text-[0.8125rem]">
        <div>
          <dt class="stat-label">Summoned</dt>
          <dd class="mt-0.5 font-semibold">{formatNumber(boss.summons)}</dd>
        </div>
        <div>
          <dt class="stat-label">Engaged</dt>
          <dd class="mt-0.5 font-semibold">{formatNumber(boss.engaged)}</dd>
        </div>
        <div>
          <dt class="stat-label">Kills</dt>
          <dd class="mt-0.5 font-semibold">
            {formatNumber(boss.kills)}
            {#if boss.last_kill_at && boss.kills > 1}
              <span class="text-[0.72rem] font-normal text-ink-muted"
                >last <Time at={boss.last_kill_at} mode="date" /></span
              >
            {/if}
          </dd>
        </div>
      </dl>
    {/if}
    {#if boss.tier === 'other'}
      <p class="text-[0.72rem] text-ink-muted">
        Not one of the Forsaken: the world set the key <code>{boss.key}</code>.
      </p>
    {/if}
  </li>
{/snippet}

<Meta
  title="Bosses"
  description="Boss progression on the server and every summon, fight and kill so far."
/>

<div class="flex flex-col gap-6">
  <PageHeader
    eyebrow="The Forsaken"
    note="The {forsakenTotal} Forsaken in the order the game intends, with every summon, engagement and kill the server saw. A boss counts as active from the first engagement until the defeat; Kall Fimbulbringer counts as defeated when his last phase falls."
  >
    {#snippet heading()}Bosses{/snippet}
  </PageHeader>

  {#if !data.bosses.ok}
    <ErrorNote error={data.bosses.error} what="the boss list" />
  {:else if bosses.length === 0}
    <Card><EmptyState message="No boss has been summoned yet." /></Card>
  {:else}
    <p class="note text-[1.2rem] text-ink">
      {defeated} of {path.length} defeated.
      {#if defeated < path.length}
        Next up: {path.find((boss) => boss.defeat === null)?.name}.
      {/if}
    </p>
    <ol id="forsaken" class="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {#each [...path, ...others] as boss (boss.key)}
        {@render bossCard(boss)}
      {/each}
    </ol>

    {#if minis.length > 0}
      <div class="mt-4 flex flex-col gap-1.5">
        <p class="eyebrow">Named foes</p>
        <h2 class="display text-[1.4rem] leading-tight text-ink">Mini-bosses</h2>
        <p
          class="max-w-2xl text-[0.8125rem] leading-relaxed text-ink-muted [text-shadow:0_1px_12px_rgba(0,0,0,0.85)]"
        >
          Foes whose death sets a world key without being a boss to the game: the sea serpent,
          Hildir's three, the Writhan of the swamp and the Eyeless One of the deep north.
          {minisDefeated} of {minis.length} slain.
        </p>
      </div>
      <ol id="mini-bosses" class="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {#each minis as boss (boss.key)}
          {@render bossCard(boss)}
        {/each}
      </ol>
    {/if}
  {/if}

  <Card
    title="World progression keys"
    description="Every global key the world has set, with the day and time the log first saw it."
    flush
  >
    {#if !data.progression.ok}
      <div class="p-4">
        <ErrorNote error={data.progression.error} what="the progression keys" />
      </div>
    {:else if keys.length === 0}
      <EmptyState message="The world has not set any global key yet." />
    {:else}
      <div class="overflow-x-auto">
        <table class="data-table">
          <thead>
            <tr
              ><th>Key</th><th>Value</th><th>Kind</th><th>First seen</th><th class="num">Day</th
              ></tr
            >
          </thead>
          <tbody>
            {#each keys as key (key.key)}
              <tr>
                <td>
                  {#if bosses.some((boss) => boss.key === key.key)}
                    <a href="/bosses/{key.key}" class="text-xs text-accent hover:underline"
                      >{key.key}</a
                    >
                  {:else}
                    <code class="text-xs">{key.key}</code>
                  {/if}
                </td>
                <td>{key.value ?? ''}</td>
                <td>{progressionCategoryLabel(key.category)}</td>
                <td><Time at={key.first_set_at} /></td>
                <td class="num">{formatNumber(key.day)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </Card>
</div>
