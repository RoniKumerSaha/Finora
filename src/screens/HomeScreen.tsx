import { useStore } from '../domain/store';
import { monthlyIncome, monthlyExpenses, accountBalance } from '../domain/math';
import * as accounts from '../domain/accounts';
import * as debts from '../domain/debts';
import * as investments from '../domain/investments';
import * as goals from '../domain/goals';

export function HomeScreen() {
  const state = useStore(s => s.state);

  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + 1;

  const txs = state.transactions;
  const accList = accounts.list(state);
  const totalBalance = accList.reduce((sum, a) => sum + accountBalance(a, txs), 0);

  const income = monthlyIncome(txs, y, m);
  const expenses = monthlyExpenses(txs, y, m);

  const activeDebts = debts.list(state).filter(d => d.status === 'active');
  const iOwe = activeDebts.filter(d => d.direction === 'i_owe')
    .reduce((s, d) => s + (Number(d.total) || 0) - (d.paidSoFar || 0), 0);
  const owedToMe = activeDebts.filter(d => d.direction === 'owed_to_me')
    .reduce((s, d) => s + (d.paidSoFar || 0), 0);

  const activeInvs = investments.list(state).filter(i => i.status === 'active' || i.status === 'matured');
  const totalInvested = activeInvs.reduce((s, i) => s + (Number(i.principal) || 0), 0);

  const activeGoals = goals.list(state);
  const goalsSaved = activeGoals.reduce((s, g) => s + (Number(g.saved) || 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Home</h1>

      <Stat label="Total balance"  value={fmtBDT(totalBalance)} />
      <Row>
        <Stat label="Monthly income"  value={fmtBDT(income)} tone="primary" />
        <Stat label="Monthly expenses" value={fmtBDT(expenses)} tone="danger" />
      </Row>
      <Row>
        <Stat label="I owe"      value={fmtBDT(iOwe)}     tone="danger"  />
        <Stat label="Owed to me" value={fmtBDT(owedToMe)} tone="primary" />
      </Row>
      <Stat label="Total invested" value={fmtBDT(totalInvested)} />
      <Stat label="Goals saved"    value={fmtBDT(goalsSaved)} />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'primary' | 'danger' }) {
  const color = tone === 'primary' ? 'text-primary' : tone === 'danger' ? 'text-danger' : 'text-ink';
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="text-xs text-muted uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${color}`}>{value}</div>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-4">{children}</div>;
}

function fmtBDT(n: number) {
  return '৳' + (Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}