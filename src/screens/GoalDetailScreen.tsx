/**
 * GoalDetailScreen — one goal, read as a receipt.
 *
 * Goals are a *plan-only* scratchpad. Contributions here do NOT create
 * transactions and do NOT touch account balances. The user is just
 * recording "how much of the target have I set aside so far?" — the
 * real money lives in their accounts, tracked separately.
 *
 * 2026-11-26 redesign (variant G4, "the receipt"): the goal LIST is
 * a row of small receipts, so the DETAIL is one big receipt you can
 * read at arm's length — the same grammar at a larger scale. The
 * page is a bundle of slips in two columns:
 *
 *   left   the statement — saved / target / remaining / target date,
 *          the FILL LINE (how close you are, the one thing a receipt
 *          never had), the per-month total, and a footnote in plain
 *          words saying when the target lands.
 *   right  "By the numbers" — the facts the form cannot change.
 *
 * The edit pass writes the new terms onto the SAME slip: the name,
 * target and date are re-written in place, under an EDITING stamp.
 * The contribution history hangs below as the itemised list of
 * everything paid in, totalled at the foot.
 *
 * THE TONE FOLLOWS THE GOAL. One slip, three states — mint while it
 * runs, sage once reached, coral once the date has passed. The wash
 * is a low mix of the state's colour into the paper, so the state is
 * legible before a single word is read.
 *
 * Two modes:
 *   - View (default): read-only statement, required-per-month, full
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
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../domain/store';
import * as goals from '../domain/goals';
import {
  goalRequiredPerMonth,
  goalSaved,
  isGoalCompleted,
  isGoalExpired,
  monthsBetween,
  today,
} from '../domain/math';
import { fmtBDT, fmtDate } from '../lib/format';
import { Button } from '../components/Button';
import { Field, Input } from '../components/Field';
import { useConfirm } from '../components/ConfirmDialog';
import { isPositiveMoney, POSITIVE_MONEY_ERROR } from '../lib/validation';

const MIDDOT = '\u00B7';

/**
 * The goal's STATE, and the tone each state wears.
 *
 * The three states are mutually exclusive and exhaustive: a goal is
 * reached, or it is past its date, or it is still running. Which one
 * it is decides the stamp's wording, the stamp's colour and the wash
 * of the paper.
 */
type GoalState = 'active' | 'reached' | 'overdue';

const STATE_STAMP: Record<GoalState, string> = {
  active: 'Active',
  reached: 'Reached',
  overdue: 'Past due',
};

const STATE_COLOR: Record<GoalState, string> = {
  active: 'var(--primary)',
  reached: 'var(--success)',
  overdue: 'var(--danger)',
};

/**
 * Classify the goal into one of its three states.
 *
 * Reaching the target beats the date: a goal saved in full on the
 * last day is reached, not overdue.
 */
function stateOf(completed: boolean, expired: boolean): GoalState {
  if (completed) return 'reached';
  if (expired) return 'overdue';
  return 'active';
}

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
  const goalId = goal.id;
  const goalName = goal.name;
  const targetAmount = Number(goal.target) || 0;
  const pct = targetAmount > 0 ? Math.min(100, Math.round((saved / targetAmount) * 100)) : 0;
  const remaining = Math.max(0, targetAmount - saved);
  const completed = isGoalCompleted(goal, saved);
  const expired = isGoalExpired(goal);
  const requiredPerMonth = completed ? 0 : goalRequiredPerMonth(goal, saved);
  const contributions = goal.contributions;
  const monthsLeft = goal.targetDate ? monthsBetween(today(), goal.targetDate) : 0;

  // The state — and with it the stamp and the wash. Computed once so
  // the receipt, the side card and the footnote all agree.
  const gstate = stateOf(completed, expired);
  const tone = STATE_COLOR[gstate];

  // The pace footnote, in plain words. Three cases:
  //   reached  → the goal is met, so there is no monthly plan to state
  //   overdue  → the date has passed and the target is not met
  //   active   → how long is left, what a month costs, when it lands
  let paceNote: React.ReactNode = null;
  if (completed) {
    paceNote = (
      <>
        <b>Goal reached.</b> You set aside {fmtBDT(saved)} of {fmtBDT(targetAmount)} — there is
        nothing left to save. The history below is the full record.
      </>
    );
  } else if (expired) {
    paceNote = (
      <>
        <b>Target date passed.</b> {fmtBDT(remaining)} is still needed for{' '}
        {fmtBDT(targetAmount)}. Either extend the date or close the goal.
      </>
    );
  } else if (Number.isFinite(requiredPerMonth) && monthsLeft > 0) {
    paceNote = (
      <>
        <b>{monthsLeft} month{monthsLeft === 1 ? '' : 's'}</b> remain before the target date.
        At {fmtBDT(Math.round(requiredPerMonth))} a month you reach {fmtBDT(targetAmount)} on{' '}
        <b>{fmtDate(goal.targetDate)}</b>
        {requiredPerMonth * monthsLeft >= remaining ? ' — just in time.' : ' — a little short, so save more.'}
      </>
    );
  } else if (Number.isFinite(requiredPerMonth)) {
    paceNote = (
      <>
        <b>{fmtBDT(Math.round(requiredPerMonth))}</b> a month reaches {fmtBDT(targetAmount)} by{' '}
        <b>{fmtDate(goal.targetDate)}</b>.
      </>
    );
  }

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
      update(s => goals.update(s, goalId, {
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
    update(s => goals.remove(s, goalId));
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
      update(s => goals.addContribution(s, goalId, {
        amount,
        date: contribDate,
        note: contribNote.trim() || undefined,
      }));
      const newSaved = saved + amount;
      showBanner({
        kind: 'success',
        what: `${fmtBDT(contribAmount)} toward ${goalName}`,
        why: 'Saved as a plan entry — your account balance is unchanged.',
        fix: `Saved is now ${fmtBDT(newSaved)} of ${fmtBDT(targetAmount)}.`,
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
    update(s => goals.removeContribution(s, goalId, contributionId));
    showBanner({
      kind: 'success',
      what: 'Contribution removed',
      why: 'The saved amount has been adjusted.',
      fix: 'Add a new contribution if you made a mistake.',
    });
  }

  return (
    <div className="flex flex-col gap-[18px]">
      {/* Top-row back link — same arrow text-link used by every
          "planner" surface so goals and planners share one back
          affordance. */}
      <div>
        <button
          type="button"
          onClick={() => navigate('/goals')}
          className="text-muted t-13 hover:text-ink transition"
        >{'\u2190'} Goals</button>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3">
        <div>
          <h1 className="heading h1-screen">{goal.name}</h1>
        </div>
        {mode === 'view' && (
          <div className="flex flex-wrap gap-2">
            {!completed && (
              <button
                type="button"
                onClick={() => setShowContributeForm(true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-btn font-bold t-13 text-primary-on hover:opacity-95 active:translate-y-px transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                style={{ background: 'var(--primary)' }}
              >
                + Add a contribution
              </button>
            )}
            <Button variant="secondary" onClick={() => setMode('edit')}>Edit</Button>
          </div>
        )}
      </div>

      <div className="goal-detail">
        {/* ═══ THE RECEIPT ═══════════════════════════════════ */}
        <div className="goal-detail__col">
          <section
            className="goal-receipt"
            data-tone={gstate}
            style={{ ['--tone' as string]: tone, ['--stamp' as string]: tone }}
          >
            <div className="goal-receipt__head">
              <span className="goal-receipt__name">{goal.name}</span>
              <span className="goal-receipt__stamp">{STATE_STAMP[gstate]}</span>
            </div>

            <div className="goal-receipt__rule" />

            <div className="goal-receipt__row">
              <span>Saved so far</span>
              <b>{fmtBDT(saved)}</b>
            </div>
            <div className="goal-receipt__row">
              <span>Target</span>
              <b>{fmtBDT(targetAmount)}</b>
            </div>
            <div className="goal-receipt__row">
              <span>Remaining</span>
              <b>{fmtBDT(remaining)}</b>
            </div>
            <div className="goal-receipt__row">
              <span>Target date</span>
              <b>{goal.targetDate ? fmtDate(goal.targetDate) : '—'}</b>
            </div>

            {/* The fill line — how much of the slip is written in.
                The one thing a receipt never had: the distance to the
                target, drawn rather than stated. */}
            <div
              className="goal-fill"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${goal.name} saved toward target`}
            >
              <i style={{ width: `${pct}%` }} />
            </div>
            <div className="goal-fillhint">
              <span><b>{pct}%</b> complete</span>
              <span>{fmtBDT(remaining)} to go</span>
            </div>

            {/* The total — the per-month ask. It is the one number the
                user acts on, so it gets the receipt's total row. */}
            <div className="goal-receipt__row goal-receipt__row--total">
              <span>Required per month</span>
              <b>
                {completed
                  ? '— done —'
                  : Number.isFinite(requiredPerMonth)
                    ? fmtBDT(Math.round(requiredPerMonth))
                    : '— past due —'}
              </b>
            </div>

            {/* The footnote — the pace, in plain words. */}
            {paceNote && <div className="goal-pace">{paceNote}</div>}
          </section>

          {/* ═══ THE EDIT PASS ═════════════════════════════════ */}
          {mode === 'edit' && (
            <form
              onSubmit={onSaveEdit}
              className="goal-receipt"
              data-tone={gstate}
              style={{ ['--tone' as string]: tone, ['--stamp' as string]: 'var(--warn)' }}
            >
              <div className="goal-receipt__head">
                <span className="goal-receipt__name">Edit goal</span>
                <span className="goal-receipt__stamp">Editing</span>
              </div>

              <div className="goal-receipt__rule" />

              <div className="goal-warnbox" style={{ margin: '12px 0 4px' }}>
                <strong>Heads up:</strong> the "saved so far" figure above is the sum of your
                contributions. Editing this goal doesn&apos;t change that — add or remove a
                contribution instead.
              </div>

              <div className="goal-editfields" style={{ marginTop: 14 }}>
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
              </div>

              <div className="flex flex-wrap gap-2" style={{ marginTop: 16 }}>
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

          {/* ═══ HISTORY ════════════════════════════════════════ */}
          {contributions.length > 0 && (
            <section
              className="goal-receipt"
              data-tone={gstate}
              style={{ ['--tone' as string]: tone, ['--stamp' as string]: 'var(--muted)' }}
            >
              <div className="goal-receipt__head">
                <span className="goal-receipt__name">Contribution history</span>
                <span className="goal-receipt__stamp">
                  {contributions.length} {contributions.length === 1 ? 'entry' : 'entries'}
                </span>
              </div>

              <div className="goal-receipt__rule" />

              <div className="goal-history">
                {contributions
                  .slice()
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map(c => (
                    <div key={c.id} className="goal-hrow">
                      <div className="min-w-0">
                        <div className="ha">{fmtBDT(c.amount)}</div>
                        <div className="hd">
                          {fmtDate(c.date)}{c.note ? ` ${MIDDOT} ${c.note}` : ''}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemoveContribution(c.id)}
                        aria-label="Remove contribution"
                        className="goal-hremove"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
              </div>

              <div className="goal-receipt__row goal-receipt__row--total">
                <span>Total contributed</span>
                <b>{fmtBDT(saved)}</b>
              </div>
            </section>
          )}

          {/* ═══ DANGER ══════════════════════════════════════════ */}
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
              Removes the goal and its {contributions.length} contribution {contributions.length === 1 ? 'entry' : 'entries'}. Your accounts and transactions are not touched.
            </p>
            <Button variant="outlined-danger" onClick={onDelete}>Delete goal</Button>
          </section>
        </div>

        {/* ═══ THE SIDE COLUMN ════════════════════════════════ */}
        <div className="goal-detail__col">
          <div className="goal-detail__sect">By the numbers</div>

          <section
            className="goal-receipt"
            data-tone={gstate}
            style={{ ['--tone' as string]: tone, ['--stamp' as string]: tone }}
          >
            <div className="goal-receipt__head">
              <span className="goal-receipt__name">{goal.name}</span>
            </div>

            <div className="goal-receipt__rule" />

            <div className="goal-receipt__row">
              <span>Required per month</span>
              <b>
                {completed
                  ? '— done —'
                  : Number.isFinite(requiredPerMonth)
                    ? fmtBDT(Math.round(requiredPerMonth))
                    : '— past due —'}
              </b>
            </div>
            <div className="goal-receipt__row">
              <span>Target date</span>
              <b>{goal.targetDate ? fmtDate(goal.targetDate) : '—'}</b>
            </div>
            <div className="goal-receipt__row">
              <span>Contributions</span>
              <b>{contributions.length}</b>
            </div>
            <div className="goal-receipt__row">
              <span>Created</span>
              <b>{fmtDate(goal.createdAt)}</b>
            </div>
            <div className="goal-receipt__row goal-receipt__row--total">
              <span>Months remaining</span>
              <b>{completed ? '—' : Math.max(0, monthsLeft)}</b>
            </div>
          </section>
        </div>
      </div>

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
        <p className="t-13 text-muted m-0 -mt-3">
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
