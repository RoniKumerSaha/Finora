/**
 * goals.js — CRUD for the `goals` collection.
 *
 * Savings goals track a target, a `saved` running total, and a target date.
 * The `saved` field is the only mutable "user-tracked" derived value in the
 * data layer — it's bumped as the user records contributions. (We don't
 * auto-create linked transactions for goals per PRD §9.5.)
 */

import { uid } from './ids.js';

/** All goals in insertion order. */
export function list(state) {
  return state.goals || [];
}

/** One goal by id, or undefined. */
export function get(state, id) {
  return list(state).find(g => g.id === id);
}

/**
 * Create a goal.
 * @param state
 * @param fields — { name, target, targetDate, saved?, notes? }
 * @throws if name missing, target <= 0, or targetDate missing.
 */
export function add(state, fields) {
  const name = (fields?.name || '').trim();
  if (!name) throw new Error('Goal name is required.');
  const target = Number(fields.target);
  if (!Number.isFinite(target) || target <= 0) {
    throw new Error(`Goal target must be > 0 (got ${fields.target}).`);
  }
  if (!fields.targetDate) {
    throw new Error('Goal targetDate is required.');
  }
  const goal = {
    id: uid(),
    name,
    target,
    saved: Number(fields.saved) || 0,
    targetDate: fields.targetDate,
    notes: fields.notes || null,
    createdAt: new Date().toISOString(),
  };
  return { state: { ...state, goals: [...list(state), goal] }, goal };
}

/** Update goal by id. */
export function update(state, id, patch) {
  const idx = list(state).findIndex(g => g.id === id);
  if (idx < 0) throw new Error(`Goal not found: ${id}`);
  const prev = list(state)[idx];
  const next = {
    ...prev,
    ...(patch.name !== undefined ? { name: String(patch.name).trim() } : {}),
    ...(patch.target !== undefined
        ? { target: Number(patch.target) || 0 }
        : {}),
    ...(patch.saved !== undefined
        ? { saved: Number(patch.saved) || 0 }
        : {}),
    ...(patch.targetDate !== undefined ? { targetDate: patch.targetDate } : {}),
    ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
    updatedAt: new Date().toISOString(),
  };
  const goals = list(state).slice();
  goals[idx] = next;
  return { state: { ...state, goals }, goal: next };
}

/** Add to a goal's `saved` amount (positive contribution only). */
export function addContribution(state, id, amount) {
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) {
    throw new Error(`Contribution must be > 0 (got ${amount}).`);
  }
  const goal = get(state, id);
  if (!goal) throw new Error(`Goal not found: ${id}`);
  return update(state, id, { saved: (Number(goal.saved) || 0) + amt });
}

/** Permanently delete a goal. */
export function remove(state, id) {
  return { ...state, goals: list(state).filter(g => g.id !== id) };
}
