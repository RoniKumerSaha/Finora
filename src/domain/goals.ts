/**
 * goals.ts — pure CRUD for savings goals.
 *
 * R6 discipline: `goal.saved` is now derived from transactions where
 * `linkedGoalId === goal.id`. There is no longer a stored `saved` field
 * mutation. To contribute, the caller adds an `expense` transaction with
 * `linkedGoalId: goal.id` — the math layer reads it back via
 * `goalSavedFromTxns()`.
 *
 * `addContribution` is retained as a convenience helper that:
 *   1. Validates the goal exists
 *   2. Creates the linked expense transaction
 *   3. Returns the new state
 */
import type { Goal, State } from './types';
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
  saved?: number;   // legacy — R6 derives from transactions instead
  targetDate: string;
}

export function add(state: State, input: AddGoalInput): State {
  if (!(Number(input.target) > 0)) throw new GoalError('Goal target must be positive.');
  if (input.saved != null && Number(input.saved) < 0) throw new GoalError('Saved cannot be negative.');
  const goal: Goal = {
    id: uid(),
    name: input.name.trim(),
    target: Number(input.target),
    saved: Number(input.saved) || 0,   // legacy; kept for v1 reads
    targetDate: input.targetDate,
    createdAt: new Date().toISOString().slice(0, 10),
  };
  return { ...state, goals: [...state.goals, goal] };
}

export function update(state: State, id: string, patch: Partial<AddGoalInput>): State {
  return {
    ...state,
    goals: state.goals.map(g => g.id === id ? { ...g, ...patch } : g),
  };
}

export function remove(state: State, id: string): State {
  return { ...state, goals: state.goals.filter(g => g.id !== id) };
}

export interface ContributeInput {
  amount: number;
  date: string;            // "YYYY-MM-DD"
  accountId: string;       // expense must hit an account
  categoryId?: string;
  note?: string;
}

/**
 * Contribute to a goal by recording an expense transaction with
 * `linkedGoalId === goal.id`. The goal's `saved` value is derived from
 * these transactions — this function does NOT mutate any goal field.
 *
 * Throws GoalError if the goal is missing or the account is missing.
 */
export function addContribution(state: State, goalId: string, input: ContributeInput): State {
  const goal = get(state, goalId);
  if (!goal) throw new GoalError(`Goal not found: ${goalId}`);
  if (!(Number(input.amount) > 0)) throw new GoalError('Contribution must be positive.');
  if (!input.accountId) throw new GoalError('Contribution requires an account.');
  if (!state.accounts.some(a => a.id === input.accountId)) {
    throw new GoalError(`Account not found: ${input.accountId}`);
  }
  const tx = {
    id: uid(),
    type: 'expense' as const,
    amount: Number(input.amount),
    date: input.date,
    accountId: input.accountId,
    categoryId: input.categoryId,
    linkedGoalId: goalId,
    note: input.note?.trim() || undefined,
  };
  return { ...state, transactions: [...state.transactions, tx] };
}