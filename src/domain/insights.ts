/**
 * insights.ts — pure aggregations for the /insights screen.
 *
 * Spine: docs/ux-designs/ux-finora-2026-08-14-analytics/EXPERIENCE.md
 *
 * Every function is pure: takes data + optional "now" and returns a
 * shape ready to render. No DOM, no localStorage, no store reads.
 *
 * The screen calls these once per render. Sub-millisecond cost on V1
 * data sizes; if data grows (thousands of transactions, years of
 * activity), memoize them per (range, data-version) in a future run.
 */

import type {
  Account,
  Category,
  Debt,
  Goal,
  Investment,
  Transaction,
} from './types';
import {
  daysBetween,
  debtPaidSoFar,
  goalProgress,
  goalSaved,
  goalRequiredPerMonth,
  isDebtCompleted,
  isGoalCompleted,
  isGoalExpired,
  investmentMaturityValueTyped,
  daysToMaturity,
  dpsPaidOutSoFar,
  parseISODate,
  today,
  computeNetWorth,
} from './math';

// ---------- Date-range model ----------

export type DateRangeKey = 'thisMonth' | 'last3' | 'last6' | 'last12' | 'all';

export const RANGE_LABELS: Record<DateRangeKey, string> = {
  thisMonth: 'This month',
  last3: 'Last 3 months',
  last6: 'Last 6 months',
  last12: 'Last 12 months',
  all: 'All time',
};

export const RANGE_ORDER: DateRangeKey[] = ['thisMonth', 'last3', 'last6', 'last12', 'all'];

export const DEFAULT_RANGE: DateRangeKey = 'last6';

export const RANGE_STORAGE_KEY = 'finora.insights.range';

export interface DateRange {
  /** UTC midnight for the start of the window (inclusive). */
  start: Date;
  /** UTC midnight for the end of the window (inclusive). */
  end: Date;
  /** Number of months in the window — used for chart column count. */
  months: number;
}

/**
 * Resolve a range key to concrete bounds. `now` defaults to today.
 * - "thisMonth" → from the 1st of the current month to today.
 * - "lastN" → the last N calendar months ending today (inclusive).
 * - "all" → returns null-ish sentinel: end = today, start = far past.
 *   Callers should special-case "all" by using the earliest transaction.
 */
export function resolveRange(key: DateRangeKey, now: Date = new Date()): DateRange {
  const t = today(now);
  if (key === 'thisMonth') {
    const start = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1));
    const months = (t.getUTCFullYear() - start.getUTCFullYear()) * 12
                 + (t.getUTCMonth() - start.getUTCMonth()) + 1;
    return { start, end: t, months };
  }
  if (key === 'all') {
    // Far-past sentinel; callers should swap to "earliest tx" for display.
    const start = new Date(Date.UTC(2000, 0, 1));
    return { start, end: t, months: 240 };
  }
  const n = key === 'last3' ? 3 : key === 'last6' ? 6 : 12;
  // Last N months: anchor end to today, walk back N months.
  const start = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - (n - 1), 1));
  return { start, end: t, months: n };
}

/**
 * For the "all" range, the actual lower bound is the earliest transaction
 * date (or earliest createdAt across accounts/goals/debts/investments).
 * Returns null if there's nothing to anchor to.
 */
export function earliestDate(state: Pick<StateLike, 'transactions' | 'accounts' | 'goals' | 'debts' | 'investments'>): Date | null {
  const candidates: string[] = [];
  for (const t of state.transactions) candidates.push(t.date);
  for (const a of state.accounts) candidates.push(a.createdAt);
  for (const g of state.goals) candidates.push(g.createdAt);
  for (const d of state.debts) candidates.push(d.createdAt);
  for (const i of state.investments) candidates.push(i.startDate, i.createdAt);
  if (candidates.length === 0) return null;
  candidates.sort();
  return parseISODate(candidates[0]);
}

interface StateLike {
  transactions: Transaction[];
  accounts: Account[];
  goals: Goal[];
  debts: Debt[];
  investments: Investment[];
  categories: Category[];
}

// ---------- Filtering ----------

/** True if the transaction's date falls within the range, inclusive. */
export function txInRange(tx: Transaction, range: DateRange): boolean {
  const d = parseISODate(tx.date);
  return d.getTime() >= range.start.getTime() && d.getTime() <= range.end.getTime();
}

// ---------- Stat row (3-up) ----------

export interface StatRow {
  netFlow: number;
  netFlowPrev: number;
  avgMonthlyExpense: number;
  avgMonthlyExpensePrev: number;
  savedTowardGoals: number;
  savedTowardGoalsPrev: number;
}

/**
 * Compute the three KPI tiles.
 * - Net flow = sum(income) - sum(expense) in the range.
 * - Avg monthly expense = sum(expense) / months in range.
 * - Saved toward goals = sum of goal contributions in the range.
 *   Contributions are plan-only entries on each goal — they do not
 *   touch transactions or account balances.
 *
 * Each metric also has a "previous period of equal length" comparison:
 * the window of the same length immediately preceding the current one.
 * If the previous period has no data, the comparison is 0 (caller
 * suppresses the "vs previous" caption).
 */
export function computeStats(
  state: StateLike,
  range: DateRange,
  rangeKey: DateRangeKey
): StatRow {
  const inRange = (tx: Transaction) => txInRange(tx, range);
  const previousRange = previousRangeOf(range, rangeKey);

  let netFlow = 0;
  let netFlowPrev = 0;
  let expenseSum = 0;
  let expenseSumPrev = 0;
  let savedSum = 0;
  let savedSumPrev = 0;

  for (const tx of state.transactions) {
    if (tx.type === 'transfer') continue;
    const amt = Number(tx.amount) || 0;
    if (inRange(tx)) {
      if (tx.type === 'income') netFlow += amt;
      else if (tx.type === 'expense') netFlow -= amt;
      if (tx.type === 'expense') expenseSum += amt;
    } else if (previousRange && txInRange(tx, previousRange)) {
      if (tx.type === 'income') netFlowPrev += amt;
      else if (tx.type === 'expense') netFlowPrev -= amt;
      if (tx.type === 'expense') expenseSumPrev += amt;
    }
  }

  // Goal contributions — sum by date, not by transaction type. We
  // build a tiny per-contribution object so we can reuse the same
  // `txInRange` predicate (it only reads `.date`).
  for (const goal of state.goals) {
    for (const c of goal.contributions) {
      const amt = Number(c.amount) || 0;
      const pseudo = { date: c.date } as Transaction;
      if (inRange(pseudo)) savedSum += amt;
      else if (previousRange && txInRange(pseudo, previousRange)) savedSumPrev += amt;
    }
  }

  return {
    netFlow,
    netFlowPrev,
    avgMonthlyExpense: expenseSum / Math.max(1, range.months),
    avgMonthlyExpensePrev: expenseSumPrev / Math.max(1, range.months),
    savedTowardGoals: savedSum,
    savedTowardGoalsPrev: savedSumPrev,
  };
}

/**
 * The window of equal length immediately preceding the current range.
 * For "all" we don't compute a comparison (no fixed length), so we
 * return null.
 */
function previousRangeOf(range: DateRange, rangeKey: DateRangeKey): DateRange | null {
  if (rangeKey === 'all' || rangeKey === 'thisMonth') return null;
  // Last N months: previous = the N months before that.
  const n = range.months;
  const start = new Date(Date.UTC(
    range.start.getUTCFullYear(),
    range.start.getUTCMonth() - n,
    1
  ));
  const end = new Date(Date.UTC(
    range.start.getUTCFullYear(),
    range.start.getUTCMonth(),
    0 // last day of the previous month
  ));
  return { start, end, months: n };
}

// ---------- Cash flow chart ----------

export interface MonthlyBar {
  year: number;
  month: number; // 1..12
  /** "Aug 2026" — short month + year for axis labels. */
  label: string;
  income: number;
  expense: number;
}

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/**
 * Group income/expense transactions by month within the range. Months
 * with no activity are kept (zero bars) so the chart shows a continuous
 * timeline rather than a fragmented one.
 *
 * For "all time", the chart is capped at the last 12 months to fit on
 * screen. The caller can show a "showing last 12 of N months" hint.
 */
export function monthlyCashFlow(
  state: StateLike,
  range: DateRange,
  rangeKey: DateRangeKey
): { bars: MonthlyBar[]; cappedAt: number; totalMonths: number } {
  let start = range.start;
  let end = range.end;
  let totalMonths = range.months;
  if (rangeKey === 'all') {
    const earliest = earliestDate(state);
    if (earliest) start = earliest;
    totalMonths = monthsBetween(start, end) + 1;
  }

  const cap = 12;
  const count = Math.min(totalMonths, cap);
  const chartStart = totalMonths > cap
    ? new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - (cap - 1), 1))
    : start;

  const bars: MonthlyBar[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(Date.UTC(chartStart.getUTCFullYear(), chartStart.getUTCMonth() + i, 1));
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    bars.push({ year: y, month: m, label: `${MONTHS_SHORT[m - 1]} ${y}`, income: 0, expense: 0 });
  }

  const indexByKey = new Map(bars.map((b, i) => [`${b.year}-${b.month}`, i]));
  for (const tx of state.transactions) {
    if (tx.type === 'transfer') continue;
    const d = parseISODate(tx.date);
    if (d.getTime() < chartStart.getTime() || d.getTime() > end.getTime()) continue;
    const idx = indexByKey.get(`${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`);
    if (idx === undefined) continue;
    const amt = Math.abs(Number(tx.amount) || 0);
    if (tx.type === 'income') bars[idx].income += amt;
    else bars[idx].expense += amt;
  }

  return { bars, cappedAt: cap, totalMonths };
}

function monthsBetween(from: Date, to: Date): number {
  const a = today(from);
  const b = today(to);
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12
       + (b.getUTCMonth() - a.getUTCMonth());
}

// ---------- Spending by category ----------

export interface CategoryRow {
  categoryId: string | null; // null for the "Other" bucket
  name: string;
  amount: number;
  pct: number; // 0..100
}

/**
 * Top 6 categories by total expense in the range, plus an "Other" row
 * aggregating the rest. Categories with no transactions are omitted
 * entirely (no zero rows).
 */
export function categoryBreakdown(state: StateLike, range: DateRange): CategoryRow[] {
  const totals = new Map<string, number>();
  let sum = 0;
  for (const tx of state.transactions) {
    if (tx.type !== 'expense') continue;
    if (!txInRange(tx, range)) continue;
    if (!tx.categoryId) continue;
    const amt = Math.abs(Number(tx.amount) || 0);
    totals.set(tx.categoryId, (totals.get(tx.categoryId) ?? 0) + amt);
    sum += amt;
  }
  if (sum === 0) return [];

  const sorted = [...totals.entries()]
    .sort((a, b) => b[1] - a[1]);

  const rows: CategoryRow[] = [];
  const top = sorted.slice(0, 6);
  const rest = sorted.slice(6);
  let restSum = 0;
  for (const [, amt] of rest) restSum += amt;

  for (const [id, amt] of top) {
    const catObj = state.categories.find(c => c.id === id);
    rows.push({
      categoryId: id,
      name: catObj?.name ?? 'Unknown',
      amount: amt,
      pct: (amt / sum) * 100,
    });
  }
  if (restSum > 0) {
    rows.push({
      categoryId: null,
      name: 'Other',
      amount: restSum,
      pct: (restSum / sum) * 100,
    });
  }
  return rows;
}

// ---------- Net worth trajectory ----------

export interface NetWorthPoint {
  year: number;
  month: number;
  label: string;
  value: number; // full net worth at this month-end (cash + investments + receivables − I-owe)
}

/**
 * Net worth at the end of each month in the range. For "all time",
 * capped at the last 12 months. Delegates to `computeNetWorth` after
 * filtering transactions to the month-end, so the trajectory's last
 * point equals the Home tile's current net worth.
 */
export function netWorthSeries(
  state: StateLike,
  range: DateRange,
  rangeKey: DateRangeKey
): { points: NetWorthPoint[]; cappedAt: number; totalMonths: number } {
  let start = range.start;
  let end = range.end;
  let totalMonths = range.months;
  if (rangeKey === 'all') {
    const earliest = earliestDate(state);
    if (earliest) start = earliest;
    totalMonths = monthsBetween(start, end) + 1;
  }

  const cap = 12;
  const count = Math.min(totalMonths, cap);
  const chartStart = totalMonths > cap
    ? new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - (cap - 1), 1))
    : start;

  const points: NetWorthPoint[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(Date.UTC(chartStart.getUTCFullYear(), chartStart.getUTCMonth() + i, 1));
    const endOfMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
    const value = netWorthAt(state, endOfMonth);
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    points.push({
      year: y,
      month: m,
      label: `${MONTHS_SHORT[m - 1]} ${y}`,
      value,
    });
  }
  return { points, cappedAt: cap, totalMonths };
}

/**
 * Net worth at the given date. Filters state to only transactions on
 * or before `asOf` and delegates to `computeNetWorth`, so the
 * trajectory chart's last point is guaranteed to match the Home tile.
 */
function netWorthAt(state: StateLike, asOf: Date): number {
  const cutoff = asOf.toISOString().slice(0, 10);
  const cutoffState = {
    ...state,
    transactions: state.transactions.filter(t => t.date <= cutoff),
  };
  return computeNetWorth(cutoffState, cutoff).currentNetWorth;
}

// ---------- Goals widget ----------

export interface GoalRow {
  id: string;
  name: string;
  target: number;
  saved: number;
  pct: number; // 0..100
  remaining: number;
  requiredPerMonth: number;
  targetDate: string;
  perMonthLabel: string;
  status: 'on-track' | 'behind' | 'expired';
}

/**
 * Active goals only. Sort by closest deadline first.
 */
export function goalsForInsights(state: StateLike, now: Date = new Date()): GoalRow[] {
  const rows: GoalRow[] = [];
  for (const g of state.goals) {
    const saved = goalSaved(g);
    if (isGoalCompleted(g, saved)) continue;
    const target = Number(g.target) || 0;
    const remaining = Math.max(0, target - saved);
    const required = goalRequiredPerMonth(g, saved, now);
    const pct = Math.round(goalProgress(g) * 100);
    const expired = isGoalExpired(g, now);
    const status: GoalRow['status'] = expired ? 'expired' : 'on-track';
    const perMonthLabel = required === Infinity
      ? '— past due —'
      : required === 0
        ? '— done —'
        : `${Math.round(required).toLocaleString('en-IN')} / mo`;
    rows.push({
      id: g.id,
      name: g.name,
      target,
      saved,
      pct,
      remaining,
      requiredPerMonth: required,
      targetDate: g.targetDate,
      perMonthLabel,
      status,
    });
  }
  rows.sort((a, b) => a.targetDate.localeCompare(b.targetDate));
  return rows;
}

// ---------- Debts widget ----------

export interface DebtRow {
  id: string;
  name: string;
  direction: 'i_owe' | 'owed_to_me';
  total: number;
  paid: number;
  remaining: number;
  pct: number;
  dueDate?: string;
  eta: string;
}

/**
 * Active debts only. Sort by due date asc, nulls last.
 */
export function debtsForInsights(state: StateLike, now: Date = new Date()): DebtRow[] {
  const rows: DebtRow[] = [];
  for (const d of state.debts) {
    if (isDebtCompleted(d, state.transactions)) continue;
    if (d.status === 'completed' || d.status === 'archived') continue;
    const total = Number(d.total) || 0;
    const paid = debtPaidSoFar(d, state.transactions);
    const remaining = Math.max(0, total - paid);
    const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
    rows.push({
      id: d.id,
      name: d.name,
      direction: d.direction,
      total,
      paid,
      remaining,
      pct,
      dueDate: d.dueDate,
      eta: projectDebtEta(d, state, now),
    });
  }
  rows.sort((a, b) => {
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return 0;
  });
  return rows;
}

/**
 * Project an ETA-to-zero for a debt based on the last 90 days of payments.
 * Returns:
 *  - "by {date}" when the average pace would clear the debt by a real date.
 *  - "no recent payments to project ETA" when there are no payments in
 *    the last 90 days.
 */
function projectDebtEta(
  d: Debt,
  state: StateLike,
  now: Date
): string {
  const cutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 3, now.getUTCDate()));
  const cutoffIso = cutoff.toISOString().slice(0, 10);
  let sum = 0;
  let count = 0;
  for (const tx of state.transactions) {
    if (tx.linkedDebtId !== d.id) continue;
    if (tx.date < cutoffIso) continue;
    if (d.direction === 'i_owe' && tx.type === 'expense') {
      sum += Number(tx.amount) || 0;
      count++;
    } else if (d.direction === 'owed_to_me' && tx.type === 'income') {
      sum += Number(tx.amount) || 0;
      count++;
    }
  }
  if (count === 0) return 'no recent payments to project ETA';
  const avgPerPayment = sum / count;
  const paid = debtPaidSoFar(d, state.transactions);
  const total = Number(d.total) || 0;
  const remaining = Math.max(0, total - paid);
  if (avgPerPayment <= 0) return 'no recent payments to project ETA';
  // Crude pace: assume same frequency continues. Estimate # of payments
  // remaining and average days between them.
  const payments = count;
  const spanDays = Math.max(1, daysBetween(cutoffIso, now));
  const avgIntervalDays = spanDays / payments;
  const remainingPayments = Math.ceil(remaining / avgPerPayment);
  const etaDays = Math.round(remainingPayments * avgIntervalDays);
  const etaDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + etaDays));
  return `by ${etaDate.toISOString().slice(0, 10)}`;
}

// ---------- Investments widget ----------

export interface InvestmentRow {
  id: string;
  name: string;
  type: Investment['type'];
  maturityValue: number;
  daysToMaturity: number;
  payoutAccountName?: string;
  principal: number;
  rate: number;
  termMonths: number;
  /** "Matured" | "Active" — drives sort rank for matured-first. */
  status: 'matured' | 'active';
}

/**
 * Active investments. Sort by days-to-maturity asc (closest first);
 * matured (days ≤ 0) sort to the top.
 */
export function investmentsForInsights(state: StateLike, now: Date = new Date()): InvestmentRow[] {
  const rows: InvestmentRow[] = [];
  for (const inv of state.investments) {
    if (inv.status === 'closed' || inv.status === 'rolled_over') continue;
    const days = daysToMaturity(inv, now);
    const id = inv.id;
    const payoutAcc = inv.payoutAccountId
      ? state.accounts.find(a => a.id === inv.payoutAccountId)
      : undefined;
    // Net amount the user can expect: full mature value minus anything
    // already paid out (DPS supports partial payouts). DPS routes through
    // annuity-due; FDR/savings through simple interest.
    const projected = investmentMaturityValueTyped(inv);
    const paidOut = dpsPaidOutSoFar(inv, state.transactions);
    rows.push({
      id,
      name: inv.name,
      type: inv.type,
      maturityValue: Math.max(0, projected - paidOut),
      daysToMaturity: days,
      payoutAccountName: payoutAcc?.name,
      principal: Number(inv.principal) || 0,
      rate: Number(inv.rate) || 0,
      termMonths: Number(inv.termMonths) || 0,
      status: days <= 0 ? 'matured' : 'active',
    });
  }
  rows.sort((a, b) => {
    if (a.status === 'matured' && b.status !== 'matured') return -1;
    if (b.status === 'matured' && a.status !== 'matured') return 1;
    return a.daysToMaturity - b.daysToMaturity;
  });
  return rows;
}

// ---------- localStorage helpers ----------

export function readRange(): DateRangeKey {
  if (typeof localStorage === 'undefined') return DEFAULT_RANGE;
  const v = localStorage.getItem(RANGE_STORAGE_KEY);
  if (v && (RANGE_ORDER as string[]).includes(v)) return v as DateRangeKey;
  return DEFAULT_RANGE;
}

export function writeRange(key: DateRangeKey): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(RANGE_STORAGE_KEY, key);
  } catch {
    // localStorage may be unavailable (private mode, etc.) — silently skip.
  }
}
