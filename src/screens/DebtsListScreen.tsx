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
 *   │                                                 │  of ৳Y total│
 *   ├─────────────────────────────────────────────────┴────────────┤
 *   │  ◯━━━━━━━━━━━░░░░░░░░░░░░░░░░░░░░░  0.8% paid               │
 *   └────────────────────────────────────────────────────────────┘
 *
 * Completed debts stay in a quieter group at the bottom (no hover
 * lift — record-only).
 */
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useStore } from '../domain/store';
import * as debts from '../domain/debts';
import { loanPaymentSplit } from '../domain/math';
import { ArrowUp, ArrowDown, Check, User } from '../components/icons/Icons';
import { LoanPaymentModal } from './LoanPaymentModal';
import { fmtBDT } from '../lib/format';
import { cardSurfaceStyle, debtTone, leftBarClass, toneFillClass, toneTextClass, toneTileClass } from '../lib/cardSurface';

export function DebtsListScreen() {
  const state = useStore(s => s.state);
  const ds = debts.list(state);
  // Active debts — fully paid debts are surfaced in their own Completed
  // section so the active list stays focused on what's still owed.
  const active = ds.filter(d => d.status === 'active');
  const completed = ds.filter(d => d.status === 'completed');

  // Per-direction remaining totals for the Summary card. For loan-kind
  // debts we use `outstandingFor()` so the totals reflect the
  // interest-aware split, not just gross paid-off.
  let oweRemaining = 0;
  let receivableRemaining = 0;
  for (const d of active) {
    const left = d.kind === 'loan'
      ? debts.outstandingFor(d, state.transactions)
      : Math.max(0, (Number(d.total) || 0) - (Number(d.paidSoFar) || 0));
    if (d.direction === 'i_owe') oweRemaining += left;
    else receivableRemaining += left;
  }
  const showReceivable = receivableRemaining > 0;
  const showOwe = oweRemaining > 0;
  // V1.1: drives the extra sentence in the "How it works" copy.
  const hasAnyLoan = active.some(d => d.kind === 'loan');

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
                {hasAnyLoan && (
                  <>
                    {' '}
                    For loans with interest, each payment is split into <em>interest</em> (calculated on the outstanding principal) and <em>principal</em> — only the principal portion reduces what you still owe.
                  </>
                )}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function DebtCard({ debt: d }: { debt: any }) {
  const state = useStore(s => s.state);
  const pct = d.total > 0 ? Math.min(100, Math.round(((d.paidSoFar || 0) / d.total) * 100)) : 0;
  const isIOwe = d.direction === 'i_owe';
  const isLoan = d.kind === 'loan';
  // Per-category tone — derived once and reused everywhere on the
  // card (wash, bar, icon tile, bold figure, pill, progress bar).
  // Loan-kind debts override direction and use warn (amber).
  const cardTone = debtTone(d.direction, d.kind);
  const iconBg = toneTileClass(cardTone);
  const barFill = toneFillClass(cardTone);
  const amtColor = toneTextClass(cardTone);
  const directionLabel = isIOwe ? 'I owe' : 'Owed to me';

  // Right-zone figure: flat = total − paidSoFar (today's behaviour);
  // loan = outstandingFor() (walks transactions, applies split).
  const outstanding = isLoan
    ? debts.outstandingFor(d, state.transactions)
    : Math.max(0, d.total - (d.paidSoFar || 0));
  const headlineLabel = isLoan ? 'Outstanding' : 'Remaining';

  // For loan-kind debts with at least one payment: derive running
  // totals and the last payment's split so the card can show both.
  // Doing it once here avoids recomputing per-row in JSX.
  const linkedTx = isLoan
    ? state.transactions
        .filter(t => t.linkedDebtId === d.id)
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date))
    : [];
  let totalInterest = 0;
  let totalPrincipal = 0;
  if (isLoan && linkedTx.length > 0) {
    const rate = Number(d.interestRate) || 0;
    let out = Number(d.total) || 0;
    for (const t of linkedTx) {
      const matches =
        (d.direction === 'i_owe' && t.type === 'expense') ||
        (d.direction === 'owed_to_me' && t.type === 'income');
      if (!matches) continue;
      const split = loanPaymentSplit(out, Number(t.amount) || 0, rate);
      totalInterest += split.interest;
      totalPrincipal += split.principal;
      out = Math.max(0, out - split.principal);
    }
  }
  const hasPayments = linkedTx.length > 0;

  // Loan payment modal — opened from the Pay button on loan cards.
  const [payOpen, setPayOpen] = useState(false);
  function openPay(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setPayOpen(true);
  }

  return (
    <div
      className="card card-link flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 overflow-hidden relative"
      style={cardSurfaceStyle(cardTone)}
    >
      <Link
        to={`/debts/${d.id}/edit`}
        className="absolute inset-0 z-0"
        aria-label={`Edit debt "${d.name}"`}
      />
      {/* Left-edge direction bar — 3px tone-coloured stripe. Direction-
          encoded: danger for i_owe, primary for owed_to_me. */}
      <span
        aria-hidden
        className={`absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-r-full pointer-events-none z-[1] ${leftBarClass(cardTone)}`}
      />
      {/* Top row — horizontal split: identity (left) + remaining/outstanding
          (right), separated by a 1px divider. Mirrors the investment card.
          Padding tightened to pt-2.5 pb-2 + inner gap-1 (down from gap-1.5
          + py-0.5) so the card reads as one line of identity plus a
          compact second row. */}
      <div className="flex items-stretch gap-5 sm:gap-6 px-6 pt-2.5 pb-2">
        {/* Left zone — direction tag, icon, name, meta. */}
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          {/* Direction tag — top-left, uppercase, muted. The first thing
              the user scans so the polarity of the card is clear before
              reading the number. */}
          <div
            className="text-[10.5px] text-muted uppercase tracking-[0.12em] font-semibold"
            title={isIOwe ? 'You owe this person' : 'This person owes you'}
          >
            {directionLabel}
            {isLoan && (
              <span
                className={`ml-2 inline-flex items-center px-1.5 py-px rounded-pill text-[9.5px] font-bold uppercase tracking-wider align-middle ${toneTileClass('danger')}`}
              >
                Loan
              </span>
            )}
          </div>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-10 h-10 rounded-[10px] grid place-items-center shrink-0 ${iconBg}`}>
              {/* Icon distinguishes flat vs loan:
                  - loan-kind → directional ArrowUp/ArrowDown (money flow)
                  - flat-kind → User silhouette (personal IOU between people) */}
              {isLoan ? (
                isIOwe
                  ? <ArrowDown className="w-[18px] h-[18px]" strokeWidth={2} />
                  : <ArrowUp className="w-[18px] h-[18px]" strokeWidth={2} />
              ) : (
                <User className="w-[18px] h-[18px]" strokeWidth={2} />
              )}
            </div>
            {/* Single-line name. Matches the investment / loan card
                so short names don't reserve a phantom second line of
                vertical space. Long names still truncate with ellipsis. */}
            <div className="font-semibold text-[16px] tracking-tight leading-tight truncate min-w-0">
              {d.name}
            </div>
          </div>
          {/* V1.1 (L3.3): for loan-kind debts with payments, show
              Paid · interest · principal on one row. Flat debts keep
              the original "Paid X of Y total" wording. */}
          <div className="text-[12px] text-muted tabular truncate">
            {isLoan && hasPayments ? (
              <>
                Paid {fmtBDT(d.paidSoFar || 0)}
                {' · '}
                <span className="text-danger">{fmtBDT(totalInterest)}</span> interest
                {' · '}
                <span className={toneTextClass(cardTone)}>{fmtBDT(totalPrincipal)}</span> principal
              </>
            ) : (
              <>Paid {fmtBDT(d.paidSoFar || 0)} of {fmtBDT(d.total)} total</>
            )}
          </div>
        </div>

        {/* Vertical divider between identity and amounts. */}
        <div
          aria-hidden
          className="w-px self-stretch my-1 shrink-0"
          style={{ background: 'var(--divider)' }}
        />

        {/* Right zone — Outstanding/Remaining, right-aligned. flex flex-col +
            items-end keeps the figures right-aligned; shrink-0 prevents
            the right zone from being squeezed when the left zone gets
            long names. z-[1] so any button in this zone stays clickable
            above the full-card <Link>. */}
        <div className="relative z-[1] flex flex-col gap-1.5 items-end justify-center shrink-0">
          <span className="text-[10px] text-muted uppercase tracking-wider font-semibold">
            {headlineLabel}
          </span>
          <span className={`font-bold tabular text-[24px] tracking-tight leading-none ${amtColor}`}>
            {isIOwe ? '\u2212' : '+'} {fmtBDT(outstanding)}
          </span>
          <span className="text-[10.5px] text-muted tabular">
            of {fmtBDT(d.total)} total
          </span>
        </div>
      </div>

      {/* Progress strip + Pay-now action row. Bar + "X% paid" on the
          left (flex-1); Pay-now chip on the right when this is a
          loan-kind active debt. z-[1] on the button keeps it clickable
          above the full-card <Link>. */}
      <div className="px-6 pb-2.5 flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="h-1.5 bg-surface-2 rounded-pill overflow-hidden">
            <div
              className={`h-full rounded-pill ${barFill} transition-all duration-200`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="text-[10.5px] text-muted tabular mt-1">{pct}% paid</div>
        </div>
        {/* V1.1 (L3.1): Pay shortcut — loan-kind only, active only.
            Bottom-right of the card, opposite the figures up top.
            Sharp 4px corners + raised surface (surface-3) make it
            read as a separate control rather than a chip that
            belongs to the card's rounded-12px surface — the visual
            treatment is theme-consistent (uses the same surface-3
            token in dark and light mode). Variant tracks the card's
            polarity on the label edge: danger stripe for i_owe,
            primary stripe for owed_to_me. z-[1] so it stays
            clickable above the full-card <Link>. */}
        {isLoan && d.status === 'active' && (
          // Solid filled chip — the strongest call-to-action on the
          // card. Matches fintech convention (Revolut/Wise solid pills
          // for primary actions). Dark crimson fill + white text +
          // white dot. A plain <button> instead of <Button> so we
          // control every aspect without fighting shared
          // variant/size classes.
          <button
            type="button"
            onClick={openPay}
            title={`Record a payment toward "${d.name}"`}
            // Darker crimson than the theme --danger surface tone.
            // The base --danger is too pale in light mode (#DC8678
            // salmon) and not punchy enough in dark mode (#B03222 —
            // fine, but feels washed next to the deep bg). We darken
            // both modes toward pure black so the chip lands in the
            // same deep-oxblood range regardless of theme, giving
            // white text the contrast it needs. Mixing with `black`
            // (not --ink or --danger-on, both of which are white in
            // dark mode and would *lighten* the chip there) keeps it
            // consistently dark across themes.
            style={{ background: 'color-mix(in srgb, var(--danger) 65%, black)' }}
            className="shrink-0 z-[1] inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[#ffffff] text-[13px] font-bold tracking-tight border-0 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/40 transition active:translate-y-px"
          >
            {/* Filled dot — solid white on the dark-red surface. */}
            <span
              aria-hidden
              className="inline-block w-1.5 h-1.5 rounded-full bg-white"
            />
            Pay now
          </button>
        )}
      </div>

      {payOpen && (
        <LoanPaymentModal
          debt={d}
          outstandingAtOpen={outstanding}
          onClose={() => setPayOpen(false)}
        />
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
