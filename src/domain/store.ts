/**
 * store.ts — Zustand store for Finora V1 (AD-16).
 *
 * Single source of truth for the React tree. Holds the State blob plus a
 * transient banner slice. Persistence + recompute happen automatically:
 *   - `importAndReplace` runs `recomputeDerived` after loading JSON
 *   - `reset` clears localStorage and reloads DEFAULT_STATE
 *   - The store does NOT auto-save on every mutation; instead, forms call
 *     `run` with a mutator and we save once. Saves are O(30ms) at 10K rows.
 *
 * Why a store slice per entity instead of one mega-action? It keeps the
 * call site readable (`useStore(s => s.accounts.list())` would be lovely,
 * but pure selectors are clearer than binding mutations to a string name
 * for each entity).
 *
 * The hook is the only thing components import — selectors are explicit
 * so re-renders stay predictable.
 */
import { create } from 'zustand';
import type { State, Banner, Theme } from './types';
import { load, save, clear, DEFAULT_STATE } from './persistence';
import { recomputeDerived } from './recompute';

export type { Theme } from './types';

interface Store {
  state: State;
  banner: Banner | null;

  // Init
  recompute: () => void;
  reset: () => void;
  importAndReplace: (next: State) => void;

  // Banner
  showBanner: (b: Banner) => void;
  clearBanner: () => void;

  // Settings
  setTheme: (t: Theme) => void;
  completeOnboarding: () => void;

  // Mutation bridge: takes a (state) → state mutator and persists the result.
  // All per-entity mutations (addAccount, etc.) ultimately call this.
  update: (mutator: (s: State) => State) => void;
}

export const useStore = create<Store>((set, get) => ({
  state: loadInitial(),
  banner: null,

  recompute: () => set(s => ({ state: recomputeDerived(s.state) })),

  reset: () => {
    clear();
    set({ state: recomputeDerived({ ...DEFAULT_STATE }) });
  },

  importAndReplace: (next) => set({ state: recomputeDerived(next) }),

  showBanner: (b) => set({ banner: b }),
  clearBanner: () => set({ banner: null }),

  setTheme: (t) => {
    const next: State = { ...get().state, settings: { ...get().state.settings, theme: t } };
    set({ state: next });
    save(next);
  },

  completeOnboarding: () => {
    const next: State = {
      ...get().state,
      settings: { ...get().state.settings, onboardingComplete: true },
    };
    set({ state: next });
    save(next);
  },

  update: (mutator) => {
    const next = mutator(get().state);
    const recomputed = recomputeDerived(next);
    set({ state: recomputed });
    save(recomputed);
  },
}));

function loadInitial(): State {
  const loaded = load();
  return recomputeDerived(loaded);
}