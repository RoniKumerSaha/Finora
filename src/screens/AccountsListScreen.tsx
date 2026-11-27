/**
 * AccountsListScreen — one bank card per account.
 *
 * 2026-11-26: each account is now a physical BANK CARD rather than a
 * tinted tile. The card carries the ISO 1.586/1 ratio, a gold chip,
 * the account type top-right, a masked card number centred on the
 * face, the account name as the cardholder line, and the balance
 * bottom-right. Each account TYPE gets its own dark gradient — bank
 * green, cash gold, wallet blue, credit-card red, other neutral — so
 * the type still reads at a glance, now through the face's colour
 * rather than a pictogram.
 *
 * The "Δ since opening" line and the "last activity" heartbeat sit
 * under the name, and are suppressed entirely for brand-new accounts
 * with no opening and no transactions.
 *
 * Edit/Delete live in the card's overflow menu (top-right). The
 * RowMenu's trigger sits above the card's hover lift via z-index, so
 * clicking it doesn't trigger the link navigation. The dropdown
 * itself renders in a portal — the card has `overflow: hidden`, so an
 * in-flow menu would be clipped by its rounded corners.
 */
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../domain/store';
import * as accounts from '../domain/accounts';
import { accountBalance, lastAccountActivity } from '../domain/math';
import { useConfirm } from '../components/ConfirmDialog';
import { RowMenu } from '../components/RowMenu';
import { accountTypeLabel, accountTone } from '../components/AccountTypeIcon';
import { EmptyState, AccountsIllustration } from '../components/EmptyState';
import type { Account } from '../domain/types';
import { DeleteError } from '../domain/accounts';
import { fmtBDT, fmtRelative } from '../lib/format';
import { type CardTone } from '../lib/cardSurface';

/* ---------------- Account card faces ---------------- */

/**
 * The tone's raw colour, as a CSS value. The card face uses it for
 * the corner glow, so the account's type still reads at a glance the
 * way it did under the old wash.
 */
const TONE_VAR: Record<CardTone, string> = {
  primary: 'var(--primary)',
  danger:  'var(--danger)',
  accent:  'var(--accent)',
  warn:    'var(--warn)',
  success: 'var(--success)',
  info:    'var(--info)',
  muted:   'var(--muted)',
  cyan:    'var(--cyan)',
};

/**
 * Each account TYPE gets its own card gradient.
 *
 * The old screen told the types apart by a tint; the card keeps that
 * language but as a full face — a bank card is green, a cash card is
 * gold, a wallet card is blue, a credit card is red. The gradients
 * stay dark and low-chroma so the white balance figure on top of
 * them keeps its contrast.
 */
const CARD_GRADIENT: Record<string, string> = {
  // Bank — the deep green of a bank card.
  bank: 'linear-gradient(135deg, #14201C 0%, #1B2C26 42%, #24382F 74%, #16211D 100%)',
  // Cash — warm gold, kept dark enough for white text.
  cash: 'linear-gradient(135deg, #1E1A12 0%, #2B2417 42%, #3A3020 74%, #201A12 100%)',
  // Mobile wallet — cool blue.
  mobile_wallet: 'linear-gradient(135deg, #121A22 0%, #18242F 42%, #1F3040 74%, #141C24 100%)',
  // Credit card — deep red.
  card: 'linear-gradient(135deg, #1F1513 0%, #2C1C19 42%, #3B2622 74%, #211615 100%)',
  // Anything else — a neutral slate.
  other: 'linear-gradient(135deg, #171C1B 0%, #1F2523 42%, #29302D 74%, #1A201E 100%)',
};

/** The gradient for an account type, falling back to the neutral one. */
function cardGradient(type: string): string {
  return CARD_GRADIENT[type] ?? CARD_GRADIENT.other;
}

/**
 * A stable pseudo card number for an account.
 *
 * The app stores no card numbers, so a real one would be a lie. This
 * derives a stable 16-digit-looking string from the account id — the
 * same account always shows the same digits, so the face does not
 * shuffle between visits — and masks all but the last four.
 */
function maskedAccountNumber(id: string): string {
  // FNV-1a: a small, fast, well-distributed hash. We only need it to
  // be stable, not cryptographically strong.
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  // Twelve digits, formatted as three groups of four.
  const digits = String(h).padStart(12, '0').slice(-12);
  const groups = digits.match(/.{4}/g) ?? [];
  // Only the LAST group shows; the first two are masked.
  return `•••• •••• •••• ${groups[2]}`;
}

/**
 * The classic bank card (A1).
 *
 * A gold chip top-left, the account type top-right, the masked card
 * number centred on the face, the account name as the cardholder line
 * bottom-left, and the balance bottom-right. The face's gradient
 * comes from the account's type.
 */
function AccountCard({
  a, bal, delta, last, tone, menu,
}: {
  a: Account;
  bal: number;
  delta: number;
  last: string | null;
  tone: CardTone;
  menu: React.ReactNode;
}) {
  return (
    <div
      className="acct-card acct-card--sheen"
      style={{
        ['--tone' as string]: TONE_VAR[tone],
        backgroundImage: cardGradient(a.type),
      }}
    >
      <div className="flex items-center gap-2.5">
        <span className="acct-chip" aria-hidden />
        <span className="acct-type truncate ml-auto">{accountTypeLabel(a.type)}</span>
        {/* The overflow menu sits in the card's own top row, so the
            type label never runs underneath it. */}
        <div className="shrink-0 -mr-1 -mt-1 relative z-10">
          {menu}
        </div>
      </div>

      {/* The card number, centred on the face — the one line a bank
          card always puts in the middle. */}
      <div className="flex-1 flex items-center justify-center">
        <span className="acct-num">{maskedAccountNumber(a.id)}</span>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="acct-name truncate">{a.name}</div>
          {/* A brand-new account has neither a delta nor any activity,
              so the whole secondary block is suppressed — the card
              shows only the name and the balance. */}
          {(delta !== 0 || last) && (
            <div data-acct-secondary>
              <div className={`acct-delta mt-1 truncate ${delta === 0 ? 'acct-delta--flat' : delta > 0 ? 'acct-delta--up' : 'acct-delta--down'}`}>
                {delta === 0 ? '— no change' : delta > 0 ? `↑ ${fmtBDT(delta)}` : `↓ ${fmtBDT(Math.abs(delta))}`}
                {delta !== 0 && <span className="text-muted font-normal"> vs opening</span>}
              </div>
              {last && <div className="acct-delta acct-delta--flat truncate mt-0.5">{last}</div>}
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="acct-bal-label">Balance</div>
          <div className={`acct-bal t-22 leading-tight mt-0.5 ${bal < 0 ? 'acct-bal--neg' : ''}`}>
            {fmtBDT(bal)}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AccountsListScreen() {
  const state = useStore(s => s.state);
  const update = useStore(s => s.update);
  const showBanner = useStore(s => s.showBanner);
  const navigate = useNavigate();
  const { confirm, dialog } = useConfirm();
  const accs = accounts.list(state);

  async function onDelete(acc: Account) {
    const ok = await confirm({
      title: `Delete "${acc.name}"?`,
      body: 'This cannot be undone. Linked transactions must be removed first.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      update(s => accounts.remove(s, acc.id));
    } catch (err) {
      if (err instanceof DeleteError) {
        showBanner({
          what: `Can't delete "${acc.name}"`,
          why: `${err.txCount} transaction(s) still reference this account.`,
          fix: 'Delete the linked transactions first, or archive them.',
        });
      } else {
        showBanner({ what: 'Delete failed', why: (err as Error).message, fix: 'Try again.' });
      }
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap justify-between items-end gap-2">
        <div>
          <h1 className="heading h1-screen">Accounts</h1>
          <div className="text-muted t-13 mt-1.5 tabular">{accs.length} total</div>
        </div>
        <Link
          to="/accounts/add"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-btn font-bold t-13 text-primary-on hover:opacity-95 active:translate-y-px transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          style={{ background: 'var(--primary)' }}
        >
          <span className="t-13 leading-none">+</span>
          <span>Add</span>
        </Link>
      </div>

      {accs.length === 0 ? (
        <section className="card">
          <EmptyState
            illustration={<AccountsIllustration />}
            title="No accounts yet"
            description="Open an account for cash, a bank, a wallet, or a card. Each account tracks what's there now."
            cta={{ to: '/accounts/add', label: '+ Add your first account' }}
            learnMoreTopic="accounts"
          />
        </section>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {accs.map(a => {
            const bal = accountBalance(a, state.transactions);
            const tone = accountTone(a.type);
            const opening = Number(a.openingBalance) || 0;
            const delta = bal - opening;
            const last = lastAccountActivity(a, state.transactions);
            // Find the most recent transaction that matches the same
            // link rule used by accountBalance so we can surface a
            // short "category or note" hint next to the date.
            const lastTx = last
              ? state.transactions.find(t =>
                  t.date === last &&
                  ((t.type !== 'transfer' && t.accountId === a.id) ||
                   (t.type === 'transfer' && (t.fromAccountId === a.id || t.toAccountId === a.id))),
                )
              : null;
            const lastTxNote = lastTx?.note
              || (lastTx?.categoryId
                ? state.categories.find(c => c.id === lastTx.categoryId)?.name
                : null)
              || null;
            // Map AccountTone → CardTone so the card faces can render
            // the same tone language as Debts / Investments / Plans /
            // Loans.
            const cardTone: CardTone =
              tone === 'accent'  ? 'accent' :
              tone === 'primary' ? 'primary' :
              tone === 'info'    ? 'info' :
              tone === 'danger'  ? 'danger' :
                                   'muted';
            // The card's heartbeat line — when the account last moved,
            // and what it moved on. Null when the account has never
            // moved, so the card renders no secondary block at all.
            const activity = last
              ? `${fmtRelative(last)}${lastTxNote ? ` · ${lastTxNote}` : ''}`
              : null;
            return (
              <Link
                key={a.id}
                to={`/accounts/${a.id}/edit`}
                className="card-link rounded-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 block"
                aria-label={`${a.name}. ${accountTypeLabel(a.type)}. Balance ${fmtBDT(bal)}.`}
              >
                <AccountCard
                  a={a}
                  bal={bal}
                  delta={delta}
                  last={activity}
                  tone={cardTone}
                  menu={
                    /* Edit/Delete live in the overflow menu, which sits
                       above the card's hover lift via z-index so clicking
                       it doesn't trigger the link navigation. */
                    <RowMenu
                      ariaLabel={`Actions for ${a.name}`}
                      items={[
                        { label: 'Edit',   onSelect: () => navigate(`/accounts/${a.id}/edit`) },
                        { label: 'Delete', tone: 'danger', onSelect: () => onDelete(a) },
                      ]}
                    />
                  }
                />
              </Link>
            );
          })}
        </div>
      )}
      {dialog}
    </div>
  );
}