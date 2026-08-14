/**
 * InvestmentsListScreen — left column lists investments, right column
 * summarizes total invested and "to mature" totals.
 *
 * Visual target: docs/ux-designs/.../mockups/v2/dark.html#investments
 * Each row is a link to /investments/:id. DPS shows a "X/mo" chip and
 * uses the type-aware maturity value (annuity-due).
 *
 * 2026-08-14 polish: shared .card primitive, refined row hover, type
 * chip moved to the right of the row for better scan.
 *
 * 2026-08-14 polish (row hover accent): each row carries a left-edge
 * accent dot that fades in on hover (matches TransactionsListScreen),
 * tone-accented with the type's color (accent for FDR/savings, primary
 * for DPS).
 *
 * 2026-08-14 polish: the header carries an "Add" CTA — investments are
 * a separate entity from transactions, so the global "Add transaction"
 * sidebar CTA doesn't help here. The empty-state still gets its own
 * contextual button so first-run users aren't stranded.
 */
import { Link } from 'react-router-dom';
import { useStore } from '../domain/store';
import * as investments from '../domain/investments';
import {
  investmentMaturityValueTyped,
  daysToMaturity,
  dpsContributedSoFar,
} from '../domain/math';
import { fmtBDT } from '../lib/format';

const MIDDOT = '\u00B7';

export function InvestmentsListScreen() {
  const state = useStore(s => s.state);
  const invs = investments.list(state);
  const active = invs.filter(i => i.status === 'active');
  const closed = invs.filter(i => i.status !== 'active');
  const totalInvested = active.reduce((s, i) =>
    s + (i.type === 'dps' ? dpsContributedSoFar(i, state.transactions) : (Number(i.principal) || 0)), 0);
  const totalMaturity = active.reduce((s, i) => s + investmentMaturityValueTyped(i), 0);

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
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
          <section className="card">
            <div className="flex justify-between items-center mb-3.5">
              <h2 className="text-[11px] text-muted uppercase tracking-[0.08em] font-semibold m-0">Active</h2>
            </div>
            <div>
              {active.map(inv => <InvRow key={inv.id} inv={inv} contributed={dpsContributedSoFar(inv, state.transactions)} />)}
              {closed.map(inv => (
                <Link
                  key={inv.id}
                  to={`/investments/${inv.id}`}
                  className="group relative block py-2.5 border-t border-border opacity-55 hover:opacity-100 transition"
                >
                  <span
                    aria-hidden
                    className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r-full opacity-0 group-hover:opacity-100 transition"
                    style={{ background: 'var(--accent)' }}
                  />
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

          <section className="card h-fit">
            <h2 className="text-[11px] text-muted uppercase tracking-[0.08em] font-semibold m-0 mb-4">Summary</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[11px] text-muted uppercase tracking-wider font-semibold">Total invested</div>
                <div className="text-[24px] font-bold text-accent mt-2 tabular tracking-tight leading-none">
                  {fmtBDT(totalInvested)}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-muted uppercase tracking-wider font-semibold">To mature</div>
                <div className="text-[24px] font-bold text-primary mt-2 tabular tracking-tight leading-none">
                  {fmtBDT(totalMaturity)}
                </div>
              </div>
            </div>
            <div className="text-xs text-muted mt-4 leading-relaxed">
              <strong className="text-ink">How it works:</strong> For DPS, maturity is computed from monthly contributions at the stated rate. For FDR and savings, simple interest is used. When the bank pays out, record the payout as Income to bring the money back to your account.
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function invEmoji(type: string): string {
  if (type === 'dps') return '\u{1F4C5}'; // 📅
  if (type === 'fdr') return '\u{1F3E6}'; // 🏦
  return '\u{1F4DC}';                       // 📜
}

function InvRow({ inv, contributed }: { inv: any; contributed: number }) {
  const days = daysToMaturity(inv);
  const mat = investmentMaturityValueTyped(inv);
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
  const amountLine = isDps
    ? `${fmtBDT(contributed)} ${MIDDOT} ${inv.monthlyContribution ? `${fmtBDT(inv.monthlyContribution)}/mo` : ''}`
    : fmtBDT(inv.principal);
  return (
    <Link
      to={`/investments/${inv.id}`}
      className="group relative block py-2.5 border-t border-border first:border-0 row-hover -mx-2 px-2 rounded transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
    >
      <span
        aria-hidden
        className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r-full opacity-0 group-hover:opacity-100 transition"
        style={{ background: isDps ? 'var(--primary)' : 'var(--accent)' }}
      />
      <div className="flex justify-between items-center mb-1.5">
        <div className="font-semibold text-[14px] tracking-tight">
          {invEmoji(inv.type)} {inv.name}
        </div>
        <span className="inline-flex items-center px-2 py-0.5 rounded-pill text-[11px] font-semibold bg-accent-soft text-accent">
          Active
        </span>
      </div>
      <div className="flex justify-between items-baseline">
        <div className="text-[13px] text-accent font-bold tabular">Maturity {fmtBDT(mat)}</div>
        <div className="text-[11.5px] text-muted">{label}</div>
      </div>
      <div className="text-[11.5px] text-muted mt-1 tabular">
        {amountLine} {MIDDOT} {inv.rate}% {MIDDOT} {inv.termMonths}mo{inv.institution ? ` ${MIDDOT} ${inv.institution}` : ''}
      </div>
    </Link>
  );
}