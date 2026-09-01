import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL?.trim();
if (!baseURL) {
  throw new Error('PLAYWRIGHT_BASE_URL is required for authenticated overlay evidence.');
}

export default defineConfig({
  testDir: './apps/web/e2e-authenticated',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 30_000,
  },
  outputDir: 'test-results/authenticated-overlay-performance',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/authenticated-overlay', open: 'never' }],
  ],
  use: {
    baseURL,
    // Authenticated traces can retain session headers. Keep the durable
    // evidence to synthetic screenshots and numeric JSON instead.
    trace: 'off',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'authenticated-setup',
      testMatch: /authenticated-overlay\.setup\.ts/,
    },
    {
      name: 'authenticated-desktop',
      testMatch: /authenticated-overlay-performance\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        storageState: 'playwright/.clerk/authenticated-overlay-user.json',
      },
      dependencies: ['authenticated-setup'],
    },
    {
      name: 'authenticated-mobile',
      testMatch: /authenticated-overlay-performance\.spec\.ts/,
      use: {
        ...devices['Pixel 7'],
        storageState: 'playwright/.clerk/authenticated-overlay-user.json',
      },
      dependencies: ['authenticated-setup'],
    },
  ],
});
