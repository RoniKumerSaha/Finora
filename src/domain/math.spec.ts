/**
 * math.spec.ts — ported from archive/vanilla-v1/tests/math.spec.js
 *
 * Tests all R1–R10 rules + date helpers. Pure modules → no DOM env needed,
 * but happy-dom is fine.
 */
import { describe, it, expect } from 'vitest';
import {
  parseISODate,
  today,
  isInMonth,
  daysBetween,
  monthsBetween,
  monthlyIncome,
  monthlyExpenses,
  accountBalance,
  goalRequiredPerMonth,
  isGoalCompleted,
  isGoalExpired,
  debtPaidSoFar,
  isDebtCompleted,
  investmentMaturityValue,
  investmentMaturityDate,
  deriveInvestmentStatus,
  daysToMaturity,
} from './math';
import type { Account, Debt, Investment, Transaction } from './types';

const NOW = '2026-08-13';

const acc = (id: string, opening = 0): Account => ({
  id, name: id, type: 'cash', openingBalance: opening, createdAt: NOW,
});
const tx = (over: Partial<Transaction>): Transaction => ({
  id: 'tx-' + Math.random().toString(36).slice(2),
  type: 'expense',
  amount: 0,
  date: NOW,
  ...over,
});

describe('date helpers', () => {
  it('parseISODate accepts YYYY-MM-DD and full ISO', () => {
    expect(parseISODate('2026-01-15').toISOString()).toBe('2026-01-15T00:00:00.000Z');
    expect(parseISODate('2026-01-15T10:30:00Z').toISOString()).toBe('2026-01-15T00:00:00.000Z');
  });
  it('parseISODate accepts Date objects', () => {
    const d = new Date(Date.UTC(2026, 5, 1));
    expect(parseISODate(d).toISOString()).toBe('2026-06-01T00:00:00.000Z');
  });
  it('parseISODate rejects non-ISO strings', () => {
    expect(() => parseISODate('15/01/2026' as unknown as string)).toThrow();
  });
  it('today() returns a UTC midnight Date', () => {
    const t = today(NOW);
    expect(t.getUTCHours()).toBe(0);
    expect(t.getUTCMinutes()).toBe(0);
    expect(t.toISOString().slice(0, 10)).toBe(NOW);
  });
  it('isInMonth matches year + month', () => {
    expect(isInMonth('2026-08-15', 2026, 8)).toBe(true);
    expect(isInMonth('2026-08-31', 2026, 8)).toBe(true);
    expect(isInMonth('2026-09-01', 2026, 8)).toBe(false);
  });
  it('daysBetween returns whole days', () => {
    expect(daysBetween('2026-01-01', '2026-01-11')).toBe(10);
    expect(daysBetween('2026-01-11', '2026-01-01')).toBe(-10);
  });
  it('monthsBetween floors', () => {
    expect(monthsBetween('2025-01-15', '2026-01-15')).toBe(12);
    expect(monthsBetween('2025-01-15', '2026-01-14')).toBe(11);
    expect(monthsBetween('2025-01-15', '2026-08-15')).toBe(19);
  });
});

describe('R1 / R2 — monthly income / expenses', () => {
  it('sums only the requested type, only in the requested month', () => {
    const txs: Transaction[] = [
      tx({ type: 'income',  amount: 1000, date: '2026-08-01' }),
      tx({ type: 'income',  amount: 2000, date: '2026-08-31' }),
      tx({ type: 'income',  amount: 9999, date: '2026-07-31' }),  // wrong month
      tx({ type: 'expense', amount: 500,  date: '2026-08-15' }),
      tx({ type: 'transfer', amount: 100, date: '2026-08-15' }), // never income/expense
    ];
    expect(monthlyIncome(txs, 2026, 8)).toBe(3000);
    expect(monthlyExpenses(txs, 2026, 8)).toBe(500);
  });
});

describe('R3 — account balance', () => {
  it('opening + income − expense + transfers', () => {
    const a = acc('a1', 1000);
    const txs: Transaction[] = [
      tx({ type: 'income',  accountId: 'a1', amount: 500 }),
      tx({ type: 'expense', accountId: 'a1', amount: 200 }),
      tx({ type: 'transfer', fromAccountId: 'a1', toAccountId: 'a2', amount: 100 }),
    ];
    expect(accountBalance(a, txs)).toBe(1200);  // 1000 + 500 - 200 - 100 (transfer out)
  });
});

describe('R5 — goal required per month', () => {
  it('returns positive number when on track', () => {
    const goal = { id: 'g1', name: 'g', target: 12000, saved: 0, targetDate: '2027-02-13', createdAt: NOW };
    // 6 months left from 2026-08-13.
    expect(goalRequiredPerMonth(goal, 0, NOW)).toBe(2000);
  });
  it('returns 0 when goal is met', () => {
    const goal = { id: 'g1', name: 'g', target: 100, saved: 100, targetDate: '2099-01-01', createdAt: NOW };
    expect(goalRequiredPerMonth(goal, 100, NOW)).toBe(0);
  });
  it('returns Infinity when expired', () => {
    const goal = { id: 'g1', name: 'g', target: 1000, saved: 0, targetDate: '2026-01-01', createdAt: NOW };
    expect(goalRequiredPerMonth(goal, 0, NOW)).toBe(Infinity);
  });
  it('isGoalCompleted + isGoalExpired', () => {
    const g = { id: 'g1', name: 'g', target: 100, saved: 50, targetDate: '2099-01-01', createdAt: NOW };
    expect(isGoalCompleted(g, 50)).toBe(false);
    expect(isGoalCompleted(g, 100)).toBe(true);
    expect(isGoalExpired({ ...g, targetDate: '2025-01-01' }, NOW)).toBe(true);
    expect(isGoalExpired(g, NOW)).toBe(false);
  });
});

describe('R7 / R8 — debt paid_so_far + auto-complete', () => {
  it('i_owe sums linked expense txns', () => {
    const debt: Debt = {
      id: 'd1', name: 'd', direction: 'i_owe', total: 1000,
      paidSoFar: 0, status: 'active', createdAt: NOW,
    };
    const txs: Transaction[] = [
      tx({ type: 'expense', amount: 300, linkedDebtId: 'd1' }),
      tx({ type: 'income',  amount: 100, linkedDebtId: 'd1' }), // ignored for i_owe
      tx({ type: 'expense', amount: 200, linkedDebtId: 'd2' }),
    ];
    expect(debtPaidSoFar(debt, txs)).toBe(300);
  });
  it('owed_to_me sums linked income txns', () => {
    const debt: Debt = {
      id: 'd1', name: 'd', direction: 'owed_to_me', total: 1000,
      paidSoFar: 0, status: 'active', createdAt: NOW,
    };
    const txs: Transaction[] = [
      tx({ type: 'income',  amount: 500, linkedDebtId: 'd1' }),
      tx({ type: 'expense', amount: 100, linkedDebtId: 'd1' }),
    ];
    expect(debtPaidSoFar(debt, txs)).toBe(500);
  });
  it('isDebtCompleted triggers at >= total', () => {
    const debt: Debt = {
      id: 'd1', name: 'd', direction: 'i_owe', total: 1000,
      paidSoFar: 0, status: 'active', createdAt: NOW,
    };
    const txs = [tx({ type: 'expense', amount: 999, linkedDebtId: 'd1' })];
    expect(isDebtCompleted(debt, txs)).toBe(false);
    txs.push(tx({ type: 'expense', amount: 1, linkedDebtId: 'd1' }));
    expect(isDebtCompleted(debt, txs)).toBe(true);
  });
});

describe('R9 / R10 — investment maturity', () => {
  const inv = (over: Partial<Investment>): Investment => ({
    id: 'i1', name: 'DPS', type: 'dps', principal: 100000,
    rate: 8, startDate: '2025-01-31', termMonths: 12,
    status: 'active', createdAt: '2025-01-31',
    ...over,
  });
  it('R9: maturity value formula', () => {
    expect(investmentMaturityValue(inv({}))).toBeCloseTo(108000, 2);
    expect(investmentMaturityValue(inv({ principal: 50000, rate: 10, termMonths: 6 })))
      .toBeCloseTo(52500, 2);
  });
  it('R10: maturity date clamps day to last of month', () => {
    const d = investmentMaturityDate(inv({ startDate: '2025-01-31', termMonths: 1 }));
    expect(d?.toISOString().slice(0, 10)).toBe('2025-02-28');
    const d2 = investmentMaturityDate(inv({ startDate: '2025-01-15', termMonths: 12 }));
    expect(d2?.toISOString().slice(0, 10)).toBe('2026-01-15');
  });
  it('R10: status flips to matured when today crosses', () => {
    expect(deriveInvestmentStatus(inv({}), NOW)).toBe('matured');  // started Jan, term 12
    expect(deriveInvestmentStatus(inv({ termMonths: 36 }), NOW)).toBe('active');
  });
  it('R10: sticky statuses are preserved', () => {
    expect(deriveInvestmentStatus(inv({ status: 'closed' }), NOW)).toBe('closed');
    expect(deriveInvestmentStatus(inv({ status: 'rolled_over' }), NOW)).toBe('rolled_over');
  });
  it('daysToMaturity negative when past', () => {
    expect(daysToMaturity(inv({}), NOW)).toBeLessThan(0);
    expect(daysToMaturity(inv({ termMonths: 36 }), NOW)).toBeGreaterThan(0);
  });
});