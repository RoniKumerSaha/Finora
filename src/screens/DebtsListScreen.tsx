/**
 * DebtsListScreen — one card per active debt, full-width stacked.
 *
 * 2026-08-18 redesign: switched the active-debt card to the same
 * horizontal split the investment card uses (left = identity + terms,
 * right = headline amount, separated by a 1px divider). One card per
 * debt, stacked in a single column so meta doesn't truncate at lg
 * widths. Summary card pinned to the right at lg+ summarises the
 * remaining balance per direction (mirrors InvestmentsListScreen).
 *
 * Card shape (one row, on the left column):
 *   ┌─ I OWE                                          ┌────────────┐
 *   │  [↓] City Bank Loan                       │     │ − ৳12,26,261│
 *   │       Paid ৳100 of ৳12,26,361 total     │     │   Remaining │
 *   │       Due 12 Aug 2027 · Person                  │  of ৳Y total│
 *   ├─────────────────────────────────────────────┴────────────┤
 *   │  ◯━━━━━━━━━━━░░░░░░░░░░░░░░░░░░░░░  0.8% paid               │
 *   └────────────────────────────────────────────────────────────┘
 *
 * Completed debts stay in a quieter group at the bottom (no hover
 * lift — record-only).
 */
import { Link } from 'react-router-dom';
import { useStore } from '../domain/store';
import * as debts from '../domain/debts';
import { ArrowUp, ArrowDown, Check } from '../components/icons/Icons';
import { fmtBDT, fmtDate } from '../lib/format';

const MIDDOT = '\u00B7';

export function DebtsListScreen() {
  const state = useStore(s => s.state);
  const ds = debts.list(state);
  // Active debts — fully paid debts are surfaced in their own Completed
  // section so the active list stays focused on what's still owed.
  const active = ds.filter(d => d.status === 'active');
  const completed = ds.filter(d => d.status === 'completed');

  // Per-direction remaining totals for the Summary card.
  let oweRemaining = 0;
  let receivableRemaining = 0;
  for (const d of active) {
    const left = Math.max(0, (Number(d.total) || 0) - (Number(d.paidSoFar) || 0));
    if (d.direction === 'i_owe') oweRemaining += left;
    else receivableRemaining += left;
  }
  const showReceivable = receivableRemaining > 0;
  const showOwe = oweRemaining > 0;

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
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
          <div className="flex flex-col gap-4">
            {active.map(d => <DebtCard key={d.id} debt={d} />)}
            {completed.length > 0 && (
              <CompletedSection rows={completed} />
            )}
          </div>

          {/* Summary card — pinned on the right at lg+ so the totals
              stay visible while scrolling the list. Stacks below the
              list at smaller breakpoints. */}
          {(showOwe || showReceivable) && (
            <section className="card h-fit lg:sticky lg:top-4">
              <h2 className="text-[11px] text-muted uppercase tracking-[0.08em] font-semibold m-0 mb-4">Summary</h2>
              <div className="flex flex-col gap-5">
                {showOwe && (
                  <div>
                    <div className="text-[11px] text-muted uppercase tracking-wider font-semibold">You owe</div>
                    <div className="text-[26px] font-bold text-danger mt-2 tabular tracking-tight leading-none">
                      {fmtBDT(oweRemaining)}
                    </div>
                    <div className="text-[11px] text-muted mt-1.5 tabular">Across {active.filter(d => d.direction === 'i_owe').length} debt{active.filter(d => d.direction === 'i_owe').length === 1 ? '' : 's'}</div>
                  </div>
                )}
                {showReceivable && (
                  <div>
                    <div className="text-[11px] text-muted uppercase tracking-wider font-semibold">Owed to you</div>
                    <div className="text-[26px] font-bold text-primary mt-2 tabular tracking-tight leading-none">
                      {fmtBDT(receivableRemaining)}
                    </div>
                    <div className="text-[11px] text-muted mt-1.5 tabular">Across {active.filter(d => d.direction === 'owed_to_me').length} debt{active.filter(d => d.direction === 'owed_to_me').length === 1 ? '' : 's'}</div>
                  </div>
                )}
              </div>
              <div className="text-xs text-muted mt-5 leading-relaxed">
                <strong className="text-ink">How it works:</strong> <em>Remaining</em> is what's still owed on each active debt — total minus payments recorded against it. When you pay toward an <em>i_owe</em> debt, record it as an Expense tagged with the debt; when someone pays back an <em>owed_to_me</em> debt, record it as Income tagged the same way.
              </div>
            </section>
          )}
        </div>
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
  const iconBg = isIOwe ? 'bg-danger-soft text-danger' : 'bg-primary-soft text-primary';
  const barFill = isIOwe ? 'bg-gradient-to-r from-danger to-warn' : 'bg-gradient-to-r from-primary to-accent';
  const amtColor = isIOwe ? 'text-danger' : 'text-primary';
  const directionLabel = isIOwe ? 'I owe' : 'Owed to me';
  return (
    <Link
      to={`/debts/${d.id}/edit`}
      className="card card-link flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 overflow-hidden relative"
    >
      {/* Left-edge direction band — 4px colored stripe that runs the
          full height of the card. Direction-encoded: danger for
          i_owe, primary for owed_to_me. 0.7 opacity so the band
          harmonises with the card surface — same width + opacity
          as the Planner + Loan + Investment cards, so all four
          list surfaces share one visual signature. The card's
          border-radius clips the top-left and bottom-left corners
          so the band reads as baked into the surface. */}
      <span
        aria-hidden
        className="absolute left-0 top-0 h-full w-1 pointer-events-none"
        style={{
          background: isIOwe ? 'var(--danger)' : 'var(--primary)',
          opacity: 0.7,
        }}
      />
      {/* Top row — horizontal split: identity (left) + remaining (right),
          separated by a 1px divider. Mirrors the investment card.
          Padding trimmed from pt-5 pb-4 → pt-4 pb-3 so the top block
          lands at the same height as the investment card; the progress
          strip below provides the card's breathing room. */}
      <div className="flex items-stretch gap-5 sm:gap-6 px-6 pt-4 pb-3">
        {/* Left zone — direction tag, icon, name, meta. */}
        <div className="flex-1 min-w-0 flex flex-col gap-2 py-1">
          {/* Direction tag — top-left, uppercase, muted. The first thing
              the user scans so the polarity of the card is clear before
              reading the number. */}
          <div
            className="text-[10.5px] text-muted uppercase tracking-[0.12em] font-semibold"
            title={isIOwe ? 'You owe this person' : 'This person owes you'}
          >
            {directionLabel}
          </div>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-10 h-10 rounded-[10px] grid place-items-center shrink-0 ${iconBg}`}>
              {isIOwe
                ? <ArrowDown className="w-[18px] h-[18px]" strokeWidth={2} />
                : <ArrowUp className="w-[18px] h-[18px]" strokeWidth={2} />}
            </div>
            {/* Single-line name. Matches the investment / loan card
                so short names don't reserve a phantom second line of
                vertical space. Long names still truncate with ellipsis. */}
            <div className="font-semibold text-[16px] tracking-tight leading-tight truncate min-w-0">
              {d.name}
            </div>
          </div>
          <div className="text-[12px] text-muted tabular truncate">
            Paid {fmtBDT(d.paidSoFar || 0)} of {fmtBDT(d.total)} total
          </div>
          {(d.dueDate || d.person) && (
            <div className="text-[12px] text-muted flex items-center gap-2 flex-wrap">
              {d.dueDate ? <span>Due {fmtDate(d.dueDate)}</span> : null}
              {d.dueDate && d.person ? <span className="opacity-50" aria-hidden>{MIDDOT}</span> : null}
              {d.person ? <span className="truncate">{d.person}</span> : null}
            </div>
          )}
        </div>

        {/* Vertical divider between identity and amounts. */}
        <div
          aria-hidden
          className="w-px self-stretch my-1 shrink-0"
          style={{ background: 'var(--divider)' }}
        />

        {/* Right zone — Remaining, right-aligned. flex flex-col +
            items-end keeps the figures right-aligned; shrink-0 prevents
            the right zone from being squeezed when the left zone gets
            long names. */}
        <div className="flex flex-col gap-1.5 items-end justify-center shrink-0 sm:min-w-[200px]">
          <span className="text-[10px] text-muted uppercase tracking-wider font-semibold">
            Remaining
          </span>
          <span className={`font-bold tabular text-[24px] tracking-tight ${amtColor}`}>
            {isIOwe ? '\u2212' : '+'} {fmtBDT(left)}
          </span>
          <span className="text-[10.5px] text-muted tabular">
            of {fmtBDT(d.total)} total
          </span>
        </div>
      </div>

      {/* Progress strip — full card width, sits below the divider row.
          Thin (h-1.5) so it doesn't compete with the headline amounts.
          Bottom padding trimmed from pb-5 → pb-4 to keep the card
          compact once the top row is shorter. */}
      <div className="px-6 pb-4">
        <div className="h-1.5 bg-surface-2 rounded-pill overflow-hidden">
          <div
            className={`h-full rounded-pill ${barFill} transition-all duration-200`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="text-[10.5px] text-muted tabular mt-1.5">{pct}% paid</div>
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
                  <span className="text-[10px] text-muted uppercase tracking-wider font-semibold opacity-0 group-hover:opacity-100 transition">View</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
