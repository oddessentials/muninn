import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { shortName, webManifest } from '$lib/ui/manifest';

const staticFile = (name: string) =>
  readFileSync(new URL(`../../../static/${name}`, import.meta.url));
const text = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

const css = text('../../../src/app.css');
const surface = /--color-surface:\s*(#[0-9a-f]{6});/.exec(css)?.[1] ?? '';
const appHtml = text('../../../src/app.html');
const manifest = webManifest('Valheim guild');

function pngSize(file: Buffer): { width: number; height: number } {
  expect(file.subarray(0, 8)).toEqual(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  );
  return { width: file.readUInt32BE(16), height: file.readUInt32BE(20) };
}

function jpegSize(file: Buffer): { width: number; height: number } {
  expect(file.readUInt16BE(0)).toBe(0xffd8);
  let offset = 2;
  while (offset < file.length) {
    expect(file[offset]).toBe(0xff);
    const marker = file[offset + 1] as number;
    const length = file.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: file.readUInt16BE(offset + 5), width: file.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  throw new Error('no frame header in og.jpg');
}

describe('the social image', () => {
  const image = staticFile('og.jpg');

  it('is a 1200 by 630 JPEG', () => {
    expect(jpegSize(image)).toEqual({ width: 1200, height: 630 });
  });

  it('stays under the size budget', () => {
    expect(image.length).toBeLessThan(200_000);
  });
});

describe('the icons', () => {
  const declared: [string, number][] = [
    ['favicon-16.png', 16],
    ['favicon-32.png', 32],
    ['apple-touch-icon.png', 180],
    ...manifest.icons.map((icon): [string, number] => [
      icon.src.replace(/^\//, ''),
      Number(icon.sizes.split('x')[0])
    ])
  ];

  it.each(declared)('%s is a square PNG of %i pixels', (name, size) => {
    expect(pngSize(staticFile(name))).toEqual({ width: size, height: size });
  });

  it('favicon.ico carries the 16 and 32 pixel frames', () => {
    const ico = staticFile('favicon.ico');
    expect(ico.readUInt16LE(0)).toBe(0);
    expect(ico.readUInt16LE(2)).toBe(1);
    const count = ico.readUInt16LE(4);
    const sizes = Array.from({ length: count }, (_, i) => ico[6 + i * 16] as number).sort(
      (a, b) => a - b
    );
    expect(sizes).toEqual([16, 32]);
  });

  it('keeps every icon small', () => {
    const total = declared.reduce((sum, [name]) => sum + staticFile(name).length, 0);
    expect(total + staticFile('favicon.ico').length).toBeLessThan(60_000);
  });
});

describe('the manifest', () => {
  it('names the site and starts at the dashboard', () => {
    expect(manifest.name).toBe('Valheim guild');
    expect(manifest.short_name.length).toBeLessThanOrEqual(12);
    expect(manifest.start_url).toBe('/');
  });

  it('shortens a long site name for the home screen', () => {
    expect(shortName('Ravenhold')).toBe('Ravenhold');
    expect(shortName('Valheim guild')).toBe('Valheim');
    expect(shortName('Brotherhoodofthesea Vikings')).toBe('Brotherhoodo');
    expect(webManifest('The Iron Wolves of the North').short_name).toBe('The Iron');
  });

  it('uses the surface token as theme and background, like app.html', () => {
    expect(surface).toMatch(/^#[0-9a-f]{6}$/);
    expect(manifest.theme_color).toBe(surface);
    expect(manifest.background_color).toBe(surface);
    expect(appHtml).toContain(`<meta name="theme-color" content="${surface}" />`);
  });

  it('offers a maskable icon and only PNG icons', () => {
    expect(manifest.icons.some((icon) => icon.purpose === 'maskable')).toBe(true);
    expect(manifest.icons.every((icon) => icon.type === 'image/png')).toBe(true);
  });
});
