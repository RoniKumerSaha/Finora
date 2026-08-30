/**
 * LoanCalculatorDetailScreen — edit a loan projection + amortisation table.
 *
 * Mirrors InvestmentPlannerDetailScreen: edit the four inputs (name,
 * principal, rate, term, start date), see the live summary update,
 * then read the full month-by-month amortisation table below.
 *
 * Layout (top to bottom):
 *   1. Save/Reset toolbar
 *   2. Form card (name, principal, rate, term, start date)
 *   3. Summary card (EMI / Total paid / Total interest)
 *   4. Amortisation table (period, due, payment, interest, principal, balance)
 *   5. Delete affordance
 *
 * The amortisation table is auto-generated on every input change —
 * the same scratchpad pattern as the rest of the Plan module. Up to
 * 60 rows are shown inline; longer terms get a "showing first 60 of N"
 * cap with a note.
 */
import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../domain/store';
import { loanAmortization, summariseLoanPlan } from '../domain/loanPlans';
import { Button } from '../components/Button';
import { useConfirm } from '../components/ConfirmDialog';
import { Field, Input } from '../components/Field';
import { SaveResetBar } from '../components/planner/SaveResetBar';
import { fmtBDT } from '../lib/format';

const MAX_INLINE_ROWS = 60;

export function LoanCalculatorDetailScreen() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const state = useStore(s => s.state);
  const updateLoanPlan = useStore(s => s.updateLoanPlan);
  const saveLoanPlan = useStore(s => s.saveLoanPlan);
  const resetLoanPlan = useStore(s => s.resetLoanPlan);
  const removeLoanPlan = useStore(s => s.removeLoanPlan);
  const { confirm, dialog } = useConfirm();

  const plan = useMemo(
    () => state.loanPlans.find(p => p.id === id),
    [state.loanPlans, id],
  );

  if (!plan) {
    return (
      <div className="card text-sm text-muted">
        Plan not found.
        <div className="mt-3">
          <Button variant="ghost" onClick={() => navigate('/plan/loan')}>Back to calculator</Button>
        </div>
      </div>
    );
  }

  // Live edits flow into the store on every keystroke. The store is
  // the source of truth so the dirty flag, save/reset bar, and the
  // amortisation table all react automatically.
  const summary = summariseLoanPlan({
    ...plan,
    // The summary reads the live store values; here we just trigger
    // a recompute by re-using the existing object.
  });
  const rows = loanAmortization(plan);
  const visibleRows = rows.slice(0, MAX_INLINE_ROWS);
  const hiddenCount = Math.max(0, rows.length - visibleRows.length);

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="heading h1-screen">Loan projection</h1>
          <div className="text-muted text-[13px] mt-1.5 max-w-prose">
            Edit the four inputs — principal, rate, term, start date — and watch the EMI and amortization table update.
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={async () => {
              const ok = await confirm({
                title: 'Delete this projection?',
                body: 'The plan is removed. This cannot be undone.',
                confirmLabel: 'Delete',
                danger: true,
              });
              if (ok) {
                removeLoanPlan(plan.id);
                navigate('/plan/loan');
              }
            }}
            className="text-[12.5px] font-semibold px-2.5 py-1.5 rounded-btn text-danger hover:bg-danger-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/40 transition"
            aria-label="Delete this projection"
          >
            Delete
          </button>
          <Button variant="ghost" onClick={() => navigate('/plan/loan')}>Back</Button>
        </div>
      </header>

      <SaveResetBar
        dirty={plan.dirty}
        onReset={() => {
          resetLoanPlan(plan.id);
          navigate('/plan/loan');
        }}
        onSave={() => {
          // 2026-08-30: auto-close after save. The user has confirmed
          // the values; the next thing they want to do is see this
          // alongside their other projections on the list.
          saveLoanPlan(plan.id);
          navigate('/plan/loan');
        }}
      />

      <section className="card flex flex-col gap-5">
        <Field label="Name" hint={'Free text. Try "Car loan" or "Personal loan 2026".'}>
          <Input
            value={plan.name}
            onChange={e => updateLoanPlan(plan.id, { name: e.target.value })}
            placeholder="Personal loan"
            autoFocus
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Principal" hint="Total amount borrowed.">
            <Input
              type="number" inputMode="decimal"
              value={String(plan.principal)}
              onChange={e => updateLoanPlan(plan.id, { principal: Number(e.target.value) || 0 })}
              placeholder="100000"
            />
          </Field>
          <Field label="Annual rate (%)" hint="Annual interest rate. Capped at 0–100%.">
            <Input
              type="number" inputMode="decimal"
              value={String(plan.rate)}
              onChange={e => updateLoanPlan(plan.id, { rate: Number(e.target.value) || 0 })}
              placeholder="9"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Term (months)" hint="Total number of monthly payments.">
            <Input
              type="number" inputMode="numeric"
              value={String(plan.termMonths)}
              onChange={e => updateLoanPlan(plan.id, { termMonths: Number(e.target.value) || 0 })}
              placeholder="12"
            />
          </Field>
          <Field label="First payment date" hint="When the first EMI is due.">
            <Input
              type="date"
              value={plan.startDate}
              onChange={e => updateLoanPlan(plan.id, { startDate: e.target.value })}
            />
          </Field>
        </div>
      </section>

      {/* Live summary card */}
      <section className="card flex flex-col gap-3">
        <div className="text-[11px] text-muted uppercase tracking-[0.08em] font-semibold">Summary (projection)</div>
        <div className="grid grid-cols-3 gap-4">
          <Stat label="EMI" value={fmtBDT(summary.emi)} emphasis />
          <Stat label="Total you pay" value={fmtBDT(summary.totalPaid)} />
          <Stat label="Total interest" value={fmtBDT(summary.totalInterest)} />
        </div>
        <div className="text-[11px] text-warn pt-1">
          ⓘ Projection only. Actual loan terms may include fees, insurance, or rounding that change the numbers slightly.
        </div>
      </section>

      {/* Amortization table */}
      <section className="card flex flex-col gap-3">
        <div className="text-[11px] text-muted uppercase tracking-[0.08em] font-semibold">Amortization table</div>
        {rows.length === 0 ? (
          <div className="text-sm text-muted">Enter a principal and term to see the breakdown.</div>
        ) : (
          <>
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <table className="w-full text-[12.5px] tabular">
                <thead>
                  <tr className="text-[10.5px] uppercase tracking-[0.06em] text-muted border-b border-border">
                    <th className="px-3 py-2 text-left font-semibold">Period</th>
                    <th className="px-3 py-2 text-left font-semibold">Due</th>
                    <th className="px-3 py-2 text-right font-semibold">Payment</th>
                    <th className="px-3 py-2 text-right font-semibold">Interest</th>
                    <th className="px-3 py-2 text-right font-semibold">Principal</th>
                    <th className="px-3 py-2 text-right font-semibold">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map(row => (
                    <tr key={row.period} className="border-b border-border-2">
                      <td className="px-3 py-2 text-left text-ink">{row.period}</td>
                      <td className="px-3 py-2 text-left text-muted">{row.dueDate}</td>
                      <td className="px-3 py-2 text-right text-ink">{fmtBDT(row.payment)}</td>
                      <td className="px-3 py-2 text-right text-muted">{fmtBDT(row.interest)}</td>
                      <td className="px-3 py-2 text-right text-ink">{fmtBDT(row.principalPaid)}</td>
                      <td className="px-3 py-2 text-right text-ink">{fmtBDT(row.remaining)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {hiddenCount > 0 && (
              <div className="text-[11.5px] text-muted text-center pt-1">
                Showing first {MAX_INLINE_ROWS} of {rows.length} rows.
              </div>
            )}
          </>
        )}
      </section>

      <section className="text-[11px] text-muted text-center">
        Projections never touch your ledger.
      </section>

      {dialog}
    </div>
  );
}

function Stat({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-[11px] text-muted uppercase tracking-[0.08em] font-semibold">{label}</div>
      <div className={[
        'tabular leading-none',
        emphasis ? 'text-[28px] font-extrabold text-ink' : 'text-[14px] font-semibold text-ink',
      ].join(' ')}>{value}</div>
    </div>
  );
}