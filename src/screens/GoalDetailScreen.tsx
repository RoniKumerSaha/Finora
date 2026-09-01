/**
 * GoalDetailScreen — single detail + edit screen for a savings goal.
 *
 * Goals are a *plan-only* scratchpad. Contributions here do NOT create
 * transactions and do NOT touch account balances. The user is just
 * recording "how much of the target have I set aside so far?" — the
 * real money lives in their accounts, tracked separately.
 *
 * Two modes:
 *   - View (default): read-only progress, required-per-month, full
 *     contribution history, edit + delete affordances.
 *   - Edit (toggled inline): name, target, targetDate. The "saved"
 *     amount is recomputed from `goal.contributions` and is not
 *     edited directly here — add or remove a contribution instead.
 *
 * Contribute via modal: opens from the header button. Hidden once the
 * goal is completed. Submits through `goals.addContribution()` which
 * appends to the goal's contributions array and bumps `saved`.
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../domain/store';
import * as goals from '../domain/goals';
import {
  goalSaved,
  goalProgress,
  goalRequiredPerMonth,
  isGoalCompleted,
  isGoalExpired,
} from '../domain/math';
import { fmtBDT, fmtDate, fmtDateShort } from '../lib/format';
import { Button } from '../components/Button';
import { Field, Input } from '../components/Field';
import { useConfirm } from '../components/ConfirmDialog';
import { isPositiveMoney, POSITIVE_MONEY_ERROR } from '../lib/validation';

const MIDDOT = '\u00B7';

export function GoalDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const state = useStore(s => s.state);
  const update = useStore(s => s.update);
  const showBanner = useStore(s => s.showBanner);
  const { confirm, dialog } = useConfirm();
  const goal = goals.get(state, id!);

  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [name, setName] = useState(goal?.name ?? '');
  const [target, setTarget] = useState(String(goal?.target ?? ''));
  const [targetDate, setTargetDate] = useState(goal?.targetDate ?? '');

  // Contribution form state (rendered inside ContributeModal).
  const [contribAmount, setContribAmount] = useState('');
  const [contribDate, setContribDate] = useState(new Date().toISOString().slice(0, 10));
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

  const saved = goalSaved(goal);
  const progress = goalProgress(goal);
  const pct = Math.round(progress * 100);
  const completed = isGoalCompleted(goal, saved);
  const expired = isGoalExpired(goal);
  const requiredPerMonth = completed ? 0 : goalRequiredPerMonth(goal, saved);
  const contributions = goal.contributions;

  // Inline guard (spine: ux-finora-2026-08-14-negative-guard). Pre-populated
  // value is valid; user can break it by typing a negative target.
  const targetInvalid = !isPositiveMoney(target);
  const targetErrorClass = targetInvalid
    ? 'border-danger focus:border-danger focus:ring-danger/30'
    : '';

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
      showBanner({ kind: 'success', what: 'Goal updated', why: 'Name, target, and date are now in effect.', fix: 'Your contribution history is unchanged — add or remove a contribution to adjust the saved amount.' });
    } catch (err) {
      showBanner({ what: 'Could not update goal', why: (err as Error).message, fix: 'Try again.' });
    }
  }

  async function onDelete() {
    const ok = await confirm({
      title: 'Delete this goal?',
      body: `${contributions.length} contribution ${contributions.length === 1 ? 'entry' : 'entries'} will be removed. This cannot be undone.`,
      confirmLabel: 'Delete goal',
      danger: true,
    });
    if (!ok) return;
    update(s => goals.remove(s, goal!.id));
    showBanner({
      kind: 'success',
      what: 'Goal deleted',
      why: 'The goal and its contribution history are gone.',
      fix: 'Your accounts and transactions were not touched.',
    });
    navigate('/goals');
  }

  function onContribute(e: React.FormEvent) {
    e.preventDefault();
    if (!(Number(contribAmount) > 0)) {
      showBanner({ what: 'Amount must be greater than zero', why: 'You can\'t contribute nothing.', fix: 'Enter a positive amount.' });
      return;
    }
    try {
      const amount = Number(contribAmount);
      update(s => goals.addContribution(s, goal!.id, {
        amount,
        date: contribDate,
        note: contribNote.trim() || undefined,
      }));
      const newSaved = saved + amount;
      showBanner({
        kind: 'success',
        what: `+ ${fmtBDT(contribAmount)} toward ${goal!.name}`,
        why: 'Saved as a plan entry — your account balance is unchanged.',
        fix: `Saved is now ${fmtBDT(newSaved)} of ${fmtBDT(goal!.target)}.`,
      });
      // Close the modal and clear the form so a second contribution
      // starts from scratch. State is reset AFTER the success banner so
      // the values aren't briefly visible inside the closing modal.
      setShowContributeForm(false);
      setContribAmount('');
      setContribDate(new Date().toISOString().slice(0, 10));
      setContribNote('');
    } catch (err) {
      showBanner({ what: 'Could not record contribution', why: (err as Error).message, fix: 'Try again.' });
    }
  }

  async function onRemoveContribution(contributionId: string) {
    const ok = await confirm({
      title: 'Remove this contribution?',
      body: 'The saved amount goes down by this entry. Your accounts are not affected.',
      confirmLabel: 'Remove',
      danger: true,
    });
    if (!ok) return;
    update(s => goals.removeContribution(s, goal!.id, contributionId));
    showBanner({
      kind: 'success',
      what: 'Contribution removed',
      why: 'The saved amount has been adjusted.',
      fix: 'Add a new contribution if you made a mistake.',
    });
  }

  return (
    <div className="flex flex-col gap-[18px] max-w-[640px]">
      <div className="flex items-center gap-3">
        <Link to="/goals" className="text-muted text-sm hover:text-ink transition">{'\u2190'} Goals</Link>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3">
        <div>
          <div className="text-[13px] text-muted">Goal</div>
          <h1 className="heading h1-screen mt-1">{goal.name}</h1>
        </div>
        {mode === 'view' && (
          <div className="flex flex-wrap gap-2">
            {!completed && (
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
          <span>{fmtBDT(Math.max(0, goal.target - saved))} remaining</span>
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
            <div className="text-xl font-bold text-ink tabular mt-1">{contributions.length}</div>
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
            <strong>Heads up:</strong> the "saved so far" figure above is the sum of your contributions.
            Editing this goal doesn't change that — add or remove a contribution instead.
          </div>
          <Field label="Name">
            <Input value={name} onChange={e => setName(e.target.value)} autoFocus />
          </Field>
          <Field label="Target amount" error={targetInvalid ? POSITIVE_MONEY_ERROR : undefined}>
            <Input
              type="number"
              inputMode="decimal"
              value={target}
              onChange={e => setTarget(e.target.value)}
              aria-invalid={targetInvalid || undefined}
              className={targetErrorClass}
            />
          </Field>
          <Field label="Target date">
            <Input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outlined-primary"
              type="submit"
              disabled={targetInvalid || !name.trim() || !targetDate}
            >
              Save changes
            </Button>
            <Button variant="outlined-ghost" onClick={() => setMode('view')}>Cancel</Button>
          </div>
        </form>
      )}

      {/* Add contribution is rendered as a modal (see ContributeModal at end of file). */}

      {/* Contribution history */}
      {contributions.length > 0 && (
        <section className="card">
          <h2 className="heading h3-modal mb-4">Contribution history</h2>
          <div className="divide-y divide-border">
            {contributions
              .slice()
              .sort((a, b) => b.date.localeCompare(a.date))
              .map(c => (
                <div key={c.id} className="py-2.5 flex justify-between items-center gap-3">
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold tabular">{fmtBDT(c.amount)}</div>
                    <div className="text-[11px] text-muted">
                      {fmtDate(c.date)}{c.note ? ` ${MIDDOT} ${c.note}` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveContribution(c.id)}
                    aria-label="Remove contribution"
                    className="shrink-0 text-[11px] text-muted hover:text-danger transition px-2 py-1 rounded-btn hover:bg-surface-2"
                  >
                    Remove
                  </button>
                </div>
              ))}
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
          Removes the goal and its {contributions.length} contribution {contributions.length === 1 ? 'entry' : 'entries'}. Your accounts and transactions are not touched.
        </p>
        <Button variant="outlined-danger" onClick={onDelete}>Delete goal</Button>
      </section>

      {dialog}
      {!completed && mode === 'view' && showContributeForm && (
        <ContributeModal
          contribAmount={contribAmount}
          setContribAmount={setContribAmount}
          contribDate={contribDate}
          setContribDate={setContribDate}
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
 * Plan-only — no account picker, no transaction linkage. The user just
 * types an amount, picks a date, optionally adds a note. The
 * contribution is appended to the goal's contributions array.
 *
 * Rendered via portal into document.body. Escape and backdrop click
 * close without recording. Submit is handled by the parent, which
 * also closes the modal on success.
 */
interface ContributeModalProps {
  contribAmount: string;
  setContribAmount: (v: string) => void;
  contribDate: string;
  setContribDate: (v: string) => void;
  contribNote: string;
  setContribNote: (v: string) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

function ContributeModal({
  contribAmount,
  setContribAmount,
  contribDate,
  setContribDate,
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

  // Stable ref for onClose so the keyboard handler below doesn't
  // re-attach on every parent render (parent passes a fresh arrow each
  // time). Initial focus on Cancel is set once on mount; the Amount
  // input still gets initial focus via its `autoFocus` prop.
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
          Records the amount you've set aside toward this goal. Your account balance is not changed.
        </p>
        <Field label="Amount" error={amountInvalid ? POSITIVE_MONEY_ERROR : undefined}>
          <Input
            type="number"
            inputMode="decimal"
            value={contribAmount}
            onChange={e => setContribAmount(e.target.value)}
            placeholder="5000"
            autoFocus
            aria-invalid={amountInvalid || undefined}
            className={amountErrorClass}
          />
        </Field>
        <Field label="Date">
          <Input type="date" value={contribDate} onChange={e => setContribDate(e.target.value)} />
        </Field>
        <Field label="Note (optional)">
          <Input
            value={contribNote}
            onChange={e => setContribNote(e.target.value)}
            placeholder="December saving…"
          />
        </Field>
        <div className="flex gap-2.5 justify-end mt-2">
          <Button variant="outlined-ghost" type="button" onClick={onClose}>Cancel</Button>
          <Button variant="outlined-primary" type="submit" disabled={amountInvalid}>Add contribution</Button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
