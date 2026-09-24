<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { invalidateAll } from '$app/navigation';
  import { ApiError, api } from '$lib/api/client';
  import type { Announcement } from '$lib/api/types';
  import {
    announcementSummary,
    buildAnnouncement,
    canCancel,
    emptyForm,
    isLive,
    localDateTimeValue,
    maxTextLength,
    minLeadMinutes,
    queuedNote,
    restartLead,
    restartPresets,
    statusLabel,
    statusTone
  } from '$lib/ui/announcements';
  import Card from '$lib/ui/Card.svelte';
  import { clock } from '$lib/ui/clock.svelte';
  import EmptyState from '$lib/ui/EmptyState.svelte';
  import ErrorNote from '$lib/ui/ErrorNote.svelte';
  import Meta from '$lib/ui/Meta.svelte';
  import PageHeader from '$lib/ui/PageHeader.svelte';
  import Time from '$lib/ui/Time.svelte';

  let { data } = $props();

  let form = $state(emptyForm());
  let message = $state('');
  let problem = $state('');
  let busy = $state(false);
  let cancelling = $state<number | null>(null);
  let timer: ReturnType<typeof setInterval> | null = null;

  const items = $derived(data.announcements.ok ? data.announcements.data.items : []);
  const live = $derived(isLive(items));
  const remaining = $derived(maxTextLength - form.text.length);

  onMount(() => {
    form.time = localDateTimeValue(Date.now() + 30 * 60_000);
    timer = setInterval(() => {
      if (live && !busy && cancelling === null) void invalidateAll();
    }, 10_000);
  });

  onDestroy(() => {
    if (timer) clearInterval(timer);
  });

  function explain(error: unknown): string {
    if (error instanceof ApiError && error.status === 403)
      return 'The request was refused: admin changes must come from this site.';
    if (error instanceof ApiError && error.status === 401)
      return 'Your admin session has ended. Log in again.';
    if (error instanceof ApiError && error.status === 409) return `Not allowed: ${error.message}`;
    return error instanceof Error ? error.message : String(error);
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    problem = '';
    message = '';
    const built = buildAnnouncement(form, Date.now());
    if (!built.ok) {
      problem = built.error;
      return;
    }
    busy = true;
    try {
      await api.createAnnouncement(built.body);
      message = queuedNote(built.body);
      form = { ...emptyForm(), kind: form.kind, time: form.time };
      await invalidateAll();
    } catch (error) {
      problem = explain(error);
    } finally {
      busy = false;
    }
  }

  async function cancel(item: Announcement) {
    cancelling = item.id;
    problem = '';
    message = '';
    try {
      await api.cancelAnnouncement(item.id);
      message =
        item.kind === 'restart'
          ? 'Restart cancelled. The countdown stops when the server next checks in.'
          : 'Message cancelled.';
      await invalidateAll();
    } catch (error) {
      problem = explain(error);
    } finally {
      cancelling = null;
    }
  }
</script>

<Meta title="Admin announce" description="Show a message in game or count a server restart down." />

<div class="flex flex-col gap-6">
  <PageHeader
    eyebrow="Admin"
    note="Banners appear centre-screen for everyone online, the way boss alerts do. The server picks announcements up when it checks in, about once a minute while nobody is playing."
  >
    {#snippet heading()}Announce{/snippet}
  </PageHeader>

  <Card title="Announce">
    <form class="flex flex-col gap-4 text-[0.8125rem]" onsubmit={submit}>
      <div class="flex flex-wrap gap-1" role="radiogroup" aria-label="Announcement kind">
        <button
          type="button"
          class="seg"
          role="radio"
          aria-checked={form.kind === 'message'}
          aria-current={form.kind === 'message' ? 'true' : undefined}
          onclick={() => (form.kind = 'message')}>Message</button
        >
        <button
          type="button"
          class="seg"
          role="radio"
          aria-checked={form.kind === 'restart'}
          aria-current={form.kind === 'restart' ? 'true' : undefined}
          onclick={() => (form.kind = 'restart')}>Server restart</button
        >
      </div>

      {#if form.kind === 'restart'}
        <fieldset class="flex flex-col gap-2">
          <legend class="label">When</legend>
          <div class="flex flex-wrap items-center gap-1">
            {#each restartPresets as minutes (minutes)}
              <button
                type="button"
                class="seg"
                aria-current={form.lead === 'preset' && form.minutes === minutes
                  ? 'true'
                  : undefined}
                onclick={() => {
                  form.lead = 'preset';
                  form.minutes = minutes;
                }}>In {minutes} min</button
              >
            {/each}
            <label class="flex items-center gap-2">
              <span class="label">At</span>
              <input
                type="datetime-local"
                class="field"
                bind:value={form.time}
                onfocus={() => (form.lead = 'time')}
                oninput={() => (form.lead = 'time')}
                aria-current={form.lead === 'time' ? 'true' : undefined}
              />
            </label>
          </div>
          <p class="note">
            At least {minLeadMinutes} minutes ahead. Banners go out when the countdown starts, at 15,
            10, 5 and 1 minutes before the time, and at the time itself. You still restart the server
            from the panel.
          </p>
        </fieldset>
      {/if}

      <label class="flex flex-col gap-1.5">
        <span class="label">{form.kind === 'message' ? 'Message' : 'Note (optional)'}</span>
        <textarea
          class="field min-h-20"
          rows="2"
          maxlength={maxTextLength}
          bind:value={form.text}
          placeholder={form.kind === 'message'
            ? 'Eikthyr fight at the altar in ten minutes'
            : 'Patch day'}></textarea>
        <span class="note">{remaining} characters left</span>
      </label>

      <div class="flex flex-wrap items-center gap-3">
        <button type="submit" class="btn btn-primary" disabled={busy}>
          {form.kind === 'message' ? 'Show in game' : 'Schedule restart'}
        </button>
        {#if problem}<span class="text-danger" role="alert">{problem}</span>{/if}
        {#if message}<span role="status">{message}</span>{/if}
      </div>
    </form>
  </Card>

  <Card title="Announcements" flush>
    {#if !data.announcements.ok}
      <div class="p-4">
        <ErrorNote error={data.announcements.error} what="the announcement list" />
      </div>
    {:else if items.length === 0}
      <EmptyState message="Nothing announced yet." />
    {:else}
      <div class="overflow-x-auto">
        <table class="data-table">
          <thead>
            <tr>
              <th>Created</th>
              <th>Announcement</th>
              <th>Restart</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {#each items as item (item.id)}
              <tr data-status={item.status}>
                <td><Time at={item.created_at} mode="relative" /></td>
                <td class="max-w-md">{announcementSummary(item)}</td>
                <td>
                  {#if item.kind === 'restart'}
                    <Time at={item.restart_at} />
                    <span class="text-ink-muted">{restartLead(item, clock.now)}</span>
                  {:else}
                    <span class="text-ink-muted">message</span>
                  {/if}
                </td>
                <td>
                  <span class={statusTone(item.status)}>{statusLabel(item.status)}</span>
                  {#if item.status === 'shown' && item.completed_at}
                    <span class="text-ink-muted"
                      ><Time at={item.completed_at} mode="relative" /></span
                    >
                  {/if}
                </td>
                <td class="num">
                  {#if canCancel(item)}
                    <button
                      type="button"
                      class="btn btn-danger"
                      disabled={cancelling !== null}
                      onclick={() => cancel(item)}>Cancel</button
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
</div>
