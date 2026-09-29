import { describe, expect, it } from 'vitest';
import {
  focusViewBox,
  labelLineHeight,
  mapGeometry,
  scaleBarMetres,
  stackLabels,
  toPixel,
  trackSegments,
  worldViewBox
} from '$lib/ui/map';

const map = {
  available: true,
  image_url: '/api/v1/world/map.png',
  size_px: 2048,
  radius_m: 10000,
  generated_at: '2026-08-30T09:05:10Z'
};

describe('map projection', () => {
  const geometry = mapGeometry(map, '/api/v1/world/map.png');

  it('follows the documented pixel formula with north up', () => {
    expect(toPixel({ x: 0, z: 0 }, geometry)).toEqual({ px: 1024, py: 1024 });
    expect(toPixel({ x: 10000, z: 10000 }, geometry)).toEqual({ px: 2048, py: 0 });
    expect(toPixel({ x: -10000, z: -10000 }, geometry)).toEqual({ px: 0, py: 2048 });
  });

  it('falls back to the documented disc when the map is not rendered yet', () => {
    const fallback = mapGeometry({ ...map, available: false, image_url: null }, null);
    expect(fallback.available).toBe(false);
    expect(fallback.src).toBeNull();
    expect(toPixel({ x: 0, z: 0 }, fallback)).toEqual({ px: 1024, py: 1024 });
    expect(mapGeometry(null, null).radiusM).toBe(10000);
  });

  it('zooms to a square around the markers with a minimum extent', () => {
    const box = focusViewBox([{ x: 100, z: 100 }], geometry);
    expect(box.width).toBeCloseTo(box.height);
    expect(box.width).toBeCloseTo((1500 / 20000) * 2048);
    const wide = focusViewBox(
      [
        { x: -4000, z: 0 },
        { x: 4000, z: 0 }
      ],
      geometry
    );
    expect(wide.width).toBeGreaterThan((8000 / 20000) * 2048);
    expect(focusViewBox([], geometry)).toEqual(worldViewBox(geometry));
  });

  it('picks a round scale bar length for the visible width', () => {
    expect(scaleBarMetres(worldViewBox(geometry), geometry)).toBe(2500);
    expect(scaleBarMetres(focusViewBox([{ x: 0, z: 0 }], geometry), geometry)).toBe(250);
  });
});

describe('player paths', () => {
  const at = (seconds: number) => new Date(Date.UTC(2026, 8, 10, 17, 0, seconds)).toISOString();

  it('keeps a walk in one segment, in time order', () => {
    const segments = trackSegments([
      { ts: at(40), x: 60, z: 0 },
      { ts: at(0), x: 0, z: 0 },
      { ts: at(20), x: 30, z: 0 }
    ]);
    expect(segments).toEqual([
      [
        { x: 0, z: 0 },
        { x: 30, z: 0 },
        { x: 60, z: 0 }
      ]
    ]);
  });

  it('breaks the path where the plugin would count a teleport', () => {
    const segments = trackSegments([
      { ts: at(0), x: 0, z: 0 },
      { ts: at(20), x: 40, z: 0 },
      { ts: at(40), x: 3940, z: 0 },
      { ts: at(60), x: 3980, z: 0 }
    ]);
    expect(segments).toHaveLength(2);
    expect(segments[1]![0]).toEqual({ x: 3940, z: 0 });
  });

  it('scales the teleport distance with the time between samples', () => {
    const minutesApart = trackSegments([
      { ts: at(0), x: 0, z: 0 },
      { ts: new Date(Date.UTC(2026, 8, 10, 17, 2, 0)).toISOString(), x: 3000, z: 0 }
    ]);
    expect(minutesApart).toHaveLength(1);
  });
});

describe('player labels', () => {
  const radius = 10;
  const fontSize = 17;

  it('leaves a lone label beside its marker', () => {
    expect(stackLabels([{ px: 100, py: 100, text: 'Bjorn' }], radius, fontSize)).toEqual([
      { x: 118, y: 100 + fontSize * 0.35, lines: ['Bjorn'] }
    ]);
  });

  it('stacks the names of players standing together, top to bottom', () => {
    const stacks = stackLabels(
      [
        { px: 108, py: 104, text: 'Freya' },
        { px: 100, py: 100, text: 'Bjorn' },
        { px: 900, py: 900, text: 'Ulf' }
      ],
      radius,
      fontSize
    );
    expect(stacks).toHaveLength(2);
    const together = stacks.find((stack) => stack.lines.length === 2)!;
    expect(together.lines).toEqual(['Bjorn', 'Freya']);
    expect(together.x).toBe(108 + radius * 1.8);
    const height = fontSize + fontSize * labelLineHeight;
    expect(together.y).toBeCloseTo(102 - height / 2 + fontSize * 0.85);
  });

  it('merges labels that would overlap even when the markers do not', () => {
    const stacks = stackLabels(
      [
        { px: 100, py: 100, text: 'Sigrid' },
        { px: 150, py: 108, text: 'Ragnar' }
      ],
      radius,
      fontSize
    );
    expect(stacks).toHaveLength(1);
  });
});
