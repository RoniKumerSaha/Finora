/**
 * state.ts — the ONE state builder for every suite.
 *
 * ## Why this exists
 *
 * The `State` shape was hand-written in a dozen places. Each copy was
 * a snapshot of the app's contract at the moment it was written, and
 * they had already drifted: some carried all ten entity arrays, some
 * were missing `investmentPlans` / `loanPlans`, and the e2e fixture
 * declared its own `unknown[]`-typed structural copy that was never
 * checked against `src/domain/types.ts`. A field added to the app
 * would compile fine in every one of them and then break at runtime,
 * deep inside a test, with no indication that the fixture was stale.
 *
 * So: every state in this repo is built from the app's own
 * `DEFAULT_STATE`, and typed with the app's own `State`. If the app
 * changes shape, the compiler points at the fixtures.
 *
 * ## What the builder guarantees
 *
 *  - **The app's real defaults.** Categories come from
 *    `buildDefaultCategories()`, so a fixture has the same category
 *    set a real user has — including the "Investment" category the
 *    auto-tagging feature depends on.
 *  - **Onboarding is complete by default.** `DEFAULT_STATE` ships
 *    `onboardingComplete: false` (a fresh install has not onboarded),
 *    but a test fixture that has not onboarded renders Home's
 *    onboarding banner, which shifts the layout. Every builder here
 *    completes onboarding unless a caller says otherwise.
 *  - **No shared mutable state.** The entity arrays are copied, so a
 *    spec that mutates `state.categories` in place cannot corrupt
 *    `DEFAULT_STATE` and poison a later spec in the same file.
 *
 * ## Shared by both runners
 *
 * Vitest specs import this as `../../support/state`. The Playwright
 * suites import the same module as `../../support/state` too — so an
 * e2e fixture and a unit fixture cannot disagree about the shape of
 * a state. The module is plain TypeScript with no runner-specific
 * imports, so it works in both.
 */
import { DEFAULT_STATE } from '@/domain/persistence';
import type { State } from '@/domain/types';

/**
 * Copy a state deeply enough that no two states share a mutable
 * entity.
 *
 * `DEFAULT_STATE` has only `categories` populated, but callers
 * override it with populated accounts / goals / plans all the time,
 * so the copy covers every array. Nested `contributions` and `items`
 * are copied too — a goal's contribution list is mutated in place by
 * `addContribution`, and an event plan's item list by `patchEventPlan`.
 */
export function cloneState(state: State): State {
  return {
    ...state,
    accounts: state.accounts.map(a => ({ ...a })),
    transactions: state.transactions.map(t => ({ ...t })),
    goals: state.goals.map(g => ({
      ...g,
      contributions: g.contributions.map(c => ({ ...c })),
    })),
    debts: state.debts.map(d => ({ ...d })),
    investments: state.investments.map(i => ({ ...i })),
    categories: state.categories.map(c => ({ ...c })),
    monthPlans: state.monthPlans.map(p => ({
      ...p,
      categories: p.categories.map(pc => ({ ...pc })),
    })),
    eventPlans: state.eventPlans.map(p => ({
      ...p,
      categories: p.categories.map(pc => ({
        ...pc,
        items: pc.items.map(it => ({ ...it })),
      })),
    })),
    investmentPlans: state.investmentPlans.map(p => ({ ...p })),
    loanPlans: state.loanPlans.map(p => ({ ...p })),
    settings: { ...state.settings },
  };
}

/**
 * The canonical state builder.
 *
 * Starts from the app's `DEFAULT_STATE` and applies the caller's
 * overrides on top. Overrides replace a whole top-level key — pass
 * `settings` to change any setting.
 *
 * ```ts
 * const state = makeState({
 *   accounts: [{ id: 'a1', name: 'Cash', type: 'cash', openingBalance: 0, createdAt: '2026-01-01' }],
 * });
 * ```
 */
export function makeState(overrides: Partial<State> = {}): State {
  const base: State = {
    ...cloneState(DEFAULT_STATE),
    settings: {
      ...DEFAULT_STATE.settings,
      onboardingComplete: true,
    },
  };
  return { ...base, ...overrides };
}

/**
 * A state carrying a last-write-wins stamp.
 *
 * `settings.stateUpdatedAt` is the LWW key the cloud-sync reconcile
 * compares (`src/domain/sync.reconcile.ts`), so the sync specs need
 * a builder that stamps rather than one that leaves the field unset.
 */
export function makeStampedState(
  stamp: number,
  overrides: Partial<State> = {},
): State {
  const base = makeState(overrides);
  return {
    ...base,
    settings: { ...base.settings, stateUpdatedAt: stamp },
  };
}
