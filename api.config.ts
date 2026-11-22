/**
 * api.config.ts — Supabase-direct API suite.
 *
 * There is no first-party HTTP API in Finora. The only network
 * surface is Supabase, and it is opt-in (build-time `BASE_URL` +
 * `BASE_ANON_KEY`). So this suite is deliberately kept OUT of the
 * default gate — it only runs when a Supabase instance is configured.
 *
 * The highest-value test here is RLS isolation: user A must not be
 * able to read user B's `finora_state` row. That's the security
 * property the whole cloud-sync design rests on.
 *
 * Every spec guards itself with `test.skip(!BACKEND)`.
 *
 * ## Where the credentials come from
 *
 * `process.env` first (CI secrets, or the developer's shell), then
 * `.env.local` as a fallback — the same precedence the app's own
 * loader and `test/e2e/support/env.ts` use. `envValue` is imported
 * from the suite's own support module so there is ONE loader, not
 * two that can drift.
 */
import { defineConfig } from '@playwright/test';
import { envValue } from './test/e2e/support/env';

const BASE_URL = envValue('BASE_URL');
const BASE_ANON_KEY = envValue('BASE_ANON_KEY');

export default defineConfig({
  testDir: './test/e2e/api_tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  timeout: 30_000,
  expect: { timeout: 5_000 },

  use: {
    // No browser is launched — the `request` fixture talks HTTP only.
    baseURL: BASE_URL || 'http://127.0.0.1:54321',
    extraHTTPHeaders: BASE_ANON_KEY ? { apikey: BASE_ANON_KEY } : {},
  },
});
