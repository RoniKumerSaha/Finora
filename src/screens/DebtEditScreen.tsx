/**
 * DebtEditScreen — edit a debt's name, direction, total, person, dueDate.
 *
 * Modeled on AccountEditScreen. Loads the debt by :id, pre-fills the
 * form from the stored values. Saving calls debts.update; deleting uses
 * the modal confirm pattern from TransactionEditScreen.
 *
 * The page wears the debt certificate's shell: an IOU SLIP with the
 * amount and the rate engraved on the face, and the closing figures.
 * Below it, the "Terms" edit pass writes the changes straight onto
 * the slip — one ruled line per field. The right column is the
 * ACTIVITY LEDGER: the running account of every payment against this
 * debt.
 *
 * The slip here is the SAME document as the one on the debts list —
 * it has its own copy of the certificate markup, so both were
 * changed together: a FLAT debt carries ONE figure (the amount
 * still owed) with the counterparty engraved beside it in the
 * middle column, and a LOAN carries its instrument terms. The
 * counterparty and the amount used to be printed TWICE on this
 * slip — as "Outstanding" and again as "Remaining payments" — which
 * is why the flat card now states the figure once.
 *
 * There is deliberately NO progress bar in the EDIT FORM below. This
 * page is for EDITING the terms, and a bar there invites the reader
 * to think the number is editable — it is not, because progress comes
 * from transactions, not from typing. The certificate ABOVE does carry
 * the same rail the debts list card carries, because a certificate is
 * a statement of fact, not a field to fill in.
 *
 * Note: paidSoFar is not editable here — it's derived from linked
 * transactions (R7). To change the paid amount, record an expense (for
 * i_owe) or income (for owed_to_me) tagged with linkedDebtId.
 *
 * When the debt is fully paid, we surface the most-recently-used
 * account's balance so the user can see what their accounts look like
 * after the debt was settled.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../domain/store';
import * as debts from '../domain/debts';
import { accountBalance, debtOutstanding, loanEMI, loanPaymentSplit } from '../domain/math';
import { fmtBDT, fmtDate } from '../lib/format';
import { Button } from '../components/Button';
import { Field, Input, Select } from '../components/Field';
import { useConfirm } from '../components/ConfirmDialog';
import { ProgressRail } from '../components/planner/ProgressRail';
import { isPositiveMoney, POSITIVE_MONEY_ERROR, POSITIVE_RATE_ERROR, POSITIVE_TERM_ERROR } from '../lib/validation';
import type { DebtDirection, DebtKind } from '../domain/types';

const MIDDOT = '\u00B7';

/**
 * The serial on the slip's face.
 *
 * The app stores no document numbers, so a real one would be a lie.
 * This derives a stable six-digit number from the debt id — the same
 * debt always shows the same serial, so the face does not shuffle
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

  // Activity feed — every transaction tagged with this debt, sorted
  // newest first. Paid-down debts (i_owe) surface linked expense
  // transactions as "Payment"; receivables (owed_to_me) surface linked
  // income as "Received". Mirrors the Activity card in
  // InvestmentDetailScreen.
  const linkedTx = state.transactions
    .filter(t => t.linkedDebtId === debt.id)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));
  const accountById = new Map(state.accounts.map(a => [a.id, a]));

  // Summary widgets for the Activity panel — total paid (matching
  // direction only) + last payment date. Only used for display; the
  // card's headline figure still comes from outstandingFor() so it
  // stays consistent with the Debts list.
  const isIOwe = debt.direction === 'i_owe';
  const matchingTx = linkedTx.filter(t =>
    isIOwe ? t.type === 'expense' : t.type === 'income'
  );
  const totalPaid = matchingTx.reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const lastPaymentDate = matchingTx[0]?.date;

  // V1.1 (L4.1): per-row loan split — for loan-kind debts only.
  // We replay the transactions in chronological (oldest-first) order,
  // tracking running outstanding, and stash each transaction's
  // {interest, principal} split so the row can render it.
  // `linkedTx` is newest-first, so we build a Map keyed by transaction
  // id and look it up in the row.
  const splitByTxId = new Map<string, { interest: number; principal: number }>();
  if (debt.kind === 'loan') {
    const rate = Number(debt.interestRate) || 0;
    const chronological = linkedTx.slice().sort((a, b) => {
      const d = a.date.localeCompare(b.date);
      return d !== 0 ? d : a.id.localeCompare(b.id);
    });
    let out = Number(debt.total) || 0;
    for (const t of chronological) {
      const matches =
        (debt.direction === 'i_owe' && t.type === 'expense') ||
        (debt.direction === 'owed_to_me' && t.type === 'income');
      if (!matches) {
        splitByTxId.set(t.id, { interest: 0, principal: 0 });
        continue;
      }
      const split = loanPaymentSplit(out, Number(t.amount) || 0, rate);
      splitByTxId.set(t.id, split);
      out = Math.max(0, out - split.principal);
    }
  }

  // ── The figures engraved on the slip ──
  //
  // A loan's three terms are the amount borrowed, the interest already
  // paid to the lender and the principal that actually retired the
  // balance. A flat note has no interest, so it states the total, what
  // has been paid and the share settled.
  const rate = Number(debt.interestRate) || 0;
  const term = Number(debt.termMonths) || 0;
  const debtTotal = Number(debt.total) || 0;
  const outstanding = debtOutstanding(debt, state.transactions);
  const debtIsLoan = debt.kind === 'loan';

  const monthlyEmi = debtIsLoan && term > 0
    ? Math.round(loanEMI(debtTotal, rate, term))
    : 0;

  // The split of everything paid so far, and the progress it bought.
  let totalInterest = 0;
  let totalPrincipal = 0;
  if (debtIsLoan) {
    const chronological = linkedTx.slice().sort((a, b) => {
      const d = a.date.localeCompare(b.date);
      return d !== 0 ? d : a.id.localeCompare(b.id);
    });
    let out = debtTotal;
    for (const t of chronological) {
      const matches =
        (debt.direction === 'i_owe' && t.type === 'expense') ||
        (debt.direction === 'owed_to_me' && t.type === 'income');
      if (!matches) continue;
      const split = loanPaymentSplit(out, Number(t.amount) || 0, rate);
      totalInterest += split.interest;
      totalPrincipal += split.principal;
      out = Math.max(0, out - split.principal);
    }
  }

  // Progress is the share of the PRINCIPAL retired. On a loan every
  // payment also carried interest, so gross-paid-over-total runs
  // ahead of the real progress (and could even read 100% while
  // principal was still outstanding).
  const principalPaid = debtIsLoan ? totalPrincipal : (debt.paidSoFar || 0);
  const pct = debtTotal > 0
    ? Math.min(100, Math.round((principalPaid / debtTotal) * 100))
    : 0;

  // The next payment the slip expects — the standard EMI for a loan,
  // or the remaining balance for a flat note.
  const nextPayment = debtIsLoan && monthlyEmi > 0
    ? monthlyEmi
    : outstanding;

  // When fully paid, look up the most-recently-used account from the
  // linked transactions and show its current balance — gives the user
  // a quick read on what the account looks like post-settlement.
  //
  // "Fully paid" is decided on OUTSTANDING principal, not gross paid.
  // On a loan-kind debt every payment includes interest, so gross paid
  // crosses the principal months before the loan is actually retired.
  const isFullyPaid = outstanding <= 0;
  const latestAccount = isFullyPaid
    ? state.transactions
        .filter(t => t.linkedDebtId === debt.id)
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date))[0]
    : undefined;
  const relatedAccount = latestAccount
    ? state.accounts.find(a => a.id === latestAccount.accountId)
    : undefined;
  const relatedAccountBalance = relatedAccount
    ? accountBalance(relatedAccount, state.transactions)
    : null;

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
      window.setTimeout(() => navigate('/debts'), 600);
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

  const serial = serialFor(debt.id);
  // A loan has no tear-off stub — the counterparty holds a bank
  // contract, not a slip. A flat IOU does.
  const tone = isIOwe ? 'var(--danger)' : 'var(--primary)';

  return (
    // Page-level layout: a full-width header (back-link + title +
    // description) on top, then the two-column page below — the IOU
    // slip and its edit pass (left) beside the activity ledger
    // (right).
    <div className="flex flex-col gap-6">
      <header>
        <div className="flex items-center gap-3 mb-2">
          <Link to="/debts" className="text-muted t-13 hover:text-ink transition">{'\u2190'} Debts</Link>
        </div>
        <div>
          <h1 className="heading h1-screen">Edit debt</h1>
        </div>
      </header>

      <div className="debt-page">
        {/* ═══ THE IOU SLIP ══════════════════════════════════ */}
        <div className="debt-page__col">

          {isFullyPaid && (
            <div
              className="t-13 rounded-btn px-3.5 py-3"
              style={{
                background: 'var(--success-callout-bg)',
                border: '1px solid var(--success)',
                boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--success) 35%, transparent)',
                color: 'var(--ink)',
              }}
            >
              <strong style={{ color: 'var(--success-title)' }}>Fully paid.</strong>{' '}
              {relatedAccount ? (
                <>
                  Last transaction used <span className="font-semibold">{relatedAccount.name}</span>
                  {' '}'—' current balance:{' '}
                  <span className="font-semibold tabular">{fmtBDT(relatedAccountBalance ?? 0)}</span>.
                </>
              ) : (
                'Nothing is left to collect on this debt.'
              )}
            </div>
          )}

          <section
            className={`debt-cert ${debtIsLoan ? 'debt-cert--plain' : ''}`}
            style={{ ['--tone' as string]: tone }}
          >
            <div className="debt-cert__head">
              <div className="min-w-0">
                <div className="debt-cert__name">{debt.name}</div>
                <div className="debt-cert__serial">
                  NO. {serial}
                  {/* The polarity is NOT repeated here. The stamp
                      already says "I owe" or "Owed to me"; printing it
                      twice on one document made the header read like
                      a form that could not decide. */}
                  {debt.person ? ` ${MIDDOT} ${debt.person.toUpperCase()}` : ''}
                </div>
              </div>
              {debtIsLoan && rate > 0 ? (
                <span className="debt-cert__seal" aria-label={`${rate}% APR`}>
                  <span className="p">{rate}%</span>
                  <span className="l">APR</span>
                </span>
              ) : (
                <span className="debt-cert__stamp" title={isIOwe ? 'You owe this person' : 'This person owes you'}>
                  {isIOwe ? 'I owe' : 'Owed to me'}
                </span>
              )}
            </div>

            {/* The engraved terms. A LOAN reports its instrument
                figures; a FLAT debt has none — it carries the
                counterparty and the amount instead, in the parallel
                row further down. */}
            {debtIsLoan && (
              <div className="debt-cert__fields">
                <div className="debt-cert__f">
                  <div className="k">Loan amount</div>
                  <div className="v">{fmtBDT(debtTotal)}</div>
                </div>
                <div className="debt-cert__f">
                  <div className="k">Interest paid</div>
                  <div className="v v--danger">{fmtBDT(totalInterest)}</div>
                </div>
                <div className="debt-cert__f">
                  <div className="k">Principal paid</div>
                  <div className="v v--primary">{fmtBDT(totalPrincipal)}</div>
                </div>
              </div>
            )}

            {/* The rail — the share of the PRINCIPAL already retired.
                It is the same bar the debts list card carries, and it
                measures the same thing: on a loan every payment also
                carried interest, so gross-paid-over-total would run
                ahead of the truth and could read 100% while principal
                was still outstanding. The bar shows principal, and the
                caption says so.

                A FLAT debt has no rail — it carries one figure, and a
                bar beside it would be a second measure competing for
                the same attention. */}
            {debtIsLoan && (
              <ProgressRail
                value={pct}
                state={pct >= 100 ? 'done' : pct > 0 ? 'active' : 'pending'}
                measure="principal settled"
                label={`${debt.name} settled`}
                caption={
                  pct <= 0 ? (
                    // Nothing paid yet — say so. "0%" is a number
                    // pretending to be a fact; "nothing paid yet" is the
                    // fact.
                    <>Nothing paid yet</>
                  ) : (
                    <>
                      <b className="text-ink font-semibold">{pct}%</b> of the principal settled
                    </>
                  )
                }
              />
            )}

            {/* The tally — the next payment the slip expects. */}
            {!isFullyPaid && nextPayment > 0 && (
              <div className="debt-cert__tally tabular">
                <span className="pip" aria-hidden />
                <span>
                  Next payment <b>{fmtBDT(nextPayment)}</b>
                  {debt.dueDate ? <> due <b>{fmtDate(debt.dueDate)}</b></> : null}
                </span>
              </div>
            )}

            {/* The closing figures. A FLAT debt carries the
                counterparty and the amount side by side — the two
                facts it owes the reader — and states the amount
                ONCE. It used to print the same figure twice, as
                "Outstanding" and as "Remaining payments". A LOAN
                reports its EMI beside what is still outstanding. */}
            {debtIsLoan ? (
              <div className="debt-cert__vals">
                <div className="debt-cert__v debt-cert__v--now">
                  <div className="k">Monthly payment</div>
                  <div className="n">{monthlyEmi > 0 ? fmtBDT(monthlyEmi) : '\u2014'}</div>
                </div>
                <div className="debt-cert__v debt-cert__v--mat" style={{ textAlign: 'right' }}>
                  <div className="k">Outstanding</div>
                  <div className="n">{outstanding > 0 ? fmtBDT(outstanding) : '\u2014'}</div>
                </div>
              </div>
            ) : (
              <div className="debt-cert__vals debt-cert__vals--flat">
                <div className="debt-cert__v debt-cert__v--now">
                  <div className="k">Amount due</div>
                  <div className="n">{fmtBDT(outstanding)}</div>
                </div>
                <div className="debt-cert__v debt-cert__v--mat">
                  {debt.person && (
                    <>
                      <div className="k">{isIOwe ? 'Owed to' : 'Owed by'}</div>
                      <div className="n">{debt.person}</div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* The footnote. Only the due date belongs here: the
                polarity of the ledger (payments are expenses, receipts
                are income) is stated once, in the ledger's own
                section, and repeating it here made the same sentence
                appear twice on one page. */}
            {debt.dueDate && (
              <div className="debt-cert__note">
                <strong>Due {fmtDate(debt.dueDate)}.</strong>
              </div>
            )}
          </section>

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
                <Button variant="outlined-ghost" type="button" onClick={() => navigate('/debts')}>Cancel</Button>
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

        {/* ═══ THE ACTIVITY LEDGER ═════════════════════════════ */}
        <div className="debt-page__col">
          <div className="debt-page__sect">Activity</div>

          {/* Activity — every transaction tagged with this debt, newest
              first. Hidden when there are no linked transactions so the
              page stays uncluttered for fresh debts. Sits in the right
              column at lg+, stacks below the form on smaller widths.
              Mirrors the Activity card in InvestmentDetailScreen
              (linked contributions + payouts), adapted for the debt
              semantics: i_owe expenses are "Payment" (danger tone),
              owed_to_me incomes are "Received" (primary tone). The
              opposite direction would mean a tagging mistake — we
              still render those rows so the user sees them, but flag
              them with a neutral tone. */}
          {linkedTx.length > 0 && (
            <section className="act-sheet">
              <div className="act-sheet__name">Activity</div>
              <div className="act-sheet__serial">
                {linkedTx.length} LINKED {linkedTx.length === 1 ? 'ENTRY' : 'ENTRIES'}
              </div>

              {/* Summary widgets — three small stats that mirror the slip's
                  visual rhythm so the two sheets sit at a similar height. All
                  values are derived from the linked transaction list. */}
              <div className="act-sheet__stats">
                <div className="act-sheet__stat">
                  <div className="k">Payments</div>
                  <div className="n">{matchingTx.length}</div>
                </div>
                <div className="act-sheet__stat">
                  <div className="k">Total paid</div>
                  <div className="n">{fmtBDT(totalPaid)}</div>
                </div>
                <div className="act-sheet__stat">
                  <div className="k">Last payment</div>
                  <div className="n n--sm">
                    {lastPaymentDate ? fmtDate(lastPaymentDate) : <span className="text-muted">—</span>}
                  </div>
                </div>
              </div>

              <div>
                {linkedTx.map(t => {
                  const acc = accountById.get(t.accountId ?? '');
                  // Tag tone: matches the directional flow the user
                  // expects. i_owe → expense is the normal "payment"
                  // (danger); owed_to_me → income is "received"
                  // (primary). Cross combinations are shown with a muted
                  // neutral tone so they stand out without alarming.
                  const tag =
                    isIOwe && t.type === 'expense'
                      ? { label: 'Payment',  cls: 'text-danger' }
                      : !isIOwe && t.type === 'income'
                      ? { label: 'Received', cls: 'text-primary' }
                      : isIOwe && t.type === 'income'
                      ? { label: 'Reversal', cls: 'text-warn' }
                      : { label: 'Adjust',   cls: 'text-muted' };
                  const amountColor =
                    t.type === 'income'
                      ? 'text-primary'
                      : t.type === 'expense'
                      ? 'text-danger'
                      : 'text-ink';
                  return (
                    <div key={t.id} className="act-row">
                      <div className="min-w-0">
                        <span className={`act-row__tag ${tag.cls}`}>
                          {tag.label}
                          <span className="text-muted font-semibold"> {MIDDOT} {fmtDate(t.date)}</span>
                        </span>
                        <div className={`act-row__amount ${amountColor}`}>
                          {fmtBDT(t.amount)}
                        </div>
                        <div className="act-row__where">
                          {acc?.name ?? '\u2014'}
                          {t.note ? ` ${MIDDOT} ${t.note}` : ''}
                        </div>
                        {/* V1.1 (L4.1): loan split line — only for loan-kind
                            debts, only on rows that actually contributed
                            (so cross-direction tagging mistakes don't add
                            noise). */}
                        {debt.kind === 'loan' && (() => {
                          const split = splitByTxId.get(t.id);
                          if (!split) return null;
                          const meaningful = split.interest > 0 || split.principal > 0;
                          if (!meaningful) return null;
                          return (
                            <div className="act-row__split">
                              <span className="i">{fmtBDT(split.interest)}</span> interest
                              {' '}{MIDDOT}{' '}
                              <span className="p">{fmtBDT(split.principal)}</span> principal
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="debt-cert__note" style={{ marginTop: 12 }}>
                {debt.direction === 'i_owe'
                  ? <>Payments you make toward this debt. Recorded as expenses tagged with this debt — usually via <strong>Add transaction → Expense</strong>.</>
                  : <>Payments you receive against this debt. Recorded as income tagged with this debt — usually via <strong>Add transaction → Income</strong>.</>}
              </div>
            </section>
          )}

          {/* The other direction, for contrast — only meaningful when
              the user also lends money, so it explains the polarity
              the ledger would use if this slip were flipped. */}
          <section className="act-sheet">
            <div className="act-sheet__name">
              {isIOwe ? 'Owed to me' : 'I owe'}
            </div>
            <div className="act-sheet__serial">
              {isIOwe ? 'RECEIVABLE' : 'PAYABLE'} {MIDDOT} THE OTHER DIRECTION
            </div>

            <div style={{ margin: '14px 0 4px' }}>
              <div className="act-row">
                <div className="min-w-0">
                  <span className={`act-row__tag ${isIOwe ? 'text-primary' : 'text-danger'}`}>
                    {isIOwe ? 'Received' : 'Payment'}
                  </span>
                  <div className="act-row__amount text-muted">
                    {isIOwe
                      ? 'Payments you receive are recorded as income.'
                      : 'Payments you make are recorded as expenses.'}
                  </div>
                </div>
              </div>
            </div>

            {/* The colour key — the one thing the row above does NOT
                say. The polarity (income vs expense) is stated once,
                in the row; this adds only what the row cannot: which
                colour means which direction. */}
            <div className="debt-cert__note" style={{ marginTop: 10 }}>
              <strong>Received</strong> is green; <strong>Payment</strong> is red.
            </div>
          </section>
        </div>
      </div>

      {dialog}
    </div>
  );
}
