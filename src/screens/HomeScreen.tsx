/**
 * HomeScreen — top-level dashboard.
 *
 * Visual target: docs/ux-designs/.../mockups/v1/index.html#home
 *
 * Layout matches v1 order:
 *   [demo banner ×  with dismiss]
 *   page title + meta line
 *   3-up stat row: Total balance · Income · Expenses
 *   2-up cards:    Accounts preview · Goals preview
 *   full-width:    Debts card with I owe / Owed to me summary
 *   full-width:    Investments card
 *   full-width:    Recent activity
 *
 * 2026-08-14 polish: tighter spacing (24px section gap), stat row uses
 * the same .card primitive for consistency, refined money color rule
 * (income → primary, expense → danger, transfer → ink), and Fraunces
 * headings.
 */
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useStore } from '../domain/store';
import {
  monthlyIncome,
  monthlyExpenses,
  accountBalance,
  daysToMaturity,
  investmentMaturityValueTyped,
  goalSavedFromTxns,
  dpsContributedSoFar,
} from '../domain/math';
import * as accounts from '../domain/accounts';
import * as debts from '../domain/debts';
import * as investments from '../domain/investments';
import * as goals from '../domain/goals';
import { fmtBDT, fmtBDTSigned, fmtDate, fmtRelative } from '../lib/format';

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

  const activeDebts = debts.list(state).filter(d => d.status === 'active');
  const iOwe = activeDebts
    .filter(d => d.direction === 'i_owe')
    .reduce((s, d) => s + (Number(d.total) || 0) - (d.paidSoFar || 0), 0);
  const owedToMe = activeDebts
    .filter(d => d.direction === 'owed_to_me')
    .reduce((s, d) => s + (d.total || 0) - (d.paidSoFar || 0), 0);

  const allInvs = investments.list(state);
  const activeInvs = allInvs.filter(i => i.status === 'active');
  const closedInvs = allInvs.filter(i => i.status !== 'active');
  const totalInvested = activeInvs.reduce(
    (s, i) => s + (i.type === 'dps' ? dpsContributedSoFar(i, state.transactions) : (Number(i.principal) || 0)),
    0
  );

  const activeGoals = goals.list(state);
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

      {/* 3-up stat row */}
      <div className="grid grid-cols-3 gap-4">
        <Stat label="Total balance"         value={fmtBDT(totalBalance)} trend={`across ${accList.length} accounts`} />
        <Stat label="Income (this month)"   value={fmtBDT(income)}        trend={`${incomeCount} ${incomeCount === 1 ? 'entry' : 'entries'}`} tone="in" />
        <Stat label="Expenses (this month)" value={fmtBDT(expenses)}     trend={`${expenseCount} entries`} tone="out" />
      </div>

      {/* Accounts + Goals preview */}
      <div className="grid grid-cols-[2fr_1fr] gap-4">
        <Card title="Accounts" right={<ManageLink to="/accounts" />}>
          {accList.length === 0
            ? <Empty msg="No accounts yet." cta="Add an account" to="/accounts/add" />
            : accList.slice(0, 4).map(a => {
                const bal = accountBalance(a, txs);
                return (
                  <AcctRow key={a.id} icon={<AccountIcon name={a.name} />} name={a.name} type={accountTypeLabel(a.type)} balance={bal} />
                );
              })
          }
        </Card>

        <Card title="Goals" right={<ManageLink to="/goals" />}>
          {activeGoals.length === 0
            ? <Empty msg="No goals yet." cta="Set a goal" to="/goals/add" />
            : activeGoals.slice(0, 3).map(g => {
                const saved = goalSavedFromTxns(g, state.transactions);
                const pct = Math.min(100, Math.round((saved / (Number(g.target) || 1)) * 100));
                return (
                  <Link
                    key={g.id}
                    to={`/goals/${g.id}`}
                    className="block py-[18px] border-b border-border last:border-0 row-hover -mx-2 px-2 rounded transition"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-semibold text-[14px] tracking-tight">{g.name}</div>
                      <div className="text-[11px] text-primary font-bold bg-primary-soft px-2.5 py-[3px] rounded-pill tabular">{pct}%</div>
                    </div>
                    <Bar pct={pct} />
                    <div className="flex justify-between text-xs text-muted mt-2">
                      <span className="tabular">{fmtBDT(saved)} / {fmtBDT(g.target)}</span>
                      <span>{g.targetDate ? `by ${fmtDate(g.targetDate)}` : ''}</span>
                    </div>
                  </Link>
                );
              })
          }
        </Card>
      </div>

      {/* Debts card */}
      <Card title="Debts" right={<ManageLink to="/debts" />}>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <SummaryMicro label="I owe" amount={iOwe} sub={`${activeDebts.filter(d => d.direction === 'i_owe').length} active`} tone="danger" />
          <SummaryMicro label="Owed to me" amount={owedToMe} sub={`${activeDebts.filter(d => d.direction === 'owed_to_me').length} active`} tone="primary" />
        </div>
        {activeDebts.length === 0 ? (
          <Empty msg="No active debts." />
        ) : (
          activeDebts.slice(0, 3).map(d => {
            const pct = d.total > 0 ? Math.min(100, Math.round((d.paidSoFar / d.total) * 100)) : 0;
            const left = d.total - d.paidSoFar;
            const danger = d.direction === 'i_owe';
            return (
              <div key={d.id} className="py-2.5 border-t border-border">
                <div className="flex justify-between items-center mb-2">
                  <div className="font-semibold text-[14px] tracking-tight">{d.name}</div>
                  <div className={`text-xs font-bold tabular ${danger ? 'text-danger' : 'text-primary'}`}>
                    {danger ? '\u2212' : '+'} {fmtBDT(left)} left
                  </div>
                </div>
                <Bar pct={pct} variant={danger ? 'danger' : 'primary'} />
                <div className="text-[11.5px] text-muted mt-1.5 tabular">
                  {fmtBDT(d.paidSoFar)} of {fmtBDT(d.total)}
                  {d.dueDate ? ` · due ${fmtDate(d.dueDate)}` : ''}
                  {d.person ? ` · ${d.person}` : ''}
                </div>
              </div>
            );
          })
        )}
      </Card>

      {/* Investments card */}
      <Card title="Investments" right={<ManageLink to="/investments" />}>
        <div className="mb-4">
          <div className="text-[11px] text-muted uppercase tracking-wider font-semibold">Total invested</div>
          <div className="text-[26px] font-bold text-accent mt-1 tabular tracking-tight">{fmtBDT(totalInvested)}</div>
          <div className="text-xs text-muted mt-1">
            across {activeInvs.length} active{closedInvs.length ? ` · ${closedInvs.length} closed` : ''}
          </div>
        </div>
        {allInvs.length === 0 ? (
          <Empty msg="No investments yet." cta="Add an investment" to="/investments/add" />
        ) : (
          allInvs.slice(0, 3).map(inv => {
            const days = daysToMaturity(inv);
            const mat = investmentMaturityValueTyped(inv);
            const label = days > 0 ? `Matures in ${days}d` : days === 0 ? 'Matures today' : `Matured ${-days}d ago`;
            return (
              <div key={inv.id} className="py-2.5 border-t border-border">
                <div className="flex justify-between items-center mb-1.5">
                  <div className="font-semibold text-[14px] tracking-tight">{inv.name}</div>
                  <div className="text-xs text-muted font-bold">{label}</div>
                </div>
                <div className="flex justify-between items-baseline">
                  <div className="text-[13px] text-accent font-bold tabular">Maturity {fmtBDT(mat)}</div>
                  <div className="text-[11.5px] text-muted tabular">
                    {fmtBDT(inv.principal)} · {inv.rate}% · {inv.termMonths}mo{inv.institution ? ` · ${inv.institution}` : ''}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </Card>

      {/* Recent activity */}
      <Card title="Recent activity" right={<ManageLink to="/transactions" label="View all" />}>
        {recentTx.length === 0
          ? <Empty msg="No transactions yet." cta="Add a transaction" to="/transactions/add" />
          : recentTx.map(tx => <TxRow key={tx.id} tx={tx} state={state} />)
        }
      </Card>
    </div>
  );
}

/* ---------- helpers ---------- */

function startsInMonth(iso: string, y: number, m: number): boolean {
  const d = new Date(iso + 'T00:00:00Z');
  return d.getUTCFullYear() === y && d.getUTCMonth() + 1 === m;
}

function accountTypeLabel(t: string): string {
  switch (t) {
    case 'cash': return 'Cash';
    case 'bank': return 'Bank Account';
    case 'mobile_wallet': return 'Mobile Wallet';
    case 'card': return 'Card';
    default: return 'Other';
  }
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

function Stat({ label, value, trend, tone }: { label: string; value: string; trend?: string; tone?: 'in' | 'out' }) {
  const color = tone === 'out' ? 'text-danger' : tone === 'in' ? 'text-primary' : 'text-ink';
  return (
    <div className="card">
      <div className="text-[11px] text-muted uppercase tracking-[0.08em] font-semibold">{label}</div>
      <div className={`text-[28px] font-bold mt-2.5 tracking-[-0.02em] tabular leading-none ${color}`}>{value}</div>
      {trend && <div className="text-xs text-muted mt-2">{trend}</div>}
    </div>
  );
}

function Bar({ pct, variant = 'primary' }: { pct: number; variant?: 'primary' | 'danger' }) {
  const fill =
    variant === 'danger'
      ? 'bg-danger'
      : 'bg-gradient-to-r from-primary to-accent';
  return (
    <div className="h-[10px] bg-surface-2 rounded-pill overflow-hidden">
      <div className={`h-full rounded-pill ${fill}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function SummaryMicro({
  label, amount, sub, tone,
}: { label: string; amount: number; sub: string; tone: 'primary' | 'danger' }) {
  const color = tone === 'danger' ? 'text-danger' : 'text-primary';
  return (
    <div>
      <div className="text-[11px] text-muted uppercase tracking-[0.08em] font-semibold">{label}</div>
      <div className={`text-[22px] font-bold mt-1.5 tabular tracking-[-0.015em] leading-none ${color}`}>
        {fmtBDT(amount)}
      </div>
      <div className="text-xs text-muted mt-1.5">{sub}</div>
    </div>
  );
}

function AcctRow({ icon, name, type, balance }: { icon: React.ReactNode; name: string; type: string; balance: number }) {
  return (
    <div className="flex justify-between items-center py-3 border-b border-border last:border-0">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-[10px] bg-surface-2 grid place-items-center text-primary font-bold text-[13px]">
          {icon}
        </div>
        <div>
          <div className="font-semibold text-[14px] leading-tight tracking-tight">{name}</div>
          <div className="text-xs text-muted leading-tight mt-1">{type}</div>
        </div>
      </div>
      <div className="font-bold tabular text-[14px]">{fmtBDT(balance)}</div>
    </div>
  );
}

function AccountIcon({ name }: { name: string }) {
  const ch = (name.trim()[0] || '\u09F3').toUpperCase();
  return <span>{ch}</span>;
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
  const amtColor =
    direction === 'in'   ? 'text-primary'  // income → green
    : direction === 'out' ? 'text-danger'   // expense → red
    :                       'text-ink';      // transfer → neutral
  return (
    <div className="flex justify-between items-center py-3.5 border-b border-border last:border-0">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-[10px] grid place-items-center font-bold ${accent}`}>
          {direction === 'in' ? '\u2191' : direction === 'out' ? '\u2193' : '\u21C4'}
        </div>
        <div>
          <div className="font-semibold text-[14px] leading-tight tracking-tight">{tx.note || cat?.name || tx.type}</div>
          <div className="text-xs text-muted leading-tight mt-1">
            {fmtRelative(tx.date)} {acc ? `· ${acc.name}` : ''} {tx.linkedDebtId ? '· debt' : ''} {tx.linkedInvestmentId ? '· investment payout' : ''}
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
          Start using Finora \u2192
        </button>
      </span>
      <button
        type="button"
        onClick={() => setShow(false)}
        aria-label="Dismiss banner"
        className="ml-auto w-7 h-7 inline-flex items-center justify-center rounded-md text-muted hover:bg-surface-3 hover:text-ink transition"
      >
        {'\u2715'}
      </button>
    </div>
  );
}