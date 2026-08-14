import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../domain/store';
import * as accounts from '../domain/accounts';
import type { AccountType } from '../domain/types';
import { Button } from '../components/Button';
import { Field, Input, Select } from '../components/Field';
import { isNonNegativeMoney, NON_NEGATIVE_MONEY_ERROR } from '../lib/validation';

export function AccountEditScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const state = useStore(s => s.state);
  const update = useStore(s => s.update);
  const showBanner = useStore(s => s.showBanner);
  const acc = accounts.get(state, id!);
  const [name, setName] = useState(acc?.name ?? '');
  const [type, setType] = useState<AccountType>(acc?.type ?? 'cash');
  const [openingBalance, setOpeningBalance] = useState(String(acc?.openingBalance ?? 0));

  // Inline guard (spine: ux-finora-2026-08-14-negative-guard). Opening
  // balance uses the >= 0 rule. The pre-populated value is always
  // valid (the domain has already accepted it on save), so first-render
  // is fine; the user can break it by typing a negative value.
  const openingInvalid = !isNonNegativeMoney(openingBalance);
  const openingErrorClass = openingInvalid
    ? 'border-danger focus:border-danger focus:ring-danger/30'
    : '';

  if (!acc) {
    return <div className="text-muted">Account not found. <button className="underline" onClick={() => navigate('/accounts')}>Back to accounts</button></div>;
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      showBanner({ what: 'Account name is required', why: 'Accounts without a name cannot be identified in lists or transactions.', fix: 'Enter a name (e.g. "Cash", "DBBL Bank").' });
      return;
    }
    try {
      update(s => accounts.update(s, acc!.id, {
        name, type, openingBalance: Number(openingBalance) || 0,
      }));
      navigate('/accounts');
    } catch (err) {
      showBanner({ what: 'Could not update account', why: (err as Error).message, fix: 'Try again.' });
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6 max-w-md">
      <header>
        <h1 className="heading h1-screen">Edit account</h1>
        <div className="text-muted text-[13px] mt-1.5">Changes apply to this account only.</div>
      </header>
      <section className="card flex flex-col gap-5">
        <Field label="Name">
          <Input value={name} onChange={e => setName(e.target.value)} autoFocus />
        </Field>
        <Field label="Type">
          <Select value={type} onChange={e => setType(e.target.value as AccountType)}>
            {accounts.ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
          </Select>
        </Field>
        <Field label="Opening balance" error={openingInvalid ? NON_NEGATIVE_MONEY_ERROR : undefined}>
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
          <Button variant="primary" type="submit" disabled={openingInvalid || !name.trim()}>Save changes</Button>
          <Button variant="ghost" onClick={() => navigate('/accounts')}>Cancel</Button>
        </div>
      </section>
    </form>
  );
}