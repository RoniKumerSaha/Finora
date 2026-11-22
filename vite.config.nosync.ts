/**
 * vite.config.nosync.ts — the SYNC-DISABLED build.
 *
 * Finora's cloud sync is a BUILD-TIME decision: `src/lib/supabase.ts`
 * reads `import.meta.env.BASE_URL` and `import.meta.env.BASE_ANON_KEY`,
 * and exports `supabase === null` when either is missing. When it is
 * null the `SyncEngine` reports `unconfigured` and the Settings panel
 * renders the "Cloud sync is disabled in this build" notice instead of
 * the signed-out panel.
 *
 * So the FIN-C01 precondition — "a build without Supabase environment
 * variables" — needs a build that genuinely lacks them.
 *
 * ## How this config produces that build
 *
 * `vite.config.ts` calls `loadEnv(mode, root, '')`, which reads
 * `.env.local` from the project ROOT. That file holds the developer's
 * real backend credentials, so the default dev server is ALWAYS the
 * *configured* build.
 *
 * This config points `envDir` at an empty scratch directory. Vite
 * reads `envDir` (not the project root) when loading env files, so
 * `.env.local` in the root is never seen and the two variables come
 * back empty — exactly the "fresh checkout, no `.env.local`" build.
 *
 * It then re-declares the same `define` block, substituting empty
 * strings, so the client bundle sees `''` for both names and
 * `supabaseEnabled` is `false`.
 *
 * The port is 5175 — one above the main e2e server's 5174 — so the
 * two builds can run side by side.
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';

export default defineConfig(() => {
  // A scratch dir with no env files in it. `envDir` must EXIST for
  // Vite to resolve against it, so it is created here.
  const envDir = path.resolve(import.meta.dirname, 'test', 'e2e', '.nosync-env');
  mkdirSync(envDir, { recursive: true });

  const env = loadEnvFrom(envDir);

  return {
    // Point Vite's env loading at the scratch dir instead of the
    // project root, so `.env.local` (and the developer's real
    // credentials) are never read.
    envDir,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
    define: {
      'import.meta.env.BASE_URL': JSON.stringify(env.BASE_URL ?? ''),
      'import.meta.env.BASE_ANON_KEY': JSON.stringify(env.BASE_ANON_KEY ?? ''),
    },
    server: {
      host: 'localhost',
      port: 5175,
    },
  };
});

/**
 * Read env files from `dir`.
 *
 * A tiny stand-in for Vite's `loadEnv(mode, dir, '')`. The scratch
 * dir holds no env files, so this returns `{}` — but the lookup is
 * written out rather than hard-coded so the config keeps working if
 * someone drops a `.env` into the scratch dir on purpose.
 */
function loadEnvFrom(dir: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const name of ['.env.local', '.env']) {
    const file = path.join(dir, name);
    if (!existsSync(file)) continue;
    for (const rawLine of readFileSync(file, 'utf8').split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (key) values[key] = value;
    }
  }
  return values;
}
