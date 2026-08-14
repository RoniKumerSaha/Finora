/**
 * GoalsListScreen — multi-column card grid matching the mockup.
 *
 * Visual target: docs/ux-designs/.../mockups/v2/dark.html#goals
 * Each card: name + percent chip in a row, gradient bar, two-line
 * meta (saved/target and by-date). Cards link to /goals/:id for detail.
 *
 * The saved amount is derived from transaction history (R6), so the
 * card shows the live aggregate, not the stale stored field.
 */
import { Link } from 'react-router-dom';
import { useStore } from '../domain/store';
import * as goals from '../domain/goals';
import { goalSavedFromTxns } from '../domain/math';
import { fmtBDT, fmtDate } from '../lib/format';

export function GoalsListScreen() {
  const state = useStore(s => s.state);
  const gs = goals.list(state);

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight leading-none">Goals</h1>
          <div className="text-muted text-[13px] mt-1">{gs.length} total</div>
        </div>
        <Link to="/goals/add" className="inline-flex items-center justify-center gap-2 bg-primary text-primary-on px-4 py-2.5 rounded-btn font-semibold text-[13.5px] hover:opacity-90">
          <span className="text-base leading-none">+</span>
          <span>New goal</span>
        </Link>
      </div>

      {gs.length === 0 ? (
        <section className="bg-surface border border-border rounded-card p-5 shadow-card">
          <div className="py-9 text-center text-muted">
            <div className="text-3xl opacity-60 mb-2">{'\u2605'}</div>
            <div className="text-base font-semibold text-ink">Save toward something</div>
            <p className="mt-2 text-sm">Set a target amount and a date. We'll tell you how much to save each month.</p>
            <Link to="/goals/add" className="inline-block mt-3 bg-primary text-primary-on px-4 py-2 rounded-btn text-sm font-semibold">
              + New goal
            </Link>
          </div>
        </section>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-[14px]">
          {gs.map(g => {
            const saved = goalSavedFromTxns(g, state.transactions);
            const pct = Math.min(100, Math.round((saved / (Number(g.target) || 1)) * 100));
            return (
              <Link
                key={g.id}
                to={`/goals/${g.id}`}
                className="block bg-surface border border-border rounded-card p-5 shadow-card hover:border-primary transition"
              >
                <div className="flex justify-between items-center">
                  <div className="font-semibold">{g.name}</div>
                  <div className="text-[11px] text-primary font-bold bg-primary-soft px-2 py-0.5 rounded-pill">{pct}%</div>
                </div>
                <div className="mt-2.5 h-2 bg-surface-2 rounded-pill overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-primary to-accent rounded-pill" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex justify-between text-xs text-muted mt-1.5">
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
