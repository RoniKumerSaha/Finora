/**
 * InvestmentPlannerScreen — list of mock investment plans.
 *
 * Mirrors the design of GoalsListScreen / EventPlanScreen: a header,
 * a card grid of saved plans, and a "New mock investment" CTA. Each
 * card previews name + type pill + projected maturity value + "at
 * maturity" tag (always labelled "(projection)" — never real money).
 *
 * Empty state explains that nothing here moves real money and
 * surfaces the three preset kits (DPS, FDR, savings) as one-tap
 * starters.
 */
import { useNavigate } from 'react-router-dom';
import { useStore } from '../domain/store';
import {
  INVESTMENT_PLAN_KITS,
  getInvestmentPlan,
  investmentPlanInterest,
  investmentPlanMaturityDate,
  investmentPlanMaturityValue,
  listInvestmentPlans,
} from '../domain/investmentPlans';
import { Button } from '../components/Button';
import { fmtBDT } from '../lib/format';
import { daysBetween, today } from '../domain/math';

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

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-3">
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

      {/* Empty state — explains the "no real money" rule and surfaces the
         three starter kits as one-tap presets. Mirrors the
         "first-run empty state" pattern from PRD §9.13. */}
      {plans.length === 0 ? (
        <div className="card flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <div className="text-[15px] font-semibold text-ink">Plan your first mock investment</div>
            <p className="text-sm text-muted leading-relaxed max-w-prose">
              Pick a starter kit below or start from a blank form. Every figure on this page is a projection, not real money in your account.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {INVESTMENT_PLAN_KITS.map(kit => (
              <button
                key={kit.id}
                type="button"
                onClick={() => startFromKit(kit.id)}
                className="card card-link flex flex-col items-start gap-2 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                <span className="text-[26px] leading-none">{kit.emoji}</span>
                <div className="text-[13.5px] font-semibold text-ink">{kit.name}</div>
                <p className="text-[11.5px] text-muted leading-relaxed">{kit.description}</p>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {plans.map(plan => (
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
  plan: ReturnType<typeof getInvestmentPlan> extends infer T ? NonNullable<T> : never;
  todayISO: string;
  onOpen: () => void;
}) {
  const mat = investmentPlanMaturityDate(plan);
  const days = mat ? daysBetween(todayISO, mat.toISOString().slice(0, 10)) : 0;
  const matValue = investmentPlanMaturityValue(plan);
  const interest = investmentPlanInterest(plan);
  const typeLabel = plan.type.toUpperCase();
  return (
    <button
      type="button"
      onClick={onOpen}
      className="card card-link flex flex-col gap-3 text-left p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
    >
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0">
          <div className="text-[15px] font-semibold text-ink truncate">{plan.name}</div>
          {plan.institution && (
            <div className="text-[11.5px] text-muted truncate">{plan.institution}</div>
          )}
        </div>
        <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-pill bg-surface-2 text-[10px] font-bold uppercase tracking-[0.04em] text-muted border border-border">
          {typeLabel}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between items-baseline">
          <span className="text-[11px] text-muted uppercase tracking-[0.08em] font-semibold">At maturity (projection)</span>
        </div>
        <div className="text-[24px] font-extrabold tabular text-ink leading-none">
          {fmtBDT(matValue)}
        </div>
        <div className="text-[11.5px] text-muted">
          Interest: <b className="text-ink">{fmtBDT(interest)}</b>
          {mat && (
            <>
              {' · '}
              {days >= 0
                ? <>matures in <b className="text-ink">{days}</b> {days === 1 ? 'day' : 'days'}</>
                : <>matured <b className="text-ink">{Math.abs(days)}</b> {Math.abs(days) === 1 ? 'day' : 'days'} ago</>}
            </>
          )}
        </div>
      </div>

      {plan.dirty && (
        <div className="text-[10.5px] font-bold uppercase tracking-[0.04em] text-warn">Unsaved draft</div>
      )}
    </button>
  );
}