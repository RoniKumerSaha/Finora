import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./test/setup.ts'],
    // Unit / component specs live under `test/unit/`, mirroring the
    // `src/` tree they exercise. The Playwright e2e specs under
    // `test/e2e/` use `test.describe()` from @playwright/test, which
    // Vitest cannot run — including them here made `npm test` fail
    // with "Playwright Test did not expect test.describe() to be
    // called here". E2E runs via `npm run test:e2e` (Playwright's own
    // runner).
    include: ['test/unit/**/*.spec.{ts,tsx}'],
  },
});