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

import { useState } from 'react';
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
  dpsCurrentValue,
  dpsMaturityValue,
} from '../domain/math';
import { fmtBDT, fmtDate } from '../lib/format';
import { Button } from '../components/Button';
import { Field, Input } from '../components/Field';
import { useConfirm } from '../components/ConfirmDialog';

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
  const contribs = state.transactions.filter(t => t.linkedInvestmentId === inv.id && t.type === 'expense');
  const contributed = isDps ? dpsContributedSoFar(inv, state.transactions) : 0;
  const currentValue = isDps ? dpsCurrentValue(inv, state.transactions) : 0;
  const expectedInterest = isDps
    ? Math.max(0, dpsMaturityValue(inv) - (Number(inv.monthlyContribution) || 0) * (Number(inv.termMonths) || 0))
    : Math.max(0, projected - (Number(inv.principal) || 0));
  const payoutAcc = accs.find(a => a.id === inv.payoutAccountId);

  async function onContribute(e: React.FormEvent) {
    e.preventDefault();
    if (!(Number(contribAmount) > 0)) {
      showBanner({ what: 'Amount must be greater than zero', why: 'You can\'t contribute nothing.', fix: 'Enter a positive amount.' });
      return;
    }
    if (!contribAccount) {
      showBanner({ what: 'Pick an account', why: 'Contributions need an account to come from.', fix: 'Select the source account.' });
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
      const total = contributed + Number(contribAmount);
      showBanner({
        what: `+ ${fmtBDT(contribAmount)} toward ${inv!.name}`,
        why: 'Recorded as an expense transaction linked to this investment.',
        fix: `${fmtBDT(total)} contributed so far.`,
      });
    } catch (err) {
      showBanner({ what: 'Could not record contribution', why: (err as Error).message, fix: 'Try again.' });
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
      what: `${inv!.name} rolled over`,
      why: 'A new investment with the same terms starts after maturity.',
      fix: 'Open Investments to see the new one.',
    });
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

      {/* DPS contribute form */}
      {isDps && status === 'active' && accs.length > 0 && (
        <form onSubmit={onContribute} className="bg-surface border border-border rounded-card p-6 shadow-card flex flex-col gap-5">
          <h2 className="heading h3-modal">Add a contribution</h2>
          <p className="text-[13px] text-muted -mt-3">
            Records an expense from the chosen account and links it to this DPS.
          </p>
          <Field label="Amount" hint={`Plan: ${fmtBDT(inv.monthlyContribution || 0)} / month`}>
            <Input type="number" inputMode="decimal" value={contribAmount} onChange={e => setContribAmount(e.target.value)} placeholder={String(inv.monthlyContribution || 0)} autoFocus />
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
              {accs.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
          <Field label="Note (optional)">
            <Input value={contribNote} onChange={e => setContribNote(e.target.value)} placeholder="October installment…" />
          </Field>
          <div className="flex gap-2">
            <Button variant="primary" type="submit">Record contribution</Button>
          </div>
        </form>
      )}

      {/* Status actions */}
      {status === 'active' && (
        <section className="bg-surface border border-border rounded-card p-6 shadow-card">
          <h2 className="heading h3-modal mb-3">When it matures</h2>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={onRollover}>Roll over to a new term</Button>
            <Button variant="secondary" onClick={onClose}>Close this investment</Button>
          </div>
          <p className="text-[12px] text-muted mt-3 leading-relaxed">
            <strong>Roll over</strong> creates a fresh investment starting the day after maturity.
            <br />
            <strong>Close</strong> marks this one done; payouts should still be recorded as Income to bring the money back.
          </p>
        </section>
      )}

      {/* Contribution history */}
      {contribs.length > 0 && (
        <section className="bg-surface border border-border rounded-card p-6 shadow-card">
          <h2 className="heading h3-modal mb-3">Contribution history</h2>
          <div className="divide-y divide-border">
            {contribs
              .slice()
              .sort((a, b) => b.date.localeCompare(a.date))
              .map(t => {
                const acc = accs.find(a => a.id === t.accountId);
                return (
                  <div key={t.id} className="py-2.5 flex justify-between items-center">
                    <div>
                      <div className="text-[13px] font-semibold tabular">{fmtBDT(t.amount)}</div>
                      <div className="text-[11px] text-muted">{fmtDate(t.date)} {acc ? ` ${MIDDOT} ${acc.name}` : ''}{t.note ? ` ${MIDDOT} ${t.note}` : ''}</div>
                    </div>
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