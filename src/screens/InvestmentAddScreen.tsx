/**
 * InvestmentAddScreen — park your money, as a slip.
 *
 * An investment is a PLACE, and the three kinds of place are not
 * variations on one form — a DPS is money that arrives every month,
 * an FDR is a lump sum that sits still for a term, and savings is
 * the same shape as an FDR with a softer name. So the TYPE is the
 * first stamp, and each stamp brings its own question with it:
 * "every month" for a DPS, "principal" for an FDR or savings.
 *
 * The clause at the foot does the one piece of arithmetic the form
 * cannot: where this money ends up. "Over 60 months you'd put in
 * ৳ 3,00,000 and it would grow to ৳ 3,67,466 — ৳ 67,466 of
 * interest." That is the question people actually have when they
 * open this screen, so it is answered inside the document rather
 * than in a review box they might not scroll to.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../domain/store';
import * as investments from '../domain/investments';
import * as accounts from '../domain/accounts';
import { Button } from '../components/Button';
import { Select } from '../components/Field';
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
import { accountBalance } from '../domain/math';
import { fmtBDT } from '../lib/format';
import { isPositiveMoney } from '../lib/validation';
import { ArrowUp, Clock } from '../components/icons/Icons';
import type { InvestmentType } from '../domain/types';

/** Each kind of place has its own colour identity. */
const TONE: Record<InvestmentType, string> = {
  dps: 'var(--primary)',
  fdr: 'var(--accent)',
  savings: 'var(--info)',
};

export function InvestmentAddScreen() {
  const navigate = useNavigate();
  const update = useStore(s => s.update);
  const showBanner = useStore(s => s.showBanner);
  const state = useStore(s => s.state);
  const accs = accounts.list(state);

  const [name, setName] = useState('');
  const [type, setType] = useState<InvestmentType>('dps');
  const [principal, setPrincipal] = useState('');
  const [monthlyContribution, setMonthlyContribution] = useState('');
  const [rate, setRate] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [termMonths, setTermMonths] = useState('');
  const [termDays, setTermDays] = useState('');
  /** FDR/savings only: when true, show termDays field instead of termMonths.
   *  Always false for DPS. */
  const [useDays, setUseDays] = useState(false);
  const [payoutAccountId, setPayoutAccountId] = useState(accs[0]?.id ?? '');
  const [institution, setInstitution] = useState('');

  const isDps = type === 'dps';
  const termInDays = !isDps && useDays;

  // Switching type has to clear the other type's amount field, or a
  // leftover principal would silently follow you from an FDR to a DPS.
  function onChangeType(next: InvestmentType) {
    setType(next);
    if (next === 'dps') {
      setPrincipal('');
    } else {
      setMonthlyContribution('');
    }
  }

  // Inline guard (spine: ux-finora-2026-08-14-negative-guard).
  // Principal applies only to non-DPS (FDR / savings); monthlyContribution
  // applies only to DPS. Each field independently validates.
  const principalInvalid = !isPositiveMoney(principal);
  const monthlyInvalid = !isPositiveMoney(monthlyContribution);
  const amountInvalid = isDps ? monthlyInvalid : principalInvalid;

  const matPreview = (() => {
    const r = Number(rate);
    if (!(r >= 0)) return null;
    if (isDps) {
      const T = Number(termMonths);
      if (!(T > 0)) return null;
      const M = Number(monthlyContribution);
      if (!(M > 0)) return null;
      if (r === 0) return M * T;
      const rm = r / 100 / 12;
      return M * ((Math.pow(1 + rm, T) - 1) / rm) * (1 + rm);
    }
    const P = Number(principal);
    if (!(P > 0)) return null;
    if (termInDays) {
      const D = Number(termDays);
      if (!(D > 0)) return null;
      return P * (1 + (r / 100) * (D / 365));
    }
    const T = Number(termMonths);
    if (!(T > 0)) return null;
    return P * (1 + (r / 100) * (T / 12));
  })();

  /** True when the active term field has a positive value. */
  const termValid = termInDays
    ? Number(termDays) > 0
    : Number(termMonths) > 0;

  /** Reset the unused term field when toggling, to avoid stale state. */
  function toggleUseDays(next: boolean) {
    setUseDays(next);
    if (next) setTermMonths('');
    else setTermDays('');
  }

  // What actually goes IN, and what comes OUT at the end.
  const putIn = isDps
    ? Number(monthlyContribution) * (Number(termMonths) || 0)
    : Number(principal) || 0;
  const growth = matPreview != null ? Math.max(0, matPreview - putIn) : 0;

  const payoutAcc = accs.find(a => a.id === payoutAccountId);
  const payoutBal = accountBalance(payoutAcc, state.transactions);
  const payoutAfter = !isDps ? payoutBal - (Number(principal) || 0) : payoutBal;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      showBanner({ what: 'Investment name is required', why: 'Investments without a name cannot be tracked.', fix: 'Enter a name (e.g. "DPS #1").' });
      return;
    }
    if (!isDps && !(Number(principal) > 0)) {
      showBanner({ what: 'Principal must be greater than zero', why: 'FDR and savings need a lump-sum principal.', fix: 'Enter a positive number.' });
      return;
    }
    if (isDps && !(Number(monthlyContribution) > 0)) {
      showBanner({ what: 'Monthly contribution is required', why: 'DPS maturity is calculated from your monthly contribution.', fix: 'Enter a positive number.' });
      return;
    }
    if (!(Number(rate) >= 0)) {
      showBanner({ what: 'Rate must be a non-negative number', why: 'Negative rates aren\'t supported in V1.', fix: 'Enter 0 or a positive percent.' });
      return;
    }
    if (termInDays) {
      if (!(Number(termDays) > 0)) {
        showBanner({ what: 'Term must be a positive number of days', why: 'A zero-day term has no maturity date.', fix: 'Enter the term in days, e.g. 15 for a 2-week FDR.' });
        return;
      }
    } else if (!(Number(termMonths) > 0)) {
      showBanner({ what: 'Term must be a positive number of months', why: 'A zero-month term has no maturity date.', fix: 'Enter the term in months, e.g. 12 for 1 year.' });
      return;
    }
    // FDR/Savings: an account is required because the principal is
    // deducted from it on creation (the principal can't otherwise
    // "leave" the account — that's the bug we're fixing). DPS
    // contributions are recorded one-at-a-time on the detail screen
    // where the account is chosen per contribution.
    if (!isDps && !payoutAccountId) {
      showBanner({
        what: 'Account is required for FDR and savings',
        why: 'The principal is deducted from this account on creation — without one, the money would silently appear in both the account and the investment.',
        fix: 'Pick the account you\'re parking the money in.',
      });
      return;
    }
    try {
      const isFdrOrSavings = type === 'fdr' || type === 'savings';
      update(s => investments.add(s, {
        name,
        type,
        principal: isDps ? 0 : Number(principal),
        monthlyContribution: isDps ? Number(monthlyContribution) : undefined,
        rate: Number(rate),
        startDate,
        termMonths: termInDays ? 0 : Number(termMonths),
        termDays: termInDays ? Number(termDays) : undefined,
        payoutAccountId: payoutAccountId || undefined,
        institution: institution.trim() || undefined,
      }, {
        // FDR/Savings: deduct the principal from the chosen account
        // right now so the balance reflects the parked money. DPS has
        // no lump-sum, so we skip the deduction — the first payment
        // arrives later via addContribution on the detail screen.
        // Falls back silently to no-deduction if the user didn't pick
        // an account; the banner below will surface that.
        recordPrincipal: isFdrOrSavings && !!payoutAccountId,
      }));
      navigate('/investments');
    } catch (err) {
      showBanner({ what: 'Could not add investment', why: (err as Error).message, fix: 'Try again.' });
    }
  }

  const tone = TONE[type];
  const termMonthsNum = Number(termMonths) || 0;

  return (
    <form onSubmit={onSubmit} className="addpage">
      <Slip tone={tone}>
        <SlipHead
          what="New investment"
          title={isDps ? 'A monthly scheme' : type === 'fdr' ? 'A fixed deposit' : 'An interest account'}
          sub={
            isDps
              ? 'You pay a fixed amount every month and the bank grows it until the term ends.'
              : 'You park a lump sum for a fixed term and collect it back with interest.'
          }
        />

        {/* THE KIND — three stamps, each with its own question. */}
        <StampGroup label="Kind">
          <Stamp
            on={isDps}
            onClick={() => onChangeType('dps')}
            icon={<ArrowUp strokeWidth={2} />}
            title="DPS"
            sub="Every month"
          />
          <Stamp
            on={type === 'fdr'}
            onClick={() => onChangeType('fdr')}
            icon={<Clock strokeWidth={2} />}
            title="FDR"
            sub="Lump sum · fixed term"
          />
          <Stamp
            on={type === 'savings'}
            onClick={() => onChangeType('savings')}
            icon={<Clock strokeWidth={2} />}
            title="Savings"
            sub="Interest-bearing"
          />
        </StampGroup>

        {/* THE AMOUNT — the headline, and it means different things
            per kind, so the label follows the stamp. */}
        <SlipAmount
          label={isDps ? 'Every month' : 'Principal'}
          value={isDps ? monthlyContribution : principal}
          onChange={isDps ? setMonthlyContribution : setPrincipal}
          placeholder={isDps ? '5,000' : '100,000'}
          autoFocus
          invalid={amountInvalid}
        />

        {/* THE BLANKS. */}
        <Blank label="Name" empty={!name.trim()}>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="DPS #1"
            aria-label="Name"
          />
        </Blank>

        <Blank
          label="Rate"
          empty={rate === ''}
        >
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={rate}
            onChange={e => setRate(e.target.value)}
            placeholder="8"
            aria-label="Rate"
          />
        </Blank>

        {!isDps && (
          <BlankStack label="Term">
            <div className="chipset">
              <button
                type="button"
                className={`chipset__c${!useDays ? ' on' : ''}`}
                onClick={() => toggleUseDays(false)}
                aria-pressed={!useDays}
              >
                Months
              </button>
              <button
                type="button"
                className={`chipset__c${useDays ? ' on' : ''}`}
                onClick={() => toggleUseDays(true)}
                aria-pressed={useDays}
              >
                Days
              </button>
            </div>
          </BlankStack>
        )}

        {termInDays ? (
          <Blank label="Days" empty={termDays === ''}>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              value={termDays}
              onChange={e => setTermDays(e.target.value)}
              placeholder="15"
              aria-label="Term in days"
            />
          </Blank>
        ) : (
          <Blank label={isDps ? 'Months' : 'Term'}
            empty={termMonths === ''}>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              value={termMonths}
              onChange={e => setTermMonths(e.target.value)}
              placeholder="60"
              aria-label="Term in months"
            />
          </Blank>
        )}

        <Blank label="Starts on" empty={!startDate}>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            aria-label="Start date"
          />
        </Blank>

        <Blank
          label="Payout to"
          hint={isDps
            ? undefined
            : 'Required — the principal is deducted from this account now, and the maturity value returns here.'}
        >
          <Select value={payoutAccountId} onChange={e => setPayoutAccountId(e.target.value)} aria-label="Payout account">
            <option value="">— None —</option>
            {accs.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        </Blank>

        <Blank label="Institution" empty={!institution.trim()}>
          <input
            type="text"
            value={institution}
            onChange={e => setInstitution(e.target.value)}
            placeholder="Bank name"
            aria-label="Institution"
          />
        </Blank>

        {/* THE CLAUSE — where the money ends up. */}
        <Clause tone={tone} icon={<Clock strokeWidth={2} />}>
          {matPreview != null ? (
            <>
              Over {termInDays ? Number(termDays) : termMonthsNum}{' '}
              {termInDays ? 'days' : 'months'} you’d put in <b>{fmtBDT(putIn)}</b> and it would grow to{' '}
              <b>{fmtBDT(matPreview)}</b>
              {growth > 0 && <> — <b>{fmtBDT(growth)}</b> of interest</>}. Actual payout may differ.
            </>
          ) : (
            <>Fill in the amount, rate and term and this will show what the money grows to.</>
          )}
        </Clause>

        <SlipFoot
          note={
            isDps
              ? 'Each monthly installment is recorded on the scheme’s own page, and you choose the account each time.'
              : 'The principal leaves your account the moment you save this. The maturity value comes back to the same account.'
          }
        >
          <Button variant="outlined-ghost" type="button" onClick={() => navigate('/investments')}>Cancel</Button>
          <Button
            variant="outlined-primary"
            type="submit"
            disabled={!name.trim() || amountInvalid || !(Number(rate) >= 0) || !termValid}
          >
            Save investment
          </Button>
        </SlipFoot>
      </Slip>

      <div className="addpage__side">
        <Recap
          rows={[
            { k: 'Kind', v: isDps ? 'DPS' : type === 'fdr' ? 'FDR' : 'Savings', tone },
            {
              k: isDps ? 'Every month' : 'Principal',
              v: isDps
                ? (monthlyContribution.trim() ? fmtBDT(Number(monthlyContribution) || 0) : '—')
                : (principal.trim() ? fmtBDT(Number(principal) || 0) : '—'),
            },
            { k: 'Rate', v: rate.trim() ? `${Number(rate) || 0}% / yr` : '—' },
            {
              k: 'Term',
              v: termInDays
                ? (termDays.trim() ? `${Number(termDays) || 0} days` : '—')
                : (termMonths.trim() ? `${termMonthsNum} months` : '—'),
            },
            { k: 'Account', v: payoutAcc?.name ?? '—' },
            ...(matPreview != null
              ? [{ k: 'At maturity', v: fmtBDT(matPreview), total: true }]
              : [{ k: 'At maturity', v: '—', total: true }]),
          ]}
        />
        {payoutAcc && !isDps && Number(principal) > 0 && (
          <div className="notes" style={{ marginTop: 12 }}>
            <div className="note">
              {payoutAcc.name} goes from <b>{fmtBDT(payoutBal)}</b> to <b>{fmtBDT(payoutAfter)}</b> when
              you park the money.
            </div>
          </div>
        )}
      </div>
    </form>
  );
}
