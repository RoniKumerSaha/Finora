/**
 * AddTransactionForm — the add-transaction screen, as a SLIP.
 *
 * The screen is ONE document: the entry you are about to write into
 * your ledger, drawn at full width with its blanks still open. You
 * fill it in place.
 *
 * That shape comes from three decisions:
 *
 *   1. **The amount is the headline.** It is the one thing you always
 *      know the moment you open the screen, so it gets the biggest
 *      type on the page — not a field among fields.
 *
 *   2. **The direction is a stamp you press, not a dropdown.** Came
 *      in / Went out / Moved are all visible at once, so you always
 *      see the alternative you are not choosing. This matters most
 *      here: "I withdrew cash from the ATM" reads like an expense
 *      until you remember it is your own money walking to another
 *      account — and a dropdown hides that option behind a closed
 *      list.
 *
 *   3. **The consequence is a clause of the record**, written inside
 *      the document: "Cash goes from ৳ 53,500 to ৳ 51,000". It is not
 *      a toast bolted under the form, where most phones never see it.
 *
 * The three per-type routes (`/transactions/new/{expense,income,
 * transfer}`) still work — they set which stamp starts pressed — but
 * pressing a different stamp on the slip switches the whole document
 * under your hands, because that is what the direction decides.
 *
 * Linked-investment payout prefill (income only):
 *   When the user picks a `linkedInvestmentId`, auto-sync the Account
 *   field to the investment's payoutAccountId. If the user subsequently
 *   changes Account away from the payout destination, we show a soft
 *   warning ('Payout account for this investment is X. You're sending
 *   to Y.') but don't block the save — the user knows best.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useStore } from '../domain/store';
import * as accounts from '../domain/accounts';
import * as transactions from '../domain/transactions';
import { Button } from '../components/Button';
import { Select, Textarea } from '../components/Field';
import { CategoryGrid, PresetChips } from '../components/TypePicker';
import {
  Blank,
  BlankStack,
  Clause,
  Effects,
  Recap,
  Slip,
  SlipAmount,
  SlipFoot,
  SlipHead,
  Stamp,
  StampGroup,
} from '../components/AddSlip';
import { isPositiveMoney } from '../lib/validation';
import { ArrowLeftRight, ArrowDown, ArrowUp, Check } from '../components/icons/Icons';
import type { TxType } from '../domain/types';
import { mergeDefaults } from '../domain/persistence';

interface AddTransactionFormProps {
  type: TxType;
  /** The old per-route heading. The slip derives its own head from the
   *  pressed stamp, so this is accepted but no longer used. */
  title?: string;
  /** Same as `title` — kept so the route wrappers need no change. */
  subtitle?: string;
}

/** Each direction wears its own colour, and the whole slip follows. */
const TONE: Record<TxType, string> = {
  income: 'var(--primary)',
  expense: 'var(--danger)',
  transfer: 'var(--info)',
};

/** The stamp labels — plain words, plus the examples that decide. */
const DIRECTIONS: Array<{
  key: TxType;
  title: string;
  sub: string;
  icon: React.ReactNode;
}> = [
  { key: 'income',   title: 'Came in', sub: 'Salary · interest',      icon: <ArrowUp strokeWidth={2} /> },
  { key: 'expense',  title: 'Went out', sub: 'Groceries · rent',       icon: <ArrowDown strokeWidth={2} /> },
  { key: 'transfer', title: 'Moved',   sub: 'Between accounts',        icon: <ArrowLeftRight strokeWidth={2} /> },
];

export function AddTransactionForm({ type: initialType }: AddTransactionFormProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const update = useStore(s => s.update);
  const showBanner = useStore(s => s.showBanner);
  const showToast = useStore(s => s.showToast);
  const state = useStore(s => s.state);
  const accs = accounts.list(state);

  // The direction is local state, seeded from the route. Pressing a
  // stamp switches it — and the whole document below reshapes.
  const [type, setType] = useState<TxType>(initialType);

  const today = new Date().toISOString().slice(0, 10);

  // Prefill from URL search params (used by deep-link flows like DPS
  // "Record maturity payout" which lands here with amount/account/note
  // already set).
  const prefillAmount = searchParams.get('amount') ?? '';
  const prefillDate = searchParams.get('date') ?? today;
  const prefillAccountId = searchParams.get('accountId') ?? '';
  const prefillLinkedInvestmentId = searchParams.get('linkedInvestmentId') ?? '';
  const prefillNote = searchParams.get('note') ?? '';

  const [amount, setAmount] = useState(prefillAmount);
  const [date, setDate] = useState(prefillDate || today);
  const [accountId, setAccountId] = useState(prefillAccountId || accs[0]?.id || '');
  const [fromAccountId, setFromAccountId] = useState(accs[0]?.id ?? '');
  const [toAccountId, setToAccountId] = useState(accs[1]?.id ?? accs[0]?.id ?? '');
  // Category is optional — start with nothing selected. The grouped picker
  // shows a soft "No category picked yet." pill until the user picks one,
  // and the user can clear the selection with the × button next to the
  // Selected pill.
  const [categoryId, setCategoryId] = useState('');
  const [linkedDebtId, setLinkedDebtId] = useState('');
  const [linkedInvestmentId, setLinkedInvestmentId] = useState(prefillLinkedInvestmentId);
  const [note, setNote] = useState(prefillNote);
  // One-shot confirm-state for the Save button. Flips true after a
  // successful save; the 600ms delay before navigate (below) is the
  // window in which the sage pulse + ✓ glyph renders. Reset on any
  // form change so a back-then-resubmit re-triggers the pulse.
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (saved) setSaved(false);
  }, [amount, accountId, fromAccountId, toAccountId, categoryId, date, note, linkedDebtId, linkedInvestmentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const cats = state.categories.filter(c => c.type === type);

  // When the user picks a From account that matches the current To
  // account, the To dropdown would be left holding an id that's no
  // longer in its options — the browser would render the first option
  // but `toAccountId` would still equal `fromAccountId`, producing a
  // transfer from X to X. Fix: re-pick To as the first account that
  // isn't the new From. The reverse case (To set equal to From) is
  // prevented by the To dropdown's filter, which omits the From.
  useEffect(() => {
    if (type !== 'transfer') return;
    if (fromAccountId && toAccountId === fromAccountId) {
      const next = accs.find(a => a.id !== fromAccountId);
      if (next) setToAccountId(next.id);
    }
  }, [fromAccountId, type, accs]);

  // Whenever the user picks a To account that matches From, nudge From
  // to a different account. The To dropdown already filters From out,
  // so this only fires if state was set programmatically or via back-
  // navigation. Symmetric to the previous effect.
  useEffect(() => {
    if (type !== 'transfer') return;
    if (toAccountId && fromAccountId === toAccountId) {
      const next = accs.find(a => a.id !== toAccountId);
      if (next) setFromAccountId(next.id);
    }
  }, [toAccountId, type, accs]);

  const activeDebts = type !== 'transfer'
    ? debtsForCurrentType(state, type)
    : [];

  // Linked-investment payout prefill (income only): when the user picks a
  // linkedInvestmentId, mirror its payoutAccountId into accountId. Skip
  // if the investment has no payoutAccountId set.
  const linkedInv = type === 'income' && linkedInvestmentId
    ? state.investments.find(i => i.id === linkedInvestmentId)
    : undefined;
  useEffect(() => {
    if (type !== 'income' || !linkedInv?.payoutAccountId) return;
    if (accountId !== linkedInv.payoutAccountId) {
      setAccountId(linkedInv.payoutAccountId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedInvestmentId, type]);

  const payoutMismatch = !!(
    type === 'income'
    && linkedInv?.payoutAccountId
    && accountId !== linkedInv.payoutAccountId
  );
  const payoutAccName = linkedInv?.payoutAccountId
    ? state.accounts.find(a => a.id === linkedInv.payoutAccountId)?.name
    : undefined;
  const selectedAccName = state.accounts.find(a => a.id === accountId)?.name;

  // Inline negative-amount guard (spine: ux-finora-2026-08-14-negative-guard).
  // Transactions use the strict > 0 rule (zero is meaningless).
  const amountInvalid = !isPositiveMoney(amount);

  const amountNum = Number(amount) || 0;

  // The consequence, computed from the live form.
  const fromBal = type === 'transfer'
    ? accountBalance(accs.find(a => a.id === fromAccountId), state.transactions)
    : 0;
  const toBal = type === 'transfer'
    ? accountBalance(accs.find(a => a.id === toAccountId), state.transactions)
    : 0;
  const singleBal = type === 'transfer'
    ? 0
    : accountBalance(accs.find(a => a.id === accountId), state.transactions);
  const afterSingle = type === 'income'
    ? singleBal + amountNum
    : type === 'expense'
      ? singleBal - amountNum
      : singleBal;

  const fromAcc = accs.find(a => a.id === fromAccountId);
  const toAcc = accs.find(a => a.id === toAccountId);
  const singleAcc = accs.find(a => a.id === accountId);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!(Number(amount) > 0)) {
      showBanner({
        kind: 'error',
        what: 'Amount must be greater than zero',
        why: 'Zero or negative amounts produce empty transactions.',
        fix: 'Enter a positive number, e.g. 1500.',
      });
      return;
    }
    try {
      update(s => transactions.add(s, {
        type,
        amount: Number(amount),
        date,
        categoryId: categoryId || undefined,
        accountId: type !== 'transfer' ? accountId : undefined,
        fromAccountId: type === 'transfer' ? fromAccountId : undefined,
        toAccountId: type === 'transfer' ? toAccountId : undefined,
        linkedDebtId: linkedDebtId || undefined,
        linkedInvestmentId: linkedInvestmentId || undefined,
        note,
      }));
      showToast({
        kind: 'success',
        what: 'Transaction added',
        why: 'Your record is now in the transactions list.',
      });
      setSaved(true);
      // 600ms lets the sage pulse + ✓ glyph register before the form
      // unmounts. Reverts to "instant" feel after v1 ships CTA pulse.
      window.setTimeout(() => navigate('/transactions'), 600);
    } catch (err) {
      showBanner({
        kind: 'error',
        what: 'Could not add transaction',
        why: (err as Error).message,
        fix: 'Check the form values and try again.',
      });
    }
  }

  const isTransfer = type === 'transfer';

  return (
    <form onSubmit={onSubmit} className="addpage">
      <Slip tone={TONE[type]}>
        <SlipHead
          what="New entry"
          title={isTransfer ? 'A transfer' : type === 'income' ? 'An income' : 'An expense'}
          sub={
            isTransfer
              ? 'Your money, moving. Two balances change — your net worth does not.'
              : type === 'income'
                ? 'One line in your ledger. This raises the balance of the account you name.'
                : 'One line in your ledger. This lowers the balance of the account you name.'
          }
        />

        {/* THE STAMP — the one big decision, pressed not selected. */}
        <StampGroup label="Direction">
          {DIRECTIONS.map(d => (
            <Stamp
              key={d.key}
              on={type === d.key}
              onClick={() => setType(d.key)}
              icon={d.icon}
              title={d.title}
              sub={d.sub}
            />
          ))}
        </StampGroup>

        {/* THE AMOUNT — the headline. */}
        <SlipAmount
          label={isTransfer ? 'Amount moved' : 'Amount'}
          value={amount}
          onChange={setAmount}
          placeholder={isTransfer ? '10,000' : type === 'expense' ? '2,500' : '60,000'}
          autoFocus
          invalid={amountInvalid}
        />

        {type === 'expense' && (
          <div className="pt-3">
            <PresetChips amounts={[50, 100, 250, 500, 1000]} onPick={n => setAmount(String(n))} />
          </div>
        )}

        {/* THE BLANKS. */}
        {isTransfer ? (
          <>
            <Blank label="From" hint="Where the money is now.">
              <Select value={fromAccountId} onChange={e => setFromAccountId(e.target.value)} aria-label="From">
                {accs.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </Blank>
            <Blank label="To" hint="Where the money is going.">
              <Select value={toAccountId} onChange={e => setToAccountId(e.target.value)} aria-label="To">
                {accs.filter(a => a.id !== fromAccountId).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </Blank>
            <Blank label="Date" hint="When it moved.">
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                aria-label="Date"
              />
            </Blank>
          </>
        ) : (
          <>
            <Blank label="Account" hint="The balance this entry changes.">
              <Select value={accountId} onChange={e => setAccountId(e.target.value)} aria-label="Account">
                {accs.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </Blank>

            <BlankStack
              label="Category (optional)"
              hint="Pick a category, or skip — transactions can be uncategorised."
            >
              {cats.length > 0 ? (
                <CategoryGrid
                  categories={cats}
                  selectedId={categoryId}
                  onPick={setCategoryId}
                  // Expenses ship 31+ categories — grouped sections make
                  // the list scannable. Income has 5 categories and stays
                  // flat. The emoji picker affordance was dropped from
                  // Add Transaction; chips are pure name tags now.
                  variant={type === 'expense' ? 'grouped' : 'flat'}
                />
              ) : (
                /* Self-heal: state.categories had zero entries of this
                   type (or was empty entirely — a known regression
                   from the v1 localStorage→IndexedDB window). Run the
                   same mergeDefaults pipeline the persistence layer
                   uses, persist, and re-render so chips appear. The
                   hint explains why the section is appearing empty. */
                <EmptyCategoryState type={type} />
              )}
            </BlankStack>

            <Blank label="Date" hint="When it happened.">
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                aria-label="Date"
              />
            </Blank>

            <Blank label="Note (optional)" hint="What was it for?" empty={!note.trim()}>
              <Textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder={type === 'expense' ? 'Lunch with team' : 'September salary'}
                aria-label="Note"
                className="min-h-[52px]"
              />
            </Blank>
          </>
        )}

        {/* The linked-debt block, shown only when it applies. */}
        {type === 'expense' && activeDebts.length > 0 && (
          <Blank label="Linked debt (optional)" hint="Tag this entry as a payment toward a debt.">
            <Select
              value={linkedDebtId}
              onChange={e => {
                setLinkedDebtId(e.target.value);
                if (e.target.value) setLinkedInvestmentId('');
              }}
              aria-label="Linked debt"
            >
              <option value="">— None —</option>
              {activeDebts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </Blank>
        )}

        {type === 'income' && activeDebts.filter(d => d.direction === 'owed_to_me').length > 0 && (
          <Blank label="Linked debt (optional)" hint="Tag this income as repayment of money someone owed you.">
            <Select
              value={linkedDebtId}
              onChange={e => {
                setLinkedDebtId(e.target.value);
                if (e.target.value) setLinkedInvestmentId('');
              }}
              aria-label="Linked debt"
            >
              <option value="">— None —</option>
              {activeDebts
                .filter(d => d.direction === 'owed_to_me')
                .map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </Blank>
        )}

        {type === 'income' && state.investments.filter(i => i.status !== 'closed').length > 0 && (
          <Blank label="Linked investment (optional)" hint="Routes the money to that investment's payout account.">
            <Select
              value={linkedInvestmentId}
              onChange={e => {
                setLinkedInvestmentId(e.target.value);
                if (e.target.value) setLinkedDebtId('');
              }}
              aria-label="Linked investment"
            >
              <option value="">— None —</option>
              {state.investments
                .filter(i => i.status !== 'closed')
                .map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </Select>
          </Blank>
        )}

        {payoutMismatch && (
          <div className="mt-4 text-[13px] text-warn bg-warn-soft border border-warn rounded-lg px-3 py-2">
            <strong>Heads up:</strong> payout account for <span className="font-semibold">{linkedInv?.name}</span> is{' '}
            <span className="font-semibold">{payoutAccName}</span>. You're sending this income to{' '}
            <span className="font-semibold">{selectedAccName}</span>. Saving will record the payout as Income to{' '}
            {selectedAccName}, not {payoutAccName}.
          </div>
        )}

        {/* THE CLAUSE — the consequence, written inside the document. */}
        {isTransfer ? (
          <>
            <Effects
              fromLabel="From"
              fromName={fromAcc?.name ?? '—'}
              fromBefore={fmtBDT(fromBal)}
              fromAfter={fmtBDT(fromBal - amountNum)}
              toLabel="To"
              toName={toAcc?.name ?? '—'}
              toBefore={fmtBDT(toBal)}
              toAfter={fmtBDT(toBal + amountNum)}
              arrow={<ArrowLeftRight strokeWidth={2} />}
            />
            <Clause tone={TONE[type]} icon={<ArrowLeftRight strokeWidth={2} />}>
              Two balances move. Your <b>net worth does not</b> — this is your own money, changing pockets.
            </Clause>
          </>
        ) : (
          <Clause tone={TONE[type]} icon={type === 'income' ? <ArrowUp strokeWidth={2} /> : <ArrowDown strokeWidth={2} />}>
            {!singleAcc ? (
              <>Pick an account to see what this entry does to your balance.</>
            ) : amountNum <= 0 ? (
              // With no amount typed, "goes from ৳ 53,500 to ৳ 53,500" is
              // a true sentence about nothing. Say what is pending instead.
              <>
                {singleAcc.name} sits at <b>{fmtBDT(singleBal)}</b>. Type an amount and
                this line will show where it lands.
              </>
            ) : (
              <>
                {singleAcc.name} goes from <b>{fmtBDT(singleBal)}</b> to <b>{fmtBDT(afterSingle)}</b>.
                This is the line that lands in your ledger.
              </>
            )}
          </Clause>
        )}

        <SlipFoot
          note={
            singleAcc && !isTransfer ? (
              <>
                Filed against <b>{singleAcc.name}</b>
                {categoryId ? <> under <b>{cats.find(c => c.id === categoryId)?.name}</b></> : null}.
                You can edit or delete it any time afterwards.
              </>
            ) : (
              <>A transfer is filed in your ledger but never counted as income or spending.</>
            )
          }
        >
          <Button variant="outlined-ghost" type="button" onClick={() => navigate('/transactions')}>Cancel</Button>
          <Button variant="outlined-primary" type="submit" disabled={amountInvalid} success={saved}>
            {saved ? <><Check strokeWidth={2.5} /> Saved</> : isTransfer ? 'Save transfer' : type === 'income' ? 'Save income' : 'Save expense'}
          </Button>
        </SlipFoot>
      </Slip>

      <div className="addpage__side">
        <Recap
          rows={
            isTransfer
              ? [
                  { k: 'Direction', v: 'Moved' },
                  { k: 'Amount moved', v: amount.trim() ? fmtBDT(amountNum) : '—' },
                  { k: 'From', v: fromAcc?.name ?? '—' },
                  { k: 'To', v: toAcc?.name ?? '—' },
                  { k: 'Net worth', v: 'unchanged', total: true },
                ]
              : [
                  { k: 'Direction', v: type === 'income' ? 'Came in' : 'Went out', tone: TONE[type] },
                  {
                    k: 'Amount',
                    v: amount.trim()
                      ? `${type === 'income' ? '+' : '−'}${fmtBDT(amountNum)}`
                      : '—',
                  },
                  { k: 'Account', v: singleAcc?.name ?? '—' },
                  { k: 'Category', v: cats.find(c => c.id === categoryId)?.name ?? '—' },
                  { k: `${singleAcc?.name ?? 'Account'} after`, v: fmtBDT(afterSingle), total: true },
                ]
          }
        />
      </div>
    </form>
  );
}

/* ---------- helpers ---------- */

import * as debts from '../domain/debts';
import { accountBalance } from '../domain/math';
import { fmtBDT } from '../lib/format';
import type { State } from '../domain/types';

/**
 * Self-heal component for the case where `state.categories` is empty
 * (or has zero entries of the current transaction type). Renders an
 * explanation + a single "Restore default categories" button that runs
 * the same mergeDefaults pipeline the persistence layer uses, persists
 * the result, and re-renders the picker.
 *
 * Why this exists: a 2026-09-02 bug introduced a window where a stale
 * `useStore` snapshot could be persisted over the user's data on reload
 * if the cache wasn't primed yet. That window is closed (see main.tsx
 * boot order) but some users had already been bitten — their IndexedDB
 * has the default-state category list (which has all 36 categories), so
 * they should NOT see this. Users who somehow see it (e.g. a partial
 * migration from a malformed localStorage blob) get a one-click recovery
 * instead of a permanently broken form.
 */
function EmptyCategoryState({ type }: { type: 'income' | 'expense' }) {
  const update = useStore(s => s.update);
  const showToast = useStore(s => s.showToast);

  function restore() {
    update(s => mergeDefaults(s));
    showToast({
      kind: 'success',
      what: 'Default categories restored',
      why: `Add ${type === 'income' ? 'income' : 'expense'} categories are ready again — any of your custom categories are kept.`,
    });
  }

  return (
    <div className="rounded-btn border border-warn/40 bg-warn-soft px-4 py-3 flex flex-col gap-2">
      <div className="text-[13px] text-ink">
        No <span className="font-semibold">{type === 'income' ? 'income' : 'expense'}</span> categories available.
        Your saved data is safe — only the category list needs restoring.
      </div>
      <div>
        <Button variant="outlined-primary" type="button" onClick={restore}>
          Restore default categories
        </Button>
      </div>
    </div>
  );
}

function debtsForCurrentType(state: State, _type: TxType) {
  return debts.list(state).filter(d => d.status === 'active');
}
