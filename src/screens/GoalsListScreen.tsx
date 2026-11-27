/**
 * GoalsListScreen — multi-column card grid, rendered as RECEIPTS.
 *
 * Visual target: docs/ux-designs/.../mockups/v2/dark.html#goals
 *
 * 2026-11-26 redesign (variant G4, "the receipt"): each goal is a
 * till receipt — monospaced line items, dashed rules, a perforated
 * edge top and bottom, and a status stamp tilted at the top-right.
 * The progress BAR, the percent PILL and the star tile are gone:
 * the receipt is the record, and its NUMBERS carry the progress.
 * "TARGET / SAVED / PROGRESS / DUE" read as a statement, and
 * "STILL NEEDED" is the receipt's total.
 *
 * The saved amount is derived from transaction history (R6), so the
 * card shows the live aggregate, not the stale stored field.
 *
 * 2026-08-14 polish: header carries an "Add" CTA — goals are a
 * separate entity from transactions, so the global "Add transaction"
 * sidebar CTA doesn't help here. The empty state has its own contextual
 * button.
 *
 * The pace classification is unchanged — it now reads as the
 * receipt's footnote ("PACE: AHEAD") rather than a chip in the
 * header, so the pace still states the one thing the numbers alone
 * cannot: whether the money is keeping up with the calendar.
 */
import { Link } from 'react-router-dom';
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
import { EmptyState, GoalsIllustration } from '../components/EmptyState';
import { fmtBDT, fmtDate } from '../lib/format';

/**
 * Classify the user's pace toward a goal as ahead / on-track / behind.
 *   - completed  → already saved ≥ target
 *   - expired    → deadline has passed without hitting target
 *   - ahead      → saved more than (elapsedRatio × target) would imply
 *   - on-track   → saved roughly in line with elapsed time
 *   - behind     → saved less than 80% of (elapsedRatio × target)
 *
 * "Elapsed ratio" uses the months between goal creation and its target
 * date, not today's date — that's the user's planned pace. Comparing
 * today's saved to that planned pace gives a fair signal.
 */
function paceOf(g: { targetDate: string; createdAt?: string }, saved: number, target: number): 'completed' | 'expired' | 'ahead' | 'on-track' | 'behind' {
  if (saved >= target) return 'completed';
  if (g.targetDate && isGoalExpired({ targetDate: g.targetDate } as any)) return 'expired';
  const start = g.createdAt ? new Date(g.createdAt) : new Date();
  const plannedMonths = Math.max(1, monthsBetween(start, g.targetDate));
  const elapsedMonths = Math.max(0, monthsBetween(start, today()));
  const expected = (elapsedMonths / plannedMonths) * target;
  if (expected <= 0) return 'on-track';
  if (saved >= expected) return 'ahead';
  if (saved >= expected * 0.8) return 'on-track';
  return 'behind';
}

const PACE_LABEL: Record<ReturnType<typeof paceOf>, string> = {
  completed: 'Done',
  expired: 'Overdue',
  ahead: 'Ahead',
  'on-track': 'On track',
  behind: 'Behind',
};

// The pace line's ink. Completed / ahead → success (you're winning).
// On-track → primary (the neutral "fine" state). Behind → warn
// (slipping). Expired → danger (deadline passed without hitting
// target).
const PACE_TEXT_COLOR: Record<ReturnType<typeof paceOf>, string> = {
  completed: 'var(--success)',
  ahead:     'var(--success)',
  'on-track':'var(--primary)',
  behind:    'var(--warn)',
  expired:   'var(--danger)',
};

/**
 * The receipt's status STAMP.
 *
 * A stamp is a physical claim about a document, so the wording is
 * document language rather than app language: a goal past its date
 * is OVERDUE, a goal that hit its target is DONE, and anything else
 * is still OPEN.
 */
const STAMP_TEXT: Record<'completed' | 'expired' | 'open', string> = {
  completed: 'Done',
  expired:   'Overdue',
  open:      'Open',
};

/** The stamp's ink — a red rubber stamp for a late promise. */
const STAMP_COLOR: Record<'completed' | 'expired' | 'open', string> = {
  completed: 'var(--success)',
  expired:   'var(--danger)',
  open:      'var(--muted)',
};

export function GoalsListScreen() {
  const state = useStore(s => s.state);
  const gs = goals.list(state);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap justify-between items-end gap-2">
        <div>
          <h1 className="heading h1-screen">Goals</h1>
          <div className="text-muted t-13 mt-1.5 tabular">{gs.length} total</div>
        </div>
        <Link
          to="/goals/add"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-btn font-bold t-13 text-primary-on hover:opacity-95 active:translate-y-px transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          style={{ background: 'var(--primary)' }}
        >
          <span className="t-13 leading-none">+</span>
          <span>Add</span>
        </Link>
      </div>

      {gs.length === 0 ? (
        <section className="card">
          <EmptyState
            illustration={<GoalsIllustration />}
            title="Save toward something"
            description="Set a target amount and a date. We'll tell you how much to save each month."
            cta={{ to: '/goals/add', label: '+ New goal' }}
            learnMoreTopic="goals"
          />
        </section>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
          {gs.map(g => {
            const saved = goalSaved(g);
            const target = Number(g.target) || 0;
            const pct = target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0;
            const remaining = Math.max(0, target - saved);
            const required = goalRequiredPerMonth(g, saved);
            const completed = isGoalCompleted(g, saved);
            const pace = paceOf(g, saved, target);

            // The stamp states the goal's STATUS — done, overdue, or
            // still open. The pace (ahead / behind) is a separate
            // fact and lives in the footnote below the total.
            const stamp: 'completed' | 'expired' | 'open' =
              completed ? 'completed' : pace === 'expired' ? 'expired' : 'open';

            return (
              <Link
                key={g.id}
                to={`/goals/${g.id}`}
                className="goal-receipt card-link flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                style={{ ['--stamp' as string]: STAMP_COLOR[stamp] }}
                aria-label={`${g.name}. ${STAMP_TEXT[stamp]}. ${pct}% saved toward ${fmtBDT(target)}.`}
              >
                {/* The heading — the goal's name set in caps, with the
                    status stamp tilted at the far right. */}
                <div className="goal-receipt__head">
                  <span className="goal-receipt__name">{g.name}</span>
                  <span className="goal-receipt__stamp">{STAMP_TEXT[stamp]}</span>
                </div>

                <div className="goal-receipt__rule" />

                {/* The statement — one line item per fact. The
                    PROGRESS figure carries the progressbar role so
                    assistive tech still announces the percentage. */}
                <div className="goal-receipt__row">
                  <span>Target</span>
                  <b>{fmtBDT(target)}</b>
                </div>
                <div className="goal-receipt__row">
                  <span>Saved</span>
                  <b>{fmtBDT(saved)}</b>
                </div>
                <div className="goal-receipt__row">
                  <span>Progress</span>
                  <b
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${g.name} saved toward target`}
                    title={`${pct}% saved vs target pace`}
                  >
                    {pct}%
                  </b>
                </div>
                <div className="goal-receipt__row">
                  <span>Due</span>
                  <b>{g.targetDate ? fmtDate(g.targetDate) : '—'}</b>
                </div>

                <div className="goal-receipt__rule" />

                {/* The receipt's total — what is still owed to the
                    goal. A completed goal has no total, so the line
                    is replaced by the paid note. */}
                {completed ? (
                  <div className="goal-receipt__row">
                    <span>Status</span>
                    <b>Goal reached. Nice.</b>
                  </div>
                ) : (
                  <div className="goal-receipt__row goal-receipt__row--total">
                    <span>Still needed</span>
                    <b>{fmtBDT(remaining)}</b>
                  </div>
                )}

                {/* The footnote — the per-month ask, and the pace.
                    Both are the receipt's small print: real, but
                    secondary to the figures above. */}
                {!completed && remaining > 0 && (
                  <div className="goal-receipt__pace">
                    {!Number.isFinite(required) ? (
                      <span>Overdue — no monthly plan</span>
                    ) : required > 0 ? (
                      <span>
                        Save <b>{fmtBDT(required)}</b>/mo
                      </span>
                    ) : null}
                  </div>
                )}

                {/* Pace — hidden on-track (the no-news default), and
                    hidden for a goal that is done or past its date,
                    since the stamp already says it. */}
                {pace !== 'on-track' && pace !== 'completed' && pace !== 'expired' && (
                  <div className="goal-receipt__pace" style={{ ['--pace' as string]: PACE_TEXT_COLOR[pace] }}>
                    Pace: <b>{PACE_LABEL[pace]}</b>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}