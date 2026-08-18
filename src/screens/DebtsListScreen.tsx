/**
 * DebtsListScreen — one card per active debt, flat list.
 *
 * 2026-08-18 polish: each active debt is its own .card surface
 * (matching the Accounts / Goals / Investments grids). The direction
 * label ("I OWE" / "OWED TO ME") sits in the top-left of each card
 * as a small uppercase tag, so the user can scan direction at a
 * glance without a separate group header. Completed debts stay in a
 * quieter group at the bottom (no hover lift — record-only).
 *
 * Card shape (per the reference):
 *   ┌─ I OWE                       ← direction tag (top-left)
 *   │  [↓] dfgh           − ৳1,234 ← icon + name + remaining
 *   │       Paid ৳0 of ৳1,234 total
 *   │  ━━━━━━━━━━━━━━━━━━━━━━━━━━ ← progress bar (danger→warn gradient)
 *   │  0% paid
 *   └─
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
            <div className="text-[12.5px] mt-2">Add a debt to track who owes whom.</div>
          </div>
        </section>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {active.map(d => <DebtCard key={d.id} debt={d} />)}
          </div>
          {completed.length > 0 && (
            <CompletedSection rows={completed} />
          )}
        </>
      )}
    </div>
  );
}

function DebtCard({ debt: d }: { debt: any }) {
  const pct = d.total > 0 ? Math.min(100, Math.round(((d.paidSoFar || 0) / d.total) * 100)) : 0;
  const left = Math.max(0, d.total - (d.paidSoFar || 0));
  const isIOwe = d.direction === 'i_owe';
  // Tone pair follows the existing palette: i_owe is danger (you're
  // paying it down), owed_to_me is primary (you'd receive it back).
  const tone = isIOwe ? 'danger' : 'primary';
  const iconBg = isIOwe ? 'bg-danger-soft text-danger' : 'bg-primary-soft text-primary';
  const barFill = isIOwe ? 'bg-gradient-to-r from-danger to-warn' : 'bg-gradient-to-r from-primary to-accent';
  const amtColor = isIOwe ? 'text-danger' : 'text-primary';
  const directionLabel = isIOwe ? 'I owe' : 'Owed to me';
  return (
    <Link
      to={`/debts/${d.id}/edit`}
      className="card card-link flex flex-col gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
    >
      {/* Direction tag — top-left, uppercase, muted. The first thing
          the user scans so the polarity of the card is clear before
          reading the number. */}
      <div
        className="text-[10.5px] text-muted uppercase tracking-[0.12em] font-semibold"
        title={tone === 'danger' ? 'You owe this person' : 'This person owes you'}
      >
        {directionLabel}
      </div>

      {/* Identity + remaining row. Push to the top of the card so the
          progress bar + caption sit at the bottom. */}
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-10 h-10 rounded-[10px] grid place-items-center shrink-0 ${iconBg}`}>
          {isIOwe
            ? <ArrowDown className="w-[18px] h-[18px]" strokeWidth={2} />
            : <ArrowUp className="w-[18px] h-[18px]" strokeWidth={2} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-[15px] tracking-tight truncate">{d.name}</div>
          <div className="text-[11.5px] text-muted tabular mt-1 truncate">
            Paid {fmtBDT(d.paidSoFar || 0)} of {fmtBDT(d.total)} total
            {d.dueDate ? ` · due ${fmtDate(d.dueDate)}` : ''}
            {d.person ? ` · ${d.person}` : ''}
          </div>
        </div>
        <div className={`font-bold tabular text-[16px] shrink-0 ${amtColor}`}>
          {isIOwe ? '\u2212' : '+'} {fmtBDT(left)}
        </div>
      </div>

      {/* Progress bar + caption. mt-auto pushes to the card bottom so
          cards in a row share a baseline regardless of meta length. */}
      <div className="mt-auto flex flex-col gap-1.5">
        <div className="h-2 bg-surface-2 rounded-pill overflow-hidden">
          <div
            className={`h-full rounded-pill ${barFill}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="text-[10.5px] text-muted tabular">{pct}% paid</div>
      </div>
    </Link>
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
