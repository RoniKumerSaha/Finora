/**
 * PlanScreen — hub for the scratchpad planner.
 *
 * Two cards: Month Planner and Event Planner. Each links to its own
 * feature screen. Nothing here writes to the ledger — plans are
 * separate from `state.transactions`.
 *
 * Visual target: docs/ux-designs/ux-finora-2026-08-17-month-planner/
 * .working/option-G-jars-save.html (jars + save/reset) and
 * .working-events/option-C-timeline.html (timeline cascade).
 */
import { Link } from 'react-router-dom';
import { useStore } from '../domain/store';
import * as plans from '../domain/plans';

export function PlanScreen() {
  const state = useStore(s => s.state);

  const thisMonth = plans.monthKey();
  const thisMonthPlan = plans.getMonthPlan(state, thisMonth);
  const monthSummary = thisMonthPlan
    ? plans.summariseMonthPlan(thisMonthPlan)
    : null;
  const events = plans.listEventPlans(state);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="heading h1-screen">Plan</h1>
        <div className="text-muted text-[13px] mt-1.5 max-w-prose">
          Scratchpads for what you intend to spend. Nothing here is recorded in your ledger — it's a way to think ahead.
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          to="/plan/month"
          className="card flex flex-col gap-3 hover:border-primary transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          <div className="flex justify-between items-start">
            <div>
              <div className="text-[11px] text-muted uppercase tracking-[0.08em] font-semibold">Month Planner</div>
              <div className="font-semibold text-[18px] tracking-tight mt-1.5">Plan my month</div>
            </div>
            <div className="text-2xl">🧾</div>
          </div>
          <p className="text-sm text-muted leading-relaxed">
            Fill items by category. Save the plan, reset when you want a fresh start — no history kept.
          </p>
          <div className="mt-2 pt-3 border-t border-border flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted tabular">
            <span>This month: <b className="text-ink">{plans.monthLabel(thisMonth)}</b></span>
            {monthSummary && (
              <>
                <span>{monthSummary.count} {monthSummary.count === 1 ? 'item' : 'items'}</span>
                <span>{monthSummary.overCount > 0
                  ? <span className="text-danger">{monthSummary.overCount} over</span>
                  : 'all on track'}</span>
              </>
            )}
          </div>
        </Link>

        <Link
          to="/plan/event"
          className="card flex flex-col gap-3 hover:border-primary transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          <div className="flex justify-between items-start">
            <div>
              <div className="text-[11px] text-muted uppercase tracking-[0.08em] font-semibold">Event Planner</div>
              <div className="font-semibold text-[18px] tracking-tight mt-1.5">Plan an event</div>
            </div>
            <div className="text-2xl">📅</div>
          </div>
          <p className="text-sm text-muted leading-relaxed">
            Weddings, trips, Eid, anything with a date and a budget. Each event is its own plan.
          </p>
          <div className="mt-2 pt-3 border-t border-border flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted tabular">
            <span>{events.length} {events.length === 1 ? 'event' : 'events'}</span>
            {events.length > 0 && (
              <span>Next: <b className="text-ink">{events[0].name}</b></span>
            )}
          </div>
        </Link>
      </div>

      <div className="text-xs text-muted text-center mt-2">
        ⓘ Plans are pure scratch — switch tabs, swap emoji, abandon mid-edit. Nothing here touches your real accounts or transactions.
      </div>
    </div>
  );
}
