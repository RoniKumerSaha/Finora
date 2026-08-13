/**
 * debts.js — CRUD for the `debts` collection.
 *
 * Per PRD §9.7 + §10 R7/R8:
 *   - Debt record stores: id, name, direction, total, dueDate?, person?, status, createdAt.
 *   - `paidSoFar` is auto-derived from linked transactions by direction:
 *       i_owe       → sum of linked EXPENSE transactions
 *       owed_to_me  → sum of linked INCOME transactions
 *   - When paidSoFar >= total, status auto-flips to "completed".
 *   - The CRUD layer exposes paidSoFar as a *displayed* value on list/get,
 *     computed on demand from the transactions collection.
 */

import { uid } from './ids.js';
import { debtPaidSoFar } from './math.js';

const VALID_DIRECTIONS = new Set(['i_owe', 'owed_to_me']);
const VALID_STATUSES = new Set(['active', 'completed', 'archived']);

/** Internal — list the raw debt records without derived fields. */
function rawList(state) {
  return state.debts || [];
}

/**
 * Public — list debts with derived fields computed.
 * Each returned debt includes a fresh `paidSoFar` (number) derived from the
 * linked transactions in state.transactions. The `status` field is also
 * recomputed: any active debt with paidSoFar >= total becomes 'completed'.
 */
export function list(state) {
  return rawList(state).map(d => withDerived(d, state));
}

/** One debt by id, with derived fields. */
export function get(state, id) {
  const d = rawList(state).find(x => x.id === id);
  return d ? withDerived(d, state) : undefined;
}

/**
 * Add a debt.
 * @param fields — { name, direction, total, dueDate?, person? }
 */
export function add(state, fields) {
  const name = (fields?.name || '').trim();
  if (!name) throw new Error('Debt name is required.');
  const direction = fields.direction;
  if (!VALID_DIRECTIONS.has(direction)) {
    throw new Error(`Invalid direction: ${direction}. Must be i_owe or owed_to_me.`);
  }
  const total = Number(fields.total);
  if (!Number.isFinite(total) || total <= 0) {
    throw new Error(`Debt total must be > 0 (got ${fields.total}).`);
  }
  const debt = {
    id: uid(),
    name,
    direction,
    total,
    dueDate: fields.dueDate || null,
    person: fields.person || null,
    status: 'active',
    createdAt: new Date().toISOString(),
  };
  return { state: { ...state, debts: [...rawList(state), debt] }, debt };
}

/**
 * Update a debt. Provided fields overwrite stored fields.
 * Note: editing `total` downward may auto-trigger 'completed' if the linked
 * transactions already exceed the new total.
 */
export function update(state, id, patch) {
  const idx = rawList(state).findIndex(d => d.id === id);
  if (idx < 0) throw new Error(`Debt not found: ${id}`);
  const prev = rawList(state)[idx];
  const next = {
    ...prev,
    ...(patch.name !== undefined ? { name: String(patch.name).trim() } : {}),
    ...(patch.direction !== undefined ? { direction: patch.direction } : {}),
    ...(patch.total !== undefined
        ? { total: Number(patch.total) || 0 }
        : {}),
    ...(patch.dueDate !== undefined ? { dueDate: patch.dueDate } : {}),
    ...(patch.person !== undefined ? { person: patch.person } : {}),
    ...(patch.status !== undefined && VALID_STATUSES.has(patch.status)
        ? { status: patch.status }
        : {}),
    updatedAt: new Date().toISOString(),
  };
  const debts = rawList(state).slice();
  debts[idx] = next;
  return { state: { ...state, debts }, debt: withDerived(next, state) };
}

/** Soft-archive (status = 'archived'). Transactions stay linked. */
export function archive(state, id) {
  return update(state, id, { status: 'archived' });
}

/**
 * Permanently delete a debt.
 * Linked transactions are NOT touched — they keep their linkedDebtId pointer
 * (and the UI shows "Archived debt" tag per PRD §9.7).
 */
export function remove(state, id) {
  return { ...state, debts: rawList(state).filter(d => d.id !== id) };
}

// ---------- internal ----------

/** Return a debt record with `paidSoFar` and auto-computed status attached. */
function withDerived(debt, state) {
  const paidSoFar = debtPaidSoFar(debt, state.transactions || []);
  let status = debt.status || 'active';
  if (status === 'active' && paidSoFar >= (Number(debt.total) || 0) && (Number(debt.total) || 0) > 0) {
    status = 'completed';
  }
  return { ...debt, paidSoFar, status };
}