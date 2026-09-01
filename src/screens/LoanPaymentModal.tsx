/**
 * LoanPaymentModal — quick payment entry for a loan-kind debt (V1.1).
 *
 * Lives inline within the Debts list card (right zone of DebtCard).
 * Pre-fills the amount with the standard EMI from `loanEMI` when the
 * debt carries a `termMonths` value; otherwise leaves it empty for the
 * user to type whatever they paid. Saves a single expense (i_owe) or
 * income (owed_to_me) transaction tagged with `linkedDebtId`, then
 * fires a toast showing the actual interest/principal split computed
 * by `loanPaymentSplit`.
 *
 * The split is computed here at submit time and *derived* (not stored)
 * — the underlying ledger entry is just one transaction for the gross
 * amount. `outstandingFor()` walks the same transaction history on
 * every read, so the card's "Outstanding" figure stays in sync.
 */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../domain/store';
import * as transactions from '../domain/transactions';
import { loanEMI, loanPaymentSplit } from '../domain/math';
import { fmtBDT } from '../lib/format';
import { Button } from '../components/Button';
import { Field, Input, Select } from '../components/Field';
import { isPositiveMoney, POSITIVE_MONEY_ERROR } from '../lib/validation';
import type { Debt, TxType } from '../domain/types';

interface Props {
  debt: Debt;
  /** Outstanding at the moment the modal opens — used to compute the
   *  "this payment didn't cover this month's interest" warning when
   *  the user pays less than one month of interest. */
  outstandingAtOpen: number;
  onClose: () => void;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

export function LoanPaymentModal({ debt, outstandingAtOpen, onClose }: Props) {
  const state = useStore(s => s.state);
  const update = useStore(s => s.update);
  const showToast = useStore(s => s.showToast);
  const showBanner = useStore(s => s.showBanner);

  const txType: TxType = debt.direction === 'i_owe' ? 'expense' : 'income';
  const rate = Number(debt.interestRate) || 0;

  // Pre-fill amount from the standard EMI if the loan has a term.
  // `Math.round` keeps the input tidy — UI is integer taka.
  const emi = debt.termMonths && debt.termMonths > 0
    ? Math.round(loanEMI(Number(debt.total) || 0, rate, debt.termMonths))
    : 0;
  const [amount, setAmount] = useState(emi > 0 ? String(emi) : '');
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');

  // Default account: most recent transaction linked to this debt;
  // fall back to the user's first account.
  const lastAccountId = state.transactions
    .filter(t => t.linkedDebtId === debt.id)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))[0]?.accountId;
  const defaultAccountId =
    lastAccountId && state.accounts.some(a => a.id === lastAccountId)
      ? lastAccountId
      : state.accounts[0]?.id ?? '';
  const [accountId, setAccountId] = useState(defaultAccountId);

  // Live split preview — lets the user see the split before saving.
  const amt = Number(amount) || 0;
  const preview = amt > 0
    ? loanPaymentSplit(outstandingAtOpen, amt, rate)
    : { interest: 0, principal: 0 };
  const underpayment = preview.interest > 0 && preview.principal === 0 && amt > 0;

  // Escape-to-close + focus the amount field on open.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (state.accounts.length === 0) {
    // Modal is unusable without an account to debit/credit. Render a
    // minimal notice so the user isn't left staring at a dead form.
    return createPortal(
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
      >
        <button
          type="button"
          aria-label="Close dialog"
          onClick={onClose}
          className="absolute inset-0 cursor-default"
          style={{
            background: 'var(--overlay)',
            backdropFilter: 'blur(8px)',
          }}
        />
        <div
          className="relative rounded-card w-[440px] max-w-full shadow-modal"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-modal), var(--card-inset)',
            padding: '28px',
          }}
        >
          <h3 className="heading h3-modal m-0 mb-3">Add an account first</h3>
          <p className="text-[13.5px] text-muted leading-relaxed mb-5">
            Payments need an account to debit or credit. Add an account in Settings → Accounts, then come back to record this payment.
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="primary" onClick={onClose}>Got it</Button>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  const amountInvalid = !isPositiveMoney(amount);
  const canSave = !amountInvalid && accountId !== '';

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (amountInvalid) {
      showBanner({ kind: 'error', what: 'Amount must be greater than zero', why: POSITIVE_MONEY_ERROR, fix: 'Enter a positive number.' });
      return;
    }
    if (!accountId) {
      showBanner({ kind: 'error', what: 'Pick an account', why: 'A payment has to land somewhere.', fix: 'Choose the account this payment came from / went to.' });
      return;
    }
    try {
      const beforeOutstanding = outstandingAtOpen;
      const split = loanPaymentSplit(beforeOutstanding, Number(amount), rate);
      update(s => transactions.add(s, {
        type: txType,
        amount: Number(amount),
        date,
        accountId,
        linkedDebtId: debt.id,
        note: note.trim() || undefined,
      }));
      const verb = txType === 'expense' ? 'paid' : 'received';
      const extraNote = underpayment
        ? ` — underpayment: this didn't cover the month's interest.`
        : '';
      showToast({
        kind: 'success',
        what: `Payment ${verb} — ${fmtBDT(split.interest)} interest, ${fmtBDT(split.principal)} principal`,
        why: `Outstanding reduced from ${fmtBDT(beforeOutstanding)} to ${fmtBDT(Math.max(0, beforeOutstanding - split.principal))}.${extraNote}`,
      });
      onClose();
    } catch (err) {
      showBanner({
        kind: 'error',
        what: 'Could not record payment',
        why: (err as Error).message,
        fix: 'Try again.',
      });
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="loan-pay-title"
    >
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
        style={{
          background: 'var(--overlay)',
          backdropFilter: 'blur(8px)',
          animation: 'backdrop-fade-in 180ms ease-out both',
        }}
      />
      <form
        onSubmit={onSubmit}
        className="relative rounded-card w-[440px] max-w-full shadow-modal"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-modal), var(--card-inset)',
          padding: '28px',
          animation: 'modal-pop-in 180ms ease-out both',
        }}
      >
        <h3 id="loan-pay-title" className="heading h3-modal m-0 mb-1.5">
          Pay toward "{debt.name}"
        </h3>
        <div className="text-[12.5px] text-muted leading-relaxed mb-5">
          Outstanding: <span className="tabular font-semibold text-ink">{fmtBDT(outstandingAtOpen)}</span>
          {' · '}Rate: <span className="tabular font-semibold text-ink">{rate}%</span>
        </div>

        <div className="flex flex-col gap-4">
          <Field
            label="Amount"
            hint={emi > 0 ? `Pre-filled with the standard EMI for ${debt.termMonths}-month term. Adjust if you paid a different amount.` : 'Enter whatever you paid.'}
            error={amountInvalid ? POSITIVE_MONEY_ERROR : undefined}
          >
            <Input
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              autoFocus
              aria-invalid={amountInvalid || undefined}
              className={amountInvalid ? 'border-danger focus:border-danger focus:ring-danger/30' : ''}
            />
          </Field>
          <Field label="Date">
            <Input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </Field>
          <Field label={txType === 'expense' ? 'Paid from' : 'Received into'}>
            <Select value={accountId} onChange={e => setAccountId(e.target.value)}>
              {state.accounts.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Note (optional)">
            <Input
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="e.g. September EMI"
            />
          </Field>

          {/* Live split preview — the user can see exactly where their
              money goes before confirming. */}
          {amt > 0 && (
            <div
              className="rounded-btn px-3.5 py-3 text-[12.5px] leading-relaxed"
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
              }}
            >
              <div className="text-muted mb-1">This payment will be split as:</div>
              <div className="tabular text-ink font-semibold">
                <span className="text-danger">{fmtBDT(preview.interest)}</span> interest
                {' · '}
                <span className="text-primary">{fmtBDT(preview.principal)}</span> principal
              </div>
              {underpayment && (
                <div
                  className="mt-2 text-[12px] leading-relaxed rounded-pill px-2 py-1 inline-block"
                  style={{
                    background: 'var(--warn-soft, rgba(234, 179, 8, 0.16))',
                    color: 'var(--warn)',
                  }}
                >
                  Underpayment — this didn't cover the month's interest.
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2.5 justify-end mt-6">
          <Button variant="outlined-ghost" type="button" onClick={onClose}>Cancel</Button>
          <Button variant="outlined-primary" type="submit" disabled={!canSave}>
            Record payment
          </Button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
