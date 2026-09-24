import { describe, expect, it } from 'vitest';
import { focusViewBox, mapGeometry, scaleBarMetres, toPixel, worldViewBox } from '$lib/ui/map';

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
