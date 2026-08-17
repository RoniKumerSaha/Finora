/**
 * InvestmentAddScreen — add a new investment (DPS / FDR / Savings).
 *
 * Type-aware: when type === 'dps', the form shows a monthlyContribution
 * field and the "principal" field is hidden (DPS is contribution-based).
 * Maturity preview uses annuity-due for DPS, simple interest otherwise.
 *
 * The payout-account dropdown shows the live balance beneath it, matching
 * the transfer form's From/To pattern so users see what'll receive the
 * maturity value.
 *
 * 2026-08-14 polish: header section, polished review callout with
 * subtle accent surface, refined spacing rhythm.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../domain/store';
import * as investments from '../domain/investments';
import * as accounts from '../domain/accounts';
import { Button } from '../components/Button';
import { Field, Input, Select } from '../components/Field';
import { accountBalance } from '../domain/math';
import { fmtBDT } from '../lib/format';
import { isPositiveMoney, POSITIVE_MONEY_ERROR } from '../lib/validation';
import type { InvestmentType } from '../domain/types';

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

  // Inline guard (spine: ux-finora-2026-08-14-negative-guard).
  // Principal applies only to non-DPS (FDR / savings); monthlyContribution
  // applies only to DPS. Each field independently validates.
  const principalInvalid = !isPositiveMoney(principal);
  const monthlyInvalid = !isPositiveMoney(monthlyContribution);
  const invalidClass = 'border-danger focus:border-danger focus:ring-danger/30';

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
    try {
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
      }));
      navigate('/investments');
    } catch (err) {
      showBanner({ what: 'Could not add investment', why: (err as Error).message, fix: 'Try again.' });
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6 max-w-md">
      <header>
        <h1 className="heading h1-screen">Add investment</h1>
        <div className="text-muted text-[13px] mt-1.5">DPS, FDR, or interest-bearing savings.</div>
      </header>

      <section className="card flex flex-col gap-5">
        <Field label="Name">
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="DPS #1, Main FDR…" autoFocus />
        </Field>
        <Field label="Type">
          <Select value={type} onChange={e => setType(e.target.value as InvestmentType)}>
            <option value="dps">DPS (monthly installment)</option>
            <option value="fdr">FDR (lump-sum, fixed term)</option>
            <option value="savings">Savings (interest-bearing)</option>
          </Select>
        </Field>
        {isDps ? (
          <Field label="Monthly contribution" hint="What you pay each month into this DPS." error={monthlyInvalid ? POSITIVE_MONEY_ERROR : undefined}>
            <Input
              type="number"
              inputMode="decimal"
              value={monthlyContribution}
              onChange={e => setMonthlyContribution(e.target.value)}
              placeholder="5000"
              aria-invalid={monthlyInvalid || undefined}
              className={monthlyInvalid ? invalidClass : ''}
            />
          </Field>
        ) : (
          <Field label="Principal" hint="The amount you're placing into this investment." error={principalInvalid ? POSITIVE_MONEY_ERROR : undefined}>
            <Input
              type="number"
              inputMode="decimal"
              value={principal}
              onChange={e => setPrincipal(e.target.value)}
              placeholder="100000"
              aria-invalid={principalInvalid || undefined}
              className={principalInvalid ? invalidClass : ''}
            />
          </Field>
        )}
        <Field label="Rate (% per year)" hint="Annual rate. Simple interest for FDR/savings (compounded monthly for DPS).">
          <Input type="number" inputMode="decimal" value={rate} onChange={e => setRate(e.target.value)} placeholder="8" />
        </Field>
        <Field label="Start date">
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </Field>
        {!isDps && (
          <label className="flex items-center gap-2 text-[13px] text-muted -mt-2">
            <input
              type="checkbox"
              checked={useDays}
              onChange={e => toggleUseDays(e.target.checked)}
              className="accent-[var(--accent)]"
            />
            <span>Use days instead of months (for short-term terms &lt; 1 month)</span>
          </label>
        )}
        {termInDays ? (
          <Field label="Term (days)" hint="For short-term deposits under a month. Maturity = start + this many days.">
            <Input type="number" inputMode="numeric" value={termDays} onChange={e => setTermDays(e.target.value)} placeholder="15" />
          </Field>
        ) : (
          <Field label="Term (months)" hint="Use the same number of months as your bank contract.">
            <Input type="number" inputMode="numeric" value={termMonths} onChange={e => setTermMonths(e.target.value)} placeholder="12" />
          </Field>
        )}
        <Field label="Payout account (optional)" hint="Where the matured value lands.">
          <Select value={payoutAccountId} onChange={e => setPayoutAccountId(e.target.value)}>
            <option value="">— None —</option>
            {accs.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
          {payoutAccountId && (
            <div className="text-xs text-muted mt-1.5 tabular">
              Balance: {fmtBDT(accountBalance(accs.find(a => a.id === payoutAccountId), state.transactions))}
            </div>
          )}
        </Field>
        <Field label="Institution (optional)" hint="Bank or NBFI holding this investment.">
          <Input value={institution} onChange={e => setInstitution(e.target.value)} placeholder="Bank name…" />
        </Field>
        {matPreview != null && (
          <div
            className="rounded-btn px-3.5 py-3 text-[13px] leading-relaxed"
            style={{
              background: 'var(--accent-soft)',
              border: '1px solid var(--accent)',
              boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--accent) 30%, transparent)',
              color: 'var(--ink)',
            }}
          >
            <div>
              <strong style={{ color: 'var(--accent)' }}>Review:</strong> You'll receive about{' '}
              <strong className="tabular">৳{Math.round(matPreview).toLocaleString('en-IN')}</strong>{' '}
              at maturity <span className="opacity-70">(projection — actual payout may differ).</span>
            </div>
            <div className="text-muted text-[12.5px] mt-1">
              {isDps
                ? 'Annuity-due: monthly contribution compounded at the stated rate for the full term.'
                : termInDays
                  ? 'Formula: principal × (1 + rate/100 × termDays/365). Simple interest, no compounding.'
                  : 'Formula: principal × (1 + rate/100 × termMonths/12). Simple interest, no compounding.'}
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <Button
            variant="primary"
            type="submit"
            disabled={
              !name.trim()
              || (isDps ? monthlyInvalid : principalInvalid)
              || !(Number(rate) >= 0)
              || !termValid
            }
          >
            Save investment
          </Button>
          <Button variant="ghost" onClick={() => navigate('/investments')}>Cancel</Button>
        </div>
      </section>
    </form>
  );
}