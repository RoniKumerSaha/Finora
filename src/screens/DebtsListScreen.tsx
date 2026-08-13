import { Link } from 'react-router-dom';
import { useStore } from '../domain/store';
import * as debts from '../domain/debts';

export function DebtsListScreen() {
  const state = useStore(s => s.state);
  const ds = debts.list(state);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Debts</h1>
        <Link to="/debts/add" className="bg-primary text-primary-on px-4 py-2 rounded-md">Add Debt</Link>
      </header>
      {ds.length === 0 ? (
        <div className="text-muted">No debts yet.</div>
      ) : (
        <ul className="flex flex-col gap-2">
          {ds.map(d => {
            const pct = d.total > 0 ? Math.min(100, Math.round(((d.paidSoFar || 0) / d.total) * 100)) : 0;
            return (
              <li key={d.id} className="bg-surface border border-border rounded-md p-3">
                <div className="flex justify-between">
                  <span className="font-medium">{d.name}</span>
                  <span className={d.direction === 'i_owe' ? 'text-danger' : 'text-primary'}>
                    {d.direction === 'i_owe' ? '−' : '+'}{fmtBDT(d.paidSoFar || 0)} / {fmtBDT(d.total)}
                  </span>
                </div>
                <div className="h-1.5 bg-surface-2 rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
                <div className="text-xs text-muted mt-2">
                  {d.direction === 'i_owe' ? 'You owe' : 'Owed to you'} · {d.status}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function fmtBDT(n: number) {
  return '৳' + (Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}