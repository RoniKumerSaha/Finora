/**
 * InvestmentEditScreen — edit an existing investment.
 *
 * Type-aware: DPS shows a monthlyContribution field (read-only if
 * contributions already exist, since changing the plan would invalidate
 * the maturity value shown elsewhere). FDR/savings show principal.
 *
 * Routes: /investments/:id/edit
 *
 * 2026-08-14 polish: header + card section pattern.
 */
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../domain/store';
import * as investments from '../domain/investments';
import * as accounts from '../domain/accounts';
import { Button } from '../components/Button';
import { Field, Input, Select } from '../components/Field';
import { isPositiveMoney, POSITIVE_MONEY_ERROR } from '../lib/validation';
import type { InvestmentType } from '../domain/types';

export function InvestmentEditScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const state = useStore(s => s.state);
  const update = useStore(s => s.update);
  const showBanner = useStore(s => s.showBanner);
  const accs = accounts.list(state);
  const inv = investments.get(state, id!);

  const [name, setName] = useState(inv?.name ?? '');
  const [type, setType] = useState<InvestmentType>(inv?.type ?? 'dps');
  const [principal, setPrincipal] = useState(String(inv?.principal ?? 0));
  const [monthlyContribution, setMonthlyContribution] = useState(String(inv?.monthlyContribution ?? 0));
  const [rate, setRate] = useState(String(inv?.rate ?? ''));
  const [startDate, setStartDate] = useState(inv?.startDate ?? new Date().toISOString().slice(0, 10));
  // Pre-select useDays when the existing record already carries a termDays
  // value. Falls back to months otherwise.
  const [termMonths, setTermMonths] = useState(String(inv?.termMonths ?? ''));
  const [termDays, setTermDays] = useState(String(inv?.termDays ?? ''));
  const [useDays, setUseDays] = useState(
    !!(inv?.termDays != null && Number(inv.termDays) > 0)
  );
  const [payoutAccountId, setPayoutAccountId] = useState(inv?.payoutAccountId ?? '');
  const [institution, setInstitution] = useState(inv?.institution ?? '');

  if (!inv) {
    return (
      <div className="text-muted">
        Investment not found.{' '}
        <button className="underline" onClick={() => navigate('/investments')}>Back to investments</button>
      </div>
    );
  }

  const linkedContributions = state.transactions.filter(t => t.linkedInvestmentId === inv.id).length;
  const hadContributions = linkedContributions > 0;
  const dpsLocked = type === 'dps' && hadContributions;

  // Inline guard (spine: ux-finora-2026-08-14-negative-guard).
  // Pre-populated values are valid; user can break them by typing.
  // Note: when dpsLocked is true the monthly contribution field is
  // disabled, so we don't apply the invalid class to it.
  const principalInvalid = type !== 'dps' && !isPositiveMoney(principal);
  const monthlyInvalid = type === 'dps' && !dpsLocked && !isPositiveMoney(monthlyContribution);
  const termInDays = type !== 'dps' && useDays;
  const termValid = termInDays
    ? Number(termDays) > 0
    : Number(termMonths) > 0;
  const invalidClass = 'border-danger focus:border-danger focus:ring-danger/30';

  function toggleUseDays(next: boolean) {
    setUseDays(next);
    if (next) setTermMonths('');
    else setTermDays('');
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      showBanner({ what: 'Investment name is required', why: 'Investments without a name cannot be tracked.', fix: 'Enter a name.' });
      return;
    }
    if (type !== 'dps' && !(Number(principal) > 0)) {
      showBanner({ what: 'Principal must be greater than zero', why: 'FDR and savings accounts need a lump-sum principal.', fix: 'Enter a positive number.' });
      return;
    }
    if (!(Number(rate) >= 0)) {
      showBanner({ what: 'Rate must be non-negative', why: 'Negative rates are not supported in V1.', fix: 'Enter 0 or a positive percent.' });
      return;
    }
    if (termInDays) {
      if (!(Number(termDays) > 0)) {
        showBanner({ what: 'Term must be a positive number of days', why: 'A zero-day term has no maturity date.', fix: 'Enter the term in days.' });
        return;
      }
    } else if (!(Number(termMonths) > 0)) {
      showBanner({ what: 'Term must be a positive number of months', why: 'A zero-month term has no maturity date.', fix: 'Enter the term in months.' });
      return;
    }
    if (type === 'dps' && !dpsLocked && !(Number(monthlyContribution) > 0)) {
      showBanner({ what: 'Monthly contribution is required', why: 'DPS calculates maturity from your monthly contribution.', fix: 'Enter a positive number.' });
      return;
    }
    try {
      update(s => investments.update(s, inv!.id, {
        name: name.trim(),
        type,
        principal: Number(principal) || 0,
        monthlyContribution: type === 'dps' ? Number(monthlyContribution) || 0 : undefined,
        rate: Number(rate),
        startDate,
        termMonths: termInDays ? 0 : Number(termMonths),
        termDays: termInDays ? Number(termDays) : undefined,
        payoutAccountId: payoutAccountId || undefined,
        institution: institution.trim() || undefined,
      }));
      navigate(`/investments/${inv!.id}`);
    } catch (err) {
      showBanner({ what: 'Could not update investment', why: (err as Error).message, fix: 'Try again.' });
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6 max-w-md">
      <div className="flex items-center gap-3">
        <Link to={`/investments/${inv!.id}`} className="text-muted text-sm hover:text-ink transition">{'\u2190'} Back</Link>
      </div>
      <header>
        <h1 className="heading h1-screen">Edit investment</h1>
        <div className="text-muted text-[13px] mt-1.5">Rate, term, and payout destination can change. Past contributions stay as they are.</div>
      </header>
      <section className="card flex flex-col gap-5">
        <Field label="Name">
          <Input value={name} onChange={e => setName(e.target.value)} autoFocus />
        </Field>
        <Field label="Type">
          <Select value={type} onChange={e => setType(e.target.value as InvestmentType)}>
            <option value="dps">DPS (monthly installment)</option>
            <option value="fdr">FDR (lump-sum, fixed term)</option>
            <option value="savings">Savings (interest-bearing)</option>
          </Select>
        </Field>
        {type !== 'dps' && (
          <Field label="Principal" hint="The amount you've placed into this investment." error={principalInvalid ? POSITIVE_MONEY_ERROR : undefined}>
            <Input
              type="number"
              inputMode="decimal"
              value={principal}
              onChange={e => setPrincipal(e.target.value)}
              aria-invalid={principalInvalid || undefined}
              className={principalInvalid ? invalidClass : ''}
            />
          </Field>
        )}
        {type === 'dps' && (
          <Field
            label="Monthly contribution"
            hint={dpsLocked
              ? `Locked — ${linkedContributions} contributions already recorded.`
              : 'The amount you pay each month into this DPS.'}
            error={monthlyInvalid ? POSITIVE_MONEY_ERROR : undefined}
          >
            <Input
              type="number"
              inputMode="decimal"
              value={monthlyContribution}
              onChange={e => setMonthlyContribution(e.target.value)}
              disabled={dpsLocked}
              aria-invalid={monthlyInvalid || undefined}
              className={monthlyInvalid ? invalidClass : ''}
            />
          </Field>
        )}
        <Field label="Rate (% per year)" hint="Annual rate. Simple interest for FDR/savings (compounded monthly for DPS).">
          <Input type="number" inputMode="decimal" value={rate} onChange={e => setRate(e.target.value)} />
        </Field>
        <Field label="Start date">
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </Field>
        {type !== 'dps' && (
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
          <Field label="Term (months)" hint="Changing this shifts the maturity date forward.">
            <Input type="number" inputMode="numeric" value={termMonths} onChange={e => setTermMonths(e.target.value)} />
          </Field>
        )}
        <Field label="Payout account (optional)" hint="Where the matured value lands.">
          <Select value={payoutAccountId} onChange={e => setPayoutAccountId(e.target.value)}>
            <option value="">— None —</option>
            {accs.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        </Field>
        <Field label="Institution (optional)">
          <Input value={institution} onChange={e => setInstitution(e.target.value)} placeholder="Bank name…" />
        </Field>
        <div className="flex gap-2">
          <Button
            variant="outlined-primary"
            type="submit"
            disabled={
              !name.trim()
              || principalInvalid
              || monthlyInvalid
              || !(Number(rate) >= 0)
              || !termValid
            }
          >
            Save changes
          </Button>
          <Button variant="outlined-ghost" onClick={() => navigate(`/investments/${inv!.id}`)}>Cancel</Button>
        </div>
      </section>
    </form>
  );
}