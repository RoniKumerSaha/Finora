/**
 * loanPlans.spec.ts — covers the loan-amortisation math + the
 * scratchpad CRUD for the new Loan Calculator (PRD §9.17).
 *
 * The math lives in math.ts; this file imports both math.ts and
 * loanPlans.ts to assert the surface area end-to-end.
 */
import { describe, it, expect } from 'vitest';
import {
  loanEMI, loanTotalPaid, loanTotalInterest, loanAmortization, addMonthsISO,
} from './math';
import {
  addLoanPlan, updateLoanPlan, saveLoanPlan, resetLoanPlan,
  removeLoanPlan, summariseLoanPlan, listLoanPlans, getLoanPlan,
} from './loanPlans';
import { DEFAULT_STATE } from './persistence';
import type { LoanPlan, State } from './types';

function makeState(): State {
  return { ...DEFAULT_STATE };
}

describe('loanEMI', () => {
  it('returns 0 for zero / negative principal', () => {
    expect(loanEMI(0, 9, 12)).toBe(0);
    expect(loanEMI(-1000, 9, 12)).toBe(0);
  });

  it('returns 0 for zero term', () => {
    expect(loanEMI(1000, 9, 0)).toBe(0);
  });

  it('handles a 0% rate by returning principal / term', () => {
    // 100,000 over 12 months at 0% = 8,333.33
    expect(loanEMI(100_000, 0, 12)).toBeCloseTo(8_333.33, 1);
  });

  it('matches the textbook EMI for a known case', () => {
    // 100,000 at 9% over 12 months ≈ 8,741.19
    const emi = loanEMI(100_000, 9, 12);
    expect(emi).toBeGreaterThan(8_700);
    expect(emi).toBeLessThan(8_800);
    // And it should pay off the principal in 12 months.
    const total = loanTotalPaid(emi, 12);
    expect(total).toBeCloseTo(100_000 + loanTotalInterest(100_000, emi, 12), 0);
  });

  it('matches the textbook EMI for a long-term case', () => {
    // 1,000,000 at 10% over 60 months ≈ 21,247.00 (textbook answer)
    const emi = loanEMI(1_000_000, 10, 60);
    expect(emi).toBeGreaterThan(21_000);
    expect(emi).toBeLessThan(21_500);
  });
});

describe('addMonthsISO', () => {
  it('adds whole months', () => {
    expect(addMonthsISO('2026-01-15', 1)).toBe('2026-02-15');
    expect(addMonthsISO('2026-01-15', 12)).toBe('2027-01-15');
    expect(addMonthsISO('2026-01-15', 24)).toBe('2028-01-15');
  });

  it('clamps day-of-month to month-end on overflow', () => {
    // Jan 31 + 1 month → Feb 28 (non-leap year)
    expect(addMonthsISO('2026-01-31', 1)).toBe('2026-02-28');
    // Mar 31 + 1 month → Apr 30
    expect(addMonthsISO('2026-03-31', 1)).toBe('2026-04-30');
  });
});

describe('loanAmortization', () => {
  function fixture(): LoanPlan {
    return {
      id: 'loan-1',
      name: 'Test loan',
      principal: 100_000,
      rate: 9,
      termMonths: 12,
      startDate: '2026-01-01',
      dirty: true,
      savedAt: null,
    };
  }

  it('returns an array of length = termMonths', () => {
    const rows = loanAmortization(fixture());
    expect(rows).toHaveLength(12);
  });

  it('returns an empty array for invalid input', () => {
    expect(loanAmortization({ ...fixture(), principal: 0 })).toEqual([]);
    expect(loanAmortization({ ...fixture(), termMonths: 0 })).toEqual([]);
  });

  it('period 1 has interest = outstanding × monthlyRate', () => {
    const rows = loanAmortization(fixture());
    // 100,000 × (9/100/12) = 750
    expect(rows[0].interest).toBeCloseTo(750, 2);
    expect(rows[0].period).toBe(1);
  });

  it('principal + interest = payment (for non-final rows)', () => {
    const rows = loanAmortization(fixture());
    for (let i = 0; i < rows.length - 1; i++) {
      expect(rows[i].principalPaid + rows[i].interest).toBeCloseTo(rows[i].payment, 2);
    }
  });

  it('remaining drops to 0 on the final row', () => {
    const rows = loanAmortization(fixture());
    expect(rows[rows.length - 1].remaining).toBe(0);
  });

  it('dueDate advances one month per row, clamped to month-end', () => {
    const rows = loanAmortization(fixture());
    expect(rows[0].dueDate).toBe('2026-02-01');
    expect(rows[11].dueDate).toBe('2027-01-01');
  });

  it('sum of principalPaid equals the original principal', () => {
    const rows = loanAmortization(fixture());
    const total = rows.reduce((s, r) => s + r.principalPaid, 0);
    expect(total).toBeCloseTo(100_000, 0);
  });

  it('respects an emiOverride for the table', () => {
    // Override a smaller EMI — last row should still leave a positive
    // balance because the override doesn't pay off the loan.
    const rows = loanAmortization({ ...fixture(), emiOverride: 5_000 });
    expect(rows[rows.length - 1].remaining).toBeGreaterThan(0);
  });
});

describe('summariseLoanPlan', () => {
  it('reports principal, EMI, total paid, total interest', () => {
    const plan: LoanPlan = {
      id: 'l', name: 'x', principal: 100_000, rate: 9, termMonths: 12,
      startDate: '2026-01-01', dirty: true, savedAt: null,
    };
    const s = summariseLoanPlan(plan);
    expect(s.principal).toBe(100_000);
    expect(s.termMonths).toBe(12);
    expect(s.rate).toBe(9);
    expect(s.emi).toBeGreaterThan(0);
    expect(s.totalPaid).toBeCloseTo(s.emi * 12, 2);
    expect(s.totalInterest).toBe(s.totalPaid - 100_000);
  });
});

describe('addLoanPlan / saveLoanPlan / resetLoanPlan / removeLoanPlan', () => {
  it('adds a new plan and returns its id', () => {
    const s0 = makeState();
    const { state: s1, id } = addLoanPlan(s0, {
      name: 'New', principal: 50_000, rate: 7, termMonths: 6,
      startDate: '2026-01-01',
    });
    expect(s1.loanPlans).toHaveLength(1);
    expect(getLoanPlan(s1, id)?.name).toBe('New');
    expect(getLoanPlan(s1, id)?.dirty).toBe(true);
    expect(listLoanPlans(s1)).toHaveLength(1);
  });

  it('saveLoanPlan clears dirty + stamps savedAt', () => {
    const { state: s1 } = addLoanPlan(makeState(), {
      name: 'New', principal: 0, rate: 0, termMonths: 12,
      startDate: '2026-01-01',
    });
    const planId = s1.loanPlans[0].id;
    const s2 = saveLoanPlan(s1, planId);
    expect(s2.loanPlans[0].dirty).toBe(false);
    expect(s2.loanPlans[0].savedAt).not.toBeNull();
  });

  it('updateLoanPlan flips dirty', () => {
    const { state: s1 } = addLoanPlan(makeState(), {
      name: 'New', principal: 0, rate: 0, termMonths: 12,
      startDate: '2026-01-01',
    });
    const planId = s1.loanPlans[0].id;
    const s2 = updateLoanPlan(s1, planId, { principal: 5_000 });
    expect(s2.loanPlans[0].dirty).toBe(true);
    expect(s2.loanPlans[0].principal).toBe(5_000);
  });

  it('removeLoanPlan drops the plan entirely', () => {
    const { state: s1 } = addLoanPlan(makeState(), {
      name: 'New', principal: 0, rate: 0, termMonths: 12,
      startDate: '2026-01-01',
    });
    const planId = s1.loanPlans[0].id;
    const s2 = removeLoanPlan(s1, planId);
    expect(s2.loanPlans).toHaveLength(0);
  });

  it('resetLoanPlan on an unsaved plan removes it (no snapshot to restore)', () => {
    const { state: s1 } = addLoanPlan(makeState(), {
      name: 'New', principal: 0, rate: 0, termMonths: 12,
      startDate: '2026-01-01',
    });
    const planId = s1.loanPlans[0].id;
    const s2 = resetLoanPlan(s1, planId);
    expect(s2.loanPlans).toHaveLength(0);
  });

  it('resetLoanPlan on a saved plan just clears dirty', () => {
    const { state: s1 } = addLoanPlan(makeState(), {
      name: 'New', principal: 1_000, rate: 5, termMonths: 6,
      startDate: '2026-01-01',
    });
    const planId = s1.loanPlans[0].id;
    const s2 = saveLoanPlan(s1, planId);
    const s3 = updateLoanPlan(s2, planId, { principal: 9_999 });
    expect(s3.loanPlans[0].dirty).toBe(true);
    const s4 = resetLoanPlan(s3, planId);
    expect(s4.loanPlans).toHaveLength(1);
    expect(s4.loanPlans[0].dirty).toBe(false);
    expect(s4.loanPlans[0].principal).toBe(9_999); // reset only clears dirty, not values
  });
});