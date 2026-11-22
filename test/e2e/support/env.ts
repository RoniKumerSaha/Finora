/**
 * env.ts — environment access for the e2e suite.
 *
 * ## Why not `dotenv`
 *
 * `dotenv` is not a dependency of this project and adding it just to
 * read one file would pull a package into `devDependencies` for no
 * other reason. The loader below is a dozen lines of `node:fs` and
 * does exactly one thing: make a key from `.env.local` visible on
 * `process.env` **without overwriting** a value that is already
 * there.
 *
 * The precedence matters:
 *
 *   1. `process.env` — set by CI (repository secrets) or by the
 *      developer's shell. Always wins.
 *   2. `.env.local` — the gitignored local file. A fallback only.
 *   3. Nothing — the variable is genuinely absent, and
 *      `requireEnv()` throws with the name so the failure is loud
 *      rather than a test that types `undefined` into a field.
 *
 * `.env.local` is gitignored, so no secret is ever committed. The
 * *names* of the variables are committed in `.env.example`.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const ENV_FILES = ['.env.local', '.env'];

/** The values parsed out of the local env files, keyed by name. */
const localEnv: Record<string, string> = (() => {
  const values: Record<string, string> = {};
  for (const file of ENV_FILES) {
    let contents: string;
    try {
      contents = readFileSync(resolve(REPO_ROOT, file), 'utf8');
    } catch {
      // A missing file is the normal case in CI.
      continue;
    }
    for (const rawLine of contents.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const name = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (name) values[name] = value;
    }
  }
  return values;
})();

/**
 * Read a variable, preferring `process.env` and falling back to the
 * local env file.
 */
export function envValue(name: string): string | undefined {
  return process.env[name] ?? localEnv[name];
}

/**
 * Read a variable that must exist.
 *
 * Throws with the variable name so a misconfigured run fails at the
 * first call with a message that says exactly what to set — instead
 * of failing later, deep inside a test, with `undefined` typed into a
 * password field.
 */
export function requireEnv(name: string): string {
  const value = envValue(name);
  if (value === undefined || value === '') {
    throw new Error(
      `Missing required environment variable ${name}. ` +
        `Set it in the environment or in .env.local — see .env.example.`,
    );
  }
  return value;
}

/**
 * Read a variable that may legitimately be absent.
 *
 * Used for the "is cloud sync configured?" probes: the suite skips
 * (rather than fails) when a backend is not available.
 */
export function optionalEnv(name: string): string | undefined {
  const value = envValue(name);
  return value === '' ? undefined : value;
}
