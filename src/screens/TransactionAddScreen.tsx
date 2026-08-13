import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../domain/store';
import * as accounts from '../domain/accounts';
import * as transactions from '../domain/transactions';
import * as debts from '../domain/debts';
import * as investments from '../domain/investments';
import { Button } from '../components/Button';
import { Field, Input, Select, Textarea } from '../components/Field';
import type { TxType } from '../domain/types';

export function TransactionAddScreen() {
  const navigate = useNavigate();
  const update = useStore(s => s.update);
  const showBanner = useStore(s => s.showBanner);
  const state = useStore(s => s.state);

  const accs = accounts.list(state);
  const activeDebts = debts.list(state).filter(d => d.status === 'active');
  const activeInvs = investments.list(state).filter(i => i.status === 'active' || i.status === 'matured');

  const [type, setType] = useState<TxType>('expense');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [accountId, setAccountId] = useState(accs[0]?.id ?? '');
  const [fromAccountId, setFromAccountId] = useState(accs[0]?.id ?? '');
  const [toAccountId, setToAccountId] = useState(accs[1]?.id ?? accs[0]?.id ?? '');
  const [linkedDebtId, setLinkedDebtId] = useState('');
  const [linkedInvestmentId, setLinkedInvestmentId] = useState('');
  const [note, setNote] = useState('');

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!(Number(amount) > 0)) {
      showBanner({ what: 'Amount must be greater than zero', why: 'Zero or negative amounts produce empty transactions.', fix: 'Enter a positive number, e.g. 1500.' });
      return;
    }
    try {
      update(s => transactions.add(s, {
        type, amount: Number(amount), date,
        accountId: type !== 'transfer' ? accountId : undefined,
        fromAccountId: type === 'transfer' ? fromAccountId : undefined,
        toAccountId: type === 'transfer' ? toAccountId : undefined,
        linkedDebtId: linkedDebtId || undefined,
        linkedInvestmentId: linkedInvestmentId || undefined,
        note,
      }));
      navigate('/transactions');
    } catch (err) {
      showBanner({ what: 'Could not add transaction', why: (err as Error).message, fix: 'Check the form values and try again.' });
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6 max-w-md">
      <h1 className="text-2xl font-semibold">Add transaction</h1>

      <Field label="Type">
        <Select value={type} onChange={e => setType(e.target.value as TxType)}>
          <option value="expense">Expense</option>
          <option value="income">Income</option>
          <option value="transfer">Transfer</option>
        </Select>
      </Field>

      <Field label="Amount">
        <Input type="number" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="1500" autoFocus />
      </Field>

      <Field label="Date">
        <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
      </Field>

      {type === 'transfer' ? (
        <>
          <Field label="From">
            <Select value={fromAccountId} onChange={e => setFromAccountId(e.target.value)}>
              {accs.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </Field>
          <Field label="To">
            <Select value={toAccountId} onChange={e => setToAccountId(e.target.value)}>
              {accs.filter(a => a.id !== fromAccountId).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </Field>
        </>
      ) : (
        <Field label="Account">
          <Select value={accountId} onChange={e => setAccountId(e.target.value)}>
            {accs.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        </Field>
      )}

      {activeDebts.length > 0 && type !== 'transfer' && (
        <Field label="Linked debt (optional)" hint="Tag this transaction as a payment toward a debt.">
          <Select value={linkedDebtId} onChange={e => setLinkedDebtId(e.target.value)}>
            <option value="">— None —</option>
            {activeDebts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
        </Field>
      )}

      {activeInvs.length > 0 && type === 'income' && (
        <Field label="Linked investment (optional)" hint="Tag this income as a payout from an investment.">
          <Select value={linkedInvestmentId} onChange={e => setLinkedInvestmentId(e.target.value)}>
            <option value="">— None —</option>
            {activeInvs.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
          </Select>
        </Field>
      )}

      <Field label="Note (optional)">
        <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Lunch, salary, bKash topup…" />
      </Field>

      <div className="flex gap-2">
        <Button variant="primary" type="submit">Save transaction</Button>
        <Button variant="ghost" onClick={() => navigate('/transactions')}>Cancel</Button>
      </div>
    </form>
  );
}