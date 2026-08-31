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
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../domain/store';
import * as debts from '../domain/debts';
import { accountBalance, debtPaidSoFar, loanPaymentSplit } from '../domain/math';
import { fmtBDT, fmtDate } from '../lib/format';
import { Button } from '../components/Button';
import { Field, Input, Select } from '../components/Field';
import { useConfirm } from '../components/ConfirmDialog';
import { isPositiveMoney, POSITIVE_MONEY_ERROR } from '../lib/validation';
import type { DebtDirection, DebtKind } from '../domain/types';

const MIDDOT = '\u00B7';

export function DebtEditScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const state = useStore(s => s.state);
  const update = useStore(s => s.update);
  const showBanner = useStore(s => s.showBanner);
  const showToast = useStore(s => s.showToast);
  const { confirm, dialog } = useConfirm();
  const debt = debts.get(state, id!);

  const [name, setName] = useState(debt?.name ?? '');
  const [direction, setDirection] = useState<DebtDirection>(debt?.direction ?? 'i_owe');
  const [total, setTotal] = useState(String(debt?.total ?? ''));
  const [person, setPerson] = useState(debt?.person ?? '');
  const [dueDate, setDueDate] = useState(debt?.dueDate ?? '');
  // V1.1: loan-kind state, pre-filled from the existing debt. Defaults
  // to off for legacy flat debts.
  const [isLoan, setIsLoan] = useState(debt?.kind === 'loan');
  const [interestRate, setInterestRate] = useState(debt?.interestRate != null ? String(debt.interestRate) : '');
  const [termMonths, setTermMonths] = useState(debt?.termMonths != null ? String(debt.termMonths) : '');
  // Snapshot the debt's kind at mount so we can detect a
  // loan → flat downgrade and prompt for confirmation (the prior
  // ledger entries will be reinterpreted as 1-for-1).
  const [wasLoanAtMount] = useState(debt?.kind === 'loan');
  // One-shot confirm-state for the Save button. Pulse + ✓ glyph render
  // for the 600ms window before navigate.
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (saved) setSaved(false);
  }, [name, direction, total, person, dueDate, isLoan, interestRate, termMonths]); // eslint-disable-line react-hooks/exhaustive-deps

  // Inline guard (spine: ux-finora-2026-08-14-negative-guard). Pre-populated
  // value is always valid; user can break it by typing a negative.
  const totalInvalid = !isPositiveMoney(total);
  const totalErrorClass = totalInvalid
    ? 'border-danger focus:border-danger focus:ring-danger/30'
    : '';
  // V1.1: rate is required when isLoan is true.
  const rateInvalid = isLoan && !(Number(interestRate) > 0);
  const rateErrorClass = rateInvalid
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

  // Activity feed — every transaction tagged with this debt, sorted
  // newest first. Paid-down debts (i_owe) surface linked expense
  // transactions as "Payment"; receivables (owed_to_me) surface linked
  // income as "Received". Mirrors the Activity card in
  // InvestmentDetailScreen.
  const linkedTx = state.transactions
    .filter(t => t.linkedDebtId === debt.id)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));
  const accountById = new Map(state.accounts.map(a => [a.id, a]));

  // V1.1 (L4.1): per-row loan split — for loan-kind debts only.
  // We replay the transactions in chronological (oldest-first) order,
  // tracking running outstanding, and stash each transaction's
  // {interest, principal} split so the row can render it.
  // `linkedTx` is newest-first, so we build a Map keyed by transaction
  // id and look it up in the row.
  const splitByTxId = new Map<string, { interest: number; principal: number }>();
  if (debt.kind === 'loan') {
    const rate = Number(debt.interestRate) || 0;
    const chronological = linkedTx.slice().sort((a, b) => {
      const d = a.date.localeCompare(b.date);
      return d !== 0 ? d : a.id.localeCompare(b.id);
    });
    let out = Number(debt.total) || 0;
    for (const t of chronological) {
      const matches =
        (debt.direction === 'i_owe' && t.type === 'expense') ||
        (debt.direction === 'owed_to_me' && t.type === 'income');
      if (!matches) {
        splitByTxId.set(t.id, { interest: 0, principal: 0 });
        continue;
      }
      const split = loanPaymentSplit(out, Number(t.amount) || 0, rate);
      splitByTxId.set(t.id, split);
      out = Math.max(0, out - split.principal);
    }
  }

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
        fix: 'Enter a name (e.g. "Loan from a friend").',
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
    if (isLoan && !(Number(interestRate) > 0)) {
      showBanner({
        kind: 'error',
        what: 'Enter the annual interest rate',
        why: 'A loan-kind debt needs a rate so each payment can be split into interest and principal.',
        fix: 'Enter the rate as a percentage, e.g. 12 for 12% APR.',
      });
      return;
    }
    submitRef.current?.();
  }

  // Split the actual save into an async helper so we can intercept
  // loan → flat downgrades with a confirm dialog before persisting.
  async function performSave() {
    try {
      update(s => debts.update(s, debt!.id, {
        name,
        direction,
        total: Number(total),
        person: person.trim() || undefined,
        dueDate: dueDate || undefined,
        kind: isLoan ? 'loan' as DebtKind : undefined,
        interestRate: isLoan ? Number(interestRate) : undefined,
        termMonths: isLoan && termMonths ? Number(termMonths) : undefined,
      }));
      showToast({
        kind: 'success',
        what: 'Debt updated',
        why: 'Changes are saved.',
      });
      setSaved(true);
      window.setTimeout(() => navigate('/debts'), 600);
    } catch (err) {
      showBanner({
        kind: 'error',
        what: 'Could not update debt',
        why: (err as Error).message,
        fix: 'Try again.',
      });
    }
  }

  // Imperative bridge: onSubmit does synchronous validation and then
  // calls into this ref so we can `await confirm(...)` for the
  // loan → flat downgrade path before mutating state.
  const submitRef = useRef<() => Promise<void>>(async () => { /* replaced below */ });
  submitRef.current = async () => {
    // Downgrade guard: if this debt was a loan at mount and the user
    // is flipping it back to flat, prompt before saving. The ledger
    // entries stay; only their interpretation changes.
    if (wasLoanAtMount && !isLoan) {
      const ok = await confirm({
        title: 'Treat this debt as a flat IOU?',
        body: 'Past payments will be reinterpreted 1-for-1 going forward. The transaction records themselves stay unchanged.',
        confirmLabel: 'Save as flat',
      });
      if (!ok) return;
    }
    await performSave();
  };

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
        <Field label="Direction" hint="Changing direction flips how linked payments are interpreted.">
          <Select value={direction} onChange={e => setDirection(e.target.value as DebtDirection)}>
            <option value="i_owe">I owe (you borrowed)</option>
            <option value="owed_to_me">Owed to me (you lent)</option>
          </Select>
        </Field>
        <Field label="Name">
          <Input value={name} onChange={e => setName(e.target.value)} autoFocus />
        </Field>
        <Field label="Total amount" hint="Repayments are tracked via linked transactions, not here." error={totalInvalid ? POSITIVE_MONEY_ERROR : undefined}>
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

        {/* V1.1: optional loan toggle — same shape as DebtAddScreen.
            Pre-filled from `debt.kind` / `debt.interestRate` / `debt.termMonths`. */}
        <label className="flex items-start gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isLoan}
            onChange={e => {
              setIsLoan(e.target.checked);
              if (!e.target.checked) {
                setInterestRate('');
                setTermMonths('');
              }
            }}
            className="mt-1 shrink-0"
            aria-label="Mark this debt as a loan with interest"
          />
          <div className="min-w-0">
            <div className="text-[13.5px] font-semibold text-ink leading-tight">
              Is this a loan with interest?
            </div>
            <div className="text-[12px] text-muted mt-1 leading-relaxed">
              Each payment will be split into interest and principal based on the rate below.
            </div>
          </div>
        </label>
        {isLoan && (
          <div className="flex flex-col gap-4 pl-6 border-l-2 border-border">
            <Field
              label="Annual interest rate (%)"
              hint="APR as a percentage, e.g. 12 for 12%."
              error={rateInvalid ? 'Enter a rate greater than zero.' : undefined}
            >
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                max="100"
                value={interestRate}
                onChange={e => setInterestRate(e.target.value)}
                aria-invalid={rateInvalid || undefined}
                className={rateErrorClass}
              />
            </Field>
            <Field
              label="Term in months (optional)"
              hint="If set, the Pay button will pre-fill with the standard EMI."
            >
              <Input
                type="number"
                inputMode="numeric"
                min="1"
                value={termMonths}
                onChange={e => setTermMonths(e.target.value)}
              />
            </Field>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            variant="primary"
            type="submit"
            disabled={totalInvalid || !name.trim() || rateInvalid}
            success={saved}
          >
            Save changes
          </Button>
          <Button variant="ghost" type="button" onClick={() => navigate('/debts')}>Cancel</Button>
        </div>
      </section>

      {/* Activity — every transaction tagged with this debt, newest
          first. Hidden when there are no linked transactions so the
          page stays uncluttered for fresh debts. Mirrors the Activity
          card in InvestmentDetailScreen (linked contributions +
          payouts), adapted for the debt semantics: i_owe expenses are
          "Payment" (primary tone), owed_to_me incomes are "Received"
          (success tone). The opposite direction would mean a tagging
          mistake — we still render those rows so the user sees them,
          but flag them with a neutral tone. */}
      {linkedTx.length > 0 && (
        <section className="card">
          <h2 className="heading h3-modal mb-4">Activity</h2>
          <div className="divide-y divide-border">
            {linkedTx.map(t => {
              const acc = accountById.get(t.accountId ?? '');
              const isIOwe = debt.direction === 'i_owe';
              // Tag tone: matches the directional flow the user
              // expects. i_owe → expense is the normal "payment"
              // (primary); owed_to_me → income is "received"
              // (success). Cross combinations are shown with a muted
              // neutral pill so they stand out without alarming.
              const tag =
                isIOwe && t.type === 'expense'
                  ? { label: 'Payment',  cls: 'bg-primary-soft text-primary' }
                  : !isIOwe && t.type === 'income'
                  ? { label: 'Received', cls: 'bg-success-soft text-success' }
                  : isIOwe && t.type === 'income'
                  ? { label: 'Reversal', cls: 'bg-warn-soft text-warn' }
                  : { label: 'Adjust',   cls: 'bg-surface-2 text-muted' };
              const amountColor =
                t.type === 'income'
                  ? 'text-primary'
                  : t.type === 'expense'
                  ? 'text-danger'
                  : 'text-ink';
              const amountPrefix =
                t.type === 'income' ? '+ ' : t.type === 'expense' ? '\u2212 ' : '';
              return (
                <div key={t.id} className="py-2.5 flex justify-between items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5">
                      <span className={`text-[14px] font-semibold tabular ${amountColor}`}>
                        {amountPrefix}{fmtBDT(t.amount)}
                      </span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-pill text-[10px] font-bold uppercase tracking-wider ${tag.cls}`}
                      >
                        {tag.label}
                      </span>
                    </div>
                    <div className="text-[11.5px] text-muted mt-1 truncate tabular">
                      {fmtDate(t.date)}{acc ? ` ${MIDDOT} ${acc.name}` : ''}{t.note ? ` ${MIDDOT} ${t.note}` : ''}
                    </div>
                    {/* V1.1 (L4.1): loan split line — only for loan-kind
                        debts, only on rows that actually contributed
                        (so cross-direction tagging mistakes don't add
                        noise). */}
                    {debt.kind === 'loan' && (() => {
                      const split = splitByTxId.get(t.id);
                      if (!split) return null;
                      const meaningful = split.interest > 0 || split.principal > 0;
                      if (!meaningful) return null;
                      return (
                        <div className="text-[11.5px] text-muted mt-0.5 tabular">
                          <span className="text-danger">{fmtBDT(split.interest)}</span> interest
                          {' · '}
                          <span className="text-primary">{fmtBDT(split.principal)}</span> principal
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="text-[12px] text-muted mt-3 leading-relaxed">
            {debt.direction === 'i_owe'
              ? 'Payments you make toward this debt. Recorded as expenses tagged with this debt — usually via Add transaction → Expense.'
              : 'Payments you receive against this debt. Recorded as income tagged with this debt — usually via Add transaction → Income.'}
          </div>
        </section>
      )}

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