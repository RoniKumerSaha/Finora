import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../domain/store';
import * as debts from '../domain/debts';
import * as transactions from '../domain/transactions';
import { Button } from '../components/Button';
import { Field, Input, Select } from '../components/Field';
import { isPositiveMoney, POSITIVE_MONEY_ERROR } from '../lib/validation';
import type { DebtDirection, DebtKind } from '../domain/types';

export function DebtAddScreen() {
  const navigate = useNavigate();
  const state = useStore(s => s.state);
  const update = useStore(s => s.update);
  const showBanner = useStore(s => s.showBanner);
  const [name, setName] = useState('');
  const [direction, setDirection] = useState<DebtDirection>('i_owe');
  const [total, setTotal] = useState('');
  // B1: account picker — the chosen account is the one whose balance
  // moves on debt creation. We default to the user's first account
  // (or empty if they have none) so the user can adjust before saving.
  const [accountId, setAccountId] = useState(state.accounts[0]?.id ?? '');
  const [person, setPerson] = useState('');
  const [dueDate, setDueDate] = useState('');
  // V1.1 (Loan-kind Debt): collapsed by default. Flipping the toggle
  // on exposes the rate + term fields and sets kind to 'loan'.
  // Only meaningful when direction === 'i_owe' — you only pay interest
  // on money you borrowed, not on money you lent. The toggle is hidden
  // entirely for 'owed_to_me' so a "you lent" entry never accidentally
  // becomes a loan-kind debt (which would split incoming repayments
  // into interest/principal — wrong for that direction).
  const [isLoan, setIsLoan] = useState(false);
  const [interestRate, setInterestRate] = useState('');
  const [termMonths, setTermMonths] = useState('');

  // Loan toggle only shows for i_owe. Derived so direction changes
  // also hide + wipe the toggle and its dependent fields.
  const showLoanToggle = direction === 'i_owe';

  // Inline guard (spine: ux-finora-2026-08-14-negative-guard).
  const totalInvalid = !isPositiveMoney(total);
  const totalErrorClass = totalInvalid
    ? 'border-danger focus:border-danger focus:ring-danger/30'
    : '';
  // Rate is required when isLoan is true; must be a positive number.
  const rateInvalid = isLoan && !(Number(interestRate) > 0);
  const rateErrorClass = rateInvalid
    ? 'border-danger focus:border-danger focus:ring-danger/30'
    : '';
  // Term in months is REQUIRED when isLoan is true so the Pay button
  // can always pre-fill with a meaningful EMI and the loan card can
  // show "Monthly EMI" rather than "—". Must be a positive integer.
  const termInvalid = isLoan && !(Number(termMonths) > 0);
  const termErrorClass = termInvalid
    ? 'border-danger focus:border-danger focus:ring-danger/30'
    : '';

  function onToggleLoan(on: boolean) {
    setIsLoan(on);
    if (!on) {
      // Clearing the toggle wipes the rate so a flat debt never has
      // a stale rate hanging around in form state.
      setInterestRate('');
      setTermMonths('');
    }
  }

  function onChangeDirection(next: DebtDirection) {
    setDirection(next);
    // If the user switches from i_owe (where the loan toggle may have
    // been on) to owed_to_me, clear the loan state — the toggle is
    // hidden for that direction so leaving it set would leave orphan
    // form fields the user can't see or edit.
    if (next !== 'i_owe' && isLoan) {
      setIsLoan(false);
      setInterestRate('');
      setTermMonths('');
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      showBanner({ what: 'Debt name is required', why: 'Debts without a name cannot be tracked.', fix: 'Enter a name (e.g. "Loan from a friend").' });
      return;
    }
    if (!(Number(total) > 0)) {
      showBanner({ what: 'Total must be greater than zero', why: 'Zero or negative totals make the debt meaningless.', fix: 'Enter a positive number.' });
      return;
    }
    if (!accountId) {
      showBanner({
        what: 'Pick an account',
        why: 'A debt is recorded alongside the cash that gave rise to it — borrowed or lent money has to land somewhere.',
        fix: 'Choose the account this cash entered or left.',
      });
      return;
    }
    if (isLoan) {
      if (!(Number(interestRate) > 0)) {
        showBanner({
          what: 'Enter the annual interest rate',
          why: 'A loan-kind debt needs a rate so each payment can be split into interest and principal.',
          fix: 'Enter the rate as a percentage, e.g. 12 for 12% APR.',
        });
        return;
      }
      if (!(Number(termMonths) > 0)) {
        showBanner({
          what: 'Enter the term in months',
          why: 'A loan-kind debt needs a term so the Pay button can pre-fill with the standard EMI.',
          fix: 'Enter the term as a whole number of months, e.g. 36 for 3 years.',
        });
        return;
      }
    }
    // B1: opening ledger entry runs through the account the user
    // picked. i_owe = borrowed cash → Income into the account.
    // owed_to_me = lent cash → Expense out of the account. Either
    // way the picked account's balance moves on save.
    const openingTxType = direction === 'i_owe' ? 'income' : 'expense';
    try {
      update(s => {
        // Generate the debt first so we can stamp the opening tx
        // with `linkedDebtId`. Same closure-id pattern used by
        // `addEventPlan` / `addLoanPlan` in src/domain/store.ts.
        const withDebt = debts.add(s, {
          name: name.trim(),
          direction,
          total: Number(total),
          person: person.trim() || undefined,
          dueDate: dueDate || undefined,
          kind: isLoan ? 'loan' as DebtKind : undefined,
          interestRate: isLoan ? Number(interestRate) : undefined,
          termMonths: isLoan && termMonths ? Number(termMonths) : undefined,
        });
        const createdId = withDebt.debts[withDebt.debts.length - 1].id;
        return transactions.add(withDebt, {
          type: openingTxType,
          amount: Number(total),
          date: new Date().toISOString().slice(0, 10),
          accountId,
          linkedDebtId: createdId,
          note: `Debt: ${name.trim()}`,
        });
      });
      navigate('/debts');
    } catch (err) {
      showBanner({ what: 'Could not add debt', why: (err as Error).message, fix: 'Try again.' });
    }
  }

  // No-accounts guard: rendering the form when the user has no
  // accounts would let them submit a debt whose opening transaction
  // has nowhere to land. Mirror the pattern from DebtPaymentModal:
  // portal-rendered notice with a clear next step.
  if (state.accounts.length === 0) {
    return createPortal(
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
      >
        <button
          type="button"
          aria-label="Close dialog"
          onClick={() => navigate('/debts')}
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
            A debt records the cash that gave rise to it. Add an account in Settings → Accounts, then come back to track this debt.
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="outlined-ghost" onClick={() => navigate('/debts')}>Back</Button>
            <Button variant="primary" onClick={() => navigate('/settings')}>Open Settings</Button>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6 max-w-md">
      <header>
        <h1 className="heading h1-screen">Add debt</h1>
        <div className="text-muted text-[13px] mt-1.5">Track what you owe or what others owe you.</div>
      </header>
      <section className="card flex flex-col gap-5">
        <Field label="Direction" hint="Pick 'I owe' for loans you took. 'Owed to me' for money you lent.">
          <Select value={direction} onChange={e => onChangeDirection(e.target.value as DebtDirection)}>
            <option value="i_owe">I owe (you borrowed)</option>
            <option value="owed_to_me">Owed to me (you lent)</option>
          </Select>
        </Field>
        <Field label="Name">
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Loan from a friend, advance to a colleague…" autoFocus />
        </Field>
        <Field label="Total amount" hint="Total amount — principal, not total repayments expected. We'll record the cash side of this debt against the account you pick below." error={totalInvalid ? POSITIVE_MONEY_ERROR : undefined}>
          <Input
            type="number"
            inputMode="decimal"
            value={total}
            onChange={e => setTotal(e.target.value)}
            placeholder="10000"
            aria-invalid={totalInvalid || undefined}
            className={totalErrorClass}
          />
        </Field>
        {/* B1: account picker — the chosen account is the one whose
            balance moves on debt creation. i_owe → borrowed cash lands
            as Income here; owed_to_me → lent cash lands as Expense
            here. Required; without an account there's nowhere for the
            opening transaction to land. */}
        <Field
          label={direction === 'i_owe' ? 'Cash goes into' : 'Cash goes from'}
          hint={direction === 'i_owe'
            ? 'The account the borrowed money landed in.'
            : 'The account the lent money came from.'}
          error={accountId === '' ? 'Pick an account.' : undefined}
        >
          <Select value={accountId} onChange={e => setAccountId(e.target.value)}>
            {state.accounts.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Person (optional)">
          <Input value={person} onChange={e => setPerson(e.target.value)} placeholder="Friend, family…" />
        </Field>
        <Field label="Due date (optional)">
          <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
        </Field>

        {/* V1.1: optional loan toggle. Only shown when direction is
            'i_owe' — interest only applies to money you borrowed, not
            to money you lent. When the toggle is on, each recorded
            payment is split into interest + principal using the
            standard EMI math. */}
        {showLoanToggle && (
          <label className="flex items-start gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isLoan}
              onChange={e => onToggleLoan(e.target.checked)}
              className="mt-1 shrink-0"
              aria-label="Mark this debt as a loan with interest"
            />
            <div className="min-w-0">
              <div className="text-[13.5px] font-semibold text-ink leading-tight">
                Is this a loan with interest?
              </div>
              <div className="text-[12px] text-muted mt-1 leading-relaxed">
                If the loan charges interest, enter the annual rate. We'll split each payment into interest and principal.
              </div>
            </div>
          </label>
        )}
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
                placeholder="12"
                aria-invalid={rateInvalid || undefined}
                className={rateErrorClass}
              />
            </Field>
            {/* Term in months is required when isLoan is true so the
                Pay button can always pre-fill with a meaningful EMI
                and the loan card can display "Monthly EMI" rather
                than "—". */}
            <Field
              label="Term in months"
              hint="Whole months, e.g. 36 for 3 years. Drives the Pay button's pre-filled EMI."
              error={termInvalid ? 'Enter a term greater than zero.' : undefined}
            >
              <Input
                type="number"
                inputMode="numeric"
                min="1"
                value={termMonths}
                onChange={e => setTermMonths(e.target.value)}
                placeholder="36"
                aria-invalid={termInvalid || undefined}
                className={termErrorClass}
              />
            </Field>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            variant="outlined-primary"
            type="submit"
            disabled={totalInvalid || !name.trim() || rateInvalid || termInvalid || accountId === ''}
          >
            Save debt
          </Button>
          <Button variant="outlined-ghost" onClick={() => navigate('/debts')}>Cancel</Button>
        </div>
      </section>
    </form>
  );
}