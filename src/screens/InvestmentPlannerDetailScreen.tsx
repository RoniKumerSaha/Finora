/**
 * InvestmentPlannerDetailScreen — edit a single mock investment plan.
 *
 * Mirrors GoalDetailScreen + InvestmentDetailScreen but with no real
 * ledger hooks: there's no payout account, no linked transactions, no
 * status transitions, no record-payout flow. Pure scratch.
 *
 * Layout (top to bottom):
 *   1. Save/Reset toolbar (warn dot + Reset + Save plan)
 *   2. Form card (name, type, principal / installment, rate, term, dates)
 *   3. Live maturity projection card
 *   4. Delete affordance (with confirmation)
 */
import { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../domain/store';
import {
  investmentPlanMaturityDate,
  investmentPlanMaturityValue,
  investmentPlanInterest,
} from '../domain/investmentPlans';
import { Button } from '../components/Button';
import { useConfirm } from '../components/ConfirmDialog';
import { Field, Input, Select } from '../components/Field';
import { SaveResetBar } from '../components/planner/SaveResetBar';
import { fmtBDT } from '../lib/format';
import { addMonthsISO } from '../domain/math';
import type { InvestmentType } from '../domain/types';

export function InvestmentPlannerDetailScreen() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const state = useStore(s => s.state);
  const updateInvestmentPlan = useStore(s => s.updateInvestmentPlan);
  const saveInvestmentPlan = useStore(s => s.saveInvestmentPlan);
  const resetInvestmentPlan = useStore(s => s.resetInvestmentPlan);
  const removeInvestmentPlan = useStore(s => s.removeInvestmentPlan);
  const { confirm, dialog } = useConfirm();

  const plan = useMemo(
    () => state.investmentPlans.find(p => p.id === id),
    [state.investmentPlans, id],
  );

  if (!plan) {
    return (
      <div className="card text-sm text-muted">
        Plan not found.
        <div className="mt-3">
          <Button variant="ghost" onClick={() => navigate('/plan/invest')}>Back to planner</Button>
        </div>
      </div>
    );
  }

  // Local form state mirrors the saved plan. Edits flow through the
  // store on every change so the dirty flag flips immediately — the
  // Save/Reset toolbar reflects the live state.
  const [name, setName] = useState(plan.name);
  const [type, setType] = useState<InvestmentType>(plan.type);
  const [principal, setPrincipal] = useState(String(plan.principal ?? ''));
  const [monthlyContribution, setMonthlyContribution] = useState(String(plan.monthlyContribution ?? ''));
  const [rate, setRate] = useState(String(plan.rate));
  const [startDate, setStartDate] = useState(plan.startDate);
  const [termMonths, setTermMonths] = useState(String(plan.termMonths));
  const [institution, setInstitution] = useState(plan.institution ?? '');

  // Sync local edits into the store on every change so dirty flips
  // and the maturity preview re-renders. We avoid storing the whole
  // object back to avoid losing unrelated fields the user hasn't
  // touched. We narrow `plan` to non-undefined at this point because
  // the early-return above guarantees it.
  function patch(p: Partial<Omit<typeof plan, 'id' | 'dirty' | 'savedAt'>>) {
    updateInvestmentPlan(plan!.id, p as Parameters<typeof updateInvestmentPlan>[1]);
  }

  const matValue = investmentPlanMaturityValue({
    ...plan,
    name, type,
    principal: Number(principal) || 0,
    monthlyContribution: Number(monthlyContribution) || 0,
    rate: Number(rate) || 0,
    termMonths: Number(termMonths) || 0,
    startDate,
  });
  const interest = investmentPlanInterest({
    ...plan,
    principal: Number(principal) || 0,
    monthlyContribution: Number(monthlyContribution) || 0,
    rate: Number(rate) || 0,
    termMonths: Number(termMonths) || 0,
  });
  const matDate = investmentPlanMaturityDate({
    ...plan,
    rate: Number(rate) || 0,
    termMonths: Number(termMonths) || 0,
    startDate,
  });

  function maturityDateHint(): string {
    if (!matDate) return '';
    return addMonthsISO(startDate, Number(termMonths) || 0);
  }

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="heading h1-screen">Mock investment</h1>
          <div className="text-muted text-[13px] mt-1.5 max-w-prose">
            Projections only. Nothing is recorded in your ledger — no payout account, no linked transactions.
          </div>
        </div>
        <Button variant="ghost" onClick={() => navigate('/plan/invest')}>Back</Button>
      </header>

      <SaveResetBar
        dirty={plan.dirty}
        onReset={() => {
          resetInvestmentPlan(plan.id);
          navigate('/plan/invest');
        }}
        onSave={() => {
          saveInvestmentPlan(plan.id);
        }}
      />

      <section className="card flex flex-col gap-5">
        <Field label="Name" hint={'Free text. Try "DBBL 1-year FDR" or "BRAC DPS plan".'}>
          <Input
            value={name}
            onChange={e => { setName(e.target.value); patch({ name: e.target.value }); }}
            placeholder="DBBL 1-year FDR"
          />
        </Field>
        <Field label="Type" hint="Pick the scheme you want to mock.">
          <Select
            value={type}
            onChange={e => { const v = e.target.value as InvestmentType; setType(v); patch({ type: v }); }}
          >
            <option value="dps">DPS — monthly deposit scheme</option>
            <option value="fdr">FDR — fixed deposit receipt</option>
            <option value="savings">Other (savings certificate / term deposit)</option>
          </Select>
        </Field>

        {type === 'dps' ? (
          <Field label="Monthly installment" hint="How much you plan to deposit each month.">
            <Input
              type="number" inputMode="decimal"
              value={monthlyContribution}
              onChange={e => { setMonthlyContribution(e.target.value); patch({ monthlyContribution: Number(e.target.value) || 0 }); }}
              placeholder="5000"
            />
          </Field>
        ) : (
          <Field label="Principal" hint="Total lump sum you'd lock into the deposit.">
            <Input
              type="number" inputMode="decimal"
              value={principal}
              onChange={e => { setPrincipal(e.target.value); patch({ principal: Number(e.target.value) || 0 }); }}
              placeholder="100000"
            />
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Annual rate (%)" hint="Annual interest rate. Capped at 0–100%.">
            <Input
              type="number" inputMode="decimal"
              value={rate}
              onChange={e => { setRate(e.target.value); patch({ rate: Number(e.target.value) || 0 }); }}
              placeholder="8.5"
            />
          </Field>
          <Field label="Term (months)" hint="Use the same number of months as your bank contract.">
            <Input
              type="number" inputMode="numeric"
              value={termMonths}
              onChange={e => { setTermMonths(e.target.value); patch({ termMonths: Number(e.target.value) || 0 }); }}
              placeholder="12"
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date" hint="When the deposit would land.">
            <Input
              type="date"
              value={startDate}
              onChange={e => { setStartDate(e.target.value); patch({ startDate: e.target.value }); }}
            />
          </Field>
          <Field label="Institution" hint="Bank or NBFI holding this investment (optional).">
            <Input
              value={institution}
              onChange={e => { setInstitution(e.target.value); patch({ institution: e.target.value }); }}
              placeholder="DBBL"
            />
          </Field>
        </div>
      </section>

      {/* Live projection card — recalculates on every keystroke so the
         user sees the maturity value evolve as they tweak inputs. */}
      <section className="card flex flex-col gap-3">
        <div className="text-[11px] text-muted uppercase tracking-[0.08em] font-semibold">Projection</div>
        <div className="flex justify-between items-baseline">
          <div className="text-[11.5px] text-muted">At maturity</div>
          <div className="text-[28px] font-extrabold tabular text-ink leading-none">{fmtBDT(matValue)}</div>
        </div>
        <div className="flex justify-between items-baseline">
          <div className="text-[11.5px] text-muted">Interest earned (projection)</div>
          <div className="text-[14px] font-bold tabular text-ink">{fmtBDT(interest)}</div>
        </div>
        <div className="flex justify-between items-baseline">
          <div className="text-[11.5px] text-muted">Maturity date (projection)</div>
          <div className="text-[12.5px] font-semibold text-ink">{maturityDateHint() || '—'}</div>
        </div>
        <div className="text-[11px] text-warn pt-1">
          ⓘ This is a projection. Actual bank payouts may differ.
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <Button
          variant="danger"
          onClick={async () => {
            const ok = await confirm({
              title: 'Delete this mock investment?',
              body: 'The plan is removed. This cannot be undone.',
              confirmLabel: 'Delete',
              danger: true,
            });
            if (ok) {
              removeInvestmentPlan(plan.id);
              navigate('/plan/invest');
            }
          }}
        >
          Delete plan
        </Button>
        <div className="text-[11px] text-muted text-center">
          Mock plans never touch your ledger.
        </div>
      </section>

      {dialog}
    </div>
  );
}