/**
 * PlanScreen — hub for the scratchpad planner.
 *
 * Four cards: Investment Planner, Loan Calculator, Month Planner,
 * Event Planner. Each links to its own feature screen. Nothing here
 * writes to the ledger — plans are separate from `state.transactions`.
 *
 * 2026-08-30 polish: the top two cards (Investment + Loan) now surface
 * a tiny aggregate visualisation so the user can see at a glance what
 * their plans are projecting, without opening the planner. The
 * investment card shows a Now-vs-At-Maturity stacked bar; the loan
 * card shows Principal-vs-Interest split. Bottom two cards keep their
 * existing mini-list pattern.
 */
import { Link } from 'react-router-dom';
import { useStore } from '../domain/store';
import * as plans from '../domain/plans';
import {
  investmentPlanMaturityValue,
  investmentPlanTotalContributed,
  listInvestmentPlans,
} from '../domain/investmentPlans';
import {
  listLoanPlans,
  summariseLoanPlan,
} from '../domain/loanPlans';
import { fmtBDT } from '../lib/format';
import { daysBetween, today } from '../domain/math';

export function PlanScreen() {
  const state = useStore(s => s.state);

  const thisMonth = plans.monthKey();
  const thisMonthPlan = plans.getMonthPlan(state, thisMonth);
  const monthItems = thisMonthPlan?.categories ?? [];
  const events = plans.listEventPlans(state);
  const todayISO = today().toISOString().slice(0, 10);

  // ── Investment aggregate (for the chart in card 1) ────────────────
  const investmentPlans = listInvestmentPlans(state);
  let invCommitted = 0;
  let invProjected = 0;
  for (const plan of investmentPlans) {
    invCommitted += investmentPlanTotalContributed(plan);
    invProjected += investmentPlanMaturityValue(plan);
  }
  const invGain = invProjected - invCommitted;
  const invHasPlans = investmentPlans.length > 0;

  // ── Loan aggregate (for the chart in card 2) ──────────────────────
  const loanPlans = listLoanPlans(state);
  // Treat empty drafts as placeholders so the chart doesn't show ৳0.
  const usableLoans = loanPlans.filter(
    p => p.name.trim() || Number(p.principal) > 0 || Number(p.rate) > 0,
  );
  let loanPrincipal = 0;
  let loanInterest = 0;
  let loanEmi = 0;
  for (const plan of usableLoans) {
    const s = summariseLoanPlan(plan);
    loanPrincipal += Math.max(0, Number(plan.principal) || 0);
    loanInterest += Math.max(0, s.totalInterest);
    loanEmi += s.emi;
  }
  const loanTotal = loanPrincipal + loanInterest;
  const loanHasPlans = usableLoans.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="heading h1-screen">Plan</h1>
        <div className="text-muted text-[13px] mt-1.5 max-w-prose">
          Scratchpads for what you intend to spend. Nothing here is recorded in your ledger — it's a way to think ahead.
        </div>
      </header>

      {/* ── Top row: investment + loan (with charts) ──────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          to="/plan/invest"
          className="card card-link flex flex-col gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          <div className="flex justify-between items-start gap-3">
            <div className="min-w-0">
              <div className="text-[11px] text-muted uppercase tracking-[0.08em] font-semibold">Investment Planner</div>
              <div className="font-semibold text-[18px] tracking-tight mt-1.5">Plan an investment</div>
            </div>
            <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill bg-surface-2 text-[10px] font-bold uppercase tracking-[0.04em] text-muted border border-border">
              <span aria-hidden className="w-1 h-1 rounded-full bg-primary" />
              {investmentPlans.length} {investmentPlans.length === 1 ? 'plan' : 'plans'}
            </span>
          </div>

          <p className="text-sm text-muted leading-relaxed">
            Sketch a DPS, FDR, or savings certificate. See the projected maturity value — no real money moves.
          </p>

          {/* Aggregate chart — Now (accent) vs At maturity (primary)
              as a stacked horizontal bar so the user can see the
              projected gain without opening the planner. Only renders
              when there's at least one plan. */}
          {invHasPlans && (
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-[11px] text-muted tabular">
                <span>
                  Now <b className="text-ink font-semibold">{fmtBDT(invCommitted)}</b>
                </span>
                <span>
                  At maturity <b className="text-ink font-semibold">{fmtBDT(invProjected)}</b>
                </span>
              </div>
              <div
                className="flex h-3 rounded-pill overflow-hidden bg-surface-2 border border-border"
                title={`Committed ${fmtBDT(invCommitted)} → projected ${fmtBDT(invProjected)}`}
              >
                <div
                  className="h-full"
                  style={{
                    width: `${(invCommitted / Math.max(1, invProjected)) * 100}%`,
                    background: 'var(--accent)',
                  }}
                />
                <div
                  className="h-full"
                  style={{
                    width: `${(invGain / Math.max(1, invProjected)) * 100}%`,
                    background: 'var(--primary)',
                  }}
                />
              </div>
              {/* Legend */}
              <div className="flex items-center gap-4 text-[11px] text-muted">
                <span className="flex items-center gap-1.5">
                  <span aria-hidden className="w-2.5 h-2.5 rounded-sm" style={{ background: 'var(--accent)' }} />
                  Principal
                </span>
                <span className="flex items-center gap-1.5">
                  <span aria-hidden className="w-2.5 h-2.5 rounded-sm" style={{ background: 'var(--primary)' }} />
                  Projected gain
                </span>
                {invGain > 0 && (
                  <span className="ml-auto font-bold text-primary tabular">
                    +{fmtBDT(invGain)}
                  </span>
                )}
              </div>
            </div>
          )}

          {!invHasPlans && (
            <div className="flex items-center gap-2 text-[11.5px] text-muted">
              <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-muted opacity-50" />
              No plans yet — pick a starter kit on the next screen.
            </div>
          )}
        </Link>

        <Link
          to="/plan/loan"
          className="card card-link flex flex-col gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          <div className="flex justify-between items-start gap-3">
            <div className="min-w-0">
              <div className="text-[11px] text-muted uppercase tracking-[0.08em] font-semibold">Loan Calculator</div>
              <div className="font-semibold text-[18px] tracking-tight mt-1.5">Plan a loan</div>
            </div>
            <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill bg-surface-2 text-[10px] font-bold uppercase tracking-[0.04em] text-muted border border-border">
              <span aria-hidden className="w-1 h-1 rounded-full bg-danger" />
              {usableLoans.length} {usableLoans.length === 1 ? 'projection' : 'projections'}
            </span>
          </div>

          <p className="text-sm text-muted leading-relaxed">
            Enter principal, rate, and term — get an EMI and a full amortization table back. Projection only.
          </p>

          {/* Aggregate chart — Principal (ink) vs Interest (danger)
              as a stacked horizontal bar so the user sees the
              cost-vs-amount split. Only renders when at least one
              usable plan exists. */}
          {loanHasPlans && loanTotal > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-[11px] text-muted tabular">
                <span>
                  Principal <b className="text-ink font-semibold">{fmtBDT(loanPrincipal)}</b>
                </span>
                <span>
                  Total you pay <b className="text-ink font-semibold">{fmtBDT(loanTotal)}</b>
                </span>
              </div>
              <div
                className="flex h-3 rounded-pill overflow-hidden bg-surface-2 border border-border"
                title={`Borrow ${fmtBDT(loanPrincipal)} → pay ${fmtBDT(loanTotal)}`}
              >
                <div
                  className="h-full"
                  style={{
                    width: `${(loanPrincipal / Math.max(1, loanTotal)) * 100}%`,
                    background: 'var(--ink)',
                  }}
                />
                <div
                  className="h-full"
                  style={{
                    width: `${(loanInterest / Math.max(1, loanTotal)) * 100}%`,
                    background: 'var(--danger)',
                  }}
                />
              </div>
              {/* Legend */}
              <div className="flex items-center gap-4 text-[11px] text-muted">
                <span className="flex items-center gap-1.5">
                  <span aria-hidden className="w-2.5 h-2.5 rounded-sm" style={{ background: 'var(--ink)' }} />
                  Principal
                </span>
                <span className="flex items-center gap-1.5">
                  <span aria-hidden className="w-2.5 h-2.5 rounded-sm" style={{ background: 'var(--danger)' }} />
                  Interest
                </span>
                {loanEmi > 0 && (
                  <span className="ml-auto font-bold text-ink tabular">
                    {fmtBDT(loanEmi)} <span className="text-muted font-normal">/mo EMI</span>
                  </span>
                )}
              </div>
            </div>
          )}

          {!loanHasPlans && (
            <div className="flex items-center gap-2 text-[11.5px] text-muted">
              <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-muted opacity-50" />
              No projections yet — start one to see the EMI.
            </div>
          )}
        </Link>
      </div>

      {/* ── Bottom row: month + event (mini-list pattern) ─────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Month Planner card */}
        <Link
          to="/plan/month"
          className="card card-link flex flex-col gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
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
            Fill items by category — or start from a typical set (rent, groceries, utilities, …) and edit the budgets. Save the plan, reset when you want a fresh start — no history kept.
          </p>

          {/* Items list — up to 5 mini-rows showing emoji + name +
              budget. Lets the user see what's in this month's plan
              without opening the planner. Mirrors the event-list
              pattern on the right card so the two cards feel of a
              piece. */}
          {monthItems.length > 0 ? (
            <div className="flex flex-col gap-1.5 -mx-1">
              {monthItems.slice(0, 5).map(cat => (
                <div
                  key={cat.id}
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-input bg-surface-2 border border-border"
                >
                  <span className="text-[16px] shrink-0">{cat.emoji ?? '•'}</span>
                  <span className="text-[13px] font-semibold text-ink truncate flex-1 min-w-0">{cat.name}</span>
                  <span className="shrink-0 text-[12px] font-bold tabular text-ink">
                    {fmtBDT(Number(cat.budget) || 0)}
                  </span>
                </div>
              ))}
              {monthItems.length > 5 && (
                <div className="text-[11px] text-muted text-center pt-1">
                  +{monthItems.length - 5} more
                </div>
              )}
            </div>
          ) : (
            <div className="text-[11.5px] text-muted">Nothing planned yet — open the planner to start.</div>
          )}

          {/* Footer — item count, so even when the list is collapsed
              the user knows how big the plan is. */}
          {monthItems.length > 0 && (
            <div className="pt-3 border-t border-border text-[11.5px] text-muted tabular">
              <span>
                <b className="text-ink">{monthItems.length}</b> {monthItems.length === 1 ? 'item' : 'items'}
              </span>
            </div>
          )}
        </Link>

        {/* Event Planner card */}
        <Link
          to="/plan/event"
          className="card card-link flex flex-col gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
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

/** Sort events by eventDate ascending — earliest first — so the
 *  "next" anchor and the mini-list both show the soonest event. */
function sortByDate<T extends { eventDate: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.eventDate.localeCompare(b.eventDate));
}