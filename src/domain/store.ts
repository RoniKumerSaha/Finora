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
import * as plans from './plans';

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

  // ── Plan: Month Planner (PRD §9.14) ──────────────────────────────
  patchMonthPlan: (key: string, patch: Parameters<typeof plans.patchMonthPlan>[2]) => void;
  saveMonthPlan: (key: string) => void;
  resetMonthPlan: (key: string) => void;
  addMonthCategory: (key: string, cat: Parameters<typeof plans.addMonthCategory>[2]) => void;
  updateMonthCategory: (key: string, id: string, patch: Parameters<typeof plans.updateMonthCategory>[3]) => void;
  removeMonthCategory: (key: string, id: string) => void;

  // ── Plan: Event Planner (PRD §9.15) ──────────────────────────────
  addEventPlan: (input: Parameters<typeof plans.addEventPlan>[1]) => string;
  updateEventPlan: (id: string, patch: Parameters<typeof plans.updateEventPlan>[2]) => void;
  saveEventPlan: (id: string) => void;
  resetEventPlan: (id: string) => void;
  removeEventPlan: (id: string) => void;
  addEventCategory: (id: string, cat: Parameters<typeof plans.addEventCategory>[2], initialItems?: Parameters<typeof plans.addEventCategory>[3]) => void;
  updateEventCategory: (id: string, catId: string, patch: Parameters<typeof plans.updateEventCategory>[3]) => void;
  removeEventCategory: (id: string, catId: string) => void;
  addEventItem: (id: string, catId: string, item: Parameters<typeof plans.addEventItem>[3]) => void;
  updateEventItem: (id: string, catId: string, itemId: string, patch: Parameters<typeof plans.updateEventItem>[4]) => void;
  removeEventItem: (id: string, catId: string, itemId: string) => void;

  // Mutation bridge: takes a (state) → state mutator and persists the result.
  // All per-entity mutations (addAccount, etc.) ultimately call this.
  update: (mutator: (s: State) => State) => void;
}

function run(get: () => Store, mutator: (s: State) => State): void {
  const next = mutator(get().state);
  const recomputed = recomputeDerived(next);
  useStore.setState({ state: recomputed });
  save(recomputed);
}

/**
 * Plan-only mutation: skip `recomputeDerived` because debts and
 * investments can't be affected by a plan edit. Saves to disk
 * regardless. Without this, every keystroke in the planner re-walked
 * the entire debts[] / investments[] lists.
 */
function runPlan(get: () => Store, mutator: (s: State) => State): void {
  const next = mutator(get().state);
  useStore.setState({ state: next });
  save(next);
}

export const useStore = create<Store>((set, get) => ({
  state: loadInitial(),
  banner: null,

  recompute: () => set(s => ({ state: recomputeDerived(s.state) })),

  reset: () => {
    clear();
    set({ state: recomputeDerived({ ...DEFAULT_STATE }) });
  },

  importAndReplace: (next) => {
    // Older backups (pre-2026-08-17) won't have the plan scratchpads.
    // Fill with empty arrays so consumers can rely on them existing.
    const normalised: State = {
      ...next,
      monthPlans: next.monthPlans ?? [],
      eventPlans: next.eventPlans ?? [],
    };
    set({ state: recomputeDerived(normalised) });
  },

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

  // ── Month Planner ───────────────────────────────────────────────
  patchMonthPlan: (key, patch) => runPlan(get, s => plans.patchMonthPlan(s, key, patch)),
  saveMonthPlan: (key) => runPlan(get, s => plans.saveMonthPlan(s, key)),
  resetMonthPlan: (key) => runPlan(get, s => plans.resetMonthPlan(s, key)),
  addMonthCategory: (key, cat) => runPlan(get, s => plans.addMonthCategory(s, key, cat)),
  updateMonthCategory: (key, id, patch) => runPlan(get, s => plans.updateMonthCategory(s, key, id, patch)),
  removeMonthCategory: (key, id) => runPlan(get, s => plans.removeMonthCategory(s, key, id)),

  // ── Event Planner ────────────────────────────────────────────────
  addEventPlan: (input) => {
    const { state: next, id } = plans.addEventPlan(get().state, input);
    useStore.setState({ state: next });
    save(next);
    return id;
  },
  updateEventPlan: (id, patch) => runPlan(get, s => plans.updateEventPlan(s, id, patch)),
  saveEventPlan: (id) => runPlan(get, s => plans.saveEventPlan(s, id)),
  resetEventPlan: (id) => runPlan(get, s => plans.resetEventPlan(s, id)),
  removeEventPlan: (id) => runPlan(get, s => plans.removeEventPlan(s, id)),
  addEventCategory: (id, cat, initialItems) => runPlan(get, s => plans.addEventCategory(s, id, cat, initialItems)),
  updateEventCategory: (id, catId, patch) => runPlan(get, s => plans.updateEventCategory(s, id, catId, patch)),
  removeEventCategory: (id, catId) => runPlan(get, s => plans.removeEventCategory(s, id, catId)),
  addEventItem: (id, catId, item) => runPlan(get, s => plans.addEventItem(s, id, catId, item)),
  updateEventItem: (id, catId, itemId, patch) => runPlan(get, s => plans.updateEventItem(s, id, catId, itemId, patch)),
  removeEventItem: (id, catId, itemId) => runPlan(get, s => plans.removeEventItem(s, id, catId, itemId)),

  update: (mutator) => run(get, mutator),
}));

function loadInitial(): State {
  const loaded = load();
  return recomputeDerived(loaded);
}