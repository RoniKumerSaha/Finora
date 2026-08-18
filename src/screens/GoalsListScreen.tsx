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
 */
import { Link } from 'react-router-dom';
import { useStore } from '../domain/store';
import * as goals from '../domain/goals';
import { goalSaved } from '../domain/math';
import { EmptyState, GoalsIllustration } from '../components/EmptyState';
import { fmtBDT, fmtDate } from '../lib/format';

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {gs.map(g => {
            const saved = goalSaved(g);
            const pct = Math.min(100, Math.round((saved / (Number(g.target) || 1)) * 100));
            return (
              <Link
                key={g.id}
                to={`/goals/${g.id}`}
                className="card card-link flex flex-col gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                <div className="flex justify-between items-center">
                  <div className="font-semibold text-[15px] tracking-tight">{g.name}</div>
                  <div
                    className="text-[11px] text-primary font-bold px-2.5 py-[3px] rounded-pill tabular"
                    style={{ background: 'var(--primary-soft)' }}
                  >
                    {pct}%
                  </div>
                </div>
                <div className="h-2.5 bg-surface-2 rounded-pill overflow-hidden">
                  <div className="h-full rounded-pill" style={{
                    width: `${pct}%`,
                    background: 'linear-gradient(90deg, var(--primary), var(--accent))',
                  }} />
                </div>
                <div className="flex justify-between text-xs text-muted tabular">
                  <span>{fmtBDT(saved)} / {fmtBDT(g.target)}</span>
                  <span>{g.targetDate ? `by ${fmtDate(g.targetDate)}` : ''}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}