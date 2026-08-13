/**
 * math.js — Pure financial math for Finora V1.
 *
 * No DOM, no localStorage, no module-level state. Every function is a pure
 * calculation that takes data and (optionally) a "now" reference and returns
 * a value. This file is browser-loadable as an ES module and also importable
 * directly by Vitest.
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

// ---------- Date helpers ----------

/**
 * Parse an ISO date string into a UTC Date at midnight.
 * Accepts "YYYY-MM-DD" and full ISO strings.
 */
export function parseISODate(iso) {
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

/**
 * Today as a UTC Date at midnight. Override `now` for tests.
 */
export function today(now = new Date()) {
  if (typeof now === 'string') now = parseISODate(now);
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * True if the given ISO date falls in (year, month) — month is 1-based for
 * readability (January = 1).
 */
export function isInMonth(dateIso, year, month) {
  const d = parseISODate(dateIso);
  return d.getUTCFullYear() === year && (d.getUTCMonth() + 1) === month;
}

/**
 * Whole calendar days from `fromIso` to `toIso` (b - a), positive if `toIso`
 * is in the future. Time-of-day is ignored.
 */
export function daysBetween(fromIso, toIso) {
  const a = parseISODate(fromIso);
  const b = parseISODate(toIso);
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / 86400000);
}

/**
 * Whole calendar months between two dates, floored.
 * 2025-01-15 → 2026-08-15 = 19 months. 2025-01-15 → 2026-07-31 = 18 months.
 */
export function monthsBetween(fromIso, toIso) {
  const a = parseISODate(fromIso);
  const b = parseISODate(toIso);
  let months = (b.getUTCFullYear() - a.getUTCFullYear()) * 12
             + (b.getUTCMonth() - a.getUTCMonth());
  // If `b`'s day-of-month is before `a`'s, that partial month doesn't count.
  if (b.getUTCDate() < a.getUTCDate()) months -= 1;
  return months;
}

// ---------- Transactions: filtering and summing ----------

/**
 * Sum amounts of transactions whose `type` is one of the given types
 * ("income" | "expense" | "transfer") and whose date is in (year, month).
 *
 * Transfers are intentionally NOT income or expense — pass `['income']` for
 * R1 and `['expense']` for R2.
 */
export function sumByType(transactions, types, year, month) {
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
export function monthlyIncome(transactions, year, month) {
  return sumByType(transactions, ['income'], year, month);
}

/** R2: monthly expense total. */
export function monthlyExpenses(transactions, year, month) {
  return sumByType(transactions, ['expense'], year, month);
}

/**
 * Sum transactions of one type on a single account (used for R3).
 * Note: for transfers, both ends must be applied — see accountBalance below.
 */
export function sumOnAccount(transactions, accountId, type) {
  let total = 0;
  for (const tx of transactions) {
    if (tx.type !== type) continue;
    if (type === 'transfer') {
      // For balance purposes we handle transfers specially in accountBalance.
      // This helper is for income/expense only.
      continue;
    }
    if (tx.accountId !== accountId) continue;
    total += Number(tx.amount) || 0;
  }
  return total;
}

// ---------- Accounts (R3) ----------

/**
 * R3: account balance = opening balance + sum of all transactions on the
 * account. For transfers, money leaves the from-account and lands in the
 * to-account.
 */
export function accountBalance(account, transactions) {
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
 * If monthsLeft <= 0, returns Infinity (caller should show "expired" or
 * "complete" message instead of a per-month number).
 *
 * @param goal { target, saved?, targetDate }
 * @param saved Number — current amount saved (caller computes from
 *   goal_contributions or stores it). Defaults to goal.saved.
 * @param now Date/string — defaults to today.
 */
export function goalRequiredPerMonth(goal, saved = goal?.saved, now = new Date()) {
  if (!goal) return 0;
  const remaining = (Number(goal.target) || 0) - (Number(saved) || 0);
  if (remaining <= 0) return 0;
  const months = monthsBetween(today(now), goal.targetDate);
  if (months <= 0) return Infinity;
  return remaining / months;
}

/** True if the goal is fully funded (saved >= target). */
export function isGoalCompleted(goal, saved = goal?.saved) {
  return (Number(saved) || 0) >= (Number(goal?.target) || 0);
}

/** True if the goal's target date is in the past. */
export function isGoalExpired(goal, now = new Date()) {
  if (!goal?.targetDate) return false;
  return today(now).getTime() > parseISODate(goal.targetDate).getTime();
}

// ---------- Debts (R7, R8) ----------

/**
 * R7: paid_so_far = sum of linked transactions' amounts.
 * Direction:
 *   i_owe      → linked transactions are Expense (cash going out to pay)
 *   owed_to_me → linked transactions are Income (cash coming in from them)
 */
export function debtPaidSoFar(debt, transactions) {
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
export function isDebtCompleted(debt, transactions) {
  if (!debt) return false;
  return debtPaidSoFar(debt, transactions) >= (Number(debt.total) || 0);
}

// ---------- Investments (R9, R10) ----------

/**
 * R9: maturity value = principal × (1 + rate/100 × termMonths/12)
 * Simple-interest display model — no daily accrual, no compounding.
 */
export function investmentMaturityValue(investment) {
  if (!investment) return 0;
  const principal = Number(investment.principal) || 0;
  const rate = Number(investment.rate) || 0;
  const months = Number(investment.termMonths) || 0;
  return principal * (1 + (rate / 100) * (months / 12));
}

/** R10 supporting: maturity date = start_date + term_months (calendar add).
 *  Day-of-month is clamped to the last day of the target month so that
 *  e.g. Jan 31 + 1 month = Feb 28 (not Mar 3 as JS Date.setUTCMonth overflow
 *  would give). This matches the intuitive "1 month later" for users.
 */
export function investmentMaturityDate(investment) {
  if (!investment?.startDate) return null;
  const start = parseISODate(investment.startDate);
  const startDay = start.getUTCDate();
  const targetMonth = start.getUTCMonth() + (Number(investment.termMonths) || 0);
  // Clamp day to the last day of the target month.
  const yearShift = Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;
  const year = start.getUTCFullYear() + yearShift;
  // Find last day of (year, normalizedMonth) by going to month+1 day 0.
  const lastDay = new Date(Date.UTC(year, normalizedMonth + 1, 0)).getUTCDate();
  const day = Math.min(startDay, lastDay);
  return new Date(Date.UTC(year, normalizedMonth, day));
}

/**
 * R10: derive the auto-status. The user-driven statuses `closed` and
 * `rolled_over` are sticky once set; `matured` is also sticky once it's
 * been observed (we don't demote a stored 'matured' back to 'active' if
 * the date math disagrees — that would clobber an acknowledged state).
 * Only `active` flips forward to `matured` on crossing the date.
 */
export function deriveInvestmentStatus(investment, now = new Date()) {
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
export function daysToMaturity(investment, now = new Date()) {
  const mat = investmentMaturityDate(investment);
  if (!mat) return 0;
  return daysBetween(today(now), mat);
}
