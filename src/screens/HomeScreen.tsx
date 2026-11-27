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
 *   3. Status bar: Net worth headline + its 6-month line chart, then
 *      Cash · Investments · Receivables · Debts as stat cells with
 *      sparklines
 *   4. Activity board: a ruled 5-column ledger of recent transactions
 *   5. "See full Insights →" affordance
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
  accountBalance,
  debtOutstanding,
  investmentValue,
  isInvestmentHeld,
  computeNetWorth,
} from '../domain/math';
import { homeTrendSeries, type TrendPoint } from '../domain/insights';
import * as accounts from '../domain/accounts';
import { ICON_TILE_CLASS } from '../components/icons/Icons';
import { ArrowUp, ArrowDown, ArrowLeftRight, Close } from '../components/icons/Icons';
import { TransactionTag } from '../components/TransactionTag';
import { EmptyState, TransactionsIllustration } from '../components/EmptyState';
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

  // Debts — sum of remaining for active debts, split by direction.
  //
  // Uses the canonical `debtOutstanding` helper rather than a local
  // `total − paid` sum. On a loan-kind debt every payment carries
  // interest, so gross paid overstates what has actually retired
  // principal — `total − paid` understated what you still owe and made
  // Home disagree with the Debts screen by exactly the interest paid.
  const activeDebts = state.debts.filter(d => d.status === 'active');
  const debtIOweRemaining      = activeDebts.filter(d => d.direction === 'i_owe').reduce((s, d) => s + debtOutstanding(d, txs), 0);
  const debtOwedToMeRemaining  = activeDebts.filter(d => d.direction === 'owed_to_me').reduce((s, d) => s + debtOutstanding(d, txs), 0);
  const activeDebtCount = activeDebts.length;

  // Investments — sum of current values for the schemes you're holding.
  // Uses the same `investmentValue` helper the Investments screen reads
  // and the same `isInvestmentHeld` predicate net worth uses, so Home
  // and /investments can never disagree. DPS current value is the
  // contributions compounded to today; FDR/savings is the principal.
  const heldInvestments = state.investments.filter(isInvestmentHeld);
  const totalInvestment = heldInvestments.reduce(
    (s, inv) => s + investmentValue(inv, txs).currentValue,
    0
  );
  const investmentCount = heldInvestments.length;

  // Net worth comes from the domain helper so the dual-value treatment
  // (current vs projected) matches what /insights and the Investments
  // screens show. "Net worth" here is the *current* number — money in
  // your hand right now. The projection is not shown here: it moved
  // out with the "Balance sheet" card, so a DPS started yesterday
  // cannot skew the headline.
  const { currentNetWorth } = computeNetWorth({
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

  // The hero's delta row, split out for the board's status bar.
  const deltaAbs = Math.abs(netWorthDelta);
  const deltaIsZero = Math.abs(netWorthDelta) < 1;
  const deltaUp = netWorthDelta >= 0;

  // Six months of movement for each headline figure, so the status bar
  // can show a sparkline under every number. The last point of each
  // series is "now", so it always agrees with the figure beside it.
  const trends = homeTrendSeries(state, 6);

  // 2026-11-24 (Variant D): the Recent activity preview was raised
  // from 4 rows to 5 — it now sits in the prime position beside the
  // hero, so it earns the extra row. The list is sorted newest-first.
  const recentTx = txs.slice().sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5);

  return (
    <div className="flex flex-col gap-6">
      {showOnboardingBanner && <DemoBanner />}

      <div className="flex justify-between items-end">
        <div>
          <h1 className="heading h1-screen">Where is my money?</h1>
          <div className="text-muted t-13 mt-1.5">
            {`Net worth · ${accList.length === 1 ? 'across 1 account' : `across ${accList.length} accounts`} · updated just now`}
          </div>
        </div>
      </div>

      {/* 2026-11-24 (Variant H — The board). The page is rebuilt as a
          wide STATUS BAR across the top and a ruled LEDGER BOARD
          below.

          The status bar carries the net worth headline on the left with
          its own six-month line chart, then the four other figures
          (Cash · Investments · Receivables · Debts) as inline stat
          cells, each with a sparkline so every figure shows its
          direction. The recent activity becomes a proper board with a
          running column.

          The "Accounts" preview card, the "This month" card and the
          "Balance sheet" card are GONE — every figure they used to
          hold now lives in the status bar — so the page is two blocks:
          the bar and the board.

          The e2e page object's locators still resolve:
            - `netWorthFigure` keys on `div.t-30` — the headline
              figure keeps that size.
            - `stripValue` / `stripHint` key on the LABEL's parent,
              looking for `div.t-18` / `div.t-11`
              siblings. The stat cells render label / value / hint as
              three siblings, so they stay reachable.
            - `recentActivityCard` keys on `section.card` — the board
              keeps the `section.card` wrapper and its "View all" link.
            - `activityRow` keys on `div.group` — the board rows keep
              the `group` class.
          Each of the four stat labels appears exactly once on the
          page, so the page object's label-keyed lookups cannot resolve
          to two different cells. */}
      <div className="card !p-0 overflow-hidden">
        <div className="grid grid-cols-2 lg:grid-cols-[minmax(0,300px)_repeat(4,minmax(0,1fr))]">
          <div
            className="relative overflow-hidden px-[22px] py-5 border-t border-border col-span-2 lg:col-span-1 lg:border-r lg:border-border"
            style={{
              background:
                'linear-gradient(160deg, rgba(245,185,77,0.10), transparent 70%)',
            }}
          >
            <div className="t-11 text-muted uppercase tracking-wide font-semibold">
              Net worth
            </div>
            <div
              className={`mt-2 t-30 font-extrabold tracking-[-0.03em] tabular leading-[1] whitespace-nowrap ${currentNetWorth < 0 ? 'text-danger' : 'text-accent'}`}
            >
              {currentNetWorth < 0 ? '\u2212' + fmtBDT(Math.abs(currentNetWorth)) : fmtBDT(currentNetWorth)}
            </div>
            {!deltaIsZero && (
              <div className={`mt-3 t-13 font-semibold inline-flex items-center gap-1.5 tabular ${deltaUp ? 'text-primary' : 'text-danger'}`}>
                <span aria-hidden>{deltaUp ? '\u25B2' : '\u25BC'}</span>
                <span>{`${deltaUp ? '+' : '\u2212'}${fmtBDT(deltaAbs)}`}</span>
                <span className="text-muted font-normal">vs last month</span>
              </div>
            )}
            <div className="t-12 text-muted mt-1.5">
              {currentNetWorth < 0 ? 'Liabilities exceed assets' : 'Assets minus liabilities'}
            </div>

            {/* The six-month net-worth line, so the headline figure
                arrives with its own history. */}
            <TrendChart points={trends.netWorth} tone="accent" height={52} />
            <div className="flex justify-between t-10 text-muted tabular mt-1 px-px">
              {trends.netWorth.map(p => <span key={`${p.year}-${p.month}`}>{p.label}</span>)}
            </div>
          </div>

          <StatusCell
            label="Cash"
            value={fmtBDT(totalBalance)}
            hint={accList.length === 0
              ? 'No accounts yet'
              : `Sum of money across ${accList.length} ${accList.length === 1 ? 'account' : 'accounts'}`}
            valueTone="primary"
            points={trends.cash}
            tone="primary"
            odd
          />
          <StatusCell
            label="Investments"
            value={fmtBDT(totalInvestment)}
            hint={investmentCount === 0
              ? 'none yet'
              : `Locked in ${investmentCount} active ${investmentCount === 1 ? 'scheme' : 'schemes'}`}
            valueTone="accent"
            points={trends.investments}
            tone="accent"
            odd
          />
          <StatusCell
            label="Receivables"
            value={fmtBDT(debtOwedToMeRemaining)}
            hint={
              activeDebtCount === 0 || debtOwedToMeRemaining === 0
                ? 'no money owed to you'
                : `Owed by ${activeDebts.filter(d => d.direction === 'owed_to_me').length} ${activeDebts.filter(d => d.direction === 'owed_to_me').length === 1 ? 'person' : 'people'}`
            }
            valueTone={debtOwedToMeRemaining > 0 ? 'primary' : 'ink'}
            points={trends.receivables}
            tone="primary"
            odd
          />
          <StatusCell
            label="Debts"
            value={fmtBDT(debtIOweRemaining)}
            hint={
              activeDebtCount === 0 || debtIOweRemaining === 0
                ? 'no active debts'
                : `You owe across ${activeDebts.filter(d => d.direction === 'i_owe').length} ${activeDebts.filter(d => d.direction === 'i_owe').length === 1 ? 'debt' : 'debts'}`
            }
            valueTone={debtIOweRemaining > 0 ? 'danger' : 'ink'}
            points={trends.debts}
            tone="danger"
          />
        </div>
      </div>

      {/* The ledger board — the recent activity as a ruled table. */}
      <section className="card p-0 overflow-hidden">
        <div className="flex justify-between items-center px-5 pt-4 pb-3">
          <div>
            <h2 className="heading h4-item m-0">Recent activity</h2>
            <div className="label-sm mt-1">
              Last {recentTx.length} transactions
            </div>
          </div>
          <ManageLink to="/transactions" label="View all" />
        </div>
        {recentTx.length === 0
          ? <div className="p-4"><EmptyState
              illustration={<TransactionsIllustration />}
              title="No transactions yet"
              description="Record income, expenses, or transfers to see them here."
              cta={{ to: '/transactions/new', label: '+ Add a transaction' }}
              learnMoreTopic="transactions"
            /></div>
          : <>
              <div className="overflow-x-auto">
                <div className="min-w-[640px]">
                  <div className="label-sm grid grid-cols-[minmax(0,1.4fr)_92px_120px_110px_110px] gap-3 px-5 py-2 bg-surface-2 border-y border-border">
                    <div>Transaction</div>
                    <div>Date</div>
                    <div>Account</div>
                    <div>Category</div>
                    <div className="text-right">Amount</div>
                  </div>
                  {recentTx.map(tx => <BoardRow key={tx.id} tx={tx} state={state} />)}
                </div>
              </div>
            </>
        }
      </section>

      {/* Bridge to Insights */}
      <div className="flex justify-end mt-2">
        <Link
          to="/insights"
          className="text-primary t-12 font-semibold hover:underline underline-offset-2"
        >
          See full Insights {'\u2192'}
        </Link>
      </div>
    </div>
  );
}

/**
 * TrendChart — a small line chart over a monthly series.
 *
 * 2026-11-24 (Variant H — The board): every headline figure on Home
 * arrives with its own six-month history, so the user can read
 * direction without leaving the page.
 *
 * The line is scaled to the series' own min/max with a little
 * headroom, so a flat series (receivables that never move) draws a
 * straight mid-height line instead of collapsing onto the baseline.
 * Every chart on the page uses the same treatment — a filled area
 * under a 2px line — so the net-worth headline and the four stat
 * cells read as one family.
 */
function TrendChart({
  points, tone, height = 26,
}: {
  points: TrendPoint[];
  tone: 'primary' | 'accent' | 'danger';
  height?: number;
}) {
  if (points.length === 0) return null;
  const W = 120;
  const H = 26;
  const PAD = 3;
  const values = points.map(p => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const yFor = (v: number) =>
    span === 0 ? H / 2 : H - PAD - ((v - min) / span) * (H - PAD * 2);
  const step = points.length > 1 ? W / (points.length - 1) : W;
  const coords = points.map((p, i) => {
    const x = points.length > 1 ? i * step : W / 2;
    return `${x.toFixed(2)},${yFor(p.value).toFixed(2)}`;
  });
  const line = coords.join(' ');
  const area = `${line} ${W},${H} 0,${H}`;
  const stroke =
    tone === 'primary' ? 'var(--primary)'
    : tone === 'accent' ? 'var(--accent)'
    : 'var(--danger)';
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      style={{ display: 'block', marginTop: 12, overflow: 'visible' }}
      aria-hidden
    >
      <polygon points={area} fill={stroke} opacity="0.10" />
      <polyline
        points={line}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/**
 * StatusCell — one of the four stat cells in the board's status bar.
 *
 * The label / figure / hint are SIBLINGS under one wrapper, exactly
 * as `StripCell` renders them — the e2e page object's `stripValue`
 * and `stripHint` locators reach the figure and the hint through the
 * LABEL's parent, so the three must stay in that arrangement.
 */
function StatusCell({
  label, value, hint, valueTone = 'ink', points, tone, odd = false,
}: {
  label: string;
  value: string;
  hint?: string;
  valueTone?: 'primary' | 'danger' | 'accent' | 'ink';
  points: TrendPoint[];
  tone: 'primary' | 'accent' | 'danger';
  /** True for the LEFT cell of a pair on the two-column phone layout —
      it must not draw a divider on its left edge. */
  odd?: boolean;
}) {
  const valueColor =
    valueTone === 'primary' ? 'text-primary'
    : valueTone === 'danger' ? 'text-danger'
    : valueTone === 'accent' ? 'text-accent'
    : 'text-ink';
  return (
    <div className={`px-[22px] py-5 min-w-0 border-t border-border lg:border-l lg:border-border flex flex-col justify-center ${odd ? 'border-l-0 lg:border-l' : ''}`}>
      <div className="label-sm">
        {label}
      </div>
      <div className={`mt-2 t-18 sm:t-22 font-extrabold tabular tracking-tight leading-none whitespace-nowrap ${valueColor}`}>
        {value}
      </div>
      {hint && (
        <div className="t-11 text-muted mt-1.5">
          {hint}
        </div>
      )}
      <TrendChart points={points} tone={tone} height={24} />
    </div>
  );
}

/**
 * BoardRow — one ruled line of the activity ledger.
 *
 * 2026-11-24 (Variant H — The board): the recent-activity preview
 * becomes a five-column board (Transaction · Date · Account · Category
 * · Amount). The e2e page object's `activityRow` keys on `div.group`,
 * `activityAmount` on `div.font-bold.tabular` and `activitySubtitle`
 * on `div.t-12.text-muted` — all three classes are preserved.
 */
function BoardRow({ tx, state }: { tx: any; state: any }) {
  const acc = state.accounts.find((a: any) => a.id === tx.accountId || a.id === tx.fromAccountId);
  const cat = state.categories.find((c: any) => c.id === tx.categoryId);
  const direction: 'in' | 'out' | 'xfr' =
    tx.type === 'income' ? 'in' : tx.type === 'expense' ? 'out' : 'xfr';
  const dirIconColor =
    direction === 'in'   ? 'text-primary'
    : direction === 'out' ? 'text-danger'
    : direction === 'xfr' && acc?.type === 'mobile_wallet' ? 'text-info'
    :                       'text-muted';
  const amtColor =
    direction === 'in'   ? 'text-primary'
    : direction === 'out' ? 'text-danger'
    : direction === 'xfr' && acc?.type === 'mobile_wallet' ? 'text-info'
    :                       'text-ink';
  return (
    <div className="group grid grid-cols-[minmax(0,1.4fr)_92px_120px_110px_110px] gap-3 items-center px-5 py-3 border-b border-border last:border-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className={ICON_TILE_CLASS}>
          <span className={dirIconColor}>
            {direction === 'in' && <ArrowUp className="w-[18px] h-[18px]" />}
            {direction === 'out' && <ArrowDown className="w-[18px] h-[18px]" />}
            {direction === 'xfr' && <ArrowLeftRight className="w-[18px] h-[18px]" />}
          </span>
        </div>
        <div className="min-w-0">
          <div className="font-semibold t-13 leading-tight tracking-tight flex items-center gap-2 flex-wrap">
            <span className="min-w-0 truncate">{tx.note || cat?.name || tx.type}</span>
            <TransactionTag
              tx={tx}
              debtDirection={tx.linkedDebtId ? state.debts.find((d: any) => d.id === tx.linkedDebtId)?.direction : undefined}
            />
          </div>
          <div className="t-12 text-muted leading-tight mt-1 truncate">
            {fmtRelative(tx.date)} {acc ? `· ${acc.name}` : ''}
          </div>
        </div>
      </div>
      <div className="t-12 text-muted tabular">
        {fmtRelative(tx.date)}
      </div>
      <div className="t-12 text-muted truncate">
        {acc ? acc.name : '—'}
      </div>
      <div className="t-12 text-muted truncate">
        {cat ? cat.name : tx.type}
      </div>
      <div className={`text-right font-bold tabular t-13 ${amtColor}`}>
        {fmtBDTSigned(tx.amount, direction)}
      </div>
    </div>
  );
}

/* ---------- helpers ---------- */

/* ---------- tiny presentational atoms ---------- */

function ManageLink({ to, label = 'Manage \u2192' }: { to: string; label?: string }) {
  return (
    <Link to={to} className="text-primary t-12 font-semibold hover:underline underline-offset-2">
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

function DemoBanner() {
  const [show, setShow] = useState(true);
  const completeOnboarding = useStore(s => s.completeOnboarding);
  const navigate = useNavigate();
  if (!show) return null;
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 t-13 text-muted rounded-card"
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
