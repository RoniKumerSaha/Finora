/**
 * recompute.js — derive cached values onto the state blob on load.
 *
 * Per AD-9: paidSoFar is stored as a cache for sort order; on every load
 * we recompute it from the transactions collection. This is the only place
 * those cached fields are written.
 *
 * The recompute pass is intentionally side-effect-light: it returns a new
 * state object with cached fields filled. The collections themselves stay
 * in their stored order.
 */

import { debtPaidSoFar, deriveInvestmentStatus } from './math.js';

/**
 * Recompute cached derived fields across the state.
 *   - debts[].paidSoFar ← debtPaidSoFar(debt, transactions)
 *   - debts[].status     ← 'completed' if paidSoFar >= total (else as stored)
 *   - investments[].status ← from math.deriveInvestmentStatus (auto 'matured')
 *
 * Returns a new state object; collections are shallow-copied.
 */
export function recomputeDerived(state, now = new Date()) {
  const transactions = state.transactions || [];
  const accounts = state.accounts || [];

  const debts = (state.debts || []).map(d => {
    const paidSoFar = debtPaidSoFar(d, transactions);
    const total = Number(d.total) || 0;
    let status = d.status || 'active';
    if (status === 'active' && paidSoFar >= total && total > 0) {
      status = 'completed';
    }
    return { ...d, paidSoFar, status };
  });

  const investments = (state.investments || []).map(inv => ({
    ...inv,
    status: deriveInvestmentStatus(inv, now),
  }));

  return {
    ...state,
    accounts,
    transactions,
    debts,
    investments,
  };
}