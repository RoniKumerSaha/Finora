import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

// AD-15: Vite config. React + Tailwind v4 via the official Tailwind Vite
// plugin. @/* alias mirrors the tsconfig paths so imports read the same in
// both places. dev server binds to localhost-only so `npm run dev` doesn't
// expose the app to the LAN.

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
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