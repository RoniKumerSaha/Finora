/**
 * types.ts — shared domain types for Finora V1.
 *
 * Mirrors the data shape in ARCHITECTURE-SPINE.md §3. These are the types
 * every module imports, so they live here (not co-located with each entity)
 * to avoid circular imports.
 */

export type ISODate = string; // "YYYY-MM-DD"

export type AccountType = 'cash' | 'bank' | 'mobile_wallet' | 'card' | 'other';

export type TxType = 'income' | 'expense' | 'transfer';

export type DebtDirection = 'i_owe' | 'owed_to_me';

export type DebtStatus = 'active' | 'completed' | 'archived';

export type InvestmentType = 'dps' | 'fdr' | 'savings';

export type InvestmentStatus = 'active' | 'matured' | 'closed' | 'rolled_over';

export type Theme = 'dark' | 'light' | 'auto';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  openingBalance: number;
  createdAt: ISODate;
}

export interface Transaction {
  id: string;
  type: TxType;
  amount: number;
  date: ISODate;
  accountId?: string;        // for income / expense
  fromAccountId?: string;    // for transfer
  toAccountId?: string;      // for transfer
  categoryId?: string;
  linkedDebtId?: string;
  linkedInvestmentId?: string;
  linkedGoalId?: string;     // contribution to a savings goal (expense)
  note?: string;
}

export interface Goal {
  id: string;
  name: string;
  target: number;
  /** Deprecated — kept for v1 reads; `saved` is now derived from
   *  transactions where `linkedGoalId === goal.id` (R6 discipline).
   *  Writers should never set this directly. */
  saved: number;
  targetDate: ISODate;
  createdAt: ISODate;
}

export interface Debt {
  id: string;
  name: string;
  direction: DebtDirection;
  total: number;
  paidSoFar: number;         // cache — recomputed on every load
  dueDate?: ISODate;
  person?: string;
  status: DebtStatus;
  createdAt: ISODate;
}

export interface Investment {
  id: string;
  name: string;
  type: InvestmentType;
  /** For FDR/savings: lump-sum deposit. For DPS: ignored; contributions
   *  come through linked expense transactions. */
  principal: number;
  /** DPS only: required monthly contribution in BDT. Ignored for FDR/savings. */
  monthlyContribution?: number;
  rate: number;              // percent, e.g. 8.5
  startDate: ISODate;
  termMonths: number;
  payoutAccountId?: string;
  institution?: string;
  status: InvestmentStatus;
  rolledIntoId?: string;
  createdAt: ISODate;
}

export interface Category {
  id: string;
  type: 'income' | 'expense';
  name: string;
}

export interface Settings {
  theme: Theme;
  onboardingComplete: boolean;
}

export interface State {
  version: 1;
  accounts: Account[];
  transactions: Transaction[];
  goals: Goal[];
  debts: Debt[];
  investments: Investment[];
  categories: Category[];
  settings: Settings;
}

export interface Banner {
  what: string;
  why: string;
  fix: string;
}