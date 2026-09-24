import { expect, test, type Page } from '@playwright/test';

function watchConsole(page: Page): string[] {
  const problems: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || /hydration/i.test(message.text()))
      problems.push(message.text());
  });
  page.on('pageerror', (error) => problems.push(error.message));
  return problems;
}

const card = (page: Page) => page.locator('#zone');

async function logIn(page: Page): Promise<void> {
  await page.goto('/admin/login');
  await page.getByLabel('Password').fill('anything');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test('the dashboard ranks the guild and opens a row into its notes', async ({ page }) => {
  const problems = watchConsole(page);
  await page.goto('/');
  const zone = card(page);
  await expect(zone.getByRole('heading', { name: 'Zone leader' })).toBeVisible();
  await expect(zone.locator('tbody > tr:not(.zone-details)')).toHaveCount(6);
  await expect(zone.getByRole('button', { name: /^Remove / })).toHaveCount(0);
  const first = zone.locator('tbody > tr').first();
  await expect(first).toContainText('1');
  await expect(first).toContainText('BJORN');
  await expect(first).toContainText('98');
  await expect(first).toContainText('Excellent');
  await expect(first.locator('svg')).toHaveCount(1);
  await expect(zone.locator('tbody > tr').nth(5)).toContainText('Poor');
  await expect(zone.getByRole('button', { name: 'Measure' })).toBeDisabled();
  await zone.getByRole('button', { name: /^RAGNAR/ }).click();
  const details = zone.locator('#zone-details-4');
  await expect(details).toContainText('a fallback when no primary is on');
  await expect(details).toContainText('The browser tab lost focus during the run');
  await expect(details.getByRole('button', { name: 'Download the JSON' })).toBeVisible();
  await zone.getByRole('button', { name: /^RAGNAR/ }).click();
  await expect(zone.locator('#zone-details-4')).toHaveCount(0);
  expect(problems).toEqual([]);
});

test('measuring stores the result under the uppercased name and ranks it; an admin removes it', async ({
  page
}) => {
  test.setTimeout(120_000);
  const problems = watchConsole(page);
  await page.goto('/');
  const zone = card(page);
  await zone.getByLabel('Character name').fill('  tester  ');
  await zone.getByRole('button', { name: 'Measure' }).click();
  await expect(zone.getByRole('status')).toContainText('TESTER');
  await expect(zone.getByRole('button', { name: 'Cancel' })).toBeVisible();
  await expect(page.locator('.scenery-canvas')).toHaveCount(0);
  await expect(page.locator('.backdrop')).toHaveAttribute('data-scenery', 'still');
  const verdict = zone.getByRole('status');
  await expect(verdict).toContainText(/Your result|Nothing was recorded/, { timeout: 90_000 });
  await expect(verdict).toContainText('Your result');
  await expect(zone.getByRole('img', { name: /Overall score/ })).toBeVisible();
  await expect(zone.getByText(/of 7$/)).toBeVisible();
  const own = zone.locator('tr.zone-own');
  await expect(own).toHaveCount(1);
  await expect(own).toContainText('TESTER');
  await expect(zone.locator('tbody > tr:not(.zone-details)')).toHaveCount(7);
  await expect(zone.locator('tr.zone-details')).toContainText('Measured against guild site');
  await zone.getByRole('button', { name: 'Measure again' }).click();
  await expect(zone.getByLabel('Character name')).toBeVisible();
  await expect(zone.getByRole('button', { name: 'Remove TESTER' })).toHaveCount(0);
  await logIn(page);
  await page.goto('/');
  await expect(zone.locator('tbody > tr:not(.zone-details)')).toHaveCount(7);
  await zone.getByRole('button', { name: 'Remove TESTER' }).click();
  await zone.getByRole('button', { name: 'Really remove?' }).click();
  await expect(zone.locator('tbody > tr:not(.zone-details)')).toHaveCount(6);
  await expect(zone.getByText('TESTER')).toHaveCount(0);
  expect(problems).toEqual([]);
});

test('the zone API validates, ranks and serves the probe', async ({ request }) => {
  const list = await request.get('/api/v1/zone/results');
  expect(list.status()).toBe(200);
  const items = ((await list.json()) as { items: { rank: number; name: string }[] }).items;
  expect(items.map((item) => item.rank)).toEqual(items.map((_, index) => index + 1));

  const bad = await request.put('/api/v1/zone/results/NOBODY', { data: { schemaVersion: 1 } });
  expect(bad.status()).toBe(400);
  expect(await bad.json()).toMatchObject({ error: { code: 'bad_request' } });

  const refused = await request.delete('/api/v1/zone/results/NOBODY');
  expect(refused.status()).toBe(401);
  expect(await refused.json()).toMatchObject({ error: { code: 'unauthorized' } });

  const login = await request.post('/api/v1/admin/login', { data: { password: 'anything' } });
  expect(login.status()).toBe(204);
  const missing = await request.delete('/api/v1/zone/results/NOBODY');
  expect(missing.status()).toBe(404);

  const health = await request.get('/api/v1/zone/probe/health');
  expect(health.status()).toBe(200);
  expect(await health.json()).toMatchObject({ ok: true, service: 'valheim-zone-probe' });
  expect(health.headers()['cache-control']).toBe('no-store');

  const ping = await request.get('/api/v1/zone/probe/ping?t=1');
  expect(typeof ((await ping.json()) as { t: number }).t).toBe('number');

  const download = await request.get('/api/v1/zone/probe/download?bytes=1000');
  expect(download.status()).toBe(200);
  expect(download.headers()['content-type']).toBe('application/octet-stream');
  expect((await download.body()).byteLength).toBe(1000);

  const upload = await request.post('/api/v1/zone/probe/upload', {
    data: Buffer.alloc(300_000, 7),
    headers: { 'content-type': 'application/octet-stream' }
  });
  expect(await upload.json()).toEqual({ received: 300_000 });
});
