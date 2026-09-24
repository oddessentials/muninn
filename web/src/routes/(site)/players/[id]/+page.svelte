<script lang="ts">
  import { page } from '$app/state';
  import { activityMentions } from '$lib/ui/activity';
  import ActivityFeed from '$lib/ui/ActivityFeed.svelte';
  import BiomeTag from '$lib/ui/BiomeTag.svelte';
  import Card from '$lib/ui/Card.svelte';
  import EmptyState from '$lib/ui/EmptyState.svelte';
  import ErrorNote from '$lib/ui/ErrorNote.svelte';
  import {
    formatDistance,
    formatDuration,
    formatHours,
    formatNumber,
    formatPosition
  } from '$lib/ui/format';
  import { causeLabel, deathCauseKeyLabel, leftReasonLabel, prefabLabel } from '$lib/ui/labels';
  import { mergeActivity } from '$lib/ui/feed';
  import { useLive } from '$lib/ui/live.svelte';
  import type { MapMarker, MapTrack } from '$lib/ui/map';
  import Meta from '$lib/ui/Meta.svelte';
  import PageHeader from '$lib/ui/PageHeader.svelte';
  import Pager from '$lib/ui/Pager.svelte';
  import PlatformTag from '$lib/ui/PlatformTag.svelte';
  import PlayerLink from '$lib/ui/PlayerLink.svelte';
  import { withParams } from '$lib/ui/query';
  import Stat from '$lib/ui/Stat.svelte';
  import Time from '$lib/ui/Time.svelte';
  import WorldMap from '$lib/ui/WorldMap.svelte';

  let { data } = $props();
  const live = useLive();

  const player = $derived(data.player);
  const stats = $derived(player.stats);
  const liveEntry = $derived(
    live.online?.items.find((entry) => entry.player_id === player.id) ?? null
  );
  const online = $derived(live.online ? liveEntry !== null : player.online);
  const track = $derived<MapTrack[]>(
    data.positions.ok && data.positions.data.items.length > 1
      ? [
          {
            label: `Path over the last ${data.range}`,
            points: [...data.positions.data.items]
              .sort((a, b) => (a.ts < b.ts ? -1 : 1))
              .map((position) => ({ x: position.x, z: position.z }))
          }
        ]
      : []
  );
  const sampleWindow = $derived.by(() => {
    const items = data.positions.ok ? data.positions.data.items : [];
    const stamps = items.map((position) => position.ts).sort();
    return { first: stamps[0] ?? null, last: stamps[stamps.length - 1] ?? null };
  });
  const markers = $derived.by<MapMarker[]>(() => {
    const out: MapMarker[] = [];
    const current = liveEntry ?? player.current_session;
    if (current && online) {
      out.push({
        x: current.x,
        z: current.z,
        label: `${player.display_name} now`,
        kind: 'player'
      });
    }
    if (data.deaths.ok) {
      for (const death of data.deaths.data.items) {
        out.push({
          x: death.x,
          z: death.z,
          label: `Died on day ${death.day}: ${causeLabel(death.cause)}`,
          kind: 'death'
        });
      }
    }
    return out;
  });
  const activity = $derived(
    mergeActivity(live.activity, data.activity.ok ? data.activity.data.items : [], 30, (item) =>
      activityMentions(item, player.id)
    )
  );
  const causes = $derived(Object.entries(player.deaths_by_cause).sort((a, b) => b[1] - a[1]));
  const sections = [
    ['map', 'Map'],
    ['biomes', 'Biomes'],
    ['deaths', 'Deaths'],
    ['kills', 'Kills'],
    ['bosses', 'Bosses and raids'],
    ['structures', 'Structures'],
    ['sessions', 'Sessions'],
    ['activity', 'Activity']
  ];
</script>

<Meta
  title={player.display_name}
  description={`${player.display_name}: playtime, deaths, kills, biomes, bosses and recent sessions on the server.`}
/>

<div class="flex flex-col gap-6">
  <PageHeader eyebrow="Character file">
    {#snippet heading()}
      <span class="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span class="lamp size-3 {online ? 'text-online' : 'text-line-strong'}" aria-hidden="true"
        ></span>
        {player.display_name}
      </span>
    {/snippet}
    {#snippet aside()}
      <div class="flex flex-wrap items-center gap-3 text-[0.8125rem]">
        <PlatformTag platform={player.platform} />
        {#if online}
          <span class="ticker text-online">online now</span>
        {:else}
          <span class="ticker">last seen <Time at={player.last_seen} mode="relative" /></span>
        {/if}
      </div>
    {/snippet}
    <div class="flex flex-col gap-4">
      <dl class="charfile glass px-5 py-4">
        <dt>Display id</dt>
        <dd>
          <code class="text-accent-bright/90">{player.display_id}</code>
          <span class="text-[0.72rem] text-ink-muted"
            >for the F2 panel and the admin, ban and permit lists</span
          >
        </dd>
        <dt>Platform id</dt>
        <dd><code>{player.platform_user_id}</code></dd>
        {#if player.aliases.length > 0}
          <dt>Merged ids</dt>
          <dd><code>{player.aliases.join(', ')}</code></dd>
        {/if}
        <dt>Characters</dt>
        <dd>
          {#if player.characters.length === 0}
            <span class="text-ink-muted">none seen yet</span>
          {:else}
            <ul class="flex flex-wrap gap-x-4 gap-y-0.5">
              {#each player.characters as character (character.character_id)}
                <li>
                  <span class="font-semibold">{character.name}</span>
                  <span class="text-[0.72rem] text-ink-muted">
                    <Time at={character.first_seen} mode="date" /> to <Time
                      at={character.last_seen}
                      mode="date"
                    />
                  </span>
                </li>
              {/each}
            </ul>
          {/if}
        </dd>
      </dl>
      <nav
        class="-mx-2 flex flex-wrap gap-x-1 gap-y-1 [text-shadow:0_1px_8px_rgba(0,0,0,0.9)]"
        aria-label="Sections on this page"
      >
        {#each sections as [id, label] (id)}
          <a href="#{id}" class="seg">{label}</a>
        {/each}
      </nav>
    </div>
  </PageHeader>

  <Card>
    <div class="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4 lg:grid-cols-6">
      <Stat
        label="Playtime"
        value={formatHours(stats.playtime_s)}
        detail="{formatNumber(stats.sessions)} sessions"
      />
      <Stat label="Deaths" value={formatNumber(stats.deaths)} />
      <Stat
        label="Kills credited"
        value={formatNumber(stats.kills_credited)}
        detail="{formatNumber(stats.kills_nearby)} more nearby"
      />
      <Stat
        label="Boss kills"
        value={formatNumber(stats.boss_kills)}
        detail="{formatNumber(stats.raids)} raids"
      />
      <Stat
        label="Pieces built"
        value={formatNumber(stats.structures_built)}
        detail="{formatNumber(stats.structures_destroyed)} destroyed"
      />
      <Stat
        label="Travelled"
        value={formatDistance(stats.distance_m)}
        detail="{formatNumber(stats.shouts)} shouts"
      />
      <Stat label="First seen"><Time at={player.first_seen} mode="date" /></Stat>
      <Stat label="Last seen"><Time at={player.last_seen} mode="relative" /></Stat>
      {#if player.current_session && online}
        <Stat
          label="Playing as"
          value={liveEntry?.character_name ?? player.current_session.character_name}
        >
          {liveEntry?.character_name ?? player.current_session.character_name}
        </Stat>
        <Stat label="Joined"
          ><Time at={liveEntry?.since ?? player.current_session.joined_at} mode="relative" /></Stat
        >
        <Stat label="Currently in">
          <BiomeTag biome={liveEntry?.biome ?? player.current_session.biome} />
        </Stat>
        <Stat
          label="Position"
          value={formatPosition(
            liveEntry?.x ?? player.current_session.x,
            liveEntry?.z ?? player.current_session.z
          )}
        />
      {/if}
    </div>
  </Card>

  <Card id="map" title="Where they have been" flush>
    {#snippet actions()}
      {#each ['1h', '6h', '24h', '7d'] as range (range)}
        <a
          href={withParams(page.url, { range })}
          class="seg"
          aria-current={data.range === range ? 'true' : undefined}>{range}</a
        >
      {/each}
    {/snippet}
    <div class="grid gap-5 p-5 lg:grid-cols-[2fr_1fr]">
      <WorldMap
        map={data.world.ok ? data.world.data.map : null}
        src={data.mapSrc}
        {markers}
        tracks={track}
        focus={track.length > 0 || markers.length > 0 ? 'markers' : 'world'}
        caption="Recent path and deaths of {player.display_name}"
      />
      <div class="flex flex-col gap-3 text-[0.8125rem] leading-relaxed">
        {#if !data.positions.ok}
          <ErrorNote error={data.positions.error} what="the position samples" />
        {:else if data.positions.data.items.length === 0}
          <p class="note">
            No position samples in the last {data.range}. Samples are taken every 20 s while online
            and kept for 7 days.
          </p>
        {:else}
          <p>
            {formatNumber(data.positions.data.items.length)} position samples in the last {data.range},
            drawn as a path from <Time at={sampleWindow.first} mode="relative" /> to
            <Time at={sampleWindow.last} mode="relative" />. Deaths are marked in red.
          </p>
        {/if}
        {#if !data.world.ok}
          <ErrorNote error={data.world.error} what="the world map" />
        {/if}
      </div>
    </div>
  </Card>

  <Card id="biomes" title="Biomes discovered" flush>
    {#if player.biomes.length === 0}
      <EmptyState message="No biome visits recorded yet." />
    {:else}
      <div class="overflow-x-auto">
        <table class="data-table">
          <thead>
            <tr
              ><th>Biome</th><th>First entered</th><th class="num">Day</th><th>Last visit</th><th
                class="num">Visits</th
              ></tr
            >
          </thead>
          <tbody>
            {#each player.biomes as visit (visit.biome)}
              <tr>
                <td><BiomeTag biome={visit.biome} /></td>
                <td><Time at={visit.first_at} /></td>
                <td class="num">{formatNumber(visit.first_day)}</td>
                <td><Time at={visit.last_at} mode="relative" /></td>
                <td class="num">{formatNumber(visit.visits)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </Card>

  <Card
    id="deaths"
    title="Deaths"
    description="The cause is known only when the fatal hit passed through the server."
    flush
  >
    {#if causes.length > 0}
      <p class="flex flex-wrap gap-2 px-5 pt-4">
        {#each causes as [cause, count] (cause)}
          <span class="chip">{deathCauseKeyLabel(cause)}: {count}</span>
        {/each}
      </p>
    {/if}
    {#if !data.deaths.ok}
      <div class="p-4"><ErrorNote error={data.deaths.error} what="the death list" /></div>
    {:else if data.deaths.data.items.length === 0}
      <EmptyState message="No deaths yet." />
    {:else}
      <div class="overflow-x-auto pt-2">
        <table class="data-table">
          <thead>
            <tr
              ><th>When</th><th class="num">Day</th><th>Biome</th><th>Position</th><th>Cause</th
              ></tr
            >
          </thead>
          <tbody>
            {#each data.deaths.data.items as death (death.id)}
              <tr>
                <td><Time at={death.at} /></td>
                <td class="num">{formatNumber(death.day)}</td>
                <td><BiomeTag biome={death.biome} /></td>
                <td class="whitespace-nowrap">{formatPosition(death.x, death.z)}</td>
                <td>
                  {#if death.cause?.hit_type === 'PlayerHit' && death.cause.attacker}
                    Killed by <PlayerLink player={death.cause.attacker} />
                  {:else}
                    <span class={death.cause ? '' : 'text-ink-muted'}
                      >{causeLabel(death.cause)}</span
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

  <Card
    id="kills"
    title="Kills"
    description="Credited: the player's damage registered on the creature. Nearby: the player was in range when it died."
    flush
  >
    {#if !data.kills.ok}
      <div class="p-4"><ErrorNote error={data.kills.error} what="the kill statistics" /></div>
    {:else if data.kills.data.by_creature.length === 0 && data.kills.data.recent.length === 0}
      <EmptyState message="No kills recorded yet." />
    {:else}
      <div class="grid grid-cols-1 gap-5 p-5 lg:grid-cols-2">
        <div class="min-w-0 overflow-x-auto">
          <h3 class="label mb-2 font-sans">
            By creature, {formatNumber(data.kills.data.credited)} credited and {formatNumber(
              data.kills.data.nearby
            )} nearby
          </h3>
          <table class="data-table">
            <thead
              ><tr><th>Creature</th><th class="num">Credited</th><th class="num">Nearby</th></tr
              ></thead
            >
            <tbody>
              {#each data.kills.data.by_creature as row (row.creature)}
                <tr
                  ><td>{row.creature}</td><td class="num">{formatNumber(row.credited)}</td><td
                    class="num">{formatNumber(row.nearby)}</td
                  ></tr
                >
              {/each}
            </tbody>
          </table>
        </div>
        <div class="min-w-0 overflow-x-auto">
          <h3 class="label mb-2 font-sans">Most recent</h3>
          <table class="data-table">
            <thead
              ><tr><th>When</th><th>Creature</th><th class="num">Level</th><th>Basis</th></tr
              ></thead
            >
            <tbody>
              {#each data.kills.data.recent.slice(0, 20) as kill, index (index)}
                <tr>
                  <td><Time at={kill.at} mode="relative" /></td>
                  <td>{kill.creature}{kill.boss ? ' (boss)' : ''}</td>
                  <td class="num">{kill.level}</td>
                  <td>{kill.basis}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/if}
  </Card>

  <Card id="bosses" title="Bosses and raids" flush>
    <div class="grid grid-cols-1 gap-5 p-5 lg:grid-cols-2">
      <div class="min-w-0 overflow-x-auto">
        <h3 class="label mb-2 font-sans">Boss fights</h3>
        {#if player.boss_participation.length === 0}
          <p class="note">Not part of any boss kill yet.</p>
        {:else}
          <table class="data-table">
            <thead><tr><th>Boss</th><th>When</th><th class="num">Day</th><th>Role</th></tr></thead>
            <tbody>
              {#each player.boss_participation as fight, index (index)}
                <tr>
                  <td
                    ><a href="/bosses/{fight.key}" class="font-semibold text-accent hover:underline"
                      >{fight.name}</a
                    ></td
                  >
                  <td><Time at={fight.at} /></td>
                  <td class="num">{formatNumber(fight.day)}</td>
                  <td>{fight.role === 'credited' ? 'credited' : 'nearby'}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </div>
      <div class="min-w-0 overflow-x-auto">
        <h3 class="label mb-2 font-sans">Raids</h3>
        {#if player.raids.length === 0}
          <p class="note">No raids nearby yet.</p>
        {:else}
          <table class="data-table">
            <thead
              ><tr><th>Raid</th><th>When</th><th class="num">Day</th><th>Outcome</th></tr></thead
            >
            <tbody>
              {#each player.raids as raid (raid.id)}
                <tr>
                  <td
                    ><a href="/raids/{raid.id}" class="font-semibold text-accent hover:underline"
                      >{raid.label}</a
                    ></td
                  >
                  <td><Time at={raid.at} /></td>
                  <td class="num">{formatNumber(raid.day)}</td>
                  <td class={raid.survived ? 'text-online' : 'text-offline'}
                    >{raid.survived ? 'survived' : 'died'}</td
                  >
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </div>
    </div>
  </Card>

  <Card id="structures" title="Structures" flush>
    {#if !data.structures.ok}
      <div class="p-4">
        <ErrorNote error={data.structures.error} what="the building statistics" />
      </div>
    {:else if data.structures.data.built === 0 && data.structures.data.destroyed === 0}
      <EmptyState message="Nothing built yet." />
    {:else}
      <div class="grid grid-cols-1 gap-5 p-5 lg:grid-cols-2">
        <div class="min-w-0 overflow-x-auto">
          <h3 class="label mb-2 font-sans">
            {formatNumber(data.structures.data.built)} pieces built, {formatNumber(
              data.structures.data.destroyed
            )} destroyed
          </h3>
          <table class="data-table">
            <thead><tr><th>Piece</th><th class="num">Built</th></tr></thead>
            <tbody>
              {#each data.structures.data.by_prefab as row (row.prefab)}
                <tr
                  ><td><code class="text-xs">{row.prefab}</code></td><td class="num"
                    >{formatNumber(row.built)}</td
                  ></tr
                >
              {/each}
            </tbody>
          </table>
        </div>
        <div class="min-w-0 overflow-x-auto">
          <h3 class="label mb-2 font-sans">Most recent</h3>
          <table class="data-table">
            <thead><tr><th>When</th><th>Piece</th><th>Biome</th><th>Position</th></tr></thead>
            <tbody>
              {#each data.structures.data.recent.slice(0, 20) as row, index (index)}
                <tr>
                  <td><Time at={row.at} mode="relative" /></td>
                  <td><code class="text-xs">{prefabLabel(row.prefab)}</code></td>
                  <td><BiomeTag biome={row.biome} /></td>
                  <td class="whitespace-nowrap">{formatPosition(row.x, row.z)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/if}
  </Card>

  <Card id="sessions" title="Sessions" flush>
    {#if !data.sessions.ok}
      <div class="p-4"><ErrorNote error={data.sessions.error} what="the session history" /></div>
    {:else if data.sessions.data.items.length === 0}
      <EmptyState message="No sessions yet." />
    {:else}
      <div class="overflow-x-auto">
        <table class="data-table">
          <thead>
            <tr
              ><th>Joined</th><th>Left</th><th class="num">Duration</th><th>Character</th><th
                >Ended by</th
              ><th>Run</th></tr
            >
          </thead>
          <tbody>
            {#each data.sessions.data.items as session (session.id)}
              <tr>
                <td><Time at={session.joined_at} /></td>
                <td><Time at={session.left_at} fallback="still online" /></td>
                <td class="num"
                  >{session.duration_s === null ? '' : formatDuration(session.duration_s)}</td
                >
                <td>{session.character_name}</td>
                <td>{leftReasonLabel(session.left_reason)}</td>
                <td
                  ><code class="text-xs" title={session.run_id}>{session.run_id.slice(0, 8)}</code
                  ></td
                >
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <div class="px-3 pb-3">
        <Pager
          nextCursor={data.sessions.data.next_cursor}
          count={data.sessions.data.items.length}
          label="sessions"
        />
      </div>
    {/if}
  </Card>

  <Card id="activity" title="Activity" flush>
    <div class="px-5">
      {#if !data.activity.ok && activity.length === 0}
        <ErrorNote error={data.activity.error} what="the activity feed" />
      {:else}
        <ActivityFeed items={activity} empty="No activity recorded yet." />
      {/if}
    </div>
  </Card>
</div>
