<script lang="ts">
  let { data }: { data: unknown } = $props();
  const text = $derived(JSON.stringify(data, null, 2));
</script>

<pre
  class="max-h-[32rem] max-w-full overflow-auto border border-line bg-surface-sunken p-3 text-[0.72rem] leading-5 whitespace-pre text-ink-muted">{text}</pre>
