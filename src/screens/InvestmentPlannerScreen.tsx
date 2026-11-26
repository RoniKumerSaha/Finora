/**
 * InvestmentPlannerScreen — list of mock investment plans.
 *
 * 2026-11-26: the planner now uses the SAME certificate shell as the
 * real Investments screen (`.inv-cert`), so a plan and a holding read
 * as siblings of one document family. The rate seal is replaced by a
 * PLANNED stamp — a plan is a promise, not a contract.
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
import { fmtBDT, fmtDate } from '../lib/format';
import { daysBetween, today } from '../domain/math';
import { formatDuration, formatDurationShort } from '../domain/duration';
import { cardSurfaceStyle, investmentTone, leftBarClass, toneTextClass } from '../lib/cardSurface';
import { Pill } from '../components/Pill';
import { InvestTile } from '../components/InvestLoanTile';

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
      {/* Top-row back link — same arrow text-link used by GoalDetail
          and EventPlanDetail so every "planner" / "goal" surface
          across the app shares one back affordance. Muted by default,
          brightens to ink on hover. */}
      <div>
        <button
          type="button"
          onClick={() => navigate('/plan')}
          className="text-muted text-sm hover:text-ink transition"
        >{'\u2190'} Plans</button>
      </div>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="heading h1-screen">Investment Planner</h1>
          <div className="text-muted text-[13px] mt-1.5 max-w-prose">
            Sketch a DPS, FDR, or savings certificate. Nothing here moves real money — it's a sandbox for "what if I opened a 1-year FDR at 9%?".
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="primary"
            onClick={() => navigate('/plan/invest/new')}
          >
            + New plan
          </Button>
        </div>
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
              const termLabel = formatDuration(kit.defaults.termMonths);
              const cardTone = investmentTone(kit.id as 'dps' | 'fdr' | 'savings');
              return (
                <button
                  key={kit.id}
                  type="button"
                  onClick={() => startFromKit(kit.id)}
                  className="card card-link flex flex-col items-start gap-2 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 relative overflow-hidden"
                  style={cardSurfaceStyle(cardTone)}
                >
                  {/* Left accent bar — 3px tone-coloured stripe, matched
                      to the kit's category (DPS / FDR / Savings). */}
                  <span
                    aria-hidden
                    className={`absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full pointer-events-none ${leftBarClass(cardTone)}`}
                  />
                  <span className="text-[28px] leading-none">
                    <InvestTile size={28} type={kit.id} />
                  </span>
                  <div className="text-[13.5px] font-semibold text-ink">{kit.name}</div>
                  <div
                    className={`text-[12.5px] font-bold tabular leading-tight ${toneTextClass(cardTone)}`}
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
            <div className="flex flex-col gap-4">
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
 * PlannerSummary — the totals certificate, mirroring the real
 * Investments screen's Summary so planned and real screens share one
 * shape: "totals on the right, cards stacked on the left".
 *
 * Aggregates every projection's committed money (principal, or the
 * full DPS contribution over the term) and the AT MATURITY projection.
 * Splitting the two makes it obvious the difference is projected
 * growth.
 */
function PlannerSummary({
  plans,
}: {
  plans: ReturnType<typeof listInvestmentPlans>;
}) {
  let totalNow = 0;
  let totalProjected = 0;
  for (const plan of plans) {
    totalNow += investmentPlanTotalContributed(plan);
    totalProjected += investmentPlanMaturityValue(plan);
  }
  const interest = Math.max(0, totalProjected - totalNow);

  // The per-type breakdown — one line per kind of plan, each in its
  // own tone, so the card says WHERE the money is parked.
  const breakdown = (['dps', 'fdr', 'savings'] as const)
    .map(type => {
      const ofType = plans.filter(p => p.type === type);
      if (ofType.length === 0) return null;
      return {
        type,
        label: planTypeLabel(type),
        tone: investmentTone(type),
        count: ofType.length,
        current: ofType.reduce((s, p) => s + investmentPlanTotalContributed(p), 0),
      };
    })
    .filter((b): b is NonNullable<typeof b> => b !== null);

  return (
    <section className="h-fit lg:sticky lg:top-4">
      <article
        className="inv-cert inv-cert--summary"
        style={{ ['--tone' as string]: 'var(--primary)' }}
      >
        <div className="inv-cert__head">
          <div className="min-w-0">
            <div className="inv-cert__name">Summary</div>
            <div className="inv-cert__serial">
              NO. {String(plans.length).padStart(6, '0')} {MIDDOT} {plans.length} PLANNED {MIDDOT} PROJECTIONS
            </div>
          </div>
          {/* The PLANNED stamp — the summary holds projections, never
              real holdings, so it says so in the same ink the cards
              do: green for an investment. */}
          <div
            className="inv-cert__stamp inv-cert__stamp--planned"
            title="These are projections — no real money is involved."
          >
            Planned
          </div>
        </div>

        <div className="inv-cert__fields inv-cert__fields--stack">
          {breakdown.map(b => (
            <div className="inv-cert__f" key={b.label}>
              <div className="k">
                {b.label} {MIDDOT} {b.count}
              </div>
              <div className="v" style={{ color: `var(--${b.tone})` }}>
                {fmtBDT(b.current)}
              </div>
            </div>
          ))}
        </div>

        <div className="inv-cert__vals">
          <div className="inv-cert__v inv-cert__v--now">
            <div className="k">Committed</div>
            <div className="n">{fmtBDT(totalNow)}</div>
          </div>
          <div className="inv-cert__v inv-cert__v--mat">
            <div className="k">At maturity</div>
            <div className="n">{fmtBDT(totalProjected)}</div>
          </div>
          <div className="inv-cert__grow">
            <div className="gk">Interest if every term completes</div>
            <div className="gn">{fmtBDT(interest)}</div>
          </div>
        </div>

        <div className="inv-cert__note">
          <strong className="text-ink">Committed</strong> is the money
          you would put in across every plan.{' '}
          <strong className="text-ink">At maturity</strong> is what you
          would collect if every term ended. Nothing here moves real
          money.
        </div>
      </article>
    </section>
  );
}

/** Per-type glyph key — mirrors `invKey` in InvestmentsListScreen so the
 *  planner card reads as a sibling of the real investment card. */
const MIDDOT = '\u00B7';

/** The plan's type label — "DPS" / "FDR" / "Savings". */
function planTypeLabel(type: string): string {
  return type === 'dps' ? 'DPS' : type === 'fdr' ? 'FDR' : 'Savings';
}

/**
 * A stable-looking serial number for a plan certificate.
 *
 * Derived from the plan's id so it never changes for a given plan — a
 * serial that shuffled on every render would defeat the point of
 * printing one.
 */
function serialFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) % 999999;
  }
  return String(hash).padStart(6, '0');
}

/**
 * A planned holding — the SAME certificate shell as a real one, so the
 * planner and the Investments screen read as one document family.
 *
 * A plan has no deposits on record, so its ledger shows the two lines
 * a projection CAN state: the START and the MATURES. The rate seal is
 * replaced by a PLANNED stamp — a plan is a promise, not a contract.
 */
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
  const isDps = plan.type === 'dps';
  // Per-category tone — DPS / FDR / Savings each carry one color
  // family, exactly as on the real certificate.
  const cardTone = investmentTone(plan.type);

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
  const timeLeft =
    days > 0
      ? days >= 365
        ? `~${(days / 365).toFixed(1)}y`
        : `${days}d`
      : days === 0
        ? 'Today'
        : 'Matured';

  const monthly = Number(plan.monthlyContribution) || 0;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="block card-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 text-left w-full"
    >
      <article
        className="inv-cert"
        style={{ ['--tone' as string]: `var(--${cardTone})` }}
      >
        {/* The header — name + serial on the left, the PLANNED stamp on
            the right, standing in for the real card's rate seal. */}
        <div className="inv-cert__head">
          <div className="min-w-0">
            <div className="inv-cert__name">{plan.name}</div>
            <div className="inv-cert__serial">
              NO. {serialFor(plan.id)} {MIDDOT} {planTypeLabel(plan.type).toUpperCase()}
              {plan.institution ? ` ${MIDDOT} ${plan.institution.toUpperCase()}` : ''}
              {label ? ` ${MIDDOT} ${label}` : ''}
            </div>
          </div>
          <div
            className="inv-cert__stamp inv-cert__stamp--planned"
            style={{ ['--tone' as string]: 'var(--primary)' }}
            title="This is a projection — no real money is involved."
          >
            Planned
          </div>
        </div>

        {/* The engraved terms. A DPS's money arrives as a monthly
            installment, so its first field names the installment
            instead of mislabelling it as a principal. */}
        <div className="inv-cert__fields">
          <div className="inv-cert__f">
            <div className="k">{isDps ? 'Monthly' : 'Principal'}</div>
            <div className="v">{fmtBDT(isDps ? monthly : totalContributed)}</div>
          </div>
          <div className="inv-cert__f">
            <div className="k">Term</div>
            <div className="v">{formatDurationShort(plan.termMonths)}</div>
          </div>
          <div className="inv-cert__f">
            <div className="k">Time left</div>
            <div className="v">{timeLeft}</div>
          </div>
        </div>

        {/* The ledger — a plan has no deposits on record, so the two
            lines are the START and the MATURES. Same shape as the
            real card, so the height never grows with the term. */}
        <div className="inv-cert__ledger">
          <div className="inv-cert__ledger-head">
            <span className="t">Projection</span>
            <span className="n">
              {isDps ? `${plan.termMonths} installments` : '1 lump sum'}
            </span>
          </div>

          <div className="inv-cert__dline">
            <span className="inv-cert__dk">Starts</span>
            <span className="inv-cert__dd">{fmtDate(plan.startDate)}</span>
            <span className="inv-cert__da">
              {fmtBDT(isDps ? monthly : totalContributed)}
            </span>
          </div>
          <div className="inv-cert__dline inv-cert__dline--next">
            <span className="inv-cert__dk">{days <= 0 ? 'Matured' : 'Matures'}</span>
            <span className="inv-cert__dd">
              {matDate ? fmtDate(matDate.toISOString().slice(0, 10)) : '—'}
            </span>
            <span className="inv-cert__da">{fmtBDT(matValue)}</span>
          </div>

          {/* The tally — the numbers the two date lines cannot carry. */}
          <div className="inv-cert__tally">
            <span className="pip" aria-hidden />
            <span>
              {isDps ? (
                <>
                  <b>{fmtBDT(totalContributed)}</b> over the full term {MIDDOT}{' '}
                  <b>{fmtBDT(interest)}</b> interest
                </>
              ) : (
                <>
                  Lump sum {MIDDOT} <b>{fmtBDT(totalContributed)}</b> locked in at start
                </>
              )}
            </span>
          </div>
        </div>

        {/* The footer — the same three-figure form the real card uses. */}
        <div className="inv-cert__vals">
          <div className="inv-cert__v inv-cert__v--now">
            <div className="k">Committed</div>
            <div className="n">{fmtBDT(totalContributed)}</div>
          </div>
          <div className="inv-cert__grow">
            <div className="gk">Interest</div>
            <div className="gn">{fmtBDT(interest)}</div>
          </div>
          <div className="inv-cert__v inv-cert__v--mat">
            <div className="k">At maturity</div>
            <div className="n">{fmtBDT(matValue)}</div>
          </div>
        </div>

        {/* A dirty plan has unsaved edits — the DRAFT chip rides below
            the footer so it never crowds the title. */}
        {plan.dirty && (
          <div className="mt-2">
            <Pill tone="warn" variant="soft">Draft</Pill>
          </div>
        )}
      </article>
    </button>
  );
}