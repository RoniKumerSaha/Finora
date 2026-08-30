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
  investmentMaturityValueFromDays,
  investmentMaturityDate,
  deriveInvestmentStatus,
  daysToMaturity,
  goalSaved,
  goalProgress,
  dpsMaturityValue,
  dpsContributedSoFar,
  dpsPaidOutSoFar,
  dpsCurrentValue,
  investmentMaturityValueTyped,
  investmentValue,
  computeNetWorth,
  averageMonthlyExpenses,
} from './math';
import type { Account, Debt, Goal, Investment, Transaction } from './types';

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
    const goal: Goal = { id: 'g1', name: 'g', target: 12000, saved: 0, contributions: [], targetDate: '2027-02-13', createdAt: NOW };
    // 6 months left from 2026-08-13.
    expect(goalRequiredPerMonth(goal, 0, NOW)).toBe(2000);
  });
  it('returns 0 when goal is met', () => {
    const goal: Goal = { id: 'g1', name: 'g', target: 100, saved: 100, contributions: [], targetDate: '2099-01-01', createdAt: NOW };
    expect(goalRequiredPerMonth(goal, 100, NOW)).toBe(0);
  });
  it('returns Infinity when expired', () => {
    const goal: Goal = { id: 'g1', name: 'g', target: 1000, saved: 0, contributions: [], targetDate: '2026-01-01', createdAt: NOW };
    expect(goalRequiredPerMonth(goal, 0, NOW)).toBe(Infinity);
  });
  it('isGoalCompleted + isGoalExpired', () => {
    const g: Goal = { id: 'g1', name: 'g', target: 100, saved: 50, contributions: [], targetDate: '2099-01-01', createdAt: NOW };
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

// ---------- R6 — goal saved (stored, but plan-only) ----------

describe('R6 — goal saved (stored on goal.contributions)', () => {
  const goal: Goal = {
    id: 'g1', name: 'g', target: 1000, saved: 350, contributions: [
      { id: 'c1', amount: 100, date: '2026-08-01' },
      { id: 'c2', amount: 250, date: '2026-08-02' },
    ], targetDate: '2099-01-01', createdAt: NOW,
  };
  it('goalSaved reads the stored total, not transaction aggregates', () => {
    // Even with stray txns around, no derivation happens — goals are
    // plan-only and don't read from transactions.
    expect(goalSaved(goal)).toBe(350);
  });
  it('zero when saved is 0', () => {
    const empty: Goal = { ...goal, saved: 0, contributions: [] };
    expect(goalSaved(empty)).toBe(0);
  });
  it('goalProgress caps at 1.0', () => {
    const overFunded: Goal = { ...goal, saved: 9999, target: 1000 };
    expect(goalProgress(overFunded)).toBe(1);
  });
  it('goalRequiredPerMonth uses the supplied saved value', () => {
    // Goal with targetDate ~6 months out from 2026-08-13:
    //   targetDate = 2027-02-13, target = 1200, saved = 200
    //   remaining = 1000, months left = 6
    //   → 1000 / 6 ≈ 166.67 / month
    const g: Goal = {
      id: 'g2', name: 'g', target: 1200, saved: 200,
      contributions: [], targetDate: '2027-02-13', createdAt: NOW,
    };
    expect(goalRequiredPerMonth(g, g.saved, NOW)).toBeCloseTo(1000 / 6, 5);
  });
});

// ---------- R9-DPS — annuity-due maturity ----------

describe('R9-DPS — DPS maturity value (annuity-due)', () => {
  const dps = (over: Partial<Investment>): Investment => ({
    id: 'd1', name: 'DPS', type: 'dps', principal: 0,
    monthlyContribution: 5000, rate: 8, startDate: '2026-01-01',
    termMonths: 12, status: 'active', createdAt: NOW,
    ...over,
  });

  it('returns 0 when monthlyContribution is missing', () => {
    expect(dpsMaturityValue(dps({ monthlyContribution: undefined }))).toBe(0);
  });
  it('returns 0 for non-DPS types', () => {
    expect(dpsMaturityValue(dps({ type: 'fdr', monthlyContribution: 5000 }))).toBe(0);
  });
  it('zero rate: straight sum of contributions', () => {
    expect(dpsMaturityValue(dps({ rate: 0, monthlyContribution: 5000, termMonths: 12 }))).toBe(60000);
  });
  it('annuity-due at 8% / 12 months ≈ 62,664', () => {
    // M=5000, r=8/100/12, T=12
    // FV = M * ((1+r)^T - 1) / r * (1+r)
    // Spot-check: 5000 * ((1.0066667^12 - 1) / 0.0066667) * 1.0066667
    //   ≈ 5000 * 12.44993 * 1.0066667
    //   ≈ 62,664
    const v = dpsMaturityValue(dps({ monthlyContribution: 5000, rate: 8, termMonths: 12 }));
    expect(v).toBeGreaterThan(62000);
    expect(v).toBeLessThan(63200);
  });
  it('matures larger than total contributions at any positive rate', () => {
    const v = dpsMaturityValue(dps({ monthlyContribution: 5000, rate: 8, termMonths: 12 }));
    expect(v).toBeGreaterThan(60000);  // > pure sum
  });
  it('larger rate → larger maturity', () => {
    const low = dpsMaturityValue(dps({ rate: 5 }));
    const high = dpsMaturityValue(dps({ rate: 12 }));
    expect(high).toBeGreaterThan(low);
  });
});

// ---------- DPS contributions + current value ----------

describe('DPS — contributions aggregated from transactions', () => {
  const inv: Investment = {
    id: 'd1', name: 'DPS', type: 'dps', principal: 0,
    monthlyContribution: 5000, rate: 8, startDate: '2026-01-01',
    termMonths: 12, status: 'active', createdAt: '2026-01-01',
  };

  it('dpsContributedSoFar sums linked expense txns only', () => {
    const txs: Transaction[] = [
      tx({ type: 'expense', amount: 5000, linkedInvestmentId: 'd1', date: '2026-02-01' }),
      tx({ type: 'expense', amount: 5000, linkedInvestmentId: 'd1', date: '2026-03-01' }),
      tx({ type: 'income',  amount: 5000, linkedInvestmentId: 'd1', date: '2026-04-01' }), // ignored
      tx({ type: 'expense', amount: 5000, linkedInvestmentId: 'd2', date: '2026-02-01' }), // other
    ];
    expect(dpsContributedSoFar(inv, txs)).toBe(10000);
  });

  it('dpsPaidOutSoFar sums linked income txns only (mirror)', () => {
    const txs: Transaction[] = [
      tx({ type: 'income',  amount: 30000, linkedInvestmentId: 'd1', date: '2026-08-01' }),
      tx({ type: 'income',  amount: 12000, linkedInvestmentId: 'd1', date: '2026-09-01' }),
      tx({ type: 'expense', amount: 5000,  linkedInvestmentId: 'd1', date: '2026-02-01' }), // ignored
      tx({ type: 'income',  amount: 9999,  linkedInvestmentId: 'd2', date: '2026-08-01' }), // other
    ];
    expect(dpsPaidOutSoFar(inv, txs)).toBe(42000);
  });

  it('dpsPaidOutSoFar returns 0 when no payouts', () => {
    expect(dpsPaidOutSoFar(inv, [])).toBe(0);
  });

  it('dpsCurrentValue compounds each contribution to today', () => {
    // Two contributions: 5000 paid 6 months ago, 5000 paid 3 months ago.
    // r = 8/100/12 ≈ 0.0066667
    // value = 5000*(1+r)^6 + 5000*(1+r)^3
    //   ≈ 5000*1.04067 + 5000*1.02013
    //   ≈ 5203.4 + 5100.6
    //   ≈ 10,304
    const txs: Transaction[] = [
      tx({ type: 'expense', amount: 5000, linkedInvestmentId: 'd1', date: '2026-02-13' }),
      tx({ type: 'expense', amount: 5000, linkedInvestmentId: 'd1', date: '2026-05-13' }),
    ];
    const v = dpsCurrentValue(inv, txs, NOW);
    expect(v).toBeGreaterThan(10300);
    expect(v).toBeLessThan(10400);
  });

  it('dpsCurrentValue excludes future-dated contributions', () => {
    const txs = [tx({ type: 'expense', amount: 5000, linkedInvestmentId: 'd1', date: '2099-01-01' })];
    expect(dpsCurrentValue(inv, txs, NOW)).toBe(0);
  });

  it('dpsContribution embeddings with future date are not compounded', () => {
    // Negative monthsBetween → skipped
    const txs = [tx({ type: 'expense', amount: 5000, linkedInvestmentId: 'd1', date: '2027-01-01' })];
    expect(dpsCurrentValue(inv, txs, NOW)).toBe(0);
  });
});

describe('investmentMaturityValueTyped — type-aware dispatch', () => {
  it('routes DPS to annuity-due', () => {
    const dps: Investment = {
      id: 'd1', name: 'DPS', type: 'dps', principal: 0,
      monthlyContribution: 5000, rate: 8, startDate: '2026-01-01',
      termMonths: 12, status: 'active', createdAt: NOW,
    };
    expect(investmentMaturityValueTyped(dps)).toBe(dpsMaturityValue(dps));
    expect(investmentMaturityValueTyped(dps)).toBeGreaterThan(60000);
  });
  it('routes FDR to simple-interest (R9)', () => {
    const fdr: Investment = {
      id: 'f1', name: 'FDR', type: 'fdr', principal: 100000,
      rate: 8, startDate: '2026-01-01', termMonths: 12,
      status: 'active', createdAt: NOW,
    };
    expect(investmentMaturityValueTyped(fdr)).toBe(108000);
  });
});

// ---------- Days-based FDR maturity (short-term deposits) ----------

describe('investmentMaturityValueFromDays — days-based FDR formula', () => {
  const fdrDays = (over: Partial<Investment>): Investment => ({
    id: 'f1', name: 'FDR', type: 'fdr', principal: 100000,
    rate: 9, startDate: '2026-08-01', termMonths: 0, termDays: 30,
    status: 'active', createdAt: NOW,
    ...over,
  });

  it('principal × (1 + rate/100 × days/365)', () => {
    // 100000 × (1 + 9/100 × 30/365) ≈ 100739.73
    expect(investmentMaturityValueFromDays(fdrDays({}))).toBeCloseTo(100739.7260, 2);
  });
  it('zero rate → straight principal', () => {
    expect(investmentMaturityValueFromDays(fdrDays({ rate: 0, termDays: 15 }))).toBe(100000);
  });
  it('365-day term should match a 12-month term at the same rate', () => {
    // 365/365 = 1, so it's equivalent to a full year at that rate.
    const days = investmentMaturityValueFromDays(fdrDays({ termDays: 365, rate: 8 }));
    const months = investmentMaturityValue({
      ...fdrDays({ rate: 8, termDays: undefined }),
      termMonths: 12,
    });
    expect(days).toBeCloseTo(months, 4);
  });
  it('returns 0 when termDays is missing or zero', () => {
    expect(investmentMaturityValueFromDays(fdrDays({ termDays: undefined }))).toBe(0);
    expect(investmentMaturityValueFromDays(fdrDays({ termDays: 0 }))).toBe(0);
  });
  it('returns 0 for non-positive principal', () => {
    expect(investmentMaturityValueFromDays(fdrDays({ principal: 0 }))).toBe(0);
  });
  it('larger days → larger maturity at positive rate', () => {
    const short = investmentMaturityValueFromDays(fdrDays({ termDays: 7 }));
    const long = investmentMaturityValueFromDays(fdrDays({ termDays: 60 }));
    expect(long).toBeGreaterThan(short);
  });
});

describe('investmentMaturityDate — dispatches on termDays', () => {
  const base: Investment = {
    id: 'f1', name: 'FDR', type: 'fdr', principal: 100000,
    rate: 9, startDate: '2026-01-15', termMonths: 12,
    status: 'active', createdAt: '2026-01-15',
  };

  it('uses termDays when set, ignoring termMonths', () => {
    const d = investmentMaturityDate({ ...base, termMonths: 99, termDays: 10 });
    expect(d?.toISOString().slice(0, 10)).toBe('2026-01-25');
  });
  it('falls back to termMonths when termDays is missing or zero', () => {
    const a = investmentMaturityDate(base);
    const b = investmentMaturityDate({ ...base, termDays: 0 });
    expect(a?.toISOString().slice(0, 10)).toBe('2027-01-15');
    expect(b?.toISOString().slice(0, 10)).toBe('2027-01-15');
  });
  it('crosses months correctly with days', () => {
    const d = investmentMaturityDate({ ...base, startDate: '2026-01-25', termDays: 10 });
    expect(d?.toISOString().slice(0, 10)).toBe('2026-02-04');
  });
});

describe('investmentMaturityValueTyped — routes FDR/savings to days formula when termDays set', () => {
  it('uses days-based formula when termDays > 0', () => {
    const fdr: Investment = {
      id: 'f1', name: 'FDR', type: 'fdr', principal: 100000,
      rate: 9, startDate: '2026-08-01', termMonths: 0, termDays: 30,
      status: 'active', createdAt: NOW,
    };
    expect(investmentMaturityValueTyped(fdr))
      .toBeCloseTo(investmentMaturityValueFromDays(fdr), 6);
  });
  it('still uses months formula when termDays missing', () => {
    const fdr: Investment = {
      id: 'f1', name: 'FDR', type: 'fdr', principal: 100000,
      rate: 8, startDate: '2026-01-01', termMonths: 12,
      status: 'active', createdAt: NOW,
    };
    expect(investmentMaturityValueTyped(fdr)).toBe(108000);
  });
  it('savings type also dispatches on termDays', () => {
    const sav: Investment = {
      id: 's1', name: 'Savings', type: 'savings', principal: 50000,
      rate: 7, startDate: '2026-08-01', termMonths: 0, termDays: 90,
      status: 'active', createdAt: NOW,
    };
    expect(investmentMaturityValueTyped(sav))
      .toBeCloseTo(investmentMaturityValueFromDays(sav), 6);
  });
});

describe('daysToMaturity — works for termDays investments', () => {
  it('counts calendar days from today to startDate + termDays', () => {
    const fdr: Investment = {
      id: 'f1', name: 'FDR', type: 'fdr', principal: 100000,
      rate: 9, startDate: '2026-08-01', termMonths: 0, termDays: 30,
      status: 'active', createdAt: '2026-08-01',
    };
    // NOW = 2026-08-13, so 30 - 12 = 18 days remaining.
    expect(daysToMaturity(fdr, NOW)).toBe(18);
  });
});

// ---------- 2026-08-17: DPS dual-value (current vs projected) ----------
// User-reported bug: a DPS with only one paid installment used to
// show its full mature amount as the headline. The tests below pin
// down the new behaviour: current value is what's compounded-to-today,
// projected value is the full mature amount.

describe('investmentValue — DPS returns current (compounded to today) + projected (full mature)', () => {
  const dps: Investment = {
    id: 'd1', name: 'DPS', type: 'dps', principal: 0,
    monthlyContribution: 5000, rate: 8, startDate: '2026-01-01',
    termMonths: 12, status: 'active', createdAt: '2026-01-01',
  };

  it('with NO contributions, currentValue is 0 but projected is the full mature amount', () => {
    const txs: Transaction[] = [];
    const v = investmentValue(dps, txs, NOW);
    expect(v.currentValue).toBe(0);
    expect(v.projectedValue).toBeGreaterThan(60000); // full annuity-due at 8%
    expect(v.projectedValue).toBeLessThan(63200);
  });

  it('with ONE contribution, current tracks that contribution; projected stays full', () => {
    // The user-paid-so-far complaint: "I only paid 1 installment,
    // but net worth shows the mature amount." This is the regression
    // guard — current MUST be much smaller than projected.
    const txs: Transaction[] = [
      tx({ type: 'expense', amount: 5000, linkedInvestmentId: 'd1', date: '2026-08-01' }),
    ];
    const v = investmentValue(dps, txs, NOW);
    expect(v.currentValue).toBeGreaterThanOrEqual(5000);
    expect(v.currentValue).toBeLessThan(7000); // tiny growth over 0 months
    expect(v.projectedValue).toBeGreaterThan(60000);
    expect(v.currentValue).toBeLessThan(v.projectedValue / 5); // sanity: 1/12 of mature
  });

  it('with all 12 contributions, currentValue is the compounded-to-today total', () => {
    // Each contribution was paid in 2026, and NOW=2026-08-13, so the
    // most-recent contribution (Aug 2026) has compounded ~0 months and
    // the earliest (Jan 2026) has compounded ~7 months. Total compounded
    // is materially less than the projected mature value.
    const txs: Transaction[] = [];
    const months = ['01','02','03','04','05','06','07','08','09','10','11','12'];
    for (const m of months) {
      txs.push(tx({ type: 'expense', amount: 5000, linkedInvestmentId: 'd1', date: `2026-${m}-15` }));
    }
    const v = investmentValue(dps, txs, NOW);
    // All 12 contributions compounded partially. Total > just the
    // raw sum (60000) because some have been earning — but much less
    // than the projected annuity-due value across the full term.
    expect(v.currentValue).toBeGreaterThan(35000);
    expect(v.currentValue).toBeLessThan(50000);
    expect(v.projectedValue).toBeGreaterThan(60000); // full annuity-due
    // Current must be smaller than projected (we haven't matured yet).
    expect(v.currentValue).toBeLessThan(v.projectedValue);
  });

  it('past maturity: current is at least the projected (bank would pay out in full)', () => {
    const maturedDps: Investment = {
      ...dps,
      startDate: '2025-01-01',
      termMonths: 12, // matured 2026-01-01 — well in the past by NOW=2026-08-13
    };
    const txs: Transaction[] = [];
    const months = ['01','02','03','04','05','06','07','08','09','10','11','12'];
    for (const m of months) {
      txs.push(tx({ type: 'expense', amount: 5000, linkedInvestmentId: 'd1', date: `2025-${m}-15` }));
    }
    const v = investmentValue(maturedDps, txs, NOW);
    expect(v.projectedValue).toBeGreaterThan(60000);
    // Past maturity: contributions keep compounding, so current can
    // exceed projected. Either way, current MUST be ≥ projected —
    // the bank would pay out the full mature amount (and more).
    expect(v.currentValue).toBeGreaterThanOrEqual(v.projectedValue);
  });
});

describe('investmentValue — FDR returns principal as current, mature as projected', () => {
  const fdr: Investment = {
    id: 'f1', name: 'FDR', type: 'fdr', principal: 100000,
    rate: 8, startDate: '2026-01-01', termMonths: 12, status: 'active', createdAt: '2026-01-01',
  };
  it('current = principal, projected = maturity value', () => {
    const v = investmentValue(fdr, [], NOW);
    expect(v.currentValue).toBe(100000);
    expect(v.projectedValue).toBe(108000);
  });
});

// ---------- 2026-08-17: computeNetWorth dual-value ----------

describe('computeNetWorth — dual value (current vs projected)', () => {
  it('current uses DPS contributions, projected uses full mature amount', () => {
    const dps: Investment = {
      id: 'd1', name: 'DPS', type: 'dps', principal: 0,
      monthlyContribution: 5000, rate: 8, startDate: '2026-01-01',
      termMonths: 12, status: 'active', createdAt: '2026-01-01',
    };
    // One installment paid → current should be ~5000 (with tiny growth)
    // and projected should be the full ~62000. Net-worth headline must
    // not jump to 62000 just because the user created the DPS.
    const state: any = {
      accounts: [{ id: 'a1', name: 'Cash', type: 'cash', openingBalance: 50000, createdAt: '2026-01-01' }],
      transactions: [
        { id: 't1', type: 'expense', amount: 5000, date: '2026-08-01', accountId: 'a1', linkedInvestmentId: 'd1' } as any,
      ],
      debts: [],
      investments: [dps],
    };
    const { currentNetWorth, projectedNetWorth } = computeNetWorth(state, NOW);
    // Cash balance = opening 50000 − 5000 expense = 45000.
    // Current investment = ~5000 (just paid, ~0 months compound).
    // Current net worth = 50000.
    expect(currentNetWorth).toBeGreaterThanOrEqual(49500);
    expect(currentNetWorth).toBeLessThanOrEqual(50500);
    // Projected net worth = 45000 cash + 62000 mature DPS = ~107000.
    expect(projectedNetWorth).toBeGreaterThan(105000);
    expect(projectedNetWorth).toBeLessThan(110000);
    // Critical: projected MUST be larger than current by at least
    // 50,000 — that's the bug we just fixed.
    expect(projectedNetWorth - currentNetWorth).toBeGreaterThan(50000);
  });

  it('FDR principal counts as both current and adds interest to projected', () => {
    const fdr: Investment = {
      id: 'f1', name: 'FDR', type: 'fdr', principal: 100000,
      rate: 8, startDate: '2026-01-01', termMonths: 12, status: 'active', createdAt: '2026-01-01',
    };
    const state: any = {
      accounts: [{ id: 'a1', name: 'Cash', type: 'cash', openingBalance: 200000, createdAt: '2026-01-01' }],
      transactions: [
        { id: 't1', type: 'expense', amount: 100000, date: '2026-01-01', accountId: 'a1', linkedInvestmentId: 'f1' } as any,
      ],
      debts: [],
      investments: [fdr],
    };
    const { currentNetWorth, projectedNetWorth } = computeNetWorth(state, NOW);
    // Cash: 200000 - 100000 (expense) = 100000. Investments: 100000.
    // Current NW = 200000.
    expect(currentNetWorth).toBe(200000);
    // Projected NW: cash 100000 + matured FDR 108000 = 208000.
    expect(projectedNetWorth).toBe(208000);
  });
});

// ---------- 2026-08-30: averageMonthlyExpenses (Loan affordability) ----------

describe('averageMonthlyExpenses — last N complete months', () => {
  // NOW = 2026-08-13. The function reads the *current* UTC month as
  // August 2026 and walks back 1, 2, 3 months from there (July, June,
  // May 2026). The current month (August) is excluded.

  it('returns null when there is no expense history at all', () => {
    expect(averageMonthlyExpenses([], { now: NOW })).toBeNull();
  });

  it('returns null when one of the N months has zero expenses (no real signal)', () => {
    // Three months of history but May is empty → can't trust the mean.
    const txs: Transaction[] = [
      tx({ type: 'expense', amount: 1000, date: '2026-05-15' }), // empty after
      tx({ type: 'expense', amount: 2000, date: '2026-07-10' }),
      tx({ type: 'expense', amount: 1500, date: '2026-08-10' }), // current month — ignored
    ];
    expect(averageMonthlyExpenses(txs, { now: NOW })).toBeNull();
  });

  it('averages the last 3 complete months when every month has data', () => {
    // May: 1000, June: 3000, July: 2000 → mean = 2000.
    // August is the current month and gets ignored.
    const txs: Transaction[] = [
      tx({ type: 'expense', amount: 1000, date: '2026-05-15' }),
      tx({ type: 'expense', amount: 3000, date: '2026-06-15' }),
      tx({ type: 'expense', amount: 2000, date: '2026-07-15' }),
      tx({ type: 'expense', amount: 9999, date: '2026-08-10' }), // current — should be excluded
    ];
    expect(averageMonthlyExpenses(txs, { now: NOW })).toBe(2000);
  });

  it('respects a custom months=N', () => {
    // 1 complete month back = July. Mean = 2000.
    const txs: Transaction[] = [
      tx({ type: 'expense', amount: 2000, date: '2026-07-15' }),
    ];
    expect(averageMonthlyExpenses(txs, { now: NOW, months: 1 })).toBe(2000);
  });

  it('crosses a year boundary correctly (Dec → Jan wrap)', () => {
    // NOW = 2026-01-15 → walks back to Dec 2025, Nov 2025, Oct 2025.
    const winter = '2026-01-15';
    const txs: Transaction[] = [
      tx({ type: 'expense', amount: 500, date: '2025-12-10' }),
      tx({ type: 'expense', amount: 700, date: '2025-11-10' }),
      tx({ type: 'expense', amount: 300, date: '2025-10-10' }),
    ];
    expect(averageMonthlyExpenses(txs, { now: winter, months: 3 })).toBe(500);
  });

  it('ignores income and transfer transactions', () => {
    const txs: Transaction[] = [
      tx({ type: 'expense', amount: 2000, date: '2026-05-15' }),
      tx({ type: 'expense', amount: 2000, date: '2026-06-15' }),
      tx({ type: 'expense', amount: 2000, date: '2026-07-15' }),
      tx({ type: 'income', amount: 99999, date: '2026-07-15' }),
      tx({ type: 'transfer', amount: 99999, date: '2026-07-15' }),
    ];
    expect(averageMonthlyExpenses(txs, { now: NOW })).toBe(2000);
  });
});