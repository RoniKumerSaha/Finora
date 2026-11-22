/**
 * visual.config.ts — visual regression suite.
 *
 * Identical to `playwright.config.ts` except for `testDir` and the
 * screenshot policy (`off` here, `only-on-failure` for the UI suite).
 * The `viewport` and `ignoreHTTPSErrors` values MUST match the config
 * that generated the committed baselines, or every snapshot is invalid.
 *
 * Snapshots are OS-specific: a `-linux` baseline cannot pass on
 * Windows or macOS. The CI visual job runs on the same OS as the
 * committed baselines.
 */
import { defineConfig, devices } from '@playwright/test';

const PORT = 5174;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './test/e2e/visual_tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  timeout: 30_000,
  expect: { timeout: 5_000 },

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    // Snapshots ARE the assertion — an on-failure screenshot would
    // just add noise to the report.
    screenshot: 'off',
    video: 'off',
    actionTimeout: 10_000,
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],

  webServer: {
    command: 'npm run dev:e2e',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
