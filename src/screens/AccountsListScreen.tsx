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
 * Edit/Delete live in the card's overflow menu (top-right). The
 * RowMenu's trigger sits above the card's hover lift via z-index, so
 * clicking it doesn't trigger the link navigation.
 */
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../domain/store';
import * as accounts from '../domain/accounts';
import { accountBalance } from '../domain/math';
import { useConfirm } from '../components/ConfirmDialog';
import { RowMenu } from '../components/RowMenu';
import { AccountTypeIcon, accountTypeLabel, accountTone, accountTileClass, accountBalanceColor } from '../components/AccountTypeIcon';
import { EmptyState, AccountsIllustration } from '../components/EmptyState';
import type { Account } from '../domain/types';
import { DeleteError } from '../domain/accounts';
import { fmtBDT } from '../lib/format';

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
            return (
              <Link
                key={a.id}
                to={`/accounts/${a.id}/edit`}
                className="card card-link flex flex-col gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-[10px] grid place-items-center shrink-0 ${accountTileClass(tone)}`}>
                      <AccountTypeIcon type={a.type} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-[15px] tracking-tight leading-tight line-clamp-2 min-h-[2.6em]">{a.name}</div>
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
                {a.openingBalance > 0 && (
                  <div className="text-[11.5px] text-muted tabular">
                    Opening: {fmtBDT(a.openingBalance)}
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