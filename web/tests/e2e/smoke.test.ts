import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const projectVersion = (
  JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8')) as {
    version: string;
  }
).version;

function watchConsole(page: Page): string[] {
  const problems: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || /hydration/i.test(message.text()))
      problems.push(message.text());
  });
  page.on('pageerror', (error) => problems.push(error.message));
  return problems;
}

async function revealMap(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Reveal the map' }).first().click();
  await expect(page.locator('.map-shroud')).toHaveCount(0);
}

async function open(page: Page, path: string, heading: string | RegExp): Promise<string[]> {
  const problems = watchConsole(page);
  const response = await page.goto(path);
  expect(response?.status()).toBe(200);
  await expect(page.locator('main h1')).toHaveText(heading);
  await expect(page.getByText('Could not load')).toHaveCount(0);
  return problems;
}

test('the dashboard shows status, the zone leaders, who is online and the latest events', async ({
  page
}) => {
  const problems = await open(page, '/', 'Dashboard');
  await expect(page.getByText('Online', { exact: true })).toBeVisible();
  await expect(page.getByText('2 of 10', { exact: true })).toBeVisible();
  await expect(page.locator('.map-frame')).toHaveCount(0);
  await expect(page.locator('#zone tbody > tr').first()).toContainText('BJORN');
  const onlineCard = page.locator('section', { hasText: 'Online now' });
  await expect(onlineCard.getByRole('link', { name: 'Bjorn' })).toBeVisible();
  await expect(onlineCard.getByRole('link', { name: 'Freya' })).toBeVisible();
  await expect(page.locator('main li[data-type]').first()).toBeVisible();
  await expect(page.locator('main li[data-type="world.saved"]')).toHaveCount(0);
  await expect(page.getByText('4 of 8 defeated, Yagluth is next.')).toBeVisible();
  await expect(page.getByText('live', { exact: true })).toBeVisible({ timeout: 15_000 });
  expect(problems).toEqual([]);
});

test('the sun clock runs on the dashboard and in the strip', async ({ page }) => {
  const problems = await open(page, '/', 'Dashboard');
  const dial = page.locator('.sun-dial');
  await expect(dial).toBeVisible();
  await expect(dial).toHaveAttribute('data-state', 'live');
  const readout = dial.getByRole('timer');
  await expect(readout).toContainText('Day 193');
  await expect(readout).toContainText(/\b\d\d:\d\d\b/);
  await expect(readout).toContainText(/Night|Morning|Afternoon|Evening/);
  await expect(readout).toContainText(/(Nightfall|Dawn) in \d+ (min|s)/);
  await expect(page.locator('[data-clock]')).toHaveText(/^Day 193 · \d\d:\d\d$/);
  const marker = dial.locator('.sun-dial-marker');
  const before = await marker.getAttribute('transform');
  await expect(async () => {
    expect(await marker.getAttribute('transform')).not.toBe(before);
  }).toPass({ timeout: 5000 });
  expect(problems).toEqual([]);
});

test('the watch page shows the clock, who is on and the latest events without the site chrome', async ({
  page
}) => {
  const problems = await open(page, '/widget', 'Watch');
  await expect(page.locator('header, footer, nav')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Music/ })).toHaveCount(0);
  const dial = page.locator('.sun-dial');
  await expect(dial).toHaveAttribute('data-state', 'live');
  await expect(dial.getByRole('timer')).toContainText('Day 193');
  await expect(page.getByText('2 of 10', { exact: true })).toBeVisible();
  const onlineNow = page.getByRole('list', { name: 'Online now' });
  await expect(onlineNow).toContainText('Bjorn');
  await expect(onlineNow).toContainText('Freya');
  const lines = page.locator('main li[data-type]');
  await expect(lines.first()).toBeVisible();
  expect(await lines.count()).toBeLessThanOrEqual(5);
  await expect(page.locator('main li[data-type="world.saved"]')).toHaveCount(0);
  expect(problems).toEqual([]);
});

test('the clock pops out into its own window when picture-in-picture is missing', async ({
  page,
  context
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'documentPictureInPicture', { value: undefined });
  });
  await open(page, '/', 'Dashboard');
  const [popup] = await Promise.all([
    context.waitForEvent('page'),
    page.getByRole('button', { name: 'Pop out the clock' }).click()
  ]);
  await expect(popup).toHaveURL(/\/widget$/);
  await expect(popup.locator('.sun-dial')).toBeVisible();
});

test('the player list sorts and filters through the query string', async ({ page }) => {
  const problems = await open(page, '/players', 'Players');
  await expect(page.locator('main tbody tr')).toHaveCount(8);
  await page.getByRole('link', { name: 'Deaths' }).click();
  await expect(page).toHaveURL(/sort=deaths/);
  await expect(page.locator('th[aria-sort="descending"]')).toContainText('Deaths');
  await page.goto('/players?online=true');
  await expect(page.locator('main tbody tr').first()).toContainText('Bjorn');
  expect(problems).toEqual([]);
});

test('a player page shows identity, statistics, deaths and the map', async ({ page }) => {
  const problems = await open(page, '/players/1', /Bjorn/);
  await expect(page.getByText('V_76561198012345678')).toBeVisible();
  await expect(page.getByText('Playtime')).toBeVisible();
  await expect(page.locator('#deaths')).toContainText('Cause not observed');
  await expect(page.locator('#deaths')).toContainText('Killed by Troll');
  await expect(page.locator('#biomes tbody tr')).toHaveCount(5);
  await expect(page.locator('#bosses')).toContainText('Moder');
  await expect(page.locator('#sessions tbody tr').first()).toContainText('still online');
  await revealMap(page);
  await expect(page.getByRole('img', { name: /Recent path/ })).toBeVisible();
  expect(problems).toEqual([]);
});

test('an unknown player answers with the site 404 page', async ({ page }) => {
  const response = await page.goto('/players/999');
  expect(response?.status()).toBe(404);
  await expect(page.locator('main h1')).toHaveText('Nothing here');
});

test('the boss pages show progression and the timeline', async ({ page }) => {
  const problems = await open(page, '/bosses', 'Bosses');
  await expect(page.locator('main ol#forsaken > li')).toHaveCount(8);
  await expect(page.locator('main ol#mini-bosses > li')).toHaveCount(6);
  await expect(page.getByText('4 of 8 defeated.')).toBeVisible();
  await expect(page.locator('main ol#forsaken')).toContainText('Kall Fimbulbringer');
  await expect(page.locator('main ol#mini-bosses')).toContainText('Serpent');
  await expect(page.locator('main tbody tr')).toHaveCount(7);
  await page.getByRole('link', { name: 'Eikthyr', exact: true }).click();
  await expect(page.locator('main h1')).toHaveText('Eikthyr');
  await expect(page.locator('main ol > li')).toHaveCount(6);
  await expect(page.getByText('first kill')).toBeVisible();
  await expect(page.getByText('Credited: Astrid.')).toBeVisible();
  expect(problems).toEqual([]);
});

test('the raid pages list raids and show a hidden player as someone', async ({ page }) => {
  const problems = await open(page, '/raids', 'Raids');
  await expect(page.locator('main tbody tr')).toHaveCount(4);
  await expect(page.locator('main tbody')).toContainText('cut short');
  await expect(page.locator('main tbody')).toContainText(
    'already under way when the server started'
  );
  await page.getByRole('link', { name: 'The forest is moving...' }).click();
  await expect(page.locator('main h1')).toHaveText('The forest is moving...');
  await expect(page.locator('main tbody tr')).toHaveCount(2);
  await expect(page.locator('main tbody')).toContainText('someone');
  expect(problems).toEqual([]);
});

test('the world page shows runs, rollbacks, saves and the map legend', async ({ page }) => {
  const problems = await open(page, '/world', /The world of/);
  await expect(page.getByText('lost (no heartbeat for 180 s)')).toBeVisible();
  await expect(page.getByText('1 h 30 min')).toBeVisible();
  await expect(page.getByText('Deep North')).toBeVisible();
  expect(problems).toEqual([]);
});

test('the structures page charts the series and names unknown and world builders', async ({
  page
}) => {
  const problems = await open(page, '/structures', 'Structures');
  await expect(page.getByRole('img', { name: /Pieces built and destroyed/ })).toBeVisible();
  await expect(page.getByText('Unknown or hidden builder')).toBeVisible();
  await expect(page.getByText('Generated with the world', { exact: true })).toBeVisible();
  await page.goto('/structures?range=7d');
  await expect(page.locator('a[aria-current="true"]')).toHaveText('7 days');
  expect(problems).toEqual([]);
});

test('the comfort page adds comfort up by group and sorts and filters every piece', async ({
  page
}) => {
  const problems = await open(page, '/comfort', 'Comfort');
  const summary = page.locator('section', { hasText: 'How it adds up' });
  await expect(summary.getByText('22', { exact: true })).toBeVisible();
  await expect(summary.getByText('24 with seasonal pieces')).toBeVisible();
  await expect(summary.getByText('29 min', { exact: true })).toBeVisible();
  const ladder = page.getByRole('list', { name: 'The best piece of each group' });
  await expect(ladder.getByRole('listitem')).toHaveCount(12);
  await expect(ladder.getByRole('listitem').first()).toContainText('Hearth');
  const table = page.locator('#pieces');
  const rows = table.locator('tbody tr');
  await expect(rows).toHaveCount(76);
  await expect(rows.first()).toContainText('Hearth');
  await table.getByRole('link', { name: /^Comfort/ }).click();
  await expect(page).toHaveURL(/sort=comfort&order=desc#pieces$/);
  await expect(table.locator('th[aria-sort="descending"]')).toContainText('Comfort');
  await expect(rows.first()).toContainText('Antler Throne');
  await table.locator('select[name=group]').selectOption('Fire');
  await table.getByRole('checkbox', { name: 'Built here' }).check();
  await table.getByRole('button', { name: 'Filter' }).click();
  await expect(page).toHaveURL(/group=Fire/);
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('Campfire');
  await expect(table.getByRole('status')).toHaveText('1 of 76 pieces');
  await table.getByRole('searchbox').fill('brazier');
  await table.getByRole('link', { name: 'Clear' }).click();
  await expect(rows).toHaveCount(76);
  await expect(table.locator('select[name=group]')).toHaveValue('');
  await expect(table.getByRole('checkbox', { name: 'Built here' })).not.toBeChecked();
  await expect(table.getByRole('searchbox')).toHaveValue('');
  await page.goto('/comfort?q=nothing-like-this');
  await expect(page.getByText('No comfort piece matches this filter.')).toBeVisible();
  expect(problems).toEqual([]);
});

test('the comfort planner adds up what the chosen pieces take and keeps the plan', async ({
  page
}) => {
  const problems = await open(page, '/comfort', 'Comfort');
  const planner = page.locator('#planner');
  const plan = page.locator('#plan');
  const materials = plan.getByRole('region', { name: 'Materials' });
  const stations = plan.getByRole('region', { name: 'Crafting stations' });
  const pieces = plan.getByRole('region', { name: 'Pieces' });
  await expect(plan).toContainText('Pick pieces from the build menu');
  const hearth = planner.getByRole('button', { name: /^Add Hearth, best of its group/ });
  await hearth.click();
  await hearth.click();
  await expect(hearth).toHaveAccessibleName('Add Hearth, best of its group, 2 planned');
  await expect(planner.locator('[data-slot][tabindex="0"]')).toHaveCount(1);
  await page.keyboard.press('End');
  await expect(planner.getByRole('button', { name: /^Add Yule Tree/ })).toBeFocused();
  await page.keyboard.press('Home');
  await expect(hearth).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(planner.getByRole('button', { name: /^Add Dragon Bed/ })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect
    .poll(() => new URL(page.url()).searchParams.get('plan'))
    .toBe('hearth*2.piece_bed02');
  await expect(materials.getByRole('listitem').filter({ hasText: 'Stone' })).toContainText('30');
  await expect(materials.getByRole('listitem').filter({ hasText: 'Finewood' })).toContainText('40');
  await expect(stations).toContainText('Stonecutter');
  await expect(stations).toContainText('Workbench');
  await expect(plan.getByText('13 min', { exact: true })).toBeVisible();

  await page.reload();
  await expect(pieces.getByRole('listitem').filter({ hasText: 'Hearth' })).toContainText('2');
  await pieces.getByRole('button', { name: 'One fewer Hearth' }).click();
  await expect(materials.getByRole('listitem').filter({ hasText: 'Stone' })).toContainText('15');

  await page
    .locator('#pieces')
    .getByRole('link', { name: /^Comfort/ })
    .click();
  await expect(page).toHaveURL(/sort=comfort/);
  expect(new URL(page.url()).searchParams.get('plan')).toBe('hearth.piece_bed02');
  await expect(pieces.getByRole('listitem')).toHaveCount(2);

  await plan.getByRole('button', { name: 'Clear' }).click();
  await expect(plan).toContainText('Plan cleared.');
  await expect.poll(() => new URL(page.url()).searchParams.has('plan')).toBe(false);
  await plan.getByRole('button', { name: 'Undo' }).click();
  await expect(pieces.getByRole('listitem').filter({ hasText: 'Dragon Bed' })).toBeVisible();

  await plan.getByRole('button', { name: 'Clear' }).click();
  await plan.getByRole('button', { name: 'Plan the most comfort' }).click();
  await expect(plan.getByText('29 min', { exact: true })).toBeVisible();
  await expect(pieces.getByRole('listitem')).toHaveCount(11);
  expect(problems).toEqual([]);
});

test('the chat page filters by kind', async ({ page }) => {
  const problems = await open(page, '/chat?kind=ping', 'Chat');
  const lines = page.locator('main ul > li');
  await expect(lines.first()).toContainText('pinged');
  expect(await lines.count()).toBeGreaterThan(0);
  await expect(page.getByText('shouted')).toHaveCount(0);
  expect(problems).toEqual([]);
});

test('the activity feed hides noisy types unless asked and filters by player', async ({ page }) => {
  const problems = await open(page, '/activity', 'Activity');
  await expect(page.locator('main li[data-type]').first()).toBeVisible();
  await expect(page.locator('main li[data-type="server.heartbeat"]')).toHaveCount(0);
  await expect(page.locator('main li[data-type="world.dusk_approaching"]')).toContainText(
    'The bell tolls for dusk, nightfall in 1 min 45 s'
  );
  await expect(page.locator('main li[data-type="world.dawn_approaching"]')).toContainText(
    'The rooster crows for dawn, sunrise in 45 s'
  );
  await page.goto('/activity?types=server.heartbeat,creature.died');
  await expect(page.locator('main li[data-type="server.heartbeat"]')).toHaveCount(1);
  await expect(page.locator('main li[data-type="creature.died"]')).toHaveCount(1);
  await page.goto('/activity?player=8');
  await expect(page.locator('main li[data-type]')).toHaveCount(1);
  await expect(page.locator('main li[data-type="player.died"]')).toContainText(
    'cause not observed'
  );
  expect(problems).toEqual([]);
});

test('the admin pages log in, show health and queue a job', async ({ page }) => {
  const problems = await open(page, '/admin/login', 'Admin login');
  await page.getByLabel('Password').fill('anything');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.locator('main h1')).toHaveText('Telemetry health');
  await expect(page.getByText('25 s ago')).toBeVisible();
  await expect(
    page.getByText('The game server runs plugin 0.1.0 and this site is 0.6.0.')
  ).toBeVisible();
  await page.getByRole('button', { name: 'Run a backup now' }).click();
  await expect(page.getByRole('status').last()).toContainText('Job 42');
  await page.goto('/admin/players');
  await expect(page.locator('main tbody tr')).toHaveCount(9);
  await expect(page.getByText('hidden', { exact: true })).toBeVisible();
  await page.goto('/admin/events');
  await expect(page.locator('main tbody tr')).toHaveCount(50);
  await page.getByRole('button', { name: 'show' }).first().click();
  await expect(page.locator('main pre').first()).toContainText('"type": "player.position"');
  await page.goto('/admin/announce');
  await expect(page.locator('main h1')).toHaveText('Announce');
  await expect(page.locator('main tbody tr')).toHaveCount(5);
  await expect(page.locator('main tbody tr[data-status="delivered"]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Show in game' }).click();
  await expect(page.getByRole('alert').last()).toContainText('Write the message first.');
  await page.getByRole('radio', { name: 'Server restart', exact: true }).click();
  await page.getByRole('button', { name: 'In 15 min' }).click();
  await page.getByRole('button', { name: 'Schedule restart' }).click();
  await expect(page.getByRole('status').last()).toContainText('Restart scheduled');
  await page.getByRole('button', { name: 'Cancel' }).first().click();
  await expect(page.getByRole('status').last()).toContainText('Restart cancelled');
  await page.goto('/admin/settings');
  await expect(page.locator('main h1')).toHaveText('Settings');
  await expect(page.getByLabel('Site name')).toHaveValue('Valheim guild');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('status').last()).toHaveText('Nothing changed.');
  await page.getByLabel('Site name').fill('');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('alert').last()).toHaveText('Give the site a name.');
  await page.getByLabel('Site name').fill('Ravenhold');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('status').last()).toHaveText('Saved.');
  await page.getByLabel('Chat', { exact: true }).uncheck();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('status').last()).toHaveText('Saved.');
  await expect(page.getByLabel('Chat', { exact: true })).not.toBeChecked();
  await page.goto('/admin/plugin');
  await expect(page.locator('main h1')).toHaveText('Plugin');
  await expect(
    page.getByText('The server runs plugin 0.1.0 and this site ships 0.6.0.', { exact: false })
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Download GuildTelemetry.dll' })).toHaveAttribute(
    'href',
    '/api/v1/admin/plugin/dll'
  );
  await page.getByRole('button', { name: 'Show' }).click();
  await expect(page.getByText('mock-telemetry-secret-3q2mN8vRk1')).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download com.guildsite.telemetry.cfg' }).click();
  const config = await download;
  expect(config.suggestedFilename()).toBe('com.guildsite.telemetry.cfg');
  const text = readFileSync(await config.path(), 'utf8');
  expect(text).toContain('[General]');
  expect(text).toMatch(/^Url = http:\/\/localhost:\d+\/api\/ingest$/m);
  expect(text).toContain('Secret = mock-telemetry-secret-3q2mN8vRk1');
  await page.getByRole('button', { name: 'Make a new secret' }).click();
  await page.getByRole('button', { name: 'Replace the secret' }).click();
  await expect(page.getByRole('status').last()).toContainText('New secret made.');
  await expect(page.getByText('mock-telemetry-secret-3q2mN8vRk1')).toHaveCount(0);
  expect(problems).toEqual([]);
});

test('health reports mock mode', async ({ request }) => {
  const response = await request.get('/api/v1/health');
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({ ok: true, mock: true, version: projectVersion });
});

test('the footer shows the site version beside the versions the server reports', async ({
  page
}) => {
  await page.goto('/');
  await expect(page.locator('footer')).toContainText(
    `Site\u00a0${projectVersion} · Plugin\u00a00.1.0 · Valheim\u00a01.0.7`
  );
});

test('the stream sends a status frame on connect', async ({ page }) => {
  await page.goto('/');
  const serverName = await page.evaluate(
    () =>
      new Promise<string>((resolve, reject) => {
        const source = new EventSource('/api/v1/stream');
        const timer = setTimeout(() => reject(new Error('no status frame')), 10_000);
        source.addEventListener('status', (event) => {
          clearTimeout(timer);
          source.close();
          resolve(JSON.parse((event as MessageEvent<string>).data).server_name as string);
        });
      })
  );
  expect(serverName).toBe('Ravenhold');
});

test('unknown ids answer with the documented 404', async ({ request }) => {
  const response = await request.get('/api/v1/players/999');
  expect(response.status()).toBe(404);
  expect(await response.json()).toMatchObject({ error: { code: 'not_found' } });
});

const everyPage = [
  '/',
  '/players',
  '/players/1',
  '/bosses',
  '/bosses/defeated_eikthyr',
  '/raids',
  '/raids/2',
  '/world',
  '/structures',
  '/comfort',
  '/chat',
  '/activity',
  '/widget',
  '/players/999',
  '/admin/login',
  '/admin',
  '/admin/players',
  '/admin/announce',
  '/admin/events',
  '/admin/plugin',
  '/admin/settings'
];

for (const width of [320, 400]) {
  test(`every page fits a ${width} px viewport and loads only same-origin assets`, async ({
    page,
    baseURL
  }) => {
    await page.setViewportSize({ width, height: 800 });
    const foreign: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (!url.startsWith(baseURL ?? '') && !url.startsWith('data:')) foreign.push(url);
    });
    await page.goto('/admin/login');
    await page.getByLabel('Password').fill('anything');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/admin$/);
    for (const path of everyPage) {
      await page.goto(path);
      await expect(page.locator('main h1')).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow, `${path} scrolls sideways by ${overflow}px`).toBeLessThanOrEqual(0);
    }
    expect(foreign).toEqual([]);
  });
}

test('the music control is off by default, remembers a choice and never autoplays', async ({
  page
}) => {
  const audioRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/audio/')) audioRequests.push(request.url());
  });
  await page.goto('/');
  const toggle = page.getByRole('button', { name: /Music/ });
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(toggle).toHaveText(/Music off/);
  await page.getByRole('link', { name: 'Players' }).first().click();
  await expect(page).toHaveURL(/\/players$/);
  expect(audioRequests).toEqual([]);
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(toggle).toHaveText(/Music on/);
  await expect.poll(() => audioRequests.length).toBeGreaterThan(0);
  expect(await page.evaluate(() => localStorage.getItem('music'))).toBe('on');
  await page.reload();
  audioRequests.length = 0;
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(toggle).toHaveText(/Music ready/);
  await page.waitForTimeout(500);
  expect(audioRequests).toEqual([]);
  await page.locator('main h1').click();
  await expect(toggle).toHaveText(/Music on/);
  await expect.poll(() => audioRequests.length).toBeGreaterThan(0);
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => localStorage.getItem('music'))).toBeNull();
});

test('the map stays shrouded until revealed, remembers the choice and can be covered again', async ({
  page
}) => {
  const problems = await open(page, '/world', /The world of/);
  const shroud = page.locator('.map-shroud');
  await expect(shroud).toHaveCount(1);
  await expect(shroud).toContainText('Spoiler');
  await expect(page.getByRole('button', { name: 'Whole world' })).toHaveCount(0);
  await revealMap(page);
  await expect(page.getByRole('img', { name: /Biome map/ })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('map'))).toBe('revealed');
  await page.getByRole('link', { name: 'Players' }).first().click();
  await expect(page.locator('main h1')).toHaveText('Players');
  await page.getByRole('link', { name: 'Bjorn' }).first().click();
  await expect(page.locator('main h1')).toHaveText(/Bjorn/);
  await expect(shroud).toHaveCount(0);
  await page.goto('/world');
  await expect(page.getByRole('img', { name: /Biome map/ })).toBeVisible();
  await expect(shroud).toHaveCount(0);
  await page.getByRole('button', { name: 'Shroud' }).click();
  await expect(shroud).toHaveCount(1);
  expect(await page.evaluate(() => localStorage.getItem('map'))).toBeNull();
  await page.reload();
  await expect(shroud).toHaveCount(1);
  expect(problems).toEqual([]);
});
