import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { biomes } from '$lib/ui/labels';

const css = readFileSync(new URL('../../../src/app.css', import.meta.url), 'utf8');
const rootBlock = css.slice(css.indexOf(':root {'), css.indexOf('@theme inline'));

const tokens = new Map<string, string>();
for (const match of rootBlock.matchAll(/--color-([a-z-]+):\s*(#[0-9a-f]{6});/g)) {
  tokens.set(match[1] as string, match[2] as string);
}

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel(n >> 16) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

function contrast(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((p, q) => q - p) as [number, number];
  return (high + 0.05) / (low + 0.05);
}

function token(name: string): string {
  const value = tokens.get(name);
  if (!value) throw new Error(`token --color-${name} is not a hex colour in app.css`);
  return value;
}

const grounds = ['surface', 'surface-raised', 'surface-sunken'];
const textTokens = [
  'ink',
  'ink-muted',
  'ink-faint',
  'accent',
  'accent-bright',
  'accent-deep',
  'ember',
  'online',
  'offline',
  'warning',
  'danger',
  'info'
];

describe('design tokens', () => {
  it('declares one dark palette and no light one', () => {
    expect(rootBlock).toContain('color-scheme: dark');
    expect(css).not.toContain('prefers-color-scheme');
    expect(css).not.toContain('data-theme');
  });

  it.each(grounds)('keeps every text token readable on %s', (ground) => {
    for (const name of textTokens) {
      expect(contrast(token(name), token(ground)), `${name} on ${ground}`).toBeGreaterThanOrEqual(
        4.5
      );
    }
  });

  it('keeps the button text readable on the gold accents', () => {
    expect(contrast(token('accent-contrast'), token('accent'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token('accent-contrast'), token('accent-bright'))).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps the state colours apart from each other and from the gold accent', () => {
    expect(token('online')).not.toBe(token('offline'));
    expect(token('warning')).not.toBe(token('accent'));
    expect(token('danger')).not.toBe(token('online'));
  });

  it('keeps a colour token for every biome', () => {
    for (const biome of biomes) {
      expect(tokens.has(`biome-${biome.toLowerCase()}`), biome).toBe(true);
    }
    expect(token('biome-ocean')).toBe(token('water'));
  });
});
