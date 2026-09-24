<script lang="ts">
  import { afterNavigate, replaceState } from '$app/navigation';
  import { page } from '$app/state';
  import { onMount, untrack } from 'svelte';
  import Card from '$lib/ui/Card.svelte';
  import ComfortPlanner from '$lib/ui/ComfortPlanner.svelte';
  import EmptyState from '$lib/ui/EmptyState.svelte';
  import ErrorNote from '$lib/ui/ErrorNote.svelte';
  import GameIcon from '$lib/ui/GameIcon.svelte';
  import {
    baseComfort,
    conditionLabel,
    defaultOrder,
    formatBuiltDay,
    groupLabel,
    groupStandings,
    isStale,
    peakComfort,
    restedSeconds,
    seasonWindow,
    shelterComfort,
    topOfGroup,
    type ComfortSort,
    type GroupStanding
  } from '$lib/ui/comfort';
  import { formatDistance, formatDuration, formatNumber } from '$lib/ui/format';
  import Meta from '$lib/ui/Meta.svelte';
  import PageHeader from '$lib/ui/PageHeader.svelte';
  import {
    parsePlan,
    rememberedPlan,
    rememberPlan,
    serializePlan,
    type PlanEntry
  } from '$lib/ui/plan';
  import { withParams } from '$lib/ui/query';
  import RecipeLine from '$lib/ui/RecipeLine.svelte';
  import Stat from '$lib/ui/Stat.svelte';
  import atlasUrl from '$lib/world/comfort-icons.webp';
  import { pieceIcon, recipeOf, statusIcon } from '$lib/world/recipes';

  let { data } = $props();

  const catalogue = $derived(data.comfort.ok ? data.comfort.data.catalogue : null);
  const items = $derived(catalogue?.items ?? []);
  const known = $derived(new Set(items.map((item) => item.prefab)));
  const standings = $derived(catalogue ? groupStandings(catalogue.groups, items) : []);
  const groups = $derived(standings.map((standing) => standing.group));
  const best = $derived(topOfGroup(standings, items));
  const peak = $derived(catalogue ? peakComfort(catalogue.groups, items, false) : 0);
  const seasonalPeak = $derived(catalogue ? peakComfort(catalogue.groups, items, true) : 0);
  const seasonalCount = $derived(items.filter((item) => item.season !== null).length);
  const builtKinds = $derived(items.filter((item) => item.built > 0).length);
  const seasons = $derived(
    new Map((catalogue?.seasons ?? []).map((season) => [season.name, seasonWindow(season)]))
  );
  const stale = $derived(catalogue !== null && isStale(catalogue, data.runningVersion));
  const filtering = $derived(
    Boolean(data.filter.q || data.filter.group || data.filter.lit || data.filter.built)
  );
  const reach = $derived(
    catalogue?.radius_m
      ? `every piece within ${formatDistance(catalogue.radius_m)}`
      : 'nearby pieces'
  );

  let plan = $state<PlanEntry[]>(
    untrack(() => parsePlan(page.url.searchParams.get('plan'), known))
  );
  const planText = $derived(serializePlan(plan));

  const tableAnchor = 'pieces';

  const columns: { key: string; label: string; sort?: ComfortSort; numeric?: boolean }[] = [
    { key: 'name', label: 'Piece', sort: 'name' },
    { key: 'group', label: 'Group', sort: 'group' },
    { key: 'comfort', label: 'Comfort', sort: 'comfort', numeric: true },
    { key: 'counts', label: 'Counts' },
    { key: 'materials', label: 'Materials' },
    { key: 'built', label: 'Built here', sort: 'built', numeric: true },
    { key: 'last', label: 'Last built' }
  ];

  function writePlanUrl(text: string): void {
    const url = new URL(location.href);
    if ((url.searchParams.get('plan') ?? '') === text) return;
    if (text) url.searchParams.set('plan', text);
    else url.searchParams.delete('plan');
    replaceState(url, page.state);
  }

  function commit(next: PlanEntry[]): void {
    plan = next;
    const text = serializePlan(next);
    writePlanUrl(text);
    rememberPlan(text);
  }

  onMount(() => {
    if (page.url.searchParams.has('plan')) return;
    const remembered = parsePlan(rememberedPlan(), known);
    if (remembered.length > 0) plan = remembered;
  });

  afterNavigate(({ type }) => {
    if (type === 'enter') return;
    const incoming = page.url.searchParams.get('plan');
    if (type !== 'popstate' && incoming !== null && incoming !== planText) {
      plan = parsePlan(incoming, known);
      return;
    }
    writePlanUrl(planText);
  });

  function sortHref(sort: ComfortSort): string {
    const order = data.sort === sort ? (data.order === 'asc' ? 'desc' : 'asc') : defaultOrder(sort);
    return `${withParams(page.url, { sort, order, plan: planText })}#${tableAnchor}`;
  }

  const clearHref = $derived(
    `${withParams(new URL('/comfort', page.url), { plan: planText })}#${tableAnchor}`
  );

  function seasonNote(season: string): string {
    const window = seasons.get(season);
    return window ? `${season} only, ${window}` : `${season} only`;
  }

  function lead(standing: GroupStanding) {
    return (
      standing.best.find((piece) => piece.built > 0) ??
      standing.best.find((piece) => piece.season === null) ??
      standing.best[0]
    );
  }
</script>

<Meta
  title="Comfort"
  description="Every building piece that adds comfort, what each one takes to build, a planner that adds up the materials, and which pieces the guild has built."
/>

<svelte:head>
  <link rel="preload" as="image" type="image/webp" href={atlasUrl} />
</svelte:head>

{#snippet pieceTags(piece: (typeof items)[number])}
  {#if piece.condition}
    <span class="text-ember">{conditionLabel(piece.condition)?.toLowerCase()}</span>
  {/if}
  {#if piece.season}
    <span class="text-info">{piece.season} only</span>
  {/if}
{/snippet}

{#snippet rule(effect: 'Resting' | 'Rested' | 'Shelter' | 'CampFire', label: string)}
  <span class="row-span-2 pt-0.5"><GameIcon icon={statusIcon(effect)} size={28} /></span>
  <span class="stat-label self-end">{label}</span>
{/snippet}

<div class="flex flex-col gap-6">
  <PageHeader
    eyebrow="The hearth"
    note="How long Rested lasts depends on comfort, which the game adds up every two seconds from the pieces around you. The list below is read from the server's own game data each time it starts."
  >
    {#snippet heading()}Comfort{/snippet}
  </PageHeader>

  {#if !data.comfort.ok}
    <Card><ErrorNote error={data.comfort.error} what="the comfort catalogue" /></Card>
  {:else if !catalogue}
    <Card>
      <EmptyState
        message="The server plugin sends the comfort catalogue each time the game server starts. It has not arrived yet."
      />
    </Card>
  {:else}
    {#if stale}
      <p class="card px-5 py-3 text-[0.8125rem] text-warning" role="status">
        This list was read from game version {catalogue.game_version}, but the server now runs {data.runningVersion}.
        It refreshes when the server next starts.
      </p>
    {/if}

    <Card title="How it adds up">
      <div class="flex flex-col gap-6">
        <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat
            label="Most comfort"
            value={formatNumber(peak)}
            size="lg"
            detail={seasonalPeak > peak
              ? `${formatNumber(seasonalPeak)} with seasonal pieces`
              : 'every group at its best'}
          />
          <Stat
            label="Rested up to"
            value={formatDuration(restedSeconds(catalogue, peak))}
            size="lg"
            detail={seasonalPeak > peak
              ? `${formatDuration(restedSeconds(catalogue, seasonalPeak))} at ${formatNumber(seasonalPeak)}`
              : `${formatDuration(catalogue.rested_base_s)} at comfort ${baseComfort}`}
          />
          <Stat
            label="Comfort pieces"
            value={formatNumber(items.length)}
            size="lg"
            detail={seasonalCount > 0 ? `${formatNumber(seasonalCount)} seasonal` : ''}
          />
          <Stat
            label="Built here"
            value={formatNumber(builtKinds)}
            size="lg"
            detail={`of ${formatNumber(items.length)} kinds, placed since the log began`}
          />
        </div>

        <div class="grid gap-x-10 gap-y-6 border-t border-line pt-5 lg:grid-cols-5">
          <ol class="flex flex-col gap-4 text-[0.8125rem] leading-relaxed lg:col-span-2">
            <li class="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3 gap-y-1">
              {@render rule('Shelter', 'Shelter')}
              <span
                >Comfort starts at {baseComfort}. Being sheltered, under a roof and mostly enclosed,
                adds {shelterComfort} and lets {reach} count.</span
              >
            </li>
            <li class="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3 gap-y-1">
              {@render rule('Resting', 'Groups')}
              <span
                >Each group counts once, for its best piece nearby. Pieces without a group all add
                up, unless they are the same piece.</span
              >
            </li>
            <li class="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3 gap-y-1">
              {@render rule('CampFire', 'Fire')}
              <span
                >Pieces marked <span class="text-ember">while lit</span> add nothing once their fire
                is out. Those marked <span class="text-ember">while lit and dry</span> also stop counting
                when rain or strong wind dampens the fire.</span
              >
            </li>
            <li class="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3 gap-y-1">
              {@render rule('Rested', 'Rested')}
              <span
                >Rested lasts {formatDuration(catalogue.rested_base_s)} at comfort {baseComfort} and {formatDuration(
                  catalogue.rested_per_level_s
                )} longer for each level above it.</span
              >
            </li>
          </ol>

          <ol class="flex flex-col lg:col-span-3" aria-label="The best piece of each group">
            {#each standings as standing (standing.group)}
              {@const face = lead(standing)}
              <li
                class="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3.5 gap-y-1 border-b border-line py-2.5 last:border-b-0 sm:grid-cols-[auto_minmax(0,1fr)_auto]"
              >
                <span
                  class="slot row-span-2 h-11 w-11 sm:row-span-1"
                  data-built={standing.built > 0 || undefined}
                >
                  {#if face}
                    <GameIcon icon={pieceIcon(face.prefab)} size={36} />
                  {/if}
                </span>
                <div class="flex min-w-0 flex-col gap-0.5">
                  <span class="display text-[0.8rem] tracking-wider text-ink"
                    >{groupLabel(standing.group)}</span
                  >
                  <span class="flex flex-wrap gap-x-1.5 text-[0.8125rem] text-ink-muted">
                    {#each standing.best as piece (piece.prefab)}
                      <span class="not-last:after:content-[',']"
                        ><span class="whitespace-nowrap {piece.built > 0 ? 'text-ink' : ''}"
                          >{piece.name}</span
                        >{#if piece.condition || piece.season}<wbr /><span
                            class="ml-1.5 text-[0.72rem] whitespace-nowrap"
                            >· {@render pieceTags(piece)}</span
                          >{/if}</span
                      >
                    {/each}
                  </span>
                  {#if standing.stacks}
                    <span class="text-[0.72rem] text-ink-faint"
                      >Each different piece adds its own.</span
                    >
                  {/if}
                </div>
                <div
                  class="col-start-2 flex items-baseline gap-2 sm:col-start-auto sm:flex-col sm:items-end sm:gap-0.5 sm:text-right"
                >
                  <span class="font-semibold text-accent">+{formatNumber(standing.adds)}</span>
                  <span
                    class="text-[0.68rem] tracking-wide whitespace-nowrap uppercase {standing.built >
                    0
                      ? 'text-online'
                      : 'text-ink-faint'}"
                  >
                    {#if standing.stacks && standing.built > 0 && standing.built < standing.best.length}
                      {standing.built} of {standing.best.length} built
                    {:else if standing.built > 0}
                      Built
                    {:else}
                      Not yet
                    {/if}
                  </span>
                </div>
              </li>
            {/each}
          </ol>
        </div>
      </div>
    </Card>

    <Card title="Plan a build" id="planner">
      <ComfortPlanner {catalogue} {plan} onchange={commit} />
    </Card>

    <Card title="Every comfort piece" id={tableAnchor} flush>
      {#key page.url.search}
        <form
          method="get"
          action="#{tableAnchor}"
          class="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3 text-[0.8125rem]"
        >
          <input type="hidden" name="sort" value={data.sort} />
          <input type="hidden" name="order" value={data.order} />
          {#if planText}
            <input type="hidden" name="plan" value={planText} />
          {/if}
          <label class="flex items-center gap-2">
            <span class="sr-only">Search pieces</span>
            <input
              type="search"
              name="q"
              value={data.filter.q ?? ''}
              placeholder="Piece or game id"
              class="field w-48"
            />
          </label>
          <select name="group" class="field" aria-label="Group" value={data.filter.group ?? ''}>
            <option value="">All groups</option>
            {#each groups as group (group)}
              <option value={group}>{groupLabel(group)}</option>
            {/each}
          </select>
          <label class="label flex items-center gap-2 whitespace-nowrap text-ink">
            <input type="checkbox" name="lit" value="true" checked={data.filter.lit} />
            Needs a fire
          </label>
          <label class="label flex items-center gap-2 whitespace-nowrap text-ink">
            <input type="checkbox" name="built" value="true" checked={data.filter.built} />
            Built here
          </label>
          <button type="submit" class="btn">Filter</button>
          {#if filtering}
            <a href={clearHref} class="seg">Clear</a>
          {/if}
          <span class="ml-auto text-[0.72rem] whitespace-nowrap text-ink-muted" role="status">
            {filtering
              ? `${formatNumber(data.rows.length)} of ${formatNumber(items.length)} pieces`
              : `${formatNumber(items.length)} pieces`}
          </span>
        </form>
      {/key}
      {#if data.rows.length === 0}
        <div class="px-3">
          <EmptyState
            message={filtering
              ? 'No comfort piece matches this filter.'
              : 'The catalogue lists no comfort pieces.'}
          />
        </div>
      {:else}
        <p class="flex items-center gap-2 px-5 pt-3 text-[0.72rem] text-ink-muted">
          <span class="diamond bg-accent" aria-hidden="true"></span>
          Best of its group: only the best piece of a group counts. Built here counts pieces players placed,
          not the furniture the game puts in villages, camps and forts.
        </p>
        <div class="overflow-x-auto">
          <table class="data-table [&_td]:align-middle">
            <thead>
              <tr>
                {#each columns as column (column.key)}
                  <th
                    class={column.numeric ? 'num' : ''}
                    aria-sort={data.sort === column.sort
                      ? data.order === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : undefined}
                  >
                    {#if column.sort}
                      <a href={sortHref(column.sort)} class="hover:text-accent hover:underline">
                        {column.label}{data.sort === column.sort
                          ? data.order === 'asc'
                            ? ' ↑'
                            : ' ↓'
                          : ''}
                      </a>
                    {:else}
                      {column.label}
                    {/if}
                  </th>
                {/each}
              </tr>
            </thead>
            <tbody>
              {#each data.rows as piece (piece.prefab)}
                {@const recipe = recipeOf(piece.prefab)}
                <tr>
                  <td>
                    <div class="flex items-center gap-2.5">
                      {#if best.has(piece.prefab)}
                        <span
                          class="diamond bg-accent shadow-[0_0_6px_rgba(217,171,74,0.55)]"
                          role="img"
                          aria-label="Best of its group"
                        ></span>
                      {:else}
                        <span class="diamond invisible" aria-hidden="true"></span>
                      {/if}
                      <span class="slot h-10 w-10"
                        ><GameIcon icon={pieceIcon(piece.prefab)} size={34} /></span
                      >
                      <div class="flex min-w-0 flex-col">
                        <span class="font-semibold whitespace-nowrap text-ink">{piece.name}</span>
                        <span class="text-[0.72rem] text-ink-muted">
                          <code>{piece.prefab}</code>
                          {#if piece.season}
                            <span class="whitespace-nowrap text-info"
                              >· {seasonNote(piece.season)}</span
                            >
                          {/if}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td class="whitespace-nowrap">{groupLabel(piece.group)}</td>
                  <td class="num font-semibold text-accent">+{formatNumber(piece.comfort)}</td>
                  <td>
                    {#if piece.condition}
                      <span class="chip text-ember">{conditionLabel(piece.condition)}</span>
                    {:else}
                      <span class="text-ink-faint">Always</span>
                    {/if}
                  </td>
                  <td>
                    {#if recipe}
                      <div class="w-max max-w-[11rem]"><RecipeLine {recipe} /></div>
                    {:else}
                      <span class="text-ink-faint">Unknown</span>
                    {/if}
                  </td>
                  <td class="num">
                    {#if piece.built > 0}
                      {formatNumber(piece.built)}
                    {:else}
                      <span class="text-ink-faint">0</span>
                    {/if}
                  </td>
                  <td class="whitespace-nowrap">
                    {#if piece.last_built}
                      <time datetime={piece.last_built}>{formatBuiltDay(piece.last_built)}</time>
                    {:else}
                      <span class="text-ink-faint">Never</span>
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
</div>
