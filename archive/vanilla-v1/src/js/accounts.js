/**
 * accounts.js — CRUD for the `accounts` collection.
 *
 * Per AD-9: flat collections joined by ID, no derived values stored. Account
 * balance is computed (see math.js#accountBalance). Each create/update
 * stamps a createdAt; updates also bump updatedAt when present.
 */

import { uid } from './ids.js';

const VALID_TYPES = new Set(['cash', 'bank', 'mobile_wallet', 'savings', 'other']);

/** Return all accounts in state.accounts, in insertion order. */
export function list(state) {
  return state.accounts || [];
}

/** Return the account with the given id, or undefined. */
export function get(state, id) {
  return list(state).find(a => a.id === id);
}

/**
 * Create a new account.
 * @param state — current state (will not be mutated)
 * @param fields — { name, type, openingBalance }
 * @returns { state: newState, account }
 * @throws if name missing or type invalid.
 */
export function add(state, fields) {
  const name = (fields?.name || '').trim();
  if (!name) throw new Error('Account name is required.');
  const type = fields.type || 'other';
  if (!VALID_TYPES.has(type)) {
    throw new Error(`Invalid account type: ${type}. Use one of: ${[...VALID_TYPES].join(', ')}.`);
  }
  const openingBalance = Number(fields.openingBalance) || 0;
  const account = {
    id: uid(),
    name,
    type,
    openingBalance,
    createdAt: new Date().toISOString(),
  };
  return {
    state: { ...state, accounts: [...list(state), account] },
    account,
  };
}

/**
 * Update an account by id. Only provided fields are written.
 * @returns { state: newState, account }
 * @throws if account not found.
 */
export function update(state, id, patch) {
  const idx = list(state).findIndex(a => a.id === id);
  if (idx < 0) throw new Error(`Account not found: ${id}`);
  const prev = list(state)[idx];
  const next = {
    ...prev,
    ...(patch.name !== undefined ? { name: String(patch.name).trim() } : {}),
    ...(patch.type !== undefined ? { type: patch.type } : {}),
    ...(patch.openingBalance !== undefined
        ? { openingBalance: Number(patch.openingBalance) || 0 }
        : {}),
    updatedAt: new Date().toISOString(),
  };
  const accounts = list(state).slice();
  accounts[idx] = next;
  return { state: { ...state, accounts }, account: next };
}

/**
 * Delete an account by id.
 * @throws if the account has any transactions linked to it — caller must
 *   reassign or delete those first. (We don't silently orphan links.)
 */
export function remove(state, id) {
  const accounts = list(state);
  const target = accounts.find(a => a.id === id);
  if (!target) throw new Error(`Account not found: ${id}`);
  const linkedTx = (state.transactions || []).filter(tx =>
    tx.accountId === id || tx.fromAccountId === id || tx.toAccountId === id
  );
  if (linkedTx.length > 0) {
    throw new Error(
      `Cannot delete account "${target.name}" — ${linkedTx.length} transaction(s) still reference it.`
    );
  }
  return { ...state, accounts: accounts.filter(a => a.id !== id) };
}
