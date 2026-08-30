/**
 * store.spec.ts — regression: importAndReplace must persist immediately.
 *
 * Bug (2026-08-30): `importAndReplace` updated the in-memory store but
 * never called `save()`, so a page reload after importing a backup
 * re-read the previous localStorage contents and the imported data
 * vanished. This test pins the contract: after importAndReplace, the
 * next `load()` must return the imported state.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from './store';
import { load, clear } from './persistence';
import { DEFAULT_STATE } from './persistence';
import type { State } from './types';

const minimalState = (over: Partial<State> = {}): State => ({
  ...DEFAULT_STATE,
  settings: { theme: 'dark', onboardingComplete: true },
  ...over,
});

describe('store.importAndReplace', () => {
  beforeEach(() => {
    clear();
    // Reset the singleton between tests so each test starts from a clean
    // state — the store holds `state` as a module-level reference.
    useStore.setState({ state: load() });
  });

  it('persists the imported state to localStorage immediately', () => {
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

    // After import, a fresh load() should see the imported account —
    // not whatever was there before (in this case, default empty state).
    const reloaded = load();
    expect(reloaded.accounts).toHaveLength(1);
    expect(reloaded.accounts[0].name).toBe('Imported wallet');
    expect(reloaded.accounts[0].id).toBe('a-imported');
  });

  it('overwrites previous localStorage contents', () => {
    // Seed a previous, different state.
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
    localStorage.setItem('finora:v1', JSON.stringify(previous));

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
