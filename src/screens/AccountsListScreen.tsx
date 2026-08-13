import { Link } from 'react-router-dom';
import { useStore } from '../domain/store';
import * as accounts from '../domain/accounts';
import { accountBalance } from '../domain/math';

export function AccountsListScreen() {
  const state = useStore(s => s.state);
  const accs = accounts.list(state);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Accounts</h1>
        <Link to="/accounts/add" className="bg-primary text-primary-on px-4 py-2 rounded-md">Add Account</Link>
      </header>
      {accs.length === 0 ? (
        <div className="text-muted">No accounts yet.</div>
      ) : (
        <ul className="flex flex-col gap-2">
          {accs.map(a => {
            const bal = accountBalance(a, state.transactions);
            return (
              <li key={a.id} className="bg-surface border border-border rounded-md p-3">
                <div className="flex justify-between">
                  <span className="font-medium">{a.name}</span>
                  <span>{fmtBDT(bal)}</span>
                </div>
                <div className="text-xs text-muted">{a.type} · opens at {fmtBDT(a.openingBalance)}</div>
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