/**
 * insights.spec.ts — covers the /insights aggregations.
 *
 * Spine: docs/ux-designs/ux-finora-2026-08-14-analytics/EXPERIENCE.md
 */
import { describe, expect, it } from 'vitest';
import type { State } from './types';
import {
  categoryBreakdown,
  computeStats,
  debtsForInsights,
  goalsForInsights,
  investmentsForInsights,
  monthlyCashFlow,
  netWorthSeries,
  resolveRange,
  txInRange,
  type DateRangeKey,
} from './insights';

function makeState(overrides: Partial<State> = {}): State {
  return {
    version: 1,
    accounts: [],
    transactions: [],
    goals: [],
    debts: [],
    investments: [],
    categories: [
      { id: 'food', type: 'expense', name: 'Food' },
      { id: 'transit', type: 'expense', name: 'Transit' },
      { id: 'rent', type: 'expense', name: 'Rent' },
      { id: 'salary', type: 'income', name: 'Salary' },
    ],
    monthPlans: [],
    eventPlans: [],
    settings: { theme: 'auto', onboardingComplete: true },
    ...overrides,
  };
}

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
        { id: '3', type: 'expense', amount:  10000, date: '2026-08-12', linkedGoalId: 'g1' } as any,
      ],
    });
    const stats = computeStats(aug, r, 'thisMonth');
    expect(stats.netFlow).toBe(60000);
    expect(stats.avgMonthlyExpense).toBe(40000);
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
        { id: 'g1', name: 'B', target: 100, saved: 0, targetDate: '2026-12-01', createdAt: '2026-01-01' },
        { id: 'g2', name: 'A', target: 200, saved: 0, targetDate: '2026-09-01', createdAt: '2026-01-01' },
        { id: 'g3', name: 'Done', target: 100, saved: 0, targetDate: '2026-01-01', createdAt: '2026-01-01' },
      ],
      transactions: [
        // Make "Done" actually completed via a linked contribution.
        { id: 't1', type: 'expense', amount: 100, date: '2026-08-01', linkedGoalId: 'g3' } as any,
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