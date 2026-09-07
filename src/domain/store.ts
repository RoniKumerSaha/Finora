/**
 * store.ts — Zustand store for Finora V1 (AD-16, persistence AD-29).
 *
 * Single source of truth for the React tree. Holds the State blob plus a
 * transient banner slice. Persistence + recompute happen automatically:
 *   - `importAndReplace` runs `recomputeDerived` after loading JSON
 *   - `reset` clears IndexedDB and reloads DEFAULT_STATE
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
 *
 * Cloud sync (V1.x): every mutation chokepoint (`run`, `runPlan`, the
 * three `add*Plan` actions that return a generated id, and
 * `importAndReplace`) ends with `saveAndMaybeSync(state)`, which writes
 * to IndexedDB and notifies the SyncEngine. The sync engine debounces
 * 400ms before pushing to Supabase, so a burst of edits collapses into
 * one network write. `stateUpdatedAt` is bumped inside the same wrapper
 * and is the LWW key used during boot reconciliation.
 */
import { create } from 'zustand';
import type { State, Banner, Toast } from './types';
import { load, save, clear, DEFAULT_STATE } from './persistence';
import { recomputeDerived } from './recompute';
import * as plans from './plans';
import * as investmentPlans from './investmentPlans';
import * as loanPlans from './loanPlans';
import { uid } from './ids';
import { syncEngine } from './sync';


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

  // ── Cloud sync (V1.x) ────────────────────────────────────────────────
  /** Called by the SyncEngine after a successful sign-in to persist
   *  the user's email + auto-enable sync into Settings. The engine
   *  mirrors this state, so subsequent store mutations are picked up
   *  by the 400ms-debounced schedulePush. */
  recordSignIn: (email: string) => void;
  /** Wipes the cloudUserEmail from Settings and disables sync.
   *  Local data is NOT cleared (sign-out is reversible by signing
   *  back in). */
  recordSignOut: () => void;

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

/**
 * Bump `stateUpdatedAt` and persist + schedule a cloud push. Every
 * mutation that flows through `run` / `runPlan` / inline `add*Plan` /
 * `importAndReplace` ends here. Local write always succeeds; the
 * SyncEngine silently no-ops when sync is disabled / signed-out /
 * offline / locked.
 */
function saveAndMaybeSync(state: State): void {
  const stamped: State = {
    ...state,
    settings: {
      ...state.settings,
      stateUpdatedAt: Date.now(),
    },
  };
  save(stamped);
  syncEngine.schedulePush(stamped);
}

function run(get: () => Store, mutator: (s: State) => State): void {
  const next = mutator(get().state);
  const recomputed = recomputeDerived(next);
  useStore.setState({ state: recomputed });
  saveAndMaybeSync(recomputed);
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
  saveAndMaybeSync(next);
}

export const useStore = create<Store>((set, get) => ({
  state: loadInitial(),
  banner: null,
  toast: null,

  recompute: () => set(s => ({ state: recomputeDerived(s.state) })),

  reset: () => {
    // LOCAL ONLY. The Settings → Danger-zone "Wipe everything" wipes
    // local IndexedDB + the in-memory cache; the cloud copy is left
    // untouched so the user's other devices aren't destroyed by a
    // local wipe. The SettingsScreen's "Delete cloud copy" button
    // handles the authoritative cloud-side delete via the engine.
    clear();
    const wiped: State = {
      ...DEFAULT_STATE,
      settings: {
        ...DEFAULT_STATE.settings,
        onboardingComplete: true,
        cloudSyncEnabled: get().state.settings.cloudSyncEnabled,
        cloudUserEmail: get().state.settings.cloudUserEmail,
      },
    };
    set({ state: recomputeDerived(wiped) });
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
    // memory and is lost on reload — the in-memory store and IndexedDB
    // would diverge until the next mutation re-saved (regression 2026-08-30).
    saveAndMaybeSync(recomputed);
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
    saveAndMaybeSync(next);
  },

  // ── Cloud sync actions ─────────────────────────────────────────────
  recordSignIn: (email) => {
    const next: State = {
      ...get().state,
      settings: {
        ...get().state.settings,
        cloudUserEmail: email,
        cloudSyncEnabled: true,
      },
    };
    set({ state: next });
    // Plain save (not saveAndMaybeSync) — recordSignIn is an
    // identity change, not a data mutation. Bumping stateUpdatedAt
    // here would make a fresh, empty local state look "newer" than
    // a populated cloud row from another device, and the LWW
    // reconcile would push the empty state up, clobbering the
    // other device's data. SyncEngine.onAuthStateChange calls this
    // when a magic link establishes a session; the engine then
    // runs reconcileAndPushLatest which uses real stateUpdatedAt
    // values to decide what to do.
    save(next);
    syncEngine.setEnabled(true);
  },

  recordSignOut: () => {
    const next: State = {
      ...get().state,
      settings: {
        ...get().state.settings,
        cloudUserEmail: null,
        cloudSyncEnabled: false,
      },
    };
    set({ state: next });
    // Same reasoning: sign-out is an identity change, not a data
    // mutation. Don't bump stateUpdatedAt.
    save(next);
    // Disarm the engine so subsequent mutations stay local until
    // the user signs back in. SyncEngine.signOut() (called by
    // AccountSection.onSignOut before recordSignOut) already
    // cleared the session; this just flips the enabled flag.
    syncEngine.setEnabled(false);
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
    saveAndMaybeSync(next);
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
    saveAndMaybeSync(next);
    return id;
  },
  updateInvestmentPlan: (id, patch) => runPlan(get, s => investmentPlans.updateInvestmentPlan(s, id, patch)),
  saveInvestmentPlan: (id) => runPlan(get, s => investmentPlans.saveInvestmentPlan(s, id)),
  removeInvestmentPlan: (id) => runPlan(get, s => investmentPlans.removeInvestmentPlan(s, id)),

  // ── Loan Calculator (PRD §9.17) ──────────────────────────────────
  addLoanPlan: (input) => {
    const { state: next, id } = loanPlans.addLoanPlan(get().state, input);
    useStore.setState({ state: next });
    saveAndMaybeSync(next);
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