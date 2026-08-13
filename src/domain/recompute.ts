/**
 * recompute.ts — fills derived fields on every load.
 *
 * Recomputes paidSoFar on every debt and re-derives investment.status.
 * Used by the store init path so the store never holds stale data,
 * even if localStorage was hand-edited or held a previous shape.
 */
import type { State } from './types';
import { debtPaidSoFar } from './math';
import { deriveInvestmentStatus } from './math';

export function recomputeDerived(state: State): State {
  const debts = state.debts.map(d => {
    const paid = debtPaidSoFar(d, state.transactions);
    const total = Number(d.total) || 0;
    const next = { ...d, paidSoFar: paid };
    if (d.status === 'active' && paid >= total) next.status = 'completed' as const;
    return next;
  });
  const investments = state.investments.map(inv => {
    const next = deriveInvestmentStatus(inv);
    return next === inv.status ? inv : { ...inv, status: next };
  });
  return { ...state, debts, investments };
}