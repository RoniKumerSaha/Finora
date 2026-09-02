/**
 * InvestmentPlannerNewScreen — "new mock investment" landing page.
 *
 * 2026-08-30 polish: matches the list-screen empty state — answer-
 * first headline, three kit cards with inline projections, and a
 * blank-form fallback below.
 */
import { useNavigate } from 'react-router-dom';
import { useStore } from '../domain/store';
import { INVESTMENT_PLAN_KITS, investmentPlanMaturityValue } from '../domain/investmentPlans';
import { Button } from '../components/Button';
import { fmtBDT } from '../lib/format';
import { InvestmentTypeBadge, investmentTypeColor } from '../components/planner/InvestmentTypeBadge';
import { InvestTile } from '../components/InvestLoanTile';
import type { InvestmentPlan } from '../domain/types';

export function InvestmentPlannerNewScreen() {
  const navigate = useNavigate();
  const addInvestmentPlan = useStore(s => s.addInvestmentPlan);

  function startFromKit(kitId: 'dps' | 'fdr' | 'savings') {
    const kit = INVESTMENT_PLAN_KITS.find(k => k.id === kitId);
    if (!kit) return;
    const id = addInvestmentPlan({
      ...kit.defaults,
      name: kit.name,
    });
    navigate(`/plan/invest/${id}`);
  }

  function startBlank() {
    const today = new Date().toISOString().slice(0, 10);
    const id = addInvestmentPlan({
      type: 'fdr',
      principal: 0,
      rate: 0,
      startDate: today,
      termMonths: 12,
      institution: '',
      notes: '',
      name: '',
    });
    navigate(`/plan/invest/${id}`);
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* Top-row back link — same arrow text-link used by every
          "planner" / "goal" surface across the app. Goes back to the
          immediate parent (the planner list, not the Plan hub) so
          the two-step navigation reads as "← Investment Planner"
          here and "← Plans" on the list screen itself. */}
      <div>
        <button
          type="button"
          onClick={() => navigate('/plan/invest')}
          className="text-muted text-sm hover:text-ink transition"
        >{'\u2190'} Investment Planner</button>
      </div>
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="heading h1-screen">New plan</h1>
          <div className="text-muted text-[13px] mt-1.5 max-w-prose">
            Pick a starter kit to fill in sensible defaults, or start from a blank form.
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {INVESTMENT_PLAN_KITS.map(kit => {
          // Preview projection against the kit's defaults so the
          // user can see the answer before tapping. Cast through
          // unknown — the function only reads the projection-relevant
          // fields, never touches type-narrowed mocks.
          const projected = investmentPlanMaturityValue({
            ...kit.defaults,
            id: 'preview',
            name: kit.name,
            dirty: false,
            savedAt: null,
          } as InvestmentPlan);
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
              <span
                aria-hidden
                className="absolute left-0 top-0 bottom-0 w-1"
                style={{ background: investmentTypeColor(kit.id) }}
              />
              <div className="flex items-start justify-between w-full">
                <span className="text-[28px] leading-none">
                  <InvestTile size={28} type={kit.id} />
                </span>
                <InvestmentTypeBadge type={kit.id} />
              </div>
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

      <div className="flex justify-center">
        <Button variant="ghost" onClick={startBlank}>Start from a blank form</Button>
      </div>
    </div>
  );
}
