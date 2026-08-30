/**
 * investmentPlans.spec.ts — covers the mock Investment Planner
 * scratchpad (PRD §9.17) and its derived projections.
 */
import { describe, it, expect } from 'vitest';
import {
  addInvestmentPlan, updateInvestmentPlan, saveInvestmentPlan,
  resetInvestmentPlan, removeInvestmentPlan, listInvestmentPlans,
  getInvestmentPlan,
  investmentPlanMaturityValue, investmentPlanMaturityDate,
  investmentPlanInterest, INVESTMENT_PLAN_KITS,
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

  it('saveInvestmentPlan clears dirty and stamps savedAt', () => {
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
    expect(s2.investmentPlans[0].dirty).toBe(true);
    expect(s2.investmentPlans[0].rate).toBe(9);
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

  it('resetInvestmentPlan on an unsaved plan removes it', () => {
    const { state: s1 } = addInvestmentPlan(makeState(), {
      name: 'Test', type: 'fdr', principal: 0, rate: 0,
      startDate: '2026-01-01', termMonths: 12,
    });
    const planId = s1.investmentPlans[0].id;
    const s2 = resetInvestmentPlan(s1, planId);
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