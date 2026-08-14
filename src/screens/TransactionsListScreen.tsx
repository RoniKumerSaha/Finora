/**
 * TransactionsListScreen — all transactions, sort by date desc.
 *
 * Visual target: docs/ux-designs/.../mockups/v2/dark.html#transactions
 * rows live inside a single card with a divider per row (no per-row
 * card chrome). Income / expense / transfer differ by glyph + color
 * and amount sign.
 *
 * Filter chips: single-select. Only one filter active at a time;
 * clicking the same chip again resets to 'All'. Chips are mutually
 * exclusive — 'This month' and 'Cash' are narrow filters that
 * intersect with the type chips, so a single-select model keeps the
 * mental model simple.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../domain/store';
import * as transactions from '../domain/transactions';
import { fmtBDTSigned, fmtDate } from '../lib/format';

type FilterKey = 'all' | 'income' | 'expense' | 'transfer' | 'thisMonth' | 'cash';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',       label: 'All' },
  { key: 'income',    label: 'Income' },
  { key: 'expense',   label: 'Expense' },
  { key: 'transfer',  label: 'Transfer' },
  { key: 'thisMonth', label: 'This month' },
  { key: 'cash',      label: 'Cash' },
];

export function TransactionsListScreen() {
  const state = useStore(s => s.state);
  const txs = transactions.list(state);
  const [filter, setFilter] = useState<FilterKey>('all');

  const filtered = useMemo(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return txs.filter(tx => {
      switch (filter) {
        case 'all':       return true;
        case 'income':    return tx.type === 'income';
        case 'expense':   return tx.type === 'expense';
        case 'transfer':  return tx.type === 'transfer';
        case 'thisMonth': return tx.date.startsWith(ym);
        case 'cash': {
          const acc =
            state.accounts.find((a: any) => a.id === tx.accountId) ??
            state.accounts.find((a: any) => a.id === tx.fromAccountId);
          return acc?.name === 'Cash';
        }
      }
    });
  }, [txs, filter, state.accounts]);

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight leading-none">Transactions</h1>
          <div className="text-muted text-[13px] mt-1">
            {filter === 'all'
              ? `${txs.length} entries`
              : `${filtered.length} of ${txs.length} entries`}
          </div>
        </div>
        <Link to="/transactions/new" className="inline-flex items-center justify-center gap-2 bg-primary text-primary-on px-4 py-2.5 rounded-btn font-semibold text-[13.5px] hover:opacity-90">
          <span className="text-base leading-none">+</span>
          <span>Add</span>
        </Link>
      </div>

      {/* Filter chips — single-select; clicking the active chip resets to 'All'. */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(f => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(active ? 'all' : f.key)}
              className={`px-3 py-1.5 rounded-pill text-[12.5px] border transition ${
                active
                  ? 'bg-primary-soft text-primary border-primary/40 font-semibold'
                  : 'bg-surface border-border text-muted hover:text-ink'
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <section className="bg-surface border border-border rounded-card p-5 shadow-card">
        {filtered.length === 0 ? (
          <div className="py-9 text-center text-muted">
            {filter === 'all'
              ? 'No transactions yet.'
              : 'No transactions match this filter.'}
          </div>
        ) : (
          <div>
            {filtered.slice().sort((a, b) => (a.date < b.date ? 1 : -1)).map(tx => (
              <TxRow key={tx.id} tx={tx} state={state} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function TxRow({ tx, state }: { tx: any; state: any }) {
  const acc =
    state.accounts.find((a: any) => a.id === tx.accountId) ??
    state.accounts.find((a: any) => a.id === tx.fromAccountId);
  const toAcc  = state.accounts.find((a: any) => a.id === tx.toAccountId);
  const cat    = state.categories.find((c: any) => c.id === tx.categoryId);

  const direction: 'in' | 'out' | 'xfr' =
    tx.type === 'income' ? 'in' : tx.type === 'expense' ? 'out' : 'xfr';

  const accent =
    direction === 'in'
      ? 'text-primary bg-primary-soft'
      : direction === 'out'
        ? 'text-danger bg-danger-soft'
        : 'text-accent bg-accent-soft';
  const amtColor = direction === 'in' ? 'text-primary' : 'text-ink';

  const sub = (() => {
    if (direction === 'xfr') {
      return `Transfer \u00B7 ${acc?.name ?? '\u2014'} \u2192 ${toAcc?.name ?? '\u2014'}`;
    }
    return `${fmtDate(tx.date)} \u00B7 ${acc?.name ?? '\u2014'}${cat ? ` \u00B7 ${cat.name}` : ''}${tx.linkedDebtId ? ` \u00B7 debt payment` : ''}${tx.linkedInvestmentId ? ` \u00B7 payout` : ''}`;
  })();

  return (
    <Link
      to={`/transactions/${tx.id}/edit`}
      className="flex justify-between items-center py-3 border-b border-border last:border-0 hover:bg-surface-2 -mx-2 px-2 rounded transition group"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-9 h-9 rounded-[10px] grid place-items-center font-bold ${accent}`}>
          {direction === 'in' ? '\u2191' : direction === 'out' ? '\u2193' : '\u21C4'}
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-[14px] leading-tight truncate">{tx.note || cat?.name || tx.type}</div>
          <div className="text-xs text-muted leading-tight mt-0.5 truncate">{sub}</div>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <div className={`font-bold tabular ${amtColor}`}>{fmtBDTSigned(tx.amount, direction)}</div>
        <span className="text-muted text-lg leading-none opacity-0 group-hover:opacity-100 transition" aria-hidden="true">{'\u203A'}</span>
      </div>
    </Link>
  );
}
