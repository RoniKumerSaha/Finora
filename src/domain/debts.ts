/**
 * debts.ts — pure CRUD for debts + archive.
 *
 * list() and get() compute paidSoFar from transactions and auto-flip
 * status to 'completed' when paidSoFar >= total (R8). Stored paidSoFar is
 * a cache; recompute.js refreshes it on every load.
 */
import type { Debt, DebtDirection, State } from './types';
import { uid } from './ids';
import { debtPaidSoFar, isDebtCompleted } from './math';

export function list(state: State): Debt[] {
  return state.debts.map(d => withDerived(d, state));
}

export function get(state: State, id: string): Debt | undefined {
  const d = state.debts.find(x => x.id === id);
  return d ? withDerived(d, state) : undefined;
}

function withDerived(d: Debt, state: State): Debt {
  const paid = debtPaidSoFar(d, state.transactions);
  const total = Number(d.total) || 0;
  const next: Debt = { ...d, paidSoFar: paid };
  if (d.status === 'active' && paid >= total) next.status = 'completed';
  return next;
}

export interface AddDebtInput {
  name: string;
  direction: DebtDirection;
  total: number;
  dueDate?: string;
  person?: string;
}

export function add(state: State, input: AddDebtInput): State {
  if (!(Number(input.total) > 0)) throw new Error('Debt total must be positive.');
  const debt: Debt = {
    id: uid(),
    name: input.name.trim(),
    direction: input.direction,
    total: Number(input.total),
    paidSoFar: 0,
    dueDate: input.dueDate,
    person: input.person?.trim() || undefined,
    status: 'active',
    createdAt: new Date().toISOString().slice(0, 10),
  };
  return { ...state, debts: [...state.debts, debt] };
}

export function update(state: State, id: string, patch: Partial<AddDebtInput>): State {
  return { ...state, debts: state.debts.map(d => d.id === id ? { ...d, ...patch } : d) };
}

export function remove(state: State, id: string): State {
  return { ...state, debts: state.debts.filter(d => d.id !== id) };
}

export function archive(state: State, id: string): State {
  return update(state, id, {}).debts.length
    ? { ...state, debts: state.debts.map(d => d.id === id ? { ...d, status: 'archived' as const } : d) }
    : state;
}

export { isDebtCompleted };