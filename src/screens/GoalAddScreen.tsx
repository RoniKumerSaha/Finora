/**
 * GoalAddScreen — a savings plan, as a slip.
 *
 * A goal is a NUMBER and a DATE, and everything else about it is
 * derived. So the target sits in the headline slot — it is the thing
 * you know the moment you open the screen — and the blanks below
 * fill in the rest of the promise.
 *
 * The clause at the foot is where this screen earns its keep: it
 * does the arithmetic that decides whether the plan actually works.
 * "৳ 8,334 a month reaches ৳ 1,00,008 in 12 months — you hit your
 * target in December 2027, with ৳ 8 to spare." A form field cannot
 * answer that; a note field cannot either. This is the one add screen
 * where the consequence is a projection, and a projection belongs in
 * the document.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../domain/store';
import * as goals from '../domain/goals';
import { Button } from '../components/Button';
import {
  Blank,
  Clause,
  Recap,
  Slip,
  SlipAmount,
  SlipFoot,
  SlipHead,
} from '../components/AddSlip';
import { monthsBetween, parseISODate, today } from '../domain/math';
import { fmtBDT } from '../lib/format';
import { isPositiveMoney, isNonNegativeMoney } from '../lib/validation';
import { Check } from '../components/icons/Icons';

export function GoalAddScreen() {
  const navigate = useNavigate();
  const update = useStore(s => s.update);
  const showBanner = useStore(s => s.showBanner);
  const [name, setName] = useState('');
  const [saved, setSaved] = useState('');
  const [target, setTarget] = useState('');
  const [targetDate, setTargetDate] = useState('');

  // Inline guard (spine: ux-finora-2026-08-14-negative-guard).
  // Target uses > 0. "Already saved" must be present (required field)
  // and >= 0. We use the strict non-negative rule here — empty IS
  // invalid because the user must consciously type a starting amount,
  // even if that's "0".
  const targetInvalid = !isPositiveMoney(target);
  const savedInvalid = !isNonNegativeMoney(saved);

  const targetNum = Number(target) || 0;
  const savedNum = Number(saved) || 0;
  const remaining = Math.max(0, targetNum - savedNum);

  // The arithmetic: how many months are left, and what a month has to
  // be for the plan to land on the target.
  const monthsLeft = targetDate ? monthsBetween(today(new Date()), targetDate) : 0;
  const perMonth = monthsLeft > 0 ? remaining / monthsLeft : 0;

  // Where the plan actually lands: the projected total, and the month
  // the TARGET is in — not "today + N months". Adding N months to today
  // lands one month early whenever the target date is early in its
  // month, which would tell the user they finish in October when they
  // asked for November.
  const projected = savedNum + perMonth * Math.max(0, monthsLeft);
  const landsOn = targetDate ? parseISODate(targetDate) : null;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      showBanner({ what: 'Goal name is required', why: 'Goals without a name cannot be tracked.', fix: 'Enter a name (e.g. "Emergency fund").' });
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
    if (savedInvalid) {
      showBanner({ what: 'Already saved must be zero or more', why: 'Negative numbers don\'t make sense for money you\'ve already set aside.', fix: 'Enter 0 if you\'re starting fresh, or the amount you\'ve already saved.' });
      return;
    }
    try {
      update(s => goals.add(s, {
        name,
        target: Number(target),
        saved: Number(saved) || 0,
        targetDate,
      }));
      navigate('/goals');
    } catch (err) {
      showBanner({ what: 'Could not add goal', why: (err as Error).message, fix: 'Try again.' });
    }
  }

  const tone = 'var(--accent)';
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  return (
    <form onSubmit={onSubmit} className="addpage">
      <Slip tone={tone}>
        <SlipHead
          what="New goal"
          title="A promise to yourself"
          sub="A target and a date. The gap between them is the monthly amount you’ll need to set aside."
        />

        {/* THE AMOUNT — the target is the headline. */}
        <SlipAmount
          label="Target amount"
          value={target}
          onChange={setTarget}
          placeholder="100,000"
          autoFocus
          invalid={targetInvalid}
        />

        {/* THE BLANKS. */}
        <Blank label="Name" empty={!name.trim()}>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Emergency fund"
            aria-label="Name"
          />
        </Blank>

        <Blank label="By when" empty={!targetDate}>
          <input
            type="date"
            value={targetDate}
            onChange={e => setTargetDate(e.target.value)}
            aria-label="Target date"
          />
        </Blank>

        <Blank
          label="Already saved"
          empty={saved === ''}
        >
          <input
            type="number"
            inputMode="decimal"
            min="0"
            value={saved}
            onChange={e => setSaved(e.target.value)}
            placeholder="0"
            aria-label="Already saved"
            aria-invalid={savedInvalid || undefined}
            className={savedInvalid ? 'border-danger focus:border-danger focus:ring-danger/30' : ''}
          />
        </Blank>

        {/* THE CLAUSE — does the plan work? */}
        <Clause tone={tone} icon={<Check strokeWidth={2} />}>
          {!targetDate ? (
            <>Pick a date and this will tell you what to save each month to get there.</>
          ) : monthsLeft <= 0 ? (
            <>That date has already passed — pick a future one to work out a monthly plan.</>
          ) : (
            <>
              <b>{fmtBDT(Math.round(perMonth))}</b> a month reaches <b>{fmtBDT(Math.round(projected))}</b> in{' '}
              {monthsLeft} {monthsLeft === 1 ? 'month' : 'months'}
              {landsOn && (
                <>
                  {' '}— you hit your target in {monthNames[landsOn.getUTCMonth()]} {landsOn.getUTCFullYear()}
                </>
              )}
              {projected >= targetNum ? ', just in time.' : ', a little short — save a bit more each month.'}
            </>
          )}
        </Clause>

        <SlipFoot
          note="You can add contributions as you save them, and the goal page tracks what is left."
        >
          <Button variant="outlined-ghost" type="button" onClick={() => navigate('/goals')}>Cancel</Button>
          <Button
            variant="outlined-primary"
            type="submit"
            disabled={targetInvalid || savedInvalid || !name.trim() || !targetDate}
          >
            Set the goal
          </Button>
        </SlipFoot>
      </Slip>

      <div className="addpage__side">
        <Recap
          rows={[
            { k: 'Target', v: target.trim() ? fmtBDT(targetNum) : '—' },
            { k: 'Already saved', v: saved.trim() ? fmtBDT(savedNum) : '—' },
            { k: 'Still to go', v: target.trim() ? fmtBDT(remaining) : '—' },
            { k: 'Time left', v: monthsLeft > 0 ? `${monthsLeft} months` : '—' },
            { k: 'Save each month', v: perMonth > 0 ? fmtBDT(Math.round(perMonth)) : '—', total: true },
          ]}
        />
      </div>
    </form>
  );
}
