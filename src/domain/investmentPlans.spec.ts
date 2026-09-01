/**
 * investmentPlans.spec.ts — covers the mock Investment Planner
 * scratchpad (PRD §9.17) and its derived projections.
 */
import { describe, it, expect } from 'vitest';
import {
  addInvestmentPlan, updateInvestmentPlan,
  saveInvestmentPlan,
  removeInvestmentPlan, listInvestmentPlans,
  getInvestmentPlan,
  investmentPlanMaturityValue, investmentPlanMaturityDate,
  investmentPlanInterest, investmentPlanTotalContributed,
  projectionSeries,
  INVESTMENT_PLAN_KITS,
} from './investmentPlans';
import { DEFAULT_STATE } from './persistence';
import type { InvestmentPlan, State } from './types';

function makeState(): State {
  return { ...DEFAULT_STATE };
}

describe('addInvestmentPlan / saveInvestmentPlan / updateInvestmentPlan / removeInvestmentPlan', () => {
  it('adds a new plan and returns its id', () => {
    const s0 = makeState();
    const { state: s1, id } = addInvestmentPlan(s0, {
      name: 'DBBL 1-year FDR', type: 'fdr', principal: 100_000,
      rate: 9, startDate: '2026-01-01', termMonths: 12,
      institution: 'DBBL',
    });
    expect(s1.investmentPlans).toHaveLength(1);
    expect(getInvestmentPlan(s1, id)?.name).toBe('DBBL 1-year FDR');
    expect(getInvestmentPlan(s1, id)?.dirty).toBe(true);
    expect(listInvestmentPlans(s1)).toHaveLength(1);
  });

  it('saveInvestmentPlan clears dirty + stamps savedAt', () => {
    const { state: s1 } = addInvestmentPlan(makeState(), {
      name: 'Test', type: 'fdr', principal: 0, rate: 0,
      startDate: '2026-01-01', termMonths: 12,
    });
    const planId = s1.investmentPlans[0].id;
    const s2 = saveInvestmentPlan(s1, planId);
    expect(s2.investmentPlans[0].dirty).toBe(false);
    expect(s2.investmentPlans[0].savedAt).not.toBeNull();
  });

  it('updateInvestmentPlan flips dirty', () => {
    const { state: s1 } = addInvestmentPlan(makeState(), {
      name: 'Test', type: 'fdr', principal: 1_000, rate: 5,
      startDate: '2026-01-01', termMonths: 12,
    });
    const planId = s1.investmentPlans[0].id;
    const s2 = updateInvestmentPlan(s1, planId, { rate: 9 });
    expect(s2.investmentPlans[0].rate).toBe(9);
    expect(s2.investmentPlans[0].dirty).toBe(true);
  });

  it('removeInvestmentPlan drops the plan', () => {
    const { state: s1 } = addInvestmentPlan(makeState(), {
      name: 'Test', type: 'fdr', principal: 0, rate: 0,
      startDate: '2026-01-01', termMonths: 12,
    });
    const planId = s1.investmentPlans[0].id;
    const s2 = removeInvestmentPlan(s1, planId);
    expect(s2.investmentPlans).toHaveLength(0);
  });
});

describe('investmentPlanMaturityValue (FDR / savings)', () => {
  it('matches R9: principal × (1 + rate × months/12)', () => {
    const plan: InvestmentPlan = {
      id: 'p', name: 'FDR', type: 'fdr',
      principal: 100_000, rate: 9,
      startDate: '2026-01-01', termMonths: 12,
      dirty: true, savedAt: null,
    };
    // 100,000 × (1 + 0.09 × 1) = 109,000
    expect(investmentPlanMaturityValue(plan)).toBeCloseTo(109_000, 0);
  });

  it('handles days-based terms for sub-1-month FDRs', () => {
    const plan: InvestmentPlan = {
      id: 'p', name: 'Short FDR', type: 'fdr',
      principal: 50_000, rate: 6,
      startDate: '2026-01-01', termMonths: 0, termDays: 30,
      dirty: true, savedAt: null,
    };
    // 50,000 × (1 + 0.06 × 30/365) ≈ 50,246.58
    expect(investmentPlanMaturityValue(plan)).toBeCloseTo(50_246.58, 0);
  });

  it('returns 0 for a missing plan', () => {
    // @ts-expect-error testing runtime guard
    expect(investmentPlanMaturityValue(null)).toBe(0);
  });
});

describe('investmentPlanMaturityValue (DPS)', () => {
  it('matches R13 (annuity-due)', () => {
    const plan: InvestmentPlan = {
      id: 'p', name: 'DPS', type: 'dps',
      monthlyContribution: 5_000, principal: 60_000,
      rate: 8, startDate: '2026-01-01', termMonths: 12,
      dirty: true, savedAt: null,
    };
    // 5,000 × ((1 + 0.08/12)^12 − 1) / (0.08/12) × (1 + 0.08/12) ≈ 61,683
    const mat = investmentPlanMaturityValue(plan);
    expect(mat).toBeGreaterThan(60_000);
    expect(mat).toBeLessThan(65_000);
  });

  it('falls back to linear growth when rate is 0', () => {
    const plan: InvestmentPlan = {
      id: 'p', name: 'Zero-rate DPS', type: 'dps',
      monthlyContribution: 1_000, principal: 12_000,
      rate: 0, startDate: '2026-01-01', termMonths: 12,
      dirty: true, savedAt: null,
    };
    expect(investmentPlanMaturityValue(plan)).toBe(12_000);
  });
});

describe('investmentPlanMaturityDate', () => {
  it('returns null on missing startDate', () => {
    // @ts-expect-error testing runtime guard
    expect(investmentPlanMaturityDate({})).toBeNull();
  });

  it('adds months and clamps to month-end', () => {
    const plan: InvestmentPlan = {
      id: 'p', name: 'Jan-start', type: 'fdr',
      principal: 0, rate: 0,
      startDate: '2026-01-31', termMonths: 1,
      dirty: true, savedAt: null,
    };
    expect(investmentPlanMaturityDate(plan)?.toISOString().slice(0, 10)).toBe('2026-02-28');
  });
});

describe('investmentPlanInterest', () => {
  it('is maturity minus principal', () => {
    const plan: InvestmentPlan = {
      id: 'p', name: 'FDR', type: 'fdr',
      principal: 100_000, rate: 9,
      startDate: '2026-01-01', termMonths: 12,
      dirty: true, savedAt: null,
    };
    expect(investmentPlanInterest(plan)).toBeCloseTo(9_000, 0);
  });

  // Regression: DPS interest must be computed against the cumulative
  // contributions (monthly × term), NOT against `plan.principal`,
  // which is an informational field on DPS that's often stale or
  // zero. The list card, detail card, and ribbon chart all read
  // this number — if it's wrong, the split bar shows the wrong
  // ratio of "your money vs interest".
  it('DPS: subtracts cumulative contributions, not plan.principal', () => {
    const plan: InvestmentPlan = {
      id: 'p', name: 'DPS', type: 'dps',
      principal: 0,            // ← would yield wrong answer if used as base
      monthlyContribution: 5_000,
      rate: 8,
      startDate: '2026-01-01', termMonths: 12,
      institution: '', notes: '', kit: 'dps',
      dirty: true, savedAt: null,
    };
    // Maturity for 5,000/mo × 12mo at 8% annuity-due ≈ 62,665
    // Interest = maturity − contributions = 62,665 − 60,000 ≈ 2,665
    const expectedMat = investmentPlanMaturityValue(plan);   // ~62,665
    const expectedContrib = 5_000 * 12;                       // 60,000
    expect(investmentPlanTotalContributed(plan)).toBe(expectedContrib);
    expect(investmentPlanInterest(plan))
      .toBeCloseTo(expectedMat - expectedContrib, 0);
    expect(investmentPlanInterest(plan)).toBeGreaterThan(2_500);
    expect(investmentPlanInterest(plan)).toBeLessThan(2_800);

    // Critical assertion — the bug was: `maturity − plan.principal`
    // which, with `plan.principal = 0`, would equal `maturity` (62,665).
    // The fixed helper subtracts the contributions (60,000) instead.
    expect(investmentPlanInterest(plan))
      .toBeCloseTo(investmentPlanMaturityValue(plan) - 5_000 * 12, 0);
    // Belt-and-braces: also assert the helper does NOT collapse to
    // `maturity - plan.principal` (which is what the old code did).
    expect(investmentPlanInterest(plan))
      .not.toBeCloseTo(investmentPlanMaturityValue(plan) - plan.principal, 0);
  });

  it('DPS kit default: matches what the cards actually show', () => {
    // The DPS kit's `principal: 60_000` is informational. After the
    // fix, the cards read interest from `monthlyContribution ×
    // termMonths` (= 60,000 by coincidence) so this case happens
    // to compute the right number either way. The non-trivial
    // coverage is the previous test where `principal = 0`.
    const kit = INVESTMENT_PLAN_KITS.find(k => k.id === 'dps')!;
    const plan: InvestmentPlan = {
      id: 'p', name: kit.name,
      ...kit.defaults,
      dirty: true, savedAt: null,
    };
    expect(investmentPlanTotalContributed(plan)).toBe(60_000);
  });

  it('FDR kit default: principal is the contribution', () => {
    const kit = INVESTMENT_PLAN_KITS.find(k => k.id === 'fdr')!;
    const plan: InvestmentPlan = {
      id: 'p', name: kit.name,
      ...kit.defaults,
      dirty: true, savedAt: null,
    };
    expect(investmentPlanTotalContributed(plan)).toBe(kit.defaults.principal);
  });

  it('Savings kit default: principal is the contribution', () => {
    const kit = INVESTMENT_PLAN_KITS.find(k => k.id === 'savings')!;
    const plan: InvestmentPlan = {
      id: 'p', name: kit.name,
      ...kit.defaults,
      dirty: true, savedAt: null,
    };
    expect(investmentPlanTotalContributed(plan)).toBe(kit.defaults.principal);
  });
});

describe('projectionSeries', () => {
  // Regression: DPS and FDR must produce visually distinct shapes.
  // Before this fix, both ramps ran 0 → maturity which made the
  // charts indistinguishable. After the fix, the DPS curve builds
  // up the balance month-by-month (0 → maturity), while the FDR
  // curve starts at principal on day 0 and traces only the
  // interest layer on top.
  it('DPS: starts at 0 and curves upward to maturity', () => {
    const plan: InvestmentPlan = {
      id: 'p', name: 'DPS', type: 'dps',
      principal: 0, monthlyContribution: 5_000, rate: 8,
      startDate: '2026-01-01', termMonths: 12,
      institution: '', notes: '', kit: 'dps',
      dirty: true, savedAt: null,
    };
    const s = projectionSeries(plan);
    expect(s[0]).toBe(0);
    expect(s[s.length - 1]).toBeCloseTo(investmentPlanMaturityValue(plan), 0);
    // Curve must be monotonically increasing AND non-linear
    // (later months add proportionally more than early ones,
    // because of the compound).
    for (let i = 1; i < s.length; i++) {
      expect(s[i]).toBeGreaterThanOrEqual(s[i - 1]);
    }
    const earlyStep = s[4] - s[3];
    const lateStep = s[s.length - 1] - s[s.length - 2];
    expect(lateStep).toBeGreaterThan(earlyStep);
  });

  it('FDR: starts at principal (NOT 0), only interest grows', () => {
    const plan: InvestmentPlan = {
      id: 'p', name: 'FDR', type: 'fdr',
      principal: 100_000, rate: 9,
      startDate: '2026-01-01', termMonths: 12,
      institution: '', notes: '', kit: 'fdr',
      dirty: true, savedAt: null,
    };
    const s = projectionSeries(plan);
    // Day-0 balance is the full principal — the user deposited the
    // whole sum up front.
    expect(s[0]).toBe(100_000);
    // Maturity matches the maturity-value formula.
    expect(s[s.length - 1]).toBeCloseTo(investmentPlanMaturityValue(plan), 0);
    // If we still had the bug, s[0] would be 0 and the last value
    // would be ~109,000. The fixed curve goes 100,000 → 109,000.
    expect(s[s.length - 1] - s[0]).toBeCloseTo(9_000, 0);
  });

  it('Savings: starts at principal, only interest grows', () => {
    const plan: InvestmentPlan = {
      id: 'p', name: 'Savings', type: 'savings',
      principal: 50_000, rate: 7,
      startDate: '2026-01-01', termMonths: 36,
      institution: '', notes: '', kit: 'other',
      dirty: true, savedAt: null,
    };
    const s = projectionSeries(plan);
    expect(s[0]).toBe(50_000);
    expect(s[s.length - 1]).toBeCloseTo(investmentPlanMaturityValue(plan), 0);
  });
});

describe('INVESTMENT_PLAN_KITS', () => {
  it('ships three starter kits with valid defaults', () => {
    expect(INVESTMENT_PLAN_KITS).toHaveLength(3);
    for (const kit of INVESTMENT_PLAN_KITS) {
      expect(kit.id).toMatch(/^(dps|fdr|savings)$/);
      expect(kit.name).toBeTruthy();
      expect(kit.emoji).toBeTruthy();
      expect(kit.description).toBeTruthy();
      // Every kit's defaults include a start date and a positive term.
      expect(kit.defaults.startDate).toMatch(/^\d{4}-\d{2}-\d{2}/);
      expect(kit.defaults.termMonths).toBeGreaterThan(0);
      // Rate cap (R16) — every kit is 0..100.
      expect(kit.defaults.rate).toBeGreaterThanOrEqual(0);
      expect(kit.defaults.rate).toBeLessThanOrEqual(100);
    }
  });
});