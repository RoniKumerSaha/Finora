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
  debtOutstanding,
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
  dpsContributedSoFar,
  parseISODate,
  today,
  computeNetWorth,
  investmentValue,
  isInvestmentHeld,
  loanEMI,
  loanPaymentSplit,
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

// ---------- Monthly statement ----------

/**
 * The Monthly statement's rows — exactly the last 12 calendar months,
 * January through December of the current year.
 *
 * The statement is a statement OF a year, so it always runs the full
 * calendar: January through December. Months with no activity (and
 * months that have not happened yet) are shown at zero rather than
 * being cut off, so the table reads as a calendar and not a slice of
 * one.
 *
 * Always 12 rows, whatever the range — the range pills change what the
 * OTHER cards show, but the statement is a fixed yearly ledger.
 */
export function monthlyStatement(
  state: StateLike,
  range: DateRange
): { bars: MonthlyBar[] } {
  const end = range.end;
  const endYear = end.getUTCFullYear();

  const bars: MonthlyBar[] = [];
  for (let m = 1; m <= 12; m++) {
    bars.push({ year: endYear, month: m, label: `${MONTHS_SHORT[m - 1]} ${endYear}`, income: 0, expense: 0 });
  }

  const indexByKey = new Map(bars.map((b, i) => [`${b.year}-${b.month}`, i]));
  for (const tx of state.transactions) {
    if (tx.type === 'transfer') continue;
    const d = parseISODate(tx.date);
    if (d.getTime() > end.getTime()) continue;
    const idx = indexByKey.get(`${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`);
    if (idx === undefined) continue;
    const amt = Math.abs(Number(tx.amount) || 0);
    if (tx.type === 'income') bars[idx].income += amt;
    else bars[idx].expense += amt;
  }

  return { bars };
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
  // For the *current* month we anchor the last point to "today" so the
  // chart's most-recent point matches the Home hero's net worth exactly
  // — both call `computeNetWorth` against the same unfiltered state at
  // the same instant. Past months still use their end-of-month date so
  // historical snapshots remain accurate.
  const todayISO = new Date().toISOString().slice(0, 10);
  for (let i = 0; i < count; i++) {
    const d = new Date(Date.UTC(chartStart.getUTCFullYear(), chartStart.getUTCMonth() + i, 1));
    const endOfMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
    const isCurrentMonth = d.getUTCFullYear() === new Date().getUTCFullYear()
                        && d.getUTCMonth()    === new Date().getUTCMonth();
    const value = isCurrentMonth
      // Current month: today's snapshot on unfiltered state — matches Home.
      ? computeNetWorth(state, todayISO).currentNetWorth
      // Past months: end-of-month snapshot, future-dated txs filtered out.
      : netWorthAt(state, endOfMonth);
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
    // Canonical outstanding — for a loan-kind debt this is the
    // principal still owed (gross payments include interest), which is
    // what every other screen shows.
    const remaining = debtOutstanding(d, state.transactions);
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

// ---------- Net worth composition (donut) ----------

/**
 * One slice of the net-worth donut.
 *
 * `key` is stable so the screen can key its legend rows and pick a
 * deterministic colour per slice (the donut's conic-gradient and the
 * legend swatches must agree).
 */
export interface CompositionSlice {
  key: 'cash' | 'savings' | 'dps' | 'receivables' | 'debt' | 'other';
  label: string;
  amount: number;
  /** Share of the total, 0..100. */
  pct: number;
  /** Negative for debt — the slice reduces net worth. */
  sign: 1 | -1;
}

/**
 * Break net worth into the slices the Insights donut draws.
 *
 * "Debt" is shown as its own slice even though it is a liability: the
 * donut answers "where does my money sit?", and a negative slice drawn
 * against the positive ones would be misread as a spend. The net-worth
 * figure itself stays `cash + investments + receivables − debt`, which
 * is what the Home hero shows.
 *
 * Investments are split by KIND — savings schemes (FDR / savings) and
 * DPS — because they sit very differently in someone's finances: an FDR
 * is cash parked at a rate, a DPS is a long-term retirement pot. One
 * combined "Investments" slice hides the distinction the user actually
 * thinks in. The two parts always sum to `nw.invCurrent`, so the donut
 * still reconciles with the Home hero exactly.
 *
 * Every amount is the same figure the Home screen uses
 * (`computeNetWorth`), so the donut can never disagree with the hero.
 */
export function netWorthComposition(
  state: StateLike,
  now: string | Date = new Date()
): { slices: CompositionSlice[]; netWorth: number; total: number; debt: number } {
  const nw = computeNetWorth(state, now);

  // Split the investment bucket by scheme kind, using the same
  // `investmentValue` the net worth uses so the two parts reconcile.
  let savingsValue = 0;
  let dpsValue = 0;
  const todayISO = parseISODate(now).toISOString().slice(0, 10);
  for (const inv of state.investments) {
    if (!isInvestmentHeld(inv)) continue;
    if (inv.startDate > todayISO) continue;
    const v = investmentValue(inv, state.transactions, now).currentValue;
    if (inv.type === 'dps') dpsValue += v;
    else savingsValue += v;
  }
  // `computeNetWorth` is the authority for the total; if the split ever
  // disagrees (a new investment kind), the difference falls into
  // "Other" so the donut still adds up.
  const splitTotal = savingsValue + dpsValue;
  const other = Math.max(0, nw.invCurrent - splitTotal);

  // The donut answers "what have I got?", so its slices are ASSETS.
  // Debt is not an asset — it is what you owe — so it is excluded from
  // the ring and reported as an offset instead. Including it would
  // paint the biggest slice of the ring as the thing you OWE, which
  // reads backwards.
  const assets = nw.cash + nw.invCurrent + nw.receivables;
  const netWorth = nw.currentNetWorth;

  const raw: { key: CompositionSlice['key']; label: string; amount: number; sign: 1 | -1 }[] = [
    { key: 'cash', label: 'Cash & wallets', amount: nw.cash, sign: 1 },
    { key: 'savings', label: 'Savings schemes', amount: savingsValue, sign: 1 },
    { key: 'dps', label: 'DPS', amount: dpsValue, sign: 1 },
    { key: 'other', label: 'Other', amount: other, sign: 1 },
    { key: 'receivables', label: 'Receivables', amount: nw.receivables, sign: 1 },
  ];

  const slices: CompositionSlice[] = raw
    .filter(s => s.amount > 0)
    .map(s => ({
      ...s,
      pct: assets > 0 ? (s.amount / assets) * 100 : 0,
    }));

  return { slices, netWorth, total: assets, debt: nw.oweRemaining };
}

// ---------- Investment summary ----------

export interface InvestmentSummaryRow {
  id: string;
  name: string;
  /** Annual rate, percent. */
  rate: number;
  /** Term in months. */
  termMonths: number;
  /** What you've put in so far (principal, or DPS contributions). */
  contributed: number;
  /** What the scheme is projected to pay at maturity. */
  maturityValue: number;
  /** maturityValue − contributed. Negative when a DPS has been paid out. */
  earnings: number;
}

/**
 * Headline figures for the Insights "Investments" summary card.
 *
 * `contributed` uses the same rule as the Investments screen and the
 * Trends card: for DPS it is the money actually paid in
 * (`dpsContributedSoFar`), for FDR / savings it is the lump-sum
 * principal. `maturityValue` is the projected payout minus anything
 * already paid out, so a DPS that has matured and been collected does
 * not keep reporting a phantom gain.
 */
export function investmentSummary(
  state: StateLike
): {
  rows: InvestmentSummaryRow[];
  totalContributed: number;
  totalMaturity: number;
  totalEarnings: number;
  /** Simple average of the schemes' annual rates, weighted by nothing. */
  averageRate: number;
} {
  const rows: InvestmentSummaryRow[] = [];
  let totalContributed = 0;
  let totalMaturity = 0;
  let rateSum = 0;

  for (const inv of state.investments) {
    if (inv.status === 'closed' || inv.status === 'rolled_over') continue;
    const contributed = inv.type === 'dps'
      ? dpsContributedSoFar(inv, state.transactions)
      : (Number(inv.principal) || 0);
    const paidOut = dpsPaidOutSoFar(inv, state.transactions);
    const maturityValue = Math.max(0, investmentMaturityValueTyped(inv) - paidOut);
    const rate = Number(inv.rate) || 0;

    totalContributed += contributed;
    totalMaturity += maturityValue;
    rateSum += rate;

    rows.push({
      id: inv.id,
      name: inv.name,
      rate,
      termMonths: Number(inv.termMonths) || 0,
      contributed,
      maturityValue,
      earnings: maturityValue - contributed,
    });
  }

  rows.sort((a, b) => b.earnings - a.earnings);

  return {
    rows,
    totalContributed,
    totalMaturity,
    totalEarnings: totalMaturity - totalContributed,
    averageRate: rows.length > 0 ? rateSum / rows.length : 0,
  };
}

// ---------- Loan summary ----------

export interface LoanSummaryRow {
  id: string;
  name: string;
  /** Annual interest rate, percent. 0 for flat-kind debts. */
  rate: number;
  /** Monthly payment on a loan-kind debt; 0 when there's no term. */
  monthly: number;
  /** Principal still owed. */
  outstanding: number;
  /** Principal repaid so far. */
  principalPaid: number;
  /** Interest paid so far. */
  interestPaid: number;
  /** Interest still to be paid over the remaining term. */
  interestLeft: number;
  /** Principal + interest as a share of the original amount. */
  principalPct: number;
  interestPct: number;
}

/**
 * Headline figures for the Insights "Loans" summary card.
 *
 * Only loan-kind debts carry interest; flat debts report zero across
 * the interest columns so the card can list them without pretending
 * they accrue.
 *
 * Only debts you OWE (`direction === 'i_owe'`) are included. A debt
 * someone owes YOU is a receivable — it belongs in the net-worth
 * composition's "Receivables" slice, not in a card whose headline
 * figure is "still owed".
 *
 * The interest/principal split replays `loanPaymentSplit` over the
 * debt's own linked payments in date order — the exact replay the
 * Debts screen does — so the Insights figure and the Debts screen can
 * never disagree about how much of a payment was interest.
 */
export function loanSummary(
  state: StateLike
): {
  rows: LoanSummaryRow[];
  totalOutstanding: number;
  totalInterestPaid: number;
  totalInterestLeft: number;
  totalMonthlyInterest: number;
} {
  const rows: LoanSummaryRow[] = [];
  let totalOutstanding = 0;
  let totalInterestPaid = 0;
  let totalInterestLeft = 0;
  let totalMonthlyInterest = 0;

  for (const d of state.debts) {
    if (d.status === 'completed' || d.status === 'archived') continue;
    if (d.direction !== 'i_owe') continue;
    const outstanding = debtOutstanding(d, state.transactions);
    if (outstanding <= 0) continue;

    const isLoan = d.kind === 'loan';
    const rate = isLoan ? (Number(d.interestRate) || 0) : 0;
    const term = Number(d.termMonths) || 0;
    const total = Number(d.total) || 0;

    // Replay the debt's payments to split them into interest and
    // principal, exactly as the Debts screen does.
    let principalPaid = 0;
    let interestPaid = 0;
    let out = total;
    if (isLoan) {
      const linked = state.transactions
        .filter(t => t.linkedDebtId === d.id)
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date));
      for (const t of linked) {
        // Only expenses reduce a debt you owe.
        if (t.type !== 'expense') continue;
        const split = loanPaymentSplit(out, Number(t.amount) || 0, rate);
        interestPaid += split.interest;
        principalPaid += split.principal;
        out = Math.max(0, out - split.principal);
      }
    } else {
      principalPaid = Math.max(0, total - outstanding);
    }

    // Interest still to be paid. We replay the amortisation schedule
    // from the CURRENT outstanding balance over the REMAINING
    // instalments — replaying from the original principal and
    // subtracting what was already paid double-counts the interest
    // the early instalments carried.
    //
    // Without a term we can't project, so we report 0 rather than
    // guessing.
    let interestLeft = 0;
    if (isLoan && term > 0 && rate > 0 && outstanding > 0) {
      // Instalments still to run. We don't track how many payments
      // were made, so we run the schedule over the full term from the
      // current balance — the standard "what's left if you keep
      // paying the same amount" projection.
      const remainingEmi = loanEMI(outstanding, rate, term);
      let remaining = outstanding;
      for (let i = 0; i < term; i++) {
        if (remaining <= 0) break;
        const interest = Math.round(remaining * (rate / 100 / 12));
        interestLeft += interest;
        remaining = Math.max(0, remaining - Math.max(0, remainingEmi - interest));
      }
    }

    const monthlyInterest = isLoan && rate > 0
      ? Math.round(outstanding * (rate / 100 / 12))
      : 0;

    totalOutstanding += outstanding;
    totalInterestPaid += interestPaid;
    totalInterestLeft += interestLeft;
    totalMonthlyInterest += monthlyInterest;

    rows.push({
      id: d.id,
      name: d.name,
      rate,
      monthly: isLoan && term > 0 ? Math.round(loanEMI(total, rate, term)) : 0,
      outstanding,
      principalPaid,
      interestPaid,
      interestLeft,
      principalPct: total > 0 ? (principalPaid / total) * 100 : 0,
      interestPct: total > 0 ? (interestPaid / total) * 100 : 0,
    });
  }

  rows.sort((a, b) => b.outstanding - a.outstanding);

  return {
    rows,
    totalOutstanding,
    totalInterestPaid,
    totalInterestLeft,
    totalMonthlyInterest,
  };
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
