/**
 * investments.spec.ts — regression coverage for the FDR/Savings
 * principal-deduction bug (2026-09-02) and the auto-tagging feature.
 *
 * Before the fix: `investments.add(...)` for FDR/Savings created the
 * investment record but never deducted the principal from the linked
 * account — so the user's account balance still showed the parked
 * money AND the investment "owned" the same money. Classic
 * double-counting. The fix routes `add(..., { recordPrincipal: true })`
 * to also emit an `expense` transaction with `linkedInvestmentId` set
 * so accountBalance picks it up via the normal transaction path.
 */
import { describe, it, expect } from 'vitest';
import { add, addContribution, InvestmentError } from './investments';
import { accountBalance } from './math';
import { DEFAULT_STATE } from './persistence';
import type { Account, State } from './types';

const acct = (over: Partial<Account> = {}): Account => ({
  id: 'a1',
  name: 'Bank 1',
  type: 'bank',
  openingBalance: 100_000,
  createdAt: '2026-01-01',
  ...over,
});

const baseState = (over: Partial<State> = {}): State => ({
  ...DEFAULT_STATE,
  accounts: [acct()],
  ...over,
});

describe('investments.add — recordPrincipal flag', () => {
  it('FDR: recordPrincipal creates an expense transaction that reduces the account balance', () => {
    const before = accountBalance(baseState().accounts[0], []);
    expect(before).toBe(100_000);

    const after = add(baseState(), {
      name: 'FDR #1',
      type: 'fdr',
      principal: 50_000,
      rate: 8,
      startDate: '2026-09-02',
      termMonths: 12,
      payoutAccountId: 'a1',
    }, { recordPrincipal: true });

    const newAccount = after.accounts[0];
    const balance = accountBalance(newAccount, after.transactions);
    expect(balance).toBe(50_000); // 100k - 50k principal

    // The deduction is a normal expense transaction tagged with the
    // investment, so it shows up in the transactions list.
    const deduction = after.transactions.find(t => t.linkedInvestmentId === after.investments[0].id);
    expect(deduction).toBeTruthy();
    expect(deduction?.type).toBe('expense');
    expect(deduction?.amount).toBe(50_000);
    expect(deduction?.accountId).toBe('a1');
  });

  it('Savings: recordPrincipal also deducts', () => {
    const after = add(baseState(), {
      name: 'High-yield savings',
      type: 'savings',
      principal: 25_000,
      rate: 6,
      startDate: '2026-09-02',
      termMonths: 6,
      payoutAccountId: 'a1',
    }, { recordPrincipal: true });

    expect(accountBalance(after.accounts[0], after.transactions)).toBe(75_000);
  });

  it('FDR with no recordPrincipal: balance untouched (preserves backward compatibility)', () => {
    const after = add(baseState(), {
      name: 'Manual FDR',
      type: 'fdr',
      principal: 50_000,
      rate: 8,
      startDate: '2026-09-02',
      termMonths: 12,
      payoutAccountId: 'a1',
    });

    // The old contract: add() does NOT touch transactions. Existing
    // call sites that manage their own deductions still work.
    expect(after.transactions).toHaveLength(0);
    expect(accountBalance(after.accounts[0], after.transactions)).toBe(100_000);
  });

  it('DPS: recordPrincipal throws (DPS has no lump-sum)', () => {
    expect(() => add(baseState(), {
      name: 'DPS #1',
      type: 'dps',
      principal: 0,
      monthlyContribution: 5_000,
      rate: 10,
      startDate: '2026-09-02',
      termMonths: 36,
      payoutAccountId: 'a1',
    }, { recordPrincipal: true })).toThrow(InvestmentError);
  });

  it('FDR + recordPrincipal but no payoutAccountId throws', () => {
    expect(() => add(baseState(), {
      name: 'FDR no-account',
      type: 'fdr',
      principal: 50_000,
      rate: 8,
      startDate: '2026-09-02',
      termMonths: 12,
      // payoutAccountId omitted
    }, { recordPrincipal: true })).toThrow(InvestmentError);
  });

  it('deduction transaction is auto-tagged with the Investment expense category', () => {
    const after = add(baseState(), {
      name: 'FDR tagged',
      type: 'fdr',
      principal: 50_000,
      rate: 8,
      startDate: '2026-09-02',
      termMonths: 12,
      payoutAccountId: 'a1',
    }, { recordPrincipal: true });

    const tx = after.transactions.find(t => t.linkedInvestmentId === after.investments[0].id)!;
    const category = after.categories.find(c => c.id === tx.categoryId);
    expect(category?.name.toLowerCase()).toBe('investment');
  });

  it('deduction transaction falls back to uncategorised if user deleted the Investment category', () => {
    const stateNoCat = baseState({
      categories: DEFAULT_STATE.categories.filter(c => c.name !== 'Investment'),
    });

    const after = add(stateNoCat, {
      name: 'FDR uncategorised',
      type: 'fdr',
      principal: 50_000,
      rate: 8,
      startDate: '2026-09-02',
      termMonths: 12,
      payoutAccountId: 'a1',
    }, { recordPrincipal: true });

    const tx = after.transactions.find(t => t.linkedInvestmentId === after.investments[0].id)!;
    expect(tx.categoryId).toBeUndefined();
  });

  it('deduction transaction carries a useful note', () => {
    const after = add(baseState(), {
      name: 'FDR #note',
      type: 'fdr',
      principal: 50_000,
      rate: 8,
      startDate: '2026-09-02',
      termMonths: 12,
      payoutAccountId: 'a1',
    }, { recordPrincipal: true });

    const tx = after.transactions.find(t => t.linkedInvestmentId === after.investments[0].id)!;
    expect(tx.note).toMatch(/FDR #note/);
  });

  it('regression: full FDR round-trip — create, account reflects, list shows both', () => {
    const after = add(baseState(), {
      name: 'FDR round-trip',
      type: 'fdr',
      principal: 30_000,
      rate: 8.5,
      startDate: '2026-09-02',
      termMonths: 12,
      payoutAccountId: 'a1',
    }, { recordPrincipal: true });

    // Investment is present.
    expect(after.investments).toHaveLength(1);
    expect(after.investments[0].principal).toBe(30_000);

    // Account balance reflects the parked money.
    expect(accountBalance(after.accounts[0], after.transactions)).toBe(70_000);

    // The deduction transaction is in the list and correctly linked.
    const txsForAccount = after.transactions.filter(t => t.accountId === 'a1');
    expect(txsForAccount).toHaveLength(1);
    expect(txsForAccount[0].linkedInvestmentId).toBe(after.investments[0].id);
  });
});

describe('addContribution — auto-tags with Investment category', () => {
  function stateWithInvestment(): State {
    const s = add(baseState(), {
      name: 'DPS for contributions',
      type: 'dps',
      principal: 0,
      monthlyContribution: 5_000,
      rate: 10,
      startDate: '2026-09-02',
      termMonths: 36,
      payoutAccountId: 'a1',
    });
    return s;
  }

  it('uses caller-supplied categoryId when provided (existing behaviour)', () => {
    const s = stateWithInvestment();
    const customCatId = s.categories.find(c => c.name === 'Groceries')!.id;

    const after = addContribution(s, s.investments[0].id, {
      amount: 5_000,
      date: '2026-10-02',
      accountId: 'a1',
      categoryId: customCatId,
    });

    const tx = after.transactions[after.transactions.length - 1];
    expect(tx.categoryId).toBe(customCatId);
  });

  it('falls back to the Investment category when caller omits categoryId', () => {
    const s = stateWithInvestment();
    const after = addContribution(s, s.investments[0].id, {
      amount: 5_000,
      date: '2026-10-02',
      accountId: 'a1',
    });

    const tx = after.transactions[after.transactions.length - 1];
    const cat = s.categories.find(c => c.id === tx.categoryId);
    expect(cat?.name.toLowerCase()).toBe('investment');
  });

  it('leaves transaction uncategorised if user has no Investment category', () => {
    const s = add(stateWithInvestment(), { // remove the Investment category
      name: 'DPS for contributions',
      type: 'dps',
      principal: 0,
      monthlyContribution: 5_000,
      rate: 10,
      startDate: '2026-09-02',
      termMonths: 36,
      payoutAccountId: 'a1',
    }, { recordPrincipal: false });
    // Strip the Investment category manually for this test:
    const stateNoCat: State = {
      ...s,
      categories: s.categories.filter(c => c.name !== 'Investment'),
    };

    const after = addContribution(stateNoCat, stateNoCat.investments[0].id, {
      amount: 5_000,
      date: '2026-10-02',
      accountId: 'a1',
    });

    const tx = after.transactions[after.transactions.length - 1];
    expect(tx.categoryId).toBeUndefined();
  });
});