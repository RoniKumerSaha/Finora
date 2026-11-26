/**
 * InsightsScreen — analytics dashboard at /insights.
 *
 * Spine: docs/ux-designs/ux-finora-2026-08-14-analytics/EXPERIENCE.md
 *
 * 2026-11-24 redesign (Variant K — cash flow first): the page now
 * answers its questions in the order people actually ask them.
 *
 *   1. Cash flow            (hero, full-width) — "did I spend too much?"
 *   2. What stands out      + Where your money sits   (2-up)
 *   3. Investments          + Loans                   (2-up summaries)
 *   4. Monthly statement    (full-width) — the exact figures
 *
 * The 2026-09-03 layout (Cash flow hero → Spending + Net worth 2-up
 * → Trends) put the aggregates last, so a user looking for "what
 * stands out" had to scroll past three cards. Variant K leads with
 * the chart and promotes the generated insight feed to the second
 * slot, directly under it.
 *
 * **What moved, and why.**
 *
 *   - "What stands out" is a NEW card — a generated feed of insights
 *     derived from the range (biggest category, savings-rate change,
 *     best month, runway, investment growth). It replaces the Trends
 *     card's role as the "so what?" of the page, but Trends stays:
 *     the feed is prose, Trends is the precise four-row aggregate.
 *   - "Where your money sits" replaces the Net worth card's slot. It
 *     is a donut of the SAME figures the Home hero shows (via
 *     `computeNetWorth`), so it can never disagree with Home.
 *   - "Spending by category" moved into the Monthly statement area —
 *     the statement table now carries the monthly income/expense/net
 *     figures and the category breakdown sits below it.
 *   - Investments and Loans are new SUMMARIES, not the full lists —
 *     those live on /investments and /debts, and the cards link out.
 *
 * Widgets derive from in-memory state plus the chosen date range.
 * Date range is persisted to localStorage under
 * `finora.insights.range`. Default is "last 6 months".
 *
 * Privacy: no network requests. Pure local computation. Matches the
 * Finora local-first brand promise.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../domain/store';
import {
  RANGE_LABELS,
  RANGE_ORDER,
  RANGE_STORAGE_KEY,
  categoryBreakdown,
  computeStats,
  earliestDate,
  investmentSummary,
  loanSummary,
  monthlyCashFlow,
  monthlyStatement,
  netWorthComposition,
  readRange,
  resolveRange,
  txInRange,
  type CompositionSlice,
  type DateRange,
  type DateRangeKey,
  type InvestmentSummaryRow,
  type LoanSummaryRow,
  type StatRow,
} from '../domain/insights';
import { fmtBDT } from '../lib/format';
import {
  computeNetWorth,
  dpsContributedSoFar,
  dpsPaidOutSoFar,
  investmentMaturityValueTyped,
  isInvestmentHeld,
} from '../domain/math';

export function InsightsScreen() {
  const state = useStore(s => s.state);
  const [rangeKey, setRangeKey] = useState<DateRangeKey>(readRange);

  // Persist on every change. Use useEffect to avoid SSR/import-time access.
  useEffect(() => {
    try {
      localStorage.setItem(RANGE_STORAGE_KEY, rangeKey);
    } catch { /* private mode */ }
  }, [rangeKey]);

  const range = useMemo(() => resolveRange(rangeKey), [rangeKey]);

  const stats = useMemo(
    () => computeStats(state, range, rangeKey),
    [state, range, rangeKey]
  );
  const cashFlow = useMemo(
    () => monthlyCashFlow(state, range, rangeKey),
    [state, range, rangeKey]
  );
  const statement = useMemo(
    () => monthlyStatement(state, range),
    [state, range]
  );
  const categories = useMemo(
    () => categoryBreakdown(state, range),
    [state, range]
  );
  const composition = useMemo(
    () => netWorthComposition(state),
    // `state` changes whenever the ledger changes; the composition is a
    // pure function of it plus "today".
    [state]
  );
  const investments = useMemo(
    () => investmentSummary(state),
    [state]
  );
  const loans = useMemo(
    () => loanSummary(state),
    [state]
  );
  const insights = useMemo(
    () => buildInsightFeed(state, range, rangeKey, stats, categories),
    [state, range, rangeKey, stats, categories]
  );

  const subLine = useMemo(
    () => formatRangeSubLine(rangeKey, range, state),
    [rangeKey, range, state]
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-end gap-3">
        <div>
          <h1 className="heading h1-screen">Insight</h1>
          <div className="text-muted text-[13px] mt-1.5 tabular">{subLine}</div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {RANGE_ORDER.map(key => (
            <RangePill
              key={key}
              rangeKey={key}
              active={rangeKey === key}
              onSelect={() => setRangeKey(key)}
            />
          ))}
        </div>
      </div>

      {/* 2026-11-24 redesign (Variant K — cash flow first):
          - Cash flow leads the page, full-width. It's the question
            people open an insights screen with.
          - Row 2 pairs the generated "What stands out" feed with the
            "Where your money sits" donut — the conclusion and the
            context, side by side.
          - Row 3 condenses Investments and Loans to headline figures
            with a link out to their own screens.
          - Row 4 is the Monthly statement — every month's income,
            expense and net as exact figures, no hover needed.
          The Net worth card's old slot is taken by the donut, which
          shows the same numbers the Home hero does. */}

      {/* 1. Cash flow (hero, full-width) */}
      <section aria-label={`Cash flow over ${RANGE_LABELS[rangeKey]}`}>
        <CashFlowCard data={cashFlow} />
      </section>

      {/* 2. Insight feed + net worth composition (2-up) */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
        <InsightFeedCard items={insights} />
        <section
          aria-label={`Net worth over ${RANGE_LABELS[rangeKey]}`}
          className="flex h-full"
        >
          <CompositionCard data={composition} />
        </section>
      </section>

      {/* 3. Investments + Loans (2-up summaries) */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
        <InvestmentsSummaryCard data={investments} />
        <LoansSummaryCard data={loans} />
      </section>

      {/* 4. Monthly statement (full-width) */}
      <section aria-label={`Monthly statement over ${RANGE_LABELS[rangeKey]}`}>
        <MonthlyStatementCard data={statement} />
      </section>
    </div>
  );
}

// ---------- Helpers ----------

/**
 * Sub-line under the page H1. Leads with the chosen range so the page
 * reads as "Analytics · Last 6 months · Apr → Sep 2026" instead of an
 * ambiguous date span.
 */
function formatRangeSubLine(
  key: DateRangeKey,
  range: { start: Date; end: Date },
  state: ReturnType<typeof useStore.getState>['state']
): string {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const rangeLabel = RANGE_LABELS[key];
  if (key === 'thisMonth') {
    return `${rangeLabel} \u00B7 ${months[range.start.getUTCMonth()]} ${range.start.getUTCFullYear()}`;
  }
  if (key === 'all') {
    const e = earliestDate(state);
    if (!e) return rangeLabel;
    const startLabel = `${months[e.getUTCMonth()]} ${e.getUTCFullYear()}`;
    const endLabel = `${months[range.end.getUTCMonth()]} ${range.end.getUTCFullYear()}`;
    return `${rangeLabel} \u00B7 ${startLabel} \u2013 ${endLabel}`;
  }
  const startLabel = `${months[range.start.getUTCMonth()]} ${range.start.getUTCFullYear()}`;
  const endLabel = `${months[range.end.getUTCMonth()]} ${range.end.getUTCFullYear()}`;
  return `${rangeLabel} \u00B7 ${startLabel} \u2013 ${endLabel}`;
}

// ---------- Range pill ----------

function RangePill({
  rangeKey, active, onSelect,
}: { rangeKey: DateRangeKey; active: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        'px-3 py-1.5 rounded-pill text-[12px] font-semibold transition border',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        active
          ? 'bg-primary-soft text-primary border-transparent'
          : 'bg-surface text-muted border-border hover:text-ink hover:bg-surface-2',
      ].join(' ')}
      style={active ? { boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--primary) 35%, transparent)' } : undefined}
      aria-pressed={active}
    >
      {RANGE_LABELS[rangeKey]}
    </button>
  );
}

// ---------- Cash flow chart ----------

function CashFlowCard({ data }: { data: ReturnType<typeof monthlyCashFlow> }) {
  const { bars, cappedAt, totalMonths } = data;
  const [hover, setHover] = useState<number | null>(null);
  const W = 720;
  const H = 220;
  const PAD_L = 36;
  const PAD_R = 16;
  const PAD_T = 16;
  const PAD_B = 24;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  const max = Math.max(1, ...bars.flatMap(b => [b.income, b.expense]));
  const stepX = bars.length > 1 ? innerW / (bars.length - 1) : 0;

  const xy = (i: number, v: number) => {
    const x = bars.length === 1 ? PAD_L + innerW / 2 : PAD_L + i * stepX;
    const y = PAD_T + innerH * (1 - v / max);
    return [x, y] as const;
  };

  const incomeLine = bars.map((b, i) => xy(i, b.income).join(',')).join(' ');
  const expenseLine = bars.map((b, i) => xy(i, b.expense).join(',')).join(' ');

  // Two-phase draw-in: dots appear first (fast) and *then* the line
  // traces over them (slow). The dots set the pace — they fire on
  // a `dotPhase` timeline; the polyline starts once the last dot
  // has landed, then draws across the full chart width over
  // `lineDraw`. The `dataKey` ensures React remounts the polylines /
  // dots when the period filter changes — without it, the animation
  // only fires once because the DOM nodes are reused.
  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const dotPhase = 1200;
  const lineDraw = 5500;
  const dashLen = 2000;
  const dataKey = bars[0] ? `${bars[0].year}-${bars[0].month}` : 'empty';

  const totalIncome = bars.reduce((s, b) => s + b.income, 0);
  const totalExpense = bars.reduce((s, b) => s + b.expense, 0);

  const hoverBar = hover !== null ? bars[hover] : null;
  const hoverX = hover !== null ? xy(hover, 0)[0] : 0;

  return (
    <div className="card">
      <div className="flex justify-between items-end mb-3">
        <div>
          <h2 className="heading h3-modal">Cash flow</h2>
          <div className="text-[11px] text-muted uppercase tracking-wider mt-0.5">Income &amp; expense by month</div>
        </div>
        <div className="flex items-center gap-3 text-[12px] tabular">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-muted">Income</span>
            <span className="text-primary font-semibold">{fmtBDT(totalIncome)}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-danger" />
            <span className="text-muted">Expense</span>
            <span className="text-danger font-semibold">{fmtBDT(totalExpense)}</span>
          </span>
        </div>
      </div>
      {bars.length === 0 ? (
        <EmptyState
          message="No transactions in this period."
          cta={{ to: '/transactions/new', label: 'Add a transaction' }}
        />
      ) : (
        <>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            width="100%"
            height={H}
            role="img"
            aria-label={`Income and expense by month, ${bars.length} months`}
            onMouseLeave={() => setHover(null)}
          >
            <title>Cash flow line chart.</title>
            {/* Y-axis */}
            <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + innerH} stroke="var(--border)" />
            <line x1={PAD_L} y1={PAD_T + innerH} x2={W - PAD_R} y2={PAD_T + innerH} stroke="var(--border)" />
            {/* Y ticks */}
            {[0, 0.25, 0.5, 0.75, 1].map(t => {
              const y = PAD_T + innerH * (1 - t);
              return (
                <line
                  key={t}
                  x1={PAD_L}
                  y1={y}
                  x2={W - PAD_R}
                  y2={y}
                  stroke="var(--border-2)"
                  strokeDasharray="2 4"
                />
              );
            })}
            {/* Income line */}
            <polyline
              key={`income-${dataKey}`}
              points={incomeLine}
              fill="none"
              stroke="var(--primary)"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity={hover === null ? 1 : 0.55}
              strokeDasharray={prefersReduced ? undefined : dashLen}
              strokeDashoffset={prefersReduced ? undefined : dashLen}
              style={prefersReduced ? undefined : ({ animation: `cashflow-draw ${lineDraw}ms cubic-bezier(.22,.61,.36,1) ${dotPhase}ms both`, '--line-len': dashLen } as React.CSSProperties)}
              data-cashflow-line
            />
            {/* Expense line */}
            <polyline
              key={`expense-${dataKey}`}
              points={expenseLine}
              fill="none"
              stroke="var(--danger)"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity={hover === null ? 1 : 0.55}
              strokeDasharray={prefersReduced ? undefined : dashLen}
              strokeDashoffset={prefersReduced ? undefined : dashLen}
              style={prefersReduced ? undefined : ({ animation: `cashflow-draw ${lineDraw}ms cubic-bezier(.22,.61,.36,1) ${dotPhase + 200}ms both`, '--line-len': dashLen } as React.CSSProperties)}
              data-cashflow-line
            />
            {/* Hit areas + dots */}
            {bars.map((b, i) => {
              const [incX, incY] = xy(i, b.income);
              const [expX, expY] = xy(i, b.expense);
              const isHover = hover === i;
              const popMs = 250;
              const lastDotStart = dotPhase - popMs;
              const dotDelay = prefersReduced
                ? 0
                : Math.round((i / Math.max(1, bars.length - 1)) * lastDotStart);
              const dotStyle = prefersReduced
                ? undefined
                : { animation: `cashflow-dot-pop ${popMs}ms cubic-bezier(.22,.61,.36,1) ${dotDelay}ms both` };
              const expDotStyle = prefersReduced
                ? undefined
                : { animation: `cashflow-dot-pop ${popMs}ms cubic-bezier(.22,.61,.36,1) ${dotDelay + 200}ms both` };
              return (
                <g key={`${b.year}-${b.month}`}>
                  {/* Wide invisible hit strip for hover */}
                  <rect
                    x={PAD_L + i * stepX - stepX / 2}
                    y={PAD_T}
                    width={stepX || innerW}
                    height={innerH}
                    fill="transparent"
                    onMouseEnter={() => setHover(i)}
                    onMouseMove={() => setHover(i)}
                  />
                  <circle
                    cx={incX} cy={incY} r={isHover ? 5 : 3}
                    fill="var(--primary)"
                    stroke="var(--primary-on)"
                    strokeWidth={isHover ? 2 : 0}
                    style={dotStyle}
                    data-cashflow-line
                  />
                  <circle
                    cx={expX} cy={expY} r={isHover ? 5 : 3}
                    fill="var(--danger)"
                    stroke="var(--primary-on)"
                    strokeWidth={isHover ? 2 : 0}
                    style={expDotStyle}
                    data-cashflow-line
                  />
                  {/* X labels — every other for dense ranges */}
                  {(bars.length <= 6 || i % 2 === 0) && (
                    <text
                      x={incX}
                      y={H - 6}
                      textAnchor="middle"
                      fontSize="10"
                      fill="var(--muted)"
                    >
                      {b.label.split(' ')[0]}
                    </text>
                  )}
                </g>
              );
            })}
            {/* Hover guide */}
            {hover !== null && (
              <line
                x1={hoverX}
                y1={PAD_T}
                x2={hoverX}
                y2={PAD_T + innerH}
                stroke="var(--muted)"
                strokeWidth="1"
              />
            )}
          </svg>
          {/* Tooltip */}
          {hoverBar && (
            <div
              className="text-[11px] pointer-events-none"
              role="tooltip"
              style={{
                position: 'relative',
                marginTop: '-32px',
                marginLeft: `${Math.max(0, Math.min(W - 180, hoverX - 60))}px`,
                display: 'inline-block',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-input)',
                padding: '6px 10px',
                boxShadow: 'var(--shadow-card)',
                fontFamily: 'var(--font-numeric)',
              }}
            >
              <div className="text-muted">{hoverBar.label}</div>
              <div className="text-primary tabular">{fmtBDT(hoverBar.income)}</div>
              <div className="text-danger tabular">{fmtBDT(hoverBar.expense)}</div>
            </div>
          )}
          <div className="flex justify-between items-center text-[11px] text-muted mt-2 tabular">
            <span>Net cash flow <span className={totalIncome - totalExpense >= 0 ? 'text-primary font-semibold' : 'text-danger font-semibold'}>
              {totalIncome - totalExpense >= 0 ? '+' : '\u2212'}{fmtBDT(Math.abs(totalIncome - totalExpense))}
            </span></span>
            {totalMonths > cappedAt && (
              <span>Showing last {cappedAt} of {totalMonths} months</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ---------- Insight feed ----------

type InsightTone = 'up' | 'down' | 'warn' | 'info';

interface InsightItem {
  id: string;
  title: string;
  detail: string;
  /** The right-hand figure — a percentage, a taka amount, a day count. */
  value: string;
  tone: InsightTone;
}

/**
 * Generate the "What stands out" feed.
 *
 * Every item is derived from the same in-memory figures the cards
 * below it use, so the prose can never contradict the numbers. The
 * feed is intentionally a SMALL set — the five strongest signals in
 * the range — because a feed that lists everything tells the user
 * nothing.
 *
 * Items are skipped when their underlying data is absent, so an empty
 * ledger renders an empty state rather than a feed of zeros.
 */
function buildInsightFeed(
  state: ReturnType<typeof useStore.getState>['state'],
  range: DateRange,
  rangeKey: DateRangeKey,
  stats: StatRow,
  categories: ReturnType<typeof categoryBreakdown>
): InsightItem[] {
  const items: InsightItem[] = [];

  // 1. The biggest category — "Rent is half your spending".
  const top = categories[0];
  const totalSpend = categories.reduce((s, c) => s + c.amount, 0);
  if (top && totalSpend > 0 && top.pct >= 30) {
    items.push({
      id: 'top-category',
      title: `${top.name} is your biggest expense`,
      detail: `${fmtBDT(top.amount)} of ${fmtBDT(totalSpend)} \u2014 ${Math.round(top.pct)}% of every taka out`,
      value: `${Math.round(top.pct)}%`,
      tone: 'warn',
    });
  }

  // 2. Savings rate — how much of the income you kept.
  //
  // The income is scoped to the range too, so the rate reads against
  // the same window `stats.netFlow` covers.
  const income = state.transactions
    .filter(t => t.type === 'income' && txInRange(t, range))
    .reduce((s, t) => s + (Number(t.amount) || 0), 0);
  if (income > 0 && stats.netFlow !== 0) {
    const rate = Math.round((stats.netFlow / income) * 100);
    items.push({
      id: 'savings-rate',
      title: rate >= 0 ? 'You kept a healthy share of income' : 'You spent more than you earned',
      detail: rate >= 0
        ? `${rate}% of your income stayed with you over the period`
        : `${Math.abs(rate)}% of your income went out beyond what came in`,
      value: `${rate >= 0 ? '+' : '\u2212'}${Math.abs(rate)}%`,
      tone: rate >= 0 ? 'up' : 'down',
    });
  }

  // 3. The strongest month.
  const monthly = monthlyCashFlow(state, range, rangeKey).bars;
  const best = monthly.reduce<(typeof monthly)[number] | null>(
    (acc, b) => (!acc || b.income - b.expense > acc.income - acc.expense ? b : acc),
    null,
  );
  if (best && best.income - best.expense > 0) {
    items.push({
      id: 'best-month',
      title: `${best.label.split(' ')[0]} was your strongest month`,
      detail: `Net cash flow of ${fmtBDT(best.income - best.expense)}`,
      value: `+${fmtBDT(best.income - best.expense)}`,
      tone: 'up',
    });
  }

  // 4. Runway — how long the cash lasts at the current burn.
  //
  // The burn rate is scoped to the SELECTED RANGE: the expenses in
  // the window, divided by the window's day count. Using all-time
  // expenses against a short window's day count would understate the
  // daily burn and inflate the runway.
  const nw = computeNetWorth(state);
  const rangeExpense = state.transactions
    .filter(t => t.type === 'expense' && txInRange(t, range))
    .reduce((s, t) => s + (Number(t.amount) || 0), 0);
  if (rangeExpense > 0 && nw.cash > 0) {
    const days = Math.max(
      1,
      Math.round(
        (new Date(range.end.toISOString().slice(0, 10) + 'T00:00:00Z').getTime()
          - new Date(range.start.toISOString().slice(0, 10) + 'T00:00:00Z').getTime()) / 86400000
      ) + 1
    );
    const runway = Math.round(nw.cash / (rangeExpense / days));
    items.push({
      id: 'runway',
      title: runway >= 90 ? 'Your runway is comfortable' : 'Your runway is worth watching',
      detail: `${runway} days of cash at your current burn rate`,
      value: `${runway} d`,
      tone: runway >= 90 ? 'info' : 'warn',
    });
  }

  // 5. Investment growth — how far the schemes are ahead.
  const contributed = state.investments.reduce((s, inv) => {
    if (!isInvestmentHeld(inv)) return s;
    return s + (inv.type === 'dps'
      ? dpsContributedSoFar(inv, state.transactions)
      : (Number(inv.principal) || 0));
  }, 0);
  const matured = state.investments.reduce((s, inv) => {
    if (!isInvestmentHeld(inv)) return s;
    const projected = investmentMaturityValueTyped(inv);
    const paidOut = inv.type === 'dps'
      ? dpsPaidOutSoFar(inv, state.transactions)
      : 0;
    return s + Math.max(0, projected - paidOut);
  }, 0);
  if (contributed > 0) {
    const growth = matured - contributed;
    items.push({
      id: 'investment-growth',
      title: growth >= 0 ? 'Your investments are growing' : 'Your investments are behind',
      detail: growth >= 0
        ? `Active schemes are ${fmtBDT(growth)} ahead of what you put in`
        : `Active schemes are ${fmtBDT(Math.abs(growth))} behind what you put in`,
      value: `${growth >= 0 ? '+' : '\u2212'}${fmtBDT(Math.abs(growth))}`,
      tone: growth >= 0 ? 'up' : 'down',
    });
  }

  return items.slice(0, 5);
}

/**
 * InsightFeedCard — the "What stands out" feed.
 *
 * 2026-11-24 (Variant K): a generated, plain-language summary of the
 * range. It sits directly under the Cash flow chart so the chart
 * shows WHAT happened and the feed says WHAT IT MEANS.
 */
function InsightFeedCard({ items }: { items: InsightItem[] }) {
  const ICON: Record<InsightTone, string> = {
    up: '\u2191',
    down: '\u2193',
    warn: '!',
    info: 'i',
  };
  const TONE_BG: Record<InsightTone, string> = {
    up: 'var(--primary-hi)',
    down: 'var(--danger-soft)',
    warn: 'var(--warn-soft)',
    info: 'var(--info-soft)',
  };
  const TONE_TEXT: Record<InsightTone, string> = {
    up: 'text-primary',
    down: 'text-danger',
    warn: 'text-warn',
    info: 'text-info',
  };

  return (
    <div className="card flex flex-col w-full">
      <div className="flex justify-between items-end mb-3">
        <div>
          <h2 className="heading h3-modal">What stands out</h2>
          <div className="text-[11px] text-muted uppercase tracking-wider mt-0.5">
            Generated from the chosen range
          </div>
        </div>
      </div>
      {items.length === 0 ? (
        <EmptyState
          message="Nothing to report for this period."
          cta={{ to: '/transactions/new', label: 'Add a transaction' }}
        />
      ) : (
        <div className="flex flex-col gap-2.5 flex-1 justify-between">
          {items.map(item => (
            <div
              key={item.id}
              className="grid grid-cols-[26px_minmax(0,1fr)_auto] gap-3 items-start bg-surface-2 border border-border rounded-[10px] px-3 py-3"
              data-insight-item={item.id}
            >
              <span
                aria-hidden
                className={`w-[26px] h-[26px] rounded-lg flex items-center justify-center text-[13px] font-extrabold shrink-0 ${TONE_TEXT[item.tone]}`}
                style={{ background: TONE_BG[item.tone] }}
              >
                {ICON[item.tone]}
              </span>
              <div className="min-w-0">
                <div className="text-[13px] font-semibold">{item.title}</div>
                <div className="text-[11.5px] text-muted mt-0.5">{item.detail}</div>
              </div>
              <div className={`text-[14px] font-extrabold tabular whitespace-nowrap text-right ${TONE_TEXT[item.tone]}`}>
                {item.value}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Net worth composition (donut) ----------

/**
 * Colours for the donut slices, in the order the slices appear.
 *
 * The conic-gradient and the legend swatches read from this ONE map,
 * so a slice can never be a different colour in the ring and in the
 * legend.
 *
 * The palette is deliberately distinct per slice — two slices sharing a
 * hue read as one when they're adjacent on the ring.
 */
const COMPOSITION_COLORS: Record<CompositionSlice['key'], string> = {
  cash: 'var(--primary)',
  savings: 'var(--warn)',
  dps: 'var(--info)',
  receivables: 'var(--accent)',
  debt: 'var(--danger)',
  other: 'var(--surface-3)',
};

/**
 * CompositionCard — the "Where your money sits" donut.
 *
 * 2026-11-24 (Variant K): replaces the Net worth chart in row 2. It
 * answers "what have I got?" rather than "how did it move?", and it
 * uses the SAME `computeNetWorth` figures the Home hero shows, so the
 * two screens can never disagree.
 *
 * The donut is drawn as a `conic-gradient` with a radial mask — no SVG
 * arc maths, and it scales with the container.
 *
 * The ring shows ASSETS only. Debt is what you owe, not what you
 * have, so painting it as a slice of the ring would make the biggest
 * wedge mean the opposite of what it means. It sits under the legend
 * as an offset instead.
 */
function CompositionCard({
  data,
}: {
  data: ReturnType<typeof netWorthComposition>;
}) {
  const { slices, netWorth, total, debt } = data;
  // Build the conic-gradient stop list from the slices.
  let cursor = 0;
  const stops = slices.map(s => {
    const from = cursor;
    cursor += s.pct;
    return `${COMPOSITION_COLORS[s.key]} ${from.toFixed(3)}% ${cursor.toFixed(3)}%`;
  });
  if (stops.length === 0) {
    stops.push('var(--surface-3) 0% 100%');
  }
  const gradient = `conic-gradient(${stops.join(', ')})`;

  const netLabel =
    Math.abs(netWorth) >= 1_00_000
      ? `\u09F3 ${(netWorth / 1_00_000).toFixed(2)}L`
      : fmtBDT(netWorth);

  return (
    <div className="card flex flex-col w-full">
      <div className="flex justify-between items-end mb-3">
        <div>
          <h2 className="heading h3-modal">Where your money sits</h2>
          <div className="text-[11px] text-muted uppercase tracking-wider mt-0.5">
            Composition of net worth
          </div>
        </div>
        <div className="text-[12px] text-muted tabular shrink-0">
          Assets <span className="text-ink font-semibold">{fmtBDT(total)}</span>
        </div>
      </div>

      {slices.length === 0 ? (
        <EmptyState
          message="No balance to show yet."
          cta={{ to: '/accounts/add', label: 'Add an account' }}
        />
      ) : (
        <>
          <div className="flex items-center gap-6 flex-1 min-h-0">
            {/* The ring is the conic gradient ITSELF, masked to leave a
                hole in the middle — the same trick the demo uses. Masking
                an inner overlay instead would paint the gradient across
                the whole circle and read as a pie, not a donut. */}
            <div className="relative w-[150px] h-[150px] shrink-0" data-composition-ring>
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: gradient,
                  mask: 'radial-gradient(farthest-side, transparent calc(100% - 26px), #000 calc(100% - 25px))',
                  WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 26px), #000 calc(100% - 25px))',
                }}
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <div className="text-[18px] font-extrabold tracking-tight tabular leading-none">
                  {netLabel}
                </div>
                <div className="text-[10.5px] text-muted mt-1">net worth</div>
              </div>
            </div>

            <div className="flex flex-col justify-center gap-2.5 flex-1 min-w-0">
              {slices.map(s => (
                <div
                  key={s.key}
                  className="grid grid-cols-[10px_minmax(0,1fr)_auto_auto] gap-2 items-center text-[12.5px]"
                  data-composition-slice={s.key}
                >
                  <span
                    className="w-[10px] h-[10px] rounded-[3px]"
                    style={{ background: COMPOSITION_COLORS[s.key] }}
                  />
                  <span className="truncate">{s.label}</span>
                  <span className="text-[12.5px] font-bold tabular">{fmtBDT(s.amount)}</span>
                  <span className="text-[11.5px] text-muted tabular w-[34px] text-right">
                    {Math.round(s.pct)}%
                  </span>
                </div>
              ))}

              {/* Debt is what you owe, so it is NOT a wedge of the ring.
                  It sits under the legend as an offset against what the
                  ring adds up to. */}
              {debt > 0 && (
                <div
                  className="grid grid-cols-[10px_minmax(0,1fr)_auto_auto] gap-2 items-center text-[12.5px] mt-1 pt-2 border-t border-border"
                  data-composition-slice="debt"
                >
                  <span
                    className="w-[10px] h-[10px] rounded-[3px]"
                    style={{ background: COMPOSITION_COLORS.debt }}
                  />
                  <span className="truncate">Less: debt</span>
                  <span className="text-[12.5px] font-bold tabular text-danger">
                    {'\u2212'}{fmtBDT(debt)}
                  </span>
                  <span className="text-[11.5px] text-muted tabular w-[34px] text-right" />
                </div>
              )}
            </div>
          </div>

          <div className="mt-auto pt-4 border-t border-border text-[12px] text-muted">
            {slices.find(s => s.key === 'cash')?.pct !== undefined ? (
              <>
                Cash covers{' '}
                <span className="text-ink font-semibold">
                  {Math.round(slices.find(s => s.key === 'cash')!.pct)}%
                </span>{' '}
                of what you own. Debt and receivables net off to{' '}
                <span className="text-ink font-semibold tabular">
                  {fmtBDT(Math.abs(
                    debt - (slices.find(s => s.key === 'receivables')?.amount ?? 0),
                  ))}
                </span>{' '}
                against your assets.
              </>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

// ---------- Investments summary ----------

/**
 * InvestmentsSummaryCard — the headline figures for the schemes you
 * hold, plus a one-line row per scheme.
 *
 * 2026-11-24 (Variant K): this is a SUMMARY, not the Investments
 * screen. It carries the totals and links out; the per-scheme detail
 * (term bars, maturity countdowns, payouts) lives on /investments.
 */
function InvestmentsSummaryCard({
  data,
}: {
  data: ReturnType<typeof investmentSummary>;
}) {
  return (
    <div className="card flex flex-col w-full">
      <div className="flex justify-between items-end mb-3">
        <div>
          <h2 className="heading h3-modal">Investments</h2>
          <div className="text-[11px] text-muted uppercase tracking-wider mt-0.5">
            {data.rows.length} active scheme{data.rows.length === 1 ? '' : 's'}
          </div>
        </div>
        <Link
          to="/investments"
          className="text-[12px] text-primary font-bold hover:underline underline-offset-2 shrink-0"
        >
          See all {'→'}
        </Link>
      </div>

      {data.rows.length === 0 ? (
        <EmptyState
          message="No active investments yet."
          cta={{ to: '/investments/add', label: 'Add an investment' }}
        />
      ) : (
        <>
          <div className="flex items-baseline gap-2.5 mb-2">
            <span className="text-[24px] font-extrabold tracking-tight tabular leading-none">
              {fmtBDT(data.totalContributed)}
            </span>
            <span className="text-[12px] text-muted">invested</span>
          </div>
          <div className="flex items-baseline gap-2.5 mb-1">
            <span className="text-[15px] font-extrabold tabular text-primary">
              {data.totalEarnings >= 0 ? '+' : '\u2212'}{fmtBDT(Math.abs(data.totalEarnings))}
            </span>
            <span className="text-[12px] text-muted">total earnings at maturity</span>
          </div>
          <div className="text-[12px] text-muted mb-4">
            Worth{' '}
            <span className="text-ink font-semibold tabular">{fmtBDT(data.totalMaturity)}</span>{' '}
            when every scheme matures · average rate{' '}
            <span className="text-ink font-semibold tabular">
              {data.averageRate.toFixed(1)}%
            </span>
          </div>

          <div className="flex flex-col gap-2.5 flex-1">
            {data.rows.map(row => (
              <InvestmentSummaryRowView key={row.id} row={row} />
            ))}
          </div>

          <div className="mt-3 pt-3 border-t border-border text-[11.5px] text-muted">
            Earnings are what each scheme is projected to pay at maturity, not profit
            already banked.
          </div>
        </>
      )}
    </div>
  );
}

function InvestmentSummaryRowView({ row }: { row: InvestmentSummaryRow }) {
  return (
    <div
      className="grid grid-cols-[minmax(0,1fr)_96px_84px] gap-2.5 items-center text-[12.5px]"
      data-investment-row={row.id}
    >
      <span className="truncate">{row.name}</span>
      <span className="text-muted tabular text-[11.5px] whitespace-nowrap">
        {row.rate}% · {row.termMonths}mo
      </span>
      <span
        className={`tabular font-bold whitespace-nowrap text-right ${
          row.earnings >= 0 ? 'text-primary' : 'text-danger'
        }`}
      >
        {row.earnings >= 0 ? '+' : '\u2212'}{fmtBDT(Math.abs(row.earnings))}
      </span>
    </div>
  );
}

// ---------- Loans summary ----------

/**
 * LoansSummaryCard — the headline figures for the debts you owe,
 * plus the interest/principal split of each loan.
 *
 * 2026-11-24 (Variant K): a SUMMARY, not the Debts screen. The bar
 * under each loan shows what proportion of the money paid so far was
 * principal (which reduces the balance) versus interest (the bank's
 * cut). The full amortisation table lives on /debts.
 */
function LoansSummaryCard({ data }: { data: ReturnType<typeof loanSummary> }) {
  return (
    <div className="card flex flex-col w-full">
      <div className="flex justify-between items-end mb-3">
        <div>
          <h2 className="heading h3-modal">Loans</h2>
          <div className="text-[11px] text-muted uppercase tracking-wider mt-0.5">
            {data.rows.length} active loan{data.rows.length === 1 ? '' : 's'}
          </div>
        </div>
        <Link
          to="/debts"
          className="text-[12px] text-primary font-bold hover:underline underline-offset-2 shrink-0"
        >
          See all {'→'}
        </Link>
      </div>

      {data.rows.length === 0 ? (
        <EmptyState
          message="No active debts."
          cta={{ to: '/debts/add', label: 'Add a debt' }}
        />
      ) : (
        <>
          <div className="flex items-baseline gap-2.5 mb-2">
            <span className="text-[24px] font-extrabold tracking-tight tabular leading-none">
              {fmtBDT(data.totalOutstanding)}
            </span>
            <span className="text-[12px] text-muted">still owed</span>
          </div>
          <div className="flex items-baseline gap-2.5 mb-1">
            <span className="text-[15px] font-extrabold tabular text-danger">
              {fmtBDT(data.totalInterestLeft)}
            </span>
            <span className="text-[12px] text-muted">interest left to pay</span>
          </div>
          <div className="text-[12px] text-muted mb-4">
            <span className="tabular text-ink font-semibold">
              {fmtBDT(data.totalMonthlyInterest)}
            </span>{' '}
            a month goes to interest across your loans
          </div>

          <div className="flex flex-col gap-3 flex-1">
            {data.rows.map(row => (
              <LoanSummaryRowView key={row.id} row={row} />
            ))}
          </div>

          <div className="mt-3 pt-3 border-t border-border text-[11.5px] text-muted">
            Only the principal portion of a payment reduces what you owe — interest is the
            bank's cut.
          </div>
        </>
      )}
    </div>
  );
}

function LoanSummaryRowView({ row }: { row: LoanSummaryRow }) {
  // The bar shows the split of the money paid SO FAR: principal on the
  // left (green), interest on the right (red). A loan with no payments
  // yet shows an empty track rather than a misleading 50/50.
  const paid = row.principalPaid + row.interestPaid;
  const principalPct = paid > 0 ? (row.principalPaid / paid) * 100 : 0;
  const interestPct = paid > 0 ? (row.interestPaid / paid) * 100 : 0;

  return (
    <div data-loan-row={row.id}>
      <div className="flex justify-between items-baseline gap-3 mb-1.5">
        <span className="text-[12.5px] font-bold truncate">{row.name}</span>
        <span className="text-[12px] text-muted tabular whitespace-nowrap">
          {row.monthly > 0 ? `${fmtBDT(row.monthly)}/mo` : 'no fixed payment'}
        </span>
      </div>
      <div className="h-2 rounded-full overflow-hidden flex bg-surface-3">
        <span
          className="h-full"
          style={{ width: `${principalPct}%`, background: 'var(--primary)' }}
        />
        <span
          className="h-full"
          style={{ width: `${interestPct}%`, background: 'var(--danger)' }}
        />
      </div>
      <div className="flex justify-between items-baseline gap-3 mt-1.5 text-[11px] text-muted tabular">
        <span>
          <span className="text-primary font-semibold">{fmtBDT(row.principalPaid)}</span>{' '}
          principal
        </span>
        <span className="whitespace-nowrap">
          <span className="text-danger font-semibold">{fmtBDT(row.interestPaid)}</span>{' '}
          interest
        </span>
      </div>
    </div>
  );
}

// ---------- Monthly statement ----------

/**
 * FLOW SLOTS — how many blocks each side of the axis carries.
 *
 * The Flow column is a METER, not a solid bar: the length is counted
 * in blocks rather than judged by eye. Forty slots a side means the
 * largest month in the column fills its half exactly, and every other
 * month is a fraction of that — a ratio you can count.
 */
const FLOW_SLOTS = 40;

/**
 * FlowBar — one month's net, drawn as a segmented meter.
 *
 * 2026-11-26 (Variant E, "diverging net" → segmented meter):
 *
 * The Flow column is a METER built around a ZERO AXIS down the middle
 * of the column:
 *
 *   - a month that SAVED money fills GREEN blocks from the axis to
 *     the RIGHT;
 *   - a month that OVERSPENT fills RED blocks from the axis to the
 *     LEFT.
 *
 * The blocks are DISCRETE, so the length is COUNTABLE: you can see
 * that August is nine blocks and June is forty. A solid bar only ever
 * lets you judge "longer than"; a segmented one lets you say "three
 * times as many".
 *
 * The unfilled slots render as faint ghosts, so every row is the same
 * length. That means:
 *
 *   - an empty month shows a bare row of ghosts, which reads as
 *     "nothing moved here" rather than as missing data;
 *   - the scale is identical on every row, so two months can be
 *     compared by counting blocks ACROSS rows.
 *
 * The block length is the month's NET, so the scale is the largest
 * monthly net in the column, not the largest income. That is the
 * trade this variant makes: it shows savings and overspend clearly,
 * and it does NOT show gross income or gross expense — for that, the
 * Income and Expense columns beside it carry the figures.
 *
 * The last block is PARTIAL — it carries the remainder of the month
 * rather than rounding up to a whole slot — so the length is exact
 * and not quantised to the grid.
 */
function FlowBar({
  income, expense, maxNet,
}: {
  income: number;
  expense: number;
  maxNet: number;
}) {
  const net = income - expense;

  // The scale is the largest monthly net in the column. Each side gets
  // HALF the column, so a saved month and an overspent month of the
  // same size fill the same number of blocks.
  const scale = maxNet > 0 ? maxNet : 1;
  const filled = (Math.abs(net) / scale) * FLOW_SLOTS;
  const whole = Math.floor(filled);
  const part = filled - whole;
  const saved = net > 0;
  const empty = income === 0 && expense === 0;

  const title = empty
    ? 'No transactions this month'
    : `In ${fmtBDT(income)} · Out ${fmtBDT(expense)} · ${
        saved ? 'Saved' : 'Overspent'
      } ${fmtBDT(Math.abs(net))}`;

  // One side's worth of slots. `fromAxis` is the side that starts AT
  // the axis: for the right half that is its left edge, for the left
  // half that is its right edge. The filled blocks are placed against
  // that edge and the ghosts fill the rest, so the blocks always grow
  // OUTWARD from zero.
  //
  // `isSaving` says which side this is: the SAVING side (right of the
  // axis) carries the blocks only when the month saved; the OVERSPEND
  // side (left of the axis) carries them only when it overspent. The
  // other side is all ghosts.
  //
  // BOTH halves always render their full run of slots, even when the
  // month has no activity: the ghost slots are what make every row
  // the same width, so an empty month reads as "nothing moved" and
  // two rows can be compared by counting blocks across them.
  const side = (fromAxis: boolean, isSaving: boolean) => {
    const carries = saved === isSaving;
    const filledSlots = carries
      ? Array.from({ length: whole }, (_, i) => (
          <i key={`f${i}`} className={saved ? 'on' : 'on red'} />
        ))
      : [];
    if (carries && part > 0.02) {
      filledSlots.push(
        <i
          key="part"
          className={`part${saved ? '' : ' red'}`}
          style={{ ['--w' as string]: `${Math.round(part * 100)}%` }}
        />,
      );
    }
    const ghosts = Array.from({ length: FLOW_SLOTS - filledSlots.length }, (_, i) => (
      <i key={`g${i}`} />
    ));
    return fromAxis
      ? filledSlots.concat(ghosts)
      : ghosts.concat(filledSlots);
  };

  return (
    <div
      className="flow-meter"
      data-flow-bar
      data-flow-empty={empty || undefined}
      data-flow-direction={saved ? 'savings' : 'overspend'}
      title={title}
    >
      {/* The overspend side — blocks grow LEFTWARD from the axis. */}
      <span className="flow-half flow-half-l" data-flow-side="overspend">
        {side(false, false)}
      </span>

      {/* The saving side — blocks grow RIGHTWARD from the axis. */}
      <span className="flow-half flow-half-r" data-flow-side="savings">
        {side(true, true)}
      </span>

      {/* The zero axis, down the middle of the column. */}
      <span className="flow-axis" data-flow-axis />
    </div>
  );
}

/**
 * MonthlyStatementCard — the exact figures, month by month.
 *
 * 2026-11-24 (Variant K): the bottom of the page is a statement
 * table — every month's income, expense and net as figures, no hover
 * required.
 */
function MonthlyStatementCard({
  data,
}: {
  data: ReturnType<typeof monthlyStatement>;
}) {
  const { bars } = data;
  const totalIncome = bars.reduce((s, b) => s + b.income, 0);
  const totalExpense = bars.reduce((s, b) => s + b.expense, 0);
  // The saved figure is the NET of the whole column — the sum of the
  // months that kept money, minus the months that spent more than they
  // earned. It matches the Net column's total by construction.
  const totalSaved = totalIncome - totalExpense;
  // The Flow column shows each month's NET, so the scale is the
  // largest monthly net in the column — not the largest income.
  const maxNet = Math.max(1, ...bars.map(b => Math.abs(b.income - b.expense)));

  return (
    <div className="card">
      <div className="flex justify-between items-end mb-3">
        <div>
          <h2 className="heading h3-modal">Monthly statement</h2>
          <div className="text-[11px] text-muted uppercase tracking-wider mt-0.5">
            Income, expense and net by month
          </div>
        </div>
        <div className="flex items-center gap-3 text-[12px] tabular shrink-0">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-muted">Income</span>
            <span className="text-primary font-semibold">{fmtBDT(totalIncome)}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-danger" />
            <span className="text-muted">Expense</span>
            <span className="text-danger font-semibold">{fmtBDT(totalExpense)}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-success" />
            <span className="text-muted">Saved</span>
            <span className={totalSaved >= 0 ? 'text-success font-semibold' : 'text-danger font-semibold'}>
              {totalSaved >= 0 ? '' : '−'}
              {fmtBDT(Math.abs(totalSaved))}
            </span>
          </span>
        </div>
      </div>

      {bars.length === 0 ? (
        <EmptyState
          message="No transactions in this period."
          cta={{ to: '/transactions/new', label: 'Add a transaction' }}
        />
      ) : (
        <>
          {/* Column headers */}
          <div className="text-[10.5px] uppercase tracking-[0.08em] font-bold text-muted grid grid-cols-[72px_minmax(0,1fr)_96px_96px_96px] gap-3 pb-2 border-b border-border">
            <div>Month</div>
            <div className="flex items-center gap-2">
              <span>Net flow</span>
              {/* What the blocks mean — the axis is zero, green grows
                  right (saved), red grows left (overspent). */}
              <span className="flex items-center gap-1.5 normal-case tracking-normal font-normal">
                <span className="w-2.5 h-2.5 rounded-[2px] bg-danger" />
                <span className="text-muted-2">overspent</span>
                <span className="w-2.5 h-2.5 rounded-[2px] bg-success" />
                <span className="text-muted-2">saved</span>
              </span>
            </div>
            <div className="text-right">Income</div>
            <div className="text-right">Expense</div>
            <div className="text-right">Net</div>
          </div>

          {/* Rows */}
          <div className="text-[13px] tabular">
            {bars.map(b => {
              const net = b.income - b.expense;
              const hasActivity = b.income > 0 || b.expense > 0;
              return (
                <div
                  key={`${b.year}-${b.month}`}
                  className="grid grid-cols-[72px_minmax(0,1fr)_96px_96px_96px] gap-3 items-center py-1.5 border-b border-border/60 last:border-b-0 group"
                  data-statement-row={b.label}
                >
                  <div className={`text-[12.5px] ${hasActivity ? 'font-semibold text-ink' : 'text-muted'}`}>
                    {b.label}
                  </div>
                  <FlowBar income={b.income} expense={b.expense} maxNet={maxNet} />
                  <div className={`text-right ${b.income > 0 ? 'text-primary' : 'text-muted'}`}>
                    {fmtBDT(b.income)}
                  </div>
                  <div className={`text-right ${b.expense > 0 ? 'text-danger' : 'text-muted'}`}>
                    {fmtBDT(b.expense)}
                  </div>
                  <div
                    className={`text-right font-semibold ${
                      net > 0 ? 'text-primary' : net < 0 ? 'text-danger' : 'text-muted'
                    }`}
                  >
                    {net !== 0 && (net > 0 ? '+' : '\u2212')}
                    {fmtBDT(Math.abs(net))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Total row */}
          <div className="grid grid-cols-[72px_minmax(0,1fr)_96px_96px_96px] gap-3 items-center pt-3 border-t border-divider text-[12px] font-extrabold uppercase tracking-[0.08em] text-muted">
            <div>Total</div>
            <div />
            <div className="text-right tabular text-primary">{fmtBDT(totalIncome)}</div>
            <div className="text-right tabular text-danger">{fmtBDT(totalExpense)}</div>
            <div
              className={`text-right tabular ${
                totalIncome - totalExpense > 0
                  ? 'text-primary'
                  : totalIncome - totalExpense < 0
                    ? 'text-danger'
                    : 'text-muted'
              }`}
            >
              {totalIncome - totalExpense >= 0 ? '+' : '\u2212'}
              {fmtBDT(Math.abs(totalIncome - totalExpense))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ---------- Empty state ----------

function EmptyState({ message, cta }: { message: string; cta?: { to: string; label: string } }) {
  return (
    <div className="py-8 text-center">
      <div className="text-[14px] text-muted">{message}</div>
      {cta && (
        <Link
          to={cta.to}
          className="inline-block mt-3 text-[13px] font-semibold text-primary hover:underline"
        >
          {cta.label}
        </Link>
      )}
    </div>
  );
}
