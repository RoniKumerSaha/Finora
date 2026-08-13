/**
 * goals.ts — pure CRUD for goals + addContribution.
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
  saved?: number;
  targetDate: string;
}

export function add(state: State, input: AddGoalInput): State {
  if (!(Number(input.target) > 0)) throw new GoalError('Goal target must be positive.');
  if (input.saved != null && Number(input.saved) < 0) throw new GoalError('Saved cannot be negative.');
  const goal: Goal = {
    id: uid(),
    name: input.name.trim(),
    target: Number(input.target),
    saved: Number(input.saved) || 0,
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

export function addContribution(state: State, id: string, amount: number): State {
  if (!(Number(amount) > 0)) throw new GoalError('Contribution must be positive.');
  return update(state, id, { saved: (get(state, id)?.saved || 0) + Number(amount) });
}