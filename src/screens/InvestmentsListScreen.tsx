/**
 * InvestmentsListScreen — one full-width card per investment, with
 * the Summary card pinned to the right at lg+.
 *
 * 2026-08-18 polish: each active investment is its own full-width
 * .card surface in the left column, not a half- or third-width tile.
 * The wider canvas lets the card carry identity + terms + amounts in
 * a clean left/right horizontal split, so the user can scan more text
 * without truncation. The Summary card stays on the right at lg+ so
 * the totals are always visible while scrolling the list; on smaller
 * screens it stacks below the list as a single full-width band.
 *
 * Card shape (one row, on the left column):
 *   ┌────────────────────────────────────────────────────────────────┐
 *   │  📅 Brac Bank DPS     5y · 8% · Brac Bank   [DPS]   │ ৳12,345 │
 *   │                                            NOW   │           │
 *   │  Matures in ~2.4y · ৳5,000/mo            MATURITY│ ৳15,234  │
 *   └────────────────────────────────────────────────────────────────┘
 *
 * Hover lifts via .card-link. Closed investments stay in a quieter
 * flat list at the bottom.
 */
import { Link } from 'react-router-dom';
import { useStore } from '../domain/store';
import * as investments from '../domain/investments';
import {
  investmentValue,
  daysToMaturity,
} from '../domain/math';
import { fmtBDT } from '../lib/format';

const MIDDOT = '\u00B7';

export function InvestmentsListScreen() {
  const state = useStore(s => s.state);
  const invs = investments.list(state);
  const active = invs.filter(i => i.status === 'active');
  const closed = invs.filter(i => i.status !== 'active');
  // Compute each row's value once and reuse for summary + the row
  // itself (avoids recomputing dpsCurrentValue, which scans every
  // transaction, twice per row).
  let totalCurrent = 0;
  let totalProjected = 0;
  const rows = active.map(inv => {
    const v = investmentValue(inv, state.transactions);
    totalCurrent += v.currentValue;
    totalProjected += v.projectedValue;
    return { inv, current: v.currentValue, projected: v.projectedValue };
  });
  const showProjection = totalProjected - totalCurrent > 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap justify-between items-end gap-2">
        <div>
          <h1 className="heading h1-screen">Investments</h1>
          <div className="text-muted text-[13px] mt-1.5 tabular">{invs.length} total</div>
        </div>
        <Link
          to="/investments/add"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-btn font-bold text-[13px] text-primary-on hover:opacity-95 active:translate-y-px transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          style={{ background: 'var(--primary)' }}
        >
          <span className="text-base leading-none">+</span>
          <span>Add</span>
        </Link>
      </div>

      {invs.length === 0 ? (
        <section className="card">
          <div className="py-10 text-center text-muted">
            <div className="text-[14px] font-semibold text-ink">No investments yet.</div>
          </div>
        </section>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
            <div className="flex flex-col gap-4">
              {rows.map(({ inv, current, projected }) => (
                <InvCard
                  key={inv.id}
                  inv={inv}
                  current={current}
                  projected={projected}
                />
              ))}
              {closed.length > 0 && (
                <section className="card">
                  <h2 className="text-[11px] text-muted uppercase tracking-[0.08em] font-semibold m-0 mb-2.5">Closed</h2>
                  <div>
                    {closed.map(inv => (
                      <Link
                        key={inv.id}
                        to={`/investments/${inv.id}`}
                        className="group relative block py-2.5 border-t border-border first:border-0 opacity-70 hover:opacity-100 transition"
                      >
                        <div className="flex justify-between items-center mb-1">
                          <div className="font-semibold text-[14px] tracking-tight">
                            {invEmoji(inv.type)} {inv.name}
                          </div>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-pill text-[11px] font-semibold bg-surface-2 text-muted">
                            {inv.status}
                          </span>
                        </div>
                        <div className="text-[11.5px] text-muted tabular">
                          {fmtBDT(inv.principal)} {MIDDOT} {inv.rate}% {MIDDOT} {inv.termMonths}mo{inv.institution ? ` ${MIDDOT} ${inv.institution}` : ''}
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              )}
            </div>

            <section className="card h-fit lg:sticky lg:top-4">
              <h2 className="text-[11px] text-muted uppercase tracking-[0.08em] font-semibold m-0 mb-4">Summary</h2>
              <div className="flex flex-col gap-5">
                <div>
                  <div className="text-[11px] text-muted uppercase tracking-wider font-semibold">Current value</div>
                  <div className="text-[26px] font-bold text-accent mt-2 tabular tracking-tight leading-none">
                    {fmtBDT(totalCurrent)}
                  </div>
                  <div className="text-[11px] text-muted mt-1.5 tabular">Money tied up right now</div>
                </div>
                <div>
                  <div className="text-[11px] text-muted uppercase tracking-wider font-semibold">At maturity</div>
                  <div className="text-[26px] font-bold text-primary mt-2 tabular tracking-tight leading-none">
                    {fmtBDT(totalProjected)}
                  </div>
                  {showProjection ? (
                    <div className="text-[11px] text-muted mt-1.5 tabular">If every term completes</div>
                  ) : (
                    <div className="text-[11px] text-muted mt-1.5 tabular">— No future growth —</div>
                  )}
                </div>
              </div>
              <div className="text-xs text-muted mt-5 leading-relaxed">
                <strong className="text-ink">How it works:</strong> <em>Current value</em> is what you'd get if the bank paid out today (DPS = contributions compounded to today; FDR/savings = principal). <em>At maturity</em> projects what you'd receive when every active term ends. When the bank pays out, record it as Income to bring the money back to your account.
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function invEmoji(type: string): string {
  if (type === 'dps') return '\u{1F4C5}'; // 📅
  if (type === 'fdr') return '\u{1F3E6}'; // 🏦
  return '\u{1F4DC}';                       // 📜
}

function InvCard({ inv, current, projected }: { inv: any; current: number; projected: number }) {
  const days = daysToMaturity(inv);
  const isDps = inv.type === 'dps';
  // Long durations (≥ 1 year) read more naturally as years; short
  // durations stay in days. 1 decimal keeps the precision while
  // staying compact (e.g. "in ~2.4y" instead of "in 877d").
  const label =
    days > 0
      ? days >= 365
        ? `Matures in ~${(days / 365).toFixed(1)}y`
        : `Matures in ${days}d`
      : days === 0
        ? 'Matures today'
        : `Matured ${-days}d ago`;
  const showBoth = isDps && projected - current > 1;
  return (
    <Link
      to={`/investments/${inv.id}`}
      className="card card-link flex items-stretch gap-5 sm:gap-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 overflow-hidden"
    >
      {/* Left zone — identity, terms, maturity countdown. */}
      <div className="flex-1 min-w-0 flex flex-col gap-2 py-1">
        {/* Title row: emoji + (name + pill) on one row, vertically
            centered. Title is truncated to 1 line so the pill
            always sits against the title baseline. The pill is
            wrapped in the same flex group as the title (no
            flex-1 on the title), so it hugs the title text on the
            left instead of being pushed to the far right. */}
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-2xl shrink-0 leading-none" aria-hidden>{invEmoji(inv.type)}</span>
          <div className="flex items-center gap-2 min-w-0">
            <div className="font-semibold text-[16px] tracking-tight leading-tight truncate min-w-0">
              {inv.name}
            </div>
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-pill text-[10.5px] font-bold uppercase tracking-wider shrink-0"
              style={{
                background: isDps ? 'var(--primary-soft)' : 'var(--accent-soft)',
                color: isDps ? 'var(--primary)' : 'var(--accent)',
              }}
            >
              {isDps ? 'DPS' : inv.type === 'fdr' ? 'FDR' : 'Savings'}
            </span>
          </div>
        </div>
        <div className="text-[12px] text-muted tabular truncate">
          {inv.rate}% {MIDDOT} {inv.termMonths}mo{inv.institution ? ` ${MIDDOT} ${inv.institution}` : ''}
        </div>
        <div className="text-[12px] text-muted mt-auto flex items-center gap-3 flex-wrap">
          <span>{label}</span>
          <span className="opacity-50" aria-hidden>·</span>
          <span className="tabular">
            {isDps && inv.monthlyContribution ? `${fmtBDT(inv.monthlyContribution)}/mo` : `Principal ${fmtBDT(inv.principal)}`}
          </span>
        </div>
      </div>

      {/* Vertical divider between identity and amounts. */}
      <div
        aria-hidden
        className="w-px self-stretch my-1 shrink-0"
        style={{ background: 'var(--border-2)' }}
      />

      {/* Right zone — amounts, right-aligned. flex flex-col + items-end
          keeps the figures right-aligned and lets "At maturity" stack
          under "Now". shrink-0 prevents the right zone from being
          squeezed when the left zone gets long names. */}
      <div className="flex flex-col gap-3 items-end justify-center shrink-0 sm:min-w-[200px]">
        <div className="flex flex-col items-end leading-none">
          <span className="text-[10px] text-muted uppercase tracking-wider font-semibold">
            {showBoth ? 'Now' : 'Value'}
          </span>
          <span className="font-bold tabular text-[24px] tracking-tight text-accent mt-1.5">
            {fmtBDT(current)}
          </span>
        </div>
        {showBoth && (
          <div className="flex flex-col items-end leading-none">
            <span className="text-[10px] text-muted uppercase tracking-wider font-semibold">
              At maturity
            </span>
            <span className="font-bold tabular text-[15px] text-primary mt-1">
              {fmtBDT(projected)}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}