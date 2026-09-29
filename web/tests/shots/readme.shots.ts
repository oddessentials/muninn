import { expect, test, type Locator, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const assets = fileURLToPath(new URL('../../../site/assets/', import.meta.url));
const fixturesNow = new Date('2026-09-10T19:30:00Z');

async function open(page: Page, path: string): Promise<void> {
  await page.clock.setFixedTime(fixturesNow);
  await page.addInitScript(() => localStorage.setItem('map', 'revealed'));
  await page.goto(path, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('.map-shroud')).toHaveCount(0);
}

function card(page: Page, title: string): Locator {
  return page
    .locator('section.card')
    .filter({ has: page.getByRole('heading', { name: title, exact: true }) })
    .first();
}

async function shoot(target: Page | Locator, name: string): Promise<void> {
  await target.screenshot({ path: `${assets}${name}.jpg`, type: 'jpeg', quality: 86 });
}

test('dashboard and zone leader', async ({ page }) => {
  await open(page, '/');
  await shoot(page, 'dashboard');
  await shoot(card(page, 'Zone leader'), 'zone-leader');
});

test('world clock', async ({ page }) => {
  await page.setViewportSize({ width: 432, height: 592 });
  await open(page, '/widget');
  await shoot(page, 'world-clock');
});

test('comfort planner', async ({ page }) => {
  await open(page, '/comfort');
  const planner = card(page, 'Plan a build');
  await planner.getByRole('button', { name: 'Plan the most comfort' }).click();
  await planner.evaluate((element) => element.scrollIntoView({ block: 'start' }));
  const box = (await planner.boundingBox())!;
  await page.screenshot({
    path: `${assets}comfort-planner.jpg`,
    type: 'jpeg',
    quality: 86,
    clip: { x: box.x, y: box.y, width: box.width, height: Math.min(box.height, 800) }
  });
});

test('world map', async ({ page }) => {
  await open(page, '/world');
  await shoot(card(page, 'Map'), 'world-map');
});

test('player map', async ({ page }) => {
  await open(page, '/players/1');
  await shoot(card(page, 'Where they have been'), 'player-map');
});

test('raid map', async ({ page }) => {
  await open(page, '/raids/2');
  await shoot(card(page, 'Where'), 'raid-map');
});
