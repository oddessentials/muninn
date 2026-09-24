<script lang="ts">
  import { fade } from 'svelte/transition';
  import type { WorldMap } from '$lib/api/types';
  import Emblem from './Emblem.svelte';
  import { biomeLabel, mapBiomeColors } from './labels';
  import {
    focusViewBox,
    mapGeometry,
    markerColors,
    markerKindLabels,
    metresToPixels,
    scaleBarMetres,
    toPixel,
    viewBoxString,
    worldViewBox,
    type MapMarker,
    type MapTrack,
    type MarkerKind
  } from './map';
  import { shroud } from './shroud.svelte';

  let {
    map,
    src,
    markers = [],
    tracks = [],
    focus = 'world',
    legend = false,
    caption = 'World map'
  }: {
    map: WorldMap | null | undefined;
    src: string | null;
    markers?: MapMarker[];
    tracks?: MapTrack[];
    focus?: 'world' | 'markers';
    legend?: boolean;
    caption?: string;
  } = $props();

  let chosen = $state<'world' | 'markers' | null>(null);
  const mode = $derived(chosen ?? focus);
  const geometry = $derived(mapGeometry(map, src));
  const points = $derived([...markers, ...tracks.flatMap((track) => track.points)]);
  const canFocus = $derived(points.length > 0);
  const box = $derived(
    mode === 'markers' && canFocus ? focusViewBox(points, geometry) : worldViewBox(geometry)
  );
  const radius = $derived(box.width / 110);
  const fontSize = $derived(radius * 1.7);
  const strokeWidth = $derived(radius / 4);
  const scaleMetres = $derived(scaleBarMetres(box, geometry));
  const scalePixels = $derived(metresToPixels(scaleMetres, geometry));
  const scalePercent = $derived((scalePixels / box.width) * 100);
  const size = $derived(geometry.sizePx);
  const kindsShown = $derived(
    [...new Set(markers.map((marker) => marker.kind))].filter((kind) => kind !== 'player')
  );
  const shrouded = $derived(geometry.available && !shroud.revealed);

  function pixel(point: { x: number; z: number }) {
    return toPixel(point, geometry);
  }

  function trackPath(track: MapTrack): string {
    return track.points
      .map((point) => {
        const { px, py } = pixel(point);
        return `${px.toFixed(1)},${py.toFixed(1)}`;
      })
      .join(' ');
  }

  function fill(kind: MarkerKind): string {
    return markerColors[kind];
  }
</script>

<figure class="flex flex-col gap-2">
  <div class="map-frame" style="aspect-ratio: 1 / 1">
    <div class="h-full w-full" inert={shrouded} aria-hidden={shrouded}>
      <svg
        viewBox={viewBoxString(box)}
        class="block h-full w-full"
        role="img"
        aria-label={caption}
        shape-rendering="geometricPrecision"
      >
        {#if geometry.src}
          <image href={geometry.src} x="0" y="0" width={size} height={size} />
        {:else}
          <rect x="0" y="0" width={size} height={size} fill="#1c2a44" />
          <circle cx={size / 2} cy={size / 2} r={size / 2} fill="#274B8A" />
        {/if}
        {#each tracks as track (track.label)}
          {#if track.points.length > 1}
            <polyline
              points={trackPath(track)}
              fill="none"
              stroke="#000"
              stroke-opacity="0.6"
              stroke-width={strokeWidth * 3}
              stroke-linejoin="round"
              stroke-linecap="round"
            />
            <polyline
              points={trackPath(track)}
              fill="none"
              stroke="#fff"
              stroke-width={strokeWidth * 1.5}
              stroke-linejoin="round"
              stroke-linecap="round"
            >
              <title>{track.label}</title>
            </polyline>
          {/if}
        {/each}
        {#each markers as marker, index (index)}
          {@const { px, py } = pixel(marker)}
          {#if marker.href}
            <a href={marker.href}>
              <circle
                cx={px}
                cy={py}
                r={marker.kind === 'player' ? radius * 1.15 : radius}
                fill={fill(marker.kind)}
                stroke="#111"
                stroke-width={strokeWidth}
              >
                <title>{marker.label}</title>
              </circle>
            </a>
          {:else}
            <circle
              cx={px}
              cy={py}
              r={marker.kind === 'player' ? radius * 1.15 : radius}
              fill={fill(marker.kind)}
              stroke="#111"
              stroke-width={strokeWidth}
            >
              <title>{marker.label}</title>
            </circle>
          {/if}
          {#if marker.kind === 'player'}
            <text
              x={px + radius * 1.8}
              y={py + fontSize * 0.35}
              font-size={fontSize}
              class="font-sans"
              font-weight="600"
              fill="#fff"
              stroke="#000"
              stroke-width={strokeWidth}
              paint-order="stroke"
              style="pointer-events: none">{marker.label}</text
            >
          {/if}
        {/each}
      </svg>
    </div>
    {#if !geometry.available}
      <p
        class="absolute inset-x-0 top-1/2 -translate-y-1/2 px-6 text-center text-[0.8125rem] text-white/90 [text-shadow:0_1px_8px_rgba(0,0,0,0.8)]"
      >
        The biome map has not been rendered yet. The plugin draws it once after the server starts;
        positions are still plotted on the world disc.
      </p>
    {/if}
    <span class="map-ui absolute top-2 left-2 z-10 px-1.5" aria-hidden="true">N</span>
    <div class="absolute bottom-2 left-2 z-10 flex flex-col items-start gap-0.5" aria-hidden="true">
      <span
        class="h-1 border-x-2 border-accent bg-accent/80 shadow-[0_0_6px_rgba(0,0,0,0.8)]"
        style="width: {scalePercent}%"
      ></span>
      <span class="map-ui px-1.5"
        >{scaleMetres >= 1000 ? `${scaleMetres / 1000} km` : `${scaleMetres} m`}</span
      >
    </div>
    {#if !shrouded && (canFocus || geometry.available)}
      <div class="absolute top-2 right-2 z-10 flex gap-1">
        {#if canFocus}
          <button
            type="button"
            class="map-ui"
            onclick={() => (chosen = 'world')}
            aria-pressed={mode === 'world'}>Whole world</button
          >
          <button
            type="button"
            class="map-ui"
            onclick={() => (chosen = 'markers')}
            aria-pressed={mode === 'markers'}>Zoom in</button
          >
        {/if}
        {#if geometry.available}
          <button
            type="button"
            class="map-ui"
            onclick={() => shroud.cover()}
            title="Cover the map again and forget the choice">Shroud</button
          >
        {/if}
      </div>
    {/if}
    {#if shrouded}
      <div
        class="map-shroud absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 p-6 text-center"
        out:fade={{ duration: 700 }}
      >
        <Emblem size={40} class="text-accent drop-shadow-[0_0_16px_rgba(217,171,74,0.35)]" />
        <p class="eyebrow">Uncharted</p>
        <p class="max-w-[34ch] text-[0.72rem] leading-relaxed text-ink-muted">
          Spoiler: the whole world is drawn here, including places you have not found yet.
        </p>
        <button type="button" class="btn btn-primary mt-1" onclick={() => shroud.reveal()}
          >Reveal the map</button
        >
      </div>
    {/if}
  </div>
  {#if legend || kindsShown.length > 0}
    <figcaption class="flex flex-wrap gap-x-4 gap-y-1 text-[0.72rem] text-ink-muted">
      {#each kindsShown as kind (kind)}
        <span class="inline-flex items-center gap-1">
          <span
            class="inline-block size-2.5 rounded-full border border-black/50"
            style="background: {markerColors[kind]}"
            aria-hidden="true"
          ></span>
          {markerKindLabels[kind]}
        </span>
      {/each}
      {#if legend}
        {#each mapBiomeColors as entry (entry.biome)}
          <span class="inline-flex items-center gap-1">
            <span
              class="inline-block size-2.5 border border-black/40 shadow-[0_0_0_1px_rgba(255,255,255,0.12)]"
              style="background: {entry.hex}"
              aria-hidden="true"
            ></span>
            {biomeLabel(entry.biome)}
          </span>
        {/each}
      {/if}
    </figcaption>
  {/if}
</figure>
