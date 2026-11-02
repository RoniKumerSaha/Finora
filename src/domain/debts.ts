/**
 * debts.ts — pure CRUD for debts + archive.
 *
 * list() and get() compute paidSoFar from transactions and auto-flip
 * status to 'completed' when paidSoFar >= total (R8). Stored paidSoFar is
 * a cache; recompute.js refreshes it on every load.
 *
 * V1.1 (Loan-kind Debt): kind + interestRate fields are accepted on
 * add/update. Validation: kind === 'loan' requires interestRate > 0.
 * Missing kind defaults to 'flat' on read so older JSON in localStorage
 * continues to deserialize unchanged.
 */
import type { Debt, DebtDirection, DebtKind, State, Transaction } from './types';
import { uid } from './ids';
import { debtOutstanding, debtPaidSoFar, isDebtCompleted } from './math';

export function list(state: State): Debt[] {
  return state.debts.map(d => withDerived(d, state));
}

export function get(state: State, id: string): Debt | undefined {
  const d = state.debts.find(x => x.id === id);
  return d ? withDerived(d, state) : undefined;
}

function withDerived(d: Debt, state: State): Debt {
  const paid = debtPaidSoFar(d, state.transactions);
  // Default missing kind to 'flat' so older JSON in localStorage
  // continues to deserialize without a migration step.
  const next: Debt = { ...d, paidSoFar: paid, kind: d.kind ?? 'flat' };
  // Completion is decided on OUTSTANDING principal, not gross paid.
  // On a loan-kind debt every payment carries interest, so gross paid
  // hits `total` several EMIs before the principal is actually retired
  // — completing on gross paid would silently drop the remaining
  // balance from every total.
  if (d.status === 'active' && debtOutstanding(next, state.transactions) <= 0) {
    next.status = 'completed';
  }
  return next;
}

export interface AddDebtInput {
  name: string;
  direction: DebtDirection;
  total: number;
  dueDate?: string;
  person?: string;
  /** V1.1: 'flat' (default) or 'loan'. */
  kind?: DebtKind;
  /** V1.1: annual interest rate %, required when kind === 'loan'. */
  interestRate?: number;
  /** V1.1: term in months — drives the Pay modal's EMI pre-fill. */
  termMonths?: number;
}

function validateKindAndRate(
  kind: DebtKind | undefined,
  interestRate: number | undefined,
): void {
  if (kind === 'loan' && !(Number(interestRate) > 0)) {
    throw new Error('Loan-kind debts require interestRate > 0.');
  }
}

export function add(state: State, input: AddDebtInput): State {
  if (!(Number(input.total) > 0)) throw new Error('Debt total must be positive.');
  validateKindAndRate(input.kind, input.interestRate);
  const debt: Debt = {
    id: uid(),
    name: input.name.trim(),
    direction: input.direction,
    total: Number(input.total),
    paidSoFar: 0,
    dueDate: input.dueDate,
    person: input.person?.trim() || undefined,
    status: 'active',
    kind: input.kind,
    interestRate: input.kind === 'loan' ? Number(input.interestRate) : undefined,
    termMonths: input.termMonths,
    createdAt: new Date().toISOString().slice(0, 10),
  };
  return { ...state, debts: [...state.debts, debt] };
}

export function update(state: State, id: string, patch: Partial<AddDebtInput>): State {
  const existing = state.debts.find(d => d.id === id);
  if (!existing) return state;
  // Merge the patch with the existing values so validation sees the
  // *post-patch* state — e.g. validating kind=loan with rate=0 even
  // when the existing debt already had a rate (the patch could be
  // setting kind without setting rate).
  const merged: AddDebtInput = {
    name: patch.name ?? existing.name,
    direction: patch.direction ?? existing.direction,
    total: patch.total ?? existing.total,
    dueDate: patch.dueDate !== undefined ? patch.dueDate : existing.dueDate,
    person: patch.person !== undefined ? patch.person : existing.person,
    kind: patch.kind !== undefined ? patch.kind : existing.kind,
    interestRate: patch.interestRate !== undefined
      ? patch.interestRate
      : existing.interestRate,
    termMonths: patch.termMonths !== undefined
      ? patch.termMonths
      : existing.termMonths,
  };
  validateKindAndRate(merged.kind, merged.interestRate);

  // When the patch sets kind back to 'flat', clear interestRate so the
  // stored state stays self-consistent (a flat debt never carries a rate).
  const clearedInterest = merged.kind === 'flat' ? undefined : merged.interestRate;

  return {
    ...state,
    debts: state.debts.map(d => d.id === id ? {
      ...d,
      ...patch,
      kind: merged.kind,
      interestRate: clearedInterest,
    } : d),
  };
}

export function remove(state: State, id: string): State {
  return { ...state, debts: state.debts.filter(d => d.id !== id) };
}

export function archive(state: State, id: string): State {
  return update(state, id, {}).debts.length
    ? { ...state, debts: state.debts.map(d => d.id === id ? { ...d, status: 'archived' as const } : d) }
    : state;
}

/**
 * V1.1: outstanding principal on a debt.
 *  - flat debt  → total − paidSoFar (unchanged behaviour).
 *  - loan debt  → walk linked transactions chronologically and apply
 *                 `loanPaymentSplit` on each, reducing outstanding by
 *                 the principal portion. Returns the resulting
 *                 outstanding after the last transaction.
 *
 * Pure: derived from debt + transactions, never stored.
 *
 * Thin wrapper over `math.debtOutstanding` — the canonical helper that
 * every screen reads. Keeping the delegation here preserves the
 * existing `debts.outstandingFor(...)` call sites and the L1.4 test
 * contract without maintaining a second copy of the amortisation walk.
 */
export function outstandingFor(debt: Debt, transactions: Transaction[]): number {
  return debtOutstanding(debt, transactions);
}

export { isDebtCompleted };