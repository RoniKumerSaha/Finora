/**
 * InvestmentsListScreen — left column lists investments, right column
 * summarizes total invested and "to mature" totals.
 *
 * Visual target: docs/ux-designs/.../mockups/v2/dark.html#investments
 */
import { Link } from 'react-router-dom';
import { useStore } from '../domain/store';
import * as investments from '../domain/investments';
import { investmentMaturityValue, daysToMaturity } from '../domain/math';
import { fmtBDT } from '../lib/format';

const MIDDOT = '\u00B7';

export function InvestmentsListScreen() {
  const state = useStore(s => s.state);
  const invs = investments.list(state);
  const active = invs.filter(i => i.status === 'active');
  const closed = invs.filter(i => i.status !== 'active');
  const totalInvested = active.reduce((s, i) => s + (Number(i.principal) || 0), 0);
  const totalMaturity = active.reduce((s, i) => s + investmentMaturityValue(i), 0);

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight leading-none">Investments</h1>
          <div className="text-muted text-[13px] mt-1">{invs.length} total</div>
        </div>
        <Link to="/investments/add" className="inline-flex items-center justify-center gap-2 bg-primary text-primary-on px-4 py-2.5 rounded-btn font-semibold text-[13.5px] hover:opacity-90">
          <span className="text-base leading-none">+</span>
          <span>New investment</span>
        </Link>
      </div>

      {invs.length === 0 ? (
        <section className="bg-surface border border-border rounded-card p-5 shadow-card">
          <div className="py-9 text-center text-muted">
            <div className="text-base font-semibold text-ink">No investments yet.</div>
          </div>
        </section>
      ) : (
        <div className="grid grid-cols-[2fr_1fr] gap-[14px]">
          <section className="bg-surface border border-border rounded-card p-5 shadow-card">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-xs text-muted uppercase tracking-wider font-semibold m-0">Active</h2>
            </div>
            <div>
              {active.map(inv => <InvRow key={inv.id} inv={inv} />)}
              {closed.map(inv => (
                <div key={inv.id} className="py-2 border-t border-border opacity-55">
                  <div className="flex justify-between items-center mb-1">
                    <div className="font-semibold text-sm">
                      {invEmoji(inv.type)} {inv.name}
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-pill text-[11px] font-semibold bg-surface-2 text-muted">{inv.status}</span>
                  </div>
                  <div className="text-[11px] text-muted">
                    {fmtBDT(inv.principal)} {MIDDOT} {inv.rate}% {MIDDOT} {inv.termMonths}mo{inv.institution ? ` ${MIDDOT} ${inv.institution}` : ''}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-surface border border-border rounded-card p-5 shadow-card h-fit">
            <h2 className="text-xs text-muted uppercase tracking-wider font-semibold m-0 mb-3">Summary</h2>
            <div className="grid grid-cols-2 gap-[14px]">
              <div>
                <div className="text-[11px] text-muted uppercase tracking-wider">Total invested</div>
                <div className="text-2xl font-extrabold text-accent mt-1 tabular">{fmtBDT(totalInvested)}</div>
              </div>
              <div>
                <div className="text-[11px] text-muted uppercase tracking-wider">To mature</div>
                <div className="text-2xl font-extrabold text-primary mt-1 tabular">{fmtBDT(totalMaturity)}</div>
              </div>
            </div>
            <div className="text-xs text-muted mt-3.5 leading-relaxed">
              <strong className="text-ink">How it works:</strong> The maturity value is calculated from principal, rate, and term — it doesn't tick up daily. When the bank pays out, record the payout as Income to bring the money back to your account.
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

function InvRow({ inv }: { inv: any }) {
  const days = daysToMaturity(inv);
  const mat = investmentMaturityValue(inv);
  const label =
    days > 0 ? `Matures in ${days}d`
    : days === 0 ? 'Matures today'
    : `Matured ${-days}d ago`;
  return (
    <div className="py-2 border-t border-border first:border-0">
      <div className="flex justify-between items-center mb-1">
        <div className="font-semibold text-sm">
          {invEmoji(inv.type)} {inv.name}
        </div>
        <span className="inline-flex items-center px-2 py-0.5 rounded-pill text-[11px] font-semibold bg-accent-soft text-accent">Active</span>
      </div>
      <div className="flex justify-between items-baseline">
        <div className="text-[13px] text-accent font-bold tabular">Maturity {fmtBDT(mat)}</div>
        <div className="text-[11px] text-muted">{label}</div>
      </div>
      <div className="text-[11px] text-muted mt-0.5">
        {fmtBDT(inv.principal)} {MIDDOT} {inv.rate}% {MIDDOT} {inv.termMonths}mo{inv.institution ? ` ${MIDDOT} ${inv.institution}` : ''}
      </div>
    </div>
  );
}
