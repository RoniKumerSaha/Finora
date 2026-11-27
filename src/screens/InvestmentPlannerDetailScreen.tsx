/**
 * InvestmentPlannerDetailScreen — a plan, read as a PROJECTED
 * certificate.
 *
 * A plan is a PROMISE, not a contract, so this screen is the same
 * document family as the real Investments screen (`.inv-cert`) with
 * two differences that matter:
 *
 *   - the rate SEAL is replaced by a PLANNED stamp, because there is
 *     no bank on the other side of this piece of paper yet;
 *   - there is no deposit ledger, because nothing has been paid. What
 *     the certificate carries instead is the SCHEDULE — the plan for
 *     what would happen, month by month, if every installment were
 *     paid on time;
 *   - there is NO progress bar. A plan has paid nothing, so its rail
 *     could only ever measure elapsed time — and elapsed time is not
 *     progress. The plan's timing is stated in words: when it starts,
 *     when it matures, and how far today sits from that end.
 *
 * The screen is both a document and an editor: the certificate sits
 * on top and re-renders on every keystroke, so the user watches the
 * projection answer back as they type. The form is below it.
 *
 * Layout:
 *   1. Back link + header
 *   2. THE PROJECTED CERTIFICATE
 *        - head: name, serial, PLANNED stamp
 *        - engraved terms: monthly / principal, term, rate
 *        - the dates: starts, matures, and where today sits
 *        - the three values: committed, interest, at maturity
 *        - the SCHEDULE: what you would pay, and when it lands
 *        - the footnote: the formula, spelled out
 *   3. THE FORM (name, type, amount, rate, term, dates)
 *   4. The sticky Save / Delete bar
 */
import { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../domain/store';
import {
  investmentPlanInterest,
  investmentPlanMaturityValue,
  investmentPlanTotalContributed,
  projectionBreakdown,
  projectionSeries,
} from '../domain/investmentPlans';
import { Button } from '../components/Button';
import { useConfirm } from '../components/ConfirmDialog';
import { Field, Input } from '../components/Field';
import { DurationField } from '../components/DurationField';
import { SaveResetBar } from '../components/planner/SaveResetBar';
import { fmtBDT, fmtDate } from '../lib/format';
import { formatDuration } from '../domain/duration';
import { investmentTone } from '../lib/cardSurface';
import { daysBetween, today } from '../domain/math';
import type { InvestmentType } from '../domain/types';

const MIDDOT = '\u00B7';

/** The document's serial number — a stable hash of the plan's id. */
function serialFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) % 999999;
  }
  return String(hash).padStart(6, '0');
}

/** The type as the document names it. */
function typeLabel(type: InvestmentType): string {
  return type === 'dps' ? 'DPS' : type === 'fdr' ? 'FDR' : 'SAVINGS';
}

/** Each investment type wears its own tone. */
function toneFor(type: InvestmentType): string {
  return type === 'dps' ? 'var(--primary)' : type === 'fdr' ? 'var(--accent)' : 'var(--info)';
}

/** The three kinds of instrument, and what each one is for. */
const TYPES: { id: InvestmentType; name: string; sub: string }[] = [
  { id: 'dps', name: 'DPS', sub: 'Monthly' },
  { id: 'fdr', name: 'FDR', sub: 'Lump-sum' },
  { id: 'savings', name: 'Savings', sub: 'Interest-bearing' },
];

/**
 * How long is left, in the unit a reader would use. Mirrors the real
 * investment certificate — years for a term measured in years, but
 * days and months for the short ones.
 */
function remainingLabel(days: number): string {
  const left = Math.abs(Math.round(days));
  if (left >= 365) return `~${(left / 365).toFixed(1)}Y`;
  if (left >= 60) return `~${Math.round(left / 30)}MO`;
  return `~${left}D`;
}

export function InvestmentPlannerDetailScreen() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const state = useStore(s => s.state);
  const updateInvestmentPlan = useStore(s => s.updateInvestmentPlan);
  const saveInvestmentPlan = useStore(s => s.saveInvestmentPlan);
  const removeInvestmentPlan = useStore(s => s.removeInvestmentPlan);
  const { confirm, dialog } = useConfirm();

  const plan = useMemo(
    () => state.investmentPlans.find(p => p.id === id),
    [state.investmentPlans, id],
  );

  if (!plan) {
    return (
      <div className="card t-13 text-muted">
        Plan not found.
        <div className="mt-3">
          <Button variant="ghost" onClick={() => navigate('/plan/invest')}>Back to planner</Button>
        </div>
      </div>
    );
  }

  const [name, setName] = useState(plan.name);
  const [type, setType] = useState<InvestmentType>(plan.type);
  // Numbers default to empty strings so the user sees a blank form
  // (instead of "0" pre-filled in every box). The Save button stays
  // disabled until the user types both a name AND a non-zero amount.
  const [principal, setPrincipal] = useState(
    plan.principal && plan.principal > 0 ? String(plan.principal) : '',
  );
  const [monthlyContribution, setMonthlyContribution] = useState(
    plan.monthlyContribution && plan.monthlyContribution > 0 ? String(plan.monthlyContribution) : '',
  );
  const [rate, setRate] = useState(
    plan.rate && plan.rate > 0 ? String(plan.rate) : '',
  );
  const [startDate, setStartDate] = useState(plan.startDate);
  const [termMonths, setTermMonths] = useState(
    plan.termMonths && plan.termMonths > 0 ? String(plan.termMonths) : '',
  );
  const [institution, setInstitution] = useState(plan.institution ?? '');

  // Save is gated on name + amount. "Amount" depends on the plan
  // type — DPS uses monthly contribution, FDR / savings use principal.
  const trimmedName = name.trim();
  const amountValue = type === 'dps'
    ? Number(monthlyContribution)
    : Number(principal);
  const isNameValid = trimmedName.length > 0;
  const isAmountValid = amountValue > 0;
  const canSave = isNameValid && isAmountValid;
  const saveDisabledReason = !isNameValid && !isAmountValid
    ? 'Add a name and an amount to save.'
    : !isNameValid
      ? 'Add a name to save.'
      : 'Enter a positive amount to save.';

  function patch(p: Partial<Omit<typeof plan, 'id' | 'dirty' | 'savedAt'>>) {
    updateInvestmentPlan(plan!.id, p as Parameters<typeof updateInvestmentPlan>[1]);
  }

  // Compute the projection against the LIVE form values, not just the
  // stored plan — so the certificate re-renders on every keystroke.
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
  const isDps = type === 'dps';

  // Per-type tone — DPS / FDR / Savings each carry one colour family,
  // exactly as on the real certificate.
  const cardTone = investmentTone(type);
  const toneVar = `var(--${cardTone})`;

  // ── The maturity date ──────────────────────────────────────────
  // `investmentPlanMaturityDate` reads the STORED plan, but the form
  // may have moved ahead of it — so the date is derived from the live
  // values instead, the same way the value is.
  const matDate = (() => {
    const term = Number(termMonths) || 0;
    if (!startDate || term <= 0) return null;
    const start = new Date(startDate + 'T00:00:00Z');
    if (isNaN(start.getTime())) return null;
    const targetMonth = start.getUTCMonth() + term;
    const yearShift = Math.floor(targetMonth / 12);
    const normalizedMonth = ((targetMonth % 12) + 12) % 12;
    const year = start.getUTCFullYear() + yearShift;
    const lastDay = new Date(Date.UTC(year, normalizedMonth + 1, 0)).getUTCDate();
    const day = Math.min(start.getUTCDate(), lastDay);
    return new Date(Date.UTC(year, normalizedMonth, day));
  })();
  const matDateISO = matDate ? matDate.toISOString().slice(0, 10) : null;

  // ── The timing ─────────────────────────────────────────────────
  // The promise in time: the day the plan starts, the day it would
  // mature, and how far today sits from that end. A plan is a
  // projection, so there is NO rail here — a bar on a plan could only
  // measure elapsed time, and elapsed time is not progress. The facts
  // are stated in words instead.
  const todayISO = today().toISOString().slice(0, 10);
  const daysLeft = matDateISO
    ? daysBetween(todayISO, matDateISO)
    : 0;

  // ── The schedule ───────────────────────────────────────────────
  // The month-by-month plan. For a DPS this is the installment
  // ledger — what you would pay each month, what the balance would
  // be, and how much of it is interest. For a lump sum it is a
  // single line: the deposit lands on day one and the interest
  // accrues behind it.
  const schedule = (() => {
    const total = projectionSeries(livePlan);
    const { interest: intSeries } = projectionBreakdown(livePlan);
    const months = Math.max(0, Math.floor(Number(termMonths) || 0));
    const rows: Array<{
      month: number;
      dateISO: string | null;
      paid: number;
      value: number;
      earned: number;
    }> = [];

    const monthDate = (n: number): string | null => {
      if (!startDate) return null;
      const s = new Date(startDate + 'T00:00:00Z');
      if (isNaN(s.getTime())) return null;
      const target = s.getUTCMonth() + n;
      const yearShift = Math.floor(target / 12);
      const normalized = ((target % 12) + 12) % 12;
      const year = s.getUTCFullYear() + yearShift;
      const lastDay = new Date(Date.UTC(year, normalized + 1, 0)).getUTCDate();
      const day = Math.min(s.getUTCDate(), lastDay);
      return new Date(Date.UTC(year, normalized, day)).toISOString().slice(0, 10);
    };

    if (isDps) {
      // The FIRST installment lands on the start date; installment n
      // lands n−1 months later. The balance is read at month n, so
      // `projectionSeries` index n corresponds to installment n.
      for (let m = 1; m <= months; m += 1) {
        rows.push({
          month: m,
          dateISO: monthDate(m - 1),
          paid: Number(monthlyContribution) || 0,
          value: total[m] ?? 0,
          earned: intSeries[m] ?? 0,
        });
      }
    } else {
      rows.push({
        month: 0,
        dateISO: startDate || null,
        paid: Number(principal) || 0,
        value: total[0] ?? 0,
        earned: intSeries[0] ?? 0,
      });
    }
    return rows;
  })();

  const firstScheduleDate = schedule[0]?.dateISO ?? null;
  const lastScheduleDate = schedule[schedule.length - 1]?.dateISO ?? null;

  return (
    <div className="flex flex-col gap-5 max-w-4xl pb-24">
      {/* Top-row back link — same arrow text-link used by every
          "planner" / "goal" surface across the app. Goes back to the
          immediate parent (the planner list, not the Plan hub) so
          the two-step navigation reads as "← Investment Planner"
          here and "← Plans" on the list screen itself. Backing out
          of a never-saved plan drops it silently — the user has no
          idea they're about to leave a shell behind, and forcing a
          confirm modal on every Back tap is annoying. A previously-
          saved plan is kept (the user might come back to it). */}
      <div>
        <button
          type="button"
          onClick={async () => {
            if (plan && !plan.savedAt) {
              removeInvestmentPlan(plan.id);
            }
            navigate('/plan/invest');
          }}
          className="text-muted t-13 hover:text-ink transition"
        >{'\u2190'} Investment Planner</button>
      </div>

      <header>
        <h1 className="heading h1-screen">Plan</h1>
      </header>

      {/* ═══ THE PROJECTED CERTIFICATE ═══════════════════════════ */}
      <section className="inv-cert" style={{ ['--tone' as string]: toneVar }}>
        <div className="inv-cert__head">
          <div className="min-w-0">
            <div className="inv-cert__name">{trimmedName || 'Untitled plan'}</div>
            <div className="inv-cert__serial">
              {[
                `NO. ${serialFor(plan.id)}`,
                typeLabel(type),
                institution.trim() ? institution.trim().toUpperCase() : null,
                matDateISO ? `MATURES IN ${remainingLabel(daysLeft)}` : null,
              ].filter(Boolean).join(` ${MIDDOT} `)}
            </div>
          </div>
          {/* The PLANNED stamp — the planner's stand-in for the real
              card's rate seal. A plan is a promise, not a contract,
              so it prints with a dashed border. The WORD stays grey;
              the border carries the plan's tone. */}
          <div
            className="inv-cert__stamp inv-cert__stamp--planned"
            style={{ ['--tone' as string]: toneVar }}
            title="This is a projection — no real money is involved."
          >
            Planned
          </div>
        </div>

        {/* The engraved terms — the same three fields the real
            certificate carries, so the two read as one family. A
            DPS's money arrives as a monthly installment, so its
            first field names the installment instead of mislabelling
            it as a principal. */}
        <div className="inv-cert__fields">
          <div className="inv-cert__f">
            <div className="k">{isDps ? 'Monthly' : 'Principal'}</div>
            <div className="v">
              {fmtBDT(isDps ? Number(monthlyContribution) || 0 : Number(principal) || 0)}
            </div>
          </div>
          <div className="inv-cert__f">
            <div className="k">Term</div>
            <div className="v">{formatDuration(Number(termMonths) || 0)}</div>
          </div>
          <div className="inv-cert__f">
            <div className="k">Rate</div>
            <div className="v">{Number(rate) || 0}% / yr</div>
          </div>
        </div>

        {/* The dates — the promise, in words. A plan is a PROJECTION,
            so it gets NO progress bar: a plan has paid nothing, and a
            rail could only ever measure time elapsed, which is not
            progress. The span is stated as two dates and a count of
            days, which is the whole truth about a plan's timing. */}
        <div className="maturity maturity--plan" style={{ ['--tone' as string]: toneVar }}>
          <div className="maturity__ends">
            <span>Starts <b>{startDate ? fmtDate(startDate) : '—'}</b></span>
            <span>
              Matures <b>{matDateISO ? fmtDate(matDateISO) : '—'}</b>
            </span>
          </div>
          <div className="maturity__note">
            {daysLeft > 0
              ? `Today sits ${daysLeft} day${daysLeft === 1 ? '' : 's'} before maturity`
              : daysLeft === 0
                ? 'Matures today'
                : `Matured ${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? '' : 's'} ago`}
          </div>
        </div>

        {/* The ledger — a plan has no deposits on record, so what it
            carries is the SCHEDULE: what would be paid, when it
            would land, and what the balance would be. */}
        {schedule.length > 0 && (
          <div className="inv-cert__ledger">
            <div className="inv-cert__ledger-head">
              <span className="t">Schedule</span>
              <span className="n">
                {isDps ? `${schedule.length} installments` : '1 lump sum'}
              </span>
            </div>

            {/* The bounded ledger — the shape of the schedule, not
                every row of it. A 60-month DPS cannot print 60 lines
                here, so the certificate states the facts instead: when
                the money first lands, when the last one lands, and
                what the balance becomes.

                A lump sum has only ONE deposit, so it gets two lines
                — the deposit and the maturity. Printing a third line
                would repeat the maturity date with the principal
                beside it, which says nothing. */}
            <div className="inv-cert__dline">
              <span className="inv-cert__dk">{isDps ? '1st' : 'Deposit'}</span>
              <span className="inv-cert__dd">
                {firstScheduleDate ? fmtDate(firstScheduleDate) : '—'}
              </span>
              <span className="inv-cert__da">{fmtBDT(schedule[0].paid)}</span>
            </div>
            {isDps && schedule.length > 1 && (
              <div className="inv-cert__dline">
                <span className="inv-cert__dk">Last</span>
                <span className="inv-cert__dd">
                  {lastScheduleDate ? fmtDate(lastScheduleDate) : '—'}
                </span>
                <span className="inv-cert__da">{fmtBDT(schedule[schedule.length - 1].paid)}</span>
              </div>
            )}
            <div className="inv-cert__dline inv-cert__dline--next">
              <span className="inv-cert__dk">At maturity</span>
              <span className="inv-cert__dd">
                {matDateISO ? fmtDate(matDateISO) : '—'}
              </span>
              <span className="inv-cert__da">{fmtBDT(matValue)}</span>
            </div>

            {/* The tally — the numbers the date lines cannot carry. */}
            <div className="inv-cert__tally">
              <span className="pip" aria-hidden />
              <span>
                {isDps ? (
                  <>
                    <b>{fmtBDT(totalContributed)}</b> over the full term {MIDDOT}{' '}
                    <b>{fmtBDT(interest)}</b> interest
                  </>
                ) : (
                  <>
                    Lump sum {MIDDOT} <b>{fmtBDT(totalContributed)}</b> locked in at start
                  </>
                )}
              </span>
            </div>
          </div>
        )}

        {/* The footer — the same three-figure form the real card uses. */}
        <div className="inv-cert__vals">
          <div className="inv-cert__v inv-cert__v--now">
            <div className="k">Committed</div>
            <div className="n">{fmtBDT(totalContributed)}</div>
          </div>
          <div className="inv-cert__grow">
            <div className="gk">Interest</div>
            <div className="gn">{fmtBDT(interest)}</div>
          </div>
          <div className="inv-cert__v inv-cert__v--mat">
            <div className="k">At maturity</div>
            <div className="n">{fmtBDT(matValue)}</div>
            <div className="c">
              {isDps
                ? 'if every installment is paid on time'
                : 'for the full term, on the principal you lock in'}
            </div>
          </div>
        </div>

        {/* The one line that is genuinely additive: this is a
            PROJECTION, and the bank is not bound by it. Everything
            else the old note said — what the number is, how it is
            computed, what goes in and what comes out — was already
            on the certificate as figures, and repeating it in prose
            made the reader match a sentence to a number they had
            already read. */}
        <div className="inv-cert__note">
          <strong>Actual bank payouts may differ.</strong>
        </div>
      </section>

      {/* ═══ THE AMENDMENT SHEET ════════════════════════════════ */}
      {/* The form is the SAME document as the certificate above it,
          written on. Each term gets its own ruled line — a small
          uppercase label on the left, the control on the right — so
          editing reads as filling in a form rather than filling in
          a web form. The type is a PICKER rather than a dropdown:
          three instruments, each with its own tone, and the reader
          sees all three at once instead of one word at a time. */}
      <section className="inv-cert" style={{ ['--tone' as string]: 'var(--warn)' }}>
        <div className="inv-cert__head">
          <div className="min-w-0">
            <div className="inv-cert__name">Plan terms</div>
            <div className="inv-cert__serial">
              {[
                `NO. ${serialFor(plan.id)}`,
                'AMENDMENTS',
                plan.dirty ? 'UNSAVED' : 'IN FORCE',
              ].join(` ${MIDDOT} `)}
            </div>
          </div>
          <div
            className="inv-cert__stamp inv-cert__stamp--planned"
            style={{ ['--tone' as string]: 'var(--warn)' }}
            title="Nothing here is written to your ledger."
          >
            Editing
          </div>
        </div>

        <div className="dform" style={{ marginTop: 14 }}>
          <div className="dfline">
            <div>
              <div className="dfline__label">Name</div>
            </div>
            <div>
              <Field label="Name" hideLabel>
                <Input
                  value={name}
                  onChange={e => { setName(e.target.value); patch({ name: e.target.value }); }}
                  placeholder="DBBL 1-year FDR"
                />
              </Field>
            </div>
          </div>

          <div className="dfline">
            <div>
              <div className="dfline__label">Type</div>
            </div>
            <div>
              <Field label="Type" hideLabel>
                <div className="typepick" role="radiogroup" aria-label="Type">
                  {TYPES.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      role="radio"
                      aria-checked={type === t.id}
                      className={`typeopt${type === t.id ? ' on' : ''}`}
                      style={{ ['--tone' as string]: toneFor(t.id) }}
                      onClick={() => { setType(t.id); patch({ type: t.id }); }}
                    >
                      <span className="tt">{t.name}</span>
                      <span className="ts">{t.sub}</span>
                    </button>
                  ))}
                </div>
              </Field>
            </div>
          </div>

          {type === 'dps' ? (
            <div className="dfline">
              <div>
                <div className="dfline__label">Installment</div>
              </div>
              <div>
                <Field label="Monthly installment" hideLabel>
                  <Input
                    type="number" inputMode="decimal"
                    value={monthlyContribution}
                    onChange={e => { setMonthlyContribution(e.target.value); patch({ monthlyContribution: Number(e.target.value) || 0 }); }}
                    placeholder="5000"
                  />
                </Field>
              </div>
            </div>
          ) : (
            <div className="dfline">
              <div>
                <div className="dfline__label">Principal</div>
              </div>
              <div>
                <Field label="Principal" hideLabel>
                  <Input
                    type="number" inputMode="decimal"
                    value={principal}
                    onChange={e => { setPrincipal(e.target.value); patch({ principal: Number(e.target.value) || 0 }); }}
                    placeholder="100000"
                  />
                </Field>
              </div>
            </div>
          )}

          <div className="dfline">
            <div>
              <div className="dfline__label">Rate</div>
            </div>
            <div>
              <Field label="Annual rate (%)" hideLabel>
                <Input
                  type="number" inputMode="decimal"
                  value={rate}
                  onChange={e => { setRate(e.target.value); patch({ rate: Number(e.target.value) || 0 }); }}
                  placeholder="8.5"
                />
              </Field>
            </div>
          </div>

          <div className="dfline">
            <div>
              <div className="dfline__label">Term</div>
            </div>
            <div>
              {/* `DurationField` renders its own `Field`, so its label
                  is hidden — the ruled line's left column already
                  names the field. */}
              <DurationField
                months={Math.max(0, Math.floor(Number(termMonths) || 0))}
                onChange={m => {
                  setTermMonths(String(m));
                  patch({ termMonths: m });
                }}
                hideLabel
              />
            </div>
          </div>

          <div className="dfline">
            <div>
              <div className="dfline__label">Start date</div>
            </div>
            <div>
              <Field label="Start date" hideLabel>
                <Input
                  type="date"
                  value={startDate}
                  onChange={e => { setStartDate(e.target.value); patch({ startDate: e.target.value }); }}
                />
              </Field>
            </div>
          </div>

          <div className="dfline">
            <div>
              <div className="dfline__label">Institution</div>
            </div>
            <div>
              <Field label="Institution (optional)" hideLabel>
                <Input
                  value={institution}
                  onChange={e => { setInstitution(e.target.value); patch({ institution: e.target.value }); }}
                  placeholder="DBBL"
                />
              </Field>
            </div>
          </div>
        </div>

        <div className="inv-cert__note">
          <strong>A plan, not a holding.</strong> Nothing here reaches your ledger
          &mdash; no account is opened, no transaction is recorded, and no money
          moves.
        </div>
      </section>

      {/* Save / Delete toolbar. Sticky-bottom on small screens so the
         user can save without scrolling back up — the form is taller
         than one screen on most devices and "scroll-up to save" was
         the main UX papercut. Save is gated on name + amount being
         present (see `canSave` above); Delete is the destructive
         action that removes the plan regardless of save state. After
         Save, the user is taken back to the list. */}
      <div className="sticky-bar">
        <SaveResetBar
          dirty={plan.dirty}
          canSave={canSave}
          saveDisabledReason={saveDisabledReason}
          onSave={() => {
            saveInvestmentPlan(plan.id);
            // After Save, take the user back to the list — they
            // confirmed the values, the next action is "see what
            // else I have".
            navigate('/plan/invest');
          }}
          onDelete={async () => {
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
        />
      </div>

      <section className="t-11 text-muted text-center">
        Plans never touch your ledger.
      </section>

      {dialog}
    </div>
  );
}
