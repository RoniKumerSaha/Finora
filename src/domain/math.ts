/**
 * math.ts — Pure financial math for Finora V1.
 *
 * Ported from archive/vanilla-v1/src/js/math.js. No DOM, no localStorage,
 * no module-level state. Every function is pure — takes data + optional
 * "now" and returns a value.
 *
 * Rule references match PRD §10 (R1–R10):
 *   R1  Monthly income    → monthlyIncome()
 *   R2  Monthly expenses  → monthlyExpenses()
 *   R3  Account balance   → accountBalance()
 *   R4  Transfer rule     → enforced at the data layer; math treats transfers
 *                          as neither income nor expense (see sumByType)
 *   R5  Goal requirement  → goalRequiredPerMonth()
 *   R6  Source of truth   → not a function; it's the discipline of never
 *                          storing derived values in the state
 *   R7  Debt paid_so_far  → debtPaidSoFar()
 *   R8  Debt completion   → isDebtCompleted()
 *   R9  Investment value  → investmentMaturityValue() (months-based)
 *                          investmentMaturityValueFromDays() (days-based, FDR/savings)
 *   R10 Investment status → deriveInvestmentStatus()
 *
 * Date conventions:
 *   - Input dates are ISO-8601 strings ("YYYY-MM-DD" or full ISO).
 *   - "now" is an optional Date or ISO string, default = new Date().
 *   - All math uses UTC date components to avoid timezone drift.
 */

import type {
  Account,
  Debt,
  Goal,
  Investment,
  LoanInstallment,
  LoanPlan,
  State,
  Transaction,
  ISODate,
} from './types';

// ---------- Date helpers ----------

/**
 * Parse an ISO date string into a UTC Date at midnight.
 * Accepts "YYYY-MM-DD" and full ISO strings.
 */
export function parseISODate(iso: string | Date): Date {
  if (iso instanceof Date) {
    return new Date(Date.UTC(iso.getUTCFullYear(), iso.getUTCMonth(), iso.getUTCDate()));
  }
  if (typeof iso !== 'string') {
    throw new TypeError(`parseISODate: expected string or Date, got ${typeof iso}`);
  }
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) {
    throw new Error(`parseISODate: not an ISO date: ${iso}`);
  }
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
}

/** Today as a UTC Date at midnight. Override `now` for tests. */
export function today(now: string | Date = new Date()): Date {
  if (typeof now === 'string') now = parseISODate(now);
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * True if the given ISO date falls in (year, month) — month is 1-based.
 */
export function isInMonth(dateIso: ISODate, year: number, month: number): boolean {
  const d = parseISODate(dateIso);
  return d.getUTCFullYear() === year && (d.getUTCMonth() + 1) === month;
}

/**
 * Whole calendar days from `from` to `to` (b - a), positive if `to`
 * is in the future. Time-of-day is ignored.
 */
export function daysBetween(from: string | Date, to: string | Date): number {
  const a = parseISODate(from);
  const b = parseISODate(to);
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / 86400000);
}

/**
 * Whole calendar months between two dates, floored.
 */
export function monthsBetween(from: string | Date, to: string | Date): number {
  const a = parseISODate(from);
  const b = parseISODate(to);
  let months = (b.getUTCFullYear() - a.getUTCFullYear()) * 12
             + (b.getUTCMonth() - a.getUTCMonth());
  if (b.getUTCDate() < a.getUTCDate()) months -= 1;
  return months;
}

// ---------- Transactions: filtering and summing ----------

/**
 * Sum amounts of transactions whose `type` is in the given set and whose
 * date is in (year, month).
 */
export function sumByType(
  transactions: Transaction[],
  types: ReadonlyArray<'income' | 'expense' | 'transfer'>,
  year: number,
  month: number
): number {
  const typeSet = new Set(types);
  let total = 0;
  for (const tx of transactions) {
    if (!typeSet.has(tx.type)) continue;
    if (!isInMonth(tx.date, year, month)) continue;
    total += Number(tx.amount) || 0;
  }
  return total;
}

/** R1: monthly income total. */
export function monthlyIncome(transactions: Transaction[], year: number, month: number): number {
  return sumByType(transactions, ['income'], year, month);
}

/** R2: monthly expense total. */
export function monthlyExpenses(transactions: Transaction[], year: number, month: number): number {
  return sumByType(transactions, ['expense'], year, month);
}

/**
 * Average monthly expenses over the last N *complete* calendar months.
 *
 * The current (in-progress) month is excluded — partial-month averages
 * distort the signal, especially early in a month when almost nothing
 * has been logged yet.
 *
 * Returns `null` when there's not enough history: callers should render
 * a "Not enough data yet" hint instead of a misleading `৳0`. The
 * threshold is that *every* of the last N complete months must have at
 * least one expense entry; otherwise the average would be biased low
 * (zero months dragging the mean down).
 *
 * Used by the Loan Calculator's "Can I afford this?" comparison in
 * Phase B. Added to the domain now so the Phase A refactor doesn't
 * have to touch this file again.
 */
export function averageMonthlyExpenses(
  transactions: Transaction[],
  opts: { months?: number; now?: string | Date } = {},
): number | null {
  const months = Math.max(1, Math.floor(opts.months ?? 3));
  const t = today(opts.now ?? new Date());
  // Walk back N complete months: (t.month - 1), (t.month - 2), …,
  // (t.month - months). Using UTC components to match the rest of
  // the date math in this file.
  let total = 0;
  for (let i = 1; i <= months; i++) {
    // (y, m) for "this month minus i" in plain arithmetic. Decrement
    // both month and year together so we never produce month=0 or
    // month=-1.
    const totalMonthsBack = i; // 1-based offset from current month
    let m = t.getUTCMonth() + 1 - totalMonthsBack; // 1..12 then 0, -1, …
    let y = t.getUTCFullYear();
    while (m <= 0) { m += 12; y -= 1; }
    const monthExpenses = monthlyExpenses(transactions, y, m);
    if (monthExpenses > 0) {
      total += monthExpenses;
    } else {
      // A zero month breaks the "I want a real signal" assumption.
      // Returning null lets the caller show "Not enough history yet"
      // instead of a misleadingly low average.
      return null;
    }
  }
  return total / months;
}

/**
 * R3: account balance = opening balance + sum of all transactions on the
 * account. For transfers, money leaves the from-account and lands in the
 * to-account.
 */
export function accountBalance(account: Account | null | undefined, transactions: Transaction[]): number {
  if (!account) return 0;
  const opening = Number(account.openingBalance) || 0;
  let total = opening;
  for (const tx of transactions) {
    const amt = Number(tx.amount) || 0;
    if (tx.type === 'income' && tx.accountId === account.id) {
      total += amt;
    } else if (tx.type === 'expense' && tx.accountId === account.id) {
      total -= amt;
    } else if (tx.type === 'transfer') {
      if (tx.fromAccountId === account.id) total -= amt;
      else if (tx.toAccountId === account.id) total += amt;
    }
  }
  return total;
}

// ---------- Goals (R5) ----------

/**
 * R5: required per-month to hit goal = (target - saved) / monthsLeft.
 * If monthsLeft <= 0, returns Infinity (caller should show "expired").
 */
export function goalRequiredPerMonth(goal: Goal, saved: number = goal.saved, now: string | Date = new Date()): number {
  if (!goal) return 0;
  const remaining = (Number(goal.target) || 0) - (Number(saved) || 0);
  if (remaining <= 0) return 0;
  const months = monthsBetween(today(now), goal.targetDate);
  if (months <= 0) return Infinity;
  return remaining / months;
}

/** True if the goal is fully funded (saved >= target). */
export function isGoalCompleted(goal: Goal, saved: number = goal.saved): boolean {
  return (Number(saved) || 0) >= (Number(goal.target) || 0);
}

/** True if the goal's target date is in the past. */
export function isGoalExpired(goal: Goal, now: string | Date = new Date()): boolean {
  if (!goal?.targetDate) return false;
  return today(now).getTime() > parseISODate(goal.targetDate).getTime();
}

// ---------- Debts (R7, R8) ----------

/**
 * R7: paid_so_far = sum of linked transactions' amounts.
 *   i_owe      → linked transactions are Expense (cash going out to pay)
 *   owed_to_me → linked transactions are Income (cash coming in from them)
 */
export function debtPaidSoFar(debt: Debt, transactions: Transaction[]): number {
  if (!debt) return 0;
  let total = 0;
  for (const tx of transactions) {
    if (tx.linkedDebtId !== debt.id) continue;
    if (debt.direction === 'i_owe' && tx.type === 'expense') total += Number(tx.amount) || 0;
    else if (debt.direction === 'owed_to_me' && tx.type === 'income') total += Number(tx.amount) || 0;
  }
  return total;
}

/** R8: auto-complete when paid_so_far >= total. */
export function isDebtCompleted(debt: Debt, transactions: Transaction[]): boolean {
  if (!debt) return false;
  return debtPaidSoFar(debt, transactions) >= (Number(debt.total) || 0);
}

// ---------- Investments (R9, R10) ----------

/**
 * R9: maturity value = principal × (1 + rate/100 × termMonths/12)
 * Simple-interest display model — no daily accrual, no compounding.
 */
export function investmentMaturityValue(investment: Investment): number {
  if (!investment) return 0;
  const principal = Number(investment.principal) || 0;
  const rate = Number(investment.rate) || 0;
  const months = Number(investment.termMonths) || 0;
  return principal * (1 + (rate / 100) * (months / 12));
}

/**
 * Days-based maturity value for short-term FDR/savings (sub-1-month terms).
 *
 * Formula: principal × (1 + rate/100 × termDays/365)
 *
 * This is the symmetric partner of `investmentMaturityValue` for the rare
 * case where a user opens an FDR with a term shorter than a month — most
 * banks express these in days rather than months (e.g. a 15-day FDR).
 *
 * Same simple-interest display model as R9: no daily accrual, no
 * compounding. Use only when `investment.termDays` is set; otherwise
 * callers should use `investmentMaturityValue`.
 */
export function investmentMaturityValueFromDays(investment: Investment): number {
  if (!investment) return 0;
  const days = Number(investment.termDays) || 0;
  if (!(days > 0)) return 0;
  const principal = Number(investment.principal) || 0;
  const rate = Number(investment.rate) || 0;
  return principal * (1 + (rate / 100) * (days / 365));
}

/**
 * R10 supporting: maturity date. Dispatches on which term field is set:
 *   - `termDays` set → start_date + termDays (calendar-day arithmetic)
 *   - `termMonths` set → start_date + term_months (calendar-month add,
 *     day-of-month clamped to the last day of the target month so that
 *     e.g. Jan 31 + 1 month = Feb 28, not Mar 3)
 *
 * `termDays` wins when both happen to be set (the schema enforces XOR;
 * this is a defensive fallback for old data that may carry both).
 */
export function investmentMaturityDate(investment: Investment): Date | null {
  if (!investment?.startDate) return null;
  const start = parseISODate(investment.startDate);
  const days = Number(investment.termDays) || 0;
  if (days > 0) {
    return new Date(start.getTime() + days * 86_400_000);
  }
  const startDay = start.getUTCDate();
  const targetMonth = start.getUTCMonth() + (Number(investment.termMonths) || 0);
  const yearShift = Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;
  const year = start.getUTCFullYear() + yearShift;
  const lastDay = new Date(Date.UTC(year, normalizedMonth + 1, 0)).getUTCDate();
  const day = Math.min(startDay, lastDay);
  return new Date(Date.UTC(year, normalizedMonth, day));
}

/**
 * R10: derive the auto-status. `closed` / `rolled_over` / `matured` are
 * sticky once set; only `active` flips forward to `matured`.
 */
export function deriveInvestmentStatus(investment: Investment, now: string | Date = new Date()): Investment['status'] {
  if (!investment) return 'active';
  if (investment.status === 'closed'
   || investment.status === 'rolled_over'
   || investment.status === 'matured') {
    return investment.status;
  }
  const mat = investmentMaturityDate(investment);
  if (!mat) return investment.status || 'active';
  return today(now).getTime() >= mat.getTime() ? 'matured' : 'active';
}

/** Convenience: days until maturity (negative if past). */
export function daysToMaturity(investment: Investment, now: string | Date = new Date()): number {
  const mat = investmentMaturityDate(investment);
  if (!mat) return 0;
  return daysBetween(today(now), mat);
}

// ---------- Goals (R5 — stored `saved`) ----------

/**
 * R6 (stored): `goal.saved` is the running total of
 * `goal.contributions[].amount`. Recomputed on every load by
 * `recomputeGoalSaved` so the stored total never drifts from the line
 * items. This helper is kept for callers that need to read the value
 * with a fallback (e.g. mock data in tests).
 */
export function goalSaved(goal: Goal): number {
  if (!goal) return 0;
  return Number(goal.saved) || 0;
}

/** Convenience: progress ratio (0..1) considering stored saved. */
export function goalProgress(goal: Goal): number {
  if (!goal) return 0;
  const target = Number(goal.target) || 0;
  if (target <= 0) return 1;
  const saved = goalSaved(goal);
  return Math.min(1, saved / target);
}

// ---------- Investments (R9, R10 — DPS support) ----------

/**
 * R9-DPS: maturity value of a DPS account under monthly compound interest.
 * Formula: annuity-due (contributions at start of each month).
 *   M = monthlyContribution
 *   r = rate / 100 / 12  (monthly rate)
 *   T = termMonths
 *   FV = M * ((1+r)^T - 1) / r * (1+r)
 *
 * If `monthlyContribution` is missing or zero, returns 0.
 * For non-DPS types, returns 0 (use `investmentMaturityValue` for simple-interest).
 */
export function dpsMaturityValue(investment: Investment): number {
  if (!investment || investment.type !== 'dps') return 0;
  const M = Number(investment.monthlyContribution) || 0;
  if (M <= 0) return 0;
  const T = Math.floor(Number(investment.termMonths) || 0);
  if (T <= 0) return 0;
  const r = (Number(investment.rate) || 0) / 100 / 12;
  if (r === 0) return M * T; // no interest — straight sum of contributions
  const factor = (Math.pow(1 + r, T) - 1) / r * (1 + r);
  return M * factor;
}

/**
 * Sum of DPS contributions made so far, from `expense` transactions
 * where `linkedInvestmentId === investment.id`. This is the principal
 * the user has actually paid in (not the projected maturity value).
 */
export function dpsContributedSoFar(investment: Investment, transactions: Transaction[]): number {
  if (!investment) return 0;
  let total = 0;
  for (const t of transactions) {
    if (t.linkedInvestmentId !== investment.id) continue;
    if (t.type === 'expense') total += Number(t.amount) || 0;
  }
  return total;
}

/**
 * Sum of payouts received so far, from `income` transactions where
 * `linkedInvestmentId === investment.id`. The mirror of
 * dpsContributedSoFar — money coming back from the bank into one of
 * the user's accounts.
 *
 * Used by the recompute layer to auto-close an investment when
 * payouts >= contributions (R6: derived, never stored).
 */
export function dpsPaidOutSoFar(investment: Investment, transactions: Transaction[]): number {
  if (!investment) return 0;
  let total = 0;
  for (const t of transactions) {
    if (t.linkedInvestmentId !== investment.id) continue;
    if (t.type === 'income') total += Number(t.amount) || 0;
  }
  return total;
}

/**
 * Current DPS value — future value of contributions made so far,
 * each compounded from its deposit month to today.
 *
 * This is what the bank would pay out if you closed the account today.
 *
 *   `k` = months from each contribution to today (using monthsBetween)
 *   currentValue = sum over contributions of: M * (1+r)^k
 */
export function dpsCurrentValue(investment: Investment, transactions: Transaction[], now: string | Date = new Date()): number {
  if (!investment || investment.type !== 'dps') return 0;
  const r = (Number(investment.rate) || 0) / 100 / 12;
  let total = 0;
  for (const t of transactions) {
    if (t.linkedInvestmentId !== investment.id) continue;
    if (t.type !== 'expense') continue;
    const k = monthsBetween(t.date, now);
    if (k < 0) continue;
    const amt = Number(t.amount) || 0;
    total += amt * Math.pow(1 + r, k);
  }
  return total;
}

/**
 * Type-aware maturity value. Dispatches on type AND on which term field
 * the user filled in:
 *   - DPS  → always annuity-due via dpsMaturityValue() (months-based).
 *   - FDR/savings with `termDays` set → simple-interest days formula.
 *   - FDR/savings otherwise → simple-interest months formula (R9).
 */
export function investmentMaturityValueTyped(investment: Investment): number {
  if (!investment) return 0;
  if (investment.type === 'dps') return dpsMaturityValue(investment);
  if (investment.termDays != null && Number(investment.termDays) > 0) {
    return investmentMaturityValueFromDays(investment);
  }
  return investmentMaturityValue(investment);
}

// ---------- Investment dual-value (current vs projected) ----------

/**
 * Dual-value shape for any investment.
 *
 * 2026-08-17 net-worth clarity: a DPS with one paid installment used to
 * show its full mature amount as the headline, which made the user's
 * "net worth" look much bigger than what they actually have. This
 * helper exposes BOTH values so screens can show "what you have now"
 * (the truth) alongside "what it'll be at maturity" (the projection),
 * each clearly labelled.
 *
 *  - `currentValue`: real money you have tied up right now.
 *      - DPS    → compounded value of contributions made so far
 *                 (dpsCurrentValue).
 *      - FDR    → the lump-sum principal (already locked in at start).
 *      - savings → same — principal is real money in the account.
 *
 *  - `projectedValue`: future projection assuming you complete the term
 *    (DPS: every month contributed; FDR: simple interest to maturity).
 *    For investments past their maturity date, this collapses to
 *    `currentValue` because there's nothing left to project.
 */
export interface InvestmentValue {
  currentValue: number;
  projectedValue: number;
}

export function investmentValue(
  investment: Investment,
  transactions: Transaction[],
  now: string | Date = new Date()
): InvestmentValue {
  if (!investment) return { currentValue: 0, projectedValue: 0 };
  const projected = investmentMaturityValueTyped(investment);
  if (investment.type === 'dps') {
    const current = dpsCurrentValue(investment, transactions, now);
    // Past maturity — bank would pay out the full mature value.
    const days = daysToMaturity(investment, now);
    return {
      currentValue: days <= 0 ? Math.max(current, projected) : current,
      projectedValue: projected,
    };
  }
  // FDR / savings: the principal is the current value; projected is
  // the maturity value. Past maturity, collapse to principal.
  const days = daysToMaturity(investment, now);
  const principal = Number(investment.principal) || 0;
  return {
    currentValue: days <= 0 ? Math.max(principal, projected) : principal,
    projectedValue: projected,
  };
}

// ---------- Net worth (dual value) ----------

/**
 * Net worth computed two ways so the UI can show both:
 *
 *  - `currentNetWorth` is the honest "what you actually have right now"
 *    number: cash on hand + the *current* value of each active
 *    investment + receivables − money I still owe. This is the number
 *    that should be shown as the headline.
 *
 *  - `projectedNetWorth` swaps the *current* value for each investment
 *    with its *projected* (mature) value, showing what your net worth
 *    would be at the end of every term. Treat as a clearly-labelled
 *    projection; it is not money in your hand today.
 *
 * Cash and debts are the same in both — they aren't projection. FDR
 * lump-sum principal already counts as current, so projectedNetWorth
 * differs from currentNetWorth only for investments that have future
 * appreciation to come (DPS installments not yet paid, FDR interest
 * not yet accrued).
 */
export interface NetWorth {
  currentNetWorth: number;
  projectedNetWorth: number;
}

export function computeNetWorth(
  state: Pick<State, 'accounts' | 'transactions' | 'debts' | 'investments'>,
  now: string | Date = new Date()
): NetWorth {
  // Cash across all accounts at "now" (same in both numbers).
  let cash = 0;
  for (const acc of state.accounts) {
    cash += accountBalance(acc, state.transactions);
  }

  // Active investments: DPS-aware using dual value; FDR/savings
  // count principal as current and maturity value as projected.
  const todayISO = parseISODate(now).toISOString().slice(0, 10);
  let invCurrent = 0;
  let invProjected = 0;
  for (const inv of state.investments) {
    if (inv.status === 'closed' || inv.status === 'rolled_over') continue;
    if (inv.startDate > todayISO) continue;
    const v = investmentValue(inv, state.transactions, now);
    invCurrent += v.currentValue;
    invProjected += v.projectedValue;
  }

  // Receivables (owed_to_me) and outstanding i_owe, as of "now".
  let receivables = 0;
  let oweRemaining = 0;
  for (const d of state.debts) {
    if (d.status === 'completed' || d.status === 'archived') continue;
    const paid = debtPaidSoFar(d, state.transactions);
    const total = Number(d.total) || 0;
    if (paid >= total) continue;
    const remaining = total - paid;
    if (d.direction === 'i_owe') oweRemaining += remaining;
    else receivables += remaining;
  }

  return {
    currentNetWorth: cash + invCurrent + receivables - oweRemaining,
    projectedNetWorth: cash + invProjected + receivables - oweRemaining,
  };
}

// ---------- Loan Calculator (PRD §9.17 — Plan module) ----------

/**
 * Standard EMI formula:
 *   EMI = P × r × (1 + r)^n / ((1 + r)^n − 1)
 * where r = monthlyRate = annualRate/12/100, n = termMonths.
 *
 * When annual rate is 0 (some BNPL / 0% promo loans) the EMI reduces
 * to a flat `principal / termMonths`. We special-case that here so
 * callers don't have to.
 *
 * Returns 0 when inputs are non-positive.
 */
export function loanEMI(
  principal: number,
  annualRatePct: number,
  termMonths: number,
): number {
  const P = Number(principal) || 0;
  const n = Math.floor(Number(termMonths) || 0);
  if (P <= 0 || n <= 0) return 0;
  const r = (Number(annualRatePct) || 0) / 100 / 12;
  if (r === 0) return P / n;
  const pow = Math.pow(1 + r, n);
  return (P * r * pow) / (pow - 1);
}

/** Result of splitting one payment on a loan-kind debt into its
 *  interest + principal portions. Both are integer taka (BDT). The
 *  caller is responsible for routing the gross payment through the
 *  ledger as a single transaction — `loanPaymentSplit` is a pure
 *  derived-value helper, not a persistence layer. */
export interface LoanPaymentSplit {
  interest: number;
  principal: number;
}

/**
 * Split a single payment against outstanding principal on a loan-kind
 * debt into interest + principal portions.
 *
 * Rules (PRD §8 — Loan-kind Debt):
 *   monthlyRate = annualRate / 12 / 100
 *   interest    = round(outstanding × monthlyRate)
 *   principal   = max(0, payment − interest), capped at outstanding
 *
 * Edge cases:
 *   - `payment <= 0` → both portions 0. Defensive only; form-layer
 *     validation rejects ≤ 0 before this is called.
 *   - `payment < interest` → underpayment. Interest absorbs the full
 *     payment; principal is 0; outstanding is unchanged. The caller
 *     surfaces a "this payment didn't cover this month's interest"
 *     warning when principal is 0 on a non-zero-interest debt.
 *   - `payment > outstanding + interest` → overpayment. Principal is
 *     capped at outstanding; no negative carry.
 *   - `outstanding <= 0` → all of the payment goes to principal.
 *   - `annualRate <= 0` → interest is 0; the whole payment is
 *     principal (caller is responsible for not passing rate=0 on a
 *     `kind === 'loan'` debt; validation in `debts.add` enforces this).
 */
export function loanPaymentSplit(
  outstanding: number,
  payment: number,
  annualRate: number,
): LoanPaymentSplit {
  const out = Number(outstanding) || 0;
  const pay = Number(payment) || 0;
  const rate = Number(annualRate) || 0;
  if (pay <= 0) return { interest: 0, principal: 0 };
  if (out <= 0) return { interest: 0, principal: pay };
  const monthlyRate = rate / 100 / 12;
  // The "would-be" interest — what a full month of interest is right
  // now. Underpayment absorbs the full payment into interest (caller
  // surfaces a warning); normal/overpayment uses this rounded value.
  const fullInterest = monthlyRate > 0
    ? Math.round(out * monthlyRate)
    : 0;
  if (pay < fullInterest) {
    // Partial-month: unpaid interest does not accrue onto principal in
    // v1.1; the full payment goes to "interest" and outstanding is
    // unchanged. Caller is expected to warn the user.
    return { interest: pay, principal: 0 };
  }
  // Normal case: interest absorbs fullInterest, principal = remainder.
  // Overpayment: principal is clamped so outstanding can't go negative.
  const principal = Math.min(pay - fullInterest, out);
  return { interest: fullInterest, principal };
}

/** Total of every EMI across the full term. Pure helper for the
 *  "Total you pay" summary card on the loan calculator screen. */
export function loanTotalPaid(emi: number, termMonths: number): number {
  return emi * Math.max(0, Math.floor(Number(termMonths) || 0));
}

/** Total interest paid across the full term. */
export function loanTotalInterest(principal: number, emi: number, termMonths: number): number {
  return Math.max(0, loanTotalPaid(emi, termMonths) - (Number(principal) || 0));
}

/**
 * Build the full amortization table for a LoanPlan.
 *
 * Rules:
 *   - EMI is computed from `loanEMI(principal, rate, termMonths)`
 *     unless the user supplied an `emiOverride`. The override is
 *     capped at the principal so the table can never be "decreasing
 *     backwards"; if it's smaller than the standard EMI, the last
 *     row simply has a smaller remaining.
 *   - Each period's interest = outstanding × (rate/100/12).
 *   - Each period's principal = EMI − interest.
 *   - `remaining` after period = outstanding − principalPaid (floored
 *     at 0 to absorb floating-point drift on the final row).
 *   - `dueDate` is `startDate + period months` (clamped to month end
 *     so a Jan 31 start + 1 month lands on Feb 28/29, same rule as
 *     `investmentMaturityDate`).
 *
 * Returns an array of length `termMonths`. Empty array on bad input.
 */
export function loanAmortization(plan: LoanPlan): LoanInstallment[] {
  const principal = Number(plan.principal) || 0;
  const rate = Number(plan.rate) || 0;
  const n = Math.floor(Number(plan.termMonths) || 0);
  if (principal <= 0 || n <= 0) return [];

  const standard = loanEMI(principal, rate, n);
  // Use the user override if present; otherwise fall back to the
  // standard formula. Clamp at 0 — a 0 override gives a zero-interest
  // table, which is degenerate but legal.
  const emi = Math.max(0, Number(plan.emiOverride ?? standard) || 0);
  const monthlyRate = rate / 100 / 12;

  const out: LoanInstallment[] = [];
  let outstanding = principal;
  for (let period = 1; period <= n; period++) {
    const interestRaw = outstanding * monthlyRate;
    // Cap principal at what's actually outstanding — the last row pays
    // off the remainder cleanly. Round interest first, then derive
    // principal as `EMI - interest` (rounded) so the three values
    // always sum exactly. The last row's principal absorbs whatever
    // rounding drift accumulated.
    const interest = Math.round(interestRaw * 100) / 100;
    let principalPaid = Math.round((emi - interestRaw) * 100) / 100;
    if (principalPaid > outstanding) principalPaid = Math.round(outstanding * 100) / 100;
    outstanding = Math.max(0, outstanding - principalPaid);
    out.push({
      period,
      payment: Math.round((principalPaid + interest) * 100) / 100,
      interest,
      principalPaid,
      remaining: Math.round(outstanding * 100) / 100,
      dueDate: addMonthsISO(plan.startDate, period),
    });
  }
  return out;
}

/**
 * Date arithmetic that mirrors `investmentMaturityDate`: add N months
 * to an ISO date, clamping the day-of-month to the target month's
 * last day. e.g. 2026-01-31 + 1 month = 2026-02-28.
 *
 * Always returns an ISO date string (YYYY-MM-DD).
 */
export function addMonthsISO(iso: string, months: number): ISODate {
  const d = parseISODate(iso);
  const startDay = d.getUTCDate();
  const targetMonth = d.getUTCMonth() + months;
  const yearShift = Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;
  const year = d.getUTCFullYear() + yearShift;
  const lastDay = new Date(Date.UTC(year, normalizedMonth + 1, 0)).getUTCDate();
  const day = Math.min(startDay, lastDay);
  return new Date(Date.UTC(year, normalizedMonth, day)).toISOString().slice(0, 10);
}