/**
 * goalContributions.spec.ts — verifies the contribution flow on goals.
 *
 * Goals are a *plan-only* scratchpad. Adding a contribution does NOT
 * create a transaction, does NOT touch account balances, and does NOT
 * appear in the user's transaction history. The `saved` field is the
 * running total of `goal.contributions[].amount`, stored (not derived
 * on every read) so progress is O(1).
 */
import { describe, it, expect } from 'vitest';
import {
  add,
  addContribution,
  remove,
  removeContribution,
  recomputeGoalSaved,
  migrateGoalsAddContributions,
} from './goals';
import { goalSaved, goalProgress, goalRequiredPerMonth } from './math';
import type { State } from './types';

const NOW = '2026-08-13';

const baseState = (): State => ({
  version: 1,
  accounts: [
    { id: 'cash', name: 'Cash', type: 'cash', openingBalance: 50000, createdAt: NOW },
    { id: 'bank', name: 'Bank', type: 'bank', openingBalance: 100000, createdAt: NOW },
  ],
  transactions: [],
  goals: [],
  debts: [],
  investments: [],
  categories: [],
  monthPlans: [],
  eventPlans: [],
  investmentPlans: [],
  loanPlans: [],
  settings: { theme: 'auto', onboardingComplete: true },
});

describe('goals.add', () => {
  it('seeds the contributions array with a starting balance when saved > 0', () => {
    const next = add(baseState(), { name: 'Bike', target: 50000, saved: 10000, targetDate: '2027-01-01' });
    expect(next.goals[0].saved).toBe(10000);
    expect(next.goals[0].contributions).toHaveLength(1);
    expect(next.goals[0].contributions[0].amount).toBe(10000);
    expect(next.goals[0].contributions[0].note).toBe('Starting balance');
  });

  it('leaves contributions empty when starting from zero', () => {
    const next = add(baseState(), { name: 'Bike', target: 50000, saved: 0, targetDate: '2027-01-01' });
    expect(next.goals[0].saved).toBe(0);
    expect(next.goals[0].contributions).toEqual([]);
  });

  it('throws on missing name', () => {
    expect(() => add(baseState(), { name: '', target: 100, saved: 0, targetDate: '2027-01-01' }))
      .toThrow(/Goal name is required/);
  });

  it('throws on non-positive target', () => {
    expect(() => add(baseState(), { name: 'X', target: 0, saved: 0, targetDate: '2027-01-01' }))
      .toThrow(/target must be positive/i);
  });

  it('throws on negative saved', () => {
    expect(() => add(baseState(), { name: 'X', target: 100, saved: -5, targetDate: '2027-01-01' }))
      .toThrow(/cannot be negative/i);
  });
});

describe('goals.addContribution', () => {
  it('appends to contributions and bumps saved — no transaction created', () => {
    let s = baseState();
    s = add(s, { name: 'Bike', target: 50000, saved: 0, targetDate: '2027-01-01' });
    const goalId = s.goals[0].id;

    const next = addContribution(s, goalId, {
      amount: 5000,
      date: NOW,
    });

    // No transaction created — plan-only.
    expect(next.transactions).toHaveLength(0);

    // Goal saved updated.
    expect(next.goals[0].saved).toBe(5000);
    expect(next.goals[0].contributions).toHaveLength(1);
    expect(next.goals[0].contributions[0].amount).toBe(5000);
    expect(next.goals[0].contributions[0].date).toBe(NOW);
  });

  it('multiple contributions accumulate in saved', () => {
    let s = baseState();
    s = add(s, { name: 'Bike', target: 50000, saved: 0, targetDate: '2027-01-01' });
    const goalId = s.goals[0].id;
    s = addContribution(s, goalId, { amount: 5000, date: NOW });
    s = addContribution(s, goalId, { amount: 7000, date: NOW });
    expect(s.goals[0].saved).toBe(12000);
    expect(s.goals[0].contributions).toHaveLength(2);
  });

  it('throws on missing goal', () => {
    const s = baseState();
    expect(() => addContribution(s, 'nope', { amount: 100, date: NOW }))
      .toThrow(/Goal not found/);
  });

  it('throws on non-positive amount', () => {
    let s = baseState();
    s = add(s, { name: 'Bike', target: 50000, saved: 0, targetDate: '2027-01-01' });
    expect(() => addContribution(s, s.goals[0].id, { amount: 0, date: NOW }))
      .toThrow(/positive/);
  });

  it('trims the note and removes empty strings', () => {
    let s = baseState();
    s = add(s, { name: 'Bike', target: 50000, saved: 0, targetDate: '2027-01-01' });
    const next = addContribution(s, s.goals[0].id, { amount: 100, date: NOW, note: '  hello  ' });
    expect(next.goals[0].contributions[0].note).toBe('hello');
    const next2 = addContribution(s, s.goals[0].id, { amount: 100, date: NOW, note: '   ' });
    expect(next2.goals[0].contributions[0].note).toBeUndefined();
  });
});

describe('goals.removeContribution', () => {
  it('drops the entry and decrements saved', () => {
    let s = baseState();
    s = add(s, { name: 'Bike', target: 50000, saved: 10000, targetDate: '2027-01-01' });
    s = addContribution(s, s.goals[0].id, { amount: 5000, date: NOW });
    const contribId = s.goals[0].contributions[1].id;

    const next = removeContribution(s, s.goals[0].id, contribId);
    expect(next.goals[0].saved).toBe(10000);
    expect(next.goals[0].contributions).toHaveLength(1);
  });

  it('no-ops on unknown contribution id', () => {
    let s = baseState();
    s = add(s, { name: 'Bike', target: 50000, saved: 0, targetDate: '2027-01-01' });
    const next = removeContribution(s, s.goals[0].id, 'nope');
    expect(next).toBe(s);
  });
});

describe('goals.remove', () => {
  it('drops the goal entirely (contributions go with it)', () => {
    let s = baseState();
    s = add(s, { name: 'Bike', target: 50000, saved: 0, targetDate: '2027-01-01' });
    s = addContribution(s, s.goals[0].id, { amount: 100, date: NOW });
    const next = remove(s, s.goals[0].id);
    expect(next.goals).toHaveLength(0);
  });
});

describe('goals.recomputeGoalSaved', () => {
  it('re-derives saved from the contributions array', () => {
    let s = baseState();
    s = add(s, { name: 'Bike', target: 50000, saved: 0, targetDate: '2027-01-01' });
    const goalId = s.goals[0].id;
    s = addContribution(s, goalId, { amount: 5000, date: NOW });
    s = addContribution(s, goalId, { amount: 7000, date: NOW });
    // Mutate the saved total out of band to simulate drift.
    s.goals[0].saved = 999;
    const next = recomputeGoalSaved(s);
    expect(next.goals[0].saved).toBe(12000);
  });

  it('is a no-op when contributions already match saved', () => {
    let s = baseState();
    s = add(s, { name: 'Bike', target: 50000, saved: 0, targetDate: '2027-01-01' });
    const before = recomputeGoalSaved(s);
    expect(before.goals[0]).toEqual(s.goals[0]);
  });
});

describe('goals.migrateGoalsAddContributions', () => {
  it('seeds the contributions array from the legacy `saved` field', () => {
    const state: State = {
      ...baseState(),
      goals: [{
        id: 'legacy',
        name: 'Legacy',
        target: 100,
        saved: 42,
        targetDate: '2027-01-01',
        createdAt: '2026-01-01',
      } as any],
    };
    const next = migrateGoalsAddContributions(state);
    expect(next.goals[0].contributions).toHaveLength(1);
    expect(next.goals[0].contributions[0].amount).toBe(42);
    expect(next.goals[0].contributions[0].note).toBe('Imported starting balance');
  });

  it('leaves goals that already have a contributions array alone', () => {
    let s = baseState();
    s = add(s, { name: 'X', target: 100, saved: 10, targetDate: '2027-01-01' });
    const next = migrateGoalsAddContributions(s);
    expect(next).toBe(s);
  });
});

describe('math — goal helpers', () => {
  it('goalSaved reads from goal.saved', () => {
    const g = { id: 'g', name: 'g', target: 100, saved: 33, contributions: [], targetDate: '2099-01-01', createdAt: NOW };
    expect(goalSaved(g)).toBe(33);
  });

  it('goalProgress caps at 1.0', () => {
    const g = { id: 'g', name: 'g', target: 100, saved: 9999, contributions: [], targetDate: '2099-01-01', createdAt: NOW };
    expect(goalProgress(g)).toBe(1);
  });

  it('goalRequiredPerMonth uses the supplied saved value', () => {
    const g = {
      id: 'g2', name: 'g', target: 1200, saved: 0,
      contributions: [], targetDate: '2027-02-13', createdAt: NOW,
    };
    expect(goalRequiredPerMonth(g, 200, NOW)).toBeCloseTo(1000 / 6, 5);
  });
});