/**
 * investments.ts — pure CRUD for investments + close + rollover.
 *
 * list() / get() refresh `status` from the date math (R10). Sticky
 * statuses (closed, rolled_over, matured) survive re-derivation.
 *
 * rollover(): creates a new active investment starting the day after the
 * old one's maturity; old becomes 'rolled_over' with rolledIntoId.
 */
import type { Investment, InvestmentType, State } from './types';
import { uid } from './ids';
import { deriveInvestmentStatus, investmentMaturityDate } from './math';

export function list(state: State): Investment[] {
  return state.investments.map(inv => withDerived(inv));
}

export function get(state: State, id: string): Investment | undefined {
  const inv = state.investments.find(i => i.id === id);
  return inv ? withDerived(inv) : undefined;
}

function withDerived(inv: Investment): Investment {
  const next = deriveInvestmentStatus(inv);
  return next === inv.status ? inv : { ...inv, status: next };
}

export interface AddInvestmentInput {
  name: string;
  type: InvestmentType;
  principal: number;
  rate: number;
  startDate: string;
  termMonths: number;
  payoutAccountId?: string;
  institution?: string;
}

export function add(state: State, input: AddInvestmentInput): State {
  if (!(Number(input.principal) > 0)) throw new Error('Principal must be positive.');
  if (!(Number(input.rate) >= 0)) throw new Error('Rate must be non-negative.');
  if (!(Number(input.termMonths) > 0)) throw new Error('Term must be positive (months).');
  const inv: Investment = {
    id: uid(),
    name: input.name.trim(),
    type: input.type,
    principal: Number(input.principal),
    rate: Number(input.rate),
    startDate: input.startDate,
    termMonths: Number(input.termMonths),
    payoutAccountId: input.payoutAccountId,
    institution: input.institution?.trim() || undefined,
    status: 'active',
    createdAt: new Date().toISOString().slice(0, 10),
  };
  return { ...state, investments: [...state.investments, inv] };
}

export function update(state: State, id: string, patch: Partial<AddInvestmentInput>): State {
  return { ...state, investments: state.investments.map(i => i.id === id ? { ...i, ...patch } : i) };
}

export function remove(state: State, id: string): State {
  return { ...state, investments: state.investments.filter(i => i.id !== id) };
}

export function close(state: State, id: string): State {
  return { ...state, investments: state.investments.map(i => i.id === id ? { ...i, status: 'closed' as const } : i) };
}

/** Roll over an existing investment into a new one. */
export function rollover(state: State, oldId: string): State {
  const old = state.investments.find(i => i.id === oldId);
  if (!old) throw new Error(`Investment not found: ${oldId}`);
  const mat = investmentMaturityDate(old);
  if (!mat) throw new Error('Cannot roll over — no maturity date.');
  // Day after old maturity.
  const next = new Date(mat.getTime() + 86_400_000);
  const nextStart = next.toISOString().slice(0, 10);
  const replacement: Investment = {
    id: uid(),
    name: old.name,
    type: old.type,
    principal: old.principal,
    rate: old.rate,
    startDate: nextStart,
    termMonths: old.termMonths,
    payoutAccountId: old.payoutAccountId,
    institution: old.institution,
    status: 'active',
    createdAt: new Date().toISOString().slice(0, 10),
  };
  return {
    ...state,
    investments: [
      ...state.investments.map(i => i.id === oldId ? { ...i, status: 'rolled_over' as const, rolledIntoId: replacement.id } : i),
      replacement,
    ],
  };
}