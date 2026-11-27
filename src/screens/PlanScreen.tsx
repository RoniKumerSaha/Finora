/**
 * PlanScreen — the scratchpad hub.
 *
 * Plan is a HUB, but a hub of PAPERS. Each planner is its own
 * perforated sheet — the same family as the certificates and the
 * ledger sheets elsewhere in the app — laid out two by two. A plan
 * is scratch, not an instrument, so the sheets take the plain wash
 * and let each planner's own tone ride on its figures.
 *
 * Four sheets:
 *   - Investments → one line per plan (name + rate), then the
 *     total projected at maturity.
 *   - Loans       → one line per projection (name + APR · term),
 *     then the combined monthly EMI.
 *   - This month  → one line per budget jar (emoji + name +
 *     budget), then the total budgeted.
 *   - Events      → one line per event (emoji + name + date), then
 *     the days to the next one.
 *
 * Every sheet is a link to the planner behind it, and its figures
 * collapse to a dash when the planner is empty — the sheet still
 * shows, because the user needs to see the planner EXISTS.
 */
import { Link } from 'react-router-dom';
import { useStore } from '../domain/store';
import * as plans from '../domain/plans';
import {
  investmentPlanMaturityValue,
  listInvestmentPlans,
} from '../domain/investmentPlans';
import { listLoanPlans, summariseLoanPlan } from '../domain/loanPlans';
import { fmtBDT, fmtDate } from '../lib/format';
import { daysBetween, today } from '../domain/math';

/** The tone each planner's figures wear. */
type PlannerTone = 'primary' | 'danger' | 'accent' | 'info';

export function PlanScreen() {
  const state = useStore(s => s.state);

  // ── Investments ─────────────────────────────────────────────────
  const investmentPlans = listInvestmentPlans(state);
  let invProjected = 0;
  for (const plan of investmentPlans) {
    invProjected += investmentPlanMaturityValue(plan);
  }

  // ── Loans ───────────────────────────────────────────────────────
  const loanPlans = listLoanPlans(state);
  // Count every saved loan (whether named or still "Untitled loan") —
  // a saved shell is a real plan on disk and should reflect in the
  // sidebar tally. Only drafts are excluded.
  const savedLoans = loanPlans.filter(p => !p.dirty);
  let loanEmi = 0;
  for (const plan of savedLoans) {
    loanEmi += summariseLoanPlan(plan).emi;
  }

  // ── Month ───────────────────────────────────────────────────────
  const thisMonth = plans.monthKey();
  const thisMonthPlan = plans.getMonthPlan(state, thisMonth);
  const monthItems = thisMonthPlan?.categories ?? [];
  const monthBudget = monthItems.reduce(
    (s, c) => s + (Number(c.budget) || 0), 0,
  );

  // ── Events ──────────────────────────────────────────────────────
  const events = plans.listEventPlans(state);
  const sortedEvents = [...events].sort(
    (a, b) => a.eventDate.localeCompare(b.eventDate),
  );
  const todayISO = today().toISOString().slice(0, 10);
  const nextEvent = sortedEvents.find(
    e => daysBetween(todayISO, e.eventDate) >= 0,
  ) ?? sortedEvents[0];
  const daysToNext = nextEvent
    ? daysBetween(todayISO, nextEvent.eventDate)
    : null;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="heading h1-screen">Plan</h1>
        <div className="text-muted t-13 mt-1.5 max-w-prose">
          Scratchpads for what you intend to spend. Nothing here is recorded in your ledger — it's a way to think ahead.
        </div>
      </header>

      <div className="plan-grid">
        {/* ═══ INVESTMENTS ═══════════════════════════════════════ */}
        <PlanPaper
          to="/plan/invest"
          name="Investments"
          serial={`${investmentPlans.length} ${investmentPlans.length === 1 ? 'PLAN' : 'PLANS'} · SCRATCHPAD`}
          tone="primary"
          empty={investmentPlans.length === 0 ? 'No plans yet' : undefined}
          tallyLabel="Projected at maturity"
          tallyValue={investmentPlans.length > 0 ? fmtBDT(invProjected) : '—'}
          hideTally={investmentPlans.length === 1}
        >
          {investmentPlans.map(plan => (
            <div className="plan-paper__line" key={plan.id}>
              <span className="plan-paper__k">
                {plan.name}
                <span className="plan-paper__sub">
                  {plan.rate}%{plan.termMonths > 0 ? ` · ${plan.termMonths}mo` : ''}
                </span>
              </span>
              <span className="plan-paper__v plan-paper__v--primary">
                {fmtBDT(investmentPlanMaturityValue(plan))}
              </span>
            </div>
          ))}
        </PlanPaper>

        {/* ═══ LOANS ═════════════════════════════════════════════ */}
        <PlanPaper
          to="/plan/loan"
          name="Loans"
          serial={`${savedLoans.length} ${savedLoans.length === 1 ? 'PROJECTION' : 'PROJECTIONS'} · SCRATCHPAD`}
          tone="danger"
          empty={savedLoans.length === 0 ? 'No projections yet' : undefined}
          tallyLabel="Monthly EMI"
          tallyValue={savedLoans.length > 0 ? fmtBDT(loanEmi) : '—'}
          hideTally={savedLoans.length === 1}
        >
          {savedLoans.map(plan => (
            <div className="plan-paper__line" key={plan.id}>
              <span className="plan-paper__k">
                {plan.name}
                <span className="plan-paper__sub">
                  {plan.rate}%{plan.termMonths > 0 ? ` · ${plan.termMonths}mo` : ''}
                </span>
              </span>
              <span className="plan-paper__v plan-paper__v--danger">
                {fmtBDT(summariseLoanPlan(plan).emi)}
              </span>
            </div>
          ))}
        </PlanPaper>

        {/* ═══ THIS MONTH ════════════════════════════════════════ */}
        <PlanPaper
          to="/plan/month"
          name="This month"
          serial={`${plans.monthLabel(thisMonth).toUpperCase()} · ${monthItems.length} ${monthItems.length === 1 ? 'ITEM' : 'ITEMS'}`}
          tone="accent"
          empty={monthItems.length === 0 ? 'Nothing planned yet' : undefined}
          tallyLabel="Budgeted"
          tallyValue={monthItems.length > 0 ? fmtBDT(monthBudget) : '—'}
          hideTally={monthItems.length === 1}
        >
          {monthItems.map(cat => (
            <div className="plan-paper__line" key={cat.id}>
              <span className="plan-paper__k">
                {cat.emoji ? `${cat.emoji} ` : ''}{cat.name}
              </span>
              <span className="plan-paper__v plan-paper__v--accent">
                {fmtBDT(Number(cat.budget) || 0)}
              </span>
            </div>
          ))}
        </PlanPaper>

        {/* ═══ EVENTS ═════════════════════════════════════════════ */}
        <PlanPaper
          to="/plan/event"
          name="Events"
          serial={`${events.length} ${events.length === 1 ? 'EVENT' : 'EVENTS'} · SCRATCHPAD`}
          tone="info"
          empty={events.length === 0 ? 'No events yet' : undefined}
          tallyLabel="Next event"
          tallyValue={
            nextEvent
              ? daysToNext === 0
                ? 'today'
                : `${Math.abs(daysToNext!)} ${Math.abs(daysToNext!) === 1 ? 'day' : 'days'}`
              : '—'
          }
        >
          {sortedEvents.map(event => (
            <div className="plan-paper__line" key={event.id}>
              <span className="plan-paper__k">
                {event.emoji ? `${event.emoji} ` : ''}{event.name}
                <span className="plan-paper__sub">{fmtDate(event.eventDate)}</span>
              </span>
              <span className="plan-paper__v plan-paper__v--info">
                {fmtBDT(Number(event.budget) || 0)}
              </span>
            </div>
          ))}
        </PlanPaper>
      </div>

      <div className="t-12 text-muted text-center mt-2">
        ⓘ Plans are pure scratch — switch tabs, swap emoji, abandon mid-edit. Nothing here touches your real accounts or transactions.
      </div>
    </div>
  );
}

/* ── The sheet ─────────────────────────────────────────────────── */

function PlanPaper({
  to, name, serial, tone, empty, tallyLabel, tallyValue, hideTally, children,
}: {
  to: string;
  name: string;
  serial: string;
  tone: PlannerTone;
  /** Shown in place of the item lines when the planner is empty. */
  empty?: string;
  tallyLabel: string;
  tallyValue: string;
  /** Drop the tally when it would only repeat the single line above. */
  hideTally?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <section className="plan-paper" style={{ ['--tone' as string]: `var(--${tone})` }}>
      <Link
        to={to}
        className="plan-paper__link"
        aria-label={`${name} — open the planner`}
      >
        <div className="plan-paper__head">
          <div className="min-w-0">
            <div className="plan-paper__name">{name}</div>
            <div className="plan-paper__serial">{serial}</div>
          </div>
          <span className="debt-cert__stamp debt-cert__stamp--planned">Planned</span>
        </div>

        <div className="plan-paper__rule" />

        {empty ? (
          <div className="plan-paper__empty">{empty}</div>
        ) : (
          <div className="plan-paper__lines">{children}</div>
        )}

        {/* The tally sits BELOW the lines whether or not there are
            any, so an empty planner still states its one number as a
            dash rather than collapsing the sheet to a caption.

            But it is dropped when the board holds exactly ONE item:
            the tally is a sum across the lines, so with a single line
            it repeats that line's own figure verbatim — the same
            number printed twice on one card, which is exactly the
            redundancy the rest of the app was cleaned of. The tally
            earns its place only once it adds something the lines
            do not already say. */}
        {!hideTally && (
          <div className="plan-paper__tally">
            <span className="k">{tallyLabel}</span>
            <span className={`v plan-paper__tally-value plan-paper__v--${tone}`}>
              {tallyValue}
            </span>
          </div>
        )}
      </Link>
    </section>
  );
}
