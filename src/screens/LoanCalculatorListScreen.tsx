/**
 * LoanCalculatorListScreen — list of saved loan projections.
 *
 * Each card surfaces EMI · Total you pay · Total interest. The user
 * taps through to edit inputs or inspect the full amortization table.
 */
import { useNavigate } from 'react-router-dom';
import { useStore } from '../domain/store';
import { listLoanPlans, summariseLoanPlan } from '../domain/loanPlans';
import { Button } from '../components/Button';
import { fmtBDT } from '../lib/format';

export function LoanCalculatorListScreen() {
  const navigate = useNavigate();
  const state = useStore(s => s.state);
  const addLoanPlan = useStore(s => s.addLoanPlan);
  const plans = listLoanPlans(state);

  function startNew() {
    const today = new Date().toISOString().slice(0, 10);
    const id = addLoanPlan({
      name: '',
      principal: 0,
      rate: 0,
      termMonths: 12,
      startDate: today,
    });
    navigate(`/plan/loan/${id}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="heading h1-screen">Loan Calculator</h1>
          <div className="text-muted text-[13px] mt-1.5 max-w-prose">
            Project what a loan will cost. Enter principal, rate, and term — the app fills the amortization table for you.
          </div>
        </div>
        <Button variant="primary" onClick={startNew}>+ New projection</Button>
      </header>

      {plans.length === 0 ? (
        <div className="card flex flex-col gap-3 items-start">
          <div className="text-[15px] font-semibold text-ink">No projections yet</div>
          <p className="text-sm text-muted leading-relaxed max-w-prose">
            Try a sample — 100,000 BDT at 9% for 12 months — and see the EMI + total interest computed live.
          </p>
          <Button variant="primary" onClick={startNew}>Start a projection</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {plans.map(plan => {
            const s = summariseLoanPlan(plan);
            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => navigate(`/plan/loan/${plan.id}`)}
                className="card card-link flex flex-col gap-3 text-left p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                <div className="flex justify-between items-baseline">
                  <div className="text-[15px] font-semibold text-ink truncate">
                    {plan.name || 'Untitled loan'}
                  </div>
                  <div className="text-[10.5px] text-muted">
                    {plan.termMonths} months
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-baseline">
                    <span className="text-[11px] text-muted uppercase tracking-[0.08em] font-semibold">EMI (projection)</span>
                    <span className="text-[18px] font-extrabold tabular text-ink leading-none">{fmtBDT(s.emi)}</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-[11.5px] text-muted">Total you pay</span>
                    <span className="text-[13px] font-semibold tabular text-ink">{fmtBDT(s.totalPaid)}</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-[11.5px] text-muted">Total interest</span>
                    <span className="text-[13px] font-semibold tabular text-ink">{fmtBDT(s.totalInterest)}</span>
                  </div>
                </div>

                {plan.dirty && (
                  <div className="text-[10.5px] font-bold uppercase tracking-[0.04em] text-warn">Unsaved draft</div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}