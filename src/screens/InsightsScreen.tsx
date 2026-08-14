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
import { dpsContributedSoFar } from '../domain/math';
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
          tone="ink"
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
  tone: 'primary' | 'danger' | 'ink' | 'accent';
  caption: string | null;
}) {
  const valueColor =
    tone === 'primary' ? 'text-primary'
    : tone === 'danger' ? 'text-danger'
    : tone === 'accent' ? 'text-accent'
    : 'text-ink';
  return (
    <div className="card" role="group" aria-label={`${label}: ${value}${caption ? ', ' + caption : ''}`}>
      <div className="text-[11px] text-muted uppercase tracking-wider">{label}</div>
      <div className={`text-[28px] font-bold tabular mt-1 leading-[1.0] tracking-[-0.02em] ${valueColor}`}>
        {value}
      </div>
      {caption && (
        <div className="text-[12px] text-muted mt-2">{caption}</div>
      )}
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
  const monthWidth = innerW / Math.max(1, bars.length);
  const barWidth = Math.max(2, Math.min(10, (monthWidth - 16) / 2));

  const total = bars.reduce((s, b) => s + b.expense, 0);

  return (
    <div className="card">
      <div className="flex justify-between items-end mb-3">
        <div>
          <h2 className="heading h3-modal">Cash flow</h2>
          <div className="text-[11px] text-muted uppercase tracking-wider mt-0.5">Income & expense by month</div>
        </div>
        <div className="text-[13px] text-muted tabular">
          {total > 0 ? `Total expense ${fmtBDT(total)}` : '—'}
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
            <title>Cash flow grouped bar chart.</title>
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
            {/* Bars */}
            {bars.map((b, i) => {
              const x0 = PAD_L + i * monthWidth;
              const incH = (b.income / max) * innerH;
              const expH = (b.expense / max) * innerH;
              const incX = x0 + (monthWidth - 2 * barWidth - 8) / 2;
              const expX = incX + barWidth + 8;
              const isHover = hover === i;
              return (
                <g
                  key={`${b.year}-${b.month}`}
                  onMouseEnter={() => setHover(i)}
                  onMouseMove={() => setHover(i)}
                >
                  <rect x={x0} y={PAD_T} width={monthWidth} height={innerH} fill="transparent" />
                  <rect
                    x={incX}
                    y={PAD_T + innerH - incH}
                    width={barWidth}
                    height={incH}
                    fill="var(--primary)"
                    opacity={hover === null || isHover ? 1 : 0.5}
                    rx={1}
                  />
                  <rect
                    x={expX}
                    y={PAD_T + innerH - expH}
                    width={barWidth}
                    height={expH}
                    fill="var(--danger)"
                    opacity={hover === null || isHover ? 1 : 0.5}
                    rx={1}
                  />
                  {/* X labels — every other for dense ranges */}
                  {(bars.length <= 6 || i % 2 === 0) && (
                    <text
                      x={x0 + monthWidth / 2}
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
                x1={PAD_L + hover * monthWidth + monthWidth / 2}
                y1={PAD_T}
                x2={PAD_L + hover * monthWidth + monthWidth / 2}
                y2={PAD_T + innerH}
                stroke="var(--muted)"
                strokeWidth="1"
              />
            )}
          </svg>
          {/* Tooltip */}
          {hover !== null && bars[hover] && (
            <div
              className="text-[11px] pointer-events-none"
              role="tooltip"
              style={{
                position: 'relative',
                marginTop: '-32px',
                marginLeft: `${Math.max(0, Math.min(W - 180, (hover / Math.max(1, bars.length)) * innerW + PAD_L - 60))}px`,
                display: 'inline-block',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-input)',
                padding: '6px 10px',
                boxShadow: 'var(--shadow-card)',
                fontFamily: 'var(--font-numeric)',
              }}
            >
              <div className="text-muted">{bars[hover].label}</div>
              <div className="text-primary tabular">+ {fmtBDT(bars[hover].income)}</div>
              <div className="text-danger tabular">{'\u2212'} {fmtBDT(bars[hover].expense)}</div>
            </div>
          )}
          {totalMonths > cappedAt && (
            <div className="text-[11px] text-muted mt-2">
              Showing last {cappedAt} of {totalMonths} months.
            </div>
          )}
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
                  style={{ width: `${(r.amount / max) * 100}%`, background: 'var(--accent)' }}
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

  const xy = (i: number, v: number) => {
    const x = points.length === 1 ? PAD_L + innerW / 2 : PAD_L + (i / (points.length - 1)) * innerW;
    const y = PAD_T + innerH * (1 - (v - minVal) / range);
    return [x, y] as const;
  };

  const polyline = points.map((p, i) => xy(i, p.value).join(',')).join(' ');
  const [lastX, lastY] = points.length > 0 ? xy(points.length - 1, points[points.length - 1].value) : [0, 0];
  const lastPoint = points[points.length - 1];

  return (
    <div className="card">
      <div className="flex justify-between items-end mb-3">
        <div>
          <h2 className="heading h3-modal">Net worth</h2>
          <div className="text-[11px] text-muted uppercase tracking-wider mt-0.5">Assets {'\u2212'} liabilities</div>
        </div>
        <div className="text-[22px] font-bold tabular text-ink">
          {lastPoint ? fmtBDT(lastPoint.value) : '—'}
        </div>
      </div>
      {points.length === 0 || points.every(p => p.value === 0) ? (
        <EmptyState
          message="No balance history in this period."
          cta={{ to: '/accounts/add', label: 'Add an account' }}
        />
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Net worth trajectory">
          <title>Net worth trajectory line chart.</title>
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
          <polyline
            points={polyline}
            fill="none"
            stroke="var(--primary)"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {points.length > 0 && (
            <g>
              <circle cx={lastX} cy={lastY} r="6" fill="var(--primary)" />
              <circle cx={lastX} cy={lastY} r="3" fill="var(--primary-on)" />
              {(() => {
                // If the last-point label would overflow the right edge,
                // anchor it to the right and place it *to the left* of
                // the dot. Otherwise anchor to start and place to the right.
                const labelText = `${lastPoint?.label ?? ''}: ${fmtBDT(lastPoint?.value ?? 0)}`;
                const approxTextWidth = labelText.length * 6.2; // crude px estimate at 11px
                const overflowsRight = lastX + 10 + approxTextWidth > W - 4;
                return (
                  <text
                    x={overflowsRight ? lastX - 10 : lastX + 10}
                    y={lastY - 8}
                    fontSize="11"
                    fill="var(--ink)"
                    fontFamily="var(--font-numeric)"
                    textAnchor={overflowsRight ? 'end' : 'start'}
                  >
                    {labelText}
                  </text>
                );
              })()}
            </g>
          )}
          {/* X labels — first and last only */}
          {points.length > 0 && (
            <>
              <text x={PAD_L} y={H - 6} fontSize="10" fill="var(--muted)">
                {points[0].label.split(' ')[0]}
              </text>
              <text x={W - PAD_R} y={H - 6} fontSize="10" fill="var(--muted)" textAnchor="end">
                {points[points.length - 1].label.split(' ')[0]}
              </text>
            </>
          )}
        </svg>
      )}
    </div>
  );
}

// ---------- Goals ----------

function GoalsCard({ goals }: { goals: ReturnType<typeof goalsForInsights> }) {
  return (
    <div className="card">
      <div className="flex justify-between items-end mb-3">
        <h2 className="heading h3-modal">Goals</h2>
        <div className="text-[12px] text-muted tabular">{goals.length} active</div>
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
      <span className="text-muted text-base leading-none opacity-0 group-hover:opacity-100 transition" aria-hidden>{'\u203A'}</span>
    </Link>
  );
}

// ---------- Debts ----------

function DebtsCard({ debts }: { debts: ReturnType<typeof debtsForInsights> }) {
  return (
    <div className="card">
      <div className="flex justify-between items-end mb-3">
        <h2 className="heading h3-modal">Debts</h2>
        <div className="text-[12px] text-muted tabular">{debts.length} active</div>
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
  const trackColor = isOwed ? 'var(--primary)' : 'var(--danger)';
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
      <div className={`w-8 h-8 rounded-[10px] grid place-items-center text-sm font-bold shrink-0 ${chipBg}`}>
        {isOwed ? '\u2191' : '\u2193'}
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
      <span className="text-muted text-base leading-none opacity-0 group-hover:opacity-100 transition" aria-hidden>{'\u203A'}</span>
    </Link>
  );
}

// ---------- Investments ----------

function InvestmentsCard({ investments }: { investments: ReturnType<typeof investmentsForInsights> }) {
  const state = useStore(s => s.state);
  const totalActive = investments.reduce((s, i) => {
    if (i.type === 'dps') {
      const inv = state.investments.find(x => x.id === i.id);
      return s + (inv ? dpsContributedSoFar(inv, state.transactions) : 0);
    }
    return s + (Number(i.principal) || 0);
  }, 0);
  const totalMaturity = investments.reduce((s, i) => s + i.maturityValue, 0);
  const hasAny = investments.length > 0;
  return (
    <div className="card">
      <div className="flex justify-between items-end mb-3 gap-6">
        <h2 className="heading h3-modal">Investments</h2>
        <div className="grid grid-cols-2 gap-x-6 text-right">
          <div>
            <div className="text-[11px] text-muted uppercase tracking-wider font-semibold">Active</div>
            <div className="text-[20px] font-bold tabular text-accent mt-1 leading-none tracking-[-0.02em]">
              {fmtBDT(totalActive)}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-muted uppercase tracking-wider font-semibold">To mature</div>
            <div className="text-[20px] font-bold tabular text-primary mt-1 leading-none tracking-[-0.02em]">
              {hasAny ? fmtBDT(totalMaturity) : '\u2014'}
            </div>
          </div>
        </div>
      </div>
      {investments.length === 0 ? (
        <EmptyState
          message="No active investments."
          cta={{ to: '/investments/add', label: 'Add an investment' }}
        />
      ) : (
        <div className="flex flex-col gap-1">
          {investments.slice(0, 5).map(inv => <InvestmentRow key={inv.id} inv={inv} />)}
        </div>
      )}
    </div>
  );
}

function InvestmentRow({ inv }: { inv: ReturnType<typeof investmentsForInsights>[number] }) {
  const days = inv.daysToMaturity;
  const daysLabel = days <= 0 ? 'Matured' : `${days} ${days === 1 ? 'day' : 'days'}`;
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
          <div className="text-[13px] font-bold tabular text-accent shrink-0">
            {fmtBDT(inv.maturityValue)}
          </div>
        </div>
        <div className="text-[11px] text-muted mt-1 tabular truncate">
          {daysLabel}
          {inv.payoutAccountName ? ` ${MIDDOT} ${inv.payoutAccountName}` : ''}
          {' '}{MIDDOT} {fmtBDT(inv.principal)}
          {' '}{MIDDOT} {inv.rate}% {MIDDOT} {inv.termMonths}mo
        </div>
      </div>
      <span className="text-muted text-base leading-none opacity-0 group-hover:opacity-100 transition" aria-hidden>{'\u203A'}</span>
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
