import { expect, test, type APIRequestContext } from '@playwright/test';

const siteName = 'Valheim guild';

const pages = [
  { path: '/', title: siteName, status: 200 },
  { path: '/players/1', title: `Bjorn · ${siteName}`, status: 200 },
  { path: '/bosses/defeated_eikthyr', title: `Eikthyr · ${siteName}`, status: 200 },
  { path: '/raids/2', title: /^The forest is moving\.\.\. · Valheim guild$/, status: 200 },
  { path: '/world', title: `World · ${siteName}`, status: 200 },
  { path: '/comfort', title: `Comfort · ${siteName}`, status: 200 },
  { path: '/admin/login', title: `Admin login · ${siteName}`, status: 200 },
  { path: '/players/999', title: /^404 .+ · Valheim guild$/, status: 404 }
];

const assets = [
  ['/og.jpg', 'image/jpeg'],
  ['/favicon.ico', ''],
  ['/favicon.svg', 'image/svg+xml'],
  ['/favicon-16.png', 'image/png'],
  ['/favicon-32.png', 'image/png'],
  ['/apple-touch-icon.png', 'image/png'],
  ['/icon-192.png', 'image/png'],
  ['/icon-512.png', 'image/png'],
  ['/icon-maskable-512.png', 'image/png'],
  ['/site.webmanifest', 'application/manifest+json']
] as const;

async function fetched(request: APIRequestContext, path: string, type: string): Promise<Buffer> {
  const response = await request.get(path);
  expect(response.status(), `${path} answers`).toBe(200);
  if (type) expect(response.headers()['content-type'], `${path} content type`).toContain(type);
  const body = await response.body();
  expect(body.length, `${path} is not empty`).toBeGreaterThan(0);
  if (path.endsWith('.ico')) expect(body.readUInt16LE(2), `${path} is an icon`).toBe(1);
  return body;
}

for (const entry of pages) {
  test(`${entry.path} carries a title, a description and the social tags`, async ({
    page,
    baseURL
  }) => {
    const response = await page.goto(entry.path);
    expect(response?.status()).toBe(entry.status);
    await expect(page).toHaveTitle(entry.title);
    const title = await page.title();
    const canonical = `${baseURL}${entry.path}`;
    const meta = (selector: string) => page.locator(`head ${selector}`);
    await expect(meta('meta[name="description"]')).toHaveCount(1);
    const description = await meta('meta[name="description"]').getAttribute('content');
    expect(description?.length ?? 0).toBeGreaterThan(20);
    await expect(meta('meta[property="og:title"]')).toHaveAttribute('content', title);
    await expect(meta('meta[property="og:description"]')).toHaveAttribute(
      'content',
      description ?? ''
    );
    await expect(meta('meta[property="og:site_name"]')).toHaveAttribute('content', siteName);
    await expect(meta('meta[property="og:type"]')).toHaveAttribute('content', 'website');
    await expect(meta('meta[property="og:url"]')).toHaveAttribute('content', canonical);
    await expect(meta('link[rel="canonical"]')).toHaveAttribute('href', canonical);
    await expect(meta('meta[property="og:image"]')).toHaveAttribute('content', `${baseURL}/og.jpg`);
    await expect(meta('meta[property="og:image:width"]')).toHaveAttribute('content', '1200');
    await expect(meta('meta[property="og:image:height"]')).toHaveAttribute('content', '630');
    await expect(meta('meta[name="twitter:card"]')).toHaveAttribute(
      'content',
      'summary_large_image'
    );
    await expect(meta('meta[name="twitter:title"]')).toHaveAttribute('content', title);
    await expect(meta('meta[name="twitter:image"]')).toHaveAttribute(
      'content',
      `${baseURL}/og.jpg`
    );
    for (const selector of [
      'meta[property="og:title"]',
      'meta[property="og:description"]',
      'meta[property="og:image"]',
      'meta[name="twitter:card"]',
      'link[rel="canonical"]'
    ]) {
      await expect(meta(selector), `${selector} appears once`).toHaveCount(1);
    }
  });
}

test('the icons, the social image and the manifest are served and agree with the page', async ({
  page,
  request
}) => {
  for (const [path, type] of assets) await fetched(request, path, type);
  const manifest = JSON.parse(
    (await fetched(request, '/site.webmanifest', 'application/manifest+json')).toString('utf8')
  ) as { name: string; theme_color: string; icons: { src: string; purpose?: string }[] };
  expect(manifest.name).toBe(siteName);
  expect(manifest.icons.some((icon) => icon.purpose === 'maskable')).toBe(true);
  for (const icon of manifest.icons) await fetched(request, icon.src, 'image/png');
  await page.goto('/');
  await expect(page.locator('head meta[name="theme-color"]')).toHaveAttribute(
    'content',
    manifest.theme_color
  );
  const linked = await page
    .locator('head link[rel="icon"], head link[rel="apple-touch-icon"], head link[rel="manifest"]')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));
  expect(linked.length).toBeGreaterThanOrEqual(5);
  for (const href of linked) {
    const response = await request.get(href);
    expect(response.status(), `${href} answers`).toBe(200);
  }
});
