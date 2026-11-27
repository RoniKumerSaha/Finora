/**
 * DebtDetailScreen — read a debt as an IOU slip.
 *
 * A debt is a document you READ, so this screen is the slip itself:
 * the perforated certificate carrying the engraved terms, the stamp
 * that says which way the money runs, the rail that tracks what has
 * been settled, and the closing figures. Beside it, the ACTIVITY
 * LEDGER — the running account of every payment against this debt.
 *
 * The EDIT pass lives on its own screen (`/debts/:id/edit`), so this
 * one stays a document you READ. That is the same split the
 * investment side uses: a certificate is read, and a contract is
 * written on somewhere else.
 *
 * Layout (two columns):
 *   LEFT
 *     - the IOU SLIP — head, stamp or APR seal, engraved terms, the
 *       settlement rail, the closing figures;
 *     - the DANGER ZONE.
 *   RIGHT
 *     - the ACTIVITY LEDGER — every payment and receipt.
 */
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../domain/store';
import * as debts from '../domain/debts';
import { accountBalance, debtOutstanding, loanEMI, loanPaymentSplit } from '../domain/math';
import { fmtBDT, fmtDate } from '../lib/format';
import { Button } from '../components/Button';
import { useConfirm } from '../components/ConfirmDialog';
import { ProgressRail } from '../components/planner/ProgressRail';

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

export function DebtDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const state = useStore(s => s.state);
  const update = useStore(s => s.update);
  const showBanner = useStore(s => s.showBanner);
  const { confirm, dialog } = useConfirm();
  const debt = debts.get(state, id!);

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
  // income as "Received".
  const linkedTx = state.transactions
    .filter(t => t.linkedDebtId === debt.id)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));
  const accountById = new Map(state.accounts.map(a => [a.id, a]));

  const isIOwe = debt.direction === 'i_owe';
  const matchingTx = linkedTx.filter(t =>
    isIOwe ? t.type === 'expense' : t.type === 'income'
  );
  const totalPaid = matchingTx.reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const lastPaymentDate = matchingTx[0]?.date;

  // Per-row loan split — for loan-kind debts only. We replay the
  // transactions in chronological (oldest-first) order, tracking the
  // running outstanding, and stash each transaction's
  // {interest, principal} split so the row can render it.
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
  // linked transactions and show its current balance.
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
  const tone = isIOwe ? 'var(--danger)' : 'var(--primary)';

  return (
    // Page-level layout: a full-width header (back-link + title +
    // actions) on top, then the two-column page below — the IOU slip
    // (left) beside the activity ledger (right).
    <div className="flex flex-col gap-6">
      <header>
        <div className="flex items-center gap-3 mb-2">
          <Link to="/debts" className="text-muted t-13 hover:text-ink transition">{'\u2190'} Debts</Link>
        </div>
        <div className="flex flex-wrap justify-between items-end gap-3">
          <h1 className="heading h1-screen">{debt.name}</h1>
          <div className="flex flex-wrap gap-2">
            <Link
              to={`/debts/${debt.id}/edit`}
              className="inline-flex items-center justify-center gap-2 px-[18px] py-2.5 rounded-btn font-bold t-13 bg-surface text-ink border border-border hover:bg-surface-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              Edit
            </Link>
          </div>
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
                ONCE. A LOAN reports its EMI beside what is still
                outstanding. */}
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
              page stays uncluttered for fresh debts. Mirrors the
              Activity card in InvestmentDetailScreen (linked
              contributions + payouts), adapted for the debt
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

              {/* Summary widgets — three small stats that mirror the
                  slip's visual rhythm so the two sheets sit at a
                  similar height. All values are derived from the
                  linked transaction list. */}
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
                        {/* Loan split line — only for loan-kind debts,
                            only on rows that actually contributed (so
                            cross-direction tagging mistakes don't add
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
