/**
 * idb-helpers.ts — test-only utilities for the IndexedDB-backed
 * persistence layer. Specs use these instead of touching `localStorage`
 * or Dexie directly so the contract is in one place.
 *
 * IMPORTANT: `resetIDB` does NOT close the Dexie connection — Dexie's
 * open() is idempotent and the cached `db` reference in
 * `persistence.ts` keeps pointing at a valid (now-empty) store. If a
 * test needs the module-level cache reset too (e.g. the migration
 * test), it should call `__resetPersistenceForTests()` below.
 */
import { getIDB, SINGLETON_KEY, __resetPersistenceForTests } from '../domain/persistence';
import type { State } from '../domain/types';

/**
 * Clear every row in both tables. Idempotent. The schema-level tables
 * themselves are recreated by Dexie on next open, so we don't drop
 * the database — we just empty it.
 */
export async function resetIDB(): Promise<void> {
  const db = await getIDB();
  await db.kv.clear();
  await db.meta.clear();
  __resetPersistenceForTests();
}

/**
 * Seed the `kv` table with a state row. Bypasses `mergeDefaults` —
 * the test owns the shape. Use this when you want a known fixture
 * (and the test is not exercising the mergeDefaults code path).
 */
export async function seedIDB(state: State): Promise<void> {
  const db = await getIDB();
  await db.kv.put({ id: SINGLETON_KEY, data: state }, SINGLETON_KEY);
}

/**
 * Confirm any pending fire-and-forget Dexie writes have landed.
 * `save()` returns synchronously after kicking off the write, so a
 * test that reads back immediately may see stale data. This helper
 * does a tiny round-trip (toArray triggers any pending transactions
 * to flush) so subsequent assertions see the most recent save.
 */
export async function flushPendingWrites(): Promise<void> {
  const db = await getIDB();
  await db.kv.toArray();
}