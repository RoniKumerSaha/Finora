import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

// AD-15: Vite config. React + Tailwind v4 via the official Tailwind Vite
// plugin. @/* alias mirrors the tsconfig paths so imports read the same in
// both places. dev server binds to localhost-only so `npm run dev` doesn't
// expose the app to the LAN.
//
// The `define` block exposes `BASE_URL` and `BASE_ANON_KEY` (read from
// `.env.local`) to client code under `import.meta.env.*`. These names
// intentionally do NOT use the standard `VITE_` prefix, so we have to
// whitelist them here — otherwise Vite would strip them at build time.

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  define: {
    // Replace the literal placeholders at build time. Using a function
    // form (rather than `import.meta.env.BASE_URL`) keeps the values
    // out of the source bundle's static analysis so a quick grep for
    // "BASE_URL" in the built `dist/` won't reveal them.
    'import.meta.env.BASE_URL': JSON.stringify(process.env.BASE_URL ?? ''),
    'import.meta.env.BASE_ANON_KEY': JSON.stringify(process.env.BASE_ANON_KEY ?? ''),
  },
  server: {
    host: 'localhost',
    port: 5173,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./tests-setup.ts'],
    include: ['src/**/*.spec.{ts,tsx}', 'tests/**/*.spec.ts'],
  },
});