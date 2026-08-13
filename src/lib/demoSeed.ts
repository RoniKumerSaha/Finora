/**
 * demoSeed.ts — populate the store with a small but realistic dataset
 * so the app isn't empty after onboarding. AD-19 polish; called from a
 * Settings button for the V1 "demo mode".
 */
import type { State } from '../domain/types';
import { uid } from '../domain/ids';

const TODAY = () => new Date().toISOString().slice(0, 10);

export function seedDemo(state: State): State {
  const cashId = uid();
  const bkashId = uid();
  const bankId = uid();
  const goalId = uid();
  const invId = uid();

  const accounts = [
    { id: cashId,  name: 'Cash wallet', type: 'cash' as const,         openingBalance: 5000,  createdAt: TODAY() },
    { id: bkashId, name: 'bKash',       type: 'mobile_wallet' as const, openingBalance: 12000, createdAt: TODAY() },
    { id: bankId,  name: 'DBBL Bank',   type: 'bank' as const,         openingBalance: 80000, createdAt: TODAY() },
  ];

  const transactions = [
    { id: uid(), type: 'income'  as const, amount: 60000, date: TODAY(), accountId: bankId,  note: 'Salary' },
    { id: uid(), type: 'expense' as const, amount: 12000, date: TODAY(), accountId: bkashId, note: 'Groceries' },
    { id: uid(), type: 'expense' as const, amount: 4500,  date: TODAY(), accountId: bkashId, note: 'Lunch' },
    { id: uid(), type: 'expense' as const, amount: 2000,  date: TODAY(), accountId: cashId,  note: 'Transport' },
  ];

  const goals = [
    { id: goalId, name: 'Emergency fund', target: 100000, saved: 25000, targetDate: '2027-06-30', createdAt: TODAY() },
  ];

  const investments = [
    { id: invId, name: 'DBBL DPS', type: 'dps' as const, principal: 50000, rate: 8,
      startDate: '2025-08-01', termMonths: 60, payoutAccountId: bankId, institution: 'DBBL',
      status: 'active' as const, createdAt: TODAY() },
  ];

  return {
    ...state,
    accounts, transactions, goals,
    debts: [], investments,
    settings: { ...state.settings, onboardingComplete: true },
  };
}