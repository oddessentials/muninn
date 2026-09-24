<script lang="ts">
  import { atlas, iconPosition } from '$lib/world/recipes';

  let {
    icon,
    size = 32,
    label = '',
    class: className = ''
  }: { icon: string; size?: number; label?: string; class?: string } = $props();

  const position = $derived(iconPosition(icon));
  const style = $derived.by(() => {
    const box = `width:${size}px;height:${size}px`;
    if (!position) return box;
    const scale = size / atlas.cell;
    const px = (value: number) => `${Math.round(value * scale * 1000) / 1000}px`;
    return `${box};background-size:${px(atlas.width)} ${px(atlas.height)};background-position:${px(-position.x)} ${px(-position.y)}`;
  });
</script>

<span
  class="game-icon {className}"
  class:game-icon-missing={!position}
  {style}
  role={label ? 'img' : undefined}
  aria-label={label || undefined}
  aria-hidden={label ? undefined : 'true'}
></span>

<style>
  .game-icon {
    display: inline-block;
    flex: none;
    vertical-align: middle;
    background-image: url('../world/comfort-icons.webp');
    background-repeat: no-repeat;
  }

  .game-icon-missing {
    background-image: none;
  }
</style>
