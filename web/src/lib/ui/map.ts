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
  segments: MapPoint[][];
}

export interface TrackSample extends MapPoint {
  ts: string;
}

export const teleportMetres = 500;
export const teleportWindowSeconds = 5;

export function trackSegments(samples: readonly TrackSample[]): MapPoint[][] {
  const ordered = [...samples].sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
  const segments: MapPoint[][] = [];
  let current: MapPoint[] = [];
  let previous: TrackSample | null = null;
  for (const sample of ordered) {
    if (previous) {
      const seconds = Math.max(
        teleportWindowSeconds,
        (Date.parse(sample.ts) - Date.parse(previous.ts)) / 1000
      );
      const metres = Math.hypot(sample.x - previous.x, sample.z - previous.z);
      if (metres >= teleportMetres * (seconds / teleportWindowSeconds)) {
        segments.push(current);
        current = [];
      }
    }
    current.push({ x: sample.x, z: sample.z });
    previous = sample;
  }
  if (current.length > 0) segments.push(current);
  return segments;
}

export interface LabelAnchor {
  px: number;
  py: number;
  text: string;
}

export interface LabelStack {
  x: number;
  y: number;
  lines: string[];
}

export const labelLineHeight = 1.25;

interface LabelGroup {
  members: LabelAnchor[];
  left: number;
  right: number;
  top: number;
  bottom: number;
}

function layoutGroup(members: LabelAnchor[], radius: number, fontSize: number): LabelGroup {
  const lineHeight = fontSize * labelLineHeight;
  const left = Math.max(...members.map((member) => member.px)) + radius * 1.8;
  const width = Math.max(...members.map((member) => member.text.length)) * fontSize * 0.62;
  const centre = members.reduce((sum, member) => sum + member.py, 0) / members.length;
  const height = fontSize + (members.length - 1) * lineHeight;
  return {
    members,
    left,
    right: left + width,
    top: centre - height / 2,
    bottom: centre + height / 2
  };
}

function groupsTouch(a: LabelGroup, b: LabelGroup, radius: number): boolean {
  const boxes =
    a.left < b.right && b.left < a.right && a.top < b.bottom + radius && b.top < a.bottom + radius;
  if (boxes) return true;
  return a.members.some((one) =>
    b.members.some((two) => Math.hypot(one.px - two.px, one.py - two.py) < radius * 2.4)
  );
}

function touchingPair(groups: LabelGroup[], radius: number): [number, number] | null {
  for (let i = 0; i < groups.length; i++) {
    for (let j = i + 1; j < groups.length; j++) {
      if (groupsTouch(groups[i]!, groups[j]!, radius)) return [i, j];
    }
  }
  return null;
}

export function stackLabels(
  anchors: readonly LabelAnchor[],
  radius: number,
  fontSize: number
): LabelStack[] {
  let groups = anchors.map((anchor) => layoutGroup([anchor], radius, fontSize));
  for (let pair = touchingPair(groups, radius); pair; pair = touchingPair(groups, radius)) {
    const [i, j] = pair;
    const members = [...groups[i]!.members, ...groups[j]!.members];
    groups = [
      ...groups.filter((_, index) => index !== i && index !== j),
      layoutGroup(members, radius, fontSize)
    ];
  }
  return groups.map((group) => ({
    x: group.left,
    y: group.top + fontSize * 0.85,
    lines: [...group.members]
      .sort((a, b) => a.py - b.py || a.text.localeCompare(b.text))
      .map((member) => member.text)
  }));
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
