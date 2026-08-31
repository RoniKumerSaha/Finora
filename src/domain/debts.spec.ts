/**
 * debts.spec.ts — tests for the Loan-kind Debt extension (PRD §7, §8).
 *
 * Covers:
 *  - L1.3 — `debts.add` / `update` accept kind + interestRate; loan-kind
 *    requires rate > 0.
 *  - L1.4 — `outstandingFor(debt, transactions)` derives the principal
 *    outstanding for both flat and loan-kind debts, walking linked
 *    transactions chronologically and applying `loanPaymentSplit` on
 *    each.
 */
import { describe, it, expect } from 'vitest';
import * as debts from './debts';
import type { State, Transaction } from './types';

const NOW = '2026-08-31';

const baseState = (): State => ({
  version: 1,
  accounts: [],
  transactions: [],
  goals: [],
  debts: [],
  investments: [],
  categories: [],
  monthPlans: [],
  eventPlans: [],
  investmentPlans: [],
  loanPlans: [],
  settings: { theme: 'dark', onboardingComplete: true },
});

const tx = (over: Partial<Transaction>): Transaction => ({
  id: 'tx-' + Math.random().toString(36).slice(2),
  type: 'expense',
  amount: 0,
  date: NOW,
  ...over,
});

describe('debts.add with kind + interestRate (L1.3)', () => {
  it('adds a flat debt without kind/rate (today\'s behaviour)', () => {
    const s = debts.add(baseState(), {
      name: 'Lunch', direction: 'i_owe', total: 500,
    });
    expect(s.debts).toHaveLength(1);
    expect(s.debts[0].kind).toBeUndefined();
    expect(s.debts[0].interestRate).toBeUndefined();
  });

  it('adds a loan-kind debt with rate', () => {
    const s = debts.add(baseState(), {
      name: 'DBBL home loan', direction: 'i_owe', total: 500000,
      kind: 'loan', interestRate: 11.5,
    });
    expect(s.debts[0].kind).toBe('loan');
    expect(s.debts[0].interestRate).toBe(11.5);
  });

  it('rejects loan-kind debt without rate', () => {
    expect(() => debts.add(baseState(), {
      name: 'Bad loan', direction: 'i_owe', total: 100000,
      kind: 'loan',
    })).toThrow(/interestRate/);
  });

  it('rejects loan-kind debt with rate <= 0', () => {
    expect(() => debts.add(baseState(), {
      name: 'Zero-rate loan', direction: 'i_owe', total: 100000,
      kind: 'loan', interestRate: 0,
    })).toThrow(/interestRate/);
  });
});

describe('debts.update with kind + interestRate (L1.3)', () => {
  it('upgrades a flat debt to loan-kind with rate', () => {
    const s0 = debts.add(baseState(), { name: 'A', direction: 'i_owe', total: 100000 });
    const s1 = debts.update(s0, s0.debts[0].id, { kind: 'loan', interestRate: 9 });
    expect(s1.debts[0].kind).toBe('loan');
    expect(s1.debts[0].interestRate).toBe(9);
  });

  it('downgrades a loan-kind debt back to flat and clears rate', () => {
    const s0 = debts.add(baseState(), {
      name: 'A', direction: 'i_owe', total: 100000,
      kind: 'loan', interestRate: 9,
    });
    const s1 = debts.update(s0, s0.debts[0].id, { kind: 'flat' });
    expect(s1.debts[0].kind).toBe('flat');
    expect(s1.debts[0].interestRate).toBeUndefined();
  });

  it('rejects setting kind=loan with rate <= 0', () => {
    const s0 = debts.add(baseState(), { name: 'A', direction: 'i_owe', total: 100000 });
    expect(() => debts.update(s0, s0.debts[0].id, {
      kind: 'loan', interestRate: 0,
    })).toThrow(/interestRate/);
  });
});

describe('debts.list defaults missing kind to "flat" (L1.3)', () => {
  it('legacy debt without kind reads as flat', () => {
    const s0: State = {
      ...baseState(),
      debts: [{
        id: 'legacy', name: 'Old', direction: 'i_owe',
        total: 1000, paidSoFar: 0, status: 'active', createdAt: NOW,
      } as any],
    };
    const list = debts.list(s0);
    expect(list[0].kind).toBe('flat');
  });
});

describe('outstandingFor (L1.4)', () => {
  it('flat debt: total - paidSoFar', () => {
    const d: any = { id: 'd1', name: 'A', direction: 'i_owe', total: 1000, paidSoFar: 0, status: 'active', createdAt: NOW };
    expect(debts.outstandingFor(d, [])).toBe(1000);
  });

  it('loan-kind debt with no payments: equals principal (total)', () => {
    const d: any = { id: 'd1', name: 'A', direction: 'i_owe', total: 100000, paidSoFar: 0, status: 'active', createdAt: NOW, kind: 'loan', interestRate: 12 };
    expect(debts.outstandingFor(d, [])).toBe(100000);
  });

  it('loan-kind debt with two EMIs — matches worked example', () => {
    const d: any = { id: 'd1', name: 'A', direction: 'i_owe', total: 100000, paidSoFar: 0, status: 'active', createdAt: NOW, kind: 'loan', interestRate: 12 };
    const txs: Transaction[] = [
      tx({ id: 't1', type: 'expense', amount: 3321, date: '2026-08-01', linkedDebtId: 'd1' }),
      tx({ id: 't2', type: 'expense', amount: 3321, date: '2026-09-01', linkedDebtId: 'd1' }),
    ];
    // After two months: 100000 - 2321 - 2344 = 95335
    expect(debts.outstandingFor(d, txs)).toBe(95335);
  });

  it('walks transactions in chronological order regardless of input order', () => {
    const d: any = { id: 'd1', name: 'A', direction: 'i_owe', total: 100000, paidSoFar: 0, status: 'active', createdAt: NOW, kind: 'loan', interestRate: 12 };
    const txs: Transaction[] = [
      // Deliberately out of order:
      tx({ id: 't2', type: 'expense', amount: 3321, date: '2026-09-01', linkedDebtId: 'd1' }),
      tx({ id: 't1', type: 'expense', amount: 3321, date: '2026-08-01', linkedDebtId: 'd1' }),
    ];
    expect(debts.outstandingFor(d, txs)).toBe(95335);
  });

  it('ignores transactions not linked to the debt', () => {
    const d: any = { id: 'd1', name: 'A', direction: 'i_owe', total: 100000, paidSoFar: 0, status: 'active', createdAt: NOW, kind: 'loan', interestRate: 12 };
    const txs: Transaction[] = [
      tx({ id: 't1', type: 'expense', amount: 3321, date: '2026-08-01', linkedDebtId: 'd1' }),
      tx({ id: 'tx-foreign', type: 'expense', amount: 99999, date: '2026-08-15' }), // no linkedDebtId
    ];
    expect(debts.outstandingFor(d, txs)).toBe(97679);
  });

  it('owed_to_me loan: income transactions reduce outstanding', () => {
    const d: any = { id: 'd1', name: 'A', direction: 'owed_to_me', total: 100000, paidSoFar: 0, status: 'active', createdAt: NOW, kind: 'loan', interestRate: 12 };
    const txs: Transaction[] = [
      tx({ id: 't1', type: 'income', amount: 3321, date: '2026-08-01', linkedDebtId: 'd1' }),
      tx({ id: 't2', type: 'income', amount: 3321, date: '2026-09-01', linkedDebtId: 'd1' }),
    ];
    expect(debts.outstandingFor(d, txs)).toBe(95335);
  });
});
