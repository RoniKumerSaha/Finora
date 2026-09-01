import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../domain/store';
import * as accounts from '../domain/accounts';
import type { AccountType } from '../domain/types';
import { Button } from '../components/Button';
import { Field, Input, Select } from '../components/Field';
import { isOptionalNonNegativeMoney, NON_NEGATIVE_MONEY_ERROR } from '../lib/validation';

export function AccountAddScreen() {
  const navigate = useNavigate();
  const update = useStore(s => s.update);
  const showBanner = useStore(s => s.showBanner);
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('cash');
  const [openingBalance, setOpeningBalance] = useState('');

  // Inline guard (spine: ux-finora-2026-08-14-negative-guard).
  // Opening balance is optional — empty means "starts at zero". We
  // use the optional non-negative rule so the field doesn't show an
  // error the moment the user opens the modal with no value typed.
  const openingInvalid = !isOptionalNonNegativeMoney(openingBalance);
  const openingErrorClass = openingInvalid
    ? 'border-danger focus:border-danger focus:ring-danger/30'
    : '';

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      showBanner({ what: 'Account name is required', why: 'Accounts without a name cannot be identified in lists or transactions.', fix: 'Enter a name (e.g. "Cash", "Main Bank").' });
      return;
    }
    try {
      update(s => accounts.add(s, {
        name,
        type,
        openingBalance: Number(openingBalance) || 0,
      }));
      navigate('/accounts');
    } catch (err) {
      showBanner({ what: 'Could not add account', why: (err as Error).message, fix: 'Try again or check the form values.' });
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6 max-w-md">
      <header>
        <h1 className="heading h1-screen">Add account</h1>
        <div className="text-muted text-[13px] mt-1.5">Cash, bank, or mobile wallet.</div>
      </header>
      <section className="card flex flex-col gap-5">
        <Field label="Name">
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Cash, Wallet, Main Bank…" autoFocus />
        </Field>
        <Field label="Type" hint="Cash, bank account, or mobile wallet.">
          <Select value={type} onChange={e => setType(e.target.value as AccountType)}>
            {accounts.ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
          </Select>
        </Field>
        <Field label="Opening balance" hint="What you already had in this account at the moment you start tracking." error={openingInvalid ? NON_NEGATIVE_MONEY_ERROR : undefined}>
          <Input
            type="number"
            inputMode="decimal"
            value={openingBalance}
            onChange={e => setOpeningBalance(e.target.value)}
            aria-invalid={openingInvalid || undefined}
            className={openingErrorClass}
          />
        </Field>
        <div className="flex gap-2">
          <Button variant="outlined-primary" type="submit" disabled={openingInvalid || !name.trim()}>Save account</Button>
          <Button variant="outlined-ghost" onClick={() => navigate('/accounts')}>Cancel</Button>
        </div>
      </section>
    </form>
  );
}