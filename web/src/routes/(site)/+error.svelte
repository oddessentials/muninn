<script lang="ts">
  import { page } from '$app/state';
  import Meta from '$lib/ui/Meta.svelte';
  import MoatArt from '$lib/ui/MoatArt.svelte';
</script>

<Meta
  title={`${page.status} ${page.error?.message ?? 'Error'}`}
  description="Past the moat there is only water."
/>

<div
  class="glass mx-auto grid max-w-4xl items-center gap-8 p-6 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:p-8"
>
  <div class="rise order-last md:order-first">
    <MoatArt />
  </div>
  <div class="rise rise-2 flex flex-col gap-3">
    <p class="eyebrow">{page.status}</p>
    <h1 class="page-title">
      {#if page.status === 404}
        Nothing here
      {:else if page.status === 429}
        Too many requests
      {:else if page.status === 503}
        The site cannot reach its data
      {:else}
        Something went wrong
      {/if}
    </h1>
    <p class="note text-[1.25rem]">past the moat there is only water.</p>
    <p class="text-[0.8125rem] text-ink-muted">
      {page.status}: {page.error?.message ?? 'unknown error'}
    </p>
    <p class="text-[0.8125rem] leading-relaxed">
      {#if page.status === 404}
        The player, boss or raid you asked for does not exist, or an admin has hidden it.
      {:else if page.status === 429}
        The API allows 120 requests per minute per address. Wait a minute and reload.
      {:else}
        Reload in a moment. If it keeps happening, the admin health page shows what is wrong.
      {/if}
    </p>
    <p><a href="/" class="btn btn-primary">Back to the dashboard</a></p>
  </div>
</div>
