/**
 * HomeScreen — top-level dashboard (thin snapshot).
 *
 * Spine: docs/ux-designs/ux-finora-2026-08-14-home-restructure/EXPERIENCE.md
 *
 * Home is the point-in-time snapshot. It shows what the user has
 * *right now*: total balance, this month's income, this month's
 * expense, total debt, total investments, net worth, accounts preview,
 * recent activity. Period-bounded analytics (cash-flow chart, spending
 * breakdown, net worth trajectory, and goals/debts/investments lists)
 * live on /insights, reachable via the nav or the "See full Insights →"
 * link at the bottom of this page.
 *
 * Visual target: docs/ux-designs/.../mockups/v1/index.html#home
 *
 * Layout (in order, top to bottom):
 *   1. Onboarding callout (conditional)
 *   2. Header + meta line
 *   3. 3-up stat row #1: Total balance · Income (this month) · Expense (this month)
 *   4. 3-up stat row #2: Total debt · Total investments · Net worth
 *   5. 2-up cards: Accounts preview · Recent activity
 *   6. "See full Insights →" affordance
 *
 * 2026-08-14 restructure: removed the Goals preview card, the Debts
 * card, and the Investments card. They are now duplicated exclusively
 * on /insights. Added the "See full Insights →" link at the bottom.
 * 2026-08-14 net-row: added a second 3-up stat row underneath the
 * first one. Total debt is NET (I owe − Owed to me, signed),
 * Total investments is the active-pricipal sum (DPS-aware via
 * dpsContributedSoFar, simple `principal` for FDR/savings), Net worth
 * is total balance + active investments + receivables (money owed to
 * me still outstanding) − money I still owe.
 */
import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useStore } from '../domain/store';
import {
  monthlyIncome,
  monthlyExpenses,
  accountBalance,
  dpsContributedSoFar,
  debtPaidSoFar,
  computeNetWorth,
} from '../domain/math';
import * as accounts from '../domain/accounts';
import { AccountTypeIcon, accountTypeLabel, accountTone, accountBalanceColor } from '../components/AccountTypeIcon';
import { ICON_TILE_CLASS } from '../components/icons/Icons';
import { ArrowUp, ArrowDown, ArrowLeftRight, ChevronRight, Close } from '../components/icons/Icons';
import { TransactionTag } from '../components/TransactionTag';
import { EmptyState, AccountsIllustration, TransactionsIllustration } from '../components/EmptyState';
// Note: the legacy Tile wrapper (Stat + StatTone) was removed along
// with the 3+3 stat grid on 2026-09-03 — see its doc stub below.

import { fmtBDT, fmtBDTSigned, fmtRelative } from '../lib/format';

export function HomeScreen() {
  const state = useStore(s => s.state);
  const showOnboardingBanner = !state.settings.onboardingComplete;

  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + 1;

  const txs = state.transactions;
  const accList = accounts.list(state);
  const totalBalance = accList.reduce((s, a) => s + accountBalance(a, txs), 0);
  const income = monthlyIncome(txs, y, m);
  const expenses = monthlyExpenses(txs, y, m);
  const incomeCount = txs.filter(t => t.type === 'income' && startsInMonth(t.date, y, m)).length;
  const expenseCount = txs.filter(t => t.type === 'expense' && startsInMonth(t.date, y, m)).length;

  // Debts — sum of remaining (= total − paid) for active debts, split by direction.
  const activeDebts = state.debts.filter(d => d.status === 'active');
  const remainingOn = (d: typeof activeDebts[number]) => Math.max(0, (Number(d.total) || 0) - debtPaidSoFar(d, txs));
  const debtIOweRemaining      = activeDebts.filter(d => d.direction === 'i_owe').reduce((s, d) => s + remainingOn(d), 0);
  const debtOwedToMeRemaining  = activeDebts.filter(d => d.direction === 'owed_to_me').reduce((s, d) => s + remainingOn(d), 0);
  const activeDebtCount = activeDebts.length;

  // Investments — sum of active principals. DPS-aware: dpsContributedSoFar
  // for DPS (real money paid in), `Number(inv.principal)` for FDR/savings.
  const activeInvestments = state.investments.filter(inv => inv.status === 'active');
  const totalInvestment = activeInvestments.reduce((s, inv) => {
    if (inv.type === 'dps') return s + dpsContributedSoFar(inv, txs);
    return s + (Number(inv.principal) || 0);
  }, 0);
  const investmentCount = activeInvestments.length;

  // Net worth comes from the domain helper so the dual-value treatment
  // (current vs projected) matches what /insights and the Investments
  // screens show. "Net worth" here is the *current* number — money in
  // your hand right now. The projected number is shown underneath as a
  // clearly-labelled projection, so users who started a DPS yesterday
  // don't see their full mature amount skew the headline.
  const { currentNetWorth, projectedNetWorth } = computeNetWorth({
    accounts: state.accounts,
    transactions: state.transactions,
    debts: state.debts,
    investments: state.investments,
  });

  // Net worth delta vs last month — powers the hero's ▲ / ▼ caption.
  // We re-run the same `computeNetWorth` against an `asOf` snapshot
  // pinned to the last day of the previous month, so DPS contributions
  // and any backdated txs are honoured by the same dual-value logic.
  const lastMonthEnd = new Date(Date.UTC(y, m - 1, 0)); // day 0 of current month = last day of previous month
  const lastMonthNetWorth = computeNetWorth({
    accounts: state.accounts,
    transactions: state.transactions,
    debts: state.debts,
    investments: state.investments,
  }, lastMonthEnd).currentNetWorth;
  const netWorthDelta = currentNetWorth - lastMonthNetWorth;

  const recentTx = txs.slice().sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 4);

  return (
    <div className="flex flex-col gap-6">
      {showOnboardingBanner && <DemoBanner />}

      <div className="flex justify-between items-end">
        <div>
          <h1 className="heading h1-screen">Where is my money?</h1>
          <div className="text-muted text-[13px] mt-1.5">
            {`Net worth · ${accList.length === 1 ? 'across 1 account' : `across ${accList.length} accounts`} · updated just now`}
          </div>
        </div>
      </div>

      {/* Variant B — Focus pair. The left tile is the headline answer
          (net worth) at 2fr; the right tile is the supporting "this
          month" summary at 1fr. Both stack to a single column below
          sm (640px) so the 56px hero figure doesn't overflow. */}
      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4">
        <NetWorthHero
          current={currentNetWorth}
          projected={projectedNetWorth}
          delta={netWorthDelta}
        />
        <ThisMonthCard
          income={income}
          expenses={expenses}
          monthLabel={monthKeyLabel(y, m)}
          entryCount={incomeCount + expenseCount}
        />
      </div>

      {/* Variant B — Slim 4-up strip. The four pieces of the net worth
          formula live here explicitly: Cash + Receivables + Investments
          − Debts = currentNetWorth. Each cell carries its own tone so
          the strip isn't a colourless rail; together they add up
          audibly to the hero figure above. */}
      <div className="card !p-0 overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-border">
          <StripCell
            label="Cash"
            value={fmtBDT(totalBalance)}
            hint={accList.length === 0
              ? 'No accounts yet'
              : `Sum of money across ${accList.length} ${accList.length === 1 ? 'account' : 'accounts'}`}
            valueTone="primary"
          />
          <StripCell
            label="Receivables"
            value={fmtBDT(debtOwedToMeRemaining)}
            hint={
              activeDebtCount === 0 || debtOwedToMeRemaining === 0
                ? 'no money owed to you'
                : `Owed by ${activeDebts.filter(d => d.direction === 'owed_to_me').length} ${activeDebts.filter(d => d.direction === 'owed_to_me').length === 1 ? 'person' : 'people'}`
            }
            valueTone={debtOwedToMeRemaining > 0 ? 'primary' : 'ink'}
          />
          <StripCell
            label="Debts"
            value={fmtBDT(debtIOweRemaining)}
            hint={
              activeDebtCount === 0
                ? 'no active debts'
                : `You owe across ${activeDebts.filter(d => d.direction === 'i_owe').length} ${activeDebts.filter(d => d.direction === 'i_owe').length === 1 ? 'debt' : 'debts'}`
            }
            valueTone={debtIOweRemaining > 0 ? 'danger' : 'ink'}
          />
          <StripCell
            label="Investments"
            value={fmtBDT(totalInvestment)}
            hint={investmentCount === 0
              ? 'none yet'
              : `Locked in ${investmentCount} active ${investmentCount === 1 ? 'scheme' : 'schemes'}`}
            valueTone="accent"
          />
        </div>
      </div>

      {/* Accounts + Recent activity — stacks on mobile. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card title="Accounts" right={<ManageLink to="/accounts" />}>
          {accList.length === 0
            ? <div className="p-4"><EmptyState
                illustration={<AccountsIllustration />}
                title="No accounts yet"
                description="Add an account to track balances, transactions, and net worth."
                cta={{ to: '/accounts/add', label: '+ Add an account' }}
                learnMoreTopic="accounts"
              /></div>
            : accList.slice(0, 4).map(a => {
                const bal = accountBalance(a, txs);
                return (
                  <AcctRow key={a.id} icon={<AccountTypeIcon type={a.type} />} name={a.name} type={accountTypeLabel(a.type)} balance={bal} tone={accountTone(a.type)} />
                );
              })
          }
        </Card>

        <Card title="Recent activity" right={<ManageLink to="/transactions" label="View all" />}>
          {recentTx.length === 0
            ? <div className="p-4"><EmptyState
                illustration={<TransactionsIllustration />}
                title="No transactions yet"
                description="Record income, expenses, or transfers to see them here."
                cta={{ to: '/transactions/new', label: '+ Add a transaction' }}
                learnMoreTopic="transactions"
              /></div>
            : recentTx.map(tx => <TxRow key={tx.id} tx={tx} state={state} />)
          }
        </Card>
      </div>

      {/* Bridge to Insights */}
      <div className="flex justify-end mt-2">
        <Link
          to="/insights"
          className="text-primary text-[12.5px] font-semibold hover:underline underline-offset-2"
        >
          See full Insights {'\u2192'}
        </Link>
      </div>
    </div>
  );
}

/**
 * NetWorthHero — the page's headline answer to "Where is my money?".
 *
 * 2026-09-03 redesign (Variant B): promoted from one of six equal
 * tiles to the dominant focal card. The current figure sits at 56px
 * (≈2× the old 28px), the +/- delta vs last month reads as a primary
 * signal under the figure, and the projection (if any) anchors the
 * right column as a quieter secondary number.
 *
 * Colour rule: positive delta in primary green, negative in danger
 * red. Negative net worth itself is also red — same red on the
 * figure and the delta is fine because the figure's sign already
 * tells the story; the delta's colour carries the *trend*.
 */
function NetWorthHero({ current, projected, delta }: { current: number; projected: number; delta: number }) {
  const isNegative = current < 0;
  const hasProjection = projected > current;
  const deltaAbs = Math.abs(delta);
  const deltaIsZero = Math.abs(delta) < 1;
  const deltaUp = delta >= 0;
  const deltaColor = deltaIsZero
    ? 'text-muted'
    : deltaUp
      ? 'text-primary'
      : 'text-danger';
  return (
    <div className="card relative overflow-hidden">
      {/* Soft tonal wash so the hero reads as the page's primary
          surface without needing extra chrome. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background: 'radial-gradient(700px 200px at 0% 0%, rgba(245,185,77,0.10), transparent 60%)',
        }}
      />
      <div className="relative grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-6 items-center">
        <div className="min-w-0">
          <div className="text-[11px] text-muted uppercase tracking-[0.14em] font-semibold">
            Net worth
          </div>
          <div className={`mt-2 text-[44px] sm:text-[52px] font-extrabold tracking-[-0.03em] tabular leading-[1] ${isNegative ? 'text-danger' : 'text-accent'} break-words`}>
            {isNegative ? '\u2212' + fmtBDT(Math.abs(current)) : fmtBDT(current)}
          </div>
          {/* Delta vs last month — only show when there's a real
              difference. Zero / undefined reads as "no change" so we
              drop the row entirely instead of rendering "+৳0". */}
          {!deltaIsZero && (
            <div className={`mt-3 text-[13px] font-semibold inline-flex items-center gap-1.5 tabular ${deltaColor}`}>
              <span aria-hidden>{deltaUp ? '\u25B2' : '\u25BC'}</span>
              <span>{`${deltaUp ? '+' : '\u2212'}${fmtBDT(deltaAbs)}`}</span>
              <span className="text-muted font-normal">vs last month</span>
            </div>
          )}
          <div className="text-[12px] text-muted mt-1.5">
            {isNegative ? 'Liabilities exceed assets' : 'Assets minus liabilities'}
          </div>
        </div>
        {hasProjection && (
          <div className="text-right">
            <div className="text-[10.5px] text-muted uppercase tracking-[0.08em] font-bold">
              Projection
            </div>
            <div className="text-[20px] sm:text-[24px] font-extrabold tabular text-primary mt-2 tracking-tight leading-none">
              {`+${fmtBDT(projected - current)}`}
            </div>
            <div className="text-[11px] text-muted mt-1.5 tabular">
              at maturity
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * ThisMonthCard — three-row summary of monthly cashflow that pairs
 * with the NetWorthHero. Income / Expenses / Net saved as a clean
 * three-row table with a footer carrying the month label and entry
 * count, so the card stays informative when the user lands on a
 * fresh month (Income/Expenses can both be ৳0 with "Sep 2026 · 0
 * entries" in the footer).
 */
function ThisMonthCard({
  income, expenses, monthLabel, entryCount,
}: { income: number; expenses: number; monthLabel: string; entryCount: number }) {
  const netSaved = income - expenses;
  const netColor = netSaved > 0 ? 'text-primary' : netSaved < 0 ? 'text-danger' : 'text-ink';
  return (
    <div className="card flex flex-col gap-3">
      <div className="text-[11px] text-muted uppercase tracking-[0.14em] font-semibold">
        This month
      </div>
      <div className="flex justify-between items-baseline">
        <span className="text-[13px] text-ink font-semibold">Income</span>
        <span className={`text-[17px] font-extrabold tabular tracking-tight ${income > 0 ? 'text-primary' : 'text-muted'}`}>
          {fmtBDT(income)}
        </span>
      </div>
      <div className="flex justify-between items-baseline">
        <span className="text-[13px] text-ink font-semibold">Expenses</span>
        <span className={`text-[17px] font-extrabold tabular tracking-tight ${expenses > 0 ? 'text-danger' : 'text-muted'}`}>
          {fmtBDT(expenses)}
        </span>
      </div>
      <div className="flex justify-between items-baseline">
        <span className="text-[13px] text-ink font-semibold">Net saved</span>
        <span className={`text-[17px] font-extrabold tabular tracking-tight ${netColor}`}>
          {netSaved === 0 ? '\u2014' : (netSaved > 0 ? '+' : '\u2212') + fmtBDT(Math.abs(netSaved))}
        </span>
      </div>
      <div className="mt-auto pt-3 border-t border-border flex justify-between text-[11.5px] text-muted tabular">
        <span>{monthLabel}</span>
        <span>{entryCount} {entryCount === 1 ? 'entry' : 'entries'}</span>
      </div>
    </div>
  );
}

/**
 * StripCell — slim cell inside the 3-up Cash/Debts/Investments strip.
 * Two-line cell: a small uppercase label, a 22px value, and a
 * one-line muted hint. The value picks up a tone tied to its
 * semantic bucket so the rail doesn't read as a colourless wall:
 *   Cash         → primary green (positive — money you have)
 *   Debts        → danger red when netDebt > 0 (you owe),
 *                  primary green when netDebt < 0 (owed to you),
 *                  neutral ink when netDebt === 0 (balanced)
 *   Investments  → accent gold (locked, future-valued money)
 *
 * The `value` string carries the formatted figure; `valueTone` is an
 * optional override — defaults to 'ink' for callers that don't pass
 * a semantic bucket.
 */
function StripCell({
  label, value, hint, valueTone = 'ink',
}: {
  label: string;
  value: string;
  hint?: string;
  valueTone?: 'primary' | 'danger' | 'accent' | 'ink';
}) {
  const valueColor =
    valueTone === 'primary' ? 'text-primary' :
    valueTone === 'danger'  ? 'text-danger'  :
    valueTone === 'accent'  ? 'text-accent'  :
                              'text-ink';
  return (
    <div className="px-5 py-4 min-w-0">
      <div className="text-[10.5px] text-muted uppercase tracking-[0.08em] font-bold">
        {label}
      </div>
      <div className={`mt-2 text-[20px] sm:text-[22px] font-extrabold tabular tracking-tight leading-none ${valueColor}`}>
        {value}
      </div>
      {hint && (
        <div className="text-[11.5px] text-muted mt-1.5 truncate">
          {hint}
        </div>
      )}
    </div>
  );
}

/** "Sep 2026" — display form for the current month. */
function monthKeyLabel(y: number, m: number): string {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[m - 1]} ${y}`;
}

/* ---------- helpers ---------- */

function startsInMonth(iso: string, y: number, m: number): boolean {
  const d = new Date(iso + 'T00:00:00Z');
  return d.getUTCFullYear() === y && d.getUTCMonth() + 1 === m;
}

/* ---------- tiny presentational atoms ---------- */

function Card({
  title, right, children,
}: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="card">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-[11px] text-muted uppercase tracking-[0.08em] font-semibold m-0">
          {title}
        </h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function ManageLink({ to, label = 'Manage \u2192' }: { to: string; label?: string }) {
  return (
    <Link to={to} className="text-primary text-[12.5px] font-semibold hover:underline underline-offset-2">
      {label}
    </Link>
  );
}

/**
 * Tile — card surface around the shared <Stat>.
 *
 * 2026-09-03 (Variant B): removed. The previous 3+3 stat grid was
 * replaced by a focus pair (NetWorthHero + ThisMonthCard) and a slim
 * 3-up StripCell rail, so the Tile wrapper has no remaining call
 * sites. The Tone mapping it documented is preserved here for
 * reference — other screens still rely on the same mapping when they
 * pass a legacy `tone` prop to <Stat>.
 *
 *   'in' / 'primary' / 'info' → primary
 *   'out'                      → danger
 *   'accent'                   → accent
 *   'neutral' / undefined      → ink
 */

function AcctRow({ icon, name, type, balance, tone }: { icon: React.ReactNode; name: string; type: string; balance: number; tone?: import('../components/AccountTypeIcon').AccountTone }) {
  // The balance number picks up the same tone as the icon so
  // mobile_wallet balances (info/blue) read as the same color family
  // as the avatar. The wrapper stays neutral; the icon itself is
  // tinted with the account tone via `currentColor`.
  return (
    <div className="flex justify-between items-center py-3 border-b border-border last:border-0">
      <div className="flex items-center gap-3">
        <div className={ICON_TILE_CLASS}>
          <span className={accountBalanceColor(tone ?? 'muted')}>
            {icon}
          </span>
        </div>
        <div>
          <div className="font-semibold text-[14px] leading-tight tracking-tight">{name}</div>
          <div className="text-xs text-muted leading-tight mt-1">{type}</div>
        </div>
      </div>
      <div className={`font-bold tabular text-[14px] ${accountBalanceColor(tone ?? 'muted')}`}>{fmtBDT(balance)}</div>
    </div>
  );
}

function TxRow({ tx, state }: { tx: any; state: any }) {
  const acc = state.accounts.find((a: any) => a.id === tx.accountId || a.id === tx.fromAccountId);
  const cat = state.categories.find((c: any) => c.id === tx.categoryId);
  const direction: 'in' | 'out' | 'xfr' =
    tx.type === 'income' ? 'in' : tx.type === 'expense' ? 'out' : 'xfr';
  // Wrapper is uniformly neutral; the icon itself picks up a
  // direction-based color so income/expense/transfer rows remain
  // scannable at a glance without tinting the wrapper chrome.
  // For transfers, mobile_wallet accounts color info-blue (matching
  // their avatar family); otherwise transfer stays muted.
  const dirIconColor =
    direction === 'in'   ? 'text-primary'  // income → green
    : direction === 'out' ? 'text-danger'   // expense → red
    : direction === 'xfr' && acc?.type === 'mobile_wallet' ? 'text-info'
    :                       'text-muted';    // transfer → muted
  // Amount colour mirrors the arrow direction so the most-scanned
  // element on the row (the figure) carries direction at a glance.
  // Transfers inherit the source-account family — info-blue for
  // mobile_wallet (so a bKash → Cash movement reads as info, not
  // generic ink), neutral ink otherwise.
  const amtColor =
    direction === 'in'   ? 'text-primary'  // income → green
    : direction === 'out' ? 'text-danger'   // expense → red
    : direction === 'xfr' && acc?.type === 'mobile_wallet' ? 'text-info'
    :                       'text-ink';      // transfer → neutral
  return (
    <div className="group flex justify-between items-center py-3.5 border-b border-border last:border-0">
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
            <span className="min-w-0 truncate">{tx.note || cat?.name || tx.type}</span>
            <TransactionTag
              tx={tx}
              debtDirection={tx.linkedDebtId ? state.debts.find((d: any) => d.id === tx.linkedDebtId)?.direction : undefined}
            />
          </div>
          <div className="text-xs text-muted leading-tight mt-1 truncate">
            {fmtRelative(tx.date)} {acc ? `· ${acc.name}` : ''}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className={`font-bold tabular text-[14px] ${amtColor}`}>
          {fmtBDTSigned(tx.amount, direction)}
        </div>
        <ChevronRight className="w-4 h-4 text-muted opacity-0 group-hover:opacity-100 transition" />
      </div>
    </div>
  );
}


function DemoBanner() {
  const [show, setShow] = useState(true);
  const completeOnboarding = useStore(s => s.completeOnboarding);
  const navigate = useNavigate();
  if (!show) return null;
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 text-[13px] text-muted rounded-card"
      style={{
        background: 'var(--surface-2)',
        border: '1px dashed var(--border)',
      }}
    >
      <span className="w-2 h-2 rounded-full bg-accent" />
      <span className="grow">
        <strong className="text-ink font-semibold">Welcome to Finora.</strong>{' '}
        Set up your first account to start tracking.{' '}
        <button
          type="button"
          onClick={() => { completeOnboarding(); setShow(false); navigate('/onboarding'); }}
          className="text-primary font-semibold hover:underline underline-offset-2"
        >
          Start using Finora {'\u2192'}
        </button>
      </span>
      <button
        type="button"
        onClick={() => setShow(false)}
        aria-label="Dismiss banner"
        className="ml-auto w-7 h-7 inline-flex items-center justify-center rounded-md text-muted hover:bg-surface-3 hover:text-ink transition"
      >
        <Close className="w-4 h-4" />
      </button>
    </div>
  );
}
