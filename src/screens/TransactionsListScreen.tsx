import { Link } from 'react-router-dom';
import { useStore } from '../domain/store';
import * as transactions from '../domain/transactions';

export function TransactionsListScreen() {
  const state = useStore(s => s.state);
  const txs = transactions.list(state);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Transactions</h1>
        <Link to="/transactions/add" className="bg-primary text-primary-on px-4 py-2 rounded-md">
          Add Transaction
        </Link>
      </header>
      {txs.length === 0 ? (
        <div className="text-muted">No transactions yet.</div>
      ) : (
        <ul className="flex flex-col gap-2">
          {txs.slice().sort((a, b) => (a.date < b.date ? 1 : -1)).map(tx => (
            <li key={tx.id} className="bg-surface border border-border rounded-md p-3 flex justify-between items-center">
              <div className="flex flex-col">
                <span className="text-sm">{tx.note || tx.type}</span>
                <span className="text-xs text-muted">{tx.date}</span>
              </div>
              <span className={tx.type === 'expense' ? 'text-danger' : tx.type === 'income' ? 'text-primary' : ''}>
                {tx.type === 'expense' ? '−' : tx.type === 'income' ? '+' : '⇄'} {fmtBDT(tx.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function fmtBDT(n: number) {
  return '৳' + (Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}