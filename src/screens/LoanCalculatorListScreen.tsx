/**
 * LoanCalculatorListScreen — list of saved loan projections.
 *
 * Each card surfaces EMI as the hero number, then a coin-bar split
 * showing "your principal vs interest you'll pay". The same visual
 * pattern as the Investment Planner list, but the storytelling is
 * inverted: for a loan, the bar shows the cost of borrowing, not the
 * gain from saving.
 *
 * Tap through to edit inputs or inspect the full amortization table.
 */
import { useNavigate } from 'react-router-dom';
import { useStore } from '../domain/store';
import { listLoanPlans, summariseLoanPlan } from '../domain/loanPlans';
import { Button } from '../components/Button';
import { fmtBDT } from '../lib/format';
import { SplitBar } from '../components/planner/SplitBar';

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
            const principal = Math.max(0, Number(plan.principal) || 0);
            const interest = Math.max(0, s.totalInterest);
            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => navigate(`/plan/loan/${plan.id}`)}
                className="card card-link relative overflow-hidden flex flex-col gap-3 text-left p-4 pl-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                {/* Left-edge danger-tinted band — loan cards are
                    about cost, so we use the danger accent rather
                    than the type-band pattern. */}
                <span
                  aria-hidden
                  className="absolute left-0 top-0 bottom-0 w-1"
                  style={{ background: 'var(--danger)' }}
                />

                {/* Top row: name + term chip */}
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <div className="text-[15px] font-semibold text-ink truncate">
                      {plan.name || 'Untitled loan'}
                    </div>
                    {plan.rate > 0 && (
                      <div className="text-[11.5px] text-muted tabular">
                        {plan.rate}% APR
                      </div>
                    )}
                  </div>
                  <span className="text-[10.5px] text-muted font-semibold uppercase tracking-[0.04em] shrink-0">
                    {plan.termMonths} mo
                  </span>
                </div>

                {/* Hero number: EMI per month */}
                <div className="flex flex-col gap-0.5">
                  <div className="text-[10.5px] text-muted uppercase tracking-[0.08em] font-semibold">
                    Monthly EMI
                  </div>
                  <div className="text-[28px] font-bold tracking-[-0.02em] tabular text-ink leading-none">
                    {fmtBDT(s.emi)}
                  </div>
                </div>

                {/* Coin-bar split: principal vs interest */}
                <SplitBar
                  a={principal}
                  b={interest}
                  aLabel="Principal"
                  bLabel="Interest"
                  aColor="var(--primary)"
                  bColor="var(--danger)"
                  formatValue={fmtBDT}
                />

                {/* Footer: total you pay */}
                <div className="text-[11.5px] text-muted tabular pt-0.5">
                  Total you pay <b className="text-ink font-semibold">{fmtBDT(s.totalPaid)}</b>
                </div>

                {plan.dirty && (
                  <div className="text-[10.5px] font-bold uppercase tracking-[0.04em] text-warn">
                    Unsaved draft
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
