<script lang="ts">
  import { untrack } from 'svelte';
  import { invalidateAll } from '$app/navigation';
  import { ApiError, api } from '$lib/api/client';
  import type { AdminSettings } from '$lib/api/types';
  import Card from '$lib/ui/Card.svelte';
  import ErrorNote from '$lib/ui/ErrorNote.svelte';
  import Meta from '$lib/ui/Meta.svelte';
  import PageHeader from '$lib/ui/PageHeader.svelte';
  import {
    buildSettingsUpdate,
    environmentVariables,
    featureOptions,
    settingsForm,
    siteNameMaxLength,
    type LockableField
  } from '$lib/ui/settings';

  let { data } = $props();

  let saved = $state<AdminSettings | null>(
    untrack(() => (data.settings.ok ? data.settings.data : null))
  );
  let form = $state(untrack(() => settingsForm(data.settings.ok ? data.settings.data : null)));
  let message = $state('');
  let problem = $state('');
  let busy = $state(false);

  const locked = (field: LockableField) => saved?.locked.includes(field) ?? false;

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
    message = '';
    problem = '';
    if (!saved) return;
    const built = buildSettingsUpdate(form, saved);
    if (!built.ok) {
      problem = built.error;
      return;
    }
    if (Object.keys(built.body).length === 0) {
      message = 'Nothing changed.';
      return;
    }
    busy = true;
    try {
      saved = await api.updateAdminSettings(built.body);
      form = settingsForm(saved);
      message = 'Saved.';
      await invalidateAll();
    } catch (error) {
      problem = explain(error);
    } finally {
      busy = false;
    }
  }
</script>

<Meta title="Admin settings" description="Name the site and point it at the game server." />

<div class="flex flex-col gap-6">
  <PageHeader
    eyebrow="Admin"
    note="A setting given by an environment variable wins over the value stored here and cannot be changed on this page."
  >
    {#snippet heading()}Settings{/snippet}
  </PageHeader>

  {#if !data.settings.ok}
    <ErrorNote error={data.settings.error} what="the settings" />
  {:else}
    <Card title="Site">
      <form class="flex flex-col gap-5 text-[0.8125rem]" onsubmit={submit}>
        <label class="flex flex-col gap-1.5">
          <span class="label">Site name</span>
          <input
            type="text"
            name="site_name"
            class="field"
            maxlength={siteNameMaxLength}
            disabled={locked('site_name')}
            bind:value={form.site_name}
          />
          {#if locked('site_name')}
            <span class="note">Set by {environmentVariables.site_name}.</span>
          {:else}
            <span class="note">Shown in the header, the browser tab and link previews.</span>
          {/if}
        </label>

        <fieldset class="flex flex-col gap-2">
          <legend class="label">Steam query</legend>
          <div class="flex flex-wrap gap-3">
            <label class="flex min-w-0 flex-1 flex-col gap-1.5">
              <span class="note">Host</span>
              <input
                type="text"
                name="steam_query_host"
                class="field"
                placeholder="game.example.com"
                autocomplete="off"
                disabled={locked('steam_query_host')}
                bind:value={form.steam_query_host}
              />
            </label>
            <label class="flex w-28 flex-col gap-1.5">
              <span class="note">Port</span>
              <input
                type="text"
                name="steam_query_port"
                class="field"
                inputmode="numeric"
                pattern="[0-9]*"
                maxlength="5"
                autocomplete="off"
                disabled={locked('steam_query_port')}
                bind:value={form.steam_query_port}
              />
            </label>
          </div>
          <p class="note">
            {#if locked('steam_query_host') || locked('steam_query_port')}
              Set by
              {[
                locked('steam_query_host') ? environmentVariables.steam_query_host : '',
                locked('steam_query_port') ? environmentVariables.steam_query_port : ''
              ]
                .filter(Boolean)
                .join(' and ')}.
            {/if}
            The site asks the game server's Steam query port who is online, once a minute. Leave the host
            empty to switch this off; the status then comes from the plugin alone. The query port is usually
            the game port plus one.
          </p>
        </fieldset>

        <fieldset class="flex flex-col gap-3">
          <legend class="label">Features</legend>
          {#each featureOptions as option (option.name)}
            <div class="flex items-start gap-2.5">
              <input
                type="checkbox"
                id="feature-{option.name}"
                name="feature_{option.name}"
                class="mt-0.5"
                aria-describedby="feature-{option.name}-note"
                bind:checked={form.features[option.name]}
              />
              <div class="flex flex-col gap-0.5">
                <label for="feature-{option.name}">{option.label}</label>
                <span class="note" id="feature-{option.name}-note">{option.description}</span>
              </div>
            </div>
          {/each}
          <p class="note">
            A feature that is off disappears from the menu, and its pages answer 404.
          </p>
        </fieldset>

        <div class="flex flex-wrap items-center gap-3">
          <button type="submit" class="btn btn-primary" disabled={busy}>Save</button>
          {#if problem}<span class="text-danger" role="alert">{problem}</span>{/if}
          {#if message}<span role="status">{message}</span>{/if}
        </div>
      </form>
    </Card>
  {/if}
</div>
