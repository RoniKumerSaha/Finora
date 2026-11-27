/**
 * DebtAddScreen — write an IOU, as a slip.
 *
 * A debt is a PROMISE, so the document is a promissory note: who,
 * how much, at what rate, by when. The screen is one slip with the
 * note's blanks still open.
 *
 * The one decision that changes everything is the DIRECTION, so it
 * is the first thing on the page — and it is a STAMP, not a
 * dropdown. The old form used a dropdown, so switching between "I
 * owe" and "owed to me" changed a label but left the rest of the
 * form ambiguous: which account, which number, all of it still read
 * as if it were an expense. Two big stamps, each labelled in plain
 * words — "You borrowed" / "You lent" — remove the ambiguity
 * entirely, because you can see both options at the moment you are
 * choosing.
 */
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../domain/store';
import * as debts from '../domain/debts';
import * as transactions from '../domain/transactions';
import { Button } from '../components/Button';
import { Select } from '../components/Field';
import { DurationField } from '../components/DurationField';
import {
  Blank,
  BlankStack,
  Clause,
  Recap,
  Slip,
  SlipAmount,
  SlipFoot,
  SlipHead,
  Stamp,
  StampGroup,
} from '../components/AddSlip';
import { isPositiveMoney } from '../lib/validation';
import { ArrowUp, ArrowDown } from '../components/icons/Icons';
import { accountBalance, loanEMI } from '../domain/math';
import { fmtBDT } from '../lib/format';
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
  // Rate is required when isLoan is true; must be a positive number.
  const rateInvalid = isLoan && !(Number(interestRate) > 0);
  const rateErrorClass = rateInvalid
    ? 'border-danger focus:border-danger focus:ring-danger/30'
    : '';
  // Term in months is REQUIRED when isLoan is true so the Pay button
  // can always pre-fill with a meaningful EMI and the loan card can
  // show "Monthly EMI" rather than "—". Must be a positive integer.
  const termInvalid = isLoan && !(Number(termMonths) > 0);

  const totalNum = Number(total) || 0;

  // The clause's arithmetic: the account's balance before and after,
  // and — for a loan — the monthly payment and what it costs.
  const acc = state.accounts.find(a => a.id === accountId);
  const accBal = accountBalance(acc, state.transactions);
  // i_owe → borrowed cash lands as Income here; owed_to_me → lent
  // cash leaves as Expense here.
  const accAfter = direction === 'i_owe' ? accBal + totalNum : accBal - totalNum;

  const emi = isLoan ? loanEMI(totalNum, Number(interestRate) || 0, Number(termMonths) || 0) : 0;
  const totalRepaid = isLoan ? emi * (Number(termMonths) || 0) : totalNum;

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
          <p className="t-13 text-muted leading-relaxed mb-5">
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

  const tone = direction === 'i_owe' ? 'var(--danger)' : 'var(--primary)';

  return (
    <form onSubmit={onSubmit} className="addpage">
      <Slip tone={tone}>
        <SlipHead
          what="New debt"
          title="An IOU"
          sub="Who owes whom, how much, and by when. The direction is the whole thing, so it is the first stamp."
        />

        {/* THE DIRECTION — two stamps, plain words. */}
        <StampGroup label="Direction" cols={2}>
          <Stamp
            on={direction === 'i_owe'}
            onClick={() => onChangeDirection('i_owe')}
            icon={<ArrowDown strokeWidth={2} />}
            title="I owe them"
            sub="You borrowed"
          />
          <Stamp
            on={direction === 'owed_to_me'}
            onClick={() => onChangeDirection('owed_to_me')}
            icon={<ArrowUp strokeWidth={2} />}
            title="They owe me"
            sub="You lent"
          />
        </StampGroup>

        {/* THE AMOUNT — the headline. */}
        <SlipAmount
          label={direction === 'i_owe' ? 'Total owed' : 'Total lent'}
          value={total}
          onChange={setTotal}
          placeholder="25,000"
          autoFocus
          invalid={totalInvalid}
        />

        {/* THE BLANKS. */}
        <Blank label="Name" empty={!name.trim()}>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Loan from Rahim"
            aria-label="Name"
          />
        </Blank>

        <Blank label={direction === 'i_owe' ? 'Cash went into' : 'Cash went from'}>
          <Select value={accountId} onChange={e => setAccountId(e.target.value)} aria-label="Account">
            {state.accounts.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </Select>
        </Blank>

        <Blank label="Person" empty={!person.trim()}>
          <input
            type="text"
            value={person}
            onChange={e => setPerson(e.target.value)}
            placeholder="Rahim"
            aria-label="Person"
          />
        </Blank>

        <Blank label="Due on" empty={!dueDate}>
          <input
            type="date"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
            aria-label="Due date"
          />
        </Blank>

        {/* The loan terms are conditional — interest may or may not
            exist, so they live in their own block, not scattered
            through the blanks. */}
        {showLoanToggle && (
          <BlankStack label="Interest">
            <div className="chipset">
              <button
                type="button"
                className={`chipset__c${!isLoan ? ' on' : ''}`}
                onClick={() => onToggleLoan(false)}
                aria-pressed={!isLoan}
              >
                No interest
              </button>
              <button
                type="button"
                className={`chipset__c${isLoan ? ' on' : ''}`}
                onClick={() => onToggleLoan(true)}
                aria-pressed={isLoan}
              >
                With interest
              </button>
            </div>
          </BlankStack>
        )}

        {isLoan && (
          <>
            <Blank label="Annual rate">
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                max="100"
                value={interestRate}
                onChange={e => setInterestRate(e.target.value)}
                placeholder="12"
                aria-label="Annual interest rate"
                aria-invalid={rateInvalid || undefined}
                className={rateErrorClass}
              />
            </Blank>

            <Blank label="Pay it back over">
              <DurationField
                months={Math.max(0, Math.floor(Number(termMonths) || 0))}
                onChange={m => setTermMonths(String(m))}
                hideLabel
                bare
              />
            </Blank>
          </>
        )}

        {/* THE CLAUSE — the consequence, written inside the note. */}
        <Clause tone={tone} icon={direction === 'i_owe' ? <ArrowUp strokeWidth={2} /> : <ArrowDown strokeWidth={2} />}>
          {!acc ? (
            <>Pick an account to see what this debt does to your balance.</>
          ) : totalNum <= 0 ? (
            // With no amount typed, "goes from ৳ 53,500 to ৳ 53,500" is
            // a true sentence about nothing. Say what is pending instead.
            <>
              {acc.name} sits at <b>{fmtBDT(accBal)}</b>. Type the amount and this line will
              show what the IOU does to it.
            </>
          ) : (
            <>
              {acc.name} goes from <b>{fmtBDT(accBal)}</b> to <b>{fmtBDT(accAfter)}</b>, and a debt of{' '}
              <b>{fmtBDT(totalNum)}</b> opens against it.
              {isLoan && emi > 0 && (
                <>
                  {' '}Pay <b>{fmtBDT(emi)}</b> a month for {Number(termMonths)} months to clear it.
                </>
              )}
            </>
          )}
        </Clause>

        <SlipFoot
          note={
            <>
              The account balance you entered when you borrowed stays as it is. The debt tracks
              what's left to repay, separately.
            </>
          }
        >
          <Button variant="outlined-ghost" type="button" onClick={() => navigate('/debts')}>Cancel</Button>
          <Button
            variant="outlined-primary"
            type="submit"
            disabled={totalInvalid || !name.trim() || rateInvalid || termInvalid || accountId === ''}
          >
            Write the IOU
          </Button>
        </SlipFoot>
      </Slip>

      <div className="addpage__side">
        <Recap
          rows={[
            { k: 'Direction', v: direction === 'i_owe' ? 'I owe them' : 'They owe me', tone },
            { k: 'Total', v: total.trim() ? fmtBDT(totalNum) : '—' },
            { k: 'Person', v: person.trim() || '—' },
            { k: 'Account', v: acc?.name ?? '—' },
            ...(isLoan ? [
              { k: 'Interest', v: interestRate ? `${Number(interestRate)}% / yr` : '—' },
              { k: 'Monthly', v: emi > 0 ? fmtBDT(emi) : '—' },
            ] : []),
            { k: 'Total repaid', v: isLoan && emi === 0 ? '—' : (total.trim() ? fmtBDT(totalRepaid) : '—'), total: true },
          ]}
        />
      </div>
    </form>
  );
}
