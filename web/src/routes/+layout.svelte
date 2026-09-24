<script lang="ts">
  import '../app.css';
  import { page } from '$app/state';
  import Backdrop from '$lib/ui/Backdrop.svelte';
  import AtmosphereToggle from '$lib/ui/AtmosphereToggle.svelte';
  import { atmosphere } from '$lib/ui/atmosphere.svelte';
  import { clock } from '$lib/ui/clock.svelte';
  import Emblem from '$lib/ui/Emblem.svelte';
  import { provideLive } from '$lib/ui/live.svelte';
  import { music } from '$lib/ui/music.svelte';
  import { shroud } from '$lib/ui/shroud.svelte';
  import MusicToggle from '$lib/ui/MusicToggle.svelte';
  import SiteNav from '$lib/ui/SiteNav.svelte';
  import StatusStrip from '$lib/ui/StatusStrip.svelte';
  import { versionLine } from '$lib/ui/versions';
  import Wordmark from '$lib/ui/Wordmark.svelte';
  import { worldClock } from '$lib/ui/worldclock.svelte';

  let { data, children } = $props();

  const live = provideLive();
  const bare = $derived(page.route.id === '/(site)/widget');

  $effect(() => clock.start());
  $effect(() => worldClock.start());
  $effect(() => {
    if (!bare) return music.start();
  });
  $effect(() => {
    if (!bare) shroud.start();
  });
  $effect(() => {
    if (!bare) return atmosphere.start();
  });

  $effect(() => {
    if (!data.streamEnabled) return;
    live.start();
    return () => live.stop();
  });

  const status = $derived(live.status ?? data.status);
  $effect.pre(() => worldClock.observe(status));
  const canonical = $derived(`${page.url.origin}${page.url.pathname}`);
  const socialImage = $derived(`${page.url.origin}/og.jpg`);
</script>

<svelte:head>
  <title>{data.siteName}</title>
  <link rel="canonical" href={canonical} />
  <meta property="og:site_name" content={data.siteName} />
  <meta property="og:type" content="website" />
  <meta property="og:url" content={canonical} />
  <meta property="og:image" content={socialImage} />
  <meta property="og:image:type" content="image/jpeg" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="{data.siteName}: the raven over the tavern" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:image" content={socialImage} />
</svelte:head>

{#if bare}
  {@render children()}
{:else}
  <div class="relative flex min-h-screen flex-col">
    <Backdrop />
    <header class="relative z-10 bg-linear-to-b from-surface/85 via-surface/55 to-transparent">
      <div class="mx-auto flex w-full max-w-6xl flex-col gap-2 px-(--gutter) pt-4 pb-1">
        <div class="flex items-center gap-4">
          <a href="/" class="flex items-center gap-2.5 text-ink hover:text-accent-bright">
            <Emblem size={30} class="text-accent drop-shadow-[0_0_12px_rgba(217,171,74,0.35)]" />
            <Wordmark name={data.siteName} />
          </a>
          <span class="note hidden sm:inline">valheim server log</span>
          <div class="ml-auto flex items-center gap-2">
            <AtmosphereToggle />
            <MusicToggle />
          </div>
        </div>
        <SiteNav entries={data.navigation} />
      </div>
    </header>
    <StatusStrip {status} error={data.statusError} stream={live.stream} />
    <main class="relative z-10 mx-auto w-full max-w-6xl flex-1 px-(--gutter) pt-8 pb-12">
      {#key page.url.pathname}
        <div class="pagein">
          {@render children()}
        </div>
      {/key}
    </main>
    <footer class="relative z-10 border-t border-line">
      <div
        class="mx-auto flex w-full max-w-6xl flex-wrap items-end gap-x-8 gap-y-4 px-(--gutter) py-6"
      >
        <div class="flex flex-col gap-1">
          <span class="note text-accent">dig the moat.</span>
          <span class="ticker"
            >Everything here comes from the server plugin; players install nothing</span
          >
          <span class="ticker">Times are stored in UTC and shown in your local time zone</span>
          <span class="ticker">{versionLine(__APP_VERSION__, status)}</span>
        </div>
        <nav aria-label="Machine-readable" class="ml-auto flex flex-wrap gap-x-5 gap-y-2">
          <a href="/api/status" class="nav-link px-0">Status JSON for bots</a>
          <a href="/api/v1/openapi.json" class="nav-link px-0">API contract</a>
        </nav>
      </div>
    </footer>
  </div>
{/if}
