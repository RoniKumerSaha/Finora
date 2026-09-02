import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../domain/store';
import * as debts from '../domain/debts';
import { Button } from '../components/Button';
import { Field, Input, Select } from '../components/Field';
import { isPositiveMoney, POSITIVE_MONEY_ERROR } from '../lib/validation';
import { LoanTile } from '../components/InvestLoanTile';
import type { DebtDirection, DebtKind } from '../domain/types';

export function DebtAddScreen() {
  const navigate = useNavigate();
  const update = useStore(s => s.update);
  const showBanner = useStore(s => s.showBanner);
  const [name, setName] = useState('');
  const [direction, setDirection] = useState<DebtDirection>('i_owe');
  const [total, setTotal] = useState('');
  const [person, setPerson] = useState('');
  const [dueDate, setDueDate] = useState('');
  // V1.1 (Loan-kind Debt): collapsed by default. Flipping the toggle
  // on exposes the rate + term fields and sets kind to 'loan'.
  const [isLoan, setIsLoan] = useState(false);
  const [interestRate, setInterestRate] = useState('');
  const [termMonths, setTermMonths] = useState('');

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

  function onToggleLoan(on: boolean) {
    setIsLoan(on);
    if (!on) {
      // Clearing the toggle wipes the rate so a flat debt never has
      // a stale rate hanging around in form state.
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
    if (isLoan && !(Number(interestRate) > 0)) {
      showBanner({
        what: 'Enter the annual interest rate',
        why: 'A loan-kind debt needs a rate so each payment can be split into interest and principal.',
        fix: 'Enter the rate as a percentage, e.g. 12 for 12% APR.',
      });
      return;
    }
    try {
      update(s => debts.add(s, {
        name, direction, total: Number(total),
        person: person.trim() || undefined,
        dueDate: dueDate || undefined,
        kind: isLoan ? 'loan' as DebtKind : undefined,
        interestRate: isLoan ? Number(interestRate) : undefined,
        termMonths: isLoan && termMonths ? Number(termMonths) : undefined,
      }));
      navigate('/debts');
    } catch (err) {
      showBanner({ what: 'Could not add debt', why: (err as Error).message, fix: 'Try again.' });
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6 max-w-md">
      <header className="flex items-center gap-3">
        <LoanTile />
        <div>
          <h1 className="heading h1-screen">Add debt</h1>
          <div className="text-muted text-[13px] mt-1.5">Track what you owe or what others owe you.</div>
        </div>
      </header>
      <section className="card flex flex-col gap-5">
        <Field label="Direction" hint="Pick 'I owe' for loans you took. 'Owed to me' for money you lent.">
          <Select value={direction} onChange={e => setDirection(e.target.value as DebtDirection)}>
            <option value="i_owe">I owe (you borrowed)</option>
            <option value="owed_to_me">Owed to me (you lent)</option>
          </Select>
        </Field>
        <Field label="Name">
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Loan from a friend, advance to a colleague…" autoFocus />
        </Field>
        <Field label="Total amount" hint="Total amount — principal, not total repayments expected." error={totalInvalid ? POSITIVE_MONEY_ERROR : undefined}>
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
        <Field label="Person (optional)">
          <Input value={person} onChange={e => setPerson(e.target.value)} placeholder="Friend, family…" />
        </Field>
        <Field label="Due date (optional)">
          <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
        </Field>

        {/* V1.1: optional loan toggle. When off, the debt is treated as
            a flat personal IOU (today's behaviour). When on, each
            recorded payment is split into interest + principal. */}
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
                placeholder="36"
              />
            </Field>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            variant="outlined-primary"
            type="submit"
            disabled={totalInvalid || !name.trim() || rateInvalid}
          >
            Save debt
          </Button>
          <Button variant="outlined-ghost" onClick={() => navigate('/debts')}>Cancel</Button>
        </div>
      </section>
    </form>
  );
}