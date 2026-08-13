import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../domain/store';
import * as investments from '../domain/investments';
import * as accounts from '../domain/accounts';
import { Button } from '../components/Button';
import { Field, Input, Select } from '../components/Field';
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
  const [rate, setRate] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [termMonths, setTermMonths] = useState('');
  const [payoutAccountId, setPayoutAccountId] = useState(accs[0]?.id ?? '');
  const [institution, setInstitution] = useState('');

  // Live "review" calculation per UX flow.
  const mat = (Number(principal) > 0 && Number(rate) >= 0 && Number(termMonths) > 0)
    ? Number(principal) * (1 + (Number(rate) / 100) * (Number(termMonths) / 12))
    : null;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      showBanner({ what: 'Investment name is required', why: 'Investments without a name cannot be tracked.', fix: 'Enter a name (e.g. "DBBL DPS #1").' });
      return;
    }
    if (!(Number(principal) > 0)) {
      showBanner({ what: 'Principal must be greater than zero', why: 'You can\'t invest nothing or a negative amount.', fix: 'Enter a positive number.' });
      return;
    }
    if (!(Number(rate) >= 0)) {
      showBanner({ what: 'Rate must be a non-negative number', why: 'The rate is a percentage (e.g. 8 for 8%). Negative rates aren\'t supported in V1.', fix: 'Enter 0 or a positive percent.' });
      return;
    }
    if (!(Number(termMonths) > 0)) {
      showBanner({ what: 'Term must be a positive number of months', why: 'A zero-month term has no maturity date.', fix: 'Enter the term in months, e.g. 12 for 1 year.' });
      return;
    }
    try {
      update(s => investments.add(s, {
        name, type, principal: Number(principal), rate: Number(rate),
        startDate, termMonths: Number(termMonths),
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
      <h1 className="text-2xl font-semibold">Add investment</h1>
      <Field label="Name">
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="DBBL DPS #1, EBL FDR…" autoFocus />
      </Field>
      <Field label="Type">
        <Select value={type} onChange={e => setType(e.target.value as InvestmentType)}>
          <option value="dps">DPS (monthly installment)</option>
          <option value="fdr">FDR (lump-sum, fixed term)</option>
          <option value="savings">Savings (interest-bearing)</option>
        </Select>
      </Field>
      <Field label="Principal" hint="The amount you're placing into this investment.">
        <Input type="number" inputMode="decimal" value={principal} onChange={e => setPrincipal(e.target.value)} placeholder="100000" />
      </Field>
      <Field label="Rate (% per year)" hint="Annual interest rate, e.g. 8 for 8%.">
        <Input type="number" inputMode="decimal" value={rate} onChange={e => setRate(e.target.value)} placeholder="8" />
      </Field>
      <Field label="Start date">
        <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
      </Field>
      <Field label="Term (months)">
        <Input type="number" inputMode="numeric" value={termMonths} onChange={e => setTermMonths(e.target.value)} placeholder="12" />
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
      {mat != null && (
        <div className="bg-accent-soft border border-accent rounded-md p-3 text-sm">
          <div><strong>Review:</strong> You'll receive <strong>৳{mat.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</strong> at maturity.</div>
          <div className="text-muted">Formula: principal × (1 + rate/100 × termMonths/12). Simple interest, no compounding.</div>
        </div>
      )}
      <div className="flex gap-2">
        <Button variant="primary" type="submit">Save investment</Button>
        <Button variant="ghost" onClick={() => navigate('/investments')}>Cancel</Button>
      </div>
    </form>
  );
}