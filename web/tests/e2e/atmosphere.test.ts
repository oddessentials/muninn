import { expect, test, type Page } from '@playwright/test';

async function allowScenery(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { value: 8 });
    Object.defineProperty(navigator, 'deviceMemory', { value: 8 });
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      kind: string,
      options?: WebGLContextAttributes
    ) {
      return original.call(
        this,
        kind,
        kind === 'webgl' ? { ...options, failIfMajorPerformanceCaveat: false } : options
      );
    } as typeof original;
  });
}

test('the ultrawide scenery renders without WebGL errors and stays behind the content', async ({
  page
}) => {
  await allowScenery(page);
  await page.setViewportSize({ width: 3440, height: 1440 });
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  await page.goto('/');
  await expect(page.locator('.backdrop')).toHaveAttribute('data-scenery', 'animated');
  const surface = await page.locator('.scenery-canvas').evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    const gl = canvas.getContext('webgl')!;
    return {
      pixels: canvas.width * canvas.height,
      error: gl.getError(),
      interactive: getComputedStyle(canvas).pointerEvents
    };
  });
  expect(surface.pixels).toBeLessThanOrEqual(902_000);
  expect(surface.error).toBe(0);
  expect(surface.interactive).toBe('none');
  await page.getByLabel('Character name').fill('SCENERY');
  await page.getByRole('link', { name: 'Players', exact: true }).click();
  await expect(page.locator('main h1')).toHaveText('Players');
  await page.getByRole('link', { name: 'Deaths', exact: true }).click();
  await expect(page).toHaveURL(/sort=deaths/);
  await expect(page.locator('.scenery-canvas')).toHaveCount(1);
  await page.evaluate(() => scrollTo(0, 900));
  const bounds = await page.locator('.backdrop').boundingBox();
  expect(bounds).toMatchObject({ x: 0, y: 0, width: 3440, height: 1440 });
  expect(problems).toEqual([]);
});

for (const profile of ['mobile', 'reduced motion', 'save data', 'limited device']) {
  test(`${profile} keeps the artwork without downloading or starting the renderer`, async ({
    page
  }) => {
    const rendererRequests: string[] = [];
    page.on('request', (request) => {
      if (/\/scenery(?:-shaders)?\.ts/.test(request.url())) rendererRequests.push(request.url());
    });
    if (profile === 'mobile') await page.setViewportSize({ width: 390, height: 844 });
    if (profile === 'reduced motion') await page.emulateMedia({ reducedMotion: 'reduce' });
    if (profile === 'save data') {
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'connection', {
          value: Object.assign(new EventTarget(), { saveData: true })
        });
      });
    }
    if (profile === 'limited device') {
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'hardwareConcurrency', { value: 2 });
      });
    }
    await page.goto('/');
    await page.getByRole('link', { name: 'Players', exact: true }).click();
    await expect(page.locator('main h1')).toHaveText('Players');
    await expect(page.locator('.scenery-canvas')).toHaveCount(0);
    await expect(page.locator('.backdrop')).toHaveAttribute('data-scenery', 'still');
    expect(
      await page
        .locator('.backdrop img')
        .evaluate((image) => (image as HTMLImageElement).naturalWidth)
    ).toBeGreaterThan(0);
    expect(rendererRequests).toEqual([]);
  });
}

test('the zone benchmark suspends the scenery and hands it back when cancelled', async ({
  page
}) => {
  await allowScenery(page);
  await page.goto('/');
  const backdrop = page.locator('.backdrop');
  const canvas = page.locator('.scenery-canvas');
  await expect(backdrop).toHaveAttribute('data-scenery', 'animated');
  await page.getByLabel('Character name').fill('SCENERY');
  await page.getByRole('button', { name: 'Measure' }).click();
  await expect(canvas).toHaveCount(0);
  await expect(backdrop).toHaveAttribute('data-scenery', 'still');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('button', { name: 'Measure' })).toBeVisible({ timeout: 30_000 });
  await expect(canvas).toHaveCount(1);
  await expect(backdrop).toHaveAttribute('data-scenery', 'animated', { timeout: 15_000 });
});

test('the scenery toggle persists and responds to changing motion and viewport preferences', async ({
  page
}) => {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  await allowScenery(page);
  await page.goto('/');
  const toggle = page.getByRole('button', { name: /Scenery/ });
  await expect(page.locator('.backdrop')).toHaveAttribute('data-scenery', 'animated');
  await toggle.focus();
  await page.keyboard.press('Space');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.scenery-canvas')).toHaveCount(0);
  await page.reload();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.scenery-canvas')).toHaveCount(0);
  await toggle.click();
  await expect(page.locator('.backdrop')).toHaveAttribute('data-scenery', 'animated');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(toggle).toBeDisabled();
  await expect(page.locator('.scenery-canvas')).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.locator('.backdrop')).toHaveAttribute('data-scenery', 'animated');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.scenery-canvas')).toHaveCount(0);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await expect(page.locator('.backdrop')).toHaveAttribute('data-scenery', 'animated');
  expect(problems).toEqual([]);
});

for (const failure of ['unavailable WebGL', 'shader failure', 'artwork upload failure']) {
  test(`${failure} leaves navigation and the illustrated fallback working`, async ({ page }) => {
    await allowScenery(page);
    await page.addInitScript((mode) => {
      if (mode === 'unavailable WebGL') {
        const original = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (
          this: HTMLCanvasElement,
          kind: string,
          options?: unknown
        ) {
          return kind === 'webgl' ? null : original.call(this, kind, options);
        } as typeof original;
      } else if (mode === 'artwork upload failure') {
        WebGLRenderingContext.prototype.texImage2D = function () {
          throw new Error('Artwork upload failed');
        };
      } else {
        const original = WebGLRenderingContext.prototype.getProgramParameter;
        WebGLRenderingContext.prototype.getProgramParameter = function (program, parameter) {
          return parameter === this.LINK_STATUS ? false : original.call(this, program, parameter);
        };
      }
    }, failure);
    await page.goto('/');
    await expect(page.locator('.backdrop')).toHaveAttribute('data-scenery', 'unavailable');
    await expect(page.getByRole('button', { name: 'Scenery still' })).toBeDisabled();
    await expect(page.locator('.backdrop img')).toBeVisible();
    await page.getByRole('link', { name: 'World', exact: true }).click();
    await page.getByRole('button', { name: 'Reveal the map' }).first().click();
    await expect(page.locator('.map-shroud')).toHaveCount(0);
    await expect(page.locator('main h1')).toContainText('The world of');
  });
}

test('pausing during artwork decoding does not start a discarded renderer', async ({ page }) => {
  await allowScenery(page);
  await page.addInitScript(() => {
    const original = HTMLImageElement.prototype.decode;
    let first = true;
    HTMLImageElement.prototype.decode = function () {
      if (!first || !this.src.includes('/art/tavern-')) return original.call(this);
      first = false;
      return new Promise<void>((resolve) => {
        (window as Window & { finishArtwork?: () => void }).finishArtwork = resolve;
      });
    };
  });
  await page.goto('/');
  await page.waitForFunction(
    () => (window as Window & { finishArtwork?: () => void }).finishArtwork
  );
  const toggle = page.getByRole('button', { name: /Scenery/ });
  await toggle.click();
  await expect(page.locator('.scenery-canvas')).toHaveCount(0);
  await page.evaluate(() => (window as Window & { finishArtwork?: () => void }).finishArtwork?.());
  await expect(page.locator('.backdrop')).toHaveAttribute('data-scenery', 'still');
  await page.getByRole('link', { name: 'Players', exact: true }).click();
  await expect(page.locator('main h1')).toHaveText('Players');
  await expect(page.locator('.scenery-canvas')).toHaveCount(0);
  await toggle.click();
  await expect(page.locator('.backdrop')).toHaveAttribute('data-scenery', 'animated');
  await expect(page.locator('.scenery-canvas')).toHaveCount(1);
});

test('the renderer recovers from context loss and stops drawing in a hidden tab', async ({
  page
}) => {
  await allowScenery(page);
  await page.addInitScript(() => {
    const original = WebGLRenderingContext.prototype.drawArrays;
    WebGLRenderingContext.prototype.drawArrays = function (...args) {
      const canvas = this.canvas as HTMLCanvasElement;
      canvas.dataset.draws = String(Number(canvas.dataset.draws ?? 0) + 1);
      original.apply(this, args);
    };
  });
  await page.goto('/');
  const backdrop = page.locator('.backdrop');
  const canvas = page.locator('.scenery-canvas');
  await expect(backdrop).toHaveAttribute('data-scenery', 'animated');
  await canvas.evaluate((element) => {
    const surface = element as HTMLCanvasElement & { restoreScenery?: () => void };
    const extension = surface.getContext('webgl')!.getExtension('WEBGL_lose_context')!;
    surface.restoreScenery = () => extension.restoreContext();
    extension.loseContext();
  });
  await expect(backdrop).toHaveAttribute('data-scenery', 'unavailable');
  await expect(page.locator('main h1')).toHaveText('Dashboard');
  await canvas.evaluate((element) => {
    (element as HTMLCanvasElement & { restoreScenery: () => void }).restoreScenery();
  });
  await expect(backdrop).toHaveAttribute('data-scenery', 'animated');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(backdrop).toHaveAttribute('data-scenery', 'paused');
  const pausedDraws = await canvas.getAttribute('data-draws');
  await page.waitForTimeout(300);
  expect(await canvas.getAttribute('data-draws')).toBe(pausedDraws);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(backdrop).toHaveAttribute('data-scenery', 'animated');
  await expect(canvas).not.toHaveAttribute('data-draws', pausedDraws!);
});
