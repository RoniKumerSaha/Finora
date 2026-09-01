/**
 * loanPlans.ts — pure CRUD for the Loan Calculator scratchpad
 * (PRD §9.17).
 *
 * The loan calculator is a pure-scratch projection. It never touches
 * `state.debts` and it never creates a transaction. The user enters
 * principal + rate + term + start month and gets an amortisation
 * table back; everything else is up to them.
 */
import type { LoanPlan, State } from './types';
import { uid } from './ids';
import { loanAmortization, loanEMI, loanTotalInterest, loanTotalPaid } from './math';

/* ─────────────────────────────────────────────────────────────────────
   List / get
   ──────────────────────────────────────────────────────────────────────*/

export function listLoanPlans(state: State): LoanPlan[] {
  return state.loanPlans;
}

export function getLoanPlan(state: State, id: string): LoanPlan | undefined {
  return state.loanPlans.find(p => p.id === id);
}

/* ─────────────────────────────────────────────────────────────────────
   Mutations — Loan Calculator
   ──────────────────────────────────────────────────────────────────────*/

/**
 * Create a new loan-plan scratchpad. Returns the new id. The plan
 * starts in `dirty` state so the user has to confirm with Save.
 */
export function addLoanPlan(
  state: State,
  input: Omit<LoanPlan, 'id' | 'dirty' | 'savedAt'>,
): { state: State; id: string } {
  const id = uid();
  const plan: LoanPlan = { ...input, id, dirty: true, savedAt: null };
  return { state: { ...state, loanPlans: [...state.loanPlans, plan] }, id };
}

/**
 * Patch a loan plan. Always flips `dirty`.
 */
export function updateLoanPlan(
  state: State,
  id: string,
  patch: Partial<Omit<LoanPlan, 'id' | 'dirty' | 'savedAt'>>,
): State {
  const existing = getLoanPlan(state, id);
  if (!existing) return state;
  const next: LoanPlan = { ...existing, ...patch, dirty: true };
  return {
    ...state,
    loanPlans: state.loanPlans.map(p => p.id === id ? next : p),
  };
}

/** Mark as saved NOW. Clears dirty. */
export function saveLoanPlan(state: State, id: string): State {
  const existing = getLoanPlan(state, id);
  if (!existing) return state;
  const next: LoanPlan = {
    ...existing,
    dirty: false,
    savedAt: new Date().toISOString().slice(0, 10),
  };
  return {
    ...state,
    loanPlans: state.loanPlans.map(p => p.id === id ? next : p),
  };
}

/** Hard-delete the plan (with confirmation at the UI layer). The
 *  detail screen's Back button also drops never-saved shells via
 *  this helper so the user doesn't leave a draft behind. */
export function removeLoanPlan(state: State, id: string): State {
  return {
    ...state,
    loanPlans: state.loanPlans.filter(p => p.id !== id),
  };
}

/* ─────────────────────────────────────────────────────────────────────
   Derived: amortisation summary (display-only)
   ──────────────────────────────────────────────────────────────────────*/

export interface LoanSummary {
  emi: number;
  totalPaid: number;
  totalInterest: number;
  termMonths: number;
  rate: number;
  principal: number;
}

export function summariseLoanPlan(plan: LoanPlan): LoanSummary {
  const principal = Number(plan.principal) || 0;
  const rate = Number(plan.rate) || 0;
  const termMonths = Math.max(0, Math.floor(Number(plan.termMonths) || 0));
  const emi = loanEMI(principal, rate, termMonths);
  return {
    emi,
    totalPaid: loanTotalPaid(emi, termMonths),
    totalInterest: loanTotalInterest(principal, emi, termMonths),
    termMonths,
    rate,
    principal,
  };
}

/** Convenience re-export — surfaces the amortisation rows for the
 *  table on the Loan Calculator screen. */
export { loanAmortization };
