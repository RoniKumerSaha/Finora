/**
 * InsightsScreen — analytics dashboard at /insights.
 *
 * Spine: docs/ux-designs/ux-finora-2026-08-14-analytics/EXPERIENCE.md
 *
 * Composed of six widgets in a fixed order:
 *   1. Stat row (3-up) — net flow, avg monthly expense, saved toward goals
 *   2. Cash flow chart — grouped bars, income (primary) + expense (danger)
 *   3. Spending by category — top 6 + Other
 *   4. Net worth trajectory — single line, primary
 *   5. Goals — active goals with progress bars
 *   6. Debts — active debts with ETA
 *   7. Investments — active investments with maturity countdown
 *
 * All widgets derive from the same in-memory state plus the chosen date
 * range. Date range is persisted to localStorage under
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
  debtsForInsights,
  earliestDate,
  goalsForInsights,
  investmentsForInsights,
  monthlyCashFlow,
  netWorthSeries,
  readRange,
  resolveRange,
  type DateRangeKey,
} from '../domain/insights';
import { fmtBDT, fmtDate } from '../lib/format';
import {
  investmentValue,
} from '../domain/math';
import { ArrowUp, ArrowDown, ChevronRight } from '../components/icons/Icons';
import { DualValueLine } from '../components/DualValueLine';
import { Stat, type StatTone } from '../components/Stat';
import type { Investment } from '../domain/types';

const MIDDOT = '\u00B7';

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
  const goals = useMemo(() => goalsForInsights(state), [state]);
  const debts = useMemo(() => debtsForInsights(state), [state]);
  const investments = useMemo(() => investmentsForInsights(state), [state]);

  const subLine = useMemo(() => formatRangeSubLine(rangeKey, range, state), [rangeKey, range, state]);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-end gap-3">
        <div>
          <h1 className="heading h1-screen">Insights</h1>
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

      {/* 1. Stat row (3-up) */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatTile
          label="Net flow"
          value={fmtBDT(stats.netFlow)}
          tone={stats.netFlow >= 0 ? 'primary' : 'danger'}
          caption={periodComparison(stats.netFlow, stats.netFlowPrev, rangeKey)}
        />
        <StatTile
          label="Avg monthly expense"
          value={fmtBDT(stats.avgMonthlyExpense)}
          tone="danger"
          caption={periodComparison(stats.avgMonthlyExpense, stats.avgMonthlyExpensePrev, rangeKey)}
        />
        <StatTile
          label="Saved toward goals"
          value={fmtBDT(stats.savedTowardGoals)}
          tone="accent"
          caption={periodComparison(stats.savedTowardGoals, stats.savedTowardGoalsPrev, rangeKey)}
        />
      </section>

      {/* 2. Cash flow */}
      <section aria-label={`Cash flow over ${RANGE_LABELS[rangeKey]}`}>
        <CashFlowCard data={cashFlow} />
      </section>

      {/* 3. Spending by category */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SpendingCard rows={categories} />
        <NetWorthCard data={netWorth} />
      </section>

      {/* 4. Goals, Debts, Investments */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GoalsCard goals={goals} />
        <DebtsCard debts={debts} />
      </section>
      <InvestmentsCard investments={investments} />
    </div>
  );
}

// ---------- Helpers ----------

function formatRangeSubLine(
  key: DateRangeKey,
  range: { start: Date; end: Date },
  state: ReturnType<typeof useStore.getState>['state']
): string {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  if (key === 'thisMonth') {
    return `${months[range.start.getUTCMonth()]} ${range.start.getUTCFullYear()}`;
  }
  if (key === 'all') {
    const e = earliestDate(state);
    if (!e) return 'Since you started tracking';
    const startLabel = `${months[e.getUTCMonth()]} ${e.getUTCFullYear()}`;
    const endLabel = `${months[range.end.getUTCMonth()]} ${range.end.getUTCFullYear()}`;
    return `${startLabel} \u2013 ${endLabel}`;
  }
  const startLabel = `${months[range.start.getUTCMonth()]} ${range.start.getUTCFullYear()}`;
  const endLabel = `${months[range.end.getUTCMonth()]} ${range.end.getUTCFullYear()}`;
  return `${startLabel} \u2013 ${endLabel}`;
}

/**
 * Build a "vs previous period" caption. When the previous period has no
 * data, returns null (caller suppresses the caption).
 */
function periodComparison(current: number, previous: number, rangeKey: DateRangeKey): string | null {
  if (rangeKey === 'thisMonth' || rangeKey === 'all') return null;
  if (previous === 0) return null;
  const diff = ((current - previous) / Math.abs(previous)) * 100;
  const sign = diff >= 0 ? '+' : '\u2212';
  const abs = Math.abs(Math.round(diff));
  return `${sign} ${abs}% vs previous ${rangeKey === 'last3' ? '3 months' : rangeKey === 'last6' ? '6 months' : '12 months'}`;
}

// ---------- Pill ----------

function RangePill({ rangeKey, active, onSelect }: { rangeKey: DateRangeKey; active: boolean; onSelect: () => void }) {
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

// ---------- Stat tile ----------

function StatTile({
  label,
  value,
  tone,
  caption,
}: {
  label: string;
  value: string;
  tone: 'primary' | 'danger' | 'ink' | 'accent' | 'info';
  caption: string | null;
}) {
  // Tone mapping (legacy → canonical Stat tone):
  //   'info' → 'primary' (info-blue used to convey "neutral positive",
  //   which the canonical Stat collapses to primary). The Insights
  //   screen never actually calls StatTile with 'info' — kept in the
  //   signature for forward compatibility.
  const mapped: StatTone =
    tone === 'info' ? 'primary' : tone;
  return (
    <div className="card" role="group" aria-label={`${label}: ${value}${caption ? ', ' + caption : ''}`}>
      <Stat label={label} value={value} size="xl" tone={mapped} hint={caption ?? undefined} />
    </div>
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

  const totalIncome = bars.reduce((s, b) => s + b.income, 0);

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
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-danger" />
            <span className="text-muted">Expense</span>
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
              points={incomeLine}
              fill="none"
              stroke="var(--primary)"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity={hover === null ? 1 : 0.55}
            />
            {/* Expense line */}
            <polyline
              points={expenseLine}
              fill="none"
              stroke="var(--danger)"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity={hover === null ? 1 : 0.55}
            />
            {/* Hit areas + dots */}
            {bars.map((b, i) => {
              const [incX, incY] = xy(i, b.income);
              const [expX, expY] = xy(i, b.expense);
              const isHover = hover === i;
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
                  />
                  <circle
                    cx={expX} cy={expY} r={isHover ? 5 : 3}
                    fill="var(--danger)"
                    stroke="var(--primary-on)"
                    strokeWidth={isHover ? 2 : 0}
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
              <div className="text-primary tabular">+ {fmtBDT(hoverBar.income)}</div>
              <div className="text-danger tabular">{'\u2212'} {fmtBDT(hoverBar.expense)}</div>
            </div>
          )}
          <div className="flex justify-between items-center text-[11px] text-muted mt-2 tabular">
            <span>{totalIncome > 0 ? `Total income ${fmtBDT(totalIncome)}` : ''}</span>
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
        <div className="text-[13px] text-muted tabular">{total > 0 ? `Total ${fmtBDT(total)}` : '—'}</div>
      </div>
      {rows.length === 0 ? (
        <EmptyState
          message="No expenses in this period."
          cta={{ to: '/transactions/new', label: 'Add a transaction' }}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map(r => (
            <div key={r.categoryId ?? 'other'}>
              <div className="flex justify-between items-baseline gap-3">
                <div className="text-[14px] truncate">{r.name}</div>
                <div className="text-[12px] text-muted tabular shrink-0">
                  {fmtBDT(r.amount)} {`\u00B7 ${Math.round(r.pct)}%`}
                </div>
              </div>
              <div className="mt-1 h-1.5 rounded-pill overflow-hidden bg-surface-2">
                <div
                  className="h-full rounded-pill"
                  style={{ width: `${(r.amount / max) * 100}%`, background: 'linear-gradient(90deg, var(--accent), var(--primary))' }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Net worth ----------

function NetWorthCard({ data }: { data: ReturnType<typeof netWorthSeries> }) {
  const { points } = data;
  const [hover, setHover] = useState<number | null>(null);
  const W = 480;
  const H = 220;
  const PAD_L = 16;
  const PAD_R = 16;
  const PAD_T = 16;
  const PAD_B = 24;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  const values = points.map(p => p.value);
  const minVal = Math.min(0, ...values);
  const maxVal = Math.max(1, ...values);
  const range = maxVal - minVal || 1;
  const zeroY = PAD_T + innerH * (1 - (0 - minVal) / range);

  const monthWidth = innerW / Math.max(1, points.length);
  const barWidth = Math.max(2, Math.min(28, (monthWidth - 8) * 0.6));

  const lastPoint = points[points.length - 1];
  const hoverPoint = hover !== null ? points[hover] : null;

  return (
    <div className="card">
      <div className="flex justify-between items-end mb-3">
        <div>
          <h2 className="heading h3-modal">Net worth</h2>
          <div className="text-[11px] text-muted uppercase tracking-wider mt-0.5">Real money now</div>
        </div>
        <div className="text-[22px] font-bold tabular text-info">
          {lastPoint ? fmtBDT(lastPoint.value) : '—'}
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
          {/* Bottom legend */}
          {hoverPoint && (
            <div className="text-[11px] text-muted mt-2 tabular">
              {hoverPoint.label}: <span className="text-info font-semibold">{fmtBDT(hoverPoint.value)}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------- Goals ----------

function GoalsCard({ goals }: { goals: ReturnType<typeof goalsForInsights> }) {
  // The widget caps the row list at 5 for visual density. When there are
  // more goals than that, the header-right slot swaps from a passive
  // "N active" count to an active "See all →" link so the extras don't
  // become unreachable from this screen.
  const overflow = goals.length > 5;
  return (
    <div className="card">
      <div className="flex justify-between items-end mb-3">
        <h2 className="heading h3-modal">Goals</h2>
        {overflow
          ? <Link to="/goals" className="text-primary text-[12.5px] font-semibold hover:underline underline-offset-2">See all {'\u2192'}</Link>
          : <div className="text-[12px] text-muted tabular">{goals.length} active</div>}
      </div>
      {goals.length === 0 ? (
        <EmptyState message="No active goals." cta={{ to: '/goals/add', label: 'Set a goal' }} />
      ) : (
        <div className="flex flex-col gap-1">
          {goals.slice(0, 5).map(g => <GoalRow key={g.id} goal={g} />)}
        </div>
      )}
    </div>
  );
}

function GoalRow({ goal }: { goal: ReturnType<typeof goalsForInsights>[number] }) {
  return (
    <Link
      to={`/goals/${goal.id}`}
      className="group relative flex items-center gap-3 py-3 border-b border-border last:border-0 row-hover -mx-2 px-2 rounded transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
    >
      <span
        aria-hidden
        className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r-full opacity-0 group-hover:opacity-100 transition"
        style={{ background: 'var(--primary)' }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center gap-3">
          <div className="font-semibold text-[14px] tracking-tight truncate">{goal.name}</div>
          <div className="text-[13px] font-semibold tabular text-accent shrink-0">
            {goal.perMonthLabel}
          </div>
        </div>
        <div className="mt-2 h-2 rounded-pill overflow-hidden bg-surface-2">
          <div
            className="h-full rounded-pill"
            style={{
              width: `${goal.pct}%`,
              background: 'linear-gradient(90deg, var(--primary), var(--accent))',
            }}
          />
        </div>
        <div className="flex justify-between text-[11px] text-muted mt-1.5 tabular">
          <span>{goal.pct}% {MIDDOT} {fmtBDT(goal.saved)} / {fmtBDT(goal.target)}</span>
          <span>by {fmtDate(goal.targetDate)}</span>
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-muted opacity-0 group-hover:opacity-100 transition" aria-hidden />
    </Link>
  );
}

// ---------- Debts ----------

function DebtsCard({ debts }: { debts: ReturnType<typeof debtsForInsights> }) {
  // Header-right slot swaps from "N active" → "See all →" when the
  // widget is hiding items. See GoalsCard for the rationale.
  const overflow = debts.length > 5;
  return (
    <div className="card">
      <div className="flex justify-between items-end mb-3">
        <h2 className="heading h3-modal">Debts</h2>
        {overflow
          ? <Link to="/debts" className="text-primary text-[12.5px] font-semibold hover:underline underline-offset-2">See all {'\u2192'}</Link>
          : <div className="text-[12px] text-muted tabular">{debts.length} active</div>}
      </div>
      {debts.length === 0 ? (
        <EmptyState message="No active debts." />
      ) : (
        <div className="flex flex-col gap-1">
          {debts.slice(0, 5).map(d => <DebtRow key={d.id} debt={d} />)}
        </div>
      )}
    </div>
  );
}

function DebtRow({ debt }: { debt: ReturnType<typeof debtsForInsights>[number] }) {
  const isOwed = debt.direction === 'owed_to_me';
  // Gradient matches the goal-card treatment: progress-positive uses
  // primary → accent; debt-reduction (i_owe) uses danger → warn. The
  // gradient gives the bar visual depth at the small 1.5px height.
  const trackColor = isOwed
    ? 'linear-gradient(90deg, var(--primary), var(--accent))'
    : 'linear-gradient(90deg, var(--danger), var(--warn))';
  const chipBg = isOwed ? 'bg-primary-soft text-primary' : 'bg-danger-soft text-danger';
  const remainingColor = isOwed ? 'text-primary' : 'text-danger';
  return (
    <Link
      to={`/debts/${debt.id}/edit`}
      className="group relative flex items-center gap-3 py-3 border-b border-border last:border-0 row-hover -mx-2 px-2 rounded transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
    >
      <span
        aria-hidden
        className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r-full opacity-0 group-hover:opacity-100 transition"
        style={{ background: 'var(--primary)' }}
      />
      <div className={`w-8 h-8 rounded-[10px] grid place-items-center shrink-0 ${chipBg}`}>
        {isOwed ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center gap-3">
          <div className="font-semibold text-[14px] tracking-tight truncate">{debt.name}</div>
          <div className={`text-[13px] font-bold tabular shrink-0 ${remainingColor}`}>
            {fmtBDT(debt.remaining)}
          </div>
        </div>
        <div className="mt-2 h-1.5 rounded-pill overflow-hidden bg-surface-2">
          <div className="h-full rounded-pill" style={{ width: `${debt.pct}%`, background: trackColor }} />
        </div>
        <div className="flex justify-between text-[11px] text-muted mt-1.5 tabular">
          <span>{debt.pct}% paid {MIDDOT} {fmtBDT(debt.paid)} of {fmtBDT(debt.total)}</span>
          <span>{debt.eta}</span>
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-muted opacity-0 group-hover:opacity-100 transition" aria-hidden />
    </Link>
  );
}

// ---------- Investments ----------

function InvestmentsCard({ investments }: { investments: ReturnType<typeof investmentsForInsights> }) {
  const state = useStore(s => s.state);
  // Lookup table so each row's investment can be fetched in O(1)
  // instead of an O(n) `Array.find`. `investmentValue` is computed
  // once per item and shared with the row below.
  const invById = new Map(state.investments.map(x => [x.id, x]));
  let totalCurrent = 0;
  let totalProjected = 0;
  const rows = investments.map(inv => {
    const full = invById.get(inv.id);
    const current = full
      ? investmentValue(full, state.transactions).currentValue
      : Number(inv.principal) || 0;
    const projected = inv.maturityValue;
    totalCurrent += current;
    totalProjected += projected;
    return { inv, current, projected };
  });
  const hasAny = investments.length > 0;
  const showProjection = totalProjected - totalCurrent > 0;
  return (
    <div className="card">
      <div className="flex justify-between items-end mb-3 gap-6">
        <h2 className="heading h3-modal">Investments</h2>
        <div className="grid grid-cols-2 gap-x-6 text-right">
          <div>
            <div className="text-[11px] text-muted uppercase tracking-wider font-semibold">Current value</div>
            <div className="text-[20px] font-bold tabular text-accent mt-1 leading-none tracking-[-0.02em]">
              {fmtBDT(totalCurrent)}
            </div>
            <div className="text-[10px] text-muted mt-0.5 tabular">Money tied up now</div>
          </div>
          <div>
            <div className="text-[11px] text-muted uppercase tracking-wider font-semibold">At maturity</div>
            <div className="text-[20px] font-bold tabular text-primary mt-1 leading-none tracking-[-0.02em]">
              {hasAny ? fmtBDT(totalProjected) : '\u2014'}
            </div>
            {hasAny && (
              <div className="text-[10px] text-muted mt-0.5 tabular">
                {showProjection ? 'Projection' : '— No growth —'}
              </div>
            )}
          </div>
        </div>
      </div>
      {investments.length === 0 ? (
        <EmptyState
          message="No active investments."
          cta={{ to: '/investments/add', label: 'Add an investment' }}
        />
      ) : (
        <>
          <div className="flex flex-col gap-1">
            {rows.slice(0, 5).map(({ inv, current, projected }) => (
              <InvestmentRow key={inv.id} inv={inv} current={current} projected={projected} />
            ))}
          </div>
          {investments.length > 5 && (
            <div className="flex justify-end pt-3">
              <Link to="/investments" className="text-primary text-[12.5px] font-semibold hover:underline underline-offset-2">
                See all {'\u2192'}
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function InvestmentRow({
  inv, current, projected,
}: {
  inv: ReturnType<typeof investmentsForInsights>[number];
  current: number;
  projected: number;
}) {
  const days = inv.daysToMaturity;
  const daysLabel = days <= 0 ? 'Matured' : `${days} ${days === 1 ? 'day' : 'days'}`;
  const isDps = inv.type === 'dps';
  const showBoth = isDps && projected - current > 1;
  return (
    <Link
      to={`/investments/${inv.id}`}
      className="group relative flex items-center gap-3 py-3 border-b border-border last:border-0 row-hover -mx-2 px-2 rounded transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
    >
      <span
        aria-hidden
        className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r-full opacity-0 group-hover:opacity-100 transition"
        style={{ background: 'var(--primary)' }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center gap-3">
          <div className="font-semibold text-[14px] tracking-tight truncate">
            <span aria-hidden className="mr-1">{investmentEmoji(inv.type as Investment['type'])}</span>
            {inv.name}
          </div>
          <DualValueLine
            current={current}
            projected={projected}
            currentTone="accent"
            headlinePrefix={showBoth ? 'Now' : undefined}
            className="shrink-0"
          />
        </div>
        <div className="text-[11px] text-muted mt-1 tabular truncate">
          {daysLabel}
          {inv.payoutAccountName ? ` ${MIDDOT} ${inv.payoutAccountName}` : ''}
          {' '}{MIDDOT} {fmtBDT(inv.principal)}
          {' '}{MIDDOT} {inv.rate}% {MIDDOT} {inv.termMonths}mo
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-muted opacity-0 group-hover:opacity-100 transition" aria-hidden />
    </Link>
  );
}

function investmentEmoji(type: Investment['type']): string {
  if (type === 'dps') return '\u{1F4C5}';
  if (type === 'fdr') return '\u{1F3E6}';
  return '\u{1F4DC}';
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
