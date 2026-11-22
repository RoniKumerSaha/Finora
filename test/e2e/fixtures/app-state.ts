/**
 * app-state.ts — IndexedDB seeding for the Finora e2e suite.
 *
 * Finora persists its entire state as ONE blob:
 *
 *   IndexedDB → database `finora` → store `kv` → key `state`
 *            → row `{ id: 'state', data: <State> }`
 *
 * (`src/domain/persistence.ts` — `SINGLETON_KEY = 'state'`, and the
 * Dexie schema is `kv: 'id'` / `meta: 'key'`.)
 *
 * `data` is written via structured clone, so it must be a plain
 * object — NOT a JSON string.
 *
 * ## Why `addInitScript` and not `page.evaluate`
 *
 * `main.tsx` awaits `ensureReady()` *before* React mounts, and
 * `ensureReady()` memoizes both its promise and its in-memory cached
 * value. Seeding after load therefore gets clobbered by the next
 * mutation. `page.addInitScript` runs before any page script, so the
 * app boots straight into the seeded state.
 *
 * ## Seeding rules (each one is a real trap)
 *
 *  1. Seed at least one income AND one expense category. The seeded
 *     path skips `mergeDefaults`, so `categories: []` makes the
 *     expense form render a "Restore default categories" recovery
 *     panel instead of the chip picker. The shared builder
 *     (`test/support/state.ts`) seeds the app's real default
 *     categories, so this is handled for you.
 *  2. Set `settings.onboardingComplete: true`, or Home renders the
 *     onboarding banner — which adds a "Dismiss banner" button and
 *     shifts the layout. The shared builder does this too.
 *  3. Never hand-compute `paidSoFar` / `saved` / `status`.
 *     `recomputeDerived()` runs on boot (`src/App.tsx`) and overwrites
 *     them. Seed the underlying transactions / contributions instead.
 *  4. Never set `settings.cloudSyncEnabled: true` in a fixture. A
 *     live Supabase session can reconcile and overwrite the seed.
 */
import type { Page } from '@playwright/test';
import type { State } from '@/domain/types';

/**
 * The state the fixtures seed.
 *
 * This used to be a hand-copied structural copy of the app's `State`
 * with every entity array typed `unknown[]` — a shape that was never
 * checked against `src/domain/types.ts`, so a field added to the app
 * would slip through and only break at runtime. It is now the app's
 * own `State` type, imported directly.
 */
export type SeedState = State;

/**
 * Write the state blob into IndexedDB before the app boots.
 *
 * The init script:
 *   - clears the legacy `localStorage['finora:v1']` key, so the
 *     pre-IndexedDB migration doesn't overwrite our seed, and
 *   - clears the PIN salt/hash so no lock screen blocks the test.
 *
 * ⚠️ **Order matters.** `seedState` and `seedPin` both install init
 * scripts, and Playwright runs them in the order they were added. So
 * `seedState` MUST be called BEFORE `seedPin` — otherwise the PIN
 * seed runs first and `seedState`'s "clear the PIN" wipes it again.
 *
 * ⚠️ **Init scripts re-run on every navigation.** `page.reload()`
 * re-runs them, so the "clear the PIN" step would wipe a PIN the test
 * just set. Pass `clearPin: false` for the cases that need a PIN to
 * survive a reload.
 */
export interface SeedStateOptions {
  /**
   * Clear the PIN salt/hash on every load. Defaults to `true` — most
   * suites want no lock screen. Set `false` when the test sets a PIN
   * and then reloads.
   */
  clearPin?: boolean;
}

export async function seedState(
  page: Page,
  state: SeedState,
  options: SeedStateOptions = {},
): Promise<void> {
  const clearPin = options.clearPin !== false;
  await page.addInitScript(
    async ({ s, clearPin: shouldClearPin }: { s: SeedState; clearPin: boolean }) => {
      localStorage.removeItem('finora:v1');
      if (shouldClearPin) {
        localStorage.removeItem('finora.pin.salt');
        localStorage.removeItem('finora.pin.hash');
      }

      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('finora');
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('kv')) {
            db.createObjectStore('kv', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('meta')) {
            db.createObjectStore('meta', { keyPath: 'key' });
          }
        };
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction(['kv', 'meta'], 'readwrite');
          tx.objectStore('kv').put({ id: 'state', data: s });
          tx.objectStore('meta').put({ key: 'schema', value: 1 });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      });
    },
    { s: state, clearPin },
  );
}

/**
 * Replace the seeded state MID-TEST and reload the app.
 *
 * ⚠️ `seedState` installs an INIT SCRIPT, and init scripts only run
 * on a navigation. `page.goto()` to the URL the page is ALREADY on is
 * a same-document navigation — Chromium does not reload, the script
 * does not re-run, and the app keeps the old state. This helper does
 * the reload explicitly.
 *
 * Init scripts accumulate, and they run in the order they were added,
 * so the LAST one to write the blob wins — which is the newest seed.
 */
export async function reseedState(
  page: Page,
  state: SeedState,
  options: SeedStateOptions = {},
): Promise<void> {
  await seedState(page, state, options);
  await page.reload();
  await page.locator('main').first().waitFor({ state: 'visible' });
}

/**
 * The localStorage keys the PIN feature owns.
 *
 * `src/security/pin.ts` stores the salt and the hash separately from
 * the persisted `State` blob — deliberately, so an Export backup can
 * never carry the credential out of the machine.
 */
export const PIN_SALT_KEY = 'finora.pin.salt';
export const PIN_HASH_KEY = 'finora.pin.hash';

/**
 * The sessionStorage keys the rate limiter owns.
 *
 * `src/security/rateLimit.ts` keeps the wrong-attempt counter and the
 * lockout deadline in `sessionStorage`, so closing the tab clears the
 * lockout (manual-plan defect #3 — a real security finding).
 */
export const PIN_ATTEMPTS_KEY = 'finora.pin.attempts';
export const PIN_LOCKOUT_KEY = 'finora.pin.lockoutUntil';

/**
 * A marker the `seedPin({ once: true })` fixture writes to
 * `sessionStorage` so it knows it has already run.
 */
export const PIN_SEED_MARKER_KEY = 'finora.e2e.pinSeeded';

/**
 * Seed a 6-digit PIN so the app boots straight into the lock screen.
 *
 * The hash is `hex(SHA-256(salt + '|' + pin))` over a base64 salt
 * (`src/security/pin.ts`), computed here in the page with WebCrypto so
 * the test never has to hard-code a hash — and so a change to the
 * hashing scheme breaks the fixture loudly instead of silently
 * unlocking nothing.
 *
 * `addInitScript` is required for the same reason as the IndexedDB
 * seed: `main.tsx` reads `hasPin()` during boot, before React mounts.
 *
 * ⚠️ **Idempotent on purpose.** Init scripts re-run on every
 * navigation, so this one only writes the PIN **when the device does
 * not already have one**. That way a PIN the app itself wrote (e.g.
 * the user rotated it in Settings) survives a reload instead of being
 * stomped back to the fixture's PIN.
 *
 * Pass `once: true` for the cases that assert the app can CLEAR the
 * PIN (the "Wipe all data" flow). Without it, the fixture would
 * re-seed the PIN on the next load and the assertion would be
 * measuring the fixture rather than the app.
 *
 * Pair it with `seedState(page, state, { clearPin: false })` — the
 * default `seedState` wipes the PIN keys on every load.
 */
export async function seedPin(
  page: Page,
  pin: string,
  options: { once?: boolean } = {},
): Promise<void> {
  const once = options.once === true;
  await page.addInitScript(
    async ({
      pin: p,
      saltKey,
      hashKey,
      attemptsKey,
      lockoutKey,
      markerKey,
      once: onlyOnce,
    }: {
      pin: string;
      saltKey: string;
      hashKey: string;
      attemptsKey: string;
      lockoutKey: string;
      markerKey: string;
      once: boolean;
    }) => {
      sessionStorage.removeItem(attemptsKey);
      sessionStorage.removeItem(lockoutKey);

      if (onlyOnce) {
        if (sessionStorage.getItem(markerKey)) return;
        sessionStorage.setItem(markerKey, '1');
      }

      // Already configured? Leave the device's own PIN alone.
      if (localStorage.getItem(saltKey) && localStorage.getItem(hashKey)) return;

      const saltBytes = new Uint8Array(16);
      crypto.getRandomValues(saltBytes);
      let salt = '';
      for (let i = 0; i < saltBytes.length; i++) {
        salt += String.fromCharCode(saltBytes[i]);
      }
      salt = btoa(salt);

      const data = new TextEncoder().encode(`${salt}|${p}`);
      const digest = await crypto.subtle.digest('SHA-256', data);
      const bytes = new Uint8Array(digest);
      let hash = '';
      for (let i = 0; i < bytes.length; i++) {
        hash += bytes[i].toString(16).padStart(2, '0');
      }

      localStorage.setItem(saltKey, salt);
      localStorage.setItem(hashKey, hash);
    },
    {
      pin,
      saltKey: PIN_SALT_KEY,
      hashKey: PIN_HASH_KEY,
      attemptsKey: PIN_ATTEMPTS_KEY,
      lockoutKey: PIN_LOCKOUT_KEY,
      markerKey: PIN_SEED_MARKER_KEY,
      once,
    },
  );
}

/**
 * Read the state blob back out of IndexedDB.
 *
 * Useful for asserting that a write actually landed, and for the
 * wipe cases (FIN-W01 / FIN-W02) that assert the store was emptied.
 */export async function readState(page: Page): Promise<SeedState | undefined> {
  return page.evaluate(
    () =>
      new Promise<SeedState | undefined>((resolve, reject) => {
        const req = indexedDB.open('finora');
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('kv', 'readonly');
          const get = tx.objectStore('kv').get('state');
          get.onsuccess = () => {
            const row = get.result as { id: string; data: SeedState } | undefined;
            db.close();
            resolve(row?.data);
          };
          get.onerror = () => reject(get.error);
        };
        req.onerror = () => reject(req.error);
      }),
  );
}
