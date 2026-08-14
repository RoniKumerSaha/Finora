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
 *
 * Linked-investment payout prefill (income only):
 *   When the user picks a `linkedInvestmentId`, auto-sync the Account
 *   field to the investment's payoutAccountId. If the user subsequently
 *   changes Account away from the payout destination, we show a soft
 *   warning ('Payout account for this investment is X. You're sending
 *   to Y.') but don't block the save — the user knows best.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  const [searchParams] = useSearchParams();
  const update = useStore(s => s.update);
  const showBanner = useStore(s => s.showBanner);
  const state = useStore(s => s.state);
  const accs = accounts.list(state);
  const cats = state.categories.filter(c => c.type === type);

  const today = new Date().toISOString().slice(0, 10);

  // Prefill from URL search params (used by deep-link flows like DPS
  // "Record maturity payout" which lands here with amount/account/note
  // already set).
  const prefillAmount = searchParams.get('amount') ?? '';
  const prefillDate = searchParams.get('date') ?? today;
  const prefillAccountId = searchParams.get('accountId') ?? '';
  const prefillLinkedInvestmentId = searchParams.get('linkedInvestmentId') ?? '';
  const prefillNote = searchParams.get('note') ?? '';

  const [amount, setAmount] = useState(prefillAmount);
  const [date, setDate] = useState(prefillDate || today);
  const [accountId, setAccountId] = useState(prefillAccountId || accs[0]?.id || '');
  const [fromAccountId, setFromAccountId] = useState(accs[0]?.id ?? '');
  const [toAccountId, setToAccountId] = useState(accs[1]?.id ?? accs[0]?.id ?? '');
  const [categoryId, setCategoryId] = useState(cats[0]?.id ?? '');
  const [linkedDebtId, setLinkedDebtId] = useState('');
  const [linkedInvestmentId, setLinkedInvestmentId] = useState(prefillLinkedInvestmentId);
  const [note, setNote] = useState(prefillNote);

  // When the user picks a From account that matches the current To
  // account, the To dropdown would be left holding an id that's no
  // longer in its options — the browser would render the first option
  // but `toAccountId` would still equal `fromAccountId`, producing a
  // transfer from X to X. Fix: re-pick To as the first account that
  // isn't the new From. The reverse case (To set equal to From) is
  // prevented by the To dropdown's filter, which omits the From.
  useEffect(() => {
    if (type !== 'transfer') return;
    if (fromAccountId && toAccountId === fromAccountId) {
      const next = accs.find(a => a.id !== fromAccountId);
      if (next) setToAccountId(next.id);
    }
  }, [fromAccountId, type, accs]);

  // Whenever the user picks a To account that matches From, nudge From
  // to a different account. The To dropdown already filters From out,
  // so this only fires if state was set programmatically or via back-
  // navigation. Symmetric to the previous effect.
  useEffect(() => {
    if (type !== 'transfer') return;
    if (toAccountId && fromAccountId === toAccountId) {
      const next = accs.find(a => a.id !== toAccountId);
      if (next) setFromAccountId(next.id);
    }
  }, [toAccountId, type, accs]);

  const activeDebts = type !== 'transfer'
    ? debtsForCurrentType(state, type)
    : [];

  // Linked-investment payout prefill (income only): when the user picks a
  // linkedInvestmentId, mirror its payoutAccountId into accountId. Skip
  // if the investment has no payoutAccountId set.
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

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!(Number(amount) > 0)) {
      showBanner({
        kind: 'error',
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
      showBanner({
        kind: 'success',
        what: 'Transaction added',
        why: 'Your record is now in the transactions list.',
        fix: 'Open Transactions to see it, or Home to see the totals.',
      });
      navigate('/transactions');
    } catch (err) {
      showBanner({
        kind: 'error',
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
                {Number(amount) > 0 && (
                  <span className="text-ink/70">
                    {' '}→ after: {fmtBDT(accountBalance(accs.find(a => a.id === fromAccountId), state.transactions) - Number(amount))}
                  </span>
                )}
              </div>
            </Field>
            <div className="text-[24px] text-accent text-center pt-6">{'⇄'}</div>
            <Field label="To">
              <Select value={toAccountId} onChange={e => setToAccountId(e.target.value)}>
                {accs.filter(a => a.id !== fromAccountId).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
              <div className="text-xs text-muted mt-1.5">
                Balance: {fmtAccountBalance(toAccountId, state)}
                {Number(amount) > 0 && (
                  <span className="text-ink/70">
                    {' '}→ after: {fmtBDT(accountBalance(accs.find(a => a.id === toAccountId), state.transactions) + Number(amount))}
                  </span>
                )}
              </div>
            </Field>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Field label="Account">
              <Select value={accountId} onChange={e => setAccountId(e.target.value)}>
                {accs.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
              {accountId && (
                <div className="text-xs text-muted mt-1.5">
                  Balance: {fmtAccountBalance(accountId, state)}
                  {Number(amount) > 0 && (
                    <span className="text-ink/70">
                      {' '}→ after: {fmtBDT(afterBalance(accountId, Number(amount), type, state))}
                    </span>
                  )}
                </div>
              )}
            </Field>
            <Field label="Date">
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </Field>
          </div>
        )}

        {type === 'income' && payoutMismatch && (
          <div className="mt-4 text-[13px] text-warn bg-warn-soft border border-warn rounded-lg px-3 py-2">
            <strong>Heads up:</strong> payout account for <span className="font-semibold">{linkedInv?.name}</span> is{' '}
            <span className="font-semibold">{payoutAccName}</span>. You're sending this income to{' '}
            <span className="font-semibold">{selectedAccName}</span>. Saving will record the payout as Income to{' '}
            {selectedAccName}, not {payoutAccName}.
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

        {type === 'income' && activeDebts.filter(d => d.direction === 'owed_to_me').length > 0 && (
          <div className="mt-5">
            <Field label="Linked debt (optional)" hint="Tag this income as repayment of money someone owed you.">
              <Select value={linkedDebtId} onChange={e => setLinkedDebtId(e.target.value)}>
                <option value="">— None —</option>
                {activeDebts
                  .filter(d => d.direction === 'owed_to_me')
                  .map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
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

/**
 * Projected balance after the user saves the form. Income adds the
 * amount to the account; expense subtracts it. Uses the live state (not
 * the in-progress form state) so the number reflects "what the balance
 * will be once this transaction is recorded" rather than a double-count.
 */
function afterBalance(accountId: string, amount: number, type: TxType, state: State): number {
  const current = accountBalance(state.accounts.find(a => a.id === accountId), state.transactions);
  if (type === 'income') return current + amount;
  if (type === 'expense') return current - amount;
  return current;
}
