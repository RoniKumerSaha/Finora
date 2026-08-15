/**
 * investments.ts — pure CRUD for investments + close + rollover.
 *
 * list() / get() refresh `status` from the date math (R10). Sticky
 * statuses (closed, rolled_over, matured) survive re-derivation.
 *
 * rollover(): creates a new active investment starting the day after the
 * old one's maturity; old becomes 'rolled_over' with rolledIntoId.
 *
 * DPS specifics:
 *   - `monthlyContribution` is set at creation time (UI accepts it for
 *     type === 'dps').
 *   - Each actual payment is recorded as an `expense` transaction with
 *     `linkedInvestmentId === investment.id` (via addContribution).
 *   - Maturity value uses annuity-due (math.dpsMaturityValue).
 *   - Current value uses future value of contributions made so far
 *     (math.dpsCurrentValue).
 */
import type { Investment, InvestmentType, State } from './types';
import { uid } from './ids';
import { deriveInvestmentStatus, investmentMaturityDate } from './math';

export class InvestmentError extends Error {}

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
  /** DPS only: required monthly contribution in BDT. Ignored for FDR/savings. */
  monthlyContribution?: number;
  rate: number;
  startDate: string;
  /** Term in whole months. Mutually exclusive with `termDays`. */
  termMonths: number;
  /** Term in whole calendar days (FDR/savings only — for sub-1-month terms).
   *  Mutually exclusive with `termMonths`: exactly one must be set. */
  termDays?: number;
  payoutAccountId?: string;
  institution?: string;
}

export function add(state: State, input: AddInvestmentInput): State {
  const principal = Number(input.principal) || 0;
  if (input.type !== 'dps' && !(principal > 0)) {
    throw new InvestmentError('Principal must be positive for FDR and savings.');
  }
  if (!(Number(input.rate) >= 0)) throw new InvestmentError('Rate must be non-negative.');

  const months = Number(input.termMonths) || 0;
  const days = input.termDays != null ? Number(input.termDays) || 0 : 0;
  const hasMonths = months > 0;
  const hasDays = days > 0;
  if (hasMonths === hasDays) {
    // Both set or neither set — schema also catches this; defense-in-depth.
    throw new InvestmentError('Set exactly one of termMonths or termDays.');
  }
  if (input.type === 'dps' && hasDays) {
    throw new InvestmentError('DPS requires term in months, not days.');
  }

  if (input.type === 'dps'
      && input.monthlyContribution != null
      && !(Number(input.monthlyContribution) > 0)) {
    throw new InvestmentError('Monthly contribution must be positive.');
  }
  const inv: Investment = {
    id: uid(),
    name: input.name.trim(),
    type: input.type,
    principal,
    monthlyContribution: input.type === 'dps'
      ? Number(input.monthlyContribution) || 0
      : undefined,
    rate: Number(input.rate),
    startDate: input.startDate,
    termMonths: hasMonths ? months : 0,
    termDays: hasDays ? days : undefined,
    payoutAccountId: input.payoutAccountId,
    institution: input.institution?.trim() || undefined,
    status: 'active',
    createdAt: new Date().toISOString().slice(0, 10),
  };
  return { ...state, investments: [...state.investments, inv] };
}

export function update(state: State, id: string, patch: Partial<AddInvestmentInput>): State {
  return {
    ...state,
    investments: state.investments.map(i => i.id === id ? { ...i, ...patch } : i),
  };
}

export function remove(state: State, id: string): State {
  return { ...state, investments: state.investments.filter(i => i.id !== id) };
}

export function close(state: State, id: string): State {
  return {
    ...state,
    investments: state.investments.map(i => i.id === id ? { ...i, status: 'closed' as const } : i),
  };
}

export interface ContributeInput {
  amount: number;
  date: string;            // "YYYY-MM-DD"
  accountId: string;       // expense must hit an account
  categoryId?: string;
  note?: string;
}

/**
 * Record a DPS monthly contribution as an expense transaction with
 * `linkedInvestmentId === investment.id`. For DPS, callers should pass
 * the planned monthly contribution amount; for casual one-off deposits
 * to FDR/savings, this is the same shape.
 *
 * The investment itself is NOT mutated — totals are derived from the
 * transactions list (R6).
 */
export function addContribution(state: State, investmentId: string, input: ContributeInput): State {
  const inv = state.investments.find(i => i.id === investmentId);
  if (!inv) throw new InvestmentError(`Investment not found: ${investmentId}`);
  if (!(Number(input.amount) > 0)) throw new InvestmentError('Contribution must be positive.');
  if (!input.accountId) throw new InvestmentError('Contribution requires an account.');
  if (!state.accounts.some(a => a.id === input.accountId)) {
    throw new InvestmentError(`Account not found: ${input.accountId}`);
  }
  const tx = {
    id: uid(),
    type: 'expense' as const,
    amount: Number(input.amount),
    date: input.date,
    accountId: input.accountId,
    categoryId: input.categoryId,
    linkedInvestmentId: investmentId,
    note: input.note?.trim() || undefined,
  };
  return { ...state, transactions: [...state.transactions, tx] };
}

/** Roll over an existing investment into a new one. */
export function rollover(state: State, oldId: string): State {
  const old = state.investments.find(i => i.id === oldId);
  if (!old) throw new InvestmentError(`Investment not found: ${oldId}`);
  const mat = investmentMaturityDate(old);
  if (!mat) throw new InvestmentError('Cannot roll over — no maturity date.');
  // Day after old maturity.
  const next = new Date(mat.getTime() + 86_400_000);
  const nextStart = next.toISOString().slice(0, 10);
  const replacement: Investment = {
    id: uid(),
    name: old.name,
    type: old.type,
    principal: old.principal,
    monthlyContribution: old.monthlyContribution,
    rate: old.rate,
    startDate: nextStart,
    termMonths: old.termMonths,
    termDays: old.termDays,
    payoutAccountId: old.payoutAccountId,
    institution: old.institution,
    status: 'active',
    createdAt: new Date().toISOString().slice(0, 10),
  };
  return {
    ...state,
    investments: [
      ...state.investments.map(i =>
        i.id === oldId
          ? { ...i, status: 'rolled_over' as const, rolledIntoId: replacement.id }
          : i
      ),
      replacement,
    ],
  };
}