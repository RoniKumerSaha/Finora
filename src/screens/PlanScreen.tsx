/**
 * PlanScreen — hub for the scratchpad planner.
 *
 * 2026-09-01 redesign: Variant A ("one number, one chip").
 * Each planner is a single horizontal row — icon, title, count,
 * and the one number that matters. No chart, no body copy, no
 * footer. The planner screen behind each row carries the detail.
 *
 * Four cards:
 *   - Investments → projected at maturity (cool→warm gradient)
 *   - Loans       → monthly EMI
 *   - Month       → total budgeted this month
 *   - Events      → days to the next event
 *
 * Empty state for each card collapses the number but keeps the
 * row visible — the user still needs to see the planner exists.
 */
import { Link } from 'react-router-dom';
import { useStore } from '../domain/store';
import * as plans from '../domain/plans';
import {
  investmentPlanMaturityValue,
  listInvestmentPlans,
} from '../domain/investmentPlans';
import { listLoanPlans, summariseLoanPlan } from '../domain/loanPlans';
import { fmtBDT } from '../lib/format';
import { daysBetween, today } from '../domain/math';
import {
  NavInvestments, NavPlan, Clock, Bank,
} from '../components/icons/Icons';

export function PlanScreen() {
  const state = useStore(s => s.state);

  // ── Investments ─────────────────────────────────────────────────
  const investmentPlans = listInvestmentPlans(state);
  let invProjected = 0;
  for (const plan of investmentPlans) {
    invProjected += investmentPlanMaturityValue(plan);
  }
  const invHasPlans = investmentPlans.length > 0;

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
  const loanHasPlans = savedLoans.length > 0;
  const loanCount = savedLoans.length;

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
  const nextEvent = sortedEvents.find(
    e => daysBetween(today().toISOString().slice(0, 10), e.eventDate) >= 0,
  ) ?? sortedEvents[0];
  const daysToNext = nextEvent
    ? daysBetween(today().toISOString().slice(0, 10), nextEvent.eventDate)
    : null;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="heading h1-screen">Plan</h1>
        <div className="text-muted text-[13px] mt-1.5 max-w-prose">
          Scratchpads for what you intend to spend. Nothing here is recorded in your ledger — it's a way to think ahead.
        </div>
      </header>

      <div className="flex flex-col gap-3">
        <PlanRow
          to="/plan/invest"
          icon={<NavInvestments className="w-5 h-5" />}
          iconTone="primary"
          title="Investments"
          sub={`${investmentPlans.length} ${investmentPlans.length === 1 ? 'plan' : 'plans'}`}
          number={invHasPlans ? fmtBDT(invProjected) : '—'}
          numberTone="gradient"
          numberSuffix="at maturity"
        />
        <PlanRow
          to="/plan/loan"
          icon={<Bank className="w-5 h-5" />}
          iconTone="danger"
          title="Loans"
          sub={`${loanCount} ${loanCount === 1 ? 'projection' : 'projections'}`}
          number={loanHasPlans ? fmtBDT(loanEmi) : '—'}
          numberTone="danger"
          numberSuffix="/mo EMI"
        />
        <PlanRow
          to="/plan/month"
          icon={<NavPlan className="w-5 h-5" />}
          iconTone="accent"
          title="This month"
          sub={plans.monthLabel(thisMonth)}
          number={monthItems.length > 0 ? fmtBDT(monthBudget) : '—'}
          numberTone="info"
          numberSuffix={monthItems.length > 0
            ? `budgeted · ${monthItems.length} ${monthItems.length === 1 ? 'item' : 'items'}`
            : 'nothing planned'}
        />
        <PlanRow
          to="/plan/event"
          icon={<Clock className="w-5 h-5" />}
          iconTone="primary"
          title="Events"
          sub={`${events.length} ${events.length === 1 ? 'event' : 'events'}`}
          number={nextEvent
            ? daysToNext === 0 ? 'today' : String(Math.abs(daysToNext!))
            : '—'}
          numberTone="warn"
          numberSuffix={nextEvent
            ? daysToNext === 0
              ? nextEvent.name
              : daysToNext! > 0
                ? `days away · ${nextEvent.name}`
                : `days ago · ${nextEvent.name}`
            : 'no events yet'}
        />
      </div>

      <div className="text-xs text-muted text-center mt-2">
        ⓘ Plans are pure scratch — switch tabs, swap emoji, abandon mid-edit. Nothing here touches your real accounts or transactions.
      </div>
    </div>
  );
}

/* ── Row primitive ──────────────────────────────────────────────── */

const ICON_TONE: Record<'primary' | 'accent' | 'danger', string> = {
  primary: 'text-primary',
  accent:  'text-accent',
  danger:  'text-danger',
};

function PlanRow({
  to, icon, iconTone, title, sub, number, numberTone, numberSuffix,
}: {
  to: string;
  icon: React.ReactNode;
  iconTone: 'primary' | 'accent' | 'danger';
  title: string;
  sub: string;
  number: string;
  numberTone: 'gradient' | 'ink' | 'warn' | 'danger' | 'info';
  numberSuffix: string;
}) {
  const numberStyle =
    numberTone === 'gradient'
      ? {
          backgroundImage: 'linear-gradient(90deg, var(--primary), var(--accent))',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
        }
      : undefined;
  return (
    <Link
      to={to}
      className="card card-link flex items-center gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
    >
      <div
        className={[
          'w-10 h-10 rounded-input flex items-center justify-center shrink-0',
          'bg-surface-2',
        ].join(' ')}
      >
        {/* Wrapper stays neutral; the icon itself picks up the type
            tone via `currentColor` (we set it on a child span so the
            wrapper chrome stays uniform across rows). */}
        <span className={ICON_TONE[iconTone]}>
          {icon}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-bold tracking-tight">{title}</div>
        <div className="text-[11.5px] text-muted mt-0.5 truncate">{sub}</div>
      </div>
      <div className="text-right shrink-0">
        <div
          className={[
            'text-[18px] font-extrabold tracking-tight tabular',
            numberTone === 'ink'    ? 'text-ink'    : '',
            numberTone === 'warn'   ? 'text-warn'   : '',
            numberTone === 'danger' ? 'text-danger' : '',
            numberTone === 'info'   ? 'text-info'   : '',
          ].filter(Boolean).join(' ')}
          style={numberStyle}
        >
          {number}
        </div>
        <div className="text-[11px] text-muted mt-0.5 truncate max-w-[220px]">
          {numberSuffix}
        </div>
      </div>
    </Link>
  );
}