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
import { Link } from 'react-router-dom';
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
import { AccountTypeIcon, accountTypeLabel, accountTone, accountTileClass, accountBalanceColor } from '../components/AccountTypeIcon';
import { ArrowUp, ArrowDown, ArrowLeftRight, Close } from '../components/icons/Icons';
import { TransactionTag } from '../components/TransactionTag';
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
  const netDebt                = debtIOweRemaining - debtOwedToMeRemaining; // signed: + = I owe net, − = owed to me net
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

  const recentTx = txs.slice().sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 4);

  return (
    <div className="flex flex-col gap-6">
      {showOnboardingBanner && <DemoBanner />}

      <div className="flex justify-between items-end">
        <div>
          <h1 className="heading h1-screen">Where is my money?</h1>
          <div className="text-muted text-[13px] mt-1.5">
            {`Total across ${accList.length} account${accList.length === 1 ? '' : 's'} · updated just now`}
          </div>
        </div>
      </div>

      {/* Row 1 — point-in-time assets: Total balance, Total debt, Total investments.
         These are the "where my money lives right now" trio. Stacks to a
         single column below sm (640px) so the 28px values don't overflow. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat label="Total balance" value={fmtBDT(totalBalance)} trend={accList.length === 0 ? 'no accounts yet' : `across ${accList.length} accounts`} tone="primary" />
        <Stat
          label="Total debt"
          value={fmtDebtMagnitude(netDebt)}
          trend={
            activeDebtCount === 0
              ? 'no active debts'
              : netDebt === 0
                ? 'balanced'
                : netDebt > 0
                  ? `you owe net ${fmtBDT(Math.abs(netDebt))}`
                  : `owed to you net ${fmtBDT(Math.abs(netDebt))}`
          }
          tone={netDebt > 0 ? 'out' : netDebt < 0 ? 'in' : 'neutral'}
        />
        <Stat
          label="Total investments"
          value={fmtBDT(totalInvestment)}
          trend={investmentCount === 0 ? 'none yet' : `across ${investmentCount} ${investmentCount === 1 ? 'investment' : 'investments'}`}
          tone="accent"
        />
      </div>

      {/* Row 2 — this-month activity + net worth: Income, Expense, Net worth.
         The income/expense pair are the action-oriented duo; net worth
         closes the section as the derived summary. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat label="Income (this month)"   value={fmtBDT(income)}    trend={`${incomeCount} ${incomeCount === 1 ? 'entry' : 'entries'}`} tone="in" />
        <Stat label="Expenses (this month)" value={fmtBDT(expenses)} trend={`${expenseCount} entries`} tone="out" />
        <NetWorthTile
          current={currentNetWorth}
          projected={projectedNetWorth}
        />
      </div>

      {/* Accounts + Recent activity — stacks on mobile. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card title="Accounts" right={<ManageLink to="/accounts" />}>
          {accList.length === 0
            ? <Empty msg="No accounts yet." cta="Add an account" to="/accounts/add" />
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
            ? <Empty msg="No transactions yet." cta="Add a transaction" to="/transactions/new" />
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
 * Net worth tile — headline is the current value (money you have now);
 * the projected value follows as a muted sub-line when active
 * investments would grow it. The split keeps DPS users honest: a DPS
 * with one paid installment shows ৳X for current and ৳Y for projected,
 * so the headline can't pretend you already have the mature amount.
 */
function NetWorthTile({ current, projected }: { current: number; projected: number }) {
  const diff = projected - current;
  const valueColor = current >= 0 ? 'text-info' : 'text-danger';
  const caption = current >= 0
    ? 'assets \u2212 liabilities'
    : 'liabilities exceed assets';
  return (
    <div className="card">
      <div className="text-[11px] text-muted uppercase tracking-[0.08em] font-semibold">Net worth</div>
      <div className={`text-[24px] sm:text-[28px] font-bold mt-2.5 tracking-[-0.02em] tabular leading-none ${valueColor} break-words`}>
        {fmtBDT(current)}
      </div>
      {diff > 0 && (
        <div className="text-xs text-muted mt-2 tabular">
          {fmtBDT(projected)} at maturity <span className="opacity-70">(projection)</span>
        </div>
      )}
      <div className="text-xs text-muted mt-1.5">{caption}</div>
    </div>
  );
}

/* ---------- helpers ---------- */

/**
 * BDT for the Total debt tile — always positive. The direction is
 * communicated by the caption ("you owe net" / "owed to you net"),
 * not by a sign prefix, so the value reads as a clean magnitude.
 */
function fmtDebtMagnitude(n: number): string {
  return fmtBDT(Math.abs(n));
}

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

function Stat({ label, value, trend, tone }: { label: string; value: string; trend?: string; tone?: 'in' | 'out' | 'accent' | 'neutral' | 'primary' | 'info' }) {
  const color =
    tone === 'out'    ? 'text-danger' :
    tone === 'in'     ? 'text-primary' :
    tone === 'accent' ? 'text-accent' :
    tone === 'info'   ? 'text-info' :
    tone === 'primary' ? 'text-primary' :
                        'text-ink';
  return (
    <div className="card">
      <div className="text-[11px] text-muted uppercase tracking-[0.08em] font-semibold">{label}</div>
      <div className={`text-[24px] sm:text-[28px] font-bold mt-2.5 tracking-[-0.02em] tabular leading-none ${color} break-words`}>{value}</div>
      {trend && <div className="text-xs text-muted mt-2">{trend}</div>}
    </div>
  );
}

function AcctRow({ icon, name, type, balance, tone }: { icon: React.ReactNode; name: string; type: string; balance: number; tone?: import('../components/AccountTypeIcon').AccountTone }) {
  // The balance number picks up the same tone as the icon tile so
  // mobile_wallet balances (info/blue) read as the same color family
  // as the avatar. `muted` falls back to the default ink color.
  return (
    <div className="flex justify-between items-center py-3 border-b border-border last:border-0">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-[10px] grid place-items-center ${accountTileClass(tone ?? 'muted')}`}>
          {icon}
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
  const accent =
    direction === 'in'
      ? 'text-primary bg-primary-soft'
      : direction === 'out'
        ? 'text-danger bg-danger-soft'
        : 'text-accent bg-accent-soft';
  // On the home preview, transfer amounts color info-blue when the
  // source account is a mobile wallet — so a bKash → Cash movement
  // reads with the same blue family as the avatar tile instead of
  // the default neutral ink.
  const amtColor =
    direction === 'in'   ? 'text-primary'  // income → green
    : direction === 'out' ? 'text-danger'   // expense → red
    : direction === 'xfr' && acc?.type === 'mobile_wallet' ? 'text-info'
    :                       'text-ink';      // transfer → neutral
  return (
    <div className="flex justify-between items-center py-3.5 border-b border-border last:border-0">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-[10px] grid place-items-center ${accent}`}>
          {direction === 'in' && <ArrowUp className="w-[18px] h-[18px]" />}
          {direction === 'out' && <ArrowDown className="w-[18px] h-[18px]" />}
          {direction === 'xfr' && <ArrowLeftRight className="w-[18px] h-[18px]" />}
        </div>
        <div>
          <div className="font-semibold text-[14px] leading-tight tracking-tight flex items-center gap-2 flex-wrap">
            <span className="min-w-0 truncate">{tx.note || cat?.name || tx.type}</span>
            <TransactionTag
              tx={tx}
              debtDirection={tx.linkedDebtId ? state.debts.find((d: any) => d.id === tx.linkedDebtId)?.direction : undefined}
            />
          </div>
          <div className="text-xs text-muted leading-tight mt-1">
            {fmtRelative(tx.date)} {acc ? `· ${acc.name}` : ''}
          </div>
        </div>
      </div>
      <div className={`font-bold tabular text-[14px] ${amtColor}`}>
        {fmtBDTSigned(tx.amount, direction)}
      </div>
    </div>
  );
}

function Empty({ msg, cta, to }: { msg: string; cta?: string; to?: string }) {
  return (
    <div className="py-9 text-center text-muted">
      <div className="text-[14px] font-semibold text-ink">{msg}</div>
      {cta && to && (
        <Link
          to={to}
          className="inline-block mt-3.5 bg-primary text-primary-on px-5 py-2.5 rounded-btn text-[13px] font-bold hover:opacity-95 active:translate-y-px transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          {cta}
        </Link>
      )}
    </div>
  );
}

function DemoBanner() {
  const [show, setShow] = useState(true);
  const completeOnboarding = useStore(s => s.completeOnboarding);
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
        <strong className="text-ink font-semibold">You're viewing demo data.</strong>{' '}
        This is a sample dashboard.{' '}
        <button
          type="button"
          onClick={() => { completeOnboarding(); setShow(false); }}
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
