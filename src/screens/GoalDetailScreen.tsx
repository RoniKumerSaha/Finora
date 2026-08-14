/**
 * GoalDetailScreen — single detail + edit screen for a savings goal.
 *
 * Visual target: v1 design system (Fraunces headings, surface cards,
 * tabular numerals). Goals use R6 discipline — `saved` is derived from
 * expense txns with `linkedGoalId === goal.id`; this screen renders the
 * derived value and never asks the user to enter it.
 *
 * Two modes:
 *   - View (default): read-only progress, required-per-month, full
 *     contribution history, edit + delete affordances.
 *   - Edit (toggled inline): name, target, targetDate; banner explains
 *     that the "saved" amount is derived and won't be edited.
 *
 * Contribute via modal: opens from the header button before Edit.
 * Hidden once the goal is completed. Submits through
 * `goals.addContribution()` which creates a linked expense transaction.
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../domain/store';
import * as goals from '../domain/goals';
import * as accounts from '../domain/accounts';
import {
  goalSavedFromTxns,
  goalProgress,
  goalRequiredPerMonthDerived,
  isGoalCompleted,
  isGoalExpired,
} from '../domain/math';
import { fmtBDT, fmtDate, fmtDateShort } from '../lib/format';
import { Button } from '../components/Button';
import { Field, Input } from '../components/Field';
import { useConfirm } from '../components/ConfirmDialog';
import type { Account } from '../domain/types';

const MIDDOT = '\u00B7';

export function GoalDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const state = useStore(s => s.state);
  const update = useStore(s => s.update);
  const showBanner = useStore(s => s.showBanner);
  const { confirm, dialog } = useConfirm();
  const accs = accounts.list(state);
  const goal = goals.get(state, id!);

  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [name, setName] = useState(goal?.name ?? '');
  const [target, setTarget] = useState(String(goal?.target ?? ''));
  const [targetDate, setTargetDate] = useState(goal?.targetDate ?? '');

  // Contribution form state (rendered inside ContributeModal).
  const [contribAmount, setContribAmount] = useState('');
  const [contribDate, setContribDate] = useState(new Date().toISOString().slice(0, 10));
  const [contribAccount, setContribAccount] = useState(accs[0]?.id ?? '');
  const [contribNote, setContribNote] = useState('');
  const [showContributeForm, setShowContributeForm] = useState(false);

  if (!goal) {
    return (
      <div className="text-muted">
        Goal not found.{' '}
        <button className="underline" onClick={() => navigate('/goals')}>Back to goals</button>
      </div>
    );
  }

  const txs = state.transactions.filter(t => t.linkedGoalId === goal.id && t.type === 'expense');
  const saved = goalSavedFromTxns(goal, state.transactions);
  const progress = goalProgress(goal, state.transactions);
  const pct = Math.round(progress * 100);
  const completed = isGoalCompleted(goal, saved);
  const expired = isGoalExpired(goal);
  const requiredPerMonth = completed ? 0 : goalRequiredPerMonthDerived(goal, state.transactions);

  function onSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      showBanner({ what: 'Goal name is required', why: 'Goals without a name cannot be tracked.', fix: 'Enter a name.' });
      return;
    }
    if (!(Number(target) > 0)) {
      showBanner({ what: 'Target must be greater than zero', why: 'Zero or negative targets make the goal meaningless.', fix: 'Enter a positive number.' });
      return;
    }
    if (!targetDate) {
      showBanner({ what: 'Target date is required', why: 'Goals without dates cannot compute the per-month requirement (R5).', fix: 'Pick a date in the future.' });
      return;
    }
    try {
      update(s => goals.update(s, goal!.id, {
        name: name.trim(),
        target: Number(target),
        targetDate,
      }));
      setMode('view');
      showBanner({ kind: 'success', what: 'Goal updated', why: 'Name, target, and date are now in effect.', fix: 'The saved amount is unchanged — it\'s derived from your transactions.' });
    } catch (err) {
      showBanner({ what: 'Could not update goal', why: (err as Error).message, fix: 'Try again.' });
    }
  }

  async function onDelete() {
    const ok = await confirm({
      title: 'Delete this goal?',
      body: `${fmtBDT(saved)} of contributed transactions stay in your records. Only the goal itself will be removed.`,
      confirmLabel: 'Delete goal',
      danger: true,
    });
    if (!ok) return;
    update(s => goals.remove(s, goal!.id));
    showBanner({
      kind: 'success',
      what: 'Goal deleted',
      why: `${fmtBDT(saved)} of contributions remain in your transactions.`,
      fix: 'Open Home or Transactions to see them.',
    });
    navigate('/goals');
  }

  function onContribute(e: React.FormEvent) {
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
      update(s => goals.addContribution(s, goal!.id, {
        amount: Number(contribAmount),
        date: contribDate,
        accountId: contribAccount,
        note: contribNote.trim() || undefined,
      }));
      setContribAmount('');
      setContribNote('');
      showBanner({
        kind: 'success',
        what: `+ ${fmtBDT(contribAmount)} toward ${goal!.name}`,
        why: 'Recorded as an expense transaction linked to this goal.',
        fix: `Saved is now ${fmtBDT(saved + Number(contribAmount))} of ${fmtBDT(goal!.target)}.`,
      });
    } catch (err) {
      showBanner({ what: 'Could not record contribution', why: (err as Error).message, fix: 'Try again.' });
    }
  }

  return (
    <div className="flex flex-col gap-[18px] max-w-[640px]">
      <div className="flex items-center gap-3">
        <Link to="/goals" className="text-muted text-sm hover:text-ink transition">{'\u2190'} Goals</Link>
      </div>

      {/* Header */}
      <div className="flex justify-between items-end gap-3">
        <div>
          <div className="text-[13px] text-muted">Goal</div>
          <h1 className="heading h1-screen mt-1">{goal.name}</h1>
        </div>
        {mode === 'view' && (
          <div className="flex gap-2">
            {!completed && accs.length > 0 && (
              <button
                type="button"
                onClick={() => setShowContributeForm(true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-btn font-bold text-[13px] text-primary-on hover:opacity-95 active:translate-y-px transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                style={{ background: 'var(--primary)' }}
              >
                + Add a contribution
              </button>
            )}
            <Button variant="secondary" onClick={() => setMode('edit')}>Edit</Button>
          </div>
        )}
      </div>

      {/* Progress card */}
      <section className="card">
        <div className="flex justify-between items-center mb-3">
          <div>
            <div className="text-[11px] text-muted uppercase tracking-wider">Saved so far</div>
            <div className="text-3xl font-extrabold text-primary tabular mt-1">{fmtBDT(saved)}</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-muted uppercase tracking-wider">Target</div>
            <div className="text-3xl font-extrabold text-ink tabular mt-1">{fmtBDT(goal.target)}</div>
          </div>
        </div>
        <div className="h-2.5 bg-surface-2 rounded-pill overflow-hidden">
          <div className="h-full bg-gradient-to-r from-primary to-accent rounded-pill transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex justify-between text-xs text-muted mt-2">
          <span>{pct}% complete</span>
          <span>{fmtBDT(goal.target - saved)} remaining</span>
        </div>
        {completed && (
          <div className="mt-4 text-[13px] text-success bg-success-callout-bg border border-success rounded-lg px-3 py-2">
            Goal reached. {fmtBDT(saved)} saved {MIDDOT} target {fmtBDT(goal.target)}
          </div>
        )}
        {!completed && expired && (
          <div className="mt-4 text-[13px] text-danger bg-danger-soft border border-danger rounded-lg px-3 py-2">
            Target date passed. Either extend it or close the goal.
          </div>
        )}
      </section>

      {/* Math summary */}
      <section className="card">
        <h2 className="heading h3-modal mb-4">By the numbers</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-[11px] text-muted uppercase tracking-wider">Required per month</div>
            <div className="text-xl font-bold text-accent tabular mt-1">
              {requiredPerMonth === Infinity
                ? '— past due —'
                : completed ? '— done —'
                : fmtBDT(requiredPerMonth)}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-muted uppercase tracking-wider">Target date</div>
            <div className="text-xl font-bold text-ink tabular mt-1">{fmtDate(goal.targetDate)}</div>
          </div>
          <div>
            <div className="text-[11px] text-muted uppercase tracking-wider">Contributions</div>
            <div className="text-xl font-bold text-ink tabular mt-1">{txs.length}</div>
          </div>
          <div>
            <div className="text-[11px] text-muted uppercase tracking-wider">Created</div>
            <div className="text-xl font-bold text-ink tabular mt-1">{fmtDateShort(goal.createdAt)}</div>
          </div>
        </div>
      </section>

      {/* Edit form (inline) */}
      {mode === 'edit' && (
        <form onSubmit={onSaveEdit} className="card flex flex-col gap-5">
          <h2 className="heading h3-modal">Edit goal</h2>
          <div className="text-[13px] text-warn bg-warn-soft border border-warn rounded-lg px-3 py-2">
            <strong>Heads up:</strong> the "saved so far" figure above comes from your linked transactions.
            Editing this goal doesn't change that — add a contribution or correct a transaction instead.
          </div>
          <Field label="Name">
            <Input value={name} onChange={e => setName(e.target.value)} autoFocus />
          </Field>
          <Field label="Target amount">
            <Input type="number" inputMode="decimal" value={target} onChange={e => setTarget(e.target.value)} />
          </Field>
          <Field label="Target date">
            <Input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} />
          </Field>
          <div className="flex gap-2">
            <Button variant="primary" type="submit">Save changes</Button>
            <Button variant="ghost" onClick={() => setMode('view')}>Cancel</Button>
          </div>
        </form>
      )}

      {/* Add contribution is rendered as a modal (see ContributeModal at end of file). */}

      {/* Contribution history */}
      {txs.length > 0 && (
        <section className="card">
          <h2 className="heading h3-modal mb-4">Contribution history</h2>
          <div className="divide-y divide-border">
            {txs
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
        className="rounded-card p-6"
        style={{
          background: 'var(--danger-callout-bg)',
          border: '1px solid var(--danger)',
          boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--danger) 35%, transparent)',
        }}
      >
        <h2 className="heading h3-modal mb-2" style={{ color: 'var(--danger-title)' }}>Danger zone</h2>
        <p className="text-[13px] text-muted mb-4">
          Removes the goal only. The {txs.length} linked transactions stay in your records as ordinary expenses.
        </p>
        <Button variant="danger" onClick={onDelete}>Delete goal</Button>
      </section>

      {dialog}
      {!completed && mode === 'view' && accs.length > 0 && showContributeForm && (
        <ContributeModal
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
 * ContributeModal — modal for recording a goal contribution.
 *
 * Rendered via portal into document.body. Escape and backdrop click
 * close without recording. Submit is handled by the parent, which
 * also closes the modal on success.
 */
interface ContributeModalProps {
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
      aria-labelledby="goal-contribute-title"
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
        <h3 id="goal-contribute-title" className="heading h3-modal m-0">Add a contribution</h3>
        <p className="text-[13px] text-muted m-0 -mt-3">
          Records an expense from the chosen account and links it to this goal.
        </p>
        <Field label="Amount">
          <Input
            type="number"
            inputMode="decimal"
            value={contribAmount}
            onChange={e => setContribAmount(e.target.value)}
            placeholder="5000"
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
            placeholder="December saving…"
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