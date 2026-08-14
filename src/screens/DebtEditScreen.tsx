/**
 * DebtEditScreen — edit a debt's name, direction, total, person, dueDate.
 *
 * Modeled on AccountEditScreen. Loads the debt by :id, pre-fills the
 * form from the stored values. Saving calls debts.update; deleting uses
 * the modal confirm pattern from TransactionEditScreen.
 *
 * Note: paidSoFar is not editable here — it's derived from linked
 * transactions (R7). To change the paid amount, record an expense (for
 * i_owe) or income (for owed_to_me) tagged with linkedDebtId.
 *
 * When the debt is fully paid, we surface the most-recently-used
 * account's balance so the user can see what their accounts look like
 * after the debt was settled.
 */
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../domain/store';
import * as debts from '../domain/debts';
import { accountBalance, debtPaidSoFar } from '../domain/math';
import { fmtBDT } from '../lib/format';
import { Button } from '../components/Button';
import { Field, Input, Select } from '../components/Field';
import { useConfirm } from '../components/ConfirmDialog';
import { isPositiveMoney, POSITIVE_MONEY_ERROR } from '../lib/validation';
import type { DebtDirection } from '../domain/types';

export function DebtEditScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const state = useStore(s => s.state);
  const update = useStore(s => s.update);
  const showBanner = useStore(s => s.showBanner);
  const { confirm, dialog } = useConfirm();
  const debt = debts.get(state, id!);

  const [name, setName] = useState(debt?.name ?? '');
  const [direction, setDirection] = useState<DebtDirection>(debt?.direction ?? 'i_owe');
  const [total, setTotal] = useState(String(debt?.total ?? ''));
  const [person, setPerson] = useState(debt?.person ?? '');
  const [dueDate, setDueDate] = useState(debt?.dueDate ?? '');

  // Inline guard (spine: ux-finora-2026-08-14-negative-guard). Pre-populated
  // value is always valid; user can break it by typing a negative.
  const totalInvalid = !isPositiveMoney(total);
  const totalErrorClass = totalInvalid
    ? 'border-danger focus:border-danger focus:ring-danger/30'
    : '';

  if (!debt) {
    return (
      <div className="text-muted">
        Debt not found.{' '}
        <button className="underline" onClick={() => navigate('/debts')}>Back to debts</button>
      </div>
    );
  }

  const linkedTxCount = state.transactions.filter(
    t => t.linkedDebtId === debt.id
  ).length;

  // When fully paid, look up the most-recently-used account from the
  // linked transactions and show its current balance — gives the user
  // a quick read on what the account looks like post-settlement.
  const paidSoFar = debtPaidSoFar(debt, state.transactions);
  const isFullyPaid = paidSoFar >= (Number(debt.total) || 0);
  const latestAccount = isFullyPaid
    ? state.transactions
        .filter(t => t.linkedDebtId === debt.id)
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date))[0]
    : undefined;
  const relatedAccount = latestAccount
    ? state.accounts.find(a => a.id === latestAccount.accountId)
    : undefined;
  const relatedAccountBalance = relatedAccount
    ? accountBalance(relatedAccount, state.transactions)
    : null;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      showBanner({
        kind: 'error',
        what: 'Debt name is required',
        why: 'Debts without a name cannot be tracked.',
        fix: 'Enter a name (e.g. "Loan from Rahim").',
      });
      return;
    }
    if (!(Number(total) > 0)) {
      showBanner({
        kind: 'error',
        what: 'Total must be greater than zero',
        why: 'Zero or negative totals make the debt meaningless.',
        fix: 'Enter a positive number.',
      });
      return;
    }
    try {
      update(s => debts.update(s, debt!.id, {
        name,
        direction,
        total: Number(total),
        person: person.trim() || undefined,
        dueDate: dueDate || undefined,
      }));
      showBanner({
        kind: 'success',
        what: 'Debt updated',
        why: 'Changes are saved.',
        fix: 'Open Debts to see the updated row.',
      });
      navigate('/debts');
    } catch (err) {
      showBanner({
        kind: 'error',
        what: 'Could not update debt',
        why: (err as Error).message,
        fix: 'Try again.',
      });
    }
  }

  async function onDelete() {
    const target = debt;
    if (!target) return;
    const ok = await confirm({
      title: `Delete "${target.name}"?`,
      body: linkedTxCount > 0
        ? `${linkedTxCount} linked transaction(s) stay in your records. Only the debt record is removed.`
        : 'The debt record is removed. No transactions are linked.',
      confirmLabel: 'Delete debt',
      danger: true,
    });
    if (!ok) return;
    try {
      update(s => debts.remove(s, target.id));
      showBanner({
        kind: 'success',
        what: 'Debt deleted',
        why: linkedTxCount > 0
          ? `${linkedTxCount} linked transaction(s) remain in your records.`
          : 'No transactions were linked.',
        fix: 'Open Debts to see the updated list.',
      });
      navigate('/debts');
    } catch (err) {
      showBanner({
        kind: 'error',
        what: 'Could not delete debt',
        why: (err as Error).message,
        fix: 'Try again.',
      });
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6 max-w-md">
      <div className="flex items-center gap-3">
        <Link to="/debts" className="text-muted text-sm hover:text-ink transition">{'\u2190'} Debts</Link>
      </div>

      <div>
        <h1 className="heading h1-screen">Edit debt</h1>
        <div className="text-muted text-[13px] mt-1.5">
          {debt.status === 'completed'
            ? 'This debt is fully paid. Editing the total keeps the record accurate.'
            : 'Change the debt details. Linked transactions stay as they are.'}
        </div>
        {isFullyPaid && relatedAccount && (
          <div
            className="mt-4 text-[13px] rounded-btn px-3.5 py-3"
            style={{
              background: 'var(--success-callout-bg)',
              border: '1px solid var(--success)',
              boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--success) 35%, transparent)',
              color: 'var(--ink)',
            }}
          >
            <strong style={{ color: 'var(--success-title)' }}>Fully paid.</strong> Last transaction used{' '}
            <span className="font-semibold">{relatedAccount.name}</span>{' '}
            — current balance:{' '}
            <span className="font-semibold tabular">{fmtBDT(relatedAccountBalance ?? 0)}</span>.
          </div>
        )}
        {isFullyPaid && !relatedAccount && (
          <div
            className="mt-4 text-[13px] rounded-btn px-3.5 py-3"
            style={{
              background: 'var(--success-callout-bg)',
              border: '1px solid var(--success)',
              boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--success) 35%, transparent)',
              color: 'var(--success-title)',
            }}
          >
            <strong>Fully paid.</strong>
          </div>
        )}
      </div>

      <section className="card flex flex-col gap-5">
        <Field label="Direction">
          <Select value={direction} onChange={e => setDirection(e.target.value as DebtDirection)}>
            <option value="i_owe">I owe (you borrowed)</option>
            <option value="owed_to_me">Owed to me (you lent)</option>
          </Select>
        </Field>
        <Field label="Name">
          <Input value={name} onChange={e => setName(e.target.value)} autoFocus />
        </Field>
        <Field label="Total amount" error={totalInvalid ? POSITIVE_MONEY_ERROR : undefined}>
          <Input
            type="number"
            inputMode="decimal"
            value={total}
            onChange={e => setTotal(e.target.value)}
            aria-invalid={totalInvalid || undefined}
            className={totalErrorClass}
          />
        </Field>
        <Field label="Person (optional)">
          <Input value={person} onChange={e => setPerson(e.target.value)} />
        </Field>
        <Field label="Due date (optional)">
          <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
        </Field>
        <div className="flex gap-2">
          <Button variant="primary" type="submit" disabled={totalInvalid || !name.trim()}>Save changes</Button>
          <Button variant="ghost" type="button" onClick={() => navigate('/debts')}>Cancel</Button>
        </div>
      </section>

      <section
        className="rounded-card p-6"
        style={{
          background: 'var(--danger-callout-bg)',
          border: '1px solid var(--danger)',
          boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--danger) 35%, transparent)',
        }}
      >
        <h2 className="heading h3-modal mb-2" style={{ color: 'var(--danger-title)' }}>Danger zone</h2>
        <p className="text-[13px] text-muted mb-4">
          {linkedTxCount > 0
            ? `Removes the debt record only. The ${linkedTxCount} linked transaction(s) stay in your records.`
            : 'Removes the debt record. No transactions are linked.'}
        </p>
        <Button variant="danger" onClick={onDelete}>Delete debt</Button>
      </section>

      {dialog}
    </form>
  );
}