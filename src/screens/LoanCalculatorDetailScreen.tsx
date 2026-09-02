/**
 * LoanCalculatorDetailScreen — edit a loan projection + amortisation table.
 *
 * Mirrors InvestmentPlannerDetailScreen: edit the four inputs (name,
 * principal, rate, term, start date), see the live summary update,
 * then read the full month-by-month amortisation table below.
 *
 * Layout (top to bottom):
 *   1. Save / Delete toolbar
 *   2. Form card (name, principal, rate, term, start date)
 *   3. Summary card (EMI / Total paid / Total interest)
 *   4. Amortisation table (period, due, payment, interest, principal, balance)
 *
 * The amortisation table is auto-generated on every input change —
 * the same scratchpad pattern as the rest of the Plan module. Up to
 * 60 rows are shown inline; longer terms get a "showing first 60 of N"
 * cap with a note.
 */
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../domain/store';
import { loanAmortization, summariseLoanPlan } from '../domain/loanPlans';
import { Button } from '../components/Button';
import { useConfirm } from '../components/ConfirmDialog';
import { Field, Input } from '../components/Field';
import { SaveResetBar } from '../components/planner/SaveResetBar';
import { InvestmentDonut } from '../components/planner/InvestmentDonut';
import { Stat } from '../components/Stat';
import { fmtBDT } from '../lib/format';

const MAX_INLINE_ROWS = 60;

export function LoanCalculatorDetailScreen() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const state = useStore(s => s.state);
  const updateLoanPlan = useStore(s => s.updateLoanPlan);
  const saveLoanPlan = useStore(s => s.saveLoanPlan);
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
  // the source of truth so the amortisation table reacts automatically.
  // The Save / Delete bar uses `plan.dirty` to decide whether the
  // caps-lock-style "Unsaved changes" pill is showing.
  //
  // We mirror the four numeric fields in local state so the user sees
  // an empty input (not "0") when the underlying value is 0 — the
  // save is gated on a non-zero principal being typed in.
  const [name, setName] = useState(plan.name);
  const [principal, setPrincipal] = useState(
    plan.principal > 0 ? String(plan.principal) : '',
  );
  const [rate, setRate] = useState(
    plan.rate > 0 ? String(plan.rate) : '',
  );
  const [termMonths, setTermMonths] = useState(
    plan.termMonths > 0 ? String(plan.termMonths) : '',
  );

  // Save is gated on name + principal being non-empty. Other fields
  // are required for the projection to make sense (rate / term /
  // date), but we only block on the two the user is most likely to
  // forget to fill in.
  const trimmedName = name.trim();
  const principalValue = Number(principal);
  const isNameValid = trimmedName.length > 0;
  const isPrincipalValid = principalValue > 0;
  const canSave = isNameValid && isPrincipalValid;
  const saveDisabledReason = !isNameValid && !isPrincipalValid
    ? 'Add a name and a principal to save.'
    : !isNameValid
      ? 'Add a name to save.'
      : 'Enter a positive principal to save.';

  const summary = summariseLoanPlan({
    ...plan,
    name,
    principal: principalValue,
    rate: Number(rate) || 0,
    termMonths: Math.max(0, Math.floor(Number(termMonths) || 0)),
  });
  const rows = loanAmortization({
    ...plan,
    name,
    principal: principalValue,
    rate: Number(rate) || 0,
    termMonths: Math.max(0, Math.floor(Number(termMonths) || 0)),
    startDate: plan.startDate,
  });
  const visibleRows = rows.slice(0, MAX_INLINE_ROWS);
  const hiddenCount = Math.max(0, rows.length - visibleRows.length);

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      {/* Top-row back link — same arrow text-link used by every
          "planner" / "goal" surface across the app. Goes back to the
          immediate parent (the calculator list, not the Plan hub) so
          the two-step navigation reads as "← Loan Calculator" here
          and "← Plans" on the list screen itself. Backing out of a
          never-saved projection drops it silently — the user has no
          idea they're about to leave a shell behind, and forcing a
          confirm modal on every Back tap is annoying. A previously-
          saved projection is kept (the user might come back). */}
      <div>
        <button
          type="button"
          onClick={async () => {
            if (plan && !plan.savedAt) {
              removeLoanPlan(plan.id);
            }
            navigate('/plan/loan');
          }}
          className="text-muted text-sm hover:text-ink transition"
        >{'\u2190'} Loan Calculator</button>
      </div>
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="heading h1-screen">Loan projection</h1>
          <div className="text-muted text-[13px] mt-1.5 max-w-prose">
            Edit the four inputs — principal, rate, term, start date — and watch the EMI and amortization table update.</div>
        </div>
      </header>

      {/* Live summary card. Composition donut on the left
          (principal vs interest) so the user can see the cost of the
          loan at a glance; three stat tiles on the right carry the
          precise numbers. Sits ABOVE the form so the user sees the
          projection react to every keystroke before editing. */}
      <section className="card flex flex-col gap-3">
        <div className="text-[11px] text-muted uppercase tracking-[0.08em] font-semibold">Summary (projection)</div>
        <div className="grid grid-cols-[auto_1fr] items-center gap-5">
          <InvestmentDonut
            total={summary.totalPaid}
            invested={Math.max(0, summary.totalPaid - summary.totalInterest)}
            interest={summary.totalInterest}
            investedColor="var(--primary)"
            interestColor="var(--accent)"
            size={120}
            strokeWidth={16}
            ariaLabel={`Loan composition: ${fmtBDT(summary.totalPaid - summary.totalInterest)} of principal, ${fmtBDT(summary.totalInterest)} of interest, total ${fmtBDT(summary.totalPaid)}`}
          />
          <div className="grid grid-cols-3 gap-3 min-w-0">
            <Stat label="EMI" value={fmtBDT(summary.emi)} size="xl" />
            <Stat label="Total you pay" value={fmtBDT(summary.totalPaid)} size="md" />
            <Stat label="Total interest" value={fmtBDT(summary.totalInterest)} size="md" />
          </div>
        </div>
        <div className="text-[11px] text-warn pt-1">
          ⓘ Projection only. Actual loan terms may include fees, insurance, or rounding that change the numbers slightly.
        </div>
      </section>

      <section className="card flex flex-col gap-5">
        <Field label="Name" hint={'Free text. Try "Car loan" or "Personal loan 2026".'}>
          <Input
            value={name}
            onChange={e => { setName(e.target.value); updateLoanPlan(plan.id, { name: e.target.value }); }}
            placeholder="Personal loan"
            autoFocus
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Principal" hint="Total amount borrowed.">
            <Input
              type="number" inputMode="decimal"
              value={principal}
              onChange={e => { setPrincipal(e.target.value); updateLoanPlan(plan.id, { principal: Number(e.target.value) || 0 }); }}
              placeholder="100000"
            />
          </Field>
          <Field label="Annual rate (%)" hint="Annual interest rate. Capped at 0–100%.">
            <Input
              type="number" inputMode="decimal"
              value={rate}
              onChange={e => { setRate(e.target.value); updateLoanPlan(plan.id, { rate: Number(e.target.value) || 0 }); }}
              placeholder="9"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Term (months)" hint="Total number of monthly payments.">
            <Input
              type="number" inputMode="numeric"
              value={termMonths}
              onChange={e => { setTermMonths(e.target.value); updateLoanPlan(plan.id, { termMonths: Number(e.target.value) || 0 }); }}
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

      {/* Save / Delete toolbar. Sticky-bottom on small screens so
         the user can save without scrolling back up — the form is
         taller than one screen on most devices. Identical
         placement to the Investment Planner detail so the two
         "planner" surfaces share one shape. After Save, the user
         is taken back to the list. Delete is the destructive
         action that removes the plan regardless of save state. */}
      <div className="sticky bottom-2 z-10">
        <SaveResetBar
          dirty={plan.dirty}
          canSave={canSave}
          saveDisabledReason={saveDisabledReason}
          onSave={() => {
            saveLoanPlan(plan.id);
            // After Save, take the user back to the list.
            navigate('/plan/loan');
          }}
          onDelete={async () => {
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
          deleteLabel="Delete"
        />
      </div>

      <section className="text-[11px] text-muted text-center">
        Projections never touch your ledger.
      </section>

      {dialog}
    </div>
  );
}