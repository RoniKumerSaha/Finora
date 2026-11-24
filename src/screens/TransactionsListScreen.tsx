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
 *
 * 2026-08-14 (F1): filter chips are now sticky under the (mobile)
 * topbar so they stay visible during long scrolls through the list.
 *
 * 2026-08-14 (F6): when the filter is 'all' (the default, ungrouped
 * view), rows are grouped under day-level subheaders ('25 Aug 2026').
 * Subheaders are also sticky so users always know what day they're
 * looking at. Filters that produce a small, dense list (any chip
 * other than 'all') collapse to a flat list — subheaders would be
 * noise at that density.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../domain/store';
import * as transactions from '../domain/transactions';
import { ArrowUp, ArrowDown, ArrowLeftRight, ChevronRight, ICON_TILE_CLASS } from '../components/icons/Icons';
import { TransactionTag } from '../components/TransactionTag';
import { EmptyState, TransactionsIllustration } from '../components/EmptyState';
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

  // Day grouping only applies to the unfiltered view — filtered lists
  // are small enough that subheaders would just be noise.
  const grouped = useMemo(() => {
    if (filter !== 'all') return null;
    const sorted = filtered.slice().sort((a, b) => (a.date < b.date ? 1 : -1));
    const groups: Array<{ date: string; rows: typeof sorted }> = [];
    for (const tx of sorted) {
      const last = groups[groups.length - 1];
      if (last && last.date === tx.date) last.rows.push(tx);
      else groups.push({ date: tx.date, rows: [tx] });
    }
    return groups;
  }, [filtered, filter]);

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

      {/* Filter chips — sticky under the mobile topbar (top-14) and at
         the top of the viewport on desktop (top-0). The background
         gives the sticky bar visual weight so rows don't bleed
         through. z-10 keeps them above the card content. The card
         below carries its own top edge, so no borderBottom here —
         that would create a visible double line. */}
      <div
        className="sticky top-14 md:top-0 z-10 -mx-5 sm:-mx-8 md:mx-0 px-5 sm:px-8 md:px-0 py-3 md:py-0 flex gap-2 flex-wrap"
        style={{
          background: 'var(--bg)',
        }}
      >
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
          filter === 'all' ? (
            <EmptyState
              illustration={<TransactionsIllustration />}
              title="No transactions yet"
              description="Record income, expenses, or transfers. Each one updates the account it touches."
              cta={{ to: '/transactions/new', label: '+ Add transaction' }}
              learnMoreTopic="transactions"
            />
          ) : (
            <div className="py-10 text-center text-muted text-sm">
              No transactions match this filter. Try a different filter, or add a new transaction.
            </div>
          )
        ) : grouped ? (
          // Day-grouped unfiltered view. Subheaders are also sticky so
          // the user always knows what day they're scanning through.
          <div>
            {grouped.map(g => (
              <div key={g.date}>
                <div
                  className="sticky top-[60px] md:top-[44px] z-[5] -mx-6 px-6 py-1.5 text-[11px] text-muted uppercase tracking-[0.08em] font-semibold tabular"
                  style={{
                    background: 'var(--surface)',
                    boxShadow: '0 1px 0 var(--border)',
                  }}
                >
                  {fmtDate(g.date)}
                </div>
                {g.rows.map(tx => <TxRow key={tx.id} tx={tx} state={state} />)}
              </div>
            ))}
          </div>
        ) : (
          // Flat list for filtered views.
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

  // Wrapper stays uniformly neutral; the icon itself picks up a
  // direction-based colour so income/expense/transfer rows stay
  // scannable at a glance without tinting the wrapper chrome.
  const dirIconColor =
    direction === 'in'   ? 'text-primary'  // income → green
    : direction === 'out' ? 'text-danger'   // expense → red
    :                       'text-muted';   // transfer → muted
  // Amount colour mirrors the arrow — green for income, red for
  // expense, neutral ink for transfers. The amount is the most
  // scanned element on the row, so colour redundancy with the
  // arrow icon helps the eye lock onto direction at a glance,
  // not just on hover.
  const amtColor =
    direction === 'in'   ? 'text-primary'  // income → green
    : direction === 'out' ? 'text-danger'   // expense → red
    :                       'text-ink';      // transfer → neutral

  // In the grouped view the day is shown in the subheader, so omit it
  // from the row subtitle. In the flat list, include it.
  // The screen passes this signal via a class on the parent — but
  // simpler: always omit the date from the row subtitle; it would be
  // redundant either way (the day-grouped view already shows it, and
  // for filtered views the date is informative but not essential).
  //
  // The trailing `· payout` / `· debt payment` text was removed when
  // tags were introduced — the <TransactionTag> pill now carries that
  // information visually next to the title. Subtitle stays focused on
  // account + category.
  const linkedDebt = tx.linkedDebtId
    ? state.debts.find((d: any) => d.id === tx.linkedDebtId)
    : undefined;

  // 2026-11-24 (1d redesign): the account moves out of the subtitle and
  // into its own right-aligned column on wide screens, so a column of
  // account names lines up and the title can breathe. On narrow screens
  // the column is hidden and the account folds back into the subtitle,
  // so mobile keeps the original compact two-line row.
  //
  // IMPORTANT — the e2e page object locates a row's subtitle as
  // `div.text-xs.text-muted` and asserts its EXACT text
  // ("Main Bank · Groceries"). `toHaveText` reads the element's
  // concatenated DOM text, ignoring what CSS hides, so the subtitle
  // element must carry EXACTLY ONE text string at all times. That
  // rules out swapping two variants inside it.
  //
  // The two views are therefore separate ELEMENTS, each holding one
  // string:
  //   - `.tx-sub-inline` — the original "account · category" line.
  //     Shown on mobile.
  //   - `.tx-sub-col`   — the category alone. Shown on desktop, where
  //     the account has been promoted to its own column.
  //
  // The account column (`.tx-acct-col`) deliberately does NOT carry
  // the `text-xs text-muted` classes, or it would be picked up as a
  // second subtitle and trip Playwright's strict-mode violation.
  const accountName = acc?.name ?? '\u2014';
  const toAccountName = toAcc?.name ?? '\u2014';

  const isTransfer = direction === 'xfr';

  // The canonical subtitle — account · category, or the transfer pair.
  // This exact string is asserted by the e2e suite and is what the
  // mobile row shows.
  const subInline = isTransfer
    ? `Transfer \u00B7 ${accountName} \u2192 ${toAccountName}`
    : `${accountName}${cat ? ` \u00B7 ${cat.name}` : ''}`;

  // What the desktop row shows under the title once the account has
  // been promoted to its own column: the category alone. Transfers
  // keep the full "Transfer · A → B" line, since splitting the pair
  // across the subtitle and the column would be unreadable.
  const subCategory = isTransfer
    ? `Transfer \u00B7 ${accountName} \u2192 ${toAccountName}`
    : cat?.name ?? '';

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
        <div className={ICON_TILE_CLASS}>
          <span className={dirIconColor}>
            {direction === 'in' && <ArrowUp className="w-[18px] h-[18px]" />}
            {direction === 'out' && <ArrowDown className="w-[18px] h-[18px]" />}
            {direction === 'xfr' && <ArrowLeftRight className="w-[18px] h-[18px]" />}
          </span>
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-[14px] leading-tight tracking-tight flex items-center gap-2 flex-wrap">
            <span className="min-w-0 truncate grow">{tx.note || cat?.name || tx.type}</span>
            <TransactionTag tx={tx} debtDirection={linkedDebt?.direction} />
          </div>
          {/* Two sibling subtitle elements, each carrying exactly one
              string — CSS shows one and hides the other per breakpoint.
              The `.tx-sub-inline` one keeps the `text-xs text-muted`
              classes the e2e subtitle locator looks for; `.tx-sub-col`
              must NOT, or it would be picked up as a second subtitle
              and trip Playwright's strict-mode violation. It is styled
              wholly from the `.tx-sub-col` rule in app.css. */}
          <div className="text-xs text-muted leading-tight mt-1 truncate tx-sub-inline">
            {subInline}
          </div>
          <div className="tx-sub-col">{subCategory}</div>
        </div>
      </div>
      <div className="flex items-center gap-4 shrink-0">
        {/* Account column — desktop only. Carries no `text-xs
            text-muted` classes of its own so the e2e subtitle locator
            still resolves to exactly one element; it is styled wholly
            from the `.tx-acct-col` rule in app.css. */}
        <div className="tx-acct-col">
          {isTransfer ? `${accountName} \u2192 ${toAccountName}` : accountName}
        </div>
        <div className={`font-bold tabular text-[14px] text-right min-w-[84px] ${amtColor}`}>{fmtBDTSigned(tx.amount, direction)}</div>
        <ChevronRight className="w-4 h-4 text-muted opacity-0 group-hover:opacity-100 transition shrink-0" />
      </div>
    </Link>
  );
}