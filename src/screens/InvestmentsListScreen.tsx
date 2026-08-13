import { Link } from 'react-router-dom';
import { useStore } from '../domain/store';
import * as investments from '../domain/investments';
import { investmentMaturityValue, daysToMaturity } from '../domain/math';

export function InvestmentsListScreen() {
  const state = useStore(s => s.state);
  const invs = investments.list(state);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Investments</h1>
        <Link to="/investments/add" className="bg-primary text-primary-on px-4 py-2 rounded-md">Add Investment</Link>
      </header>
      {invs.length === 0 ? (
        <div className="text-muted">No investments yet.</div>
      ) : (
        <ul className="flex flex-col gap-2">
          {invs.map(inv => {
            const mat = investmentMaturityValue(inv);
            const days = daysToMaturity(inv);
            const label = days > 0 ? `${days}d to maturity` : days === 0 ? 'Matures today' : `${-days}d past maturity`;
            return (
              <li key={inv.id} className="bg-surface border border-border rounded-md p-3">
                <div className="flex justify-between">
                  <span className="font-medium">{inv.name}</span>
                  <span>{fmtBDT(mat)}</span>
                </div>
                <div className="text-xs text-muted mt-1">
                  {inv.type.toUpperCase()} · {label} · {inv.status}
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