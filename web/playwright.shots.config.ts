import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/shots',
  testMatch: '*.shots.ts',
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5174',
    browserName: 'chromium',
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1.25,
    reducedMotion: 'reduce',
    colorScheme: 'dark'
  },
  webServer: {
    command: 'npm run dev -- --port 5174 --strictPort',
    url: 'http://localhost:5174/api/v1/health',
    reuseExistingServer: false,
    timeout: 120_000,
    env: { API_MOCK: '1' }
  }
});
