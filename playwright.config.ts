/**
 * playwright.config.ts — UI suite.
 *
 * The app is a hash-routed SPA served by Vite. `npm run dev:e2e` pins
 * the port with `--strictPort` so the dev server can't silently drift
 * onto 5174 when 5173 is busy (which would leave `webServer.url`
 * polling a dead port).
 *
 * Three projects:
 *   - `chromium` — desktop 1440×900, the sidebar layout. The default.
 *   - `mobile`   — Pixel 7, the off-canvas drawer layout. Only specs
 *                  tagged `@mobile` run here (see `testMatch` below).
 *   - `no-sync`  — the SAME desktop layout, but against a build with
 *                  no Supabase credentials. FIN-C01's precondition is
 *                  "a build without Supabase environment variables",
 *                  and that is a BUILD-TIME decision — so it needs its
 *                  OWN server. See `vite.config.nosync.ts`.
 */
import { defineConfig, devices } from '@playwright/test';

const PORT = 5174;
const BASE_URL = `http://localhost:${PORT}`;

/** The sync-disabled build's port — one above the main server. */
const NO_SYNC_PORT = 5175;
const NO_SYNC_URL = `http://localhost:${NO_SYNC_PORT}`;

export default defineConfig({
  testDir: './test/e2e/ui_tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  timeout: 30_000,
  expect: { timeout: 5_000 },

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
  },

  projects: [
    {
      name: 'chromium',
      // The desktop project runs everything EXCEPT the specs that
      // need a different server or a different layout.
      //
      //   - `*.mobile.spec.ts` needs the drawer layout, so it runs
      //     on the `mobile` project instead.
      //   - `*.nosync.spec.ts` needs the SYNC-DISABLED build on port
      //     5175, so it runs on the `no-sync` project instead.
      //
      // Without these exclusions each file would run twice — once
      // here, against the wrong server.
      testIgnore: /.*\.(mobile|nosync)\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      // The drawer tests are the only ones that need a phone viewport.
      // `testMatch` keeps the rest of the suite off this project so we
      // don't pay for the same specs twice.
      name: 'mobile',
      testMatch: /.*\.mobile\.spec\.ts$/,
      use: { ...devices['Pixel 7'] },
    },
    {
      // FIN-C01 only: the sync-disabled build.
      //
      // `testMatch` names the one spec file, and the spec itself
      // guards its other cases with `test.skip(!BACKEND, …)` — so
      // only the "build without Supabase" case runs here. The
      // second entry in the config's `webServer` array starts the
      // sync-disabled Vite instance with `vite.config.nosync.ts`,
      // which reads its env from an empty scratch directory and
      // therefore exposes `''` for both `BASE_URL` and
      // `BASE_ANON_KEY`.
      name: 'no-sync',
      testMatch: /.*\.nosync\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        baseURL: NO_SYNC_URL,
      },
    },
  ],

  // TWO servers, because cloud sync is a BUILD-TIME decision and the
  // suite needs both a configured build and a sync-disabled one.
  //
  //   - 5174 — the ordinary dev server, which reads `.env.local` and
  //     is therefore the CONFIGURED build.
  //   - 5175 — the sync-disabled build, started from
  //     `vite.config.nosync.ts`. That config points Vite's `envDir`
  //     at an empty scratch directory, so `.env.local` is never read
  //     and the bundle sees `''` for both `BASE_URL` and
  //     `BASE_ANON_KEY` — a genuine "fresh checkout" build.
  //
  // The `no-sync` project is the only one that talks to 5175.
  webServer: [
    {
      command: 'npm run dev:e2e',
      url: BASE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: 'npm run dev:e2e:nosync',
      url: NO_SYNC_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
