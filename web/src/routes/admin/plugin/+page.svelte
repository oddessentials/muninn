<script lang="ts">
  import { untrack } from 'svelte';
  import { page } from '$app/state';
  import { ApiError, api } from '$lib/api/client';
  import Card from '$lib/ui/Card.svelte';
  import ErrorNote from '$lib/ui/ErrorNote.svelte';
  import Meta from '$lib/ui/Meta.svelte';
  import PageHeader from '$lib/ui/PageHeader.svelte';
  import {
    configFileName,
    dllFileName,
    ingestUrl,
    installGuides,
    pluginConfig
  } from '$lib/ui/plugin';
  import Time from '$lib/ui/Time.svelte';

  let { data } = $props();

  const info = $derived(data.plugin.ok ? data.plugin.data : null);
  let secret = $state(untrack(() => (data.plugin.ok ? data.plugin.data.telemetry_secret : '')));
  let revealed = $state(false);
  let confirming = $state(false);
  let busy = $state(false);
  let message = $state('');
  let problem = $state('');

  const url = $derived(ingestUrl(page.url.origin));
  const runningOther = $derived(
    info?.last_start?.plugin_version && info.last_start.plugin_version !== info.version
      ? info.last_start.plugin_version
      : null
  );

  function downloadConfig() {
    const text = pluginConfig({
      origin: window.location.origin,
      secret,
      mapEnabled: data.features?.map ?? true
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    link.download = configFileName;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async function regenerate() {
    busy = true;
    message = '';
    problem = '';
    try {
      secret = (await api.regenerateTelemetrySecret()).telemetry_secret;
      revealed = true;
      message = `New secret made. Download ${configFileName} again, replace it on the game server and restart the server.`;
    } catch (error) {
      if (error instanceof ApiError && error.status === 409)
        problem = `Not allowed: ${error.message}`;
      else if (error instanceof ApiError && error.status === 403)
        problem = 'The request was refused: admin changes must come from this site.';
      else problem = error instanceof Error ? error.message : String(error);
    } finally {
      busy = false;
      confirming = false;
    }
  }
</script>

<Meta
  title="Admin plugin"
  description="Download the server plugin and its config, and see when the game server last reported in."
/>

<div class="flex flex-col gap-6">
  <PageHeader
    eyebrow="Admin"
    note="The plugin runs on the game server and sends what happens there to this site. Players install nothing."
  >
    {#snippet heading()}Plugin{/snippet}
  </PageHeader>

  {#if !data.plugin.ok}
    <ErrorNote error={data.plugin.error} what="the plugin setup" />
  {:else if info}
    <Card title="Game server">
      <div class="flex flex-col gap-2 text-[0.8125rem]">
        {#if info.last_start}
          <p>
            Last started <Time at={info.last_start.at} mode="relative" /> with plugin
            {info.last_start.plugin_version ?? 'unknown'} on Valheim {info.last_start
              .game_version ?? 'unknown'}.
          </p>
          {#if runningOther}
            <p class="text-warning">
              The server runs plugin {runningOther} and this site ships {info.version}. Install the
              DLL below and restart the server.
            </p>
          {/if}
        {:else}
          <p>Waiting for the game server's first start with the plugin.</p>
        {/if}
      </div>
    </Card>

    <Card title="Files">
      <div class="flex flex-col gap-5 text-[0.8125rem]">
        <div class="flex flex-col gap-2">
          <span class="label">Plugin {info.version}</span>
          {#if info.dll_available}
            <a class="btn btn-primary self-start" href={api.pluginDllUrl} download={dllFileName}
              >Download {dllFileName}</a
            >
          {:else}
            <p class="note">
              This build has no DLL. Get {dllFileName} version {info.version} from the Muninn package
              on Thunderstore.
            </p>
          {/if}
        </div>

        <div class="flex flex-col gap-2">
          <span class="label">Config</span>
          <button type="button" class="btn self-start" onclick={downloadConfig}
            >Download {configFileName}</button
          >
          <p class="note">
            Sends to <code class="break-all">{url}</code> with the secret below.
          </p>
        </div>

        <div class="flex flex-col gap-2">
          <span class="label">Telemetry secret</span>
          <div class="flex flex-wrap items-center gap-2">
            <code class="field min-w-0 flex-1 break-all" aria-live="polite"
              >{revealed ? secret : '•'.repeat(24)}</code
            >
            <button type="button" class="btn" onclick={() => (revealed = !revealed)}
              >{revealed ? 'Hide' : 'Show'}</button
            >
          </div>
          {#if info.secret_from_environment}
            <p class="note">Set by TELEMETRY_SECRET, so it cannot be replaced here.</p>
          {:else if confirming}
            <div class="flex flex-wrap items-center gap-2">
              <span>The server is refused until it has the new config.</span>
              <button type="button" class="btn btn-danger" disabled={busy} onclick={regenerate}
                >Replace the secret</button
              >
              <button type="button" class="btn" onclick={() => (confirming = false)}>Keep it</button
              >
            </div>
          {:else}
            <button type="button" class="btn self-start" onclick={() => (confirming = true)}
              >Make a new secret</button
            >
          {/if}
          {#if problem}<p class="text-danger" role="alert">{problem}</p>{/if}
          {#if message}<p role="status">{message}</p>{/if}
        </div>
      </div>
    </Card>

    <Card title="Install">
      <div class="grid gap-5 text-[0.8125rem] leading-relaxed md:grid-cols-3">
        {#each installGuides as guide (guide.id)}
          <section class="flex min-w-0 flex-col gap-2" aria-labelledby="guide-{guide.id}">
            <h2 id="guide-{guide.id}" class="label">{guide.label}</h2>
            <ol class="flex list-decimal flex-col gap-1.5 pl-5">
              {#each guide.steps as step (step)}
                <li>{step}</li>
              {/each}
            </ol>
          </section>
        {/each}
      </div>
    </Card>
  {/if}
</div>
