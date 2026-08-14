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
  const [payoutAccountId, setPayoutAccountId] = useState(accs[0]?.id ?? '');
  const [institution, setInstitution] = useState('');

  const isDps = type === 'dps';

  // Live preview:
  //   DPS:        M × ((1+r/1200)^T − 1) / (r/1200) × (1+r/1200)
  //   FDR/Save:   principal × (1 + rate/100 × termMonths/12)
  const matPreview = (() => {
    const T = Number(termMonths);
    const r = Number(rate);
    if (!(T > 0) || !(r >= 0)) return null;
    if (isDps) {
      const M = Number(monthlyContribution);
      if (!(M > 0)) return null;
      if (r === 0) return M * T;
      const rm = r / 100 / 12;
      return M * ((Math.pow(1 + rm, T) - 1) / rm) * (1 + rm);
    }
    const P = Number(principal);
    if (!(P > 0)) return null;
    return P * (1 + (r / 100) * (T / 12));
  })();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      showBanner({ what: 'Investment name is required', why: 'Investments without a name cannot be tracked.', fix: 'Enter a name (e.g. "DBBL DPS #1").' });
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
    if (!(Number(termMonths) > 0)) {
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
        termMonths: Number(termMonths),
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
      <h1 className="heading h1-screen">Add investment</h1>
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
      {isDps ? (
        <Field label="Monthly contribution" hint="What you pay each month into this DPS.">
          <Input type="number" inputMode="decimal" value={monthlyContribution} onChange={e => setMonthlyContribution(e.target.value)} placeholder="5000" />
        </Field>
      ) : (
        <Field label="Principal" hint="The amount you're placing into this investment.">
          <Input type="number" inputMode="decimal" value={principal} onChange={e => setPrincipal(e.target.value)} placeholder="100000" />
        </Field>
      )}
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
        {payoutAccountId && (
          <div className="text-xs text-muted mt-1.5">
            Balance: {fmtBDT(accountBalance(accs.find(a => a.id === payoutAccountId), state.transactions))}
          </div>
        )}
      </Field>
      <Field label="Institution (optional)">
        <Input value={institution} onChange={e => setInstitution(e.target.value)} placeholder="DBBL, EBL, BRAC Bank…" />
      </Field>
      {matPreview != null && (
        <div className="bg-accent-soft border border-accent rounded-md p-3 text-sm">
          <div>
            <strong>Review:</strong> You'll receive{' '}
            <strong className="tabular">৳{Math.round(matPreview).toLocaleString('en-IN')}</strong>{' '}
            at maturity.
          </div>
          <div className="text-muted">
            {isDps
              ? 'Annuity-due: monthly contribution compounded at the stated rate for the full term.'
              : 'Formula: principal × (1 + rate/100 × termMonths/12). Simple interest, no compounding.'}
          </div>
        </div>
      )}
      <div className="flex gap-2">
        <Button variant="primary" type="submit">Save investment</Button>
        <Button variant="ghost" onClick={() => navigate('/investments')}>Cancel</Button>
      </div>
    </form>
  );
}