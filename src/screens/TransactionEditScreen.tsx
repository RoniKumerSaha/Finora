/**
 * TransactionEditScreen — edit an existing transaction.
 *
 * v1 visual target: #edit-tx in the mockup — same form shape as
 * add-expense but pre-populated, with a red Delete button on the
 * left of the action row.
 *
 * Routes:
 *   /transactions/:id/edit  → loads transaction by id
 *
 * Delete uses the existing ConfirmDialog flow; on success navigates
 * back to /transactions.
 */
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../domain/store';
import * as accounts from '../domain/accounts';
import * as transactions from '../domain/transactions';
import * as debts from '../domain/debts';
import { Button } from '../components/Button';
import { Field, Input, Select, Textarea, AmountInput } from '../components/Field';
import { CategoryGrid } from '../components/TypePicker';
import { useConfirm } from '../components/ConfirmDialog';
import { fmtDateShort } from '../lib/format';
import type { TxType } from '../domain/types';

export function TransactionEditScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const state = useStore(s => s.state);
  const update = useStore(s => s.update);
  const showBanner = useStore(s => s.showBanner);
  const { confirm, dialog } = useConfirm();

  const tx = id ? transactions.get(state, id) : undefined;
  if (!tx) {
    return (
      <div>
        <h1 className="text-[22px] font-bold tracking-tight">Transaction not found</h1>
        <Button className="mt-4" onClick={() => navigate('/transactions')}>Back to transactions</Button>
      </div>
    );
  }

  const accs = accounts.list(state);
  const cats = state.categories.filter(c => c.type === tx.type);
  const activeDebts = debts.list(state).filter(d => d.status === 'active');

  const [amount, setAmount] = useState(String(tx.amount));
  const [date, setDate] = useState(tx.date);
  const [accountId, setAccountId] = useState(tx.accountId ?? accs[0]?.id ?? '');
  const [fromAccountId, setFromAccountId] = useState(tx.fromAccountId ?? accs[0]?.id ?? '');
  const [toAccountId, setToAccountId] = useState(tx.toAccountId ?? accs[1]?.id ?? accs[0]?.id ?? '');
  const [categoryId, setCategoryId] = useState(tx.categoryId ?? '');
  const [linkedDebtId, setLinkedDebtId] = useState(tx.linkedDebtId ?? '');
  const [linkedInvestmentId, setLinkedInvestmentId] = useState(tx.linkedInvestmentId ?? '');
  const [note, setNote] = useState(tx.note ?? '');

  const type: TxType = tx.type;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!(Number(amount) > 0)) {
      showBanner({
        what: 'Amount must be greater than zero',
        why: 'Zero or negative amounts produce empty transactions.',
        fix: 'Enter a positive number.',
      });
      return;
    }
    try {
      update(s => transactions.update(s, tx!.id, {
        amount: Number(amount),
        date,
        categoryId: categoryId || undefined,
        accountId: type !== 'transfer' ? accountId : undefined,
        fromAccountId: type === 'transfer' ? fromAccountId : undefined,
        toAccountId: type === 'transfer' ? toAccountId : undefined,
        linkedDebtId: linkedDebtId || undefined,
        linkedInvestmentId: linkedInvestmentId || undefined,
        note,
      }));
      navigate('/transactions');
    } catch (err) {
      showBanner({
        what: 'Could not save transaction',
        why: (err as Error).message,
        fix: 'Check the form values and try again.',
      });
    }
  }

  async function onDelete() {
    const ok = await confirm({
      title: 'Delete this entry?',
      body: `This permanently removes this transaction from your records. This cannot be undone.`,
      dangerText: 'This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      update(s => transactions.remove(s, tx!.id));
      navigate('/transactions');
    } catch (err) {
      showBanner({
        what: 'Could not delete',
        why: (err as Error).message,
        fix: 'Try again.',
      });
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6 max-w-[560px]">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight leading-none mb-1">Edit transaction</h1>
        <div className="text-muted text-[13px]">
          {type.charAt(0).toUpperCase() + type.slice(1)} {note ? `· ${note}` : ''} {`· ${fmtDateShort(date)}`}
        </div>
      </div>

      <section className="bg-surface border border-border rounded-card p-6 shadow-card">
        <Field label="Amount">
          <AmountInput
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            autoFocus
          />
        </Field>

        {type !== 'transfer' && cats.length > 0 && (
          <div className="mt-5">
            <Field label="Category">
              <CategoryGrid
                categories={cats}
                selectedId={categoryId}
                onPick={setCategoryId}
              />
            </Field>
          </div>
        )}

        {type === 'transfer' ? (
          <div className="mt-5 grid grid-cols-2 gap-3">
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
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Field label="Account">
              <Select value={accountId} onChange={e => setAccountId(e.target.value)}>
                {accs.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </Field>
            <Field label="Date">
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </Field>
          </div>
        )}

        <div className="mt-5">
          <Field label="Note">
            <Textarea value={note} onChange={e => setNote(e.target.value)} />
          </Field>
        </div>

        {type === 'expense' && activeDebts.length > 0 && (
          <div className="mt-5">
            <Field label="Linked debt (optional)">
              <Select value={linkedDebtId} onChange={e => setLinkedDebtId(e.target.value)}>
                <option value="">— None —</option>
                {activeDebts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
            </Field>
          </div>
        )}

        {type === 'income' && state.investments.filter(i => i.status !== 'closed').length > 0 && (
          <div className="mt-5">
            <Field label="Linked investment (optional)">
              <Select value={linkedInvestmentId} onChange={e => setLinkedInvestmentId(e.target.value)}>
                <option value="">— None —</option>
                {state.investments
                  .filter(i => i.status !== 'closed')
                  .map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </Select>
            </Field>
          </div>
        )}

        <div className="flex justify-between items-center mt-6">
          <Button variant="danger" type="button" onClick={onDelete}>
            {'\u{1F5D1}'} Delete
          </Button>
          <div className="flex gap-2.5">
            <Button variant="secondary" type="button" onClick={() => navigate('/transactions')}>Cancel</Button>
            <Button variant="primary" type="submit">Save</Button>
          </div>
        </div>
      </section>
      {dialog}
    </form>
  );
}
