import { describe, it, expect } from 'vitest';
import {
  // date helpers
  parseISODate,
  today,
  isInMonth,
  daysBetween,
  monthsBetween,
  // transactions
  sumByType,
  monthlyIncome,
  monthlyExpenses,
  sumOnAccount,
  // R3
  accountBalance,
  // R5
  goalRequiredPerMonth,
  isGoalCompleted,
  isGoalExpired,
  // R7, R8
  debtPaidSoFar,
  isDebtCompleted,
  // R9, R10
  investmentMaturityValue,
  investmentMaturityDate,
  deriveInvestmentStatus,
  daysToMaturity,
} from '../src/js/math.js';

// Fixed reference "now" used throughout — keeps tests deterministic.
const NOW = '2026-08-13';

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
    expect(() => parseISODate('15/01/2026')).toThrow();
  });

  it('today() returns a UTC midnight Date', () => {
    const t = today(NOW);
    expect(t.getUTCHours()).toBe(0);
    expect(t.toISOString().slice(0, 10)).toBe(NOW);
  });

  it('isInMonth matches year+month (1-based)', () => {
    expect(isInMonth('2026-08-01', 2026, 8)).toBe(true);
    expect(isInMonth('2026-08-31', 2026, 8)).toBe(true);
    expect(isInMonth('2026-07-31', 2026, 8)).toBe(false);
    expect(isInMonth('2026-09-01', 2026, 8)).toBe(false);
  });

  it('daysBetween counts whole calendar days, ignoring time', () => {
    expect(daysBetween('2026-08-13', '2026-08-20')).toBe(7);
    expect(daysBetween('2026-08-20', '2026-08-13')).toBe(-7);
    expect(daysBetween('2026-08-13', '2026-08-13')).toBe(0);
    expect(daysBetween('2026-01-01', '2027-01-01')).toBe(365);
  });

  it('monthsBetween floors partial months', () => {
    expect(monthsBetween('2025-01-15', '2026-08-15')).toBe(19);
    expect(monthsBetween('2025-01-15', '2026-07-31')).toBe(18);
    // 2025-01-15 → 2026-01-14 = 11 full months + 30 days short of 1 year
    expect(monthsBetween('2025-01-15', '2026-01-14')).toBe(11);
    expect(monthsBetween('2025-01-15', '2026-01-15')).toBe(12);
    expect(monthsBetween('2025-01-15', '2025-01-14')).toBe(-1);
  });
});

describe('R1 monthlyIncome', () => {
  it('sums only income transactions in the given month', () => {
    const txs = [
      { type: 'income', amount: 50000, date: '2026-08-01' },
      { type: 'income', amount: 2000,  date: '2026-08-10' },
      { type: 'expense', amount: 9999, date: '2026-08-05' },
      { type: 'income', amount: 8000,  date: '2026-07-30' },  // wrong month
      { type: 'transfer', amount: 5000, date: '2026-08-15' }, // R4: not income
    ];
    expect(monthlyIncome(txs, 2026, 8)).toBe(52000);
  });

  it('returns 0 when no income in the month', () => {
    expect(monthlyIncome([], 2026, 8)).toBe(0);
    expect(monthlyIncome([{ type: 'expense', amount: 100, date: '2026-08-01' }], 2026, 8)).toBe(0);
  });

  it('treats transfers as neither income nor expense (R4)', () => {
    const txs = [
      { type: 'transfer', amount: 5000, date: '2026-08-15' },
    ];
    expect(monthlyIncome(txs, 2026, 8)).toBe(0);
    expect(monthlyExpenses(txs, 2026, 8)).toBe(0);
  });
});

describe('R2 monthlyExpenses', () => {
  it('sums only expense transactions in the given month', () => {
    const txs = [
      { type: 'expense', amount: 1200, date: '2026-08-03' },
      { type: 'expense', amount: 4500, date: '2026-08-12' },
      { type: 'expense', amount: 9999, date: '2026-07-12' }, // wrong month
      { type: 'income',  amount: 50000, date: '2026-08-01' },
    ];
    expect(monthlyExpenses(txs, 2026, 8)).toBe(5700);
  });
});

describe('sumByType / sumOnAccount', () => {
  it('sumByType filters by multiple types if asked', () => {
    const txs = [
      { type: 'income', amount: 100, date: '2026-08-01' },
      { type: 'expense', amount: 50, date: '2026-08-02' },
    ];
    expect(sumByType(txs, ['income', 'expense'], 2026, 8)).toBe(150);
    expect(sumByType(txs, ['transfer'], 2026, 8)).toBe(0);
  });

  it('sumOnAccount ignores transfers (use accountBalance for those)', () => {
    const txs = [
      { type: 'income', amount: 100, accountId: 'a1', date: '2026-08-01' },
      { type: 'transfer', amount: 50, fromAccountId: 'a1', toAccountId: 'a2', date: '2026-08-02' },
    ];
    expect(sumOnAccount(txs, 'a1', 'income')).toBe(100);
    expect(sumOnAccount(txs, 'a1', 'transfer')).toBe(0);
  });
});

describe('R3 accountBalance', () => {
  it('returns opening balance when there are no transactions', () => {
    const acc = { id: 'a1', openingBalance: 5000 };
    expect(accountBalance(acc, [])).toBe(5000);
  });

  it('adds income, subtracts expense', () => {
    const acc = { id: 'a1', openingBalance: 5000 };
    const txs = [
      { type: 'income',  amount: 2000, accountId: 'a1', date: '2026-08-01' },
      { type: 'expense', amount: 500,  accountId: 'a1', date: '2026-08-02' },
    ];
    expect(accountBalance(acc, txs)).toBe(6500);
  });

  it('transfers move money between accounts, totals unchanged in aggregate', () => {
    const a1 = { id: 'a1', openingBalance: 1000 };
    const a2 = { id: 'a2', openingBalance: 1000 };
    const txs = [
      { type: 'transfer', amount: 300, fromAccountId: 'a1', toAccountId: 'a2', date: '2026-08-05' },
    ];
    expect(accountBalance(a1, txs)).toBe(700);
    expect(accountBalance(a2, txs)).toBe(1300);
    expect(accountBalance(a1, txs) + accountBalance(a2, txs)).toBe(2000);
  });

  it('handles transactions on other accounts without touching this one', () => {
    const acc = { id: 'a1', openingBalance: 1000 };
    const txs = [
      { type: 'expense', amount: 999, accountId: 'a2', date: '2026-08-01' },
    ];
    expect(accountBalance(acc, txs)).toBe(1000);
  });

  it('treats missing openingBalance as 0', () => {
    expect(accountBalance({ id: 'a1' }, [])).toBe(0);
  });
});

describe('R5 goalRequiredPerMonth', () => {
  const goal = { target: 60000, saved: 12000, targetDate: '2027-08-13' }; // 12 months out

  it('divides remaining by months left', () => {
    // (60000 - 12000) / 12 = 4000
    expect(goalRequiredPerMonth(goal, goal.saved, NOW)).toBe(4000);
  });

  it('returns 0 when goal is fully funded', () => {
    expect(goalRequiredPerMonth({ ...goal, saved: 60000 }, 60000, NOW)).toBe(0);
    expect(goalRequiredPerMonth({ ...goal, saved: 80000 }, 80000, NOW)).toBe(0);
  });

  it('returns Infinity when months left is 0 or negative (target passed)', () => {
    const past = { ...goal, targetDate: '2026-07-01' };
    expect(goalRequiredPerMonth(past, 0, NOW)).toBe(Infinity);
  });

  it('floors partial months', () => {
    // target = 2027-07-20, now = 2026-08-13 → 11 months
    const g = { ...goal, targetDate: '2027-07-20' };
    expect(goalRequiredPerMonth(g, goal.saved, NOW)).toBe((60000 - 12000) / 11);
  });
});

describe('goal states', () => {
  it('isGoalCompleted is true when saved >= target', () => {
    expect(isGoalCompleted({ target: 1000, saved: 999 }, 999)).toBe(false);
    expect(isGoalCompleted({ target: 1000, saved: 1000 }, 1000)).toBe(true);
    expect(isGoalCompleted({ target: 1000, saved: 1500 }, 1500)).toBe(true);
  });

  it('isGoalExpired compares against today', () => {
    expect(isGoalExpired({ targetDate: '2026-08-12' }, NOW)).toBe(true);
    expect(isGoalExpired({ targetDate: '2026-08-13' }, NOW)).toBe(false);
    expect(isGoalExpired({ targetDate: '2026-08-14' }, NOW)).toBe(false);
  });
});

describe('R7 debtPaidSoFar', () => {
  const debt = { id: 'd1', direction: 'i_owe' };
  const debtOwedToMe = { id: 'd2', direction: 'owed_to_me' };

  it('i_owe sums linked expense transactions', () => {
    const txs = [
      { type: 'expense', amount: 5000, linkedDebtId: 'd1' },
      { type: 'expense', amount: 3000, linkedDebtId: 'd1' },
      { type: 'expense', amount: 9999, linkedDebtId: 'OTHER' }, // not this debt
      { type: 'income',  amount: 200,  linkedDebtId: 'd1' },   // wrong type for i_owe
    ];
    expect(debtPaidSoFar(debt, txs)).toBe(8000);
  });

  it('owed_to_me sums linked income transactions', () => {
    const txs = [
      { type: 'income',  amount: 2000, linkedDebtId: 'd2' },
      { type: 'expense', amount: 9999, linkedDebtId: 'd2' }, // wrong type
    ];
    expect(debtPaidSoFar(debtOwedToMe, txs)).toBe(2000);
  });

  it('returns 0 when no linked transactions exist', () => {
    expect(debtPaidSoFar(debt, [])).toBe(0);
    expect(debtPaidSoFar(debt, [{ type: 'expense', amount: 100 }])).toBe(0);
  });
});

describe('R8 isDebtCompleted', () => {
  it('true when paidSoFar >= total', () => {
    const debt = { id: 'd1', direction: 'i_owe', total: 10000 };
    const txs = [{ type: 'expense', amount: 10000, linkedDebtId: 'd1' }];
    expect(isDebtCompleted(debt, txs)).toBe(true);
  });

  it('true when paidSoFar exceeds total', () => {
    const debt = { id: 'd1', direction: 'i_owe', total: 10000 };
    const txs = [{ type: 'expense', amount: 12000, linkedDebtId: 'd1' }];
    expect(isDebtCompleted(debt, txs)).toBe(true);
  });

  it('false when paidSoFar < total', () => {
    const debt = { id: 'd1', direction: 'i_owe', total: 10000 };
    const txs = [{ type: 'expense', amount: 9999, linkedDebtId: 'd1' }];
    expect(isDebtCompleted(debt, txs)).toBe(false);
  });
});

describe('R9 investmentMaturityValue', () => {
  it('1-year 9% FDR on 100,000 → 109,000', () => {
    expect(investmentMaturityValue({
      principal: 100000, rate: 9, termMonths: 12,
    })).toBeCloseTo(109000, 2);
  });

  it('half-year 6% on 50,000 → 51,500', () => {
    expect(investmentMaturityValue({
      principal: 50000, rate: 6, termMonths: 6,
    })).toBeCloseTo(51500, 2);
  });

  it('3-year 8% on 100,000 → 124,000', () => {
    expect(investmentMaturityValue({
      principal: 100000, rate: 8, termMonths: 36,
    })).toBeCloseTo(124000, 2);
  });

  it('zero rate or zero principal → principal returned', () => {
    expect(investmentMaturityValue({ principal: 100000, rate: 0, termMonths: 12 })).toBe(100000);
    expect(investmentMaturityValue({ principal: 0, rate: 9, termMonths: 12 })).toBe(0);
  });

  it('handles fractional rates', () => {
    expect(investmentMaturityValue({
      principal: 100000, rate: 7.5, termMonths: 12,
    })).toBeCloseTo(107500, 2);
  });
});

describe('investmentMaturityDate', () => {
  it('adds term months to start date', () => {
    const d = investmentMaturityDate({
      startDate: '2026-08-13', termMonths: 12,
    });
    expect(d.toISOString().slice(0, 10)).toBe('2027-08-13');
  });

  it('handles month-end rollovers (Jan 31 + 1 month = Feb 28/29)', () => {
    const d = investmentMaturityDate({
      startDate: '2026-01-31', termMonths: 1,
    });
    // JS Date.setUTCMonth handles this by clamping to Feb 28 in a non-leap year
    // and Feb 29 in a leap year. 2026 is not a leap year.
    expect(d.toISOString().slice(0, 10)).toBe('2026-02-28');
  });

  it('multi-year terms', () => {
    const d = investmentMaturityDate({
      startDate: '2025-06-15', termMonths: 36,
    });
    expect(d.toISOString().slice(0, 10)).toBe('2028-06-15');
  });
});

describe('R10 deriveInvestmentStatus', () => {
  const active = { startDate: '2026-08-13', termMonths: 12, status: 'active' };

  it('stays active before maturity date', () => {
    // now = start of term, 6 months in
    expect(deriveInvestmentStatus(active, '2027-02-13')).toBe('active');
  });

  it('flips to matured on the maturity date', () => {
    expect(deriveInvestmentStatus(active, '2027-08-13')).toBe('matured');
  });

  it('stays matured after the maturity date', () => {
    expect(deriveInvestmentStatus(active, '2028-01-01')).toBe('matured');
  });

  it('preserves closed status (sticky)', () => {
    const closed = { ...active, status: 'closed' };
    expect(deriveInvestmentStatus(closed, '2026-08-13')).toBe('closed');
    expect(deriveInvestmentStatus(closed, '2030-01-01')).toBe('closed');
  });

  it('preserves rolled_over status (sticky)', () => {
    const rolled = { ...active, status: 'rolled_over' };
    expect(deriveInvestmentStatus(rolled, '2030-01-01')).toBe('rolled_over');
  });

  it('does not demote matured → active', () => {
    const matured = { ...active, status: 'matured' };
    expect(deriveInvestmentStatus(matured, '2026-08-13')).toBe('matured');
  });
});

describe('daysToMaturity', () => {
  it('positive when in the future', () => {
    const inv = { startDate: '2026-08-13', termMonths: 12 };
    expect(daysToMaturity(inv, NOW)).toBe(365);
  });

  it('zero on the maturity date', () => {
    const inv = { startDate: '2026-08-13', termMonths: 12 };
    expect(daysToMaturity(inv, '2027-08-13')).toBe(0);
  });

  it('negative when past', () => {
    const inv = { startDate: '2026-08-13', termMonths: 12 };
    expect(daysToMaturity(inv, '2027-08-20')).toBe(-7);
  });
});
