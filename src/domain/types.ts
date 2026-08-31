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

/**
 * V1.1 (Loan-kind Debt): how payments on a debt are accounted.
 *  - 'flat'  → every payment reduces principal 1-for-1 (today's behaviour).
 *  - 'loan'  → each payment is split into interest + principal based on
 *             outstanding × rate / 12. Requires `interestRate > 0`.
 *
 * Stored as optional; `debts.list()` / `get()` default missing values
 * to `'flat'` so older JSON in localStorage continues to deserialize
 * without a migration.
 */
export type DebtKind = 'flat' | 'loan';

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
  note?: string;
}

/** A single contribution entry on a savings goal. Plan-only — does NOT
 *  create a transaction. Users track their real money in accounts; the
 *  goal is a scratchpad for "how much of the target have I set aside
 *  so far?". */
export interface GoalContribution {
  id: string;
  amount: number;
  date: ISODate;
  note?: string;
}

export interface Goal {
  id: string;
  name: string;
  target: number;
  /** What the user has set aside toward this goal — sum of
   *  `contributions[].amount`, but stored (not derived) so reads are
   *  O(1). Recomputed on every load by `recomputeGoalSaved`. */
  saved: number;
  /** Individual contribution entries. Plan-only — never touches the
   *  ledger. */
  contributions: GoalContribution[];
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
  /** V1.1: how payments are accounted. Defaults to 'flat' on read. */
  kind?: DebtKind;
  /** Annual interest rate %, required when kind === 'loan'. Same
   *  0–100 cap as Investment.rate. Ignored when kind === 'flat'. */
  interestRate?: number;
  /** V1.1: term in whole months. Optional even on loan-kind debts —
   *  if set, the Pay modal pre-fills with the standard EMI from
   *  `loanEMI(principal, rate, termMonths)`. Otherwise the modal
   *  leaves the amount field empty for the user to enter. */
  termMonths?: number;
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
  /** Term in whole months. Mutually exclusive with `termDays`: exactly one
   *  must be set (DPS requires `termMonths`; FDR/savings may use either). */
  termMonths: number;
  /** Term in whole calendar days. Used for short-term FDR/savings (< 1 month).
   *  When set, `termMonths` is ignored for both value and date calculations.
   *  Optional — most investments continue to use `termMonths`. */
  termDays?: number;
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
  /**
   * Optional icon chosen by the user. Categories ship without one and the
   * picker lets the user attach an emoji on a per-category basis. The
   * field is intentionally free-form (a single grapheme cluster) so we
   * can swap to SVG icons later without a migration.
   */
  emoji?: string;
}

export interface Settings {
  theme: Theme;
  onboardingComplete: boolean;
}

/* ─────────────────────────────────────────────────────────────────────
   Plan types — pure-scratch planner (PRD §9.14 Month, §9.15 Event).
   Strictly separate from `transactions` — these never touch the ledger.
   Persisted via the same localStorage blob as State.
   ──────────────────────────────────────────────────────────────────────*/

/** Emoji + label pair for a PlanCategory. Emoji is free-text. */
export interface PlanCategory {
  id: string;
  emoji: string;
  name: string;
  /** Planned spend target for the month / event. Always ≥ 0. */
  budget: number;
  /** What the user actually plans to put in this jar. Always ≥ 0. */
  planned: number;
  /** Tonal hint for the chip in the grid. Driven by `tone` or auto. */
  tone?: 'primary' | 'accent' | 'info' | 'warn' | 'violet' | 'danger' | 'success';
}

/** A single line item inside a PlanCategory (e.g. "Café × 4 = 800"). */
export interface PlanItem {
  id: string;
  label: string;
  amount: number;
  done: boolean;
}

/** Month Planner: one plan per month identified by ISO YYYY-MM. */
export interface MonthPlan {
  /** "YYYY-MM" */
  key: string;
  plannedIncome: number;
  /** Categories as ordered at save time. Order is purely cosmetic. */
  categories: PlanCategory[];
  /** Optional last-saved ISO timestamp. Null if the plan was never saved. */
  savedAt?: ISODate | null;
  /** Ture means the draft has changes since the last `savedAt`. */
  dirty: boolean;
}

/** Event Planner: each event is its own plan with a date and a list. */
export interface EventPlan {
  id: string;
  name: string;
  /** Date the event happens. ISO YYYY-MM-DD. */
  eventDate: ISODate;
  /** Optional short label like "wedding" / "trip" — purely cosmetic. */
  emoji?: string;
  /** Total spend budget for the event. */
  budget: number;
  /** What the user actually plans to spend. */
  planned: number;
  /** Itemised categories — mirrors MonthPlanner. Categories know their
   *  own internal line items via `PlanItem[]`. */
  categories: Array<PlanCategory & { items: PlanItem[]; dueDate?: ISODate }>;
  /** Optional last-saved ISO timestamp. */
  savedAt?: ISODate | null;
  dirty: boolean;
  /** Frozen copy of the plan at the last successful save. Reset copies
   *  this back into the live plan so users can revert their working
   *  draft — including event-level fields like budget and date, which
   *  the user can edit. Optional because `saveEventPlan` may run on a
   *  plan that hasn't been saved before. */
  savedSnapshot?: Omit<EventPlan, 'savedSnapshot'>;
}

/* ─────────────────────────────────────────────────────────────────────
   Plan types — Investment Planner (mock) + Loan Calculator (PRD §9.17).
   Strictly separate from `transactions` — these never touch the ledger.
   Persisted via the same localStorage blob as State.
   ──────────────────────────────────────────────────────────────────────*/

/** A mock investment plan. Mirrors `Investment` but with NO payout
 *  account, NO linked transactions, and NO status transitions — these
 *  are pure scratchpad projections (DPS, FDR, savings, term deposit). */
export interface InvestmentPlan {
  id: string;
  name: string;
  /** Mirror of `Investment.type` for parity. */
  type: InvestmentType;
  /** For DPS: monthly installment in BDT. For FDR / savings: ignored. */
  monthlyContribution?: number;
  /** For FDR / savings: lump-sum principal in BDT. For DPS: derived
   *  from `monthlyContribution × termMonths` (informational only). */
  principal: number;
  /** Annual interest rate, %. Same 0–100 cap as the real Investment
   *  type. Recomputes the projection on edit. */
  rate: number;
  /** Plan start date (ISO YYYY-MM-DD). For DPS, the first installment
   *  is assumed to land on this date. For FDR / savings, the deposit
   *  is assumed to land on this date. */
  startDate: ISODate;
  /** Term in whole months. Mutually exclusive with `termDays`. */
  termMonths: number;
  /** Term in whole calendar days. Mutually exclusive with `termMonths`. */
  termDays?: number;
  institution?: string;
  notes?: string;
  /** "Monthly deposit scheme" / "Fixed deposit receipt" / "Other". */
  kit?: 'dps' | 'fdr' | 'other';
  /** Last user-saved ISO timestamp. Null until first save. */
  savedAt?: ISODate | null;
  dirty: boolean;
}

/** A single row in the loan amortization table. Mirrors standard
 *  amortisation math: each period the borrower pays a fixed amount
 *  (EMI), the interest for that period is `outstanding × rate/12`,
 *  and the principal portion is `EMI − interest`. */
export interface LoanInstallment {
  /** 1-based period index. */
  period: number;
  /** The fixed monthly payment (EMI). */
  payment: number;
  /** Interest portion of the payment (`outstanding × monthlyRate`). */
  interest: number;
  /** Principal portion of the payment (`EMI − interest`). */
  principalPaid: number;
  /** Outstanding balance after this period's payment. */
  remaining: number;
  /** The calendar month this payment falls in (ISO YYYY-MM-DD, day = 1). */
  dueDate: ISODate;
}

/** A loan calculator scratchpad. Like `InvestmentPlan`, this is a pure
 *  projection: no real money movement, no link to debts, no link to
 *  any account. The user enters principal + rate + term + start month
 *  and the app fills in the amortization table. */
export interface LoanPlan {
  id: string;
  name: string;
  /** Total borrowed amount in BDT. */
  principal: number;
  /** Annual interest rate, %. 0–100 cap (same as the Investment rules). */
  rate: number;
  /** Term in whole months. Must be > 0. */
  termMonths: number;
  /** When the first payment is due (ISO YYYY-MM-DD, day = 1). */
  startDate: ISODate;
  /** Optional EMI override. When null the EMI is derived from the
   *  standard formula. */
  emiOverride?: number;
  /** Last user-saved ISO timestamp. */
  savedAt?: ISODate | null;
  dirty: boolean;
}

export interface State {
  version: 1;
  accounts: Account[];
  transactions: Transaction[];
  goals: Goal[];
  debts: Debt[];
  investments: Investment[];
  categories: Category[];
  /** Per-month planning scratchpads. Keyed by `monthPlan.key` (YYYY-MM). */
  monthPlans: MonthPlan[];
  /** Independent event scratchpads. Each event is its own plan. */
  eventPlans: EventPlan[];
  /** Mock investment scratchpads — DPS / FDR / savings projections.
   *  Never moves real money. (PRD §9.17.) */
  investmentPlans: InvestmentPlan[];
  /** Loan calculator scratchpads with amortization tables. Never
   *  moves real money. (PRD §9.17.) */
  loanPlans: LoanPlan[];
  settings: Settings;
}

export type BannerKind = 'success' | 'info' | 'error';

export interface Banner {
  /** Visual treatment. Defaults to 'info' when unspecified. */
  kind?: BannerKind;
  what: string;
  why: string;
  fix: string;
}

/**
 * A moment-of-success feedback channel. Used for save flows where the
 * user has already moved on by the time the message would land —
 * toasts appear top-right, dwell ~2.4s, and fade. Errors stay on the
 * sticky banner (use `Banner`).
 *
 * Differences from `Banner`:
 *   - No `fix` line (save flows rarely need a fix prompt).
 *   - Optional `action` for "View" / "Undo" affordances.
 *   - Auto-clears on a timer; no X-button dismissal needed.
 */
export interface Toast {
  id: string;
  kind: 'success' | 'info' | 'error';
  what: string;
  /** Optional one-line detail beneath the headline. */
  why?: string;
  /** Optional action affordance — renders as a primary text-link. */
  action?: { label: string; onClick: () => void };
}