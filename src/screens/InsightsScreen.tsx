/**
 * InsightsScreen — analytics dashboard at /insights.
 *
 * Spine: docs/ux-designs/ux-finora-2026-08-14-analytics/EXPERIENCE.md
 *
 * 2026-09-03 redesign (Variant A — 4-up breathing): the page now reads
 * as an analytics dashboard. Goals / Debts / Investments card lists are
 * gone — those live on /goals, /debts, /investments already. The header
 * is "Insight" with a range-led sub-line. Layout: full-width Cash flow
 * (hero), 2-up Spending + Net worth (compact), then full-width Trends.
 *
 * Widgets derive from in-memory state plus the chosen date range.
 * Date range is persisted to localStorage under
 * `finora.insights.range`. Default is "last 6 months".
 *
 * Privacy: no network requests. Pure local computation. Matches the
 * Finora local-first brand promise.
 */
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../domain/store';
import {
  RANGE_LABELS,
  RANGE_ORDER,
  RANGE_STORAGE_KEY,
  categoryBreakdown,
  computeStats,
  earliestDate,
  monthlyCashFlow,
  netWorthSeries,
  readRange,
  resolveRange,
  type DateRangeKey,
  type StatRow,
} from '../domain/insights';
import { fmtBDT } from '../lib/format';
import {
  computeNetWorth,
  dpsContributedSoFar,
  dpsPaidOutSoFar,
  investmentMaturityValueTyped,
} from '../domain/math';
import { ProgressBar } from '../components/ProgressBar';

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
  const categories = useMemo(
    () => categoryBreakdown(state, range),
    [state, range]
  );
  const netWorth = useMemo(
    () => netWorthSeries(state, range, rangeKey),
    [state, range, rangeKey]
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

      {/* 2026-09-03 redesign (Variant A) — hero + 2-up:
          - Cash flow goes full-width at the top — it's the most active
            "what's happening" chart and earns the hero slot.
          - Spending by category + Net worth share an equal-width
            2-up strip below; Net worth is the compact variant (no KPI
            strip beneath) so it doesn't compete with Cash flow.
          - Trends sits full-width at the bottom — aggregates that
            answer "how am I doing?" without forcing a click.
          Goals / Debts / Investments cards were removed: those lists
          live on /goals, /debts, /investments already. */}

      {/* 1. Cash flow (hero, full-width) */}
      <section aria-label={`Cash flow over ${RANGE_LABELS[rangeKey]}`}>
        <CashFlowCard data={cashFlow} />
      </section>

      {/* 2. Spending + Net worth (2-up, compact) */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SpendingCard rows={categories} />
        <section aria-label={`Net worth over ${RANGE_LABELS[rangeKey]}`}>
          <NetWorthCard data={netWorth} compact />
        </section>
      </section>

      {/* 3. Trends (full-width) */}
      <section aria-label={`Trends over ${RANGE_LABELS[rangeKey]}`}>
        <TrendsCard stats={stats} rangeKey={rangeKey} state={state} />
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

/**
 * Build a "vs previous period" caption. Returns null when the previous
 * period has no data (caller suppresses the caption) or when the
 * comparison isn't meaningful for the current range key.
 *
 * Drops the `+` / `−` sign prefix in favour of an explicit arrow so the
 * colour carries the direction (primary for up, danger for down). The
 * arrow is also more legible at small sizes than a one-character sign.
 */
function periodComparison(
  current: number,
  previous: number,
  rangeKey: DateRangeKey
): ReactNode {
  if (rangeKey === 'thisMonth' || rangeKey === 'all') return null;
  if (previous === 0) return null;
  const diff = ((current - previous) / Math.abs(previous)) * 100;
  const arrow = diff >= 0 ? '\u2191' : '\u2193';
  const abs = Math.abs(Math.round(diff));
  const period = rangeKey === 'last3'
    ? '3 months'
    : rangeKey === 'last6' ? '6 months' : '12 months';
  const arrowClass = diff >= 0 ? 'text-primary' : 'text-danger';
  return (
    <>
      <span className={`${arrowClass} mr-1`}>{arrow}</span>
      {abs}% vs previous {period}
    </>
  );
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
          <div className="text-[11px] text-muted uppercase tracking-wider mt-0.5">Income & expense by month</div>
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

// ---------- Spending by category ----------

function SpendingCard({ rows }: { rows: ReturnType<typeof categoryBreakdown> }) {
  const max = Math.max(1, ...rows.map(r => r.amount));
  const total = rows.reduce((s, r) => s + r.amount, 0);
  return (
    <div className="card">
      <div className="flex justify-between items-end mb-3">
        <h2 className="heading h3-modal">Spending by category</h2>
        <div className="text-[13px] text-muted tabular">Total <span className="text-ink font-semibold">{fmtBDT(total)}</span></div>
      </div>
      {rows.length === 0 ? (
        <EmptyState
          message="No expenses in this period."
          cta={{ to: '/transactions/new', label: 'Add a transaction' }}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((r, index) => (
            <div key={r.categoryId ?? 'other'}>
              <div className="flex justify-between items-baseline gap-3">
                <div className="text-[14px] truncate">{r.name}</div>
                <div className="text-[12px] text-muted tabular shrink-0">
                  {fmtBDT(r.amount)} {`\u00B7 ${Math.round(r.pct)}%`}
                </div>
              </div>
              <div className="mt-1">
                <ProgressBar value={(r.amount / max) * 100} height={6} animateOnMount animationDelay={index * 180} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Net worth ----------

/**
 * NetWorthCard — month-end net worth trajectory.
 *
 * 2026-09-03 redesign (Variant A — hero + 2-up):
 *   - When `compact` is false (legacy / not used here), the card spans
 *     the full content width with an Avg / Best / Worst KPI strip
 *     underneath the chart.
 *   - When `compact` is true (the only call site on /insights now, in
 *     the 2-up strip next to Spending), the card drops the KPI strip
 *     and the hover caption so it fits cleanly into half the row. The
 *     chart height drops from 220 to 180 and the bar-width cap shrinks
 *     proportionally so the trajectory reads as a compact glance, not
 *     a half-hero.
 *
 * The "Now" figure on the right mirrors the Home hero so users can
 * compare instantly. Bars grow from the zero line on mount; hover
 * labels stay legible at the chart edges.
 */
function NetWorthCard({
  data, compact = false,
}: {
  data: ReturnType<typeof netWorthSeries>;
  compact?: boolean;
}) {
  const { points } = data;
  const [hover, setHover] = useState<number | null>(null);
  // The chart's viewBox width is fixed (1080) so the SVG scales
  // smoothly regardless of the actual card width — full-row vs half-
  // row — and the proportions stay identical across layouts.
  const W = 1080;
  const H = compact ? 180 : 220;
  const PAD_L = compact ? 12 : 24;
  const PAD_R = compact ? 12 : 24;
  const PAD_T = 12;
  const PAD_B = 22;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  const values = points.map(p => p.value);
  const minVal = Math.min(0, ...values);
  const maxVal = Math.max(1, ...values);
  const range = maxVal - minVal || 1;
  const zeroY = PAD_T + innerH * (1 - (0 - minVal) / range);

  const monthWidth = innerW / Math.max(1, points.length);
  // In compact mode the bar width scales down so a half-row of 6 bars
  // doesn't read as 6 huge rectangles.
  const barWidthCap = compact ? 22 : 36;
  const barWidth = Math.max(3, Math.min(barWidthCap, (monthWidth - 12) * 0.6));

  // Bar grow-in: each <rect> scales from 0 → 1 along its local Y axis,
  // anchored at the zero line so positive bars grow upward and negative
  // bars grow downward.
  const prefersReducedNw =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const barGrowDuration = 1800;

  const lastPoint = points[points.length - 1];
  const hoverPoint = hover !== null ? points[hover] : null;

  // KPI strip — derived directly from the same `points` array the
  // chart is rendering, so a Best/Worst/Avg triplet can never disagree
  // with the bars. Only used in the full (non-compact) variant.
  const kpi = useMemo(() => {
    if (points.length === 0) {
      return { avg: 0, best: { v: 0, label: '\u2014' }, worst: { v: 0, label: '\u2014' } };
    }
    const nonZero = points.filter(p => p.value !== 0);
    if (nonZero.length === 0) {
      return { avg: 0, best: { v: 0, label: '\u2014' }, worst: { v: 0, label: '\u2014' } };
    }
    let best = nonZero[0];
    let worst = nonZero[0];
    let sum = 0;
    for (const p of nonZero) {
      if (p.value > best.value) best = p;
      if (p.value < worst.value) worst = p;
      sum += p.value;
    }
    return {
      avg: sum / nonZero.length,
      best: { v: best.value, label: best.label.split(' ')[0] },
      worst: { v: worst.value, label: worst.label.split(' ')[0] },
    };
  }, [points]);

  return (
    <div className="card">
      <div className="flex justify-between items-start gap-3 mb-3">
        <div className="min-w-0">
          <h2 className="heading h3-modal">Net worth</h2>
          {!compact && (
            <div className="text-[11px] text-muted uppercase tracking-wider mt-0.5">Money in your hand at month-end</div>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10.5px] text-muted uppercase tracking-[0.08em] font-bold">Now</div>
          <div className={`text-[22px] font-extrabold tabular tracking-tight leading-none mt-1 ${lastPoint && lastPoint.value < 0 ? 'text-danger' : 'text-accent'}`}>
            {lastPoint
              ? (lastPoint.value < 0
                ? `\u2212${fmtBDT(Math.abs(lastPoint.value))}`
                : fmtBDT(lastPoint.value))
              : '\u2014'}
          </div>
        </div>
      </div>
      {points.length === 0 || points.every(p => p.value === 0) ? (
        <EmptyState
          message="No balance history in this period."
          cta={{ to: '/accounts/add', label: 'Add an account' }}
        />
      ) : (
        <>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            width="100%"
            height={H}
            role="img"
            aria-label="Net worth by month"
            onMouseLeave={() => setHover(null)}
            style={{ '--zero-y': `${zeroY}px` } as React.CSSProperties}
          >
            <title>Net worth bar chart.</title>
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
            {/* Zero line (if range crosses 0) */}
            {minVal < 0 && (
              <line
                x1={PAD_L}
                y1={zeroY}
                x2={W - PAD_R}
                y2={zeroY}
                stroke="var(--muted)"
                strokeWidth="1"
              />
            )}
            {/* Bars */}
            {points.map((p, i) => {
              const x0 = PAD_L + i * monthWidth + (monthWidth - barWidth) / 2;
              const v = p.value;
              const y = PAD_T + innerH * (1 - (v - minVal) / range);
              const top = Math.min(y, zeroY);
              const height = Math.max(1, Math.abs(y - zeroY));
              const isHover = hover === i;
              const isLast = i === points.length - 1;
              const fill = v < 0
                ? 'var(--danger)'
                : isHover || isLast
                  ? 'var(--primary)'
                  : 'var(--primary)';
              const opacity = v < 0 ? 1 : (isHover || isLast ? 1 : 0.7);
              const labelText = `${p.label}: ${fmtBDT(p.value)}`;
              const approxTextWidth = labelText.length * 6.2;
              const labelRight = x0 + barWidth / 2 + approxTextWidth / 2 + 4;
              const labelLeft = x0 + barWidth / 2 - approxTextWidth / 2 - 4;
              const labelOverflowsRight = labelRight > W - 4;
              const labelOverflowsLeft = labelLeft < PAD_L;
              return (
                <g key={`${p.year}-${p.month}`}>
                  <rect
                    x={PAD_L + i * monthWidth}
                    y={PAD_T}
                    width={monthWidth}
                    height={innerH}
                    fill="transparent"
                    onMouseEnter={() => setHover(i)}
                    onMouseMove={() => setHover(i)}
                  />
                  <rect
                    x={x0}
                    y={top}
                    width={barWidth}
                    height={height}
                    fill={fill}
                    opacity={opacity}
                    rx={2}
                    style={prefersReducedNw ? undefined : { animation: `networth-bar-grow ${barGrowDuration}ms cubic-bezier(.22,.61,.36,1) ${i * 90}ms both` }}
                    data-networth-bar
                  />
                  {/* Hover label */}
                  {isHover && (() => {
                    const cx = x0 + barWidth / 2;
                    let tx = cx;
                    let anchor: 'start' | 'middle' | 'end' = 'middle';
                    if (labelOverflowsRight) { tx = x0 + barWidth; anchor = 'end'; }
                    else if (labelOverflowsLeft) { tx = x0; anchor = 'start'; }
                    return (
                      <text
                        x={tx}
                        y={top - 6}
                        fontSize="11"
                        fill="var(--ink)"
                        fontFamily="var(--font-numeric)"
                        textAnchor={anchor}
                      >
                        {labelText}
                      </text>
                    );
                  })()}
                  {/* X labels — every other for dense ranges */}
                  {(points.length <= 6 || i % 2 === 0) && (
                    <text
                      x={x0 + barWidth / 2}
                      y={H - 6}
                      textAnchor="middle"
                      fontSize="10"
                      fill="var(--muted)"
                    >
                      {p.label.split(' ')[0]}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Bottom caption — hovered month, falls back to "Now" callout. */}
          {hoverPoint ? (
            <div className="text-[11px] text-muted mt-2 tabular">
              {hoverPoint.label}:{' '}
              <span className={`font-semibold ${hoverPoint.value < 0 ? 'text-danger' : 'text-ink'}`}>
                {hoverPoint.value < 0
                  ? `\u2212${fmtBDT(Math.abs(hoverPoint.value))}`
                  : fmtBDT(hoverPoint.value)}
              </span>
            </div>
          ) : (
            <div className="text-[11px] text-muted mt-2 tabular">
              Hover any bar for that month's figure.
            </div>
          )}

          {/* KPI strip — Avg / Best / Worst. 3-up grid below the chart,
              same canonical gap rhythm so the page reads as a single
              composition. Tones: Best primary (upside), Worst danger
              (the dip), Avg ink (neutral aggregate). */}
          <div className="grid grid-cols-3 mt-4 -mx-2 px-2 pt-4 border-t border-border divide-x divide-border">
            <div className="px-4 first:pl-0 last:pr-0">
              <div className="text-[10.5px] text-muted uppercase tracking-[0.08em] font-bold">
                Avg / month
              </div>
              <div className={`mt-1.5 text-[18px] font-extrabold tabular tracking-tight leading-none ${kpi.avg < 0 ? 'text-danger' : 'text-ink'}`}>
                {kpi.avg < 0
                  ? `\u2212${fmtBDT(Math.abs(kpi.avg))}`
                  : fmtBDT(kpi.avg)}
              </div>
              <div className="text-[11.5px] text-muted mt-1 truncate">across {points.length} months</div>
            </div>
            <div className="px-4 first:pl-0 last:pr-0">
              <div className="text-[10.5px] text-muted uppercase tracking-[0.08em] font-bold">
                Best month
              </div>
              <div className="mt-1.5 text-[18px] font-extrabold tabular tracking-tight leading-none text-primary">
                {kpi.best.v < 0
                  ? `\u2212${fmtBDT(Math.abs(kpi.best.v))}`
                  : `+${fmtBDT(kpi.best.v)}`}
              </div>
              <div className="text-[11.5px] text-muted mt-1 truncate">
                {kpi.best.v >= 0 ? '\u25B2 ' : '\u25BC '}{kpi.best.label}
              </div>
            </div>
            <div className="px-4 first:pl-0 last:pr-0">
              <div className="text-[10.5px] text-muted uppercase tracking-[0.08em] font-bold">
                Worst month
              </div>
              <div className="mt-1.5 text-[18px] font-extrabold tabular tracking-tight leading-none text-danger">
                {kpi.worst.v < 0
                  ? `\u2212${fmtBDT(Math.abs(kpi.worst.v))}`
                  : `+${fmtBDT(kpi.worst.v)}`}
              </div>
              <div className="text-[11.5px] text-muted mt-1 truncate">
                {kpi.worst.v <= 0 ? '\u25BC ' : '\u25B2 '}{kpi.worst.label}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ---------- Trends ----------

/**
 * TrendsCard — full-width aggregates strip at the bottom of /insights.
 *
 * Renders four "how am I doing?" metrics that fall out of the in-memory
 * state without forcing a click. The four rows are intentionally
 * derived from different domains so the user sees a single page-level
 * summary instead of four unrelated tiles:
 *
 *   1. Avg monthly expense  — from `computeStats` (per-month aggregate).
 *   2. Savings rate         — net flow ÷ income, computed inline so it
 *                              can render even when the range key has
 *                              no comparable previous period.
 *   3. Days of runway       — total cash ÷ daily avg expense over the
 *                              range. The same figure the Home Screen
 *                              exposes, anchored here for at-a-glance
 *                              trend visibility.
 *   4. Investment growth    — sum of (maturity − contributed/principal)
 *                              across active schemes, the same
 *                              projection the Investments screen shows.
 *
 * Each row carries its own tone (primary / danger / accent) so the
 * strip reads with the same semantic colour-coding as the rest of the
 * analytics dashboard, and so a single row that's negative can't
 * colour-wash the whole card. The "vs previous period" caption uses
 * `periodComparison` so the same arrow/colour rule applies consistently.
 */
function TrendsCard({
  stats, rangeKey, state,
}: {
  stats: StatRow;
  rangeKey: DateRangeKey;
  state: ReturnType<typeof useStore.getState>['state'];
}) {
  // Savings rate — (income − expense) ÷ income. When income is 0
  // the rate is undefined, so we render a muted `—` instead of a
  // misleading percentage. Comparisons are gated to ranges with a
  // meaningful previous period (last3/last6/last12), so savings rate
  // drops the "vs previous" caption on this month / all time.
  const totalIncome = state.transactions
    .filter(t => t.type === 'income')
    .reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const totalExpense = state.transactions
    .filter(t => t.type === 'expense')
    .reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const netFlowSum = stats.netFlow;
  const savingsRate = totalIncome > 0
    ? (netFlowSum / totalIncome) * 100
    : null;

  // Days of runway — total cash across all accounts at `now`, divided
  // by the user's daily average expense. We use the same computeNetWorth
  // helper as Home so the figure matches the hero card there.
  const cashNow = computeNetWorth(state).cash;
  // Daily burn = total expense ÷ days in range. Falls back to "—"
  // when there's no spend data so we don't divide by zero.
  const dailyBurn = (() => {
    if (state.transactions.length === 0) return 0;
    let minDate = state.transactions[0].date;
    let maxDate = state.transactions[0].date;
    for (const t of state.transactions) {
      if (t.date < minDate) minDate = t.date;
      if (t.date > maxDate) maxDate = t.date;
    }
    const days = Math.max(
      1,
      Math.round((new Date(maxDate + 'T00:00:00Z').getTime() - new Date(minDate + 'T00:00:00Z').getTime()) / 86400000) + 1
    );
    return totalExpense / days;
  })();
  const daysRunway = dailyBurn > 0 ? Math.round(cashNow / dailyBurn) : null;

  // Investment growth — sum of (maturity − contributed/principal) across
  // active schemes. For DPS, contributed is `dpsContributedSoFar` (real
  // money paid), not the original nominal principal; for FDR / savings
  // we just use `Number(inv.principal)` because there's no installment
  // stream.
  const investedContributed = state.investments.reduce((s, inv) => {
    if (inv.status !== 'active') return s;
    if (inv.type === 'dps') {
      return s + dpsContributedSoFar(inv, state.transactions);
    }
    return s + (Number(inv.principal) || 0);
  }, 0);
  const investedMaturity = state.investments.reduce((s, inv) => {
    if (inv.status !== 'active') return s;
    const projected = investmentMaturityValueTyped(inv);
    const paidOut = inv.type === 'dps'
      ? dpsPaidOutSoFar(inv, state.transactions)
      : 0;
    return s + Math.max(0, projected - paidOut);
  }, 0);
  const invGrowth = investedMaturity - investedContributed;
  const hasInvestments = state.investments.some(inv => inv.status === 'active');

  return (
    <div className="card">
      <div className="flex justify-between items-end mb-1">
        <h2 className="heading h3-modal">Trends</h2>
        <div className="text-[11.5px] text-muted">
          Aggregates over the chosen range
        </div>
      </div>
      <div className="mt-2">
        <TrendRow
          label="Average monthly expense"
          hint="Total out across months with activity"
          value={fmtBDT(stats.avgMonthlyExpense)}
          valueTone="ink"
          caption={periodComparison(stats.avgMonthlyExpense, stats.avgMonthlyExpensePrev, rangeKey)}
        />
        <TrendRow
          label="Savings rate"
          hint="(income − expense) ÷ income · 0 if no income"
          value={
            savingsRate === null
              ? '\u2014'
              : `${savingsRate > 0 ? '+' : savingsRate < 0 ? '\u2212' : ''}${Math.abs(Math.round(savingsRate))}%`
          }
          valueTone={
            savingsRate === null ? 'ink'
            : savingsRate > 0 ? 'primary'
            : savingsRate < 0 ? 'danger'
            : 'ink'
          }
        />
        <TrendRow
          label="Days of runway"
          hint="Cash ÷ daily avg expense · at current burn"
          value={daysRunway === null ? '\u2014' : `${daysRunway} d`}
          valueTone={
            daysRunway === null ? 'ink'
            : daysRunway >= 30 ? 'primary'
            : daysRunway >= 7 ? 'accent'
            : 'danger'
          }
        />
        <TrendRow
          label="Investment growth"
          hint={hasInvestments
            ? 'Active schemes \u00B7 maturity − contributed'
            : 'No active investments yet'}
          value={hasInvestments
            ? (invGrowth >= 0 ? `+${fmtBDT(invGrowth)}` : `\u2212${fmtBDT(Math.abs(invGrowth))}`)
            : '\u2014'}
          valueTone={
            !hasInvestments ? 'ink'
            : invGrowth > 0 ? 'primary'
            : invGrowth < 0 ? 'danger'
            : 'ink'
          }
        />
      </div>
<div className="mt-4 pt-3 border-t border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-[11.5px] text-muted">
        <span className="min-w-0">Goal / Debt / Investment lists live on their own screens</span>
        <span className="flex items-center gap-3 shrink-0">
          <Link to="/goals" className="text-info font-semibold hover:underline underline-offset-2">Goals</Link>
          <span className="text-muted/40" aria-hidden>{'\u00B7'}</span>
          <Link to="/debts" className="text-danger font-semibold hover:underline underline-offset-2">Debts</Link>
          <span className="text-muted/40" aria-hidden>{'\u00B7'}</span>
          <Link to="/investments" className="text-primary font-semibold hover:underline underline-offset-2">Investments</Link>
        </span>
      </div>
    </div>
  );
}

/**
 * TrendRow — one row inside TrendsCard.
 *
 * 2026-09-03 polish: collapsed the caption column into the value cell.
 * Previously the row was a 3-col grid (label / value / caption) with
 * a 140px-wide caption column that always rendered even when empty —
 * leaving an awkward empty strip to the right of every value. Now the
 * caption (when present) renders as a small muted sub-line *under* the
 * value, so the row reads as a clean 2-up (label / value) with an
 * optional explanatory chip below the figure.
 *
 * The label + hint stay grouped on the left in a single min-w-0 block
 * so long hints truncate instead of forcing the row wider.
 */
function TrendRow({
  label, hint, value, valueTone, caption,
}: {
  label: string;
  hint: string;
  value: string;
  valueTone: 'primary' | 'danger' | 'accent' | 'ink';
  caption?: ReactNode;
}) {
  const valueClass =
    valueTone === 'primary' ? 'text-primary'
    : valueTone === 'danger' ? 'text-danger'
    : valueTone === 'accent' ? 'text-accent'
    : 'text-ink';
  return (
    // The value cell uses `minmax(0, auto)` instead of bare `auto` so
    // it shrinks (not just sits at intrinsic width) — long figures like
    // "+৳ 5,05,137" can't push the row past the card's right padding.
    // `truncate` with `title` keeps the figure discoverable when it does
    // overflow at very narrow widths.
    <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,auto)] gap-3 sm:gap-6 items-center py-3 border-t border-border first:border-t-0">
      <div className="min-w-0">
        <div className="text-[14px] font-semibold tracking-tight">{label}</div>
        <div className="text-[11.5px] text-muted mt-0.5 truncate">{hint}</div>
      </div>
      <div className="text-right min-w-0 max-w-full">
        <div
          className={`text-[16px] sm:text-[18px] font-extrabold tabular tracking-tight leading-none ${valueClass}`}
          title={value}
        >
          {value}
        </div>
        {caption && (
          <div className="text-[11px] text-muted font-semibold tabular mt-1.5 truncate">
            {caption}
          </div>
        )}
      </div>
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
