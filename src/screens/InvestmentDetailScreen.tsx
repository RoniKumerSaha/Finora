/**
 * InvestmentDetailScreen — read-only investment detail with actions.
 *
 * Visual target: v1 design system (Fraunces headings, surface cards,
 * tabular numerals). Type-aware: DPS shows "current value" compounded
 * to today, monthly contribution chip, projected maturity via
 * annuity-due. FDR/savings shows simple-interest maturity.
 *
 * Sections:
 *   - Header + status chip + Edit button
 *   - Headline card: type, rate, term, days to maturity
 *   - Money card: principal/principal+contributed, projected/current,
 *     expected interest
 *   - DPS contribution panel (when type === 'dps')
 *   - Status actions: Contribute (DPS/active), Close, Rollover, Delete
 *   - Contribution history
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
  dpsPaidOutSoFar,
  dpsCurrentValue,
  dpsMaturityValue,
} from '../domain/math';
import { fmtBDT, fmtDate } from '../lib/format';
import { Button } from '../components/Button';
import { Field, Input } from '../components/Field';
import { useConfirm } from '../components/ConfirmDialog';
import type { Account, Investment } from '../domain/types';

const MIDDOT = '\u00B7';

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
        what: `+ ${fmtBDT(contribAmount)} toward ${inv!.name}`,
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

  return (
    <div className="flex flex-col gap-[18px] max-w-[640px]">
      <div className="flex items-center gap-3">
        <Link to="/investments" className="text-muted text-sm hover:text-ink">{'\u2190'} Investments</Link>
      </div>

      {/* Header */}
      <div className="flex justify-between items-end gap-3">
        <div>
          <div className="text-[13px] text-muted flex items-center gap-2">
            <span>{invEmoji(inv.type)}</span>
            <span className="uppercase tracking-wider">{inv.type}</span>
            {isDps && inv.monthlyContribution ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-pill text-[11px] font-semibold bg-primary-soft text-primary">
                {fmtBDT(inv.monthlyContribution)}/mo
              </span>
            ) : null}
          </div>
          <h1 className="heading h1-screen mt-1">{inv.name}</h1>
        </div>
        <div className="flex gap-2">
          {isDps && status === 'active' && accs.length > 0 && (
            <button
              type="button"
              onClick={() => setShowContributeForm(true)}
              className="inline-flex items-center justify-center gap-2 px-[18px] py-3 rounded-btn font-bold text-sm bg-primary text-primary-on hover:opacity-90"
            >
              + Add a contribution
            </button>
          )}
          {status === 'active' && (
            <Link to={`/investments/${inv!.id}/edit`} className="inline-flex items-center justify-center gap-2 px-[18px] py-3 rounded-btn font-bold text-sm bg-surface text-ink border border-border hover:bg-surface-2">
              Edit
            </Link>
          )}
        </div>
      </div>

      {/* Status + countdown */}
      <section className="bg-surface border border-border rounded-card p-6 shadow-card">
        <div className="flex justify-between items-start mb-3">
          <div>
            <div className="text-[11px] text-muted uppercase tracking-wider">Status</div>
            <div className="mt-1"><StatusChip status={status} /></div>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-muted uppercase tracking-wider">
              {status === 'matured' ? 'Matured on' : status === 'closed' || status === 'rolled_over' ? 'Term ended' : 'Matures on'}
            </div>
            <div className="text-2xl font-bold text-ink tabular mt-1">
              {mat ? fmtDate(mat.toISOString().slice(0, 10)) : '—'}
            </div>
          </div>
        </div>
        {status === 'active' && (
          <div className="text-[13px] text-muted">
            {days > 0 ? `Matures in ${days} day${days === 1 ? '' : 's'}.`
              : days === 0 ? 'Matures today.'
              : `Matured ${-days} day${days === -1 ? '' : 's'} ago.`}
          </div>
        )}
        {inv.institution && (
          <div className="text-[13px] text-muted mt-1">
            Held at <span className="text-ink font-semibold">{inv.institution}</span>.
          </div>
        )}
        {payoutAcc && (
          <div className="text-[13px] text-muted mt-1">
            Payout account: <span className="text-ink font-semibold">{payoutAcc.name}</span>.
          </div>
        )}
      </section>

      {/* Money */}
      <section className="bg-surface border border-border rounded-card p-6 shadow-card">
        <h2 className="heading h3-modal mb-3">{isDps ? 'Plan vs progress' : 'Maturity'}</h2>
        <div className="grid grid-cols-2 gap-4">
          {!isDps && (
            <Stat label="Principal" value={fmtBDT(inv.principal)} />
          )}
          {isDps && (
            <>
              <Stat label="Contributed so far" value={fmtBDT(contributed)} />
              <Stat label="Current value" value={fmtBDT(currentValue)} hint="Compounded to today" />
            </>
          )}
          {paidOut > 0 && (
            <Stat label="Paid out" value={fmtBDT(paidOut)} hint="Linked income transactions" />
          )}
          <Stat
            label={isDps ? 'Projected at maturity' : 'Maturity value'}
            value={fmtBDT(projected)}
            accent
            hint={isDps ? 'If you complete every month' : 'Simple interest'}
          />
          <Stat label="Expected interest" value={fmtBDT(expectedInterest)} />
          <Stat label="Rate" value={`${inv.rate}% / yr`} />
        </div>
        {isDps && (
          <div className="mt-4 text-[12px] text-muted leading-relaxed">
            Maturity uses annuity-due: <span className="tabular">{fmtBDT(inv.monthlyContribution || 0)} × ((1 + r)^T − 1) / r × (1 + r)</span>
            {' '}where r = {inv.rate}%/12 and T = {inv.termMonths} months.
          </div>
        )}
        {!isDps && (
          <div className="mt-4 text-[12px] text-muted leading-relaxed">
            Maturity uses simple interest: principal × (1 + rate × years). No compounding.
          </div>
        )}
      </section>

      {/* DPS contribution form is rendered as a modal (see ContributeModal at end of file). */}

      {/* Status actions */}
      {(status === 'active' || status === 'matured') && (
        <section className="bg-surface border border-border rounded-card p-6 shadow-card">
          <h2 className="heading h3-modal mb-3">{status === 'matured' ? 'Matured' : 'When it matures'}</h2>
          {isDps ? (
            <>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  onClick={onRecordPayout}
                  disabled={!inv.payoutAccountId || currentValue - paidOut <= 0}
                >
                  Record maturity payout
                </Button>
                <Button variant="secondary" onClick={onRollover}>Roll over to a new term</Button>
                {paidOut === 0 && (
                  <Button variant="secondary" onClick={onClose}>Close this investment</Button>
                )}
              </div>
              {!inv.payoutAccountId && (
                <div className="mt-3 text-[12px] text-warn bg-warn-soft border border-warn rounded-lg px-3 py-2">
                  Set a <strong>payout account</strong> on this DPS to record payouts.{' '}
                  <Link to={`/investments/${inv.id}/edit`} className="underline font-semibold">Edit the investment</Link>{' '}
                  to add one — without it, the bank has nowhere to send the money back.
                </div>
              )}
              <p className="text-[12px] text-muted mt-3 leading-relaxed">
                <strong>Record maturity payout</strong> opens the income form with the remaining amount
                (current value {fmtBDT(currentValue)} − paid out so far {fmtBDT(paidOut)} = {fmtBDT(Math.max(0, currentValue - paidOut))})
                pre-filled and the payout account already chosen. Saving it records the actual bank payout as Income —
                and auto-closes this DPS once contributions have been fully paid back.
                <br />
                <strong>Roll over</strong> starts a fresh DPS the day after this one ends.
                <br />
                <strong>Close</strong> is for marking the account done without recording a payout (rare).
              </p>
            </>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  onClick={onRecordPayout}
                  disabled={!inv.payoutAccountId || projected - paidOut <= 0}
                >
                  Record maturity payout
                </Button>
                <Button variant="secondary" onClick={onRollover}>Roll over to a new term</Button>
                <Button variant="secondary" onClick={onClose}>Close this investment</Button>
              </div>
              {!inv.payoutAccountId && (
                <div className="mt-3 text-[12px] text-warn bg-warn-soft border border-warn rounded-lg px-3 py-2">
                  Set a <strong>payout account</strong> on this {inv.type.toUpperCase()} to record the maturity payout.{' '}
                  <Link to={`/investments/${inv.id}/edit`} className="underline font-semibold">Edit the investment</Link>{' '}
                  to add one — without it, the bank has nowhere to send the money back.
                </div>
              )}
              <p className="text-[12px] text-muted mt-3 leading-relaxed">
                <strong>Record maturity payout</strong> opens the income form with the maturity amount
                ({fmtBDT(projected)} − paid out so far {fmtBDT(paidOut)} = {fmtBDT(Math.max(0, projected - paidOut))})
                pre-filled and the payout account already chosen. Saving it records the actual bank payout as Income —
                which then shows in the Paid out row above and in the Activity log below.
                <br />
                <strong>Roll over</strong> creates a fresh investment starting the day after maturity.
                <br />
                <strong>Close</strong> marks this one done manually — useful if you already received the money outside the app and just want to retire the record.
              </p>
            </>
          )}
        </section>
      )}

      {/* Contribution + payout history */}
      {(contribs.length > 0 || payouts.length > 0) && (
        <section className="bg-surface border border-border rounded-card p-6 shadow-card">
          <h2 className="heading h3-modal mb-3">Activity</h2>
          <div className="divide-y divide-border">
            {[...contribs, ...payouts]
              .slice()
              .sort((a, b) => b.date.localeCompare(a.date))
              .map(t => {
                const acc = accs.find(a => a.id === t.accountId);
                const tag = t.type === 'income' ? 'payout' : 'contribution';
                return (
                  <div key={t.id} className="py-2.5 flex justify-between items-center">
                    <div>
                      <div className="text-[13px] font-semibold tabular">{fmtBDT(t.amount)}</div>
                      <div className="text-[11px] text-muted">{fmtDate(t.date)} {acc ? ` ${MIDDOT} ${acc.name}` : ''}{t.note ? ` ${MIDDOT} ${t.note}` : ''}</div>
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-pill ${
                      t.type === 'income'
                        ? 'bg-success-soft text-success'
                        : 'bg-primary-soft text-primary'
                    }`}>{tag}</span>
                  </div>
                );
              })}
          </div>
        </section>
      )}

      {/* Footer: delete */}
      <section
        className="border border-danger rounded-card p-6 shadow-card"
        style={{ background: 'var(--danger-callout-bg)' }}
      >
        <h2 className="heading h3-modal mb-2" style={{ color: 'var(--danger-title, #F08574)' }}>Danger zone</h2>
        <p className="text-[13px] text-muted mb-4">
          Removes the investment record only. The {contribs.length} linked contribution transactions stay in your records.
        </p>
        <Button variant="danger" onClick={onDelete}>Delete investment</Button>
      </section>

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

function Stat({ label, value, accent, hint }: { label: string; value: string; accent?: boolean; hint?: string }) {
  return (
    <div>
      <div className="text-[11px] text-muted uppercase tracking-wider">{label}</div>
      <div className={['text-xl font-bold tabular mt-1', accent ? 'text-primary' : 'text-ink'].join(' ')}>{value}</div>
      {hint && <div className="text-[11px] text-muted mt-0.5">{hint}</div>}
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const styles =
    status === 'active' ? 'bg-accent-soft text-accent'
    : status === 'matured' ? 'bg-success-soft text-success'
    : status === 'closed' ? 'bg-surface-2 text-muted'
    : 'bg-warn-soft text-warn';
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-pill text-[12px] font-semibold ${styles}`}>
      {status}
    </span>
  );
}

function invEmoji(type: string): string {
  if (type === 'dps') return '\u{1F4C5}';
  if (type === 'fdr') return '\u{1F3E6}';
  return '\u{1F4DC}';
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
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

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
        <p className="text-[13px] text-muted m-0 -mt-3">
          Records an expense from the chosen account and links it to this DPS.
        </p>
        <Field label="Amount" hint={`Plan: ${fmtBDT(investment.monthlyContribution || 0)} / month`}>
          <Input
            type="number"
            inputMode="decimal"
            value={contribAmount}
            onChange={e => setContribAmount(e.target.value)}
            placeholder={String(investment.monthlyContribution || 0)}
            autoFocus
          />
        </Field>
        <Field label="Date">
          <Input type="date" value={contribDate} onChange={e => setContribDate(e.target.value)} />
        </Field>
        <Field label="From account">
          <select
            value={contribAccount}
            onChange={e => setContribAccount(e.target.value)}
            className="w-full bg-surface-2 border border-border text-ink rounded-btn px-[14px] py-3 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/40"
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
          <button
            type="button"
            ref={cancelRef}
            onClick={onClose}
            className="inline-flex items-center justify-center px-[18px] py-3 rounded-btn font-bold text-sm bg-surface text-ink border border-border hover:bg-surface-2 transition"
          >
            Cancel
          </button>
          <Button variant="primary" type="submit">Record contribution</Button>
        </div>
      </form>
    </div>,
    document.body,
  );
}