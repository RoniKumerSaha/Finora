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
import type { State, Banner, Toast } from './types';
import { load, save, clear, DEFAULT_STATE } from './persistence';
import { recomputeDerived } from './recompute';
import * as plans from './plans';
import * as investmentPlans from './investmentPlans';
import * as loanPlans from './loanPlans';
import { uid } from './ids';


interface Store {
  state: State;
  banner: Banner | null;
  toast: Toast | null;

  // Init
  recompute: () => void;
  reset: () => void;
  importAndReplace: (next: State) => void;

  // Banner
  showBanner: (b: Banner) => void;
  clearBanner: () => void;

  // Toast (moment-of-success feedback)
  showToast: (t: Omit<Toast, 'id'>) => void;
  clearToast: () => void;

  // Settings
  completeOnboarding: () => void;

  // ── Plan: Month Planner (PRD §9.14) ──────────────────────────────
  patchMonthPlan: (key: string, patch: Parameters<typeof plans.patchMonthPlan>[2]) => void;
  addMonthCategory: (key: string, cat: Parameters<typeof plans.addMonthCategory>[2]) => void;
  addMonthCategories: (key: string, cats: Parameters<typeof plans.addMonthCategories>[2]) => void;
  updateMonthCategory: (key: string, id: string, patch: Parameters<typeof plans.updateMonthCategory>[3]) => void;
  removeMonthCategory: (key: string, id: string) => void;
  batchUpdateMonthCategoryBudget: (key: string, ids: string[], budget: number) => void;
  batchUpdateMonthCategoryBudgetMap: (key: string, budgetMap: Record<string, number>) => void;

  // ── Plan: Event Planner (PRD §9.15) ──────────────────────────────
  addEventPlan: (input: Parameters<typeof plans.addEventPlan>[1]) => string;
  updateEventPlan: (id: string, patch: Parameters<typeof plans.updateEventPlan>[2]) => void;
  removeEventPlan: (id: string) => void;
  addEventCategory: (id: string, cat: Parameters<typeof plans.addEventCategory>[2], initialItems?: Parameters<typeof plans.addEventCategory>[3]) => void;
  addEventCategories: (id: string, cats: Parameters<typeof plans.addEventCategories>[2]) => void;
  updateEventCategory: (id: string, catId: string, patch: Parameters<typeof plans.updateEventCategory>[3]) => void;
  removeEventCategory: (id: string, catId: string) => void;
  addEventItem: (id: string, catId: string, item: Parameters<typeof plans.addEventItem>[3]) => void;
  updateEventItem: (id: string, catId: string, itemId: string, patch: Parameters<typeof plans.updateEventItem>[4]) => void;
  removeEventItem: (id: string, catId: string, itemId: string) => void;

  // ── Plan: Investment Planner (mock — PRD §9.17) ──────────────────
  addInvestmentPlan: (input: Parameters<typeof investmentPlans.addInvestmentPlan>[1]) => string;
  updateInvestmentPlan: (id: string, patch: Parameters<typeof investmentPlans.updateInvestmentPlan>[2]) => void;
  saveInvestmentPlan: (id: string) => void;
  removeInvestmentPlan: (id: string) => void;

  // ── Plan: Loan Calculator (PRD §9.17) ────────────────────────────
  addLoanPlan: (input: Parameters<typeof loanPlans.addLoanPlan>[1]) => string;
  updateLoanPlan: (id: string, patch: Parameters<typeof loanPlans.updateLoanPlan>[2]) => void;
  saveLoanPlan: (id: string) => void;
  removeLoanPlan: (id: string) => void;

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
  toast: null,

  recompute: () => set(s => ({ state: recomputeDerived(s.state) })),

  reset: () => {
    clear();
    set({ state: recomputeDerived({ ...DEFAULT_STATE }) });
  },

  importAndReplace: (next) => {
    // Older backups (pre-2026-08-17) won't have the plan scratchpads.
    // Fill with empty arrays so consumers can rely on them existing.
    // Investment + loan scratchpads (added 2026-08-30) follow the same
    // back-compat pattern.
    const normalised: State = {
      ...next,
      monthPlans: next.monthPlans ?? [],
      eventPlans: next.eventPlans ?? [],
      investmentPlans: next.investmentPlans ?? [],
      loanPlans: next.loanPlans ?? [],
    };
    const recomputed = recomputeDerived(normalised);
    set({ state: recomputed });
    // Persist immediately. Without this, the imported data only lives in
    // memory and is lost on reload — the in-memory store and localStorage
    // would diverge until the next mutation re-saved (regression 2026-08-30).
    save(recomputed);
  },

  showBanner: (b) => set({ banner: b }),
  clearBanner: () => set({ banner: null }),

  // Toast: single-slot like banner. `showToast` overwrites any toast
  // currently showing — the user gets one moment, not a stack. The
  // toast component owns the dwell timer so the store stays simple.
  showToast: (t) => set({ toast: { ...t, id: uid() } }),
  clearToast: () => set({ toast: null }),

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
  addMonthCategory: (key, cat) => runPlan(get, s => plans.addMonthCategory(s, key, cat)),
  addMonthCategories: (key, cats) => runPlan(get, s => plans.addMonthCategories(s, key, cats)),
  updateMonthCategory: (key, id, patch) => runPlan(get, s => plans.updateMonthCategory(s, key, id, patch)),
  removeMonthCategory: (key, id) => runPlan(get, s => plans.removeMonthCategory(s, key, id)),
  batchUpdateMonthCategoryBudget: (key, ids, budget) => runPlan(get, s => plans.batchUpdateMonthCategoryBudget(s, key, ids, budget)),
  batchUpdateMonthCategoryBudgetMap: (key, budgetMap) => runPlan(get, s => plans.batchUpdateMonthCategoryBudgetMap(s, key, budgetMap)),

  // ── Event Planner ────────────────────────────────────────────────
  addEventPlan: (input) => {
    const { state: next, id } = plans.addEventPlan(get().state, input);
    useStore.setState({ state: next });
    save(next);
    return id;
  },
  updateEventPlan: (id, patch) => runPlan(get, s => plans.updateEventPlan(s, id, patch)),
  removeEventPlan: (id) => runPlan(get, s => plans.removeEventPlan(s, id)),
  addEventCategory: (id, cat, initialItems) => runPlan(get, s => plans.addEventCategory(s, id, cat, initialItems)),
  addEventCategories: (id, cats) => runPlan(get, s => plans.addEventCategories(s, id, cats)),
  updateEventCategory: (id, catId, patch) => runPlan(get, s => plans.updateEventCategory(s, id, catId, patch)),
  removeEventCategory: (id, catId) => runPlan(get, s => plans.removeEventCategory(s, id, catId)),
  addEventItem: (id, catId, item) => runPlan(get, s => plans.addEventItem(s, id, catId, item)),
  updateEventItem: (id, catId, itemId, patch) => runPlan(get, s => plans.updateEventItem(s, id, catId, itemId, patch)),
  removeEventItem: (id, catId, itemId) => runPlan(get, s => plans.removeEventItem(s, id, catId, itemId)),

  // ── Investment Planner (mock — PRD §9.17) ───────────────────────
  addInvestmentPlan: (input) => {
    const { state: next, id } = investmentPlans.addInvestmentPlan(get().state, input);
    useStore.setState({ state: next });
    save(next);
    return id;
  },
  updateInvestmentPlan: (id, patch) => runPlan(get, s => investmentPlans.updateInvestmentPlan(s, id, patch)),
  saveInvestmentPlan: (id) => runPlan(get, s => investmentPlans.saveInvestmentPlan(s, id)),
  removeInvestmentPlan: (id) => runPlan(get, s => investmentPlans.removeInvestmentPlan(s, id)),

  // ── Loan Calculator (PRD §9.17) ──────────────────────────────────
  addLoanPlan: (input) => {
    const { state: next, id } = loanPlans.addLoanPlan(get().state, input);
    useStore.setState({ state: next });
    save(next);
    return id;
  },
  updateLoanPlan: (id, patch) => runPlan(get, s => loanPlans.updateLoanPlan(s, id, patch)),
  saveLoanPlan: (id) => runPlan(get, s => loanPlans.saveLoanPlan(s, id)),
  removeLoanPlan: (id) => runPlan(get, s => loanPlans.removeLoanPlan(s, id)),

  update: (mutator) => run(get, mutator),
}));

function loadInitial(): State {
  const loaded = load();
  return recomputeDerived(loaded);
}