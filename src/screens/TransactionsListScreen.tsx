/**
 * TransactionsListScreen — the transaction BOOK (2026-11-26).
 *
 * The list as a bank book: every row carries the balance AFTER that
 * entry, so the number that actually matters — how much do I have —
 * is attached to every line instead of living somewhere else on the
 * page. The rows become a staircase: you can watch the balance climb
 * and fall.
 *
 * A running balance only means something for a SINGLE account, so the
 * header band carries the account the book is about and the rows are
 * that account's ledger. The other accounts' lines are reachable from
 * the same header — pick another account and the book becomes theirs.
 *
 * The balance is computed by walking the account's own transactions
 * oldest → newest, starting from the account's opening balance, and
 * recording the balance after each entry. Rows then render in reverse
 * (newest first), the same direction the old list used, and each row
 * carries the balance as of that entry.
 *
 * IMPORTANT — the e2e page object locates a row's parts by class, so
 * the row's inner elements keep their class hooks:
 *   - the title    is `div.font-semibold span.min-w-0`
 *   - the subtitle is `div.t-12.text-muted`
 *   - the amount   is `div.font-bold.tabular`
 * The book's own styling is layered on top of those hooks rather than
 * replacing them.
 *
 * The subtitle element must carry EXACTLY ONE text string at all
 * times: `toHaveText` reads the element's concatenated DOM text,
 * ignoring what CSS hides, so two variants inside one element would
 * make the assertion read "Main Bank · GroceriesMain Bank". The two
 * views are therefore separate ELEMENTS, each holding one string:
 *   - `.tx-sub-inline` — the original "account · category" line.
 *     Shown on mobile.
 *   - `.tx-sub-col`   — the category alone. Shown on desktop, where
 *     the account has been promoted to its own column.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../domain/store';
import * as transactions from '../domain/transactions';
import { accountBalance } from '../domain/math';
import { ArrowUp, ArrowDown, ArrowLeftRight } from '../components/icons/Icons';
import { TransactionTag } from '../components/TransactionTag';
import { EmptyState, TransactionsIllustration } from '../components/EmptyState';
import { fmtBDT, fmtBDTSigned, fmtDate, fmtDayMonth } from '../lib/format';

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

/** How a transaction moves one account's balance. */
type Flow = 'in' | 'out' | 'none';

function flowOf(tx: any, accountId: string | undefined): Flow {
  if (!accountId) return 'none';
  if (tx.type === 'income')  return tx.accountId === accountId ? 'in' : 'none';
  if (tx.type === 'expense') return tx.accountId === accountId ? 'out' : 'none';
  if (tx.type === 'transfer') {
    if (tx.fromAccountId === accountId) return 'out';
    if (tx.toAccountId === accountId) return 'in';
  }
  return 'none';
}

/**
 * The ledger in the order the balance actually moved: oldest date
 * first, and within a date, the order the entries were recorded.
 *
 * The rows render newest-first, but the BALANCE was computed walking
 * this order — so both have to agree, or the staircase doesn't climb
 * and fall the way the money did.
 */
function ledgerOrder(txs: any[]): any[] {
  return txs
    .slice()
    .sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return txs.indexOf(a) - txs.indexOf(b);
    });
}

/**
 * The balance AFTER each transaction, for one account.
 *
 * Walks the account's transactions oldest → newest, starting from the
 * opening balance, and records the running figure after each entry.
 */
function runningBalances(
  txs: any[],
  accountId: string | undefined,
  opening: number,
): Map<string, number> {
  const out = new Map<string, number>();
  if (!accountId) return out;

  let bal = opening;
  for (const tx of ledgerOrder(txs)) {
    const flow = flowOf(tx, accountId);
    if (flow === 'none') continue;
    if (flow === 'in') bal += Number(tx.amount) || 0;
    else if (flow === 'out') bal -= Number(tx.amount) || 0;
    out.set(tx.id, bal);
  }
  return out;
}

/**
 * The running balance for EVERY account, keyed by transaction id.
 *
 * A row belongs to one account (two, for a transfer), so the balance
 * it carries is that account's balance as of that entry. A transfer
 * row shows the balance of the account the money LEFT — the side the
 * row's arrow points away from — because that is the balance the
 * transfer actually reduced.
 *
 * The PEAK comes back alongside: each account's highest balance in
 * its own history. A bar scaled against the global peak would make a
 * small account look permanently empty and a big one permanently
 * full — the bar has to answer "how full is THIS account", so each
 * account is scaled against itself.
 */
function balancesForAll(
  txs: any[],
  accounts: any[],
): { balances: Map<string, number>; peaks: Map<string, number> } {
  const balances = new Map<string, number>();
  const peaks = new Map<string, number>();

  for (const acc of accounts) {
    const per = runningBalances(txs, acc.id, Number(acc.openingBalance) || 0);
    let peak = 0;
    for (const bal of per.values()) peak = Math.max(peak, bal);

    for (const [txId, bal] of per) {
      if (balances.has(txId)) continue;
      // A transfer claims both accounts. The FROM side wins — the
      // money left that account, so that is the balance the row
      // belongs to. (An income or expense touches exactly one.)
      const tx = txs.find((t: any) => t.id === txId);
      if (tx?.type === 'transfer' && tx.fromAccountId !== acc.id) continue;
      balances.set(txId, bal);
      peaks.set(txId, peak);
    }
  }
  return { balances, peaks };
}

export function TransactionsListScreen() {
  const state = useStore(s => s.state);
  const txs = transactions.list(state);
  const [filter, setFilter] = useState<FilterKey>('all');

  // The book is scoped to one account — a running balance only means
  // something for a single account. `ALL` is the default: the whole
  // ledger, where each row carries the running balance of the account
  // it touched. Picking an account narrows the book to that account's
  // ledger, and every row then shows that one account's staircase.
  const [scope, setScope] = useState<string>('all');

  // If the scoped account disappears (deleted elsewhere), fall back.
  const scopedAccount =
    scope === 'all' ? undefined : state.accounts.find((a: any) => a.id === scope);
  const activeId = scopedAccount?.id;

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

  // The rows: the whole ledger (or one account's), newest first, each
  // carrying the running balance of the account it touched and that
  // account's own peak, which is what the row's bar is scaled against.
  const rows = useMemo(() => {
    const { balances, peaks } = balancesForAll(txs, state.accounts);
    const scoped = activeId
      ? filtered.filter(tx => flowOf(tx, activeId) !== 'none')
      : filtered;
    return ledgerOrder(scoped)
      .reverse()
      .map(tx => ({
        tx,
        balance: balances.get(tx.id),
        peak: peaks.get(tx.id) ?? 0,
      }));
  }, [filtered, txs, activeId, state.accounts]);

  // The rows, grouped into days. The unfiltered "all" book keeps the
  // day headers — a ledger rule naming the day, so a long list has
  // anchors. Any narrower filter collapses to a flat list, which is
  // the behaviour the list has always had: a filter answers "which
  // transactions", and the day they happened on is secondary to that.
  const grouped = useMemo(() => {
    const byDay = new Map<string, typeof rows>();
    for (const row of rows) {
      const list = byDay.get(row.tx.date);
      if (list) list.push(row);
      else byDay.set(row.tx.date, [row]);
    }
    return [...byDay.entries()].map(([date, list]) => ({ date, rows: list }));
  }, [rows]);

  // The header figures. Scoped to the chosen account, and narrowed by
  // the active filter — a filter that lists five expenses should not
  // headline the whole ledger's income.
  const figs = useMemo(() => {
    // Scoped to one account, the flows are that account's. Across all
    // accounts, a transfer is money leaving one pocket and entering
    // another, so it counts as neither an inflow nor an outflow of the
    // whole — only the accounts it touches see it.
    const scoped = activeId
      ? filtered.filter(tx => flowOf(tx, activeId) !== 'none')
      : filtered.filter(tx => tx.type !== 'transfer');

    const sumIn = (activeId
      ? scoped.filter(tx => flowOf(tx, activeId) === 'in')
      : scoped.filter(tx => tx.type === 'income')
    ).reduce((s, tx) => s + (Number(tx.amount) || 0), 0);

    const sumOut = (activeId
      ? scoped.filter(tx => flowOf(tx, activeId) === 'out')
      : scoped.filter(tx => tx.type === 'expense')
    ).reduce((s, tx) => s + (Number(tx.amount) || 0), 0);

    const sumXfr = filtered
      .filter(tx => tx.type === 'transfer')
      .filter(tx => !activeId || tx.fromAccountId === activeId || tx.toAccountId === activeId)
      .reduce((s, tx) => s + (Number(tx.amount) || 0), 0);

    // The BALANCE is an account fact, not a filter fact — filtering
    // the list does not change how much money the account holds. So
    // the running balance is always the account's whole history.
    const balances = activeId
      ? runningBalances(txs, activeId, Number(scopedAccount?.openingBalance) || 0)
      : balancesForAll(txs, state.accounts).balances;

    const now = activeId
      ? accountBalance(scopedAccount, txs)
      : state.accounts.reduce(
          (s: number, a: any) => s + accountBalance(a, txs),
          0,
        );

    // The lowest point the balance reached, and the entry that caused
    // it. The name matters more than the date — "after rent" says why
    // the balance dipped; the date is already on the row.
    //
    // Scoped to one account the low is a plain amount. Across
    // accounts the balances are on different scales, so a raw amount
    // would just report the smallest account's absolute floor — a
    // fact about the account, not about the ledger. There the figure
    // becomes the deepest DIP AS A SHARE of that account's own peak,
    // which is comparable across accounts.
    let low = now;
    let lowTx: any | undefined;
    let lowPct = 100;
    if (activeId) {
      for (const [id, bal] of balances) {
        if (bal < low) {
          low = bal;
          lowTx = txs.find((t: any) => t.id === id);
        }
      }
    } else {
      // Per account: find each one's deepest dip, then keep the one
      // that fell hardest relative to its own peak.
      for (const acc of state.accounts) {
        const per = runningBalances(txs, acc.id, Number(acc.openingBalance) || 0);
        let accPeak = 0;
        for (const bal of per.values()) accPeak = Math.max(accPeak, bal);
        if (accPeak <= 0) continue;
        for (const [id, bal] of per) {
          const p = (bal / accPeak) * 100;
          if (p < lowPct) {
            lowPct = p;
            low = bal;
            lowTx = txs.find((t: any) => t.id === id);
          }
        }
      }
    }

    return {
      sumIn, sumOut, sumXfr, now, low, lowTx, lowPct,
      inCount: activeId
        ? scoped.filter(tx => flowOf(tx, activeId) === 'in').length
        : scoped.filter(tx => tx.type === 'income').length,
      outCount: activeId
        ? scoped.filter(tx => flowOf(tx, activeId) === 'out').length
        : scoped.filter(tx => tx.type === 'expense').length,
      total: activeId ? scoped.length : filtered.length,
    };
  }, [txs, filtered, activeId, scopedAccount, state.accounts]);

  const hasAccounts = state.accounts.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap justify-between items-end gap-2">
        <div>
          <h1 className="heading h1-screen">Transactions</h1>
          <div className="text-muted t-13 mt-1.5 tabular">
            {filter === 'all' && !activeId
              ? `${txs.length} entries`
              : `${rows.length} of ${txs.length} entries`}
          </div>
        </div>
        <Link
          to="/transactions/new"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-btn font-bold t-13 text-primary-on hover:opacity-95 active:translate-y-px transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          style={{ background: 'var(--primary)' }}
        >
          <span className="t-13 leading-none">+</span>
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
                'px-3 py-1.5 rounded-pill t-12 font-semibold transition border',
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

      {/* The book. Without an account there is no balance to show, so
          the empty state stands in for the whole panel. */}
      {!hasAccounts ? (
        <section className="card">
          <EmptyState
            illustration={<TransactionsIllustration />}
            title="No transactions yet"
            description="Record income, expenses, or transfers. Each one updates the account it touches."
            cta={{ to: '/transactions/new', label: '+ Add transaction' }}
            learnMoreTopic="transactions"
          />
        </section>
      ) : (
        <section className="txbook">
          {/* ---- the header band ---------------------------------- */}
          <div className="txbook__head">
            <div className="txbook__hero">
              <div className="txbook__k">
                {scopedAccount ? `${scopedAccount.name} · balance now` : 'Total balance now'}
              </div>
              <div className="txbook__v">{fmtBDT(figs.now)}</div>
              <div className="txbook__d">
                {figs.total === 0 ? (
                  'No movements yet.'
                ) : (
                  <>
                    Up <b>{fmtBDT(figs.sumIn)}</b> · down{' '}
                    {fmtBDT(figs.sumOut)} · {figs.total} movements
                  </>
                )}
              </div>
            </div>

            <div className="txbook__figs">
              <div className="txfig">
                <div className="txfig__k">In</div>
                <div className="txfig__v txfig__v--in">{fmtBDT(figs.sumIn)}</div>
                <div className="txfig__n">{figs.inCount} in</div>
              </div>
              <div className="txfig">
                <div className="txfig__k">Out</div>
                <div className="txfig__v txfig__v--out">{fmtBDT(figs.sumOut)}</div>
                <div className="txfig__n">{figs.outCount} out</div>
              </div>
              <div className="txfig">
                <div className="txfig__k">Transfers</div>
                <div className="txfig__v txfig__v--ink">{fmtBDT(figs.sumXfr)}</div>
                <div className="txfig__n">net unchanged</div>
              </div>
              <div className="txfig">
                <div className="txfig__k">Lowest</div>
                <div className="txfig__v" style={{ color: 'var(--warn)' }}>
                  {activeId
                    ? fmtBDT(figs.low)
                    : `${Math.max(0, Math.round(figs.lowPct))}%`}
                </div>
                <div className="txfig__n">
                  {figs.lowTx
                    ? `after ${figs.lowTx.note || 'an entry'}`
                    : 'at opening'}
                </div>
              </div>
            </div>
          </div>

          {/* ---- the account scope -------------------------------- */}
          {/* Which account the book is about. A row of tabs, not a
              <select>: the list carries no dropdown control, and the
              tabs read as a set of books you can step between.

              These are deliberately NOT `rounded-pill` buttons — the
              filter chips above are, and the e2e page object finds
              "the active chip" by `button.rounded-pill[style*=inset]`.
              Sharing that shape would make the scope tabs read as
              filter chips. The active scope tab is marked with a
              bottom rule instead, which also reads better than a pill
              here: these sit on a rule, like tabs in a ledger. */}
          {state.accounts.length > 0 && (
            <div className="txbook__scope">
              <span className="txbook__scope-l">Book</span>
              <button
                type="button"
                onClick={() => setScope('all')}
                aria-pressed={scope === 'all'}
                className={[
                  'txbook__scopebtn',
                  scope === 'all' ? 'txbook__scopebtn--on' : '',
                ].join(' ')}
              >
                All accounts
                <span className="txbook__scopebtn-s"> book</span>
              </button>
              {state.accounts.map((a: any) => {
                const on = a.id === scope;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setScope(a.id)}
                    aria-pressed={on}
                    className={[
                      'txbook__scopebtn',
                      on ? 'txbook__scopebtn--on' : '',
                    ].join(' ')}
                  >
                    {/* The word "book" keeps these apart from the
                        filter chips above — an account named "Cash"
                        would otherwise read as the Cash chip. */}
                    {a.name}
                    <span className="txbook__scopebtn-s"> book</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* ---- the rows ------------------------------------------ */}
          {rows.length === 0 ? (
            <div className="py-10 text-center text-muted t-13 px-5">
              No transactions match this filter. Try a different filter, or add a new transaction.
            </div>
          ) : filter === 'all' ? (
            // The unfiltered book keeps its day rules — a ledger line
            // naming the day, so a long list has anchors to scan by.
            // They are sticky, so the day you're reading never leaves
            // the screen. With a rule naming the day above it, each
            // row drops its own date stamp.
            <div className="txbook__rows txbook__rows--nodate">
              {grouped.map(g => (
                <div key={g.date} className="txbook__day">
                  <div
                    className="sticky top-[60px] md:top-[44px] z-[5] txbook__dayhead"
                    style={{
                      background: 'var(--surface)',
                      boxShadow: '0 1px 0 var(--border)',
                    }}
                  >
                    {fmtDate(g.date)}
                  </div>
                  {g.rows.map(({ tx, balance, peak }) => (
                    <TxRow
                      key={tx.id}
                      tx={tx}
                      state={state}
                      balance={balance}
                      peak={peak}
                      showAccount={!activeId}
                      showDate={false}
                    />
                  ))}
                </div>
              ))}
            </div>
          ) : (
            // A narrower filter answers "which transactions", so the
            // list goes flat — the day each one fell on is a detail
            // the row's own date stamp already carries.
            <div className="txbook__rows">
              {rows.map(({ tx, balance, peak }) => (
                <TxRow
                  key={tx.id}
                  tx={tx}
                  state={state}
                  balance={balance}
                  peak={peak}
                  showAccount={!activeId}
                  showDate
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function TxRow({
  tx,
  state,
  balance,
  peak,
  showAccount,
  showDate,
}: {
  tx: any;
  state: any;
  balance: number | undefined;
  peak: number;
  showAccount: boolean;
  showDate: boolean;
}) {
  const acc =
    state.accounts.find((a: any) => a.id === tx.accountId) ??
    state.accounts.find((a: any) => a.id === tx.fromAccountId);
  const toAcc  = state.accounts.find((a: any) => a.id === tx.toAccountId);
  const cat    = state.categories.find((c: any) => c.id === tx.categoryId);

  const direction: 'in' | 'out' | 'xfr' =
    tx.type === 'income' ? 'in' : tx.type === 'expense' ? 'out' : 'xfr';

  // Amount colour mirrors the arrow — green for income, red for
  // expense, neutral ink for transfers. The amount is the most
  // scanned element on the row, so colour redundancy with the
  // arrow icon helps the eye lock onto direction at a glance,
  // not just on hover.
  const amtColor =
    direction === 'in'   ? 'text-primary'  // income → green
    : direction === 'out' ? 'text-danger'   // expense → red
    :                       'text-ink';      // transfer → neutral

  const linkedDebt = tx.linkedDebtId
    ? state.debts.find((d: any) => d.id === tx.linkedDebtId)
    : undefined;

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

  // The bar's fill: the balance as a share of THAT ACCOUNT's own
  // peak. Scaling against a global peak would make a small account
  // look permanently drained and a large one permanently full — the
  // bar has to answer "how full is this account right now", so each
  // account is scaled against its own history. The colour then flags
  // a balance that has fallen a long way from that account's top —
  // the dip is the thing worth noticing.
  const pct = peak > 0 && balance !== undefined
    ? Math.max(0, Math.min(100, (balance / peak) * 100))
    : 0;
  const barTone = pct < 40 ? 'low' : pct < 70 ? 'mid' : '';

  return (
    <Link
      to={`/transactions/${tx.id}/edit`}
      className="txrow group row-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
    >
      {showDate && <div className="txrow__d">{fmtDayMonth(tx.date)}</div>}

      <div className="txleft">
        <div className={`txleft__glyph txleft__glyph--${direction}`}>
          {direction === 'in' && <ArrowUp className="w-[18px] h-[18px]" />}
          {direction === 'out' && <ArrowDown className="w-[18px] h-[18px]" />}
          {direction === 'xfr' && <ArrowLeftRight className="w-[18px] h-[18px]" />}
        </div>
        <div className="min-w-0">
          {/* The title keeps the e2e page object's hook —
              `div.font-semibold span.min-w-0` — and the book's type
              comes from the `.txname` rule layered on top. */}
          <div className="txname font-semibold t-13 leading-tight tracking-tight flex items-center gap-2 flex-wrap">
            <span className="min-w-0 truncate grow">{tx.note || cat?.name || tx.type}</span>
            <TransactionTag tx={tx} debtDirection={linkedDebt?.direction} />
          </div>
          {/* Two sibling subtitle elements, each carrying exactly one
              string — CSS shows one and hides the other per breakpoint.
              The `.tx-sub-inline` one keeps the `t-12 text-muted`
              classes the e2e subtitle locator looks for; `.tx-sub-col`
              must NOT, or it would be picked up as a second subtitle
              and trip Playwright's strict-mode violation. It is styled
              wholly from the `.tx-sub-col` rule in app.css. */}
          <div className="t-12 text-muted leading-tight mt-1 truncate tx-sub-inline">
            {subInline}
          </div>
          <div className="tx-sub-col">{subCategory}</div>
        </div>
      </div>

      <div className={`txrow__amt font-bold tabular ${amtColor}`}>
        {fmtBDTSigned(tx.amount, direction)}
      </div>

      <div className="txrow__balwrap">
        {balance !== undefined && (
          <>
            <div className="txrow__bal">{fmtBDT(balance)}</div>
            <div className="txrow__bar" aria-hidden>
              <i className={barTone} style={{ '--w': `${pct}%` } as any} />
            </div>
            {/* In the "all accounts" book each row's balance belongs to
                a different account, so the balance names the account
                it belongs to. Scoped to one account the name would be
                on every row and say nothing — so it only appears in
                the mixed view. */}
            {showAccount && (
              <div className="txrow__balacct">{accountName}</div>
            )}
          </>
        )}
      </div>
    </Link>
  );
}
