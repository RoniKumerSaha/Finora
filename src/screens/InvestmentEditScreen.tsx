/**
 * InvestmentEditScreen — edit an existing investment.
 *
 * Type-aware: DPS shows a monthlyContribution field (read-only if
 * contributions already exist, since changing the plan would invalidate
 * the maturity value shown elsewhere). FDR/savings show principal.
 *
 * Routes: /investments/:id/edit
 */
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../domain/store';
import * as investments from '../domain/investments';
import * as accounts from '../domain/accounts';
import { Button } from '../components/Button';
import { Field, Input, Select } from '../components/Field';
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
  const [termMonths, setTermMonths] = useState(String(inv?.termMonths ?? ''));
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
    if (!(Number(termMonths) > 0)) {
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
        termMonths: Number(termMonths),
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
        <button type="button" onClick={() => navigate(`/investments/${inv!.id}`)} className="text-muted text-sm hover:text-ink">{'\u2190'} Back</button>
      </div>
      <h1 className="heading h1-screen">Edit investment</h1>
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
        <Field label="Principal" hint="The amount you've placed into this investment.">
          <Input type="number" inputMode="decimal" value={principal} onChange={e => setPrincipal(e.target.value)} />
        </Field>
      )}
      {type === 'dps' && (
        <Field
          label="Monthly contribution"
          hint={dpsLocked
            ? `Locked — ${linkedContributions} contributions already recorded.`
            : 'The amount you pay each month into this DPS.'}
        >
          <Input
            type="number"
            inputMode="decimal"
            value={monthlyContribution}
            onChange={e => setMonthlyContribution(e.target.value)}
            disabled={dpsLocked}
          />
        </Field>
      )}
      <Field label="Rate (% per year)" hint="Annual interest rate, e.g. 8 for 8%.">
        <Input type="number" inputMode="decimal" value={rate} onChange={e => setRate(e.target.value)} />
      </Field>
      <Field label="Start date">
        <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
      </Field>
      <Field label="Term (months)">
        <Input type="number" inputMode="numeric" value={termMonths} onChange={e => setTermMonths(e.target.value)} />
      </Field>
      <Field label="Payout account (optional)" hint="Where the matured value lands.">
        <Select value={payoutAccountId} onChange={e => setPayoutAccountId(e.target.value)}>
          <option value="">— None —</option>
          {accs.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select>
      </Field>
      <Field label="Institution (optional)">
        <Input value={institution} onChange={e => setInstitution(e.target.value)} placeholder="DBBL, EBL, BRAC Bank…" />
      </Field>
      <div className="flex gap-2">
        <Button variant="primary" type="submit">Save changes</Button>
        <Button variant="ghost" onClick={() => navigate(`/investments/${inv!.id}`)}>Cancel</Button>
      </div>
    </form>
  );
}