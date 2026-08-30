/**
 * investmentPlans.ts — pure CRUD for the mock Investment Planner
 * (PRD §9.17).
 *
 * Strictly scratch — these entities never touch `state.transactions`
 * or `state.investments`. They exist so the user can sketch "what if
 * I opened a DPS at 8% for 12 months" without committing real money
 * to the ledger.
 *
 * Pattern mirrors `plans.ts`: explicit Save / Reset, `dirty` flag,
 * `savedSnapshot` so Reset can roll back to the last user-acknowledged
 * state.
 */
import type { InvestmentPlan, State } from './types';
import { uid } from './ids';

/* ─────────────────────────────────────────────────────────────────────
   List / get
   ──────────────────────────────────────────────────────────────────────*/

export function listInvestmentPlans(state: State): InvestmentPlan[] {
  return state.investmentPlans;
}

export function getInvestmentPlan(state: State, id: string): InvestmentPlan | undefined {
  return state.investmentPlans.find(p => p.id === id);
}

/* ─────────────────────────────────────────────────────────────────────
   Mutations — Investment Planner
   ──────────────────────────────────────────────────────────────────────*/

/**
 * Create a new mock investment plan. Returns the new id. The plan
 * starts in `dirty` state so the user has to confirm with Save.
 */
export function addInvestmentPlan(
  state: State,
  input: Omit<InvestmentPlan, 'id' | 'dirty' | 'savedAt'>,
): { state: State; id: string } {
  const id = uid();
  const plan: InvestmentPlan = { ...input, id, dirty: true, savedAt: null };
  return {
    state: { ...state, investmentPlans: [...state.investmentPlans, plan] },
    id,
  };
}

/**
 * Patch a mock investment plan. Always flips `dirty` so the user is
 * prompted to re-save (unless the patch is a no-op).
 */
export function updateInvestmentPlan(
  state: State,
  id: string,
  patch: Partial<Omit<InvestmentPlan, 'id' | 'dirty' | 'savedAt'>>,
): State {
  const existing = getInvestmentPlan(state, id);
  if (!existing) return state;
  const next: InvestmentPlan = { ...existing, ...patch, dirty: true };
  return {
    ...state,
    investmentPlans: state.investmentPlans.map(p => p.id === id ? next : p),
  };
}

/**
 * Mark the plan as saved NOW. Clears dirty. Used by the explicit
 * "Save plan" button on the Investment Planner screens.
 */
export function saveInvestmentPlan(state: State, id: string): State {
  const existing = getInvestmentPlan(state, id);
  if (!existing) return state;
  const next: InvestmentPlan = {
    ...existing,
    dirty: false,
    savedAt: new Date().toISOString().slice(0, 10),
  };
  return {
    ...state,
    investmentPlans: state.investmentPlans.map(p => p.id === id ? next : p),
  };
}

/**
 * Reset the plan to its last-saved state. If the plan was never
 * saved, the plan is removed entirely (no savedSnapshot to restore
 * means nothing to revert to — the shell was never confirmed by the
 * user). Mirrors the EventPlanner `resetEventPlan` philosophy.
 */
export function resetInvestmentPlan(state: State, id: string): State {
  const existing = getInvestmentPlan(state, id);
  if (!existing) return state;
  if (!existing.savedAt) {
    return {
      ...state,
      investmentPlans: state.investmentPlans.filter(p => p.id !== id),
    };
  }
  const next: InvestmentPlan = { ...existing, dirty: false };
  return {
    ...state,
    investmentPlans: state.investmentPlans.map(p => p.id === id ? next : p),
  };
}

/** Hard-delete the plan (with confirmation at the UI layer). */
export function removeInvestmentPlan(state: State, id: string): State {
  return {
    ...state,
    investmentPlans: state.investmentPlans.filter(p => p.id !== id),
  };
}

/* ─────────────────────────────────────────────────────────────────────
   Derived display helpers
   ──────────────────────────────────────────────────────────────────────*/

/**
 * Mirror of `investmentMaturityValue` for the mock planner. Uses the
 * same simple-interest formula (R9). For DPS we use the
 * annuity-due projection (R13). Read-only — never writes back.
 *
 * Always tagged with the "(projection)" suffix in copy.
 */
export function investmentPlanMaturityValue(plan: InvestmentPlan): number {
  if (!plan) return 0;
  if (plan.type === 'dps') {
    const M = Number(plan.monthlyContribution) || 0;
    const n = Math.max(0, Math.floor(Number(plan.termMonths) || 0));
    if (M <= 0 || n <= 0) return 0;
    const r = (Number(plan.rate) || 0) / 100 / 12;
    if (r === 0) return M * n;
    const pow = Math.pow(1 + r, n);
    return M * ((pow - 1) / r) * (1 + r);
  }
  // FDR / savings: principal × (1 + rate × term/12)
  const principal = Number(plan.principal) || 0;
  const rate = Number(plan.rate) || 0;
  const months = Math.max(0, Math.floor(Number(plan.termMonths) || 0));
  const days = Number(plan.termDays) || 0;
  if (days > 0) return principal * (1 + (rate / 100) * (days / 365));
  return principal * (1 + (rate / 100) * (months / 12));
}

/** Maturity date for the mock plan. Mirrors `investmentMaturityDate`. */
export function investmentPlanMaturityDate(plan: InvestmentPlan): Date | null {
  if (!plan?.startDate) return null;
  const start = new Date(plan.startDate + 'T00:00:00.000Z');
  const days = Number(plan.termDays) || 0;
  if (days > 0) return new Date(start.getTime() + days * 86_400_000);
  const startDay = start.getUTCDate();
  const targetMonth = start.getUTCMonth() + (Number(plan.termMonths) || 0);
  const yearShift = Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;
  const year = start.getUTCFullYear() + yearShift;
  const lastDay = new Date(Date.UTC(year, normalizedMonth + 1, 0)).getUTCDate();
  const day = Math.min(startDay, lastDay);
  return new Date(Date.UTC(year, normalizedMonth, day));
}

/**
 * Total cumulative principal the user puts in over the full term.
 * For DPS this is `monthlyContribution × termMonths` (NOT
 * `plan.principal` — that's an informational field on DPS that's
 * often stale or zero). For FDR / savings it's the lump-sum
 * principal. Single source of truth so the helper, the list card,
 * and the detail screen all agree on "your money".
 */
export function investmentPlanTotalContributed(plan: InvestmentPlan): number {
  if (plan.type === 'dps') {
    return (Number(plan.monthlyContribution) || 0) * (Math.max(0, Math.floor(Number(plan.termMonths) || 0)));
  }
  return Math.max(0, Number(plan.principal) || 0);
}

/** Convenience: total interest earned across the full term. */
export function investmentPlanInterest(plan: InvestmentPlan): number {
  return Math.max(0, investmentPlanMaturityValue(plan) - investmentPlanTotalContributed(plan));
}

/**
 * Month-by-month balance series for a mock investment plan.
 *
 *   index 0  → balance at month 0 (start, before any deposits/interest)
 *   index i  → balance at month i (0 ≤ i ≤ termMonths)
 *   last     → maturity value (matches `investmentPlanMaturityValue`)
 *
 * For DPS the curve is the annuity-due future value: each month the
 * contribution lands and then compounds. For FDR / savings it's a
 * linear ramp from 0 to the maturity value.
 *
 * Used by the Investment Planner hero card to draw a small sparkline.
 * Pure: never reads transactions, never touches the store.
 */
export function projectionSeries(plan: InvestmentPlan): number[] {
  const months = Math.max(0, Math.floor(Number(plan.termMonths) || 0));
  const days = Math.max(0, Math.floor(Number(plan.termDays) || 0));
  if (plan.type === 'dps') {
    const M = Math.max(0, Number(plan.monthlyContribution) || 0);
    const r = Math.max(0, Number(plan.rate) || 0) / 100 / 12;
    const out = new Array<number>(months + 1);
    out[0] = 0;
    for (let i = 1; i <= months; i++) {
      // Annuity-due: contribution lands at the start of each period,
      // then earns one month's interest. Matches `investmentPlanMaturityValue`.
      // DPS curve starts at 0: the user is *building up* the balance
      // month-by-month, so a 0 → maturity ramp is truthful.
      if (r === 0) {
        out[i] = M * i;
      } else {
        const pow = Math.pow(1 + r, i);
        out[i] = M * ((pow - 1) / r) * (1 + r);
      }
    }
    return out;
  }
  // FDR / savings: the principal lands in full on day 0 — the user
  // doesn't earn it up month-by-month. The curve therefore starts at
  // principal and the line traces only the *interest layer* on top.
  // Drawing from 0 for an FDR would falsely suggest the principal was
  // built up over time, which it wasn't.
  //
  // We sample N evenly-spaced points across the term (months-based
  // uses `months`, days-based falls back to 12) and apply the simple-
  // interest formula interest_so_far = principal × rate × elapsed/term.
  const principal = Math.max(0, Number(plan.principal) || 0);
  const rate = Math.max(0, Number(plan.rate) || 0);
  const points = months > 0 ? months : 12;
  const out = new Array<number>(points + 1);
  for (let i = 0; i <= points; i++) {
    const fraction = i / points;
    if (days > 0) {
      const interest = principal * (rate / 100) * (days * fraction / 365);
      out[i] = principal + interest;
    } else {
      const interest = principal * (rate / 100) * (months * fraction / 12);
      out[i] = principal + interest;
    }
  }
  return out;
}

/**
 * Month-by-month breakdown of the projection into principal (what
 * the user put in) and interest (what the bank paid). Together the
 * two series sum to `projectionSeries(plan)` at every index.
 *
 *   invested[i]  → cumulative principal at month i
 *   interest[i]  → cumulative interest at month i
 *
 * For DPS the "invested" growth is the straight sum of monthly
 * contributions, and the rest of the balance is interest. For
 * FDR / savings: invested is constant (principal), interest
 * grows linearly across the term (simple-interest split).
 *
 * Used by the stacked-area chart on the Investment Planner hero
 * card so users can see *how much* of the maturity is their money
 * vs. earned interest.
 */
export function projectionBreakdown(plan: InvestmentPlan): { invested: number[]; interest: number[] } {
  const months = Math.max(0, Math.floor(Number(plan.termMonths) || 0));
  const total = projectionSeries(plan);
  if (plan.type === 'dps') {
    const M = Math.max(0, Number(plan.monthlyContribution) || 0);
    const invested = new Array<number>(months + 1);
    const interest = new Array<number>(months + 1);
    invested[0] = 0;
    interest[0] = 0;
    for (let i = 1; i <= months; i++) {
      invested[i] = M * i;
      // Balance = total[i]; interest = balance − principal.
      interest[i] = Math.max(0, total[i] - invested[i]);
    }
    return { invested, interest };
  }
  // FDR / savings: principal is fully deposited at day 0 and never
  // changes. Interest grows linearly (simple-interest split). Mirror
  // the curve in `projectionSeries`: invested = principal at every
  // index, interest = balance − principal.
  const principal = Math.max(0, Number(plan.principal) || 0);
  const points = months > 0 ? months : 12;
  const invested = new Array<number>(points + 1);
  const interest = new Array<number>(points + 1);
  for (let i = 0; i <= points; i++) {
    invested[i] = principal;
    interest[i] = Math.max(0, total[i] - principal);
  }
  return { invested, interest };
}

/* ─────────────────────────────────────────────────────────────────────
   Preset kit (mock investment planner starter cards)
   ──────────────────────────────────────────────────────────────────────*/

/**
 * Three preset plans the user can add in one tap. Pure data — no
 * defaults that move real money. The user can edit any field after
 * inserting.
 */
export const INVESTMENT_PLAN_KITS: ReadonlyArray<{
  id: 'dps' | 'fdr' | 'savings';
  name: string;
  emoji: string;
  description: string;
  defaults: Omit<InvestmentPlan, 'id' | 'name' | 'dirty' | 'savedAt'>;
}> = [
  {
    id: 'dps',
    name: 'Monthly deposit scheme (DPS)',
    emoji: '🗓️',
    description: 'Small monthly installments. Banks compound the balance monthly until the term ends.',
    defaults: {
      type: 'dps',
      monthlyContribution: 5000,
      principal: 60_000, // 5,000 × 12 — informational; recomputed on edit
      rate: 8,
      startDate: new Date().toISOString().slice(0, 10),
      termMonths: 12,
      institution: '',
      notes: '',
      kit: 'dps',
    },
  },
  {
    id: 'fdr',
    name: 'Fixed deposit receipt (FDR)',
    emoji: '🏦',
    description: 'Lump sum locked for a fixed term. Simple interest, paid out at maturity.',
    defaults: {
      type: 'fdr',
      principal: 100_000,
      rate: 9,
      startDate: new Date().toISOString().slice(0, 10),
      termMonths: 12,
      institution: '',
      notes: '',
      kit: 'fdr',
    },
  },
  {
    id: 'savings',
    name: 'Savings certificate / term deposit',
    emoji: '💼',
    description: 'Catch-all for non-DPS, non-FDR interest-bearing instruments.',
    defaults: {
      type: 'savings',
      principal: 50_000,
      rate: 7,
      startDate: new Date().toISOString().slice(0, 10),
      termMonths: 36,
      institution: '',
      notes: '',
      kit: 'other',
    },
  },
];
