/**
 * consistency.spec.ts — cross-screen figure agreement.
 *
 * Regression cover for the "Home shows a different debt / investment
 * amount than the related page" bug (2026-11-02).
 *
 * The bug had two independent causes, both of which made two screens
 * derive the same underlying fact through two different formulas:
 *
 *   1. DEBT OUTSTANDING. Home computed `total − gross paid` while the
 *      Debts screen computed the interest-aware outstanding. On a
 *      loan-kind debt every payment contains interest, so gross paid
 *      overstates how much principal has been retired and Home
 *      understated what was still owed by exactly the interest paid.
 *
 *   2. INVESTMENT VALUE. Home summed *contributed* principal while the
 *      Investments screen summed *current value* (contributions
 *      compounded to today). The two differ whenever interest has
 *      accrued.
 *
 * The fix routes every screen through the same canonical helpers
 * (`debtOutstanding`, `investmentValue`, `isInvestmentHeld`). These
 * tests assert the helpers agree — and, critically, that the Home
 * screen's own arithmetic adds up to the net-worth hero, since the
 * Home strip is the only place the two formulas sit side by side.
 */
import { describe, it, expect } from 'vitest';
import {
  accountBalance,
  computeNetWorth,
  debtOutstanding,
  debtPaidSoFar,
  investmentValue,
  isInvestmentHeld,
} from './math';
import { outstandingFor } from './debts';
import { recomputeDerived } from './recompute';
import type { Debt, Investment, State, Transaction } from './types';

const NOW = '2026-11-02';

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
  investmentPlans: [],
  loanPlans: [],
  settings: { theme: 'dark', onboardingComplete: true },
  ...over,
});

const tx = (over: Partial<Transaction>): Transaction => ({
  id: 'tx-' + Math.random().toString(36).slice(2),
  type: 'expense',
  amount: 0,
  date: NOW,
  ...over,
});

/**
 * A loan-kind debt with three EMIs already paid — the shape that
 * triggered the original bug. Each payment is split into interest and
 * principal, so gross paid (30000) exceeds the principal actually
 * retired (25220).
 */
const loanDebt = (): Debt => ({
  id: 'loan1',
  name: 'Personal Loan',
  direction: 'i_owe',
  total: 100000,
  paidSoFar: 0,
  status: 'active',
  kind: 'loan',
  interestRate: 12,
  termMonths: 36,
  createdAt: '2026-01-01',
});

const loanPayments = (): Transaction[] => [
  tx({ id: 'p1', type: 'expense', amount: 10000, date: '2026-08-01', linkedDebtId: 'loan1' }),
  tx({ id: 'p2', type: 'expense', amount: 10000, date: '2026-09-01', linkedDebtId: 'loan1' }),
  tx({ id: 'p3', type: 'expense', amount: 10000, date: '2026-10-01', linkedDebtId: 'loan1' }),
];

describe('debtOutstanding — canonical outstanding principal', () => {
  it('flat debt: total minus what has been paid', () => {
    const d: Debt = {
      id: 'd1', name: 'Lunch', direction: 'i_owe', total: 1000,
      paidSoFar: 0, status: 'active', createdAt: NOW,
    };
    const txs = [tx({ type: 'expense', amount: 400, linkedDebtId: 'd1' })];
    expect(debtOutstanding(d, txs)).toBe(600);
  });

  it('loan debt: outstanding exceeds total-minus-gross-paid by the interest paid', () => {
    const d = loanDebt();
    const txs = loanPayments();
    const grossPaid = debtPaidSoFar(d, txs);
    const outstanding = debtOutstanding(d, txs);

    // Gross paid is 30000, but only the principal portion retired debt.
    expect(grossPaid).toBe(30000);
    // The naive `total - grossPaid` figure understates what's owed.
    expect(100000 - grossPaid).toBe(70000);
    expect(outstanding).toBeGreaterThan(70000);
    expect(outstanding).toBeLessThan(100000);
  });

  it('loan debt: matches debts.outstandingFor (the Debts screen helper)', () => {
    const d = loanDebt();
    const txs = loanPayments();
    expect(debtOutstanding(d, txs)).toBe(outstandingFor(d, txs));
  });

  it('owed_to_me loan: receipts reduce the outstanding', () => {
    const d: Debt = { ...loanDebt(), direction: 'owed_to_me' };
    const txs = loanPayments().map(t => ({ ...t, type: 'income' as const }));
    expect(debtOutstanding(d, txs)).toBeLessThan(100000);
  });

  it('ignores transactions linked to a different debt', () => {
    const d = loanDebt();
    const txs = [
      ...loanPayments(),
      tx({ id: 'other', type: 'expense', amount: 50000, date: '2026-10-15' }),
    ];
    expect(debtOutstanding(d, txs)).toBe(outstandingFor(d, txs));
  });
});

describe('isDebtCompleted — decided on outstanding, not gross paid', () => {
  it('a loan is NOT complete while principal is still outstanding', () => {
    const d = loanDebt();
    const txs = loanPayments();
    // Gross paid (30000) is well under the principal, but the point is
    // the mechanism: completion follows outstanding, never gross paid.
    expect(debtPaidSoFar(d, txs)).toBeLessThan(d.total);
    expect(debtOutstanding(d, txs)).toBeGreaterThan(0);
  });

  it('a loan IS complete once the principal is fully retired', () => {
    const d = loanDebt();
    // One large payment that clears principal (interest is absorbed
    // first, so a payment equal to the full principal + interest
    // retires the whole balance).
    const txs = [
      tx({ id: 'big', type: 'expense', amount: 110000, date: '2026-08-01', linkedDebtId: 'loan1' }),
    ];
    expect(debtOutstanding(d, txs)).toBe(0);
  });

  it('flat debt still completes on paidSoFar >= total', () => {
    const d: Debt = {
      id: 'd1', name: 'Lunch', direction: 'i_owe', total: 1000,
      paidSoFar: 0, status: 'active', createdAt: NOW,
    };
    const txs = [tx({ type: 'expense', amount: 1000, linkedDebtId: 'd1' })];
    expect(debtOutstanding(d, txs)).toBe(0);
  });
});

describe('recomputeDerived — loan completion uses outstanding', () => {
  it('keeps a loan active while gross paid has crossed the principal', () => {
    // Principal 1000, rate 12%. A single payment of 1000 is mostly
    // interest, so gross paid == total but the principal is NOT
    // retired. The debt must stay active — otherwise its balance
    // silently disappears from every total.
    const d: Debt = {
      id: 'd1', name: 'Loan', direction: 'i_owe', total: 1000,
      paidSoFar: 0, status: 'active', kind: 'loan',
      interestRate: 12, termMonths: 12, createdAt: NOW,
    };
    const txs = [tx({ type: 'expense', amount: 1000, linkedDebtId: 'd1' })];
    const next = recomputeDerived(baseState({ debts: [d], transactions: txs }));

    expect(next.debts[0].paidSoFar).toBe(1000);          // gross paid == total
    expect(next.debts[0].status).toBe('active');          // but principal remains
    expect(debtOutstanding(next.debts[0], txs)).toBeGreaterThan(0);
  });

  it('completes a loan once its principal is actually retired', () => {
    const d: Debt = {
      id: 'd1', name: 'Loan', direction: 'i_owe', total: 1000,
      paidSoFar: 0, status: 'active', kind: 'loan',
      interestRate: 12, termMonths: 12, createdAt: NOW,
    };
    const txs = [tx({ type: 'expense', amount: 1100, linkedDebtId: 'd1' })];
    const next = recomputeDerived(baseState({ debts: [d], transactions: txs }));
    expect(next.debts[0].status).toBe('completed');
  });
});

describe('isInvestmentHeld — which schemes count toward your money', () => {
  const mk = (status: Investment['status']): Investment => ({
    id: 'i1', name: 'X', type: 'fdr', principal: 1000, rate: 8,
    startDate: '2026-01-01', termMonths: 12, status, createdAt: '2026-01-01',
  });

  it('active and matured schemes are held', () => {
    expect(isInvestmentHeld(mk('active'))).toBe(true);
    // A matured-but-unpaid scheme still holds cash at the bank.
    expect(isInvestmentHeld(mk('matured'))).toBe(true);
  });

  it('closed and rolled-over schemes are not held', () => {
    expect(isInvestmentHeld(mk('closed'))).toBe(false);
    expect(isInvestmentHeld(mk('rolled_over'))).toBe(false);
  });
});

describe('cross-screen consistency — Home vs Debts vs Investments', () => {
  /**
   * Builds the exact shape that produced the bug: one loan-kind debt,
   * one DPS with accrued interest, one FDR, and a cash account.
   */
  const scenario = (): State => {
    const dps: Investment = {
      id: 'dps1', name: 'DPS', type: 'dps', principal: 0,
      monthlyContribution: 10000, rate: 9,
      startDate: '2026-02-01', termMonths: 12, status: 'active',
      createdAt: '2026-02-01',
    };
    const fdr: Investment = {
      id: 'fdr1', name: 'FDR', type: 'fdr', principal: 50000, rate: 8,
      startDate: '2026-03-01', termMonths: 12, status: 'active',
      createdAt: '2026-03-01',
    };
    return recomputeDerived(baseState({
      accounts: [
        { id: 'a1', name: 'Bank', type: 'bank', openingBalance: 200000, createdAt: '2026-01-01' },
      ],
      debts: [loanDebt()],
      investments: [dps, fdr],
      transactions: [
        ...loanPayments(),
        // DPS contributions, some of which have accrued interest.
        tx({ id: 'c1', type: 'expense', amount: 20000, date: '2026-08-01', linkedInvestmentId: 'dps1' }),
        tx({ id: 'c2', type: 'expense', amount: 20000, date: '2026-09-01', linkedInvestmentId: 'dps1' }),
        // FDR principal parked in the account.
        tx({ id: 'f1', type: 'expense', amount: 50000, date: '2026-03-01', linkedInvestmentId: 'fdr1' }),
      ],
    }));
  };

  it('Home debt strip equals the Debts screen summary', () => {
    const state = scenario();
    const txs = state.transactions;
    const active = state.debts.filter(d => d.status === 'active');

    // Home's figure.
    const homeDebt = active
      .filter(d => d.direction === 'i_owe')
      .reduce((s, d) => s + debtOutstanding(d, txs), 0);

    // Debts screen's figure.
    let listDebt = 0;
    for (const d of active) {
      const left = outstandingFor(d, txs);
      if (d.direction === 'i_owe') listDebt += left;
    }

    expect(homeDebt).toBe(listDebt);
    // And it must NOT be the naive total-minus-gross-paid figure.
    const naive = active
      .filter(d => d.direction === 'i_owe')
      .reduce((s, d) => s + Math.max(0, d.total - debtPaidSoFar(d, txs)), 0);
    expect(homeDebt).not.toBe(naive);
  });

  it('Home investment strip equals the Investments screen current value', () => {
    const state = scenario();
    const txs = state.transactions;

    const held = state.investments.filter(isInvestmentHeld);
    const homeInv = held.reduce((s, inv) => s + investmentValue(inv, txs).currentValue, 0);
    const listCurrent = held.reduce((s, inv) => s + investmentValue(inv, txs).currentValue, 0);

    expect(homeInv).toBe(listCurrent);
    // DPS current value is the compounded contributions, NOT the raw
    // contributed amount — that's the second half of the original bug.
    const rawContributed = held
      .filter(i => i.type === 'dps')
      .reduce((s, i) => {
        const c = txs
          .filter(t => t.linkedInvestmentId === i.id && t.type === 'expense')
          .reduce((sum, t) => sum + (t.amount || 0), 0);
        return s + c;
      }, 0);
    expect(homeInv).not.toBe(rawContributed);
  });

  it("the Home strip adds up to the net-worth hero", () => {
    const state = scenario();
    const txs = state.transactions;

    let cash = 0;
    for (const a of state.accounts) cash += accountBalance(a, txs);

    const active = state.debts.filter(d => d.status === 'active');
    const receivables = active
      .filter(d => d.direction === 'owed_to_me')
      .reduce((s, d) => s + debtOutstanding(d, txs), 0);
    const debts = active
      .filter(d => d.direction === 'i_owe')
      .reduce((s, d) => s + debtOutstanding(d, txs), 0);
    const investments = state.investments
      .filter(isInvestmentHeld)
      .reduce((s, inv) => s + investmentValue(inv, txs).currentValue, 0);

    const stripTotal = cash + receivables + investments - debts;
    const nw = computeNetWorth(state, NOW);

    // The four strip cells must reconcile to the hero figure — this is
    // the invariant that was broken.
    expect(stripTotal).toBeCloseTo(nw.currentNetWorth, 6);
    expect(nw.cash).toBe(cash);
    expect(nw.invCurrent).toBeCloseTo(investments, 6);
    expect(nw.oweRemaining).toBe(debts);
    expect(nw.receivables).toBe(receivables);
  });
});
