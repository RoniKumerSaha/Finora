/**
 * recompute.spec.ts — verifies derived state is correct on every load.
 *
 * The store calls recomputeDerived on every mutation; this is the
 * "source of truth" enforcement that the math layer's derivations
 * always match the stored derived fields.
 */
import { describe, it, expect } from 'vitest';
import { recomputeDerived } from './recompute';
import type { State, Transaction, Investment, Debt } from './types';

const NOW = '2026-08-13';

const baseState = (over: Partial<State> = {}): State => ({
  version: 1,
  accounts: [],
  transactions: [],
  goals: [],
  debts: [],
  investments: [],
  categories: [],
  monthPlans: [],
  eventPlans: [],
  settings: { theme: 'auto', onboardingComplete: true },
  ...over,
});

const tx = (over: Partial<Transaction>): Transaction => ({
  id: 'tx-' + Math.random().toString(36).slice(2),
  type: 'expense',
  amount: 0,
  date: NOW,
  ...over,
});

describe('recomputeDerived — debt auto-complete', () => {
  it('flips active → completed when paidSoFar >= total', () => {
    const debt: Debt = {
      id: 'd1', name: 'd', direction: 'i_owe', total: 1000,
      paidSoFar: 0, status: 'active', createdAt: NOW,
    };
    const txs = [
      tx({ type: 'expense', amount: 600, linkedDebtId: 'd1' }),
      tx({ type: 'expense', amount: 400, linkedDebtId: 'd1' }),
    ];
    const next = recomputeDerived(baseState({ debts: [debt], transactions: txs }));
    expect(next.debts[0].status).toBe('completed');
    expect(next.debts[0].paidSoFar).toBe(1000);
  });

  it('preserves sticky completed/archived statuses', () => {
    const debt: Debt = {
      id: 'd1', name: 'd', direction: 'i_owe', total: 1000,
      paidSoFar: 1000, status: 'completed', createdAt: NOW,
    };
    const next = recomputeDerived(baseState({ debts: [debt], transactions: [] }));
    expect(next.debts[0].status).toBe('completed');
  });
});

describe('recomputeDerived — DPS auto-close on full payout', () => {
  const dps: Investment = {
    id: 'd1', name: 'DPS', type: 'dps', principal: 0,
    monthlyContribution: 5000, rate: 8, startDate: '2026-01-01',
    termMonths: 12, status: 'active', createdAt: '2026-01-01',
  };

  it('flips active → closed when payouts >= contributions', () => {
    const txs = [
      tx({ type: 'expense', amount: 5000, linkedInvestmentId: 'd1', date: '2026-02-01' }),
      tx({ type: 'expense', amount: 5000, linkedInvestmentId: 'd1', date: '2026-03-01' }),
      tx({ type: 'income',  amount: 60000, linkedInvestmentId: 'd1', date: '2026-08-01' }),
    ];
    const next = recomputeDerived(baseState({ investments: [dps], transactions: txs }));
    expect(next.investments[0].status).toBe('closed');
  });

  it('stays active when payouts < contributions', () => {
    const txs = [
      tx({ type: 'expense', amount: 5000, linkedInvestmentId: 'd1', date: '2026-02-01' }),
      tx({ type: 'expense', amount: 5000, linkedInvestmentId: 'd1', date: '2026-03-01' }),
      tx({ type: 'income',  amount: 5000, linkedInvestmentId: 'd1', date: '2026-04-01' }), // partial
    ];
    const next = recomputeDerived(baseState({ investments: [dps], transactions: txs }));
    expect(next.investments[0].status).toBe('active');
  });

  it('preserves sticky closed/rolled_over statuses', () => {
    const closed: Investment = { ...dps, status: 'closed' };
    const next = recomputeDerived(baseState({ investments: [closed], transactions: [] }));
    expect(next.investments[0].status).toBe('closed');
  });

  it('falls back to matured derivation when no payouts yet', () => {
    const matured: Investment = {
      ...dps, startDate: '2025-01-01', termMonths: 12, status: 'active',
    };
    const next = recomputeDerived(baseState({ investments: [matured], transactions: [] }));
    expect(next.investments[0].status).toBe('matured');
  });

  it('only triggers for DPS, not for FDR/savings', () => {
    const fdr: Investment = {
      id: 'f1', name: 'FDR', type: 'fdr', principal: 100000, rate: 8,
      startDate: '2026-01-01', termMonths: 12, status: 'active', createdAt: NOW,
    };
    const txs = [
      tx({ type: 'income', amount: 200000, linkedInvestmentId: 'f1', date: '2026-08-01' }),
    ];
    const next = recomputeDerived(baseState({ investments: [fdr], transactions: txs }));
    // FDR shouldn't auto-close on linked income.
    expect(next.investments[0].status).toBe('active');
  });
});