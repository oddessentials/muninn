import { test as base, type Page } from '@playwright/test';

export { expect, type APIRequestContext, type Page } from '@playwright/test';

async function hydrated(page: Page): Promise<void> {
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
}

export const test = base.extend({
  page: async ({ page }, use) => {
    const goto = page.goto.bind(page);
    const reload = page.reload.bind(page);
    page.goto = async (url, options) => {
      const response = await goto(url, options);
      await hydrated(page);
      return response;
    };
    page.reload = async (options) => {
      const response = await reload(options);
      await hydrated(page);
      return response;
    };
    await use(page);
  }
});
