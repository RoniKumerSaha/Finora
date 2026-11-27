/**
 * AccountEditScreen — the account as a certificate you write on.
 *
 * 2026-11-26: the edit form used to be a grey form floating on the
 * page. Now the form IS the instrument: you write the new terms
 * straight onto the certificate, and the parts you cannot change —
 * the current balance, the transaction count — stay printed below a
 * dashed rule.
 *
 * The shell is the same perforated sheet as the goal receipt and the
 * debt certificate, so the three document families read as one
 * family. The seal at the top-right names the account's TYPE and
 * carries its tone (mint for a bank, gold for cash, blue for a
 * wallet, red for a card, neutral for the rest). Change the type and
 * the seal, the sheet's wash and the balance figure all change with
 * it — the type is the account's identity, so it should be visible
 * everywhere at once, not just in a dropdown.
 *
 * The TYPE control is a radio group rather than a `<select>`: five
 * options with a subtitle each is a set of choices to look at, not a
 * value to guess. It is a real radiogroup, so arrow keys move
 * between options and the checked option is announced.
 */
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../domain/store';
import * as accounts from '../domain/accounts';
import { accountBalance } from '../domain/math';
import type { AccountType } from '../domain/types';
import { Button } from '../components/Button';
import { Input } from '../components/Field';
import { accountTone, accountTypeLabel } from '../components/AccountTypeIcon';
import { isNonNegativeMoney, NON_NEGATIVE_MONEY_ERROR } from '../lib/validation';
import { fmtBDT } from '../lib/format';

const MIDDOT = '\u00B7';

/**
 * The account type options, with the one-line gloss each one shows
 * under its name. The gloss is what makes the difference between
 * "Cash" and "Other" obvious without reading the whole form.
 */
const TYPE_OPTIONS: ReadonlyArray<{ value: AccountType; title: string; gloss: string }> = [
  { value: 'cash',          title: 'Cash',          gloss: 'Notes & coins' },
  { value: 'bank',          title: 'Bank Account',  gloss: 'Ledger account' },
  { value: 'mobile_wallet', title: 'Mobile Wallet', gloss: 'bKash, Nagad' },
  { value: 'card',          title: 'Card',          gloss: 'Credit card' },
  { value: 'other',         title: 'Other',         gloss: 'Uncategorised' },
];

/**
 * A stable serial for an account.
 *
 * The app stores no account numbers, so a real one would be a lie.
 * This derives a stable four-digit number from the account id with
 * the same FNV-1a hash the Accounts list uses for its masked card
 * number — the same account always shows the same serial, so the
 * certificate does not shuffle between visits.
 */
function accountSerial(id: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return String(h % 10000).padStart(4, '0');
}

/**
 * A stable short reference for an account — "ACC-0001".
 *
 * Derived from the account's position among all accounts rather than
 * from its id, so the reference reads as an ordinal (the first
 * account you made is ACC-0001) and stays stable as long as the
 * account is not deleted and recreated.
 */
function accountRef(id: string, all: { id: string }[]): string {
  const i = all.findIndex(a => a.id === id);
  return `ACC-${String(i + 1).padStart(4, '0')}`;
}

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

  // The printed figures — the account's live state, which the form
  // cannot touch. They are read from the store, so they move as soon
  // as anything else in the app changes them.
  const balance = accountBalance(acc, state.transactions);
  const txCount = state.transactions.filter(tx =>
    tx.accountId === acc.id ||
    tx.fromAccountId === acc.id ||
    tx.toAccountId === acc.id,
  ).length;

  // The account's tone — the colour identity that runs through the
  // seal, the wash and the balance figure. It follows the CHOSEN
  // type, so picking a different type recolours the certificate
  // while the user is still choosing.
  const tone = accountTone(type);
  const toneVar =
    tone === 'accent'  ? 'var(--accent)' :
    tone === 'primary' ? 'var(--primary)' :
    tone === 'info'    ? 'var(--info)' :
    tone === 'danger'  ? 'var(--danger)' :
                         'var(--muted)';

  const typeLabel = accountTypeLabel(type).toUpperCase();
  const sealLabel =
    type === 'cash'          ? 'CASH' :
    type === 'bank'          ? 'BANK' :
    type === 'mobile_wallet' ? 'WALLET' :
    type === 'card'          ? 'CARD' :
                               'TYPE';

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      showBanner({ what: 'Account name is required', why: 'Accounts without a name cannot be identified in lists or transactions.', fix: 'Enter a name (e.g. "Cash", "Main Bank").' });
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
    <form onSubmit={onSubmit} className="flex flex-col gap-6 max-w-2xl">
      <header>
        <h1 className="heading h1-screen">Edit account</h1>
      </header>

      <section
        className="acct-cert"
        style={{ ['--tone' as string]: toneVar }}
      >
        {/* ── The head: name, serial, and the type seal ── */}
        <div className="acct-cert__head">
          <div>
            <div className="acct-cert__name">{name.trim() || 'Untitled account'}</div>
            <div className="acct-cert__serial">
              NO. {accountSerial(acc.id)} {MIDDOT} {typeLabel} {MIDDOT} {accountRef(acc.id, state.accounts)}
            </div>
          </div>
          <span className="acct-cert__seal" aria-hidden>
            <span className="p">৳</span>
            <span className="l">{sealLabel}</span>
          </span>
        </div>

        <div className="acct-cert__rule" />

        {/* ── The name ── */}
        <div className="acct-cert__line">
          <div>
            <label className="acct-cert__label" htmlFor="acct-name">Name</label>
          </div>
          <Input
            id="acct-name"
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
          />
        </div>

        {/* ── The type — a radiogroup, not a dropdown ── */}
        <div className="acct-cert__line">
          <div>
            <span className="acct-cert__label" id="acct-type-label">Type</span>
          </div>
          <div
            className="acct-typepick"
            role="radiogroup"
            aria-labelledby="acct-type-label"
          >
            {TYPE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={type === opt.value}
                className="acct-typeopt"
                onClick={() => setType(opt.value)}
              >
                <div className="t">{opt.title}</div>
                <div className="s">{opt.gloss}</div>
              </button>
            ))}
          </div>
        </div>

        {/* ── The opening balance ── */}
        <div className="acct-cert__line">
          <div>
            <label className="acct-cert__label" htmlFor="acct-opening">Opening balance</label>
          </div>
          <div>
            <Input
              id="acct-opening"
              type="number"
              inputMode="decimal"
              value={openingBalance}
              onChange={e => setOpeningBalance(e.target.value)}
              aria-invalid={openingInvalid || undefined}
              className={openingErrorClass}
            />
            {openingInvalid
              ? <div className="acct-cert__err">{NON_NEGATIVE_MONEY_ERROR}</div>
              : <div className="acct-cert__hint">Must be zero or more.</div>}
          </div>
        </div>

        <div className="acct-cert__rule" />

        {/* ── The printed figures — what the form cannot touch ── */}
        <div className="acct-cert__foot">
          <div>
            <div className="k">Current balance</div>
            <div className="n" style={{ color: toneVar }}>{fmtBDT(balance)}</div>
          </div>
          <div>
            <div className="k">Transactions</div>
            <div className="n n--count" style={{ color: 'var(--ink)' }}>{txCount}</div>
          </div>
        </div>

        {/* The one thing a reader of this form cannot work out for
            themselves: the opening balance MOVES the current balance,
            and the history stays put. The old note led with "Opening
            balance is where the ledger starts" — but that is what
            the field label and its hint already said, two inches
            above. */}
        <div className="acct-cert__note">
          Changing the opening balance moves the current balance by the same amount, and{' '}
          <em>every historical figure on this account stays exactly where it was</em>.
        </div>

        <div className="flex gap-2 mt-[18px]">
          <Button variant="outlined-primary" type="submit" disabled={openingInvalid || !name.trim()}>Save changes</Button>
          <Button variant="outlined-ghost" onClick={() => navigate('/accounts')}>Cancel</Button>
        </div>
      </section>
    </form>
  );
}
