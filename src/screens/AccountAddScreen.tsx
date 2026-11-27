/**
 * AccountAddScreen — open an account, as a slip.
 *
 * An account is the simplest record in the app: a name, a kind, and
 * what was already in it. There is no big decision here — the kind
 * barely changes anything downstream — so the amount takes the
 * headline slot (it is the number you actually know) and the kind
 * is a row of stamps rather than a dropdown, because a dropdown
 * hides the other four kinds and people forget that "mobile wallet"
 * is one of them.
 *
 * The kind also decides the COLOUR. An account keeps the tone it
 * was opened with everywhere else in the app — cash is gold, bank
 * is sage, wallet is blue, card is red — so the slip adopts it
 * here too. Pressing a different kind repaints the whole document,
 * which is the point: the colour is a preview of what the account
 * will look like on the list, not decoration.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../domain/store';
import * as accounts from '../domain/accounts';
import type { AccountType } from '../domain/types';
import { Button } from '../components/Button';
import {
  Blank,
  Clause,
  Recap,
  Slip,
  SlipAmount,
  SlipFoot,
  SlipHead,
  Stamp,
  StampGroup,
} from '../components/AddSlip';
import { AccountTypeIcon } from '../components/AccountTypeIcon';
import { fmtBDT } from '../lib/format';
import { isOptionalNonNegativeMoney } from '../lib/validation';

/** The colour each kind wears — the same mapping the Accounts list uses. */
const TONE: Record<AccountType, string> = {
  cash: 'var(--accent)',
  bank: 'var(--primary)',
  mobile_wallet: 'var(--info)',
  card: 'var(--danger)',
  other: 'var(--muted)',
};

const TYPE_LABEL: Record<AccountType, string> = {
  cash: 'Cash',
  bank: 'Bank',
  mobile_wallet: 'Wallet',
  card: 'Card',
  other: 'Other',
};

const TYPE_SUB: Record<AccountType, string> = {
  cash: 'Notes & coins',
  bank: 'Current account',
  mobile_wallet: 'bKash · Nagad',
  card: 'Debit or credit',
  other: 'Something else',
};

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

  const balance = Number(openingBalance) || 0;
  const tone = TONE[type];

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
    <form onSubmit={onSubmit} className="addpage">
      <Slip tone={tone}>
        <SlipHead
          what="New account"
          title="A place to keep money"
          sub="Cash in hand, a bank account, a wallet. Every transaction needs one of these to land in."
        />

        {/* THE KIND — four stamps, because a dropdown hides them.
            Each carries the pictogram the account will wear on the
            list, so the choice is visual, not a word to remember. */}
        <StampGroup label="Kind" cols={4}>
          <Stamp
            on={type === 'cash'}
            onClick={() => setType('cash')}
            icon={<AccountTypeIcon type="cash" className="w-[16px] h-[16px]" />}
            title="Cash"
            sub="Notes & coins"
          />
          <Stamp
            on={type === 'bank'}
            onClick={() => setType('bank')}
            icon={<AccountTypeIcon type="bank" className="w-[16px] h-[16px]" />}
            title="Bank"
            sub="Current account"
          />
          <Stamp
            on={type === 'mobile_wallet'}
            onClick={() => setType('mobile_wallet')}
            icon={<AccountTypeIcon type="mobile_wallet" className="w-[16px] h-[16px]" />}
            title="Wallet"
            sub="bKash · Nagad"
          />
          <Stamp
            on={type === 'card'}
            onClick={() => setType('card')}
            icon={<AccountTypeIcon type="card" className="w-[16px] h-[16px]" />}
            title="Card"
            sub="Debit or credit"
          />
        </StampGroup>

        {/* THE AMOUNT — what was already in it. */}
        <SlipAmount
          label="Opening balance"
          value={openingBalance}
          onChange={setOpeningBalance}
          placeholder="0"
          inputMode="decimal"
          invalid={openingInvalid}
        />

        {/* THE BLANKS. */}
        <Blank label="Name" empty={!name.trim()}>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Cash, Main Bank…"
            aria-label="Name"
          />
        </Blank>

        {/* THE CLAUSE — the consequence, written inside the document. */}
        <Clause tone={tone} icon={<AccountTypeIcon type={type} className="w-[16px] h-[16px]" />}>
          {name.trim() ? (
            <>
              <b>{name.trim()}</b> opens with <b>{fmtBDT(balance)}</b> and every transaction from now on
              counts towards it.
            </>
          ) : (
            <>Name this account and every transaction you record will land here.</>
          )}
        </Clause>

        <SlipFoot note="The opening balance is what you already had when you started tracking — not a transaction.">
          <Button variant="outlined-ghost" type="button" onClick={() => navigate('/accounts')}>Cancel</Button>
          <Button
            variant="outlined-primary"
            type="submit"
            disabled={openingInvalid || !name.trim()}
          >
            Save account
          </Button>
        </SlipFoot>
      </Slip>

      <div className="addpage__side">
        <Recap
          rows={[
            { k: 'Kind', v: TYPE_LABEL[type], tone },
            { k: 'Name', v: name.trim() || '—' },
            { k: 'Opening balance', v: openingBalance.trim() ? fmtBDT(balance) : '—', total: true },
          ]}
        />
        <div className="notes" style={{ marginTop: 12 }}>
          <div className="note">{TYPE_SUB[type]} — the kind is a label, so you can rename it later without changing any of your records.</div>
        </div>
      </div>
    </form>
  );
}
