/**
 * InvestmentPlannerNewScreen — "new mock investment" landing page.
 *
 * Mirrors the empty-state on the list screen: a starter-kit chooser
 * plus an empty-form option. Selecting a kit creates the plan and
 * navigates to the detail screen; choosing "blank" does the same.
 */
import { useNavigate } from 'react-router-dom';
import { useStore } from '../domain/store';
import { INVESTMENT_PLAN_KITS } from '../domain/investmentPlans';
import { Button } from '../components/Button';

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
      <header>
        <h1 className="heading h1-screen">New mock investment</h1>
        <div className="text-muted text-[13px] mt-1.5 max-w-prose">
          Pick a starter kit to fill in sensible defaults, or start from a blank form.
        </div>
      </header>

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

      <div className="flex justify-center">
        <Button variant="ghost" onClick={startBlank}>Start from a blank form</Button>
      </div>
    </div>
  );
}