/**
 * InvestmentPlannerDetailScreen — edit a single mock investment plan.
 *
 * 2026-08-30 polish: the "Projection" card is now a *hero card* —
 * big maturity value, an inline sparkline of month-by-month balance
 * growth (curved for DPS, linear for FDR/savings), and a chip row
 * summarising "you put in / you earn / matures". The form stays
 * below.
 *
 * Auto-close: Save plan now navigates back to the list (the user
 * confirmed the values, the next action is "see what else I have").
 * Reset already navigated; no change there.
 *
 * Layout (top to bottom):
 *   1. Save/Reset toolbar
 *   2. Hero projection card (sparkline + chip row)
 *   3. Form card (name, type, principal / installment, rate, term, dates)
 *   4. Delete affordance (with confirmation)
 */
import { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../domain/store';
import {
  investmentPlanInterest,
  investmentPlanMaturityValue,
  investmentPlanTotalContributed,
} from '../domain/investmentPlans';
import { Button } from '../components/Button';
import { useConfirm } from '../components/ConfirmDialog';
import { Field, Input, Select } from '../components/Field';
import { SaveResetBar } from '../components/planner/SaveResetBar';
import { InvestmentDonut } from '../components/planner/InvestmentDonut';
import { InvestmentTypeBadge } from '../components/planner/InvestmentTypeBadge';
import { fmtBDT, fmtDate } from '../lib/format';
import { cardSurfaceStyle, investmentTone, leftBarClass, toneTextClass } from '../lib/cardSurface';
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

  const [name, setName] = useState(plan.name);
  const [type, setType] = useState<InvestmentType>(plan.type);
  const [principal, setPrincipal] = useState(String(plan.principal ?? ''));
  const [monthlyContribution, setMonthlyContribution] = useState(String(plan.monthlyContribution ?? ''));
  const [rate, setRate] = useState(String(plan.rate));
  const [startDate, setStartDate] = useState(plan.startDate);
  const [termMonths, setTermMonths] = useState(String(plan.termMonths));
  const [institution, setInstitution] = useState(plan.institution ?? '');

  function patch(p: Partial<Omit<typeof plan, 'id' | 'dirty' | 'savedAt'>>) {
    updateInvestmentPlan(plan!.id, p as Parameters<typeof updateInvestmentPlan>[1]);
  }

  // Compute projection against the live form values, not just the
  // stored plan — so the sparkline re-renders on every keystroke.
  const livePlan = {
    ...plan,
    name, type,
    principal: Number(principal) || 0,
    monthlyContribution: Number(monthlyContribution) || 0,
    rate: Number(rate) || 0,
    termMonths: Number(termMonths) || 0,
    startDate,
  };
  const matValue = investmentPlanMaturityValue(livePlan);
  const totalContributed = investmentPlanTotalContributed(livePlan);
  const interest = investmentPlanInterest(livePlan);
  // Per-category tone — DPS / FDR / Savings each carry one color
  // family. Used for wash + bar + hero figure.
  const cardTone = investmentTone(type);
  const matDateISO = (() => {
    const term = Number(termMonths) || 0;
    if (!startDate || term <= 0) return null;
    // Reuse the existing plan's maturity date when the inputs match
    // the saved plan; otherwise derive from inputs.
    const start = new Date(startDate + 'T00:00:00Z');
    if (isNaN(start.getTime())) return null;
    const targetMonth = start.getUTCMonth() + term;
    const yearShift = Math.floor(targetMonth / 12);
    const normalizedMonth = ((targetMonth % 12) + 12) % 12;
    const year = start.getUTCFullYear() + yearShift;
    const lastDay = new Date(Date.UTC(year, normalizedMonth + 1, 0)).getUTCDate();
    const day = Math.min(start.getUTCDate(), lastDay);
    return new Date(Date.UTC(year, normalizedMonth, day)).toISOString().slice(0, 10);
  })();

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="heading h1-screen">Plan</h1>
          <div className="text-muted text-[13px] mt-1.5 max-w-prose">
            Projections only. Nothing is recorded in your ledger — no payout account, no linked transactions.
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={async () => {
              const ok = await confirm({
                title: 'Delete this plan?',
                body: 'The plan is removed. This cannot be undone.',
                confirmLabel: 'Delete',
                danger: true,
              });
              if (ok) {
                removeInvestmentPlan(plan.id);
                navigate('/plan/invest');
              }
            }}
            className="text-[12.5px] font-semibold px-2.5 py-1.5 rounded-btn text-danger hover:bg-danger-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/40 transition"
            aria-label="Delete this plan"
          >
            Delete
          </button>
          <Button variant="ghost" onClick={() => navigate('/plan/invest')}>Back</Button>
        </div>
      </header>

      <SaveResetBar
        dirty={plan.dirty}
        onReset={() => {
          resetInvestmentPlan(plan.id);
          navigate('/plan/invest');
        }}
        onSave={() => {
          saveInvestmentPlan(plan.id);
          navigate('/plan/invest');
        }}
      />

      {/* Hero projection card. Always renders — even with 0 inputs —
         so the user sees the projection react in real time as they
         type. When inputs are missing the sparkline is a flat line
         and the maturity value reads ৳0. The 3px accent bar + wash
         match the planned card on the list screen so detail and list
         read as one product. */}
      <section
        className="card relative overflow-hidden flex flex-col gap-4"
        style={cardSurfaceStyle(cardTone)}
      >
        {/* Left accent bar — shared 3px tone-coloured stripe, matched
            to the plan's category. */}
        <span
          aria-hidden
          className={`absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full pointer-events-none ${leftBarClass(cardTone)}`}
        />
        <div className="flex items-start justify-between gap-3">
          <div className="text-[11px] text-muted uppercase tracking-[0.08em] font-semibold">
            Projection
          </div>
          <InvestmentTypeBadge type={type} />
        </div>

        {/* Hero number */}
        <div>
          <div className={`text-[36px] sm:text-[40px] font-extrabold tracking-[-0.02em] tabular leading-none ${toneTextClass(cardTone)}`}>
            {fmtBDT(matValue)}
          </div>
          <div className="text-[11.5px] text-muted mt-2 uppercase tracking-[0.04em] font-semibold">
            At maturity (projection)
          </div>
        </div>

        {/* Donut + summary. The donut shows the composition of the
            maturity value: the dark ring is your money, the bright
            arc is interest earned. Honest about the 9% FDR case
            where a line chart would have been a flat lie. */}
        <div className="grid grid-cols-[auto_1fr] items-center gap-5">
          <InvestmentDonut
            total={matValue}
            invested={totalContributed}
            interest={interest}
            investedColor="var(--primary)"
            interestColor="var(--accent)"
            size={128}
            strokeWidth={18}
            ariaLabel={
              type === 'dps'
                ? `DPS projection: ${fmtBDT(totalContributed)} of your money, ${fmtBDT(interest)} of interest, total ${fmtBDT(matValue)} over ${Number(termMonths) || 0} months`
                : `${type.toUpperCase()} projection: ${fmtBDT(totalContributed)} of your money, ${fmtBDT(interest)} of interest, total ${fmtBDT(matValue)} over ${Number(termMonths) || 0} months`
            }
          />
          <div className="flex flex-col gap-2.5 min-w-0">
            <LegendRow
              swatch="var(--primary)"
              label="Your money"
              value={fmtBDT(totalContributed)}
              pct={matValue > 0 ? Math.round((totalContributed / matValue) * 100) : 0}
            />
            <LegendRow
              swatch="var(--accent)"
              label="Interest earned"
              value={fmtBDT(interest)}
              pct={matValue > 0 ? Math.round((interest / matValue) * 100) : 0}
              valueClass="text-accent"
            />
            <div className="text-[11px] text-muted mt-0.5">
              Composition at maturity, over {Number(termMonths) || 0} months
            </div>
          </div>
        </div>

        {/* Chip row: you put in / you earn / matures */}
        <div className="flex flex-wrap gap-2">
          <Chip label="You put in" value={fmtBDT(totalContributed)} tone="neutral" />
          <Chip label="You earn" value={fmtBDT(interest)} tone="accent" />
          <Chip
            label="Matures"
            value={matDateISO ? fmtDate(matDateISO) : '—'}
            tone="neutral"
          />
        </div>

        <div className="text-[11px] text-warn pt-1">
          ⓘ This is a projection. Actual bank payouts may differ.
        </div>
      </section>

      <section className="card flex flex-col gap-5">
        <Field label="Name" hint={'Free text. Try "DBBL 1-year FDR" or "BRAC DPS plan".'}>
          <Input
            value={name}
            onChange={e => { setName(e.target.value); patch({ name: e.target.value }); }}
            placeholder="DBBL 1-year FDR"
          />
        </Field>
        <Field label="Type" hint="Pick the scheme you want to plan.">
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

      <section className="text-[11px] text-muted text-center">
        Plans never touch your ledger.
      </section>

      {dialog}
    </div>
  );
}

/* ── Tiny presentational atoms ──────────────────────────────────── */

function LegendRow({
  swatch, label, value, pct, valueClass = 'text-ink',
}: {
  swatch: string;
  label: string;
  value: string;
  pct: number;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <span
        aria-hidden
        className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
        style={{ background: swatch }}
      />
      <div className="flex-1 min-w-0 flex items-baseline justify-between gap-3">
        <span className="text-[12.5px] text-muted truncate">{label}</span>
        <span className={`text-[13px] font-semibold tabular shrink-0 ${valueClass}`}>
          {value}{' '}
          <span className="text-muted font-normal">· {pct}%</span>
        </span>
      </div>
    </div>
  );
}

function Chip({ label, value, tone }: { label: string; value: string; tone: 'neutral' | 'accent' }) {
  const isAccent = tone === 'accent';
  return (
    <div
      className="flex-1 min-w-[120px] rounded-btn px-3 py-2 border border-border flex flex-col gap-0.5"
      style={{
        background: isAccent ? 'var(--accent-soft)' : 'var(--surface-2)',
      }}
    >
      <div className="text-[10px] text-muted uppercase tracking-[0.08em] font-semibold">
        {label}
      </div>
      <div
        className="text-[14px] font-bold tabular leading-tight"
        style={{ color: isAccent ? 'var(--accent)' : 'var(--ink)' }}
      >
        {value}
      </div>
    </div>
  );
}
