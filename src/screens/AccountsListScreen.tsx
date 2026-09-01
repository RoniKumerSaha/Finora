/**
 * AccountsListScreen — one card per account, matching the Goals grid.
 *
 * Visual target: docs/ux-designs/.../mockups/v2/dark.html#accounts
 *
 * 2026-08-18 polish: each account is now its own .card surface instead
 * of a row inside a shared .card. The lift on hover (via .card-link)
 * makes the click target obvious — important now that destructive
 * actions live behind the `⋯` overflow menu instead of an inline link.
 * Cards arrange responsively: 1 column on mobile, 2 on sm, 3 on lg.
 *
 * 2026-08-31 polish: every card now carries the same richer treatment
 * inspired by the liabilities design — a soft-tone background wash,
 * a 3px left accent strip in the account's tone colour, a "Δ since
 * opening" line (gains/ losses vs opening balance), and a "last
 * activity" heartbeat. The wash colour follows accountTone (not
 * balance sign), so all cards get the same richer treatment while
 * preserving the existing icon-tile colour families. Suppressed
 * entirely for brand-new accounts with no opening and no transactions.
 *
 * Edit/Delete live in the card's overflow menu (top-right). The
 * RowMenu's trigger sits above the card's hover lift via z-index, so
 * clicking it doesn't trigger the link navigation.
 */
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../domain/store';
import * as accounts from '../domain/accounts';
import { accountBalance, lastAccountActivity } from '../domain/math';
import { useConfirm } from '../components/ConfirmDialog';
import { RowMenu } from '../components/RowMenu';
import { AccountTypeIcon, accountTypeLabel, accountTone, accountTileClass, accountTileStyle, accountBalanceColor } from '../components/AccountTypeIcon';
import { EmptyState, AccountsIllustration } from '../components/EmptyState';
import type { Account } from '../domain/types';
import { DeleteError } from '../domain/accounts';
import { fmtBDT, fmtRelative } from '../lib/format';
import { leftBarClass, type CardTone } from '../lib/cardSurface';

/**
 * Inline wash for the account card — the only card surface in the app
 * that still carries the warm gradient. Lives locally because the
 * shared `cardSurfaceStyle` helper was removed (no other screen uses
 * it). Combines:
 *   - a 14%-opaque page-bg tint
 *   - a top-down linear gradient using the tone colour, blended with
 *     `var(--bg)` so the wash darkens in dark mode and tints deeper in
 *     light mode.
 */
function accountCardSurfaceStyle(tone: CardTone): React.CSSProperties {
  const toneVar =
    tone === 'primary' ? 'var(--primary)' :
    tone === 'danger'  ? 'var(--danger)'  :
    tone === 'accent'  ? 'var(--accent)'  :
    tone === 'warn'    ? 'var(--warn)'    :
    tone === 'success' ? 'var(--success)' :
    tone === 'info'    ? 'var(--info)'    :
                         'var(--muted)';
  return {
    backgroundColor: 'color-mix(in srgb, var(--bg) 14%, transparent)',
    backgroundImage: `linear-gradient(to bottom, color-mix(in srgb, ${toneVar} 20%, var(--bg)) 0%, color-mix(in srgb, ${toneVar} 16%, transparent) 35%, transparent 80%)`,
  };
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
          <div className="text-muted text-[13px] mt-1.5 tabular">{accs.length} total</div>
        </div>
        <Link
          to="/accounts/add"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-btn font-bold text-[13px] text-primary-on hover:opacity-95 active:translate-y-px transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          style={{ background: 'var(--primary)' }}
        >
          <span className="text-base leading-none">+</span>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
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
            // Map AccountTone → CardTone so the shared wash helper
            // can render the same gradient + left-bar treatment as
            // Debts / Investments / Plans / Loans.
            const cardTone: CardTone =
              tone === 'accent'  ? 'accent' :
              tone === 'primary' ? 'primary' :
              tone === 'info'    ? 'info' :
              tone === 'danger'  ? 'danger' :
                                   'muted';
            return (
              <Link
                key={a.id}
                to={`/accounts/${a.id}/edit`}
                className={`card card-link relative overflow-hidden flex flex-col gap-3 pl-7 pr-5 py-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30`}
                style={accountCardSurfaceStyle(cardTone)}
              >
                {/* 3px left accent strip — same colour as the wash. */}
                <span
                  aria-hidden
                  className={`absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full ${leftBarClass(cardTone)}`}
                />
                <div className="flex justify-between items-start gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-[10px] grid place-items-center shrink-0 ${accountTileClass(tone)}`}
                      style={accountTileStyle(tone)}
                    >
                      <AccountTypeIcon type={a.type} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-[15px] tracking-tight leading-tight line-clamp-2">{a.name}</div>
                      <div className="text-xs text-muted tabular mt-1">
                        {accountTypeLabel(a.type)}
                      </div>
                    </div>
                  </div>
                  {/* z-10 puts the menu above the lift, so clicking it
                      doesn't trigger navigation. */}
                  <div className="relative z-10">
                    <RowMenu
                      ariaLabel={`Actions for ${a.name}`}
                      items={[
                        { label: 'Edit',   onSelect: () => navigate(`/accounts/${a.id}/edit`) },
                        { label: 'Delete', tone: 'danger', onSelect: () => onDelete(a) },
                      ]}
                    />
                  </div>
                </div>
                <div className="flex items-baseline justify-between gap-2 mt-1">
                  <span className="text-[11px] text-muted uppercase tracking-wider font-semibold">Balance</span>
                  <span className={`font-bold tabular text-[20px] tracking-tight ${accountBalanceColor(tone)}`}>{fmtBDT(bal)}</span>
                </div>
                {(delta !== 0 || last) && (
                  <div className="flex justify-between items-baseline gap-2 text-[11.5px] tabular pt-2 border-t border-border-2">
                    <span
                      className={
                        delta === 0 ? 'text-muted'
                          : delta > 0 ? 'text-primary font-semibold'
                          : 'text-danger font-semibold'
                      }
                    >
                      {delta === 0
                        ? '— no change'
                        : delta > 0
                          ? `↑ +${fmtBDT(delta)}`
                          : `↓ −${fmtBDT(Math.abs(delta))}`}
                      {delta !== 0 && (
                        <span className="text-muted font-normal"> vs opening</span>
                      )}
                    </span>
                    <span className="text-muted text-right truncate min-w-0">
                      {last ? (
                        <>
                          {fmtRelative(last)}
                          {lastTxNote ? ` · ${lastTxNote}` : ''}
                        </>
                      ) : 'no activity yet'}
                    </span>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
      {dialog}
    </div>
  );
}