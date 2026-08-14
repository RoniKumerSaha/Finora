/**
 * transactions.ts — pure CRUD for transactions.
 *
 * Validation rules (raised as TransactionError):
 *   - income / expense: require accountId
 *   - transfer: require fromAccountId + toAccountId (must differ)
 *   - linkedDebtId, linkedInvestmentId: one-way pointers, optional
 *   - amount > 0
 */
import type { State, Transaction, TxType } from './types';
import { uid } from './ids';

export class TransactionError extends Error {}

export function list(state: State): Transaction[] {
  return state.transactions;
}

export function listForAccount(state: State, accountId: string): Transaction[] {
  return state.transactions.filter(tx =>
    tx.accountId === accountId
    || tx.fromAccountId === accountId
    || tx.toAccountId === accountId
  );
}

export function get(state: State, id: string): Transaction | undefined {
  return state.transactions.find(t => t.id === id);
}

export interface AddTxInput {
  type: TxType;
  amount: number;
  date: string;
  accountId?: string;
  fromAccountId?: string;
  toAccountId?: string;
  categoryId?: string;
  linkedDebtId?: string;
  linkedInvestmentId?: string;
  linkedGoalId?: string;
  note?: string;
}

function validate(input: AddTxInput, state: State): void {
  if (!(Number(input.amount) > 0)) {
    throw new TransactionError('Amount must be greater than zero.');
  }
  if (input.type === 'income' || input.type === 'expense') {
    if (!input.accountId) throw new TransactionError(`${input.type} requires an account.`);
    if (!state.accounts.some(a => a.id === input.accountId)) {
      throw new TransactionError(`Account not found: ${input.accountId}`);
    }
  } else if (input.type === 'transfer') {
    if (!input.fromAccountId || !input.toAccountId) {
      throw new TransactionError('Transfer requires both fromAccountId and toAccountId.');
    }
    if (input.fromAccountId === input.toAccountId) {
      throw new TransactionError('Transfer source and destination must differ.');
    }
  }
}

export function add(state: State, input: AddTxInput): State {
  validate(input, state);
  const tx: Transaction = {
    id: uid(),
    type: input.type,
    amount: Number(input.amount),
    date: input.date,
    accountId: input.accountId,
    fromAccountId: input.fromAccountId,
    toAccountId: input.toAccountId,
    categoryId: input.categoryId,
    linkedDebtId: input.linkedDebtId,
    linkedInvestmentId: input.linkedInvestmentId,
    linkedGoalId: input.linkedGoalId,
    note: input.note?.trim() || undefined,
  };
  return { ...state, transactions: [...state.transactions, tx] };
}

export function update(state: State, id: string, patch: Partial<AddTxInput>): State {
  const existing = state.transactions.find(t => t.id === id);
  if (!existing) throw new TransactionError(`Transaction not found: ${id}`);
  const next = { ...existing, ...patch };
  validate(next as AddTxInput, state);
  return {
    ...state,
    transactions: state.transactions.map(t => t.id === id ? next : t),
  };
}

export function remove(state: State, id: string): State {
  return { ...state, transactions: state.transactions.filter(t => t.id !== id) };
}