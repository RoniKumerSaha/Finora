/**
 * DebtsListScreen — grouped by direction (I owe / Owed to me).
 *
 * Visual target: docs/ux-designs/.../mockups/v2/dark.html#debts
 * Each section is a card with rows like the mockup; bar uses danger
 * color for i_owe, primary for owed_to_me.
 */
import { Link } from 'react-router-dom';
import { useStore } from '../domain/store';
import * as debts from '../domain/debts';
import { fmtBDT, fmtDate } from '../lib/format';

export function DebtsListScreen() {
  const state = useStore(s => s.state);
  const ds = debts.list(state);
  const iOwe = ds.filter(d => d.direction === 'i_owe');
  const owed = ds.filter(d => d.direction === 'owed_to_me');

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight leading-none">Debts</h1>
          <div className="text-muted text-[13px] mt-1">{ds.length} total</div>
        </div>
        <Link to="/debts/add" className="inline-flex items-center justify-center gap-2 bg-primary text-primary-on px-4 py-2.5 rounded-btn font-semibold text-[13.5px] hover:opacity-90">
          <span className="text-base leading-none">+</span>
          <span>New debt</span>
        </Link>
      </div>

      {ds.length === 0 ? (
        <section className="bg-surface border border-border rounded-card p-5 shadow-card">
          <div className="py-9 text-center text-muted">
            <div className="text-base font-semibold text-ink">No debts yet.</div>
          </div>
        </section>
      ) : (
        <div className="grid grid-cols-2 gap-[14px]">
          <DebtGroup title="I owe"      rows={iOwe} tone="danger" />
          <DebtGroup title="Owed to me" rows={owed} tone="primary" />
        </div>
      )}
    </div>
  );
}

function DebtGroup({
  title, rows, tone,
}: { title: string; rows: any[]; tone: 'danger' | 'primary' }) {
  return (
    <section className="bg-surface border border-border rounded-card p-5 shadow-card">
      <h2 className="text-xs text-muted uppercase tracking-wider font-semibold m-0 mb-3">{title}</h2>
      {rows.length === 0 ? (
        <div className="text-muted text-sm py-6 text-center">Nothing here.</div>
      ) : (
        <div>
          {rows.map(d => {
            const pct = d.total > 0 ? Math.min(100, Math.round(((d.paidSoFar || 0) / d.total) * 100)) : 0;
            const left = d.total - (d.paidSoFar || 0);
            const iconBg = tone === 'danger' ? 'bg-danger-soft text-danger' : 'bg-primary-soft text-primary';
            const barFill = tone === 'danger' ? 'bg-danger' : 'bg-gradient-to-r from-primary to-accent';
            const amtColor = tone === 'danger' ? 'text-danger' : 'text-primary';
            return (
              <div key={d.id} className="py-2 border-t border-border first:border-0">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className={`w-[34px] h-[34px] rounded-lg grid place-items-center font-bold ${iconBg}`}>
                      {tone === 'danger' ? '\u2193' : '\u2191'}
                    </div>
                    <div>
                      <div className="font-semibold text-sm leading-tight">{d.name}</div>
                      <div className="text-xs text-muted leading-tight mt-0.5">
                        {fmtBDT(d.paidSoFar || 0)} / {fmtBDT(d.total)}
                        {d.dueDate ? ` \u00B7 by ${fmtDate(d.dueDate)}` : ''}
                        {d.person ? ` \u00B7 ${d.person}` : ''}
                      </div>
                    </div>
                  </div>
                  <div className={`font-bold tabular ${amtColor}`}>
                    {tone === 'danger' ? '\u2212' : '+'} {fmtBDT(left)}
                  </div>
                </div>
                <div className="mt-1.5 h-2 bg-surface-2 rounded-pill overflow-hidden">
                  <div className={`h-full rounded-pill ${barFill}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
