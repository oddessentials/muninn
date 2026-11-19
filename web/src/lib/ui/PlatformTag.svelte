<script lang="ts">
  import type { Platform } from '#lib/api/types.ts';
  import { platformLabel } from './labels';

  let { platform }: { platform: Platform | string } = $props();
</script>

<span class="chip">{platformLabel(platform)}</span>
