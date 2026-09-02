/**
 * persistence.migrations.ts — one-shot migration helpers (2026-09-02).
 *
 * Background: pre-migration, all Finora data lived under the
 * `localStorage` key `finora:v1` as a single JSON blob. Browsers wipe
 * `localStorage` aggressively (site-data clear, uninstall, profile
 * reset, ~5 MB ceiling). IndexedDB is more durable.
 *
 * `migrateFromLocalStorage(db)` reads `finora:v1`, pipes it through
 * the same `validate` + `mergeDefaults` pipeline as the live read path,
 * writes the result to the `kv` table, and removes the old key. It is
 * safe to call repeatedly: it bails out if the kv row already exists,
 * so re-running never overwrites new data.
 *
 * The function is intentionally isolated here (not in persistence.ts)
 * so the migration can be unit-tested without spinning up Dexie.
 */
import type { FinoraDB } from './persistence';
import { DEFAULT_STATE, validate, mergeDefaults } from './persistence';
import type { State } from './types';

const LEGACY_KEY = 'finora:v1';

export interface MigrationResult {
  /** What we ended up with (post-mergeDefaults). */
  state: State;
  /** True if a localStorage blob was found and migrated. */
  migrated: boolean;
}

/**
 * Migrate `localStorage[LEGACY_KEY]` → IndexedDB if any exists.
 *
 * No-op when:
 *   - IndexedDB already has a `state` row (idempotent)
 *   - localStorage has no `finora:v1` key
 *   - localStorage is not available (SSR / non-DOM test env)
 *   - the localStorage value fails to parse or fails `validate`
 */
export async function migrateFromLocalStorage(db: FinoraDB): Promise<MigrationResult> {
  // Idempotency guard: never overwrite a live db with stale localStorage.
  const existing = await db.kv.get('state');
  if (existing) return { state: existing.data as State, migrated: false };

  if (typeof localStorage === 'undefined') {
    return { state: { ...DEFAULT_STATE }, migrated: false };
  }

  let raw: string | null = null;
  try {
    raw = localStorage.getItem(LEGACY_KEY);
  } catch {
    // Some test envs throw on getItem (e.g. disabled storage). Treat as absent.
    return { state: { ...DEFAULT_STATE }, migrated: false };
  }
  if (!raw) return { state: { ...DEFAULT_STATE }, migrated: false };

  let state: State;
  try {
    const parsed: unknown = JSON.parse(raw);
    state = validate(parsed) ? mergeDefaults(parsed) : { ...DEFAULT_STATE };
  } catch {
    // Corrupted blob: don't fail the whole boot, but don't migrate garbage either.
    return { state: { ...DEFAULT_STATE }, migrated: false };
  }

  await db.kv.put({ id: 'state', data: state }, 'state');
  try {
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // Best-effort cleanup. The migration already succeeded.
  }
  return { state, migrated: true };
}