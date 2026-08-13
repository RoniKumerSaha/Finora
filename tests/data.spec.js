import { describe, it, expect, beforeEach } from 'vitest';
import * as accounts from '../src/js/accounts.js';
import * as transactions from '../src/js/transactions.js';
import * as goals from '../src/js/goals.js';
import * as debts from '../src/js/debts.js';
import * as investments from '../src/js/investments.js';
import { recomputeDerived } from '../src/js/recompute.js';
import { load, save, clear, DEFAULT_STATE, STORAGE_KEY } from '../src/js/persistence.js';

function freshState() {
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

// Convenience: build an account, return both the new state and the account.
function seedAccount(state, fields = { name: 'Cash', type: 'cash', openingBalance: 0 }) {
  return accounts.add(state, fields);
}

describe('accounts', () => {
  let state;
  beforeEach(() => { state = freshState(); });

  it('add returns { state, account } with id, name, createdAt', () => {
    const { state: s, account } = accounts.add(state, { name: 'Cash', type: 'cash' });
    expect(account.id).toBeTruthy();
    expect(account.name).toBe('Cash');
    expect(account.type).toBe('cash');
    expect(account.createdAt).toBeTruthy();
    expect(s.accounts).toHaveLength(1);
  });

  it('list and get round-trip', () => {
    const { state: s, account } = seedAccount(state);
    expect(accounts.list(s)).toHaveLength(1);
    expect(accounts.get(s, account.id)).toEqual(account);
    expect(accounts.get(s, 'nope')).toBeUndefined();
  });

  it('rejects empty name', () => {
    expect(() => accounts.add(state, { name: '   ', type: 'cash' })).toThrow(/name is required/);
  });

  it('rejects invalid type', () => {
    expect(() => accounts.add(state, { name: 'X', type: 'crypto' })).toThrow(/Invalid account type/);
  });

  it('update patches only provided fields', () => {
    const { state: s, account } = seedAccount(state);
    const { state: s2, account: a2 } = accounts.update(s, account.id, { name: 'Pocket' });
    expect(a2.name).toBe('Pocket');
    expect(a2.type).toBe(account.type);
    expect(s2.accounts[0].updatedAt).toBeTruthy();
  });

  it('remove rejects when transactions reference the account', () => {
    let s = seedAccount(state).state;
    s = seedAccount(s, { name: 'Bank', type: 'bank' }).state;
    const accId = accounts.list(s)[0].id;
    s = transactions.add(s, { type: 'expense', amount: 100, accountId: accId, date: '2026-08-01' }).state;
    expect(() => accounts.remove(s, accId)).toThrow(/transaction/i);
  });

  it('remove succeeds when no transactions reference it', () => {
    const { state: s, account } = seedAccount(state);
    const s2 = accounts.remove(s, account.id);
    expect(s2.accounts).toHaveLength(0);
  });
});

describe('transactions', () => {
  let state;
  let acc1, acc2;
  beforeEach(() => {
    state = freshState();
    let r = seedAccount(state, { name: 'Cash', type: 'cash', openingBalance: 1000 });
    state = r.state; acc1 = r.account;
    r = seedAccount(state, { name: 'Bank', type: 'bank', openingBalance: 5000 });
    state = r.state; acc2 = r.account;
  });

  it('add income with required fields', () => {
    const { state: s, transaction } = transactions.add(state, {
      type: 'income', amount: 5000, accountId: acc1.id, date: '2026-08-01', note: 'salary'
    });
    expect(transaction.type).toBe('income');
    expect(transaction.amount).toBe(5000);
    expect(transaction.accountId).toBe(acc1.id);
    expect(s.transactions).toHaveLength(1);
  });

  it('add expense with required fields', () => {
    const { transaction } = transactions.add(state, {
      type: 'expense', amount: 250, accountId: acc1.id, date: '2026-08-02', categoryId: 'food'
    });
    expect(transaction.categoryId).toBe('food');
  });

  it('add transfer requires from and to', () => {
    expect(() => transactions.add(state, {
      type: 'transfer', amount: 100, fromAccountId: acc1.id
    })).toThrow(/toAccountId/);

    expect(() => transactions.add(state, {
      type: 'transfer', amount: 100, fromAccountId: acc1.id, toAccountId: acc1.id
    })).toThrow(/must differ/);
  });

  it('rejects non-positive amount', () => {
    expect(() => transactions.add(state, {
      type: 'expense', amount: 0, accountId: acc1.id
    })).toThrow(/> 0/);
    expect(() => transactions.add(state, {
      type: 'expense', amount: -5, accountId: acc1.id
    })).toThrow(/> 0/);
  });

  it('update mutates allowed fields', () => {
    const { state: s, transaction } = transactions.add(state, {
      type: 'expense', amount: 100, accountId: acc1.id, date: '2026-08-01'
    });
    const { state: s2, transaction: t2 } = transactions.update(s, transaction.id, {
      amount: 200, note: 'updated'
    });
    expect(t2.amount).toBe(200);
    expect(t2.note).toBe('updated');
    expect(s2.transactions[0].amount).toBe(200);
  });

  it('listForAccount finds income/expense by accountId and transfer by either side', () => {
    let s = transactions.add(state, {
      type: 'income', amount: 1000, accountId: acc1.id, date: '2026-08-01'
    }).state;
    s = transactions.add(s, {
      type: 'transfer', amount: 200, fromAccountId: acc1.id, toAccountId: acc2.id, date: '2026-08-02'
    }).state;
    s = transactions.add(s, {
      type: 'income', amount: 999, accountId: acc2.id, date: '2026-08-03'
    }).state;
    expect(transactions.listForAccount(s, acc1.id)).toHaveLength(2);
    expect(transactions.listForAccount(s, acc2.id)).toHaveLength(2);
  });

  it('remove drops the transaction', () => {
    const { state: s, transaction } = transactions.add(state, {
      type: 'expense', amount: 100, accountId: acc1.id, date: '2026-08-01'
    });
    const s2 = transactions.remove(s, transaction.id);
    expect(s2.transactions).toHaveLength(0);
  });
});

describe('goals', () => {
  let state;
  beforeEach(() => { state = freshState(); });

  it('add creates with required fields', () => {
    const { state: s, goal } = goals.add(state, {
      name: 'Emergency', target: 50000, targetDate: '2027-01-01'
    });
    expect(goal.saved).toBe(0);
    expect(goal.target).toBe(50000);
    expect(s.goals).toHaveLength(1);
  });

  it('add rejects target <= 0', () => {
    expect(() => goals.add(state, {
      name: 'X', target: 0, targetDate: '2027-01-01'
    })).toThrow(/> 0/);
  });

  it('addContribution bumps saved', () => {
    const { state: s, goal } = goals.add(state, {
      name: 'Emergency', target: 50000, targetDate: '2027-01-01'
    });
    const { state: s2, goal: g2 } = goals.addContribution(s, goal.id, 5000);
    expect(g2.saved).toBe(5000);
    const { goal: g3 } = goals.addContribution(s2, goal.id, 7500);
    expect(g3.saved).toBe(12500);
  });

  it('addContribution rejects non-positive amount', () => {
    const { state: s, goal } = goals.add(state, {
      name: 'X', target: 100, targetDate: '2027-01-01'
    });
    expect(() => goals.addContribution(s, goal.id, 0)).toThrow(/> 0/);
    expect(() => goals.addContribution(s, goal.id, -1)).toThrow(/> 0/);
  });
});

describe('debts — CRUD + R7/R8 derived', () => {
  let state, cash;
  beforeEach(() => {
    state = freshState();
    const r = seedAccount(state, { name: 'Cash', type: 'cash', openingBalance: 0 });
    state = r.state; cash = r.account;
  });

  it('add creates an active debt', () => {
    const { state: s, debt } = debts.add(state, {
      name: 'City loan', direction: 'i_owe', total: 50000, person: 'City Bank'
    });
    expect(debt.status).toBe('active');
    expect(debt.direction).toBe('i_owe');
    expect(s.debts).toHaveLength(1);
  });

  it('rejects invalid direction', () => {
    expect(() => debts.add(state, {
      name: 'X', direction: 'someone_else', total: 100
    })).toThrow(/direction/);
  });

  it('R7: paidSoFar computed from linked transactions by direction', () => {
    let s = debts.add(state, { name: 'Loan', direction: 'i_owe', total: 10000 }).state;
    let debt = debts.list(s)[0];
    s = transactions.add(s, {
      type: 'expense', amount: 3000, accountId: cash.id, date: '2026-08-01', linkedDebtId: debt.id
    }).state;
    s = transactions.add(s, {
      type: 'expense', amount: 2000, accountId: cash.id, date: '2026-08-15', linkedDebtId: debt.id
    }).state;
    // Income for an i_owe debt should NOT count.
    s = transactions.add(s, {
      type: 'income', amount: 999, accountId: cash.id, date: '2026-08-20', linkedDebtId: debt.id
    }).state;
    debt = debts.list(s)[0];
    expect(debt.paidSoFar).toBe(5000);
  });

  it('R8: status auto-flips to "completed" when paidSoFar >= total', () => {
    let s = debts.add(state, { name: 'Loan', direction: 'i_owe', total: 5000 }).state;
    let debt = debts.list(s)[0];
    s = transactions.add(s, {
      type: 'expense', amount: 5000, accountId: cash.id, date: '2026-08-01', linkedDebtId: debt.id
    }).state;
    debt = debts.list(s)[0];
    expect(debt.status).toBe('completed');
    expect(debt.paidSoFar).toBe(5000);
  });

  it('R7: owed_to_me counts linked income transactions', () => {
    let s = debts.add(state, { name: 'Sumi loan', direction: 'owed_to_me', total: 8000 }).state;
    let debt = debts.list(s)[0];
    s = transactions.add(s, {
      type: 'income', amount: 3000, accountId: cash.id, date: '2026-08-05', linkedDebtId: debt.id
    }).state;
    debt = debts.list(s)[0];
    expect(debt.paidSoFar).toBe(3000);
  });

  it('archive sets status, paidSoFar keeps computing from linked', () => {
    let s = debts.add(state, { name: 'X', direction: 'i_owe', total: 1000 }).state;
    const debtId = debts.list(s)[0].id;
    s = debts.archive(s, debtId).state;
    s = transactions.add(s, {
      type: 'expense', amount: 500, accountId: cash.id, date: '2026-08-01', linkedDebtId: debtId
    }).state;
    const d = debts.list(s)[0];
    expect(d.status).toBe('archived');
    expect(d.paidSoFar).toBe(500);
  });

  it('remove keeps transactions linked (orphan tag is the UI’s job)', () => {
    let s = debts.add(state, { name: 'X', direction: 'i_owe', total: 1000 }).state;
    const debtId = debts.list(s)[0].id;
    s = transactions.add(s, {
      type: 'expense', amount: 500, accountId: cash.id, date: '2026-08-01', linkedDebtId: debtId
    }).state;
    const s2 = debts.remove(s, debtId);
    expect(s2.debts).toHaveLength(0);
    expect(s2.transactions[0].linkedDebtId).toBe(debtId); // still linked
  });

  it('update with total < paidSoFar flips to completed', () => {
    let s = debts.add(state, { name: 'X', direction: 'i_owe', total: 10000 }).state;
    const debtId = debts.list(s)[0].id;
    s = transactions.add(s, {
      type: 'expense', amount: 8000, accountId: cash.id, date: '2026-08-01', linkedDebtId: debtId
    }).state;
    const { debt: d2 } = debts.update(s, debtId, { total: 5000 });
    expect(d2.status).toBe('completed');
    expect(d2.paidSoFar).toBe(8000);
  });
});

describe('investments — CRUD + R10 status flips', () => {
  let state, acc;
  beforeEach(() => {
    state = freshState();
    const r = seedAccount(state, { name: 'Bank', type: 'bank' });
    state = r.state; acc = r.account;
  });

  it('add creates an active investment', () => {
    const { state: s, investment } = investments.add(state, {
      name: 'DBBL FDR', type: 'fdr', principal: 100000, rate: 9,
      startDate: '2026-08-13', termMonths: 12, payoutAccountId: acc.id
    });
    expect(investment.status).toBe('active');
    expect(investment.rolledIntoId).toBeNull();
    expect(s.investments).toHaveLength(1);
  });

  it('rejects non-positive principal / rate / term', () => {
    const base = { name: 'X', type: 'fdr', principal: 100000, rate: 9,
                   startDate: '2026-08-13', termMonths: 12, payoutAccountId: acc.id };
    expect(() => investments.add(state, { ...base, principal: 0 })).toThrow(/principal/);
    expect(() => investments.add(state, { ...base, rate: -1 })).toThrow(/rate/);
    expect(() => investments.add(state, { ...base, termMonths: 0 })).toThrow(/termMonths/);
    expect(() => investments.add(state, { ...base, termMonths: 1.5 })).toThrow(/termMonths/);
  });

  it('rejects invalid type', () => {
    expect(() => investments.add(state, {
      name: 'X', type: 'stock', principal: 100, rate: 5,
      startDate: '2026-08-13', termMonths: 12, payoutAccountId: acc.id
    })).toThrow(/type/);
  });

  it('R10: status auto-flips to matured on crossing the date', () => {
    let s = investments.add(state, {
      name: 'FDR', type: 'fdr', principal: 100000, rate: 9,
      startDate: '2025-08-13', termMonths: 12, payoutAccountId: acc.id
    }).state;
    expect(investments.list(s, '2026-08-12')[0].status).toBe('active');
    expect(investments.list(s, '2026-08-13')[0].status).toBe('matured');
    expect(investments.list(s, '2030-01-01')[0].status).toBe('matured');
  });

  it('close sets status to closed (sticky)', () => {
    let s = investments.add(state, {
      name: 'FDR', type: 'fdr', principal: 100000, rate: 9,
      startDate: '2025-08-13', termMonths: 12, payoutAccountId: acc.id
    }).state;
    const id = investments.list(s)[0].id;
    s = investments.close(s, id).state;
    expect(investments.list(s, '2030-01-01')[0].status).toBe('closed');
  });

  it('rollover: old becomes rolled_over, new is active starting day after maturity', () => {
    let s = investments.add(state, {
      name: 'FDR', type: 'fdr', principal: 100000, rate: 9,
      startDate: '2025-08-13', termMonths: 12, payoutAccountId: acc.id
    }).state;
    const oldId = investments.list(s)[0].id;
    const r = investments.rollover(s, oldId);
    s = r.state;
    expect(r.oldInvestment.status).toBe('rolled_over');
    expect(r.oldInvestment.rolledIntoId).toBe(r.newInvestment.id);
    expect(r.newInvestment.status).toBe('active');
    // New start date = old maturity (2026-08-13) + 1 day = 2026-08-14
    expect(r.newInvestment.startDate).toBe('2026-08-14');
    expect(r.newInvestment.termMonths).toBe(12);
    expect(r.newInvestment.principal).toBe(100000);
    expect(r.newInvestment.rate).toBe(9);
    expect(s.investments).toHaveLength(2);
  });

  it('rollover: new investment shows as active before its own maturity date', () => {
    let s = investments.add(state, {
      name: 'FDR', type: 'fdr', principal: 100000, rate: 9,
      startDate: '2025-08-13', termMonths: 12, payoutAccountId: acc.id
    }).state;
    const r = investments.rollover(s, investments.list(s)[0].id);
    s = r.state;
    // now = before the new one's maturity (2027-08-14)
    expect(investments.list(s, '2027-08-13')[1].status).toBe('active');
    expect(investments.list(s, '2027-08-14')[1].status).toBe('matured');
  });
});

describe('recomputeDerived', () => {
  it('fills paidSoFar + auto-completes debts on load', () => {
    const state = freshState();
    const r = seedAccount(state, { name: 'Cash', type: 'cash' });
    let s = debts.add(r.state, {
      name: 'Loan', direction: 'i_owe', total: 5000
    }).state;
    const debtId = debts.list(s)[0].id;
    s = transactions.add(s, {
      type: 'expense', amount: 5000, accountId: r.account.id, date: '2026-08-01', linkedDebtId: debtId
    }).state;

    // Strip paidSoFar and force status='active' to simulate a stale blob.
    const stale = JSON.parse(JSON.stringify(s));
    stale.debts[0].paidSoFar = 0;
    stale.debts[0].status = 'active';

    const fresh = recomputeDerived(stale);
    expect(fresh.debts[0].paidSoFar).toBe(5000);
    expect(fresh.debts[0].status).toBe('completed');
  });

  it('flips investments to matured on load', () => {
    const state = freshState();
    const r1 = seedAccount(state, { name: 'Bank' });
    let s = investments.add(r1.state, {
      name: 'FDR', type: 'fdr', principal: 100000, rate: 9,
      startDate: '2024-01-01', termMonths: 12, payoutAccountId: r1.account.id
    }).state;
    const fresh = recomputeDerived(s, '2026-01-01');
    expect(fresh.investments[0].status).toBe('matured');
  });
});

describe('persistence (in-memory storage)', () => {
  function memStorage() {
    const map = new Map();
    return {
      getItem: k => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => map.set(k, String(v)),
      removeItem: k => map.delete(k),
      clear: () => map.clear(),
    };
  }

  it('returns DEFAULT_STATE on empty storage', () => {
    const s = load(memStorage());
    expect(s.version).toBe(1);
    expect(s.accounts).toEqual([]);
    expect(s.settings.theme).toBe('dark');
  });

  it('save then load round-trips', () => {
    const storage = memStorage();
    let s = freshState();
    s = accounts.add(s, { name: 'Cash', type: 'cash', openingBalance: 1000 }).state;
    s = transactions.add(s, {
      type: 'expense', amount: 200, accountId: s.accounts[0].id, date: '2026-08-01'
    }).state;
    save(s, storage);
    const back = load(storage);
    expect(back.accounts[0].name).toBe('Cash');
    expect(back.transactions[0].amount).toBe(200);
  });

  it('load fills derived fields from stale stored data', () => {
    const storage = memStorage();
    let s = freshState();
    const r = seedAccount(s, { name: 'Cash', type: 'cash' });
    s = r.state;
    s = debts.add(s, { name: 'X', direction: 'i_owe', total: 1000 }).state;
    const debtId = s.debts[0].id;
    s = transactions.add(s, {
      type: 'expense', amount: 1000, accountId: r.account.id, date: '2026-08-01', linkedDebtId: debtId
    }).state;
    save(s, storage);

    // Tamper with stored data: clobber the auto-completed status.
    const raw = JSON.parse(storage.getItem(STORAGE_KEY));
    raw.debts[0].status = 'active';
    storage.setItem(STORAGE_KEY, JSON.stringify(raw));

    const back = load(storage);
    expect(back.debts[0].status).toBe('completed');
    expect(back.debts[0].paidSoFar).toBe(1000);
  });

  it('clear wipes storage', () => {
    const storage = memStorage();
    save({ version: 1, foo: 1 }, storage);
    expect(storage.getItem(STORAGE_KEY)).toBeTruthy();
    clear(storage);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('throws on corrupt JSON', () => {
    const storage = memStorage();
    storage.setItem(STORAGE_KEY, 'not json {{');
    expect(() => load(storage)).toThrow(/parse/);
  });
});
