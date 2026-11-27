/**
 * InvestmentDetailScreen — read an investment as a bank certificate.
 *
 * An investment is a CONTRACT WITH A BANK, so the detail screen is
 * the instrument itself: a perforated bond certificate carrying
 * engraved terms, a serial number, a rate seal, a maturity rail and
 * the two numbers the holder cares about — what the bank would pay
 * today, and what it owes at maturity.
 *
 * What the old screen lacked was a sense of TIME, so the rail now
 * runs from the day the holding started to the day it matures, with
 * a marker at today's position.
 *
 * Layout (two columns):
 *   LEFT
 *     - the CERTIFICATE — head, seal, engraved terms, the
 *       contribution tally, the maturity rail, the two values and
 *       the projection footnote;
 *     - "WHEN IT MATURES" — the three ways out, each a labelled
 *       line, with the payout / renew / retire actions;
 *     - the DANGER ZONE.
 *   RIGHT
 *     - the ACTIVITY LEDGER — every contribution and payout.
 *
 * The edit pass lives on its own screen (`/investments/:id/edit`),
 * so this one stays a document you READ.
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../domain/store';
import * as investments from '../domain/investments';
import * as accounts from '../domain/accounts';
import {
  deriveInvestmentStatus,
  daysToMaturity,
  investmentMaturityDate,
  investmentMaturityValueTyped,
  dpsContributedSoFar,
  dpsLedger,
  dpsPaidOutSoFar,
  dpsCurrentValue,
  dpsMaturityValue,
} from '../domain/math';
import { fmtBDT, fmtDate } from '../lib/format';
import { formatDuration } from '../domain/duration';
import { Button } from '../components/Button';
import { Field, Input } from '../components/Field';
import { useConfirm } from '../components/ConfirmDialog';
import { isPositiveMoney, POSITIVE_MONEY_ERROR } from '../lib/validation';
import { Pill } from '../components/Pill';
import type { Account, Investment } from '../domain/types';

const MIDDOT = '\u00B7';

/** The document's serial number — a stable hash of the id. */
function serialFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) % 999999;
  }
  return String(hash).padStart(6, '0');
}

/** The type as the document names it. */
function typeLabel(inv: Investment): string {
  return inv.type === 'dps' ? 'DPS' : inv.type === 'fdr' ? 'FDR' : 'SAVINGS';
}

/** Each investment type wears its own tone. */
function toneFor(inv: Investment): string {
  return inv.type === 'dps' ? 'var(--primary)' : inv.type === 'fdr' ? 'var(--accent)' : 'var(--info)';
}

/**
 * How long is left, in the unit a reader would use.
 *
 * Years for a term measured in years ("~4.8Y"), but days and months
 * for the short ones — "0.1Y" of a 60-month DPS reads as nonsense
 * when the bank has 40 days left to pay.
 */
function remainingLabel(days: number): string {
  const left = Math.abs(Math.round(days));
  if (left >= 365) return `~${(left / 365).toFixed(1)}Y`;
  if (left >= 60) return `~${Math.round(left / 30)}MO`;
  return `~${left}D`;
}

export function InvestmentDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const state = useStore(s => s.state);
  const update = useStore(s => s.update);
  const showBanner = useStore(s => s.showBanner);
  const { confirm, dialog } = useConfirm();
  const accs = accounts.list(state);
  const inv = investments.get(state, id!);

  // DPS contribution form state.
  const [contribAmount, setContribAmount] = useState('');
  const [contribDate, setContribDate] = useState(new Date().toISOString().slice(0, 10));
  const [contribAccount, setContribAccount] = useState(accs[0]?.id ?? '');
  const [contribNote, setContribNote] = useState('');
  const [showContributeForm, setShowContributeForm] = useState(false);

  if (!inv) {
    return (
      <div className="text-muted">
        Investment not found.{' '}
        <button className="underline" onClick={() => navigate('/investments')}>Back to investments</button>
      </div>
    );
  }

  const status = deriveInvestmentStatus(inv);
  const mat = investmentMaturityDate(inv);
  const days = daysToMaturity(inv);
  const projected = investmentMaturityValueTyped(inv);
  const isDps = inv.type === 'dps';
  const contribs = state.transactions.filter(
    t => t.linkedInvestmentId === inv.id && t.type === 'expense'
  );
  const payouts = state.transactions.filter(
    t => t.linkedInvestmentId === inv.id && t.type === 'income'
  );
  const contributed = isDps ? dpsContributedSoFar(inv, state.transactions) : 0;
  const paidOut = dpsPaidOutSoFar(inv, state.transactions);
  const currentValue = isDps ? dpsCurrentValue(inv, state.transactions) : 0;
  const expectedInterest = isDps
    ? Math.max(0, dpsMaturityValue(inv) - (Number(inv.monthlyContribution) || 0) * (Number(inv.termMonths) || 0))
    : Math.max(0, projected - (Number(inv.principal) || 0));
  const payoutAcc = accs.find(a => a.id === inv.payoutAccountId);
  const tone = toneFor(inv);

  // ── The contribution tally ─────────────────────────────────────
  // "Contributed ৳ 85,000 of ৳ 3,00,000 · 14 of 60 installments" —
  // how much has gone in, and how much of the schedule that is.
  const totalDue = isDps
    ? (Number(inv.monthlyContribution) || 0) * (Number(inv.termMonths) || 0)
    : (Number(inv.principal) || 0);

  // ── The ledger ─────────────────────────────────────────────────
  // The deposits schedule: how many installments are paid, when
  // the next one is due, and how much has gone in.
  const ledger = isDps ? dpsLedger(inv, state.transactions) : null;

  // The share of the schedule that has been paid in. This is the
  // one number the bar on the certificate reports.
  const depositsPct = isDps && (Number(inv.termMonths) || 0) > 0
    ? Math.max(0, Math.min(100, Math.round((contribs.length / (Number(inv.termMonths) || 0)) * 100)))
    : 0;

  // Whether the lump sum has gone in. On an FDR the money goes in
  // once, so this is the whole story.
  const deposited = !isDps && (Number(inv.principal) || 0) > 0;

  async function onContribute(e: React.FormEvent) {
    e.preventDefault();
    if (!(Number(contribAmount) > 0)) {
      showBanner({
        kind: 'error',
        what: 'Amount must be greater than zero',
        why: 'You can\'t contribute nothing.',
        fix: 'Enter a positive amount.',
      });
      return;
    }
    if (!contribAccount) {
      showBanner({
        kind: 'error',
        what: 'Pick an account',
        why: 'Contributions need an account to come from.',
        fix: 'Select the source account.',
      });
      return;
    }
    try {
      update(s => investments.addContribution(s, inv!.id, {
        amount: Number(contribAmount),
        date: contribDate,
        accountId: contribAccount,
        note: contribNote.trim() || undefined,
      }));
      setContribAmount('');
      setContribNote('');
      setShowContributeForm(false);
      const total = contributed + Number(contribAmount);
      showBanner({
        kind: 'success',
        what: `${fmtBDT(contribAmount)} toward ${inv!.name}`,
        why: 'Recorded as an expense transaction linked to this investment.',
        fix: `${fmtBDT(total)} contributed so far.`,
      });
    } catch (err) {
      showBanner({
        kind: 'error',
        what: 'Could not record contribution',
        why: (err as Error).message,
        fix: 'Try again.',
      });
    }
  }

  async function onClose() {
    const ok = await confirm({
      title: 'Close this investment?',
      body: 'Marks the investment as closed. The record stays for history, but it won\'t appear in active summaries.',
      confirmLabel: 'Close investment',
      danger: true,
    });
    if (!ok) return;
    update(s => investments.close(s, inv!.id));
    showBanner({
      kind: 'success',
      what: `${inv!.name} closed`,
      why: 'It\'s been moved out of the active list.',
      fix: 'Open Investments to see closed items.',
    });
  }

  async function onRollover() {
    const ok = await confirm({
      title: 'Roll over into a new term?',
      body: 'A new investment is created starting the day after this one matures. Terms and rate carry over.',
      confirmLabel: 'Roll over',
    });
    if (!ok) return;
    update(s => investments.rollover(s, inv!.id));
    showBanner({
      kind: 'success',
      what: `${inv!.name} rolled over`,
      why: 'A new investment with the same terms starts after maturity.',
      fix: 'Open Investments to see the new one.',
    });
  }

  function onRecordPayout() {
    // Deep-link to the Add Income form with everything prefilled so the
    // user records the actual bank payout as a single income transaction.
    // Saving the form auto-closes the investment via recompute (when
    // payouts >= remaining).
    //
    // What "remaining" means depends on the type:
    //   - DPS: currentValue (compounded to today) - paidOut so far.
    //     The bank can pay out early at the current value, and the user
    //     may have already recorded partial payouts.
    //   - FDR / savings: maturityValue (principal + simple interest) -
    //     paidOut so far. The bank pays the full maturity value on the
    //     maturity date; subtract anything already taken.
    if (!inv?.payoutAccountId) return;
    const remainingBase = isDps ? currentValue : projected;
    const remaining = Math.max(0, remainingBase - paidOut);
    const label = isDps ? 'DPS payout' : 'maturity payout';
    const params = new URLSearchParams({
      amount: String(Math.round(remaining)),
      accountId: inv.payoutAccountId,
      linkedInvestmentId: inv.id,
      note: `${label} — ${inv.name}`,
    });
    navigate(`/transactions/new/income?${params.toString()}`);
  }

  async function onDelete() {
    const ok = await confirm({
      title: 'Delete this investment?',
      body: `${contribs.length} linked contribution transactions stay in your records. Only the investment record is removed.`,
      confirmLabel: 'Delete investment',
      danger: true,
    });
    if (!ok) return;
    update(s => investments.remove(s, inv!.id));
    showBanner({
      kind: 'success',
      what: 'Investment deleted',
      why: 'Linked contributions remain in your transactions.',
      fix: 'Open Home or Transactions to see them.',
    });
    navigate('/investments');
  }

  const activity = [...contribs, ...payouts]
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex items-center gap-3">
        <Link to="/investments" className="text-muted t-13 hover:text-ink transition">{'\u2190'} Investments</Link>
      </div>

      {/* ═══ THE HEADER ═══════════════════════════════════════ */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3">
        <div>
          <div className="t-13 text-muted flex items-center gap-2">
            <span className="uppercase tracking-wider">{inv.type}</span>
            {isDps && inv.monthlyContribution ? (
              <Pill tone="primary" variant="solid">
                {fmtBDT(inv.monthlyContribution)}/mo
              </Pill>
            ) : null}
          </div>
          <h1 className="heading h1-screen mt-1">{inv.name}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {isDps && status === 'active' && accs.length > 0 && (
            <button
              type="button"
              onClick={() => setShowContributeForm(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-btn font-bold t-13 text-primary-on hover:opacity-95 active:translate-y-px transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              style={{ background: 'var(--primary)' }}
            >
              + Add a contribution
            </button>
          )}
          {status === 'active' && (
            <Link to={`/investments/${inv!.id}/edit`} className="inline-flex items-center justify-center gap-2 px-[18px] py-2.5 rounded-btn font-bold t-13 bg-surface text-ink border border-border hover:bg-surface-2 transition">
              Edit
            </Link>
          )}
        </div>
      </div>

      <div className="inv-page">
        {/* ═══ THE LEFT COLUMN ═════════════════════════════════ */}
        <div className="inv-page__col">
          {/* ─── THE CERTIFICATE ─────────────────────────────── */}
          <section className="inv-cert" style={{ ['--tone' as string]: tone }}>
            <div className="inv-cert__head">
              <div className="min-w-0">
                <div className="inv-cert__name">{inv.name}</div>
                <div className="inv-cert__serial">
                  NO. {serialFor(inv.id)} {MIDDOT} {typeLabel(inv)}
                  {inv.institution ? ` ${MIDDOT} ${inv.institution.toUpperCase()}` : ''}
                  {status === 'active' && mat
                    ? ` ${MIDDOT} MATURES IN ${remainingLabel(days)}`
                    : ''}
                  {status === 'closed' || status === 'rolled_over' || status === 'matured'
                    ? ` ${MIDDOT} ENDED ${mat ? fmtDate(mat.toISOString().slice(0, 10)).toUpperCase() : ''}`
                    : ''}
                </div>
              </div>
              {status === 'active' ? (
                <div className="inv-cert__seal">
                  <div className="p">{inv.rate}%</div>
                  <div className="l">RATE</div>
                </div>
              ) : (
                <div className="inv-cert__stamp" style={{ ['--tone' as string]: 'var(--muted)' }}>
                  {status === 'matured' ? 'Matured' : status === 'rolled_over' ? 'Rolled' : 'Closed'}
                </div>
              )}
            </div>

            {/* The engraved terms. The rate is NOT one of them: it
                lives in the seal above, in the way an engraved rate
                lives on a real instrument. Printing it here too
                meant the same number appeared twice on one
                certificate, and a reader landing on the second copy
                stopped trusting the first. */}
            <div className="inv-cert__fields inv-cert__fields--pair">
              {isDps ? (
                <>
                  <div className="inv-cert__f">
                    <div className="k">Monthly contribution</div>
                    <div className="v">{fmtBDT(inv.monthlyContribution || 0)}</div>
                  </div>
                  <div className="inv-cert__f">
                    <div className="k">Term</div>
                    <div className="v">{formatDuration(inv.termMonths)}</div>
                  </div>
                </>
              ) : (
                <>
                  <div className="inv-cert__f">
                    <div className="k">Principal</div>
                    <div className="v">{fmtBDT(inv.principal)}</div>
                  </div>
                  <div className="inv-cert__f">
                    <div className="k">Term</div>
                    <div className="v">
                      {inv.termDays
                        ? `${inv.termDays} days`
                        : formatDuration(inv.termMonths)}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* ═══ THE DEPOSIT FACTS ═══════════════════════════
                NO progress bar on this page.

                The certificate used to carry TWO bars stacked on top
                of each other with nothing to tell them apart, and
                that was genuinely confusing: the reader saw two
                amber lines and had no way to know which was the money
                and which was the clock. The second one — the term —
                is gone entirely, and then so is the first.

                The rule is simple: a progress bar belongs on a
                LIVE item's own page — the loan, the debt, the DPS.
                Those are the things where money keeps moving, so a
                bar tracking them tracks something that actually
                changes. An FDR or a savings account is not live: the
                money goes in ONCE, on day one, and then it simply
                waits. A bar there would be a bar stuck at 0% or 100%
                forever — a decoration pretending to be a
                measurement. So a lump sum gets its deposit stated as
                a FACT, in words, with no bar at all. */}
            <div className="inv-cert__ledger">
              <div className="inv-cert__ledger-head">
                <span className="t">{isDps ? 'Deposits' : 'Deposit'}</span>
                <span className="n">
                  {isDps
                    ? `${contribs.length} of ${inv.termMonths} paid`
                    : deposited ? '1 lump sum' : 'Nothing yet'}
                </span>
              </div>
              {isDps && (
                <div
                  className="inv-cert__deposits"
                  role="progressbar"
                  aria-valuenow={depositsPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${inv.name} deposits made`}
                >
                  {/* An empty bar paints no fill — a zero-width fill with a
                      hairline edge still shows as a speck at the start of
                      the track, which reads as a stray mark rather than as
                      "no deposits yet". */}
                  {depositsPct > 0 && <i style={{ width: `${depositsPct}%` }} />}
                </div>
              )}
              <div className="inv-cert__ledger-note">
                {isDps ? (
                  <>
                    <b>{fmtBDT(contributed)}</b> of {fmtBDT(totalDue)} in
                    {contribs.length > 0 && ledger?.nextDueDate ? (
                      <> {MIDDOT} next due <b>{fmtDate(ledger.nextDueDate)}</b></>
                    ) : null}
                  </>
                ) : deposited ? (
                  <>
                    <b>{fmtBDT(Number(inv.principal) || 0)}</b> deposited
                    {MIDDOT} matures{' '}
                    <b>{mat ? fmtDate(mat.toISOString().slice(0, 10)) : '—'}</b>
                  </>
                ) : (
                  <>
                    <b>Nothing deposited yet</b>
                    {MIDDOT} matures{' '}
                    <b>{mat ? fmtDate(mat.toISOString().slice(0, 10)) : '—'}</b>
                  </>
                )}
              </div>
            </div>

            <div className="inv-cert__vals">
              {isDps ? (
                <>
                  <div className="inv-cert__v inv-cert__v--now">
                    <div className="k">Current value</div>
                    <div className="n">{fmtBDT(currentValue)}</div>
                    <div className="c">compounded to today</div>
                  </div>
                  <div className="inv-cert__v inv-cert__v--mat">
                    <div className="k">Estimated payout</div>
                    <div className="n">{fmtBDT(projected)}</div>
                    <div className="c">if every installment is paid</div>
                  </div>
                </>
              ) : (
                <>
                  {paidOut > 0 && (
                    <div className="inv-cert__v">
                      <div className="k">Paid out</div>
                      <div className="n">{fmtBDT(paidOut)}</div>
                    </div>
                  )}
                  <div className="inv-cert__v inv-cert__v--mat">
                    <div className="k">Maturity value</div>
                    <div className="n">{fmtBDT(projected)}</div>
                    <div className="c">
                      {fmtBDT(inv.principal)} principal + {fmtBDT(expectedInterest)} interest
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>

          {/* ─── WHEN IT MATURES ─────────────────────────────── */}
          {(status === 'active' || status === 'matured') && (
            <section className="inv-cert" style={{ ['--tone' as string]: 'var(--accent)' }}>
              <div className="inv-cert__head">
                <div className="min-w-0">
                  <div className="inv-cert__name">When it matures</div>
                  <div className="inv-cert__serial">THREE WAYS OUT</div>
                </div>
                <div className="inv-cert__seal" style={{ ['--tone' as string]: 'var(--accent)' }}>
                  <div className="p">৳</div>
                  <div className="l">PAYOUT</div>
                </div>
              </div>

              {/* Three ways out, each SELF-CONTAINED: the option says
                  what it does, and carries its own action. Pooling the
                  buttons underneath made the reader match a label to
                  a button by eye — three names floating above three
                  unrelated buttons. Here the button sits beside the
                  thing it does. */}
              <div className="maturity-opts">
                <div className="maturity-opt maturity-opt--lead">
                  <div className="maturity-opt__body">
                    <div className="maturity-opt__k">Record bank payout</div>
                    <div className="maturity-opt__v">
                      Opens the income form with the payout pre-filled
                      {payoutAcc ? <> and {payoutAcc.name} already chosen</> : null}.
                    </div>
                  </div>
                  <Button
                    variant="primary"
                    onClick={onRecordPayout}
                    disabled={!inv.payoutAccountId || (isDps ? currentValue : projected) - paidOut <= 0}
                  >
                    Record payout
                  </Button>
                </div>

                <div className="maturity-opt">
                  <div className="maturity-opt__body">
                    <div className="maturity-opt__k">Renew for another term</div>
                    <div className="maturity-opt__v">
                      Starts a fresh {typeLabel(inv)} the day after this one ends, same terms and rate.
                    </div>
                  </div>
                  <Button variant="secondary" onClick={onRollover}>Renew</Button>
                </div>

                <div className="maturity-opt">
                  <div className="maturity-opt__body">
                    <div className="maturity-opt__k">Mark as done</div>
                    <div className="maturity-opt__v">
                      Retires the record — for when you already received the money elsewhere.
                    </div>
                  </div>
                  {/* The retire button stays available even after a
                      payout — for an FDR the record is not retired
                      automatically, so the user closes it by hand. */}
                  <Button variant="secondary" onClick={onClose}>Mark done</Button>
                </div>
              </div>

              {!inv.payoutAccountId && (
                <div className="mt-3 t-12 text-warn bg-warn-soft border border-warn rounded-lg px-3 py-2">
                  Choose which <strong>account receives the money</strong> when the bank pays out this
                  {inv.type.toUpperCase()}.{' '}
                  <Link to={`/investments/${inv.id}/edit`} className="underline font-semibold">Edit the investment</Link>{' '}
                  to add one — without it, the bank has nowhere to send the money back.
                </div>
              )}

              <div className="inv-cert__note">
                <strong>Record bank payout</strong> saves as Income and auto-closes this
                {' '}{typeLabel(inv)} once it is fully paid back.
              </div>
            </section>
          )}

          {/* ─── THE DANGER ZONE ─────────────────────────────── */}
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
              Removes the investment record only. The {contribs.length} linked contribution
              transactions stay in your records.
            </p>
            <Button variant="outlined-danger" onClick={onDelete}>Delete investment</Button>
          </section>
        </div>

        {/* ═══ THE RIGHT COLUMN ════════════════════════════════ */}
        <div className="inv-page__col">
          <div className="inv-page__sect">Activity</div>

          <section className="act-sheet">
            <div className="act-sheet__name">Activity</div>
            <div className="act-sheet__serial">
              {activity.length} {activity.length === 1 ? 'ENTRY' : 'ENTRIES'}
            </div>

            {activity.length > 0 ? (
              <>
                <div className="act-sheet__stats">
                  <div className="act-sheet__stat">
                    <div className="k">Contributions</div>
                    <div className="n">{contribs.length}</div>
                  </div>
                  <div className="act-sheet__stat">
                    <div className="k">Total paid in</div>
                    <div className="n">{fmtBDT(contributed)}</div>
                  </div>
                  <div className="act-sheet__stat">
                    <div className="k">Paid out</div>
                    <div className="n">{fmtBDT(paidOut)}</div>
                  </div>
                </div>

                <div className="act-sheet__rows">
                  {activity.map(t => {
                    const acc = accs.find(a => a.id === t.accountId);
                    const isPayout = t.type === 'income';
                    return (
                      <div className="act-row" key={t.id}>
                        <div>
                          <span
                            className="act-row__tag"
                            style={{ color: isPayout ? 'var(--success)' : 'var(--primary)' }}
                          >
                            {isPayout ? 'Payout' : 'Contribution'} {MIDDOT} {fmtDate(t.date)}
                          </span>
                          <div className="act-row__amount">{fmtBDT(t.amount)}</div>
                          <div className="act-row__where">
                            {acc ? acc.name : '—'}
                            {t.note ? ` ${MIDDOT} ${t.note}` : ''}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="act-sheet__rows">
                <div className="t-12 text-muted py-2">
                  Nothing recorded yet — contributions and payouts will appear here.
                </div>
              </div>
            )}

            <div className="debt-cert__note" style={{ marginTop: 12 }}>
              Contributions are expenses; payouts are income. Both stay linked to this
              investment.
            </div>
          </section>
        </div>
      </div>

      {dialog}
      {isDps && status === 'active' && accs.length > 0 && showContributeForm && (
        <ContributeModal
          investment={inv}
          accountOptions={accs}
          contribAmount={contribAmount}
          setContribAmount={setContribAmount}
          contribDate={contribDate}
          setContribDate={setContribDate}
          contribAccount={contribAccount}
          setContribAccount={setContribAccount}
          contribNote={contribNote}
          setContribNote={setContribNote}
          onClose={() => { setShowContributeForm(false); setContribAmount(''); setContribNote(''); }}
          onSubmit={onContribute}
        />
      )}
    </div>
  );
}

/**
 * ContributeModal — modal for recording a DPS contribution.
 *
 * Rendered into document.body via portal so it overlays the rest of
 * the page. Escape and backdrop click close the modal without
 * recording. Submit is handled by the parent (onSubmit), which also
 * closes the modal on success.
 */
interface ContributeModalProps {
  investment: Investment;
  accountOptions: Account[];
  contribAmount: string;
  setContribAmount: (v: string) => void;
  contribDate: string;
  setContribDate: (v: string) => void;
  contribAccount: string;
  setContribAccount: (v: string) => void;
  contribNote: string;
  setContribNote: (v: string) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

function ContributeModal({
  investment,
  accountOptions,
  contribAmount,
  setContribAmount,
  contribDate,
  setContribDate,
  contribAccount,
  setContribAccount,
  contribNote,
  setContribNote,
  onClose,
  onSubmit,
}: ContributeModalProps) {
  // Inline guard (spine: ux-finora-2026-08-14-negative-guard).
  const amountInvalid = !isPositiveMoney(contribAmount);
  const amountErrorClass = amountInvalid
    ? 'border-danger focus:border-danger focus:ring-danger/30'
    : '';

  // Escape-to-close. The dependency on `onClose` would re-run this on every
  // parent render because the parent passes a fresh arrow function each time;
  // capturing `onClose` via ref avoids that without lint warnings.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="contribute-title"
    >
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
        style={{ background: 'var(--overlay)', backdropFilter: 'blur(6px)' }}
      />
      <form
        onSubmit={onSubmit}
        className="relative bg-surface border border-border rounded-card p-7 w-[420px] max-w-[90vw] shadow-modal flex flex-col gap-5"
      >
        <h3 id="contribute-title" className="heading h3-modal m-0">Add a contribution</h3>
        <p className="t-13 text-muted m-0 -mt-3">
          Records an expense from the chosen account and links it to this DPS.
        </p>
        <Field
          label="Amount"
          hint={`Plan: ${fmtBDT(investment.monthlyContribution || 0)} / month`}
          error={amountInvalid ? POSITIVE_MONEY_ERROR : undefined}
        >
          <Input
            type="number"
            inputMode="decimal"
            value={contribAmount}
            onChange={e => setContribAmount(e.target.value)}
            placeholder={String(investment.monthlyContribution || 0)}
            autoFocus
            aria-invalid={amountInvalid || undefined}
            className={amountErrorClass}
          />
        </Field>
        <Field label="Date">
          <Input type="date" value={contribDate} onChange={e => setContribDate(e.target.value)} />
        </Field>
        <Field label="From account">
          <select
            value={contribAccount}
            onChange={e => setContribAccount(e.target.value)}
            className="w-full bg-surface-2 border border-border text-ink rounded-btn px-[14px] py-3 t-13 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/40"
          >
            {accountOptions.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Note (optional)">
          <Input
            value={contribNote}
            onChange={e => setContribNote(e.target.value)}
            placeholder="October installment…"
          />
        </Field>
        <div className="flex gap-2.5 justify-end mt-2">
          <Button variant="outlined-ghost" type="button" onClick={onClose}>Cancel</Button>
          <Button variant="outlined-primary" type="submit" disabled={amountInvalid}>Record contribution</Button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
