/**
 * GoalsListScreen — multi-column card grid matching the mockup.
 *
 * Visual target: docs/ux-designs/.../mockups/v2/dark.html#goals
 * Each card: name + percent chip in a row, gradient bar, two-line
 * meta (saved/target and by-date). Cards link to /goals/:id for detail.
 *
 * The saved amount is derived from transaction history (R6), so the
 * card shows the live aggregate, not the stale stored field.
 *
 * 2026-08-14 polish: cards use the shared .card primitive (rounded
 * 12px, 24px padding, refined shadow), the progress bar is slightly
 * taller, and hover affordance is subtle border + lift.
 *
 * 2026-08-14 polish: header carries an "Add" CTA — goals are a
 * separate entity from transactions, so the global "Add transaction"
 * sidebar CTA doesn't help here. The empty state has its own contextual
 * button.
 *
 * 2026-08-31 polish: every goal card now carries the shared
 * info-tone wash + 3px accent bar — the same treatment the
 * account / debt / investment / planned-loan cards use, so the
 * goal list feels of-a-piece with the rest of the app. Progress
 * bar fill follows --info so the card reads as one themed unit
 * (wash + bar + accent bar all share the cool-blue family).
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
import { cardSurfaceStyle, leftBarClass } from '../lib/cardSurface';
import { Pill } from '../components/Pill';

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

// Map a goal's pace state to the tone the pace chip + label should use.
// Completed / ahead → success (you're winning). On-track → primary
// (the neutral "fine" state). Behind → warn (slipping). Expired → danger
// (deadline passed without hitting target).
const PACE_TONE: Record<ReturnType<typeof paceOf>, 'success' | 'primary' | 'warn' | 'danger'> = {
  completed: 'success',
  ahead:     'success',
  'on-track':'primary',
  behind:    'warn',
  expired:   'danger',
};

// Inline-label color matches the chip's tone — the small "Pace: Behind"
// line below the meta block uses the same hue so the chip + caption read
// as one themed unit.
const PACE_TEXT_COLOR: Record<ReturnType<typeof paceOf>, string> = {
  completed: 'var(--success)',
  ahead:     'var(--success)',
  'on-track':'var(--primary)',
  behind:    'var(--warn)',
  expired:   'var(--danger)',
};

export function GoalsListScreen() {
  const state = useStore(s => s.state);
  const gs = goals.list(state);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap justify-between items-end gap-2">
        <div>
          <h1 className="heading h1-screen">Goals</h1>
          <div className="text-muted text-[13px] mt-1.5 tabular">{gs.length} total</div>
        </div>
        <Link
          to="/goals/add"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-btn font-bold text-[13px] text-primary-on hover:opacity-95 active:translate-y-px transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          style={{ background: 'var(--primary)' }}
        >
          <span className="text-base leading-none">+</span>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {gs.map(g => {
            const saved = goalSaved(g);
            const target = Number(g.target) || 0;
            const pct = target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0;
            const remaining = Math.max(0, target - saved);
            const required = goalRequiredPerMonth(g, saved);
            const completed = isGoalCompleted(g, saved);
            const pace = paceOf(g, saved, target);
            const paceTone = PACE_TONE[pace];

            return (
              <Link
                key={g.id}
                to={`/goals/${g.id}`}
                className="card card-link flex flex-col gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 relative overflow-hidden"
                style={cardSurfaceStyle('info')}
              >
                {/* Left accent bar — 3px info-tone stripe (matches the
                    wash + progress-bar fill so the whole card reads as
                    one themed unit). Same bar treatment as the
                    account / debt / investment / planned-loan cards. */}
                <span
                  aria-hidden
                  className={`absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full pointer-events-none ${leftBarClass('info')}`}
                />
                <div className="flex justify-between items-start gap-2">
                  <div className="font-semibold text-[15px] tracking-tight leading-tight line-clamp-2 min-h-[2.6em]">{g.name}</div>
                  <Pill tone={paceTone} variant="solid" title={`${pct}% saved vs target pace`}>
                    {pct}%
                  </Pill>
                </div>
                <div className="h-2.5 bg-surface-2 rounded-pill overflow-hidden">
                  <div className="h-full rounded-pill" style={{
                    width: `${pct}%`,
                    background: 'var(--info)',
                  }} />
                </div>

                {/* Two-line meta:
                       line 1 — saved / target + deadline
                       line 2 — remaining + required/mo (the action prompt) */}
                <div className="flex justify-between text-xs text-muted tabular">
                  <span>{fmtBDT(saved)} / {fmtBDT(target)}</span>
                  <span>{g.targetDate ? `by ${fmtDate(g.targetDate)}` : ''}</span>
                </div>
                {!completed && remaining > 0 && (
                  <div className="text-[11.5px] text-muted tabular flex items-center justify-between gap-2 pt-1 mt-0.5 border-t border-border-2/60">
                    <span>
                      Need <b className="text-ink font-semibold">{fmtBDT(remaining)}</b> more
                    </span>
                    {!Number.isFinite(required) ? (
                      <span className="text-warn font-semibold">overdue</span>
                    ) : required > 0 ? (
                      <span>
                        <b className="text-ink font-semibold">{fmtBDT(required)}</b>/mo
                      </span>
                    ) : null}
                  </div>
                )}
                {completed && (
                  <div className="text-[11.5px] text-muted tabular pt-1 mt-0.5 border-t border-border-2/60">
                    Goal reached. <span className="text-primary font-semibold">Nice.</span>
                  </div>
                )}

                {/* Pace indicator — small chip at the bottom-right of
                    the meta block. Hidden if pace is on-track (the
                    default, no-news state) to avoid noise. */}
                {pace !== 'on-track' && pace !== 'completed' && pace !== 'expired' && (
                  <div className="text-[10.5px] text-muted tabular -mt-1.5">
                    Pace: <b style={{ color: PACE_TEXT_COLOR[pace] }}>{PACE_LABEL[pace]}</b>
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