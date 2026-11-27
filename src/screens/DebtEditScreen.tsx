/**
 * DebtEditScreen — write on the slip.
 *
 * Modeled on AccountEditScreen. Loads the debt by :id, pre-fills the
 * form from the stored values. Saving calls debts.update; deleting uses
 * the modal confirm pattern from TransactionEditScreen.
 *
 * The edit pass is the SLIP AS A FORM: one ruled line per field, the
 * way you would write on a document. The certificate itself — the
 * engraved terms, the settlement rail, the closing figures and the
 * activity ledger — lives on the detail screen (`/debts/:id`), so
 * this one is only ever about CHANGING the terms.
 *
 * There is deliberately NO progress bar here. This page is for
 * EDITING, and a bar there invites the reader to think the number is
 * editable — it is not, because progress comes from transactions, not
 * from typing.
 *
 * Note: paidSoFar is not editable here — it's derived from linked
 * transactions (R7). To change the paid amount, record an expense (for
 * i_owe) or income (for owed_to_me) tagged with linkedDebtId.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../domain/store';
import * as debts from '../domain/debts';
import { Button } from '../components/Button';
import { Field, Input, Select } from '../components/Field';
import { useConfirm } from '../components/ConfirmDialog';
import { isPositiveMoney, POSITIVE_MONEY_ERROR, POSITIVE_RATE_ERROR, POSITIVE_TERM_ERROR } from '../lib/validation';
import type { DebtDirection, DebtKind } from '../domain/types';

export function DebtEditScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const state = useStore(s => s.state);
  const update = useStore(s => s.update);
  const showBanner = useStore(s => s.showBanner);
  const showToast = useStore(s => s.showToast);
  const { confirm, dialog } = useConfirm();
  const debt = debts.get(state, id!);

  const [name, setName] = useState(debt?.name ?? '');
  const [direction, setDirection] = useState<DebtDirection>(debt?.direction ?? 'i_owe');
  const [total, setTotal] = useState(String(debt?.total ?? ''));
  const [person, setPerson] = useState(debt?.person ?? '');
  const [dueDate, setDueDate] = useState(debt?.dueDate ?? '');
  // V1.1: loan-kind state, pre-filled from the existing debt. Defaults
  // to off for legacy flat debts.
  const [isLoan, setIsLoan] = useState(debt?.kind === 'loan');
  const [interestRate, setInterestRate] = useState(debt?.interestRate != null ? String(debt.interestRate) : '');
  const [termMonths, setTermMonths] = useState(debt?.termMonths != null ? String(debt.termMonths) : '');
  // Snapshot the debt's kind at mount. A debt that IS a loan with
  // interest is LOCKED as one: an interest-bearing loan can never be
  // converted back into an interest-free debt. The reason is
  // arithmetic, not preference — once a loan exists, its payments
  // have been split into interest and principal against a specific
  // rate and term. Reinterpreting that history as a flat IOU would
  // silently rewrite the meaning of money already recorded.
  const [wasLoanAtMount] = useState(debt?.kind === 'loan');
  // One-shot confirm-state for the Save button. Pulse + ✓ glyph render
  // for the 600ms window before navigate.
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (saved) setSaved(false);
  }, [name, direction, total, person, dueDate, isLoan, interestRate, termMonths]); // eslint-disable-line react-hooks/exhaustive-deps

  // Inline guard (spine: ux-finora-2026-08-14-negative-guard). Pre-populated
  // value is always valid; user can break it by typing a negative.
  const totalInvalid = !isPositiveMoney(total);
  const totalErrorClass = totalInvalid
    ? 'border-danger focus:border-danger focus:ring-danger/30'
    : '';
  // V1.1: rate is required when isLoan is true.
  const rateInvalid = isLoan && !(Number(interestRate) > 0);
  const rateErrorClass = rateInvalid
    ? 'border-danger focus:border-danger focus:ring-danger/30'
    : '';
  // Term in months is REQUIRED when isLoan is true so the Pay button
  // can always pre-fill with a meaningful EMI. Must be a positive
  // integer.
  //
  // The ERROR is shown only once the user has touched the field. A
  // loan that was saved without a term (legacy data, or a record
  // written before the term became required) opens with the field
  // blank — and marking that blank as invalid the moment the screen
  // loads scolds the user for a value they were never asked for. The
  // field still READS as required and the Save button still stays
  // disabled; the red border and the message wait for an edit.
  const [termTouched, setTermTouched] = useState(false);
  const termInvalid = isLoan && !(Number(termMonths) > 0);
  const termErrorClass = termInvalid && termTouched
    ? 'border-danger focus:border-danger focus:ring-danger/30'
    : '';
  const termError = termInvalid && termTouched ? POSITIVE_TERM_ERROR : undefined;
  // Loan toggle only shows for i_owe — same rationale as the Add
  // screen. You only pay interest on money you borrowed, not on
  // money you lent.
  const showLoanToggle = direction === 'i_owe';

  if (!debt) {
    return (
      <div className="text-muted">
        Debt not found.{' '}
        <button className="underline" onClick={() => navigate('/debts')}>Back to debts</button>
      </div>
    );
  }

  const linkedTxCount = state.transactions.filter(
    t => t.linkedDebtId === debt.id
  ).length;

  // The tone of the slip this form is writing on. A debt you owe
  // wears the danger red; one owed to you wears the primary green.
  const isIOwe = debt.direction === 'i_owe';
  const tone = isIOwe ? 'var(--danger)' : 'var(--primary)';

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      showBanner({
        kind: 'error',
        what: 'Debt name is required',
        why: 'Debts without a name cannot be tracked.',
        fix: 'Enter a name (e.g. "Loan from a friend").',
      });
      return;
    }
    if (!(Number(total) > 0)) {
      showBanner({
        kind: 'error',
        what: 'Total must be greater than zero',
        why: 'Zero or negative totals make the debt meaningless.',
        fix: 'Enter a positive number.',
      });
      return;
    }
    if (isLoan && !(Number(interestRate) > 0)) {
      showBanner({
        kind: 'error',
        what: 'Enter the annual interest rate',
        why: 'A loan-kind debt needs a rate so each payment can be split into interest and principal.',
        fix: 'Enter the rate as a percentage, e.g. 12 for 12% APR.',
      });
      return;
    }
    if (isLoan && !(Number(termMonths) > 0)) {
      showBanner({
        kind: 'error',
        what: 'Enter the term in months',
        why: 'A loan-kind debt needs a term so the Pay button can pre-fill with the standard EMI.',
        fix: 'Enter the term as a whole number of months, e.g. 36 for 3 years.',
      });
      return;
    }
    submitRef.current?.();
  }

  // The save itself. A debt that was a loan with interest keeps its
  // kind whatever the form says — an interest-bearing loan can never
  // be converted into an interest-free debt.
  async function performSave() {
    const keepsLoan = wasLoanAtMount || isLoan;
    try {
      update(s => debts.update(s, debt!.id, {
        name,
        direction,
        total: Number(total),
        person: person.trim() || undefined,
        dueDate: dueDate || undefined,
        kind: keepsLoan ? 'loan' as DebtKind : undefined,
        interestRate: keepsLoan ? Number(interestRate) : undefined,
        termMonths: keepsLoan && termMonths ? Number(termMonths) : undefined,
      }));
      showToast({
        kind: 'success',
        what: 'Debt updated',
        why: 'Changes are saved.',
      });
      setSaved(true);
      // Back to the slip, where the new terms are now engraved.
      window.setTimeout(() => navigate(`/debts/${debt!.id}`), 600);
    } catch (err) {
      showBanner({
        kind: 'error',
        what: 'Could not update debt',
        why: (err as Error).message,
        fix: 'Try again.',
      });
    }
  }

  // Imperative bridge: onSubmit does synchronous validation and then
  // calls into this ref so the save can be awaited before navigating.
  const submitRef = useRef<() => Promise<void>>(async () => { /* replaced below */ });
  submitRef.current = async () => {
    // A debt that WAS a loan with interest stays one. The toggle is
    // disabled for it, so this is belt-and-braces: the save can never
    // write a loan-kind debt back as a flat debt.
    await performSave();
  };

  async function onDelete() {
    const target = debt;
    if (!target) return;
    const ok = await confirm({
      title: `Delete "${target.name}"?`,
      body: linkedTxCount > 0
        ? `${linkedTxCount} linked transaction(s) stay in your records. Only the debt record is removed.`
        : 'The debt record is removed. No transactions are linked.',
      confirmLabel: 'Delete debt',
      danger: true,
    });
    if (!ok) return;
    try {
      update(s => debts.remove(s, target.id));
      showBanner({
        kind: 'success',
        what: 'Debt deleted',
        why: linkedTxCount > 0
          ? `${linkedTxCount} linked transaction(s) remain in your records.`
          : 'No transactions were linked.',
        fix: 'Open Debts to see the updated list.',
      });
      navigate('/debts');
    } catch (err) {
      showBanner({
        kind: 'error',
        what: 'Could not delete debt',
        why: (err as Error).message,
        fix: 'Try again.',
      });
    }
  }

  return (
    // Page-level layout: a full-width header (back-link + title) on
    // top, then the edit pass below.
    <div className="flex flex-col gap-6">
      <header>
        <div className="flex items-center gap-3 mb-2">
          {/* The back-link goes to the SLIP, not to the list — the
              user came here from the slip to change it, so that is
              where they belong when they are done reading the form. */}
          <Link to={`/debts/${debt.id}`} className="text-muted t-13 hover:text-ink transition">
            {'\u2190'} {debt.name}
          </Link>
        </div>
        <div>
          <h1 className="heading h1-screen">Edit debt</h1>
        </div>
      </header>

      <div className="debt-page">
        <div className="debt-page__col">
          {/* ═══ THE EDIT PASS ═════════════════════════════════ */}
          <form onSubmit={onSubmit}>
            <section
              className="debt-cert debt-cert--plain"
              style={{ ['--tone' as string]: tone }}
            >
              <div className="debt-cert__head">
                <div className="min-w-0">
                  <div className="debt-cert__name">Terms</div>
                  <div className="debt-cert__serial">WRITING ON THE SLIP</div>
                </div>
                <span className="debt-cert__stamp debt-cert__stamp--planned">Editing</span>
              </div>

              <div className="dform" style={{ marginTop: 14 }}>
                <div className="dfline">
                  <div>
                    <div className="dfline__label">Direction</div>
                  </div>
                  <div>
                    <Field label="Direction" hideLabel>
                      <Select
                        value={direction}
                        onChange={e => {
                          const next = e.target.value as DebtDirection;
                          setDirection(next);
                          // If the user flips from i_owe (where the loan toggle may
                          // have been on) to owed_to_me, clear the loan state —
                          // the toggle is hidden for that direction so leaving it
                          // set would leave orphan form fields the user can't see.
                          //
                          // A debt that WAS a loan with interest is exempt: it is
                          // locked as a loan (see `wasLoanAtMount`), so flipping
                          // the direction must not quietly convert it into an
                          // interest-free debt. The loan terms travel with it.
                          if (next !== 'i_owe' && isLoan && !wasLoanAtMount) {
                            setIsLoan(false);
                            setInterestRate('');
                            setTermMonths('');
                          }
                        }}
                      >
                        <option value="i_owe">I owe (you borrowed)</option>
                        <option value="owed_to_me">Owed to me (you lent)</option>
                      </Select>
                    </Field>
                  </div>
                </div>

                <div className="dfline">
                  <div>
                    <div className="dfline__label">Name</div>
                  </div>
                  <div>
                    <Field label="Name" hideLabel>
                      <Input value={name} onChange={e => setName(e.target.value)} autoFocus />
                    </Field>
                  </div>
                </div>

                <div className="dfline">
                  <div>
                    <div className="dfline__label">Total amount</div>
                  </div>
                  <div>
                    <Field label="Total amount" hideLabel error={totalInvalid ? POSITIVE_MONEY_ERROR : undefined}>
                      <Input
                        type="number"
                        inputMode="decimal"
                        value={total}
                        onChange={e => setTotal(e.target.value)}
                        aria-invalid={totalInvalid || undefined}
                        className={totalErrorClass}
                      />
                    </Field>
                  </div>
                </div>

                <div className="dfline">
                  <div>
                    <div className="dfline__label">Person (optional)</div>
                  </div>
                  <div>
                    <Field label="Person (optional)" hideLabel>
                      <Input value={person} onChange={e => setPerson(e.target.value)} />
                    </Field>
                  </div>
                </div>

                <div className="dfline">
                  <div>
                    <div className="dfline__label">Due date (optional)</div>
                  </div>
                  <div>
                    <Field label="Due date (optional)" hideLabel>
                      <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                    </Field>
                  </div>
                </div>

                {/* V1.1: optional loan toggle — same shape as DebtAddScreen.
                    Pre-filled from `debt.kind` / `debt.interestRate` / `debt.termMonths`.
                    Only shown when direction is 'i_owe' — interest only applies
                    to money you borrowed.

                    A debt that WAS a loan with interest is LOCKED: the
                    checkbox is disabled and checked, because an
                    interest-bearing loan can never be converted back
                    into an interest-free debt. Its payments were already
                    split against a rate and term, and reinterpreting
                    that history would rewrite money already recorded. */}
                {showLoanToggle && (
                  <div className="dfline">
                    <div>
                      <div className="dfline__label">Is this a loan with interest?</div>
                    </div>
                    <div>
                      <label
                        className={`flex items-start gap-2.5 select-none ${wasLoanAtMount ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        <input
                          type="checkbox"
                          checked={isLoan}
                          disabled={wasLoanAtMount}
                          onChange={e => {
                            setIsLoan(e.target.checked);
                            if (!e.target.checked) {
                              setInterestRate('');
                              setTermMonths('');
                            }
                          }}
                          className="mt-1 shrink-0"
                          aria-label="Mark this debt as a loan with interest"
                        />
                        <div className="min-w-0">
                          <div className="t-13 font-semibold text-ink leading-tight">
                            Loan with interest
                          </div>
                          <div className="t-12 text-muted mt-1 leading-relaxed">
                            {wasLoanAtMount
                              ? 'Locked — this loan cannot become an interest-free debt.'
                              : 'Splits every payment into interest and principal.'}
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>
                )}

                {isLoan && (
                  <div className="dfline">
                    <div>
                      <div className="dfline__label">Loan terms</div>
                    </div>
                    <div className="subblock">
                      <Field
                        label="Annual interest rate (%)"
                        error={rateInvalid ? POSITIVE_RATE_ERROR : undefined}
                      >
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
                          max="100"
                          value={interestRate}
                          onChange={e => setInterestRate(e.target.value)}
                          aria-invalid={rateInvalid || undefined}
                          className={rateErrorClass}
                        />
                      </Field>
                      {/* Term in months is required when isLoan is true so the
                          Pay button can always pre-fill with a meaningful EMI
                          and the loan card can display "Monthly EMI" rather
                          than "—". */}
                      <Field
                        label="Term in months"
                        error={termError}
                      >
                        <Input
                          type="number"
                          inputMode="numeric"
                          min="1"
                          value={termMonths}
                          onChange={e => {
                            setTermTouched(true);
                            setTermMonths(e.target.value);
                          }}
                          aria-invalid={termInvalid || undefined}
                          className={termErrorClass}
                        />
                      </Field>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2" style={{ marginTop: 16 }}>
                <Button
                  variant="outlined-primary"
                  type="submit"
                  disabled={totalInvalid || !name.trim() || rateInvalid || termInvalid}
                  success={saved}
                >
                  Save changes
                </Button>
                <Button variant="outlined-ghost" type="button" onClick={() => navigate(`/debts/${debt.id}`)}>Cancel</Button>
              </div>
            </section>
          </form>

          <section
            className="rounded-card p-6"
            style={{
              background: 'var(--danger-callout-bg)',
              border: '1px solid var(--danger)',
              boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--danger) 35%, transparent)',
            }}
          >
            <h2 className="heading h3-modal mb-2" style={{ color: 'var(--danger-title)' }}>Danger zone</h2>
            <p className="t-13 text-muted mb-4">
              {linkedTxCount > 0
                ? `Removes the debt record only. The ${linkedTxCount} linked transaction(s) stay in your records.`
                : 'Removes the debt record. No transactions are linked.'}
            </p>
            <Button variant="outlined-danger" onClick={onDelete}>Delete debt</Button>
          </section>
        </div>
      </div>

      {dialog}
    </div>
  );
}
