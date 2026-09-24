import type { WorldMap } from '$lib/api/types';

export const defaultRadiusM = 10_000;
export const defaultSizePx = 2048;

export interface MapGeometry {
  radiusM: number;
  sizePx: number;
  src: string | null;
  available: boolean;
}

export function mapGeometry(map: WorldMap | null | undefined, src: string | null): MapGeometry {
  const available = map?.available === true && src !== null;
  return {
    radiusM: map?.radius_m ?? defaultRadiusM,
    sizePx: map?.size_px ?? defaultSizePx,
    src: available ? src : null,
    available
  };
}

export interface MapPoint {
  x: number;
  z: number;
}

export function toPixel(point: MapPoint, geometry: MapGeometry): { px: number; py: number } {
  const { radiusM, sizePx } = geometry;
  return {
    px: ((point.x + radiusM) / (2 * radiusM)) * sizePx,
    py: ((radiusM - point.z) / (2 * radiusM)) * sizePx
  };
}

export interface ViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function worldViewBox(geometry: MapGeometry): ViewBox {
  return { x: 0, y: 0, width: geometry.sizePx, height: geometry.sizePx };
}

export function focusViewBox(
  points: MapPoint[],
  geometry: MapGeometry,
  minExtentM = 1500,
  paddingFraction = 0.2
): ViewBox {
  if (points.length === 0) return worldViewBox(geometry);
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minZ = Math.min(minZ, point.z);
    maxZ = Math.max(maxZ, point.z);
  }
  const centreX = (minX + maxX) / 2;
  const centreZ = (minZ + maxZ) / 2;
  const extent = Math.max(maxX - minX, maxZ - minZ) * (1 + paddingFraction * 2);
  const half = Math.max(extent, minExtentM) / 2;
  const topLeft = toPixel({ x: centreX - half, z: centreZ + half }, geometry);
  const bottomRight = toPixel({ x: centreX + half, z: centreZ - half }, geometry);
  const width = bottomRight.px - topLeft.px;
  const height = bottomRight.py - topLeft.py;
  return { x: topLeft.px, y: topLeft.py, width, height };
}

export function viewBoxString(box: ViewBox): string {
  return `${box.x} ${box.y} ${box.width} ${box.height}`;
}

export function scaleBarMetres(box: ViewBox, geometry: MapGeometry): number {
  const metresAcross = (box.width / geometry.sizePx) * 2 * geometry.radiusM;
  const target = metresAcross / 5;
  const steps = [50, 100, 200, 250, 500, 1000, 2000, 2500, 5000];
  let best = steps[0] as number;
  for (const step of steps) if (step <= target) best = step;
  return best;
}

export function metresToPixels(metres: number, geometry: MapGeometry): number {
  return (metres / (2 * geometry.radiusM)) * geometry.sizePx;
}

export type MarkerKind =
  'player' | 'death' | 'boss' | 'raid' | 'chat' | 'structure' | 'kill' | 'event';

export interface MapMarker extends MapPoint {
  label: string;
  kind: MarkerKind;
  href?: string;
}

export function hasPosition<T extends { x: number | null; z: number | null }>(
  item: T
): item is T & MapPoint {
  return item.x !== null && item.z !== null;
}

export interface MapTrack {
  label: string;
  points: MapPoint[];
}

export const markerColors: Record<MarkerKind, string> = {
  player: '#ffffff',
  death: '#e03131',
  boss: '#f5b800',
  raid: '#ff7a1a',
  chat: '#5aa9ff',
  structure: '#b5e853',
  kill: '#c084fc',
  event: '#e5e7eb'
};

export const markerKindLabels: Record<MarkerKind, string> = {
  player: 'Player',
  death: 'Death',
  boss: 'Boss',
  raid: 'Raid',
  chat: 'Chat',
  structure: 'Structure',
  kill: 'Kill',
  event: 'Event'
};
