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
 *   R9  Investment value  → investmentMaturityValue()
 *   R10 Investment status → deriveInvestmentStatus()
 *
 * Date conventions:
 *   - Input dates are ISO-8601 strings ("YYYY-MM-DD" or full ISO).
 *   - "now" is an optional Date or ISO string, default = new Date().
 *   - All math uses UTC date components to avoid timezone drift.
 */

import type { Account, Debt, Goal, Investment, Transaction, ISODate } from './types';

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
 * R10 supporting: maturity date = start_date + term_months (calendar add).
 * Day-of-month is clamped to the last day of the target month so that
 * e.g. Jan 31 + 1 month = Feb 28 (not Mar 3).
 */
export function investmentMaturityDate(investment: Investment): Date | null {
  if (!investment?.startDate) return null;
  const start = parseISODate(investment.startDate);
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

// ---------- Goals (R5 — derived `saved`) ----------

/**
 * R6 (derived): sum of `expense` transactions where `linkedGoalId === goal.id`.
 * `goal.saved` is the legacy stored field; this is the source of truth.
 */
export function goalSavedFromTxns(goal: Goal, transactions: Transaction[]): number {
  if (!goal) return 0;
  let total = 0;
  for (const t of transactions) {
    if (t.linkedGoalId !== goal.id) continue;
    if (t.type === 'expense') total += Number(t.amount) || 0;
  }
  return total;
}

/** Convenience: progress ratio (0..1) considering derived saved. */
export function goalProgress(goal: Goal, transactions: Transaction[]): number {
  if (!goal) return 0;
  const target = Number(goal.target) || 0;
  if (target <= 0) return 1;
  const saved = goalSavedFromTxns(goal, transactions);
  return Math.min(1, saved / target);
}

/** R5 wrapper using the derived saved amount. */
export function goalRequiredPerMonthDerived(
  goal: Goal,
  transactions: Transaction[],
  now: string | Date = new Date()
): number {
  const saved = goalSavedFromTxns(goal, transactions);
  return goalRequiredPerMonth(goal, saved, now);
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
 * Type-aware maturity value. For DPS: annuity-due. For FDR/savings:
 * simple-interest (preserves R9 behavior).
 */
export function investmentMaturityValueTyped(investment: Investment): number {
  if (!investment) return 0;
  if (investment.type === 'dps') return dpsMaturityValue(investment);
  return investmentMaturityValue(investment);
}