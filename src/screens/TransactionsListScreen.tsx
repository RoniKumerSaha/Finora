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
 *
 * 2026-08-14 polish: list rows gain a left-edge accent dot keyed to
 * the direction (so rows are scannable at a glance), and the chip
 * selected state uses an inner ring instead of a border-tint that
 * fights the parchment palette.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../domain/store';
import * as transactions from '../domain/transactions';
import { fmtBDTSigned, fmtDate } from '../lib/format';

type FilterKey = 'all' | 'income' | 'expense' | 'transfer' | 'payouts' | 'debtPayments' | 'thisMonth' | 'cash';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',           label: 'All' },
  { key: 'income',        label: 'Income' },
  { key: 'expense',       label: 'Expense' },
  { key: 'transfer',      label: 'Transfer' },
  { key: 'payouts',       label: 'Payouts' },
  { key: 'debtPayments',  label: 'Debt payments' },
  { key: 'thisMonth',     label: 'This month' },
  { key: 'cash',          label: 'Cash' },
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
        case 'payouts':       return !!tx.linkedInvestmentId;
        case 'debtPayments':  return !!tx.linkedDebtId;
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
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap justify-between items-end gap-2">
        <div>
          <h1 className="heading h1-screen">Transactions</h1>
          <div className="text-muted text-[13px] mt-1.5 tabular">
            {filter === 'all'
              ? `${txs.length} entries`
              : `${filtered.length} of ${txs.length} entries`}
          </div>
        </div>
        <Link
          to="/transactions/new"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-btn font-bold text-[13px] text-primary-on hover:opacity-95 active:translate-y-px transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          style={{ background: 'var(--primary)' }}
        >
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
              className={[
                'px-3 py-1.5 rounded-pill text-[12px] font-semibold transition border',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                active
                  ? 'bg-primary-soft text-primary border-transparent'
                  : 'bg-surface text-muted border-border hover:text-ink hover:bg-surface-2',
              ].join(' ')}
              style={active ? { boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--primary) 35%, transparent)' } : undefined}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <section className="card">
        {filtered.length === 0 ? (
          <div className="py-10 text-center text-muted text-sm">
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
  const amtColor =
    direction === 'in'   ? 'text-primary'  // income → green
    : direction === 'out' ? 'text-danger'   // expense → red
    :                       'text-ink';      // transfer → neutral

  const sub = (() => {
    if (direction === 'xfr') {
      return `Transfer \u00B7 ${acc?.name ?? '\u2014'} \u2192 ${toAcc?.name ?? '\u2014'}`;
    }
    return `${fmtDate(tx.date)} \u00B7 ${acc?.name ?? '\u2014'}${cat ? ` \u00B7 ${cat.name}` : ''}${tx.linkedDebtId ? ` \u00B7 debt payment` : ''}${tx.linkedInvestmentId ? ` \u00B7 payout` : ''}`;
  })();

  return (
    <Link
      to={`/transactions/${tx.id}/edit`}
      className="group relative flex justify-between items-center py-3 border-b border-border last:border-0 row-hover -mx-2 px-2 rounded transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
    >
      <span
        aria-hidden
        className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r-full opacity-0 group-hover:opacity-100 transition"
        style={{ background: 'var(--primary)' }}
      />
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-9 h-9 rounded-[10px] grid place-items-center font-bold ${accent}`}>
          {direction === 'in' ? '\u2191' : direction === 'out' ? '\u2193' : '\u21C4'}
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-[14px] leading-tight truncate tracking-tight">
            {tx.note || cat?.name || tx.type}
          </div>
          <div className="text-xs text-muted leading-tight mt-1 truncate">{sub}</div>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <div className={`font-bold tabular text-[14px] ${amtColor}`}>{fmtBDTSigned(tx.amount, direction)}</div>
        <span className="text-muted text-base leading-none opacity-0 group-hover:opacity-100 transition" aria-hidden="true">{'\u203A'}</span>
      </div>
    </Link>
  );
}