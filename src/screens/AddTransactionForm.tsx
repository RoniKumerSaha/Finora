/**
 * AddTransactionForm — shared body for the three per-type add screens
 * (AddExpenseScreen / AddIncomeScreen / AddTransferScreen).
 *
 * Visual target: docs/ux-designs/.../mockups/v1/index.html#add-expense
 *   - .card max-width 560px, padding 24px (rounded-card)
 *   - label micro-uppercase 12px tracked muted
 *   - big primary amount field (32px, primary text, r-btn)
 *   - 5-col category emoji grid (expense / income only)
 *   - 1fr 1fr grid for Account + Date
 *   - action row: right-aligned Cancel + Save primary buttons
 *
 * Behavior:
 *   - amount stored as string so the input is fully editable
 *   - "Save" submits via transactions.add and navigates to /transactions
 *   - validation errors come back as a banner (no inline three-part
 *     here — that lives in lib/errors.ts if you want it)
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../domain/store';
import * as accounts from '../domain/accounts';
import * as transactions from '../domain/transactions';
import { Button } from '../components/Button';
import { Field, Input, Select, Textarea, AmountInput } from '../components/Field';
import { CategoryGrid, PresetChips } from '../components/TypePicker';
import type { TxType } from '../domain/types';

interface AddTransactionFormProps {
  type: TxType;
  title: string;
  subtitle: string;
}

export function AddTransactionForm({ type, title, subtitle }: AddTransactionFormProps) {
  const navigate = useNavigate();
  const update = useStore(s => s.update);
  const showBanner = useStore(s => s.showBanner);
  const state = useStore(s => s.state);
  const accs = accounts.list(state);
  const cats = state.categories.filter(c => c.type === type);

  const today = new Date().toISOString().slice(0, 10);

  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today);
  const [accountId, setAccountId] = useState(accs[0]?.id ?? '');
  const [fromAccountId, setFromAccountId] = useState(accs[0]?.id ?? '');
  const [toAccountId, setToAccountId] = useState(accs[1]?.id ?? accs[0]?.id ?? '');
  const [categoryId, setCategoryId] = useState(cats[0]?.id ?? '');
  const [linkedDebtId, setLinkedDebtId] = useState('');
  const [linkedInvestmentId, setLinkedInvestmentId] = useState('');
  const [note, setNote] = useState('');

  const activeDebts = type !== 'transfer'
    ? debtsForCurrentType(state, type)
    : [];

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!(Number(amount) > 0)) {
      showBanner({
        what: 'Amount must be greater than zero',
        why: 'Zero or negative amounts produce empty transactions.',
        fix: 'Enter a positive number, e.g. 1500.',
      });
      return;
    }
    try {
      update(s => transactions.add(s, {
        type,
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
        what: 'Could not add transaction',
        why: (err as Error).message,
        fix: 'Check the form values and try again.',
      });
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6 max-w-[560px]">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight leading-none mb-1">{title}</h1>
        <div className="text-muted text-[13px]">{subtitle}</div>
      </div>

      <section className="bg-surface border border-border rounded-card p-6 shadow-card">
        <Field label="Amount">
          <AmountInput
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder={type === 'transfer' ? '5,000' : type === 'expense' ? '250' : '60,000'}
            autoFocus
          />
          {type === 'expense' && (
            <>
              <div className="text-xs text-muted mt-1">Tap a preset chip to autofill common amounts.</div>
              <PresetChips
                amounts={[50, 100, 250, 500, 1000]}
                onPick={n => setAmount(String(n))}
              />
            </>
          )}
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
          <div className="mt-5 grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
            <Field label="From">
              <Select value={fromAccountId} onChange={e => setFromAccountId(e.target.value)}>
                {accs.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
              <div className="text-xs text-muted mt-1.5">
                Balance: {fmtAccountBalance(fromAccountId, state)}
              </div>
            </Field>
            <div className="text-[24px] text-accent text-center pt-6">{'⇄'}</div>
            <Field label="To">
              <Select value={toAccountId} onChange={e => setToAccountId(e.target.value)}>
                {accs.filter(a => a.id !== fromAccountId).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
              <div className="text-xs text-muted mt-1.5">
                Balance: {fmtAccountBalance(toAccountId, state)}
              </div>
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

        {type !== 'transfer' && (
          <div className="mt-5">
            <Field label="Note (optional)">
              <Textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder={type === 'expense' ? 'Lunch with team' : type === 'income' ? 'September salary' : ''}
              />
            </Field>
          </div>
        )}

        {type === 'expense' && activeDebts.length > 0 && (
          <div className="mt-5">
            <Field label="Linked debt (optional)" hint="Tag this transaction as a payment toward a debt.">
              <Select value={linkedDebtId} onChange={e => setLinkedDebtId(e.target.value)}>
                <option value="">— None —</option>
                {activeDebts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
            </Field>
          </div>
        )}

        {type === 'income' && state.investments.filter(i => i.status !== 'closed').length > 0 && (
          <div className="mt-5">
            <Field label="Linked investment (optional)" hint="Tag this income as a payout from an investment.">
              <Select value={linkedInvestmentId} onChange={e => setLinkedInvestmentId(e.target.value)}>
                <option value="">— None —</option>
                {state.investments
                  .filter(i => i.status !== 'closed')
                  .map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </Select>
            </Field>
          </div>
        )}

        <div className="flex justify-end gap-2.5 mt-6">
          <Button variant="secondary" type="button" onClick={() => navigate('/transactions/new')}>Cancel</Button>
          <Button variant="primary" type="submit">Save</Button>
        </div>
      </section>
    </form>
  );
}

/* ---------- helpers ---------- */

import * as debts from '../domain/debts';
import { accountBalance } from '../domain/math';
import { fmtBDT } from '../lib/format';
import type { State } from '../domain/types';

function debtsForCurrentType(state: State, _type: TxType) {
  return debts.list(state).filter(d => d.status === 'active');
}

function fmtAccountBalance(accountId: string, state: State): string {
  const a = state.accounts.find(x => x.id === accountId);
  if (!a) return '—';
  return fmtBDT(accountBalance(a, state.transactions));
}
