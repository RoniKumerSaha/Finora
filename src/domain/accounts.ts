/**
 * accounts.ts — pure CRUD for accounts.
 *
 * Refuses to delete an account that still has linked transactions
 * (transfers count from both ends; income/expense counts once).
 *
 * State shape: see State in ./types.ts.
 */
import type { Account, AccountType, State } from './types';
import { uid } from './ids';

export const ACCOUNT_TYPES: ReadonlyArray<AccountType> = ['cash', 'bank', 'mobile_wallet', 'card', 'other'];

export function list(state: State): Account[] {
  return state.accounts;
}

export function get(state: State, id: string): Account | undefined {
  return state.accounts.find(a => a.id === id);
}

export interface AddAccountInput {
  name: string;
  type: AccountType;
  openingBalance?: number;
}

export function add(state: State, input: AddAccountInput): State {
  const acc: Account = {
    id: uid(),
    name: input.name.trim(),
    type: input.type,
    openingBalance: Number(input.openingBalance) || 0,
    createdAt: new Date().toISOString().slice(0, 10),
  };
  return { ...state, accounts: [...state.accounts, acc] };
}

export function update(state: State, id: string, patch: Partial<AddAccountInput>): State {
  return {
    ...state,
    accounts: state.accounts.map(a => a.id === id ? { ...a, ...patch } : a),
  };
}

export class DeleteError extends Error {
  constructor(public accountId: string, public txCount: number) {
    super(`Cannot delete account with ${txCount} linked transaction(s).`);
  }
}

export function remove(state: State, id: string): State {
  const txCount = state.transactions.filter(tx =>
    tx.accountId === id || tx.fromAccountId === id || tx.toAccountId === id
  ).length;
  if (txCount > 0) throw new DeleteError(id, txCount);
  return { ...state, accounts: state.accounts.filter(a => a.id !== id) };
}