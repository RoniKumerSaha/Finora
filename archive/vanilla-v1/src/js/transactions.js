/**
 * transactions.js — CRUD for the `transactions` collection.
 *
 * Per AD-9: transactions are the only collection that holds money movement.
 * Linked fields (`linkedDebtId`, `linkedInvestmentId`) are one-way pointers
 * from the transaction to its entity. Amounts are always stored positive;
 * the `type` determines direction.
 */

import { uid } from './ids.js';

const VALID_TYPES = new Set(['income', 'expense', 'transfer']);

/** All transactions, optionally filtered by predicate. */
export function list(state, filterFn = null) {
  const all = state.transactions || [];
  return filterFn ? all.filter(filterFn) : all;
}

/** Transactions of a given type on a given account. */
export function listForAccount(state, accountId, type = null) {
  return list(state, tx => {
    if (type && tx.type !== type) return false;
    if (tx.type === 'transfer') {
      return tx.fromAccountId === accountId || tx.toAccountId === accountId;
    }
    return tx.accountId === accountId;
  });
}

/**
 * Add a transaction.
 * Field shape depends on type:
 *   income  — { type:'income',  amount, date, accountId, categoryId?, note? }
 *   expense — { type:'expense', amount, date, accountId, categoryId?, note? }
 *   transfer— { type:'transfer',amount, date, fromAccountId, toAccountId, note? }
 *
 * Optional one-way links: linkedDebtId, linkedInvestmentId.
 *
 * @returns { state, transaction }
 * @throws on missing fields or non-positive amount.
 */
export function add(state, fields) {
  if (!fields || !VALID_TYPES.has(fields.type)) {
    throw new Error(`Invalid transaction type: ${fields?.type}. Must be income, expense, or transfer.`);
  }
  const amount = Number(fields.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`Transaction amount must be > 0 (got ${fields.amount}).`);
  }
  const date = fields.date || new Date().toISOString().slice(0, 10);

  const base = { id: uid(), type: fields.type, amount, date, note: fields.note || null };

  let tx;
  if (fields.type === 'transfer') {
    if (!fields.fromAccountId || !fields.toAccountId) {
      throw new Error('Transfer requires fromAccountId and toAccountId.');
    }
    if (fields.fromAccountId === fields.toAccountId) {
      throw new Error('Transfer from and to accounts must differ.');
    }
    tx = { ...base, fromAccountId: fields.fromAccountId, toAccountId: fields.toAccountId };
  } else {
    if (!fields.accountId) throw new Error(`${fields.type} transaction requires accountId.`);
    tx = {
      ...base,
      accountId: fields.accountId,
      categoryId: fields.categoryId || null,
    };
  }

  // Optional one-way links.
  if (fields.linkedDebtId) tx.linkedDebtId = fields.linkedDebtId;
  if (fields.linkedInvestmentId) tx.linkedInvestmentId = fields.linkedInvestmentId;

  return {
    state: { ...state, transactions: [...list(state), tx] },
    transaction: tx,
  };
}

/** Update a transaction. Only the listed mutable fields are writable. */
export function update(state, id, patch) {
  const idx = list(state).findIndex(t => t.id === id);
  if (idx < 0) throw new Error(`Transaction not found: ${id}`);
  const prev = list(state)[idx];
  const next = { ...prev };
  if (patch.amount !== undefined) {
    const amt = Number(patch.amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      throw new Error(`Transaction amount must be > 0 (got ${patch.amount}).`);
    }
    next.amount = amt;
  }
  if (patch.date !== undefined) next.date = patch.date;
  if (patch.note !== undefined) next.note = patch.note;
  if (patch.categoryId !== undefined) next.categoryId = patch.categoryId;
  if (patch.accountId !== undefined) next.accountId = patch.accountId;
  if (patch.linkedDebtId !== undefined) next.linkedDebtId = patch.linkedDebtId;
  if (patch.linkedInvestmentId !== undefined) next.linkedInvestmentId = patch.linkedInvestmentId;
  const transactions = list(state).slice();
  transactions[idx] = next;
  return { state: { ...state, transactions }, transaction: next };
}

/** Permanently delete a transaction. */
export function remove(state, id) {
  return { ...state, transactions: list(state).filter(t => t.id !== id) };
}
