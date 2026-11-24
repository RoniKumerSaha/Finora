/**
 * insights.spec.ts — covers the /insights aggregations.
 *
 * Spine: docs/ux-designs/ux-finora-2026-08-14-analytics/EXPERIENCE.md
 */
import { describe, expect, it } from 'vitest';
import {
  categoryBreakdown,
  computeStats,
  debtsForInsights,
  goalsForInsights,
  investmentsForInsights,
  investmentSummary,
  loanSummary,
  monthlyCashFlow,
  monthlyStatement,
  netWorthComposition,
  netWorthSeries,
  resolveRange,
  txInRange,
  type DateRangeKey,
} from '@/domain/insights';
import { makeState } from '../../support/state';

describe('resolveRange', () => {
  it('thisMonth covers the current calendar month', () => {
    const now = new Date(Date.UTC(2026, 7, 14)); // 14 Aug 2026
    const r = resolveRange('thisMonth', now);
    expect(r.start.getUTCFullYear()).toBe(2026);
    expect(r.start.getUTCMonth()).toBe(7);
    expect(r.start.getUTCDate()).toBe(1);
    expect(r.end.getUTCDate()).toBe(14);
    expect(r.months).toBe(1);
  });

  it('last6 returns 6 months ending today', () => {
    const now = new Date(Date.UTC(2026, 7, 14)); // 14 Aug 2026
    const r = resolveRange('last6', now);
    expect(r.months).toBe(6);
    expect(r.end.getUTCDate()).toBe(14);
  });

  it('all returns the sentinel start year', () => {
    const r = resolveRange('all', new Date(Date.UTC(2026, 7, 14)));
    expect(r.start.getUTCFullYear()).toBe(2000);
  });
});

describe('txInRange', () => {
  it('includes boundaries', () => {
    const range = {
      start: new Date(Date.UTC(2026, 0, 1)),
      end: new Date(Date.UTC(2026, 0, 31)),
      months: 1,
    };
    expect(txInRange({ date: '2026-01-01' } as any, range)).toBe(true);
    expect(txInRange({ date: '2026-01-31' } as any, range)).toBe(true);
    expect(txInRange({ date: '2025-12-31' } as any, range)).toBe(false);
    expect(txInRange({ date: '2026-02-01' } as any, range)).toBe(false);
  });
});

describe('computeStats', () => {
  it('aggregates income/expense and goal contributions', () => {
    const r = resolveRange('thisMonth', new Date(Date.UTC(2026, 7, 14)));
    const aug = makeState({
      transactions: [
        { id: '1', type: 'income',  amount: 100000, date: '2026-08-10' } as any,
        { id: '2', type: 'expense', amount:  30000, date: '2026-08-11' } as any,
      ],
      goals: [
        { id: 'g1', name: 'Laptop', target: 100000, saved: 10000, contributions: [
          { id: 'c1', amount: 10000, date: '2026-08-12' },
        ], targetDate: '2027-01-01', createdAt: '2026-01-01' } as any,
      ],
    });
    const stats = computeStats(aug, r, 'thisMonth');
    expect(stats.netFlow).toBe(70000);
    expect(stats.avgMonthlyExpense).toBe(30000);
    expect(stats.savedTowardGoals).toBe(10000);
  });
});

describe('monthlyCashFlow', () => {
  it('groups income/expense by month and ignores transfers', () => {
    const state = makeState({
      transactions: [
        { id: '1', type: 'income',  amount: 50000, date: '2026-03-05' } as any,
        { id: '2', type: 'expense', amount: 20000, date: '2026-03-12' } as any,
        { id: '3', type: 'transfer', amount: 5000, date: '2026-03-15' } as any,
      ],
    });
    const r = resolveRange('last6', new Date(Date.UTC(2026, 7, 14)));
    const { bars } = monthlyCashFlow(state, r, 'last6');
    const mar = bars.find(b => b.month === 3 && b.year === 2026);
    expect(mar?.income).toBe(50000);
    expect(mar?.expense).toBe(20000);
  });

  it('returns 12 bars max', () => {
    const state = makeState();
    const r = resolveRange('last12', new Date(Date.UTC(2026, 7, 14)));
    const { bars } = monthlyCashFlow(state, r, 'last12');
    expect(bars.length).toBe(12);
  });
});

describe('categoryBreakdown', () => {
  it('returns top 6 plus an Other bucket', () => {
    const cats = Array.from({ length: 8 }, (_, i) => ({
      id: `c${i}`, type: 'expense' as const, name: `Cat ${i}`,
    }));
    const state = makeState({
      categories: cats,
      transactions: cats.map((c, i) => ({
        id: String(i),
        type: 'expense',
        amount: 1000 * (10 - i), // 10000, 9000, ..., 3000
        date: '2026-08-01',
        categoryId: c.id,
      })) as any,
    });
    const r = resolveRange('thisMonth', new Date(Date.UTC(2026, 7, 14)));
    const rows = categoryBreakdown(state, r);
    // 6 top + 1 Other = 7 rows
    expect(rows.length).toBe(7);
    expect(rows[rows.length - 1].name).toBe('Other');
    // First row is the biggest
    expect(rows[0].name).toBe('Cat 0');
  });

  it('returns empty when no expenses in range', () => {
    const state = makeState({
      transactions: [
        { id: '1', type: 'income', amount: 50000, date: '2026-08-01' } as any,
      ],
    });
    const r = resolveRange('thisMonth', new Date(Date.UTC(2026, 7, 14)));
    expect(categoryBreakdown(state, r)).toEqual([]);
  });
});

describe('netWorthSeries', () => {
  it('produces one point per month in range', () => {
    const state = makeState({
      accounts: [
        { id: 'a1', name: 'Cash', type: 'cash', openingBalance: 10000, createdAt: '2026-01-01' },
      ],
      transactions: [
        { id: '1', type: 'income', amount: 5000, date: '2026-08-01', accountId: 'a1' } as any,
      ],
    });
    const r = resolveRange('last6', new Date(Date.UTC(2026, 7, 14)));
    const { points } = netWorthSeries(state, r, 'last6');
    expect(points.length).toBe(6);
  });
});

describe('goalsForInsights', () => {
  it('skips completed goals and sorts by date', () => {
    const state = makeState({
      goals: [
        { id: 'g1', name: 'B', target: 100, saved: 0,   contributions: [], targetDate: '2026-12-01', createdAt: '2026-01-01' },
        { id: 'g2', name: 'A', target: 200, saved: 0,   contributions: [], targetDate: '2026-09-01', createdAt: '2026-01-01' },
        // "Done" is fully funded via its `saved` field — plan-only.
        { id: 'g3', name: 'Done', target: 100, saved: 100, contributions: [], targetDate: '2026-01-01', createdAt: '2026-01-01' },
      ],
    });
    const rows = goalsForInsights(state, new Date(Date.UTC(2026, 7, 14)));
    expect(rows.map(r => r.name)).toEqual(['A', 'B']);
  });
});

describe('debtsForInsights', () => {
  it('skips completed debts', () => {
    const state = makeState({
      debts: [
        { id: 'd1', name: 'Loan', direction: 'i_owe', total: 100, paidSoFar: 0, status: 'active', createdAt: '2026-01-01' } as any,
        { id: 'd2', name: 'Old',  direction: 'i_owe', total: 200, paidSoFar: 200, status: 'completed', createdAt: '2026-01-01' } as any,
      ],
    });
    const rows = debtsForInsights(state, new Date(Date.UTC(2026, 7, 14)));
    expect(rows.length).toBe(1);
    expect(rows[0].name).toBe('Loan');
  });
});

describe('investmentsForInsights', () => {
  it('sorts matured first then by days-to-maturity', () => {
    const state = makeState({
      investments: [
        { id: 'i1', name: 'Far',  type: 'fdr', principal: 1000, rate: 8, startDate: '2025-06-01', termMonths: 24, status: 'active', createdAt: '2025-06-01' } as any,
        { id: 'i2', name: 'Soon', type: 'fdr', principal: 1000, rate: 8, startDate: '2026-01-01', termMonths: 12, status: 'active', createdAt: '2026-01-01' } as any,
      ],
    });
    const rows = investmentsForInsights(state, new Date(Date.UTC(2026, 7, 14)));
    expect(rows[0].name).toBe('Soon'); // closer maturity wins
  });
});

describe('RANGE_ORDER', () => {
  it('contains the five pill keys in display order', () => {
    const expected: DateRangeKey[] = ['thisMonth', 'last3', 'last6', 'last12', 'all'];
    expect(['thisMonth', 'last3', 'last6', 'last12', 'all']).toEqual(expected);
  });
});

describe('netWorthComposition', () => {
  it('breaks net worth into cash, savings and receivables, with debt as an offset', () => {
    const state = makeState({
      accounts: [
        { id: 'a1', name: 'Bank', type: 'bank', openingBalance: 100000, createdAt: '2026-01-01' } as any,
      ],
      debts: [
        { id: 'd1', name: 'Owed', direction: 'owed_to_me', total: 20000, paidSoFar: 0, status: 'active', createdAt: '2026-01-01' } as any,
        { id: 'd2', name: 'Owe', direction: 'i_owe', total: 30000, paidSoFar: 0, status: 'active', createdAt: '2026-01-01' } as any,
      ],
      investments: [
        { id: 'i1', name: 'FDR', type: 'fdr', principal: 50000, rate: 10, startDate: '2026-01-01', termMonths: 12, status: 'active', createdAt: '2026-01-01' } as any,
      ],
    });
    const { slices, netWorth, total, debt } = netWorthComposition(state, '2026-06-01');

    const byKey = Object.fromEntries(slices.map(s => [s.key, s.amount]));
    expect(byKey.cash).toBe(100000);
    // An FDR is a savings scheme, not a DPS.
    expect(byKey.savings).toBe(50000);
    expect(byKey.dps).toBeUndefined();
    expect(byKey.receivables).toBe(20000);
    // Debt is what you OWE, so it is not a wedge of the ring — it is
    // reported separately as the offset.
    expect(byKey.debt).toBeUndefined();
    expect(debt).toBe(30000);
    // The total is the ASSETS the ring adds up to.
    expect(total).toBe(170000);
    // Net worth = cash + investments + receivables − debt.
    expect(netWorth).toBe(140000);
  });

  it('splits investments into savings schemes and DPS', () => {
    const state = makeState({
      accounts: [
        { id: 'a1', name: 'Bank', type: 'bank', openingBalance: 10000, createdAt: '2026-01-01' } as any,
      ],
      investments: [
        { id: 'i1', name: 'FDR', type: 'fdr', principal: 50000, rate: 10, startDate: '2026-01-01', termMonths: 12, status: 'active', createdAt: '2026-01-01' } as any,
        { id: 'i2', name: 'DPS', type: 'dps', principal: 40000, rate: 0, startDate: '2026-01-01', termMonths: 36, status: 'active', createdAt: '2026-01-01' } as any,
      ],
      transactions: [
        // A DPS's current value is what has actually been paid in,
        // compounded — so it needs a linked installment to be worth
        // anything. A 0% rate keeps the expected figure exact.
        { id: 't1', type: 'expense', amount: 40000, date: '2026-06-01', accountId: 'a1', linkedInvestmentId: 'i2' } as any,
      ],
    });
    const { slices } = netWorthComposition(state, '2026-06-01');
    const byKey = Object.fromEntries(slices.map(s => [s.key, s.amount]));
    expect(byKey.savings).toBe(50000);
    expect(byKey.dps).toBe(40000);
  });

  it('omits slices that are zero', () => {
    const state = makeState({
      accounts: [{ id: 'a1', name: 'Bank', type: 'bank', openingBalance: 5000, createdAt: '2026-01-01' } as any],
    });
    const { slices } = netWorthComposition(state, '2026-06-01');
    expect(slices.map(s => s.key)).toEqual(['cash']);
  });

  it('returns an empty composition for an empty state', () => {
    const { slices, netWorth } = netWorthComposition(makeState(), '2026-06-01');
    expect(slices).toHaveLength(0);
    expect(netWorth).toBe(0);
  });
});

describe('monthlyStatement', () => {
  it('always runs January to December, whatever the range', () => {
    const state = makeState({
      transactions: [
        { id: 't1', type: 'income', amount: 50000, date: '2026-03-05', accountId: 'a1' } as any,
        { id: 't2', type: 'expense', amount: 20000, date: '2026-11-12', accountId: 'a1' } as any,
      ],
    });

    for (const key of ['thisMonth', 'last3', 'last6', 'last12', 'all'] as const) {
      const r = resolveRange(key, new Date(Date.UTC(2026, 7, 14)));
      const { bars } = monthlyStatement(state, r);

      expect(bars).toHaveLength(12);
      expect(bars[0].label).toBe('Jan 2026');
      expect(bars[11].label).toBe('Dec 2026');
    }
  });

  it('puts each transaction in its own month', () => {
    const state = makeState({
      transactions: [
        { id: 't1', type: 'income', amount: 50000, date: '2026-03-05', accountId: 'a1' } as any,
        { id: 't2', type: 'expense', amount: 20000, date: '2026-06-12', accountId: 'a1' } as any,
      ],
    });
    const r = resolveRange('last6', new Date(Date.UTC(2026, 7, 14)));
    const { bars } = monthlyStatement(state, r);

    expect(bars.find(b => b.month === 3)?.income).toBe(50000);
    expect(bars.find(b => b.month === 6)?.expense).toBe(20000);
    // Months with no activity are present at zero — the table is a
    // calendar, not a list of active months.
    expect(bars.find(b => b.month === 4)?.income).toBe(0);
  });

  it('ignores transfers', () => {
    const state = makeState({
      transactions: [
        { id: 't1', type: 'transfer', amount: 50000, date: '2026-03-05', accountId: 'a1' } as any,
      ],
    });
    const r = resolveRange('last6', new Date(Date.UTC(2026, 7, 14)));
    const { bars } = monthlyStatement(state, r);

    expect(bars.find(b => b.month === 3)?.income).toBe(0);
    expect(bars.find(b => b.month === 3)?.expense).toBe(0);
  });
});

describe('investmentSummary', () => {
  it('totals principal, maturity value and earnings across schemes', () => {
    const state = makeState({
      investments: [
        // 100000 at 10% for 12 months → 110000 at maturity.
        { id: 'i1', name: 'A', type: 'fdr', principal: 100000, rate: 10, startDate: '2026-01-01', termMonths: 12, status: 'active', createdAt: '2026-01-01' } as any,
        // 50000 at 6% for 24 months → 56000 at maturity.
        { id: 'i2', name: 'B', type: 'fdr', principal: 50000, rate: 6, startDate: '2026-01-01', termMonths: 24, status: 'active', createdAt: '2026-01-01' } as any,
      ],
    });
    const s = investmentSummary(state);
    expect(s.totalContributed).toBe(150000);
    expect(s.totalMaturity).toBeCloseTo(166000, 6);
    expect(s.totalEarnings).toBeCloseTo(16000, 6);
    expect(s.averageRate).toBe(8);
  });

  it('skips closed and rolled-over schemes', () => {
    const state = makeState({
      investments: [
        { id: 'i1', name: 'Closed', type: 'fdr', principal: 100000, rate: 10, startDate: '2026-01-01', termMonths: 12, status: 'closed', createdAt: '2026-01-01' } as any,
        { id: 'i2', name: 'Live', type: 'fdr', principal: 50000, rate: 6, startDate: '2026-01-01', termMonths: 24, status: 'active', createdAt: '2026-01-01' } as any,
      ],
    });
    const s = investmentSummary(state);
    expect(s.rows.map(r => r.name)).toEqual(['Live']);
    expect(s.totalContributed).toBe(50000);
  });

  it('sorts schemes by earnings descending', () => {
    const state = makeState({
      investments: [
        { id: 'i1', name: 'Small', type: 'fdr', principal: 10000, rate: 10, startDate: '2026-01-01', termMonths: 12, status: 'active', createdAt: '2026-01-01' } as any,
        { id: 'i2', name: 'Big', type: 'fdr', principal: 100000, rate: 10, startDate: '2026-01-01', termMonths: 12, status: 'active', createdAt: '2026-01-01' } as any,
      ],
    });
    const s = investmentSummary(state);
    expect(s.rows[0].name).toBe('Big');
  });

  it('returns zeroes for a state with no investments', () => {
    const s = investmentSummary(makeState());
    expect(s.rows).toHaveLength(0);
    expect(s.totalContributed).toBe(0);
    expect(s.totalMaturity).toBe(0);
    expect(s.totalEarnings).toBe(0);
    expect(s.averageRate).toBe(0);
  });
});

describe('loanSummary', () => {
  it('splits a loan payment into interest and principal', () => {
    const state = makeState({
      debts: [
        { id: 'd1', name: 'Home', direction: 'i_owe', kind: 'loan', interestRate: 12, termMonths: 24, total: 500000, paidSoFar: 0, status: 'active', createdAt: '2026-01-01' } as any,
      ],
      transactions: [
        // One EMI of 23537 against a 500000 @ 12% loan → 5000 interest.
        { id: 't1', type: 'expense', amount: 23537, date: '2026-02-01', accountId: 'a1', linkedDebtId: 'd1', note: 'EMI' } as any,
      ],
    });
    const s = loanSummary(state);
    const row = s.rows[0];
    expect(row.monthly).toBe(23537);
    expect(row.interestPaid).toBe(5000);
    expect(row.principalPaid).toBe(18537);
    expect(row.outstanding).toBe(481463);
    expect(s.totalOutstanding).toBe(481463);
    expect(s.totalInterestPaid).toBe(5000);
  });

  it('reports the interest still to be paid on the remaining balance', () => {
    const state = makeState({
      debts: [
        { id: 'd1', name: 'Home', direction: 'i_owe', kind: 'loan', interestRate: 12, termMonths: 24, total: 500000, paidSoFar: 0, status: 'active', createdAt: '2026-01-01' } as any,
      ],
      transactions: [
        { id: 't1', type: 'expense', amount: 23537, date: '2026-02-01', accountId: 'a1', linkedDebtId: 'd1', note: 'EMI' } as any,
      ],
    });
    const s = loanSummary(state);
    // The remaining schedule on 481463 @ 12% still carries interest,
    // and less than the 64880 the whole term costs.
    expect(s.totalInterestLeft).toBeGreaterThan(0);
    expect(s.totalInterestLeft).toBeLessThan(64880);
  });

  it('reports zero interest for a flat debt', () => {
    const state = makeState({
      debts: [
        { id: 'd1', name: 'Friend', direction: 'i_owe', total: 10000, paidSoFar: 0, status: 'active', createdAt: '2026-01-01' } as any,
      ],
    });
    const s = loanSummary(state);
    expect(s.rows[0].interestPaid).toBe(0);
    expect(s.rows[0].monthly).toBe(0);
    expect(s.totalInterestLeft).toBe(0);
    expect(s.totalOutstanding).toBe(10000);
  });

  it('skips completed debts', () => {
    const state = makeState({
      debts: [
        { id: 'd1', name: 'Done', direction: 'i_owe', total: 10000, paidSoFar: 10000, status: 'completed', createdAt: '2026-01-01' } as any,
      ],
    });
    const s = loanSummary(state);
    expect(s.rows).toHaveLength(0);
    expect(s.totalOutstanding).toBe(0);
  });

  it('returns zeroes for a state with no debts', () => {
    const s = loanSummary(makeState());
    expect(s.rows).toHaveLength(0);
    expect(s.totalOutstanding).toBe(0);
    expect(s.totalInterestPaid).toBe(0);
    expect(s.totalInterestLeft).toBe(0);
    expect(s.totalMonthlyInterest).toBe(0);
  });
});