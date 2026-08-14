/**
 * DebtsListScreen — grouped by direction (I owe / Owed to me).
 *
 * Visual target: docs/ux-designs/.../mockups/v2/dark.html#debts
 * Each section is a card with rows like the mockup; bar uses danger
 * color for i_owe, primary for owed_to_me.
 *
 * Each row is a Link to /debts/:id/edit (whole-row click target with
 * hover affordance + chevron, matching the transaction list pattern).
 *
 * 2026-08-14 polish: shared .card primitive, refined progress bar
 * height (8px), refined row hover, and a left-edge accent dot that
 * fades in on row hover.
 *
 * 2026-08-14 polish: the header carries an "Add" CTA — debts are a
 * separate entity from transactions, so the global "Add transaction"
 * sidebar CTA doesn't help here. The empty-state still gets its own
 * contextual button so first-run users aren't stranded.
 */
import { Link } from 'react-router-dom';
import { useStore } from '../domain/store';
import * as debts from '../domain/debts';
import { ArrowUp, ArrowDown, Check, ChevronRight } from '../components/icons/Icons';
import { fmtBDT, fmtDate } from '../lib/format';

export function DebtsListScreen() {
  const state = useStore(s => s.state);
  const ds = debts.list(state);
  // Active debts — fully paid debts are surfaced in their own Completed
  // section so the active list stays focused on what's still owed.
  const active = ds.filter(d => d.status === 'active');
  const completed = ds.filter(d => d.status === 'completed');
  const iOwe = active.filter(d => d.direction === 'i_owe');
  const owed = active.filter(d => d.direction === 'owed_to_me');

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap justify-between items-end gap-2">
        <div>
          <h1 className="heading h1-screen">Debts</h1>
          <div className="text-muted text-[13px] mt-1.5 tabular">
            {active.length} active{completed.length > 0 ? ` \u00B7 ${completed.length} completed` : ''}
          </div>
        </div>
        <Link
          to="/debts/add"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-btn font-bold text-[13px] text-primary-on hover:opacity-95 active:translate-y-px transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          style={{ background: 'var(--primary)' }}
        >
          <span className="text-base leading-none">+</span>
          <span>Add</span>
        </Link>
      </div>

      {ds.length === 0 ? (
        <section className="card">
          <div className="py-10 text-center text-muted">
            <div className="text-[14px] font-semibold text-ink">No debts yet.</div>
          </div>
        </section>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <DebtGroup title="I owe"      rows={iOwe} tone="danger" />
            <DebtGroup title="Owed to me" rows={owed} tone="primary" />
          </div>
          {completed.length > 0 && (
            <CompletedSection rows={completed} />
          )}
        </>
      )}
    </div>
  );
}

function CompletedSection({ rows }: { rows: any[] }) {
  const state = useStore(s => s.state);
  return (
    <section className="card">
      <h2 className="text-[11px] text-muted uppercase tracking-[0.08em] font-semibold m-0 mb-3.5">
        Completed ({rows.length})
      </h2>
      <div>
        {rows.map(d => {
          // Find the account that was used in the linked transactions —
          // most recent first, so the user sees the account that actually
          // received the final payment.
          const linked = state.transactions
            .filter(t => t.linkedDebtId === d.id)
            .slice()
            .sort((a, b) => b.date.localeCompare(a.date));
          const accId = linked[0]?.accountId;
          const acc = state.accounts.find((a: any) => a.id === accId);
          return (
            <Link
              key={d.id}
              to={`/debts/${d.id}/edit`}
              className="group relative block py-2.5 border-t border-border first:border-0 row-hover -mx-2 px-2 rounded transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              <span
                aria-hidden
                className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r-full opacity-0 group-hover:opacity-100 transition"
                style={{ background: 'var(--primary)' }}
              />
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-[10px] grid place-items-center bg-success-soft text-success">
                    <Check className="w-[18px] h-[18px]" strokeWidth={2} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-[14px] leading-tight truncate tracking-tight">{d.name}</div>
                    <div className="text-xs text-muted leading-tight mt-1 truncate tabular">
                      {fmtBDT(d.total)} paid off
                      {d.person ? ` \u00B7 ${d.person}` : ''}
                      {acc ? ` \u00B7 ${acc.name}` : ''}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <ChevronRight className="w-4 h-4 text-muted opacity-0 group-hover:opacity-100 transition" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function DebtGroup({
  title, rows, tone,
}: { title: string; rows: any[]; tone: 'danger' | 'primary' }) {
  return (
    <section className="card">
      <h2 className="text-[11px] text-muted uppercase tracking-[0.08em] font-semibold m-0 mb-3.5">{title}</h2>
      {rows.length === 0 ? (
        <div className="text-muted text-sm py-6 text-center">
          {tone === 'primary' ? 'Nothing owed to you \u2014 nice!' : 'Nothing here.'}
        </div>
      ) : (
        <div>
          {rows.map(d => {
            const pct = d.total > 0 ? Math.min(100, Math.round(((d.paidSoFar || 0) / d.total) * 100)) : 0;
            const left = d.total - (d.paidSoFar || 0);
            const iconBg = tone === 'danger' ? 'bg-danger-soft text-danger' : 'bg-primary-soft text-primary';
            // Gradient pattern matches the goal cards (primary → accent for
            // progress-positive, danger → warn for progress-negative). i_owe
            // (you're paying it down) reads as a "progress" semantic too, so
            // we give it the same gradient treatment instead of flat red.
            const barFill = tone === 'danger' ? 'bg-gradient-to-r from-danger to-warn' : 'bg-gradient-to-r from-primary to-accent';
            const amtColor = tone === 'danger' ? 'text-danger' : 'text-primary';
            const accentColor = tone === 'danger' ? 'var(--danger)' : 'var(--primary)';
            return (
              <Link
                key={d.id}
                to={`/debts/${d.id}/edit`}
                className="group relative block py-2.5 border-t border-border first:border-0 row-hover -mx-2 px-2 rounded transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                <span
                  aria-hidden
                  className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r-full opacity-0 group-hover:opacity-100 transition"
                  style={{ background: accentColor }}
                />
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-[10px] grid place-items-center ${iconBg}`}>
                      {tone === 'danger' ? <ArrowDown className="w-[18px] h-[18px]" /> : <ArrowUp className="w-[18px] h-[18px]" />}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-[14px] leading-tight truncate tracking-tight">{d.name}</div>
                      <div className="text-xs text-muted leading-tight mt-1 truncate tabular">
                        {fmtBDT(d.paidSoFar || 0)} / {fmtBDT(d.total)}
                        {d.dueDate ? ` \u00B7 by ${fmtDate(d.dueDate)}` : ''}
                        {d.person ? ` \u00B7 ${d.person}` : ''}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className={`font-bold tabular text-[14px] ${amtColor}`}>
                      {tone === 'danger' ? '\u2212' : '+'} {fmtBDT(left)}
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted opacity-0 group-hover:opacity-100 transition" />
                  </div>
                </div>
                <div className="mt-2 h-2 bg-surface-2 rounded-pill overflow-hidden">
                  <div className={`h-full rounded-pill ${barFill}`} style={{ width: `${pct}%` }} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}