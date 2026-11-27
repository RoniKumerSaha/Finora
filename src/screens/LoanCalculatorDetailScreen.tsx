/**
 * LoanCalculatorDetailScreen — edit a loan projection + amortisation table.
 *
 * A loan plan is a PROJECTION, so it wears the debt certificate's
 * instrument shell — the same red paper, the same engraved fields —
 * with one difference: the PLANNED stamp, printed dashed and greyed,
 * because no money has actually moved. It carries NO progress bar: a
 * plan has paid nothing, so its rail could only ever be empty, and the
 * schedule is stated in words instead. The amortisation table below it
 * is a LEDGER SHEET: a ruled page of the same paper.
 *
 * Layout:
 *   1. Back link + heading
 *   2. Two columns — the instrument column (the certificate, the
 *      Terms edit certificate, the amortisation ledger sheet) and the
 *      summary column (the Summary statement certificate + the two
 *      callouts).
 *   3. The sticky SaveResetBar.
 *
 * The amortisation table is auto-generated on every input change — the
 * same scratchpad pattern as the rest of the Plan module. Up to 60 rows
 * are shown inline; longer terms get a "showing first 60 of N" cap.
 */
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../domain/store';
import { loanAmortization, summariseLoanPlan } from '../domain/loanPlans';
import { Button } from '../components/Button';
import { useConfirm } from '../components/ConfirmDialog';
import { Field, Input } from '../components/Field';
import { DurationField } from '../components/DurationField';
import { SaveResetBar } from '../components/planner/SaveResetBar';
import { fmtBDT, fmtDate, fmtDateShort } from '../lib/format';
import { formatDuration } from '../domain/duration';

const MAX_INLINE_ROWS = 60;
const MIDDOT = '\u00B7';

/**
 * The serial on the certificate's face.
 *
 * The app stores no document numbers, so a real one would be a lie.
 * This derives a stable six-digit number from the plan id — the same
 * plan always shows the same serial, so the face does not shuffle
 * between visits.
 */
function serialFor(id: string): string {
  // FNV-1a: small, fast, well-distributed. We only need stability.
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return String(h % 1_000_000).padStart(6, '0');
}

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

  // Live edits flow into the store on every keystroke. The store is
  // the source of truth so the amortisation table reacts automatically.
  // The Save / Delete bar uses `plan.dirty` to decide whether the
  // caps-lock-style "Unsaved changes" pill is showing.
  //
  // We mirror the four numeric fields in local state so the user sees
  // an empty input (not "0") when the underlying value is 0 — the
  // save is gated on a non-zero principal being typed in.
  const [name, setName] = useState(plan?.name ?? '');
  const [principal, setPrincipal] = useState(
    plan && plan.principal > 0 ? String(plan.principal) : '',
  );
  const [rate, setRate] = useState(
    plan && plan.rate > 0 ? String(plan.rate) : '',
  );
  const [termMonths, setTermMonths] = useState(
    plan && plan.termMonths > 0 ? String(plan.termMonths) : '',
  );

  // The "not found" branch lives AFTER every hook so the hook order
  // is stable across renders — a plan that disappears mid-session
  // must not unmount the component with fewer hooks than it mounted
  // with.
  if (!plan) {
    return (
      <div className="card t-13 text-muted">
        Plan not found.
        <div className="mt-3">
          <Button variant="ghost" onClick={() => navigate('/plan/loan')}>Back to calculator</Button>
        </div>
      </div>
    );
  }

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

  const rateValue = Number(rate) || 0;
  const termValue = Math.max(0, Math.floor(Number(termMonths) || 0));

  const summary = summariseLoanPlan({
    ...plan,
    name,
    principal: principalValue,
    rate: rateValue,
    termMonths: termValue,
  });
  const rows = loanAmortization({
    ...plan,
    name,
    principal: principalValue,
    rate: rateValue,
    termMonths: termValue,
    startDate: plan.startDate,
  });
  const visibleRows = rows.slice(0, MAX_INLINE_ROWS);
  const hiddenCount = Math.max(0, rows.length - visibleRows.length);

  // ── The composition — principal vs interest ──
  //
  // The principal part of the schedule is what comes back to the
  // borrower; the interest is the lender's share. The donut's centre
  // states the interest share because that is the number a borrower
  // actually wants to know.
  const totalPaid = Math.max(0, summary.totalPaid);
  const principalPart = Math.max(0, totalPaid - summary.totalInterest);
  const interestPart = Math.max(0, summary.totalInterest);
  const interestPct = totalPaid > 0
    ? Math.round((interestPart / totalPaid) * 100)
    : 0;

  // The donut's ring — the two arcs. The circumference of a 46r ring
  // is ~289; each arc's length is its share of that.
  const RING_R = 46;
  const CIRC = 2 * Math.PI * RING_R;
  const principalLen = totalPaid > 0 ? (principalPart / totalPaid) * CIRC : 0;
  const interestLen = totalPaid > 0 ? (interestPart / totalPaid) * CIRC : 0;

  const serial = serialFor(plan.id);
  const planName = trimmedName || 'Untitled projection';

  return (
    <div className="flex flex-col gap-5 pb-24">
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
          className="text-muted t-13 hover:text-ink transition"
        >{'\u2190'} Loan Calculator</button>
      </div>
      <header>
        <h1 className="heading h1-screen">Loan projection</h1>
        <div className="text-muted t-13 mt-1.5 max-w-prose">
          Edit the four inputs — principal, rate, term, start date — and watch the EMI and amortization table update.
        </div>
      </header>

      <div className="loan-page">
        {/* ═══ THE INSTRUMENT COLUMN ══════════════════════════ */}
        <div className="loan-page__col">

          {/* The projection instrument. It wears the debt
              certificate's shell because a loan IS a promise to pay —
              the only difference from a real IOU is that no money has
              moved yet, which is what the PLANNED stamp says. */}
          <section
            className="debt-cert debt-cert--plain"
            style={{ ['--tone' as string]: 'var(--danger)' }}
          >
            <div className="debt-cert__head">
              <div className="min-w-0">
                <div className="debt-cert__name">{planName}</div>
                <div className="debt-cert__serial">
                  NO. {serial} {MIDDOT} LOAN PROJECTION
                </div>
              </div>
              <span
                className="debt-cert__stamp debt-cert__stamp--planned"
                title="This is a projection — no real loan has been taken."
              >
                Planned
              </span>
            </div>

            {/* The composition donut — principal vs interest.
                Principal is what comes back to the borrower, so it
                wears the app's GOOD colour; interest is the lender's
                share, the cost of borrowing, so it wears the DANGER
                colour. The reader reads the ring the way the money
                reads: green is yours, red is theirs. */}
            {totalPaid > 0 && (
              <div className="donut-wrap" style={{ marginTop: 16 }}>
                <div className="donut">
                  <svg width="118" height="118" viewBox="0 0 118 118" aria-hidden>
                    <circle
                      cx="59" cy="59" r={RING_R} fill="none"
                      stroke="rgba(255,255,255,0.06)" strokeWidth="15"
                    />
                    <circle
                      cx="59" cy="59" r={RING_R} fill="none"
                      stroke="var(--primary)" strokeWidth="15"
                      strokeDasharray={`${principalLen.toFixed(2)} ${(CIRC - principalLen).toFixed(2)}`}
                      strokeLinecap="butt"
                    />
                    <circle
                      cx="59" cy="59" r={RING_R} fill="none"
                      stroke="var(--danger)" strokeWidth="15"
                      strokeDasharray={`${interestLen.toFixed(2)} ${(CIRC - interestLen).toFixed(2)}`}
                      strokeDashoffset={(-principalLen).toFixed(2)}
                      strokeLinecap="butt"
                    />
                  </svg>
                  <div className="donut__ctr">
                    {/* The centre states the INTEREST share, so it wears
                        the interest slice's own colour — a reader should
                        be able to match the number to the arc without
                        consulting the key. */}
                    <div className="v" style={{ color: 'var(--danger)' }}>{interestPct}%</div>
                    <div className="l">Interest</div>
                  </div>
                </div>
                <div className="donut-key">
                  <div className="donut-key__row">
                    <span className="donut-key__sw" style={{ background: 'var(--primary)' }} />
                    Principal
                    <span className="donut-key__v">{fmtBDT(principalPart)}</span>
                  </div>
                  <div className="donut-key__row">
                    <span className="donut-key__sw" style={{ background: 'var(--danger)' }} />
                    Interest
                    <span className="donut-key__v">{fmtBDT(interestPart)}</span>
                  </div>
                  <div className="donut-key__row donut-key__row--total">
                    Total you pay
                    <span className="donut-key__v">{fmtBDT(totalPaid)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* The engraved terms — the three figures a borrower
                reads first, in the certificate's own voice. */}
            <div className="debt-cert__fields">
              <div className="debt-cert__f">
                <div className="k">Loan amount</div>
                <div className="v">{fmtBDT(principalValue)}</div>
              </div>
              <div className="debt-cert__f">
                <div className="k">Monthly EMI</div>
                <div className="v">{summary.emi > 0 ? fmtBDT(summary.emi) : '\u2014'}</div>
              </div>
              <div className="debt-cert__f">
                <div className="k">Interest paid</div>
                <div className="v v--danger">{fmtBDT(interestPart)}</div>
              </div>
            </div>

            {/* The SCHEDULE — what a PROJECTION can honestly show.

                A projection has made no payments, so there is NO
                progress bar here: a bar reading "40% settled" would
                be a lie, and an empty rail is noise on a plan. The
                schedule is stated in words — how many payments this
                costs, and when the first lands.

                The interest share lives in the donut above. */}
            <div className="debt-cert__tally tabular">
              <span className="pip" aria-hidden />
              <span>
                {termValue > 0 ? (
                  <>
                    <b>Nothing paid yet</b>
                    {MIDDOT} <b>{rows.length}</b> installments to pay
                    {rows.length > 0 ? (
                      <> {MIDDOT} first due <b>{fmtDate(rows[0].dueDate)}</b></>
                    ) : null}
                  </>
                ) : (
                  <>Set a term to see the schedule.</>
                )}
              </span>
            </div>

            {/* The tally — the schedule's two bookends. */}
            {rows.length > 0 && (
              <div className="debt-cert__tally tabular">
                <span className="pip" aria-hidden />
                <span>
                  First payment <b>{fmtDate(rows[0].dueDate)}</b>
                  {MIDDOT} Last <b>{fmtDate(rows[rows.length - 1].dueDate)}</b>
                </span>
              </div>
            )}

            <div className="debt-cert__note">
              <strong>Projection only.</strong> Actual loan terms may include fees,
              insurance, or rounding that change the numbers slightly.
            </div>
          </section>

          {/* ═══ THE TERMS EDIT PASS ═══════════════════════════ */}
          <section
            className="debt-cert debt-cert--plain"
            style={{ ['--tone' as string]: 'var(--danger)' }}
          >
            <div className="debt-cert__head">
              <div className="min-w-0">
                <div className="debt-cert__name">Terms</div>
                <div className="debt-cert__serial">FOUR INPUTS {MIDDOT} LIVE</div>
              </div>
              <span className="debt-cert__stamp debt-cert__stamp--planned">Editing</span>
            </div>

            <div className="loan-form" style={{ marginTop: 16 }}>
              <div className="loan-form__wide">
                <Field label="Name" hint={'Free text. Try "Car loan" or "Personal loan 2026".'}>
                  <Input
                    value={name}
                    onChange={e => { setName(e.target.value); updateLoanPlan(plan.id, { name: e.target.value }); }}
                    placeholder="Personal loan"
                    autoFocus
                  />
                </Field>
              </div>

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

              <DurationField
                months={termValue}
                onChange={m => {
                  setTermMonths(String(m));
                  updateLoanPlan(plan.id, { termMonths: m });
                }}
                hint="Total number of monthly payments. Enter the term in months or years."
              />
              <Field label="First payment date" hint="When the first EMI is due.">
                <Input
                  type="date"
                  value={plan.startDate}
                  onChange={e => updateLoanPlan(plan.id, { startDate: e.target.value })}
                />
              </Field>
            </div>
          </section>

          {/* ═══ THE AMORTISATION LEDGER ════════════════════════ */}
          <section className="ledger-sheet">
            <div className="ledger-sheet__head">
              <div className="min-w-0">
                <div className="ledger-sheet__name">Amortization table</div>
                <div className="ledger-sheet__serial">
                  {rows.length > 0
                    ? `${rows.length} MONTHLY PAYMENT${rows.length === 1 ? '' : 'S'} OVER ${formatDuration(summary.termMonths).toUpperCase()}`
                    : 'NO SCHEDULE YET'}
                </div>
              </div>
              {rows.length > 0 && (
                <span className="ledger-sheet__tag">
                  {hiddenCount > 0 ? `First ${MAX_INLINE_ROWS} shown` : 'All shown'}
                </span>
              )}
            </div>

            {rows.length === 0 ? (
              <div className="t-13 text-muted">Enter a principal and term to see the breakdown.</div>
            ) : (
              <>
                <div className="ledger-sheet__scroll">
                  <table className="ledger-sheet__table">
                    <thead>
                      <tr>
                        <th>Period</th>
                        <th>Due</th>
                        <th className="is-n">Payment</th>
                        <th className="is-n">Interest</th>
                        <th className="is-n">Principal</th>
                        <th className="is-n">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRows.map(row => (
                        <tr key={row.period}>
                          <td className="is-dim">{row.period}</td>
                          {/* The due date carries two forms: the full
                              one for wide screens, and a short one
                              ("5 Feb") that drops the year. On a
                              phone the year is the bulkiest part of
                              the cell and the least useful — a
                              schedule's year is obvious — so the
                              short form is what fits, and CSS
                              picks which one is shown. */}
                          <td className="is-dim">
                            <span className="ledger-sheet__due-full">{fmtDate(row.dueDate)}</span>
                            <span className="ledger-sheet__due-short">{fmtDateShort(row.dueDate)}</span>
                          </td>
                          <td className="is-n">{fmtBDT(row.payment)}</td>
                          <td className="is-n is-danger">{fmtBDT(row.interest)}</td>
                          <td className="is-n">{fmtBDT(row.principalPaid)}</td>
                          <td className="is-n">{fmtBDT(row.remaining)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {hiddenCount > 0 && (
                  <div className="ledger-sheet__foot">
                    Showing first {MAX_INLINE_ROWS} of {rows.length} rows.
                  </div>
                )}
              </>
            )}
          </section>
        </div>

        {/* ═══ THE SUMMARY COLUMN ══════════════════════════════ */}
        <div className="loan-page__col">
          <div className="loan-page__sect">Summary (projection)</div>

          <section
            className="debt-cert debt-cert--plain debt-cert--statement"
            style={{ ['--tone' as string]: 'var(--danger)' }}
          >
            <div className="debt-cert__head">
              <div className="min-w-0">
                <div className="debt-cert__name">Summary</div>
                <div className="debt-cert__serial">
                  NO. {serial.slice(-2)} {MIDDOT} 1 PROJECTION
                </div>
              </div>
              <span className="debt-cert__stamp debt-cert__stamp--planned">Planned</span>
            </div>

            <div className="debt-cert__rule" />

            {/* The statement carries only what the instrument card
                beside it does NOT. The card already engraves the
                loan amount, the monthly EMI and the interest, and the
                donut already splits principal from interest — so
                those lines repeated the same numbers a few inches
                away.

                What the card genuinely lacks is the rate and the
                term: they live in the input fields below the fold,
                and on a projection document they are the terms a
                borrower reads first. */}
            <div className="debt-cert__lines">
              <div className="debt-cert__line">
                <span className="k">Rate</span>
                <span className="v">{rateValue}% APR</span>
              </div>
              <div className="debt-cert__line">
                <span className="k">Term</span>
                <span className="v">{termValue} months</span>
              </div>
              <div className="debt-cert__line">
                <span className="k">Principal</span>
                <span className="v">{fmtBDT(principalValue)}</span>
              </div>
            </div>

            {/* The closing figure of the whole repayment — the one
                number the instrument card's fields do not state. */}
            <div className="debt-cert__vals">
              <div className="debt-cert__v debt-cert__v--wide">
                <span className="k">Total you pay</span>
                <span className="n">{fmtBDT(totalPaid)}</span>
              </div>
            </div>

            {/* The one insight the schedule itself cannot state: the
                EMI never moves, but what it BUYS does. Without this
                a reader sees a constant ৳ figure for 60 months and
                concludes the loan costs the same every month. The
                old note's last sentence — "the table on the left
                shows that split row by row" — just pointed at the
                columns, so it went. */}
            <div className="debt-cert__note">
              The EMI is fixed for the whole term. Early on most of each payment is
              {' '}<em>interest</em>; by the last installment it is almost all <em>principal</em>.
            </div>
          </section>

          {/* The one caveat worth stating in prose — and it is stated
              quietly, matching the Investment Planner's detail screen.
              The two loud callout boxes this replaces were doing two
              jobs, neither of them the user's:

                - one explained the DESIGN ("the word Planned is
                  stamped across it in grey, with a dashed border so
                  it reads as an annotation") — commentary about the
                  visual language, which the stamp already shows;
                - the other repeated the caveat the PLANNED stamp's
                  tooltip and the Summary note already carry.

              One quiet line says the thing that is actually useful:
              a projection is not a transaction. */}
          <section className="t-11 text-muted text-center">
            Projections never touch your ledger.
          </section>
        </div>
      </div>

      {/* Save / Delete toolbar. Sticky-bottom on small screens so
         the user can save without scrolling back up — the form is
         taller than one screen on most devices. Identical
         placement to the Investment Planner detail so the two
         "planner" surfaces share one shape. After Save, the user
         is taken back to the list. Delete is the destructive
         action that removes the plan regardless of save state. */}
      <div className="sticky-bar">
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

      {dialog}
    </div>
  );
}
