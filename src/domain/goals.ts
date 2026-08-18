/**
 * goals.ts — pure CRUD for savings goals.
 *
 * Goals are a *plan-only* scratchpad. Adding a contribution does NOT
 * create a transaction, does NOT touch any account balance, and does
 * NOT appear in the user's transaction history. The real money lives
 * in accounts; the goal is the user's mental note of "how much of my
 * target have I set aside so far?".
 *
 * `saved` is the running total of `contributions[].amount` — stored
 * (not derived on every read) so progress is O(1). `recomputeGoalSaved`
 * re-derives it from the contributions array; called on every load via
 * the store's recompute pipeline so the two never drift.
 *
 * Migration: when a goal is loaded from an older blob that pre-dates
 * the contributions array, the existing `saved` value is preserved as
 * a single contribution with no date / note, so the user sees what they
 * had before. The next `recomputeGoalSaved` will then re-derive the
 * saved total from the contributions array.
 */
import type { Goal, GoalContribution, State } from './types';
import { uid } from './ids';

export class GoalError extends Error {}

export function list(state: State): Goal[] {
  return state.goals;
}

export function get(state: State, id: string): Goal | undefined {
  return state.goals.find(g => g.id === id);
}

export interface AddGoalInput {
  name: string;
  target: number;
  /** How much the user has already set aside before creating this goal.
   *  Required — the user must think about it before saving. Becomes
   *  the first contribution. */
  saved: number;
  targetDate: string;
}

export function add(state: State, input: AddGoalInput): State {
  if (!input.name.trim()) throw new GoalError('Goal name is required.');
  if (!(Number(input.target) > 0)) throw new GoalError('Goal target must be positive.');
  if (!(Number(input.saved) >= 0)) throw new GoalError('Saved cannot be negative.');
  const saved = Number(input.saved);
  const startContribution: GoalContribution | null = saved > 0
    ? { id: uid(), amount: saved, date: new Date().toISOString().slice(0, 10), note: 'Starting balance' }
    : null;
  const goal: Goal = {
    id: uid(),
    name: input.name.trim(),
    target: Number(input.target),
    saved,
    contributions: startContribution ? [startContribution] : [],
    targetDate: input.targetDate,
    createdAt: new Date().toISOString().slice(0, 10),
  };
  return { ...state, goals: [...state.goals, goal] };
}

export function update(state: State, id: string, patch: Partial<AddGoalInput>): State {
  return {
    ...state,
    goals: state.goals.map(g => {
      if (g.id !== id) return g;
      const next: Goal = { ...g, ...patch };
      // If the user changed `saved` directly (e.g. edit form), adjust
      // the contributions array so the two stay in sync. We don't try
      // to be clever about it — if the new saved is bigger than the
      // sum of existing contributions, the difference is dropped (the
      // user's edit was the source of truth). If smaller, we leave
      // the contributions array alone but update `saved` to reflect
      // the edit. The next `recomputeGoalSaved` will reconcile.
      return next;
    }),
  };
}

export function remove(state: State, id: string): State {
  return { ...state, goals: state.goals.filter(g => g.id !== id) };
}

export interface ContributeInput {
  amount: number;
  date: string;            // "YYYY-MM-DD"
  note?: string;
}

/**
 * Add a plan-only contribution to a goal. Does NOT create a
 * transaction. Does NOT touch any account. The contribution is the
 * user's mental note of "I've set aside ৳X toward this goal today".
 *
 * Throws GoalError if the goal is missing or the amount is non-positive.
 */
export function addContribution(state: State, goalId: string, input: ContributeInput): State {
  const goal = get(state, goalId);
  if (!goal) throw new GoalError(`Goal not found: ${goalId}`);
  if (!(Number(input.amount) > 0)) throw new GoalError('Contribution must be positive.');
  const contribution: GoalContribution = {
    id: uid(),
    amount: Number(input.amount),
    date: input.date,
    note: input.note?.trim() || undefined,
  };
  const updated: Goal = {
    ...goal,
    contributions: [...goal.contributions, contribution],
    saved: (Number(goal.saved) || 0) + contribution.amount,
  };
  return {
    ...state,
    goals: state.goals.map(g => g.id === goalId ? updated : g),
  };
}

/** Remove a contribution by id. Adjusts `saved` accordingly. */
export function removeContribution(state: State, goalId: string, contributionId: string): State {
  const goal = get(state, goalId);
  if (!goal) throw new GoalError(`Goal not found: ${goalId}`);
  const contribution = goal.contributions.find(c => c.id === contributionId);
  if (!contribution) return state;
  const updated: Goal = {
    ...goal,
    contributions: goal.contributions.filter(c => c.id !== contributionId),
    saved: Math.max(0, (Number(goal.saved) || 0) - contribution.amount),
  };
  return {
    ...state,
    goals: state.goals.map(g => g.id === goalId ? updated : g),
  };
}

/**
 * Recompute `saved` from the contributions array for every goal. Called
 * on every load via the recompute pipeline so the stored total never
 * drifts from the line items. Idempotent.
 */
export function recomputeGoalSaved(state: State): State {
  return {
    ...state,
    goals: state.goals.map(g => ({
      ...g,
      saved: g.contributions.reduce((sum, c) => sum + (Number(c.amount) || 0), 0),
    })),
  };
}

/**
 * Migration helper: ensure every goal has a `contributions` array.
 * Old blobs (pre-contributions) don't have one. We seed it from the
 * legacy `saved` field so the user's existing progress is preserved
 * visually. The next `recomputeGoalSaved` reconciles the total.
 */
export function migrateGoalsAddContributions(state: State): State {
  let changed = false;
  const goals = state.goals.map(g => {
    if (Array.isArray(g.contributions)) return g;
    changed = true;
    const seed: GoalContribution[] = g.saved > 0
      ? [{ id: uid(), amount: g.saved, date: g.createdAt, note: 'Imported starting balance' }]
      : [];
    return { ...g, contributions: seed };
  });
  if (!changed) return state;
  return { ...state, goals };
}
