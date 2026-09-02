/**
 * store.spec.ts — regression: importAndReplace must persist immediately.
 *
 * Bug (2026-08-30): `importAndReplace` updated the in-memory store but
 * never called `save()`, so a page reload after importing a backup
 * re-read the previous localStorage contents and the imported data
 * vanished. This test pins the contract: after importAndReplace, the
 * next `load()` must return the imported state.
 *
 * Persistence was migrated from `localStorage` to IndexedDB in 2026-09-02;
 * the fixtures now use the Dexie helpers in `src/test/idb-helpers.ts`.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from './store';
import { load, ensureReady, DEFAULT_STATE } from './persistence';
import { getIDB, SINGLETON_KEY } from './persistence';
import { migrateFromLocalStorage } from './persistence.migrations';
import type { State } from './types';
import { resetIDB, seedIDB, flushPendingWrites } from '../test/idb-helpers';

const minimalState = (over: Partial<State> = {}): State => ({
  ...DEFAULT_STATE,
  settings: { theme: 'dark', onboardingComplete: true },
  ...over,
});

describe('store.importAndReplace', () => {
  beforeEach(async () => {
    await resetIDB();
    await ensureReady();
    // Reset the singleton between tests so each test starts from a clean
    // state — the store holds `state` as a module-level reference.
    useStore.setState({ state: load() });
  });

  it('persists the imported state immediately', async () => {
    const imported: State = minimalState({
      accounts: [
        {
          id: 'a-imported',
          name: 'Imported wallet',
          type: 'cash',
          openingBalance: 1234,
          createdAt: '2026-01-01',
        },
      ],
      transactions: [],
      goals: [],
      debts: [],
      investments: [],
    });

    useStore.getState().importAndReplace(imported);
    await flushPendingWrites();

    // After import, a fresh load() should see the imported account —
    // not whatever was there before (in this case, default empty state).
    const reloaded = load();
    expect(reloaded.accounts).toHaveLength(1);
    expect(reloaded.accounts[0].name).toBe('Imported wallet');
    expect(reloaded.accounts[0].id).toBe('a-imported');
  });

  it('overwrites previous IndexedDB contents', async () => {
    // Seed a previous, different state directly into Dexie.
    const previous: State = minimalState({
      accounts: [
        {
          id: 'a-old',
          name: 'Old account',
          type: 'cash',
          openingBalance: 99,
          createdAt: '2025-01-01',
        },
      ],
    });
    await seedIDB(previous);
    // Prime the cache by re-running ensureReady after seeding so the
    // module-level mirror reflects the seeded blob.
    await ensureReady();
    useStore.setState({ state: load() });

    const imported: State = minimalState({
      accounts: [
        {
          id: 'a-new',
          name: 'New account',
          type: 'cash',
          openingBalance: 500,
          createdAt: '2026-08-30',
        },
      ],
    });
    useStore.getState().importAndReplace(imported);
    await flushPendingWrites();

    const reloaded = load();
    expect(reloaded.accounts.map(a => a.id)).toEqual(['a-new']);
  });

  it('fills missing plan scratchpads with empty arrays (back-compat)', () => {
    // Older backup: missing monthPlans / eventPlans / etc.
    const legacy: State = {
      ...minimalState(),
      monthPlans: undefined as unknown as State['monthPlans'],
      eventPlans: undefined as unknown as State['eventPlans'],
      investmentPlans: undefined as unknown as State['investmentPlans'],
      loanPlans: undefined as unknown as State['loanPlans'],
    };
    delete (legacy as Partial<State>).monthPlans;
    delete (legacy as Partial<State>).eventPlans;
    delete (legacy as Partial<State>).investmentPlans;
    delete (legacy as Partial<State>).loanPlans;

    useStore.getState().importAndReplace(legacy);

    const reloaded = load();
    expect(reloaded.monthPlans).toEqual([]);
    expect(reloaded.eventPlans).toEqual([]);
    expect(reloaded.investmentPlans).toEqual([]);
    expect(reloaded.loanPlans).toEqual([]);
  });
});

describe('persistence migration (localStorage → IndexedDB)', () => {
  beforeEach(async () => {
    // Wipe BOTH stores: if a previous run was still using localStorage,
    // we want to start with a clean slate on both sides.
    localStorage.clear();
    await resetIDB();
    // Ensure the test starts with a primed cache from the (now-empty) DB.
    await ensureReady();
  });

  it('migrates finora:v1 from localStorage on first boot', async () => {
    const seed: State = minimalState({
      accounts: [
        { id: 'a-migrated', name: 'Migrated acct', type: 'cash', openingBalance: 777, createdAt: '2024-04-04' },
      ],
    });
    localStorage.setItem('finora:v1', JSON.stringify(seed));

    // Simulate a fresh boot: drop the cache and migration-skip flag, then
    // run the migration against a clean DB.
    const db = await getIDB();
    const result = await migrateFromLocalStorage(db);

    expect(result.migrated).toBe(true);
    expect(result.state.accounts[0].id).toBe('a-migrated');
    expect(localStorage.getItem('finora:v1')).toBeNull();

    const persisted = await db.kv.get(SINGLETON_KEY);
    expect(persisted).toBeTruthy();
    expect((persisted!.data as State).accounts[0].id).toBe('a-migrated');
  });

  it('does not re-migrate when IndexedDB already has a row', async () => {
    const db = await getIDB();
    const freshSeed: State = minimalState({
      accounts: [
        { id: 'a-fresh', name: 'Fresh acct', type: 'cash', openingBalance: 1, createdAt: '2026-09-01' },
      ],
    });
    await db.kv.put({ id: SINGLETON_KEY, data: freshSeed }, SINGLETON_KEY);

    // Pre-existing localStorage blob should be ignored.
    const stale: State = minimalState({
      accounts: [
        { id: 'a-stale', name: 'Stale acct', type: 'cash', openingBalance: 2, createdAt: '2025-01-01' },
      ],
    });
    localStorage.setItem('finora:v1', JSON.stringify(stale));

    const result = await migrateFromLocalStorage(db);
    expect(result.migrated).toBe(false);
    expect(result.state.accounts[0].id).toBe('a-fresh');
    // localStorage key still present because migration didn't run.
    expect(localStorage.getItem('finora:v1')).not.toBeNull();
  });

  it('falls back to DEFAULT_STATE when localStorage has no key', async () => {
    const db = await getIDB();
    const result = await migrateFromLocalStorage(db);
    expect(result.migrated).toBe(false);
    expect(result.state.accounts).toEqual([]);
    expect(result.state.categories.length).toBeGreaterThan(0);
  });
});

/**
 * Regression (2026-09-02): after a page reload, the Zustand store must
 * reflect the IndexedDB-persisted state, not DEFAULT_STATE.
 *
 * Before the fix, `store.ts` evaluated at module load time and called
 * `loadInitial()` BEFORE `ensureReady()` had populated the cache, so
 * `useStore.state` started as DEFAULT_STATE on every reload. The
 * first user mutation then wrote `{...DEFAULT_STATE, delta}` to IDB,
 * silently erasing the real persisted data. The fix lives in
 * `main.tsx` (`useStore.setState({state: load()})` after `ensureReady`),
 * and this test pins the contract by simulating a fresh boot sequence.
 */
describe('store reload — cache/IDB drift', () => {
  it('ensureReady + useStore.setState reflects IDB state, not DEFAULT_STATE', async () => {
    // Seed IDB with a non-default state.
    const fixture: State = minimalState({
      accounts: [
        {
          id: 'a-survivor',
          name: 'Survived reload',
          type: 'cash',
          openingBalance: 9999,
          createdAt: '2026-01-15',
        },
      ],
    });
    await resetIDB();
    await seedIDB(fixture);

    // Simulate the main.tsx boot sequence.
    await ensureReady();
    useStore.setState({ state: load() });

    // The store must reflect IDB, not DEFAULT_STATE.
    const s = useStore.getState().state;
    expect(s.accounts).toHaveLength(1);
    expect(s.accounts[0].id).toBe('a-survivor');
    expect(s.accounts[0].openingBalance).toBe(9999);
  });

  it('first mutation after boot persists the IDB-seeded state + delta, not DEFAULT_STATE + delta', async () => {
    // Same setup as above — seed, boot, re-sync store.
    const fixture: State = minimalState({
      accounts: [
        { id: 'a-survivor', name: 'Pre-existing', type: 'cash', openingBalance: 9999, createdAt: '2026-01-15' },
      ],
    });
    await resetIDB();
    await seedIDB(fixture);
    await ensureReady();
    useStore.setState({ state: load() });

    // First user mutation via the store.
    useStore.getState().update(s => ({
      ...s,
      transactions: [
        ...s.transactions,
        { id: 't1', type: 'expense', amount: 50, date: '2026-09-02', accountId: 'a-survivor', note: 'lunch' },
      ],
    }));
    await flushPendingWrites();

    // Both the original account AND the new transaction must survive.
    const persisted = load();
    expect(persisted.accounts.map(a => a.id)).toEqual(['a-survivor']);
    expect(persisted.transactions.map(t => t.id)).toEqual(['t1']);
    expect(persisted.accounts[0].openingBalance).toBe(9999);
  });
});