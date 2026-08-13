/**
 * investments.js — CRUD for the `investments` collection.
 *
 * Per PRD §9.8 + §10 R9/R10:
 *   - Stores: id, name, type, principal, rate, startDate, termMonths,
 *     payoutAccountId, institution?, notes?, status, rolledIntoId?, createdAt.
 *   - `maturityValue` and `maturityDate` are NOT stored — always computed
 *     from the stored fields (see math.js).
 *   - `status` is auto-flipped to 'matured' when today >= maturityDate, but
 *     'closed' and 'rolled_over' are sticky once set.
 *   - For DPS, `principal` may be derived from monthly installment, but the
 *     stored value is what matters — this layer treats `principal` as already
 *     finalized.
 */

import { uid } from './ids.js';
import { deriveInvestmentStatus, investmentMaturityDate } from './math.js';

const VALID_TYPES = new Set(['dps', 'fdr', 'other']);
const VALID_STATUSES = new Set(['active', 'matured', 'closed', 'rolled_over']);

function rawList(state) {
  return state.investments || [];
}

/**
 * List investments with auto-derived status. Each item includes:
 *   - status (auto-computed if 'active' and date crossed)
 *   - derived fields live in math.js (maturityValue, maturityDate,
 *     daysToMaturity) — we don't duplicate them on the returned object.
 */
export function list(state, now = new Date()) {
  return rawList(state).map(inv => ({ ...inv, status: deriveInvestmentStatus(inv, now) }));
}

/** One investment by id with derived status. */
export function get(state, id, now = new Date()) {
  const inv = rawList(state).find(x => x.id === id);
  return inv ? { ...inv, status: deriveInvestmentStatus(inv, now) } : undefined;
}

/**
 * Add an investment.
 * @param fields — { name, type, principal, rate, startDate, termMonths,
 *                    payoutAccountId, institution?, notes? }
 */
export function add(state, fields) {
  const name = (fields?.name || '').trim();
  if (!name) throw new Error('Investment name is required.');
  const type = fields.type;
  if (!VALID_TYPES.has(type)) {
    throw new Error(`Invalid investment type: ${type}. Must be dps, fdr, or other.`);
  }
  const principal = Number(fields.principal);
  if (!Number.isFinite(principal) || principal <= 0) {
    throw new Error(`Investment principal must be > 0 (got ${fields.principal}).`);
  }
  const rate = Number(fields.rate);
  if (!Number.isFinite(rate) || rate < 0) {
    throw new Error(`Investment rate must be >= 0 (got ${fields.rate}).`);
  }
  if (!fields.startDate) throw new Error('Investment startDate is required.');
  const termMonths = Number(fields.termMonths);
  if (!Number.isInteger(termMonths) || termMonths <= 0) {
    throw new Error(`Investment termMonths must be a positive integer (got ${fields.termMonths}).`);
  }
  if (!fields.payoutAccountId) throw new Error('Investment payoutAccountId is required.');

  const inv = {
    id: uid(),
    name,
    type,
    principal,
    rate,
    startDate: fields.startDate,
    termMonths,
    payoutAccountId: fields.payoutAccountId,
    institution: fields.institution || null,
    notes: fields.notes || null,
    status: 'active',
    rolledIntoId: null,
    createdAt: new Date().toISOString(),
  };
  return { state: { ...state, investments: [...rawList(state), inv] }, investment: inv };
}

/** Update an investment. Mutates any of the editable stored fields. */
export function update(state, id, patch) {
  const idx = rawList(state).findIndex(i => i.id === id);
  if (idx < 0) throw new Error(`Investment not found: ${id}`);
  const prev = rawList(state)[idx];
  const next = {
    ...prev,
    ...(patch.name !== undefined ? { name: String(patch.name).trim() } : {}),
    ...(patch.principal !== undefined
        ? { principal: Number(patch.principal) || 0 }
        : {}),
    ...(patch.rate !== undefined
        ? { rate: Number(patch.rate) || 0 }
        : {}),
    ...(patch.startDate !== undefined ? { startDate: patch.startDate } : {}),
    ...(patch.termMonths !== undefined
        ? { termMonths: Number(patch.termMonths) || 0 }
        : {}),
    ...(patch.payoutAccountId !== undefined ? { payoutAccountId: patch.payoutAccountId } : {}),
    ...(patch.institution !== undefined ? { institution: patch.institution } : {}),
    ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
    updatedAt: new Date().toISOString(),
  };
  const investments = rawList(state).slice();
  investments[idx] = next;
  return { state: { ...state, investments }, investment: next };
}

/**
 * Mark an investment as closed (e.g. user recorded the payout).
 * Caller is expected to have created the linked Income transaction first
 * via transactions.js — this function only flips the status.
 */
export function close(state, id) {
  const idx = rawList(state).findIndex(i => i.id === id);
  if (idx < 0) throw new Error(`Investment not found: ${id}`);
  const investments = rawList(state).slice();
  investments[idx] = { ...investments[idx], status: 'closed', closedAt: new Date().toISOString() };
  return { state: { ...state, investments }, investment: investments[idx] };
}

/**
 * Roll over a (typically matured) investment.
 * Per PRD §9.8: creates a new investment with same terms, startDate =
 * old.maturityDate + 1 day. Old investment status flips to 'rolled_over'
 * and points rolledIntoId at the new one.
 *
 * @returns { state, oldInvestment, newInvestment }
 */
export function rollover(state, id) {
  const old = rawList(state).find(i => i.id === id);
  if (!old) throw new Error(`Investment not found: ${id}`);
  const mat = investmentMaturityDate(old);
  if (!mat) throw new Error(`Investment has no maturity date: ${id}`);
  // Add one day to the maturity date (UTC midnight + 1 day).
  const newStart = new Date(mat.getTime() + 86400000);
  const newStartISO = newStart.toISOString().slice(0, 10);

  const newInv = {
    id: uid(),
    name: old.name,
    type: old.type,
    principal: old.principal,
    rate: old.rate,
    startDate: newStartISO,
    termMonths: old.termMonths,
    payoutAccountId: old.payoutAccountId,
    institution: old.institution,
    notes: old.notes,
    status: 'active',
    rolledIntoId: null,
    createdAt: new Date().toISOString(),
  };

  const investments = rawList(state).slice();
  const idx = investments.findIndex(i => i.id === id);
  investments[idx] = { ...old, status: 'rolled_over', rolledIntoId: newInv.id };
  investments.push(newInv);

  return {
    state: { ...state, investments },
    oldInvestment: investments[idx],
    newInvestment: newInv,
  };
}

/** Permanently delete an investment. Linked transactions keep their pointer. */
export function remove(state, id) {
  return { ...state, investments: rawList(state).filter(i => i.id !== id) };
}