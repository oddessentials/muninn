<script lang="ts">
  import { music, musicTitle } from './music.svelte';

  const label = $derived(music.playing ? 'Music on' : music.armed ? 'Music ready' : 'Music off');
</script>

<button
  type="button"
  class="btn gap-2 whitespace-nowrap"
  data-music-toggle
  aria-pressed={music.on}
  title={music.on ? `Stop ${musicTitle}` : `Play ${musicTitle}, it loops quietly while you browse`}
  onclick={() => music.toggle()}
>
  <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" fill="currentColor">
    {#if music.on}
      <path d="M6 1.5v9.3a2.6 2.6 0 1 0 1.5 2.4V5.2l6-1.6v4.2a2.6 2.6 0 1 0 1.5 2.4V1L6 3z" />
    {:else}
      <path
        d="M6 1.5v9.3a2.6 2.6 0 1 0 1.5 2.4V5.2l6-1.6v4.2a2.6 2.6 0 1 0 1.5 2.4V1L6 3z"
        opacity="0.55"
      />
      <path d="M1.5 1.5l13 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
    {/if}
  </svg>
  <span class="hidden sm:inline">{label}</span>
  <span class="sr-only sm:hidden">{label}</span>
</button>
