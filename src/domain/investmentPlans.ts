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

/** Convenience: total interest earned across the full term. */
export function investmentPlanInterest(plan: InvestmentPlan): number {
  return Math.max(0, investmentPlanMaturityValue(plan) - (Number(plan.principal) || 0));
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
