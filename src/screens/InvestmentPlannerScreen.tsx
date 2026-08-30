/**
 * InvestmentPlannerScreen — list of mock investment plans.
 *
 * 2026-08-30 polish: each card mirrors the real InvestmentsListScreen
 * card (horizontal split, NOW / AT MATURITY on the right, terms on
 * the left) so the two surfaces feel like one product. The only
 * visible difference is a "PLANNED" pill — letting the user tell
 * projections apart from real money at a glance.
 *
 * Sort selector lives in the header. Default: soonest-maturity-first
 * because users care about "what's next", not "what I added first".
 */
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../domain/store';
import {
  INVESTMENT_PLAN_KITS,
  investmentPlanInterest,
  investmentPlanMaturityDate,
  investmentPlanMaturityValue,
  investmentPlanTotalContributed,
  listInvestmentPlans,
} from '../domain/investmentPlans';
import { Button } from '../components/Button';
import { fmtBDT } from '../lib/format';
import { daysBetween, today } from '../domain/math';
import { investmentTypeColor } from '../components/planner/InvestmentTypeBadge';

export function InvestmentPlannerScreen() {
  const navigate = useNavigate();
  const state = useStore(s => s.state);
  const addInvestmentPlan = useStore(s => s.addInvestmentPlan);
  const plans = listInvestmentPlans(state);
  const todayISO = today().toISOString().slice(0, 10);

  function startFromKit(kitId: 'dps' | 'fdr' | 'savings') {
    const kit = INVESTMENT_PLAN_KITS.find(k => k.id === kitId);
    if (!kit) return;
    const id = addInvestmentPlan({
      ...kit.defaults,
      name: kit.name,
    });
    navigate(`/plan/invest/${id}`);
  }

  // Default sort: soonest-maturity-first. Users care about "what's
  // next" more than the order they happened to add things in.
  const sorted = useMemo(() => {
    return [...plans].sort((a, b) => {
      const da = investmentPlanMaturityDate(a)?.getTime() ?? Infinity;
      const db = investmentPlanMaturityDate(b)?.getTime() ?? Infinity;
      return da - db;
    });
  }, [plans]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="heading h1-screen">Investment Planner</h1>
          <div className="text-muted text-[13px] mt-1.5 max-w-prose">
            Sketch a mock DPS, FDR, or savings certificate. Nothing here moves real money — it's a sandbox for "what if I opened a 1-year FDR at 9%?".
          </div>
        </div>
        <Button
          variant="primary"
          onClick={() => navigate('/plan/invest/new')}
        >
          + New mock investment
        </Button>
      </header>

      {/* Empty state — leads with the user's actual question
         ("how much could this earn me?") and surfaces the kit
         projections inline so the math is visible before they tap. */}
      {plans.length === 0 ? (
        <section className="card flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <div className="text-[18px] font-bold tracking-tight text-ink">
              How much could a 1-year FDR at 9% earn you?
            </div>
            <p className="text-sm text-muted leading-relaxed max-w-prose">
              Pick a starter kit to see the projection. Nothing moves real money — it's a sandbox.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {INVESTMENT_PLAN_KITS.map(kit => {
              const projected = investmentPlanMaturityValue({
                ...kit.defaults,
                id: 'preview',
                name: kit.name,
                dirty: false,
                savedAt: null,
              } as Parameters<typeof investmentPlanMaturityValue>[0]);
              const termLabel = kit.defaults.termMonths === 1
                ? '1 month'
                : `${kit.defaults.termMonths} months`;
              return (
                <button
                  key={kit.id}
                  type="button"
                  onClick={() => startFromKit(kit.id)}
                  className="card card-link flex flex-col items-start gap-2 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 relative overflow-hidden"
                >
                  {/* Left-edge colour band signalling type */}
                  <span
                    aria-hidden
                    className="absolute left-0 top-0 bottom-0 w-1"
                    style={{ background: investmentTypeColor(kit.id) }}
                  />
                  <span className="text-[28px] leading-none">{kit.emoji}</span>
                  <div className="text-[13.5px] font-semibold text-ink">{kit.name}</div>
                  <div
                    className="text-[12.5px] font-bold tabular leading-tight"
                    style={{ color: investmentTypeColor(kit.id) }}
                  >
                    → {fmtBDT(projected)} <span className="font-normal text-muted">in {termLabel}</span>
                  </div>
                  <p className="text-[11.5px] text-muted leading-relaxed">{kit.description}</p>
                </button>
              );
            })}
          </div>
        </section>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
            {/* Left column — full-width planned cards stacked. The
                2fr width matches the InvestmentsListScreen layout so
                planned and real cards are visually identical. */}
            <div className="flex flex-col gap-3">
              {sorted.map(plan => (
                <InvestmentPlanCard
                  key={plan.id}
                  plan={plan}
                  todayISO={todayISO}
                  onOpen={() => navigate(`/plan/invest/${plan.id}`)}
                />
              ))}
            </div>

            {/* Right column — Summary sidebar (sticky at lg+). Mirrors
                InvestmentsListScreen's Summary card so the two
                surfaces tell the same "totals on the right" story. */}
            <PlannerSummary plans={sorted} />
          </div>
        </>
      )}
    </div>
  );
}

/* ── Sub-component ──────────────────────────────────────────────── */

/**
 * PlannerSummary — totals sidebar that mirrors the InvestmentsListScreen
 * summary card so planned and real screens share the same shape:
 * "totals on the right, cards stacked on the left".
 *
 * Aggregates every projection's NOW-equivalent (principal, or monthly
 * contribution × completed months for DPS) and the AT MATURITY
 * projection. Splitting the two makes it obvious the difference is
 * "projected growth" — same logic the real screen uses for
 * `showProjection`.
 */
function PlannerSummary({
  plans,
}: {
  plans: ReturnType<typeof listInvestmentPlans>;
}) {
  let totalNow = 0;
  let totalProjected = 0;
  for (const plan of plans) {
    const contributed = investmentPlanTotalContributed(plan);
    const matValue = investmentPlanMaturityValue(plan);
    // For DPS, NOW = what they've actually committed (the principal
    //   line). For FDR / savings, NOW = the principal itself (it's all
    //   locked up on day 0). Mirrors `showBoth` in the card.
    const isDps = plan.type === 'dps';
    const now = isDps ? contributed : contributed;
    totalNow += now;
    totalProjected += matValue;
  }
  const showProjection = totalProjected - totalNow > 0;

  return (
    <section className="card h-fit lg:sticky lg:top-4">
      <h2 className="text-[11px] text-muted uppercase tracking-[0.08em] font-semibold m-0 mb-4">
        Summary
      </h2>
      <div className="flex flex-col gap-5">
        <div>
          <div className="text-[11px] text-muted uppercase tracking-wider font-semibold">
            Your money committed
          </div>
          <div className="text-[26px] font-bold text-accent mt-2 tabular tracking-tight leading-none">
            {fmtBDT(totalNow)}
          </div>
          <div className="text-[11px] text-muted mt-1.5 tabular">
            Across {plans.length} projection{plans.length === 1 ? '' : 's'}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-muted uppercase tracking-wider font-semibold">
            If every term matures
          </div>
          <div className="text-[26px] font-bold text-primary mt-2 tabular tracking-tight leading-none">
            {fmtBDT(totalProjected)}
          </div>
          {showProjection ? (
            <div className="text-[11px] text-muted mt-1.5 tabular">
              Projected growth {fmtBDT(totalProjected - totalNow)}
            </div>
          ) : (
            <div className="text-[11px] text-muted mt-1.5 tabular">
              — No projected growth —
            </div>
          )}
        </div>
      </div>
      <div className="text-xs text-muted mt-5 leading-relaxed">
        <strong className="text-ink">How it works:</strong>{' '}
        <em>Your money committed</em> is the total principal (or
        projected contributions for DPS) across every active plan.{' '}
        <em>If every term matures</em> is what the banks would pay
        out if every projection completed — the projected gains on
        top of your committed money. Nothing here moves real money.
      </div>
    </section>
  );
}

/** Per-type emoji — mirrors `invEmoji` in InvestmentsListScreen so the
 *  planner card reads as a sibling of the real investment card. */
function planEmoji(type: 'dps' | 'fdr' | 'savings'): string {
  if (type === 'dps') return '\u{1F4C5}'; // 📅
  if (type === 'fdr') return '\u{1F3E6}'; // �
  return '\u{1F4DC}';                       // 📜
}

const MIDDOT = '\u00B7';

function InvestmentPlanCard({
  plan, todayISO, onOpen,
}: {
  plan: ReturnType<typeof listInvestmentPlans>[number];
  todayISO: string;
  onOpen: () => void;
}) {
  const matDate = investmentPlanMaturityDate(plan);
  const matValue = investmentPlanMaturityValue(plan);
  const totalContributed = investmentPlanTotalContributed(plan);
  const interest = investmentPlanInterest(plan);
  const bandColor = investmentTypeColor(plan.type);
  const isDps = plan.type === 'dps';

  // Maturity countdown label — mirrors InvestmentsListScreen so the
  // two cards tell the same story. Long durations read as years,
  // short ones as days.
  const days = matDate ? daysBetween(todayISO, matDate.toISOString().slice(0, 10)) : 0;
  const label =
    days > 0
      ? days >= 365
        ? `Matures in ~${(days / 365).toFixed(1)}y`
        : `Matures in ${days}d`
      : days === 0
        ? 'Matures today'
        : matDate
          ? `Matured ${-days}d ago`
          : '';
  const showBoth = isDps && matValue - totalContributed > 1;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="card card-link flex items-stretch gap-5 sm:gap-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 overflow-hidden relative text-left"
    >
      {/* Left-edge PLANNED band — same width/position as the type band
          on the real InvestmentsListScreen card. Uses the per-type
          colour at low opacity so the band still hints at type
          (FDR/DPS/Savings) while the PLANNED pill carries the
          "projection, no real money" message. */}
      <span
        aria-hidden
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ background: bandColor, opacity: 0.55 }}
      />

      {/* Left zone — identity, terms, maturity countdown.
          Mirrors InvestmentsListScreen's padding (py-1, no extra pl)
          so the planned and real cards have the same visual weight. */}
      <div className="flex-1 min-w-0 flex flex-col gap-1.5 py-1">
        {/* Row 1: emoji + (name + type pill + PLANNED pill) on one
            row. Both pills hug the title text on the left. PLANNED
            uses the same outlined treatment as the state stamp so
            it reads as a sibling of the DPS/FDR/Savings pill, not
            a different category. Title is truncated to 1 line so
            the pills always sit against the title baseline. */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-2xl shrink-0 leading-none" aria-hidden>{planEmoji(plan.type)}</span>
          <div className="flex items-center gap-2 min-w-0">
            <div className="font-semibold text-[16px] tracking-tight leading-tight truncate min-w-0">
              {plan.name}
            </div>
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-pill text-[10.5px] font-bold uppercase tracking-wider shrink-0"
              style={{
                background: isDps ? 'var(--primary-soft)' : 'var(--accent-soft)',
                color: isDps ? 'var(--primary)' : 'var(--accent)',
              }}
            >
              {isDps ? 'DPS' : plan.type === 'fdr' ? 'FDR' : 'Savings'}
            </span>
            {/* PLANNED pill — same shape as the type pill but
                outlined (transparent fill, muted color, border)
                so it reads as a state stamp rather than another
                category badge. Sits right next to the type pill
                just like DPS does on the real card. */}
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-pill text-[10.5px] font-bold uppercase tracking-wider shrink-0 border"
              style={{
                background: 'transparent',
                color: 'var(--muted)',
                borderColor: 'var(--border-2)',
              }}
              title="This is a projection — no real money is involved."
            >
              Planned
            </span>
          </div>
        </div>

        {/* Row 2: optional Draft pill (only when the plan has
            unsaved edits). The PLANNED pill moved to row 1. */}
        {plan.dirty && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center px-2 py-0.5 rounded-pill text-[10.5px] font-bold uppercase tracking-wider shrink-0 text-warn">
              Draft
            </span>
          </div>
        )}

        {/* Row 3: rate · term · institution. Rate and term are the
            critical pair — wrap them in a non-shrinking span so a
            long institution doesn't push them off the line. */}
        <div className="text-[12px] text-muted tabular truncate">
          <span className="shrink-0">{plan.rate}% {MIDDOT} {plan.termMonths}mo</span>
          {plan.institution && <span className="opacity-70"> {MIDDOT} {plan.institution}</span>}
        </div>

        {/* Row 4: maturity countdown + contribution/principal +
            interest earned. mt-auto pins to the bottom so cards
            with different title heights still align their last row.
            The interest hint is added vs. the real card so the
            "projected gain" is visible at a glance — the whole
            point of the planner. Each pair (Principal + number) is
            wrapped in a single non-shrinking span so tokens like
            "₹" and "2,00,000" never split across lines. */}
        <div className="text-[12px] text-muted mt-auto flex flex-col gap-0.5">
          {label && <div className="tabular shrink-0">{label}</div>}
          <div className="tabular shrink-0">
            <span>
              {isDps && plan.monthlyContribution
                ? `${fmtBDT(plan.monthlyContribution)}/mo`
                : `Principal ${fmtBDT(totalContributed)}`}
            </span>
            {matDate && (
              <span className="opacity-70">
                {' '}{MIDDOT} Earns <b className="text-ink font-semibold">{fmtBDT(interest)}</b>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Vertical divider between identity and amounts. self-stretch
          + my-1 matches the real card so the divider length is
          identical between planned and real. */}
      <div
        aria-hidden
        className="w-px self-stretch my-1 shrink-0"
        style={{ background: 'var(--border-2)' }}
      />

      {/* Right zone — amounts, right-aligned. NOW is the hero (what
          the user has tied up right now in this projection = the
          contributions or principal they've set aside); AT MATURITY
          is the smaller projected value below. For DPS, NOW collapses
          to the principal since the bank's running value can't be
          computed without a contribution history. sm:min-w-[200px]
          matches the real card. */}
      <div className="flex flex-col gap-3 items-end justify-center shrink-0 sm:min-w-[200px]">
        <div className="flex flex-col items-end leading-none">
          <span className="text-[10px] text-muted uppercase tracking-wider font-semibold">
            {showBoth ? 'Now' : 'Value'}
          </span>
          <span className="font-bold tabular text-[24px] tracking-tight text-accent mt-1.5">
            {fmtBDT(showBoth ? totalContributed : matValue)}
          </span>
        </div>
        {showBoth && (
          <div className="flex flex-col items-end leading-none">
            <span className="text-[10px] text-muted uppercase tracking-wider font-semibold">
              At maturity
            </span>
            <span className="font-bold tabular text-[15px] text-primary mt-1">
              {fmtBDT(matValue)}
            </span>
          </div>
        )}
      </div>
    </button>
  );
}