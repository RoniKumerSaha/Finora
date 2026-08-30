/**
 * InvestmentPlannerScreen — list of mock investment plans.
 *
 * 2026-08-30 polish: each card now opens with the maturity value as
 * the hero number (matching the HomeScreen Stat tiles), a thin
 * progress strip showing elapsed/total months, a per-type colour
 * band, and a compact combined "interest · matures" sub-line. The
 * empty state leads with an answer-first headline and shows the
 * kit projections inline so the user can see the math before
 * opening the form.
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
import { fmtDate } from '../lib/format';
import { today } from '../domain/math';
import { InvestmentTypeBadge, investmentTypeColor } from '../components/planner/InvestmentTypeBadge';
import { InvestmentProgressBar } from '../components/planner/InvestmentProgressBar';
import { SplitBar } from '../components/planner/SplitBar';

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {sorted.map(plan => (
            <InvestmentPlanCard
              key={plan.id}
              plan={plan}
              todayISO={todayISO}
              onOpen={() => navigate(`/plan/invest/${plan.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Sub-component ──────────────────────────────────────────────── */

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
  return (
    <button
      type="button"
      onClick={onOpen}
      className="card card-link relative overflow-hidden flex flex-col gap-3 text-left p-4 pl-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
    >
      {/* Left-edge type band */}
      <span
        aria-hidden
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ background: bandColor }}
      />

      {/* Top row: name + type badge + term chip */}
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0">
          <div className="text-[15px] font-semibold text-ink truncate">{plan.name}</div>
          {plan.institution && (
            <div className="text-[11.5px] text-muted truncate">{plan.institution}</div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10.5px] text-muted font-semibold uppercase tracking-[0.04em]">
            {plan.termMonths} mo
          </span>
          <InvestmentTypeBadge type={plan.type} />
        </div>
      </div>

      {/* Hero number: maturity value */}
      <div className="flex flex-col gap-0.5">
        <div className="text-[10.5px] text-muted uppercase tracking-[0.08em] font-semibold">
          At maturity
        </div>
        <div className="text-[28px] font-bold tracking-[-0.02em] tabular text-ink leading-none">
          {fmtBDT(matValue)}
        </div>
      </div>

      {/* Coin-bar split: your money vs interest earned */}
      <SplitBar
        a={totalContributed}
        b={interest}
        aLabel="Your money"
        bLabel="Interest"
        formatValue={fmtBDT}
      />

      {/* Term progress + matures-on-date */}
      <div className="flex flex-col gap-1.5">
        <InvestmentProgressBar
          startDate={plan.startDate}
          termMonths={plan.termMonths}
          now={todayISO}
        />
        {matDate && (
          <div className="text-[11.5px] text-muted tabular">
            Matures <b className="text-ink font-semibold">{fmtDate(matDate.toISOString().slice(0, 10))}</b>
          </div>
        )}
      </div>

      {plan.dirty && (
        <div className="text-[10.5px] font-bold uppercase tracking-[0.04em] text-warn">
          Unsaved draft
        </div>
      )}
    </button>
  );
}