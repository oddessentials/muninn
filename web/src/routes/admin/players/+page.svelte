<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { ApiError, api } from '$lib/api/client';
  import type { AdminPlayer } from '$lib/api/types';
  import Card from '$lib/ui/Card.svelte';
  import EmptyState from '$lib/ui/EmptyState.svelte';
  import ErrorNote from '$lib/ui/ErrorNote.svelte';
  import { formatHours, formatNumber } from '$lib/ui/format';
  import Meta from '$lib/ui/Meta.svelte';
  import PageHeader from '$lib/ui/PageHeader.svelte';
  import Pager from '$lib/ui/Pager.svelte';
  import PlatformTag from '$lib/ui/PlatformTag.svelte';
  import Time from '$lib/ui/Time.svelte';

  let { data } = $props();

  let filter = $state('');
  let message = $state('');
  let busyId = $state<number | null>(null);
  let editing = $state<{ id: number; value: string } | null>(null);
  let merging = $state<{ id: number; into: number | null; confirmed: boolean } | null>(null);

  const players = $derived(data.players.ok ? data.players.data.items : []);
  const shown = $derived(
    players.filter((player) => {
      const needle = filter.trim().toLowerCase();
      if (!needle) return true;
      return [player.display_name, player.platform_user_id, player.display_id, ...player.characters]
        .join(' ')
        .toLowerCase()
        .includes(needle);
    })
  );

  async function act(id: number, work: () => Promise<unknown>, done: string) {
    busyId = id;
    message = '';
    try {
      await work();
      message = done;
      editing = null;
      merging = null;
      await invalidateAll();
    } catch (error) {
      if (error instanceof ApiError && error.status === 403)
        message = 'The request was refused: admin changes must come from this site.';
      else if (error instanceof ApiError && error.status === 401)
        message = 'Your admin session has ended. Log in again.';
      else if (error instanceof ApiError && error.status === 409)
        message = `Not allowed: ${error.message}`;
      else message = error instanceof Error ? error.message : String(error);
    } finally {
      busyId = null;
    }
  }

  function rename(player: AdminPlayer) {
    const value = editing?.value.trim() ?? '';
    return act(
      player.id,
      () =>
        api.updateAdminPlayer(player.id, { display_name_override: value === '' ? null : value }),
      value === ''
        ? `Cleared the override for ${player.display_name}.`
        : `Renamed player ${player.id} to ${value}.`
    );
  }

  function toggleHidden(player: AdminPlayer) {
    return act(
      player.id,
      () => api.updateAdminPlayer(player.id, { hidden: !player.hidden }),
      player.hidden
        ? `${player.display_name} is visible again.`
        : `${player.display_name} is hidden from the site.`
    );
  }

  function merge(player: AdminPlayer) {
    if (!merging || merging.id !== player.id || merging.into === null) return;
    const into = merging.into;
    const target = players.find((entry) => entry.id === into);
    return act(
      player.id,
      () => api.mergeAdminPlayer(player.id, into),
      `Merged ${player.display_name} into ${target?.display_name ?? into}.`
    );
  }

  function removeAlias(player: AdminPlayer, alias: string) {
    return act(
      player.id,
      () => api.deleteAdminPlayerAlias(player.id, alias),
      `Removed ${alias} from ${player.display_name}.`
    );
  }
</script>

<Meta title="Admin players" description="Merge, hide and rename players." />

<div class="flex flex-col gap-6">
  <PageHeader
    eyebrow="Admin"
    note="Rename, hide or merge players. A hidden player disappears from every public page and appears as &quot;someone&quot; wherever they are mentioned."
  >
    {#snippet heading()}Players{/snippet}
    {#snippet aside()}
      <label class="flex items-center gap-2 text-[0.8125rem]">
        <span class="sr-only">Filter players</span>
        <input
          type="search"
          placeholder="Filter by name or id"
          bind:value={filter}
          class="field w-56"
        />
      </label>
    {/snippet}
  </PageHeader>

  {#if message}
    <p class="glass px-4 py-2 text-[0.8125rem]" role="status">{message}</p>
  {/if}

  <Card flush>
    {#if !data.players.ok}
      <div class="p-4"><ErrorNote error={data.players.error} what="the player list" /></div>
    {:else if shown.length === 0}
      <EmptyState message={filter ? 'No players match the filter.' : 'No players yet.'} />
    {:else}
      <div class="overflow-x-auto">
        <table class="data-table">
          <thead>
            <tr>
              <th>Player</th>
              <th>Ids</th>
              <th class="num">Playtime</th>
              <th>Last seen</th>
              <th>Name override</th>
              <th>Visibility</th>
              <th>Merge</th>
            </tr>
          </thead>
          <tbody>
            {#each shown as player (player.id)}
              <tr class={player.hidden ? 'opacity-70' : ''}>
                <td>
                  <div class="flex flex-wrap items-center gap-2">
                    <a href="/players/{player.id}" class="font-semibold text-accent hover:underline"
                      >{player.display_name}</a
                    >
                    <PlatformTag platform={player.platform} />
                    {#if player.hidden}<span class="chip text-warning">hidden</span>{/if}
                    {#if player.online}<span class="chip text-online">online</span>{/if}
                  </div>
                  <div class="text-[0.72rem] text-ink-muted">
                    #{player.id}, characters: {player.characters.join(', ') || 'none'}
                  </div>
                </td>
                <td class="text-xs">
                  <div>{player.platform_user_id}</div>
                  <div class="text-ink-muted">{player.display_id}</div>
                  {#each player.aliases as alias (alias)}
                    <div class="flex items-center gap-2">
                      <span>{alias}</span>
                      <button
                        type="button"
                        class="text-danger hover:underline"
                        disabled={busyId === player.id}
                        onclick={() => removeAlias(player, alias)}>remove</button
                      >
                    </div>
                  {/each}
                </td>
                <td class="num">{formatHours(player.playtime_s)}</td>
                <td><Time at={player.last_seen} mode="relative" /></td>
                <td>
                  {#if editing?.id === player.id}
                    <form
                      class="flex items-center gap-1"
                      onsubmit={(event) => {
                        event.preventDefault();
                        rename(player);
                      }}
                    >
                      <input
                        type="text"
                        bind:value={editing.value}
                        class="field w-36"
                        placeholder="Leave empty to clear"
                      />
                      <button type="submit" class="btn" disabled={busyId === player.id}>Save</button
                      >
                      <button type="button" class="btn" onclick={() => (editing = null)}
                        >Cancel</button
                      >
                    </form>
                  {:else}
                    <span>{player.display_name_override ?? ''}</span>
                    <button
                      type="button"
                      class="text-accent hover:underline"
                      onclick={() =>
                        (editing = { id: player.id, value: player.display_name_override ?? '' })}
                    >
                      {player.display_name_override ? 'change' : 'set'}
                    </button>
                  {/if}
                </td>
                <td>
                  <button
                    type="button"
                    class="btn"
                    disabled={busyId === player.id}
                    onclick={() => toggleHidden(player)}
                  >
                    {player.hidden ? 'Unhide' : 'Hide'}
                  </button>
                </td>
                <td>
                  {#if merging?.id === player.id}
                    <div class="flex flex-wrap items-center gap-1">
                      <select class="field" bind:value={merging.into}>
                        <option value={null}>Choose a player</option>
                        {#each players.filter((entry) => entry.id !== player.id) as target (target.id)}
                          <option value={target.id}>{target.display_name} (#{target.id})</option>
                        {/each}
                      </select>
                      {#if merging.confirmed}
                        <button
                          type="button"
                          class="btn btn-danger"
                          disabled={busyId === player.id || merging.into === null}
                          onclick={() => merge(player)}>Confirm merge</button
                        >
                      {:else}
                        <button
                          type="button"
                          class="btn"
                          disabled={merging.into === null}
                          onclick={() => {
                            if (merging) merging.confirmed = true;
                          }}>Merge</button
                        >
                      {/if}
                      <button type="button" class="btn" onclick={() => (merging = null)}
                        >Cancel</button
                      >
                    </div>
                    {#if merging.confirmed}
                      <p class="mt-1 text-[0.72rem] text-warning">
                        This folds #{player.id} into the chosen player and cannot be undone here.
                      </p>
                    {/if}
                  {:else}
                    <button
                      type="button"
                      class="text-accent hover:underline"
                      onclick={() => (merging = { id: player.id, into: null, confirmed: false })}
                      >merge into…</button
                    >
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <div class="px-3 pb-3">
        <Pager nextCursor={data.players.data.next_cursor} count={shown.length} label="players" />
      </div>
    {/if}
  </Card>
  <p class="ticker">
    {formatNumber(players.length)} players loaded, hidden ones included.
  </p>
</div>
