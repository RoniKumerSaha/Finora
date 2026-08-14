/**
 * contributions.spec.ts — verifies the contribution flow on goals +
 * investments. R6 says `goal.saved` and DPS `contributedSoFar` are derived
 * from transactions; the helpers in goals.ts and investments.ts should
 * just create those transactions without mutating the parent entity.
 */
import { describe, it, expect } from 'vitest';
import { addContribution, add, remove } from './goals';
import { addContribution as addInvestmentContribution, add as addInvestment } from './investments';
import { goalSavedFromTxns, dpsContributedSoFar } from './math';
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
  settings: { theme: 'auto', onboardingComplete: true },
});

describe('goals.addContribution', () => {
  it('creates an expense tx with linkedGoalId, leaves goal.saved alone', () => {
    let s = baseState();
    s = add(s, { name: 'Bike', target: 50000, targetDate: '2027-01-01' });
    const goalId = s.goals[0].id;
    const savedBefore = s.goals[0].saved;

    const next = addContribution(s, goalId, {
      amount: 5000,
      date: NOW,
      accountId: 'cash',
    });

    // Goal.saved unchanged — derived from txns.
    expect(next.goals[0].saved).toBe(savedBefore);

    // Transaction created and tagged.
    expect(next.transactions).toHaveLength(1);
    const tx = next.transactions[0];
    expect(tx.type).toBe('expense');
    expect(tx.amount).toBe(5000);
    expect(tx.linkedGoalId).toBe(goalId);
    expect(tx.accountId).toBe('cash');
  });

  it('contribution shows up in goalSavedFromTxns', () => {
    let s = baseState();
    s = add(s, { name: 'Bike', target: 50000, targetDate: '2027-01-01' });
    const goalId = s.goals[0].id;
    s = addContribution(s, goalId, { amount: 5000, date: NOW, accountId: 'cash' });
    s = addContribution(s, goalId, { amount: 7000, date: NOW, accountId: 'cash' });
    expect(goalSavedFromTxns(s.goals[0], s.transactions)).toBe(12000);
  });

  it('throws on missing goal', () => {
    const s = baseState();
    expect(() => addContribution(s, 'nope', { amount: 100, date: NOW, accountId: 'cash' }))
      .toThrow(/Goal not found/);
  });

  it('throws on missing account', () => {
    let s = baseState();
    s = add(s, { name: 'Bike', target: 50000, targetDate: '2027-01-01' });
    expect(() => addContribution(s, s.goals[0].id, {
      amount: 100, date: NOW, accountId: 'unknown',
    })).toThrow(/Account not found/);
  });

  it('throws on non-positive amount', () => {
    let s = baseState();
    s = add(s, { name: 'Bike', target: 50000, targetDate: '2027-01-01' });
    expect(() => addContribution(s, s.goals[0].id, {
      amount: 0, date: NOW, accountId: 'cash',
    })).toThrow(/positive/);
  });

  it('trims the note and removes empty strings', () => {
    let s = baseState();
    s = add(s, { name: 'Bike', target: 50000, targetDate: '2027-01-01' });
    const next = addContribution(s, s.goals[0].id, {
      amount: 100, date: NOW, accountId: 'cash', note: '  hello  ',
    });
    expect(next.transactions[0].note).toBe('hello');
    const next2 = addContribution(s, s.goals[0].id, {
      amount: 100, date: NOW, accountId: 'cash', note: '   ',
    });
    expect(next2.transactions[0].note).toBeUndefined();
  });
});

describe('investments.addContribution', () => {
  it('creates an expense tx with linkedInvestmentId', () => {
    let s = baseState();
    s = addInvestment(s, {
      name: 'BRAC DPS', type: 'dps', principal: 0,
      monthlyContribution: 5000, rate: 8,
      startDate: '2026-01-01', termMonths: 12,
    });
    const invId = s.investments[0].id;

    const next = addInvestmentContribution(s, invId, {
      amount: 5000, date: NOW, accountId: 'bank',
    });

    expect(next.investments[0].principal).toBe(0);  // unchanged
    expect(next.transactions).toHaveLength(1);
    const tx = next.transactions[0];
    expect(tx.type).toBe('expense');
    expect(tx.amount).toBe(5000);
    expect(tx.linkedInvestmentId).toBe(invId);
  });

  it('contributions aggregate in dpsContributedSoFar', () => {
    let s = baseState();
    s = addInvestment(s, {
      name: 'BRAC DPS', type: 'dps', principal: 0,
      monthlyContribution: 5000, rate: 8,
      startDate: '2026-01-01', termMonths: 12,
    });
    const inv = s.investments[0];
    s = addInvestmentContribution(s, inv.id, { amount: 5000, date: '2026-02-01', accountId: 'bank' });
    s = addInvestmentContribution(s, inv.id, { amount: 5000, date: '2026-03-01', accountId: 'bank' });
    s = addInvestmentContribution(s, inv.id, { amount: 5000, date: '2026-04-01', accountId: 'bank' });
    expect(dpsContributedSoFar(inv, s.transactions)).toBe(15000);
  });

  it('throws on missing investment', () => {
    const s = baseState();
    expect(() => addInvestmentContribution(s, 'nope', {
      amount: 100, date: NOW, accountId: 'cash',
    })).toThrow(/Investment not found/);
  });

  it('preserves monthlyContribution when adding DPS', () => {
    let s = baseState();
    s = addInvestment(s, {
      name: 'DPS', type: 'dps', principal: 0,
      monthlyContribution: 7500, rate: 9,
      startDate: '2026-01-01', termMonths: 24,
    });
    expect(s.investments[0].monthlyContribution).toBe(7500);
  });

  it('drops monthlyContribution for FDR (DPS-only field)', () => {
    let s = baseState();
    s = addInvestment(s, {
      name: 'FDR', type: 'fdr', principal: 100000, monthlyContribution: 9999,
      rate: 8, startDate: '2026-01-01', termMonths: 12,
    });
    expect(s.investments[0].monthlyContribution).toBeUndefined();
  });

  it('removing a goal does not touch its linked txns (intentional: audit trail)', () => {
    let s = baseState();
    s = add(s, { name: 'Bike', target: 50000, targetDate: '2027-01-01' });
    s = addContribution(s, s.goals[0].id, { amount: 100, date: NOW, accountId: 'cash' });
    const txId = s.transactions[0].id;
    s = remove(s, s.goals[0].id);
    // Tx still present (R6: derived values stay — orphaning is a UI concern).
    expect(s.transactions[0].id).toBe(txId);
  });
});