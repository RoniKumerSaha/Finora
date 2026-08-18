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
 *
 * 2026-08-14 polish: header + .card section, Fraunces title.
 */
import { useEffect, useState } from 'react';
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
import { isPositiveMoney, POSITIVE_MONEY_ERROR } from '../lib/validation';
import type { TxType } from '../domain/types';

export function TransactionEditScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const state = useStore(s => s.state);
  const update = useStore(s => s.update);
  const showBanner = useStore(s => s.showBanner);
  const showToast = useStore(s => s.showToast);
  const { confirm, dialog } = useConfirm();

  const tx = id ? transactions.get(state, id) : undefined;
  if (!tx) {
    return (
      <div>
        <h1 className="heading h1-screen">Transaction not found</h1>
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
  // One-shot confirm-state for the Save button. Pulse + ✓ glyph render
  // for the 600ms window before navigate.
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (saved) setSaved(false);
  }, [amount, accountId, fromAccountId, toAccountId, categoryId, date, note, linkedDebtId, linkedInvestmentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const type: TxType = tx.type;

  const linkedInv = type === 'income' && linkedInvestmentId
    ? state.investments.find(i => i.id === linkedInvestmentId)
    : undefined;
  useEffect(() => {
    if (type !== 'income' || !linkedInv?.payoutAccountId) return;
    if (accountId !== linkedInv.payoutAccountId) {
      setAccountId(linkedInv.payoutAccountId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedInvestmentId, type]);

  const payoutMismatch = !!(
    type === 'income'
    && linkedInv?.payoutAccountId
    && accountId !== linkedInv.payoutAccountId
  );
  const payoutAccName = linkedInv?.payoutAccountId
    ? state.accounts.find(a => a.id === linkedInv.payoutAccountId)?.name
    : undefined;
  const selectedAccName = state.accounts.find(a => a.id === accountId)?.name;

  // Inline negative-amount guard (spine: ux-finora-2026-08-14-negative-guard).
  const amountInvalid = !isPositiveMoney(amount);
  const amountErrorClass = amountInvalid
    ? 'border-danger focus:border-danger focus:ring-danger/30'
    : '';

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!(Number(amount) > 0)) {
      showBanner({
        kind: 'error',
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
      showToast({
        kind: 'success',
        what: 'Transaction saved',
        why: 'Your changes are now in your records.',
      });
      setSaved(true);
      window.setTimeout(() => navigate('/transactions'), 600);
    } catch (err) {
      showBanner({
        kind: 'error',
        what: 'Could not save transaction',
        why: (err as Error).message,
        fix: 'Check the form values and try again.',
      });
    }
  }

  async function onDelete() {
    const ok = await confirm({
      title: 'Delete this entry?',
      body: 'This permanently removes this transaction from your records. This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      update(s => transactions.remove(s, tx!.id));
      showBanner({
        kind: 'success',
        what: 'Transaction deleted',
        why: 'The entry is gone from your records.',
        fix: 'Open Transactions to see the updated list.',
      });
      navigate('/transactions');
    } catch (err) {
      showBanner({
        kind: 'error',
        what: 'Could not delete',
        why: (err as Error).message,
        fix: 'Try again.',
      });
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6 max-w-[560px]">
      <header>
        <h1 className="heading h1-screen">Edit transaction</h1>
        <div className="text-muted text-[13px] mt-1.5 capitalize tabular">
          {type}{note ? ` · ${note}` : ''} · {fmtDateShort(date)}
        </div>
      </header>

      <section className="card">
        <Field label="Amount" error={amountInvalid ? POSITIVE_MONEY_ERROR : undefined}>
          <AmountInput
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            autoFocus
            aria-invalid={amountInvalid || undefined}
            className={amountErrorClass}
          />
        </Field>

        {type !== 'transfer' && cats.length > 0 && (
          <div className="mt-5">
            <Field label="Category">
              <CategoryGrid
                categories={cats}
                selectedId={categoryId}
                onPick={setCategoryId}
                variant={type === 'expense' ? 'grouped' : 'flat'}
              />
            </Field>
          </div>
        )}

        {type === 'transfer' ? (
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
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

        {type === 'income' && payoutMismatch && (
          <div
            className="mt-4 text-[13px] rounded-btn px-3.5 py-2.5"
            style={{
              background: 'var(--warn-soft)',
              border: '1px solid var(--warn)',
              boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--warn) 30%, transparent)',
              color: 'var(--ink)',
            }}
          >
            <strong style={{ color: 'var(--warn)' }}>Heads up:</strong> payout account for{' '}
            <span className="font-semibold">{linkedInv?.name}</span> is{' '}
            <span className="font-semibold">{payoutAccName}</span>. You're sending this income to{' '}
            <span className="font-semibold">{selectedAccName}</span>.
          </div>
        )}

        <div className="mt-5">
          <Field label="Note" hint="Add or change a note. Leave blank to remove.">
            <Textarea value={note} onChange={e => setNote(e.target.value)} />
          </Field>
        </div>

        {type === 'expense' && activeDebts.length > 0 && (
          <div className="mt-5">
            <Field label="Linked debt (optional)" hint="Link if this entry is a payment toward that debt.">
              <Select value={linkedDebtId} onChange={e => {
                setLinkedDebtId(e.target.value);
                if (e.target.value) setLinkedInvestmentId('');
              }}>
                <option value="">— None —</option>
                {activeDebts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
            </Field>
          </div>
        )}

        {type === 'income' && state.investments.filter(i => i.status !== 'closed').length > 0 && (
          <div className="mt-5">
            <Field label="Linked investment (optional)" hint="Link if this income is a payout from that investment.">
              <Select value={linkedInvestmentId} onChange={e => {
                setLinkedInvestmentId(e.target.value);
                if (e.target.value) setLinkedDebtId('');
              }}>
                <option value="">— None —</option>
                {state.investments
                  .filter(i => i.status !== 'closed')
                  .map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </Select>
            </Field>
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-between sm:items-center gap-2 sm:gap-2.5 mt-6">
          <Button variant="danger" type="button" onClick={onDelete} className="w-full sm:w-auto">
            {'\u{1F5D1}'} Delete
          </Button>
          <div className="flex gap-2.5">
            <Button variant="secondary" type="button" onClick={() => navigate('/transactions')} className="flex-1 sm:flex-none">Cancel</Button>
            <Button variant="primary" type="submit" disabled={amountInvalid} className="flex-1 sm:flex-none" success={saved}>Save</Button>
          </div>
        </div>
      </section>
      {dialog}
    </form>
  );
}