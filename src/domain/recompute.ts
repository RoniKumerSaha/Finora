/**
 * recompute.ts — fills derived fields on every load.
 *
 * Recomputes paidSoFar on every debt and re-derives investment.status.
 * Used by the store init path so the store never holds stale data,
 * even if localStorage was hand-edited or held a previous shape.
 *
 * Auto-completion rules:
 *   - Debt: when paidSoFar >= total, flip active → completed.
 *   - DPS investment: when payouts (linked incomes) >= contributions
 *     (linked expenses), flip active → closed. Reflects the real-world
 *     situation: once the bank has paid back what you put in, the
 *     account is empty regardless of its official maturity date.
 *     Sticky statuses (closed, rolled_over, matured) are preserved.
 */
import type { State } from './types';
import {
  debtPaidSoFar,
  deriveInvestmentStatus,
  dpsContributedSoFar,
  dpsPaidOutSoFar,
} from './math';

export function recomputeDerived(state: State): State {
  const debts = state.debts.map(d => {
    const paid = debtPaidSoFar(d, state.transactions);
    const total = Number(d.total) || 0;
    const next = { ...d, paidSoFar: paid };
    if (d.status === 'active' && paid >= total) next.status = 'completed' as const;
    return next;
  });
  const investments = state.investments.map(inv => {
    // R10 base derivation: handles the date-driven active → matured flip.
    let nextStatus = deriveInvestmentStatus(inv);

    // DPS auto-close on full payout: when the bank has refunded at
    // least as much as the user paid in, treat the DPS as closed even
    // if the calendar hasn't caught up. Only fires when the current
    // status is active or matured (not sticky closed/rolled_over).
    if (inv.type === 'dps'
        && (nextStatus === 'active' || nextStatus === 'matured')) {
      const contributed = dpsContributedSoFar(inv, state.transactions);
      const paidOut = dpsPaidOutSoFar(inv, state.transactions);
      if (contributed > 0 && paidOut >= contributed) {
        nextStatus = 'closed';
      }
    }

    return nextStatus === inv.status ? inv : { ...inv, status: nextStatus };
  });
  return { ...state, debts, investments };
}