/**
 * PlanScreen — hub for the scratchpad planner.
 *
 * Two cards: Month Planner and Event Planner. Each links to its own
 * feature screen. Nothing here writes to the ledger — plans are
 * separate from `state.transactions`.
 *
 * 2026-08-17 polish: each card now carries a hero summary block —
 * Income / Spend / Saved stat tiles for the month, and per-event
 * rows with days-to-go for the events list. The cards still sit in
 * the same two-column grid so the page reads as one cohesive unit
 * even with the added detail.
 */
import { Link } from 'react-router-dom';
import { useStore } from '../domain/store';
import * as plans from '../domain/plans';
import { fmtBDT } from '../lib/format';
import { daysBetween, today } from '../domain/math';

export function PlanScreen() {
  const state = useStore(s => s.state);

  const thisMonth = plans.monthKey();
  const thisMonthPlan = plans.getMonthPlan(state, thisMonth);
  const monthSummary = thisMonthPlan
    ? plans.summariseMonthPlan(thisMonthPlan)
    : null;
  const events = plans.listEventPlans(state);
  const todayISO = today().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="heading h1-screen">Plan</h1>
        <div className="text-muted text-[13px] mt-1.5 max-w-prose">
          Scratchpads for what you intend to spend. Nothing here is recorded in your ledger — it's a way to think ahead.
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Month Planner card */}
        <Link
          to="/plan/month"
          className="card flex flex-col gap-4 hover:border-primary transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          {/* Header row — title left, month chip right */}
          <div className="flex justify-between items-start gap-3">
            <div className="min-w-0">
              <div className="text-[11px] text-muted uppercase tracking-[0.08em] font-semibold">Month Planner</div>
              <div className="font-semibold text-[18px] tracking-tight mt-1.5">Plan my month</div>
            </div>
            <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill bg-surface-2 text-[10px] font-bold uppercase tracking-[0.04em] text-muted border border-border">
              <span aria-hidden className="w-1 h-1 rounded-full bg-primary" />
              {plans.monthLabel(thisMonth)}
            </span>
          </div>

          {/* Description */}
          <p className="text-sm text-muted leading-relaxed">
            Fill items by category. Save the plan, reset when you want a fresh start — no history kept.
          </p>

          {/* Stat tiles — Income / Spend / Saved. Each tile carries a
              label + bold figure, with the spend tile coloured by
              deficit vs on-track status. When there's no plan yet the
              tiles render em-dashes so the layout doesn't shift. */}
          {monthSummary ? (
            <>
              <div className="grid grid-cols-3 gap-2">
                <StatTile
                  label="Income"
                  value={fmtBDT(monthSummary.plannedIncome)}
                  tone="info"
                  empty={monthSummary.plannedIncome === 0}
                />
                <StatTile
                  label="Spend"
                  value={fmtBDT(monthSummary.plannedSpend)}
                  tone={monthSummary.deficit ? 'danger' : monthSummary.overCount > 0 ? 'warn' : 'success'}
                  empty={monthSummary.plannedSpend === 0}
                />
                <StatTile
                  label="Saved"
                  value={fmtBDT(monthSummary.saved)}
                  tone={monthSummary.deficit ? 'danger' : 'success'}
                  empty={monthSummary.plannedIncome === 0 && monthSummary.plannedSpend === 0}
                />
              </div>

              {/* Status footer — short, single-line. Carries the
                  "all on track" / "N over" / deficit variants. */}
              <div className="pt-3 border-t border-border flex flex-wrap gap-x-5 gap-y-1 text-[11.5px] text-muted tabular">
                <span>
                  <b className="text-ink">{monthSummary.count}</b> {monthSummary.count === 1 ? 'item' : 'items'}
                </span>
                {monthSummary.deficit ? (
                  <span className="text-danger font-semibold">
                    over income by {fmtBDT(monthSummary.shortfall)}
                  </span>
                ) : monthSummary.overCount > 0 ? (
                  <span className="text-warn font-semibold">
                    {monthSummary.overCount} over budget
                  </span>
                ) : monthSummary.count > 0 ? (
                  <span className="text-success font-semibold">all on track</span>
                ) : (
                  <span>nothing planned yet</span>
                )}
              </div>
            </>
          ) : (
            <div className="pt-3 border-t border-border text-[11.5px] text-muted">
              Nothing planned yet — open the planner to start.
            </div>
          )}
        </Link>

        {/* Event Planner card */}
        <Link
          to="/plan/event"
          className="card flex flex-col gap-4 hover:border-primary transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          <div className="flex justify-between items-start gap-3">
            <div className="min-w-0">
              <div className="text-[11px] text-muted uppercase tracking-[0.08em] font-semibold">Event Planner</div>
              <div className="font-semibold text-[18px] tracking-tight mt-1.5">Plan an event</div>
            </div>
            <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill bg-surface-2 text-[10px] font-bold uppercase tracking-[0.04em] text-muted border border-border">
              <span aria-hidden className="w-1 h-1 rounded-full bg-primary" />
              {events.length} {events.length === 1 ? 'event' : 'events'}
            </span>
          </div>

          <p className="text-sm text-muted leading-relaxed">
            Weddings, trips, Eid, anything with a date and a budget. Each event is its own plan.
          </p>

          {/* Event list — up to 3 mini-rows showing emoji, name, and
              days-to-go. Compact, sorted upcoming-first. Empty state
              when no events exist. */}
          {events.length > 0 ? (
            <div className="flex flex-col gap-1.5 -mx-1">
              {sortByDate(events).slice(0, 3).map(ev => {
                const days = daysBetween(todayISO, ev.eventDate);
                const daysLabel = days === 0
                  ? 'today'
                  : days === 1
                    ? 'in 1 day'
                    : days > 0
                      ? `in ${days} days`
                      : days === -1
                        ? '1 day ago'
                        : `${Math.abs(days)} days ago`;
                return (
                  <div
                    key={ev.id}
                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-input bg-surface-2 border border-border"
                  >
                    <span className="text-[16px] shrink-0">{ev.emoji ?? '📅'}</span>
                    <span className="text-[13px] font-semibold text-ink truncate flex-1 min-w-0">{ev.name}</span>
                    <span className={`shrink-0 text-[10px] font-bold uppercase tracking-[0.04em] ${
                      days < 0 ? 'text-muted' : days <= 7 ? 'text-warn' : 'text-primary'
                    }`}>
                      {daysLabel}
                    </span>
                  </div>
                );
              })}
              {events.length > 3 && (
                <div className="text-[11px] text-muted text-center pt-1">
                  +{events.length - 3} more
                </div>
              )}
            </div>
          ) : (
            <div className="text-[11.5px] text-muted">No events yet — open the planner to start one.</div>
          )}

          {/* Footer line — only shown when there's at least one
              event so the "next" anchor has something to anchor to. */}
          {events.length > 0 && (
            <div className="pt-3 border-t border-border flex flex-wrap gap-x-5 gap-y-1 text-[11.5px] text-muted tabular">
              <span>
                Next: <b className="text-ink">{sortByDate(events)[0].name}</b>
              </span>
              {(() => {
                const days = daysBetween(todayISO, sortByDate(events)[0].eventDate);
                return (
                  <span>
                    <b className={days < 0 ? 'text-muted' : 'text-primary'}>{Math.abs(days)}</b> {days >= 0 ? 'days away' : 'days ago'}
                  </span>
                );
              })()}
            </div>
          )}
        </Link>
      </div>

      <div className="text-xs text-muted text-center mt-2">
        ⓘ Plans are pure scratch — switch tabs, swap emoji, abandon mid-edit. Nothing here touches your real accounts or transactions.
      </div>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────────── */

/** Small stat tile used in the Month Planner card hero. Carries a
 *  label + bold figure, with the figure colour driven by `tone`:
 *  - info    → primary/info blue
 *  - success → green (saved / on track)
 *  - warn    → yellow (some items over budget)
 *  - danger  → red (deficit, spending more than income) */
function StatTile({ label, value, tone, empty }: {
  label: string;
  value: string;
  tone: 'info' | 'success' | 'warn' | 'danger';
  empty?: boolean;
}) {
  const toneColor = empty
    ? 'var(--muted)'
    : tone === 'info' ? 'var(--info)'
      : tone === 'success' ? 'var(--success-title)'
        : tone === 'warn' ? 'var(--warn)'
          : 'var(--danger-title)';
  return (
    <div
      className="flex flex-col gap-1 px-3 py-2.5 rounded-input border border-border"
      style={{ background: 'var(--surface-2)' }}
    >
      <span className="text-[9.5px] text-muted uppercase tracking-[0.06em] font-bold">
        {label}
      </span>
      <span className="text-[14px] font-bold tabular leading-none" style={{ color: toneColor }}>
        {value}
      </span>
    </div>
  );
}

/** Sort events by eventDate ascending — earliest first — so the
 *  "next" anchor and the mini-list both show the soonest event. */
function sortByDate<T extends { eventDate: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.eventDate.localeCompare(b.eventDate));
}