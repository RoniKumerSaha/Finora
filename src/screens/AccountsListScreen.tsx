/**
 * AccountsListScreen — single-row account rows in a card.
 *
 * Visual target: docs/ux-designs/.../mockups/v2/dark.html#accounts
 * Each row is a single flex row: icon + name/type on the left,
 * balance + overflow menu on the right.
 *
 * 2026-08-14 polish: subtler row hover (using .row-hover), refined
 * tile corners, and a tighter page header.
 *
 * 2026-08-14 polish (row hover accent): each row carries a left-edge
 * accent dot that fades in on hover (matches TransactionsListScreen),
 * and destructive actions live behind a `⋯` overflow menu instead of
 * being permanently visible red links.
 *
 * 2026-08-14 polish: the header carries an "Add" CTA — accounts are a
 * separate entity from transactions, so the global "Add transaction"
 * sidebar CTA doesn't help here. The empty-state still gets its own
 * contextual button so first-run users aren't stranded.
 */
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../domain/store';
import * as accounts from '../domain/accounts';
import { accountBalance } from '../domain/math';
import { useConfirm } from '../components/ConfirmDialog';
import { RowMenu } from '../components/RowMenu';
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

      <section className="card">
        {accs.length === 0 ? (
          <div className="py-10 text-center text-muted">
            <div className="text-[14px] font-semibold text-ink">No accounts yet.</div>
            <Link
              to="/accounts/add"
              className="inline-block mt-3.5 px-4 py-2.5 rounded-btn text-[13px] font-bold text-primary-on hover:opacity-95 transition"
              style={{ background: 'var(--primary)' }}
            >
              Add your first account
            </Link>
          </div>
        ) : (
          <div>
            {accs.map(a => {
              const bal = accountBalance(a, state.transactions);
              return (
                <div
                  key={a.id}
                  className="group relative flex justify-between items-center py-3 border-b border-border last:border-0 row-hover -mx-2 px-2 rounded transition"
                >
                  <span
                    aria-hidden
                    className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r-full opacity-0 group-hover:opacity-100 transition"
                    style={{ background: 'var(--primary)' }}
                  />
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-[10px] bg-surface-2 grid place-items-center text-primary font-bold text-[13px]">
                      {(a.name.trim()[0] || '\u09F3').toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-[14px] leading-tight tracking-tight">{a.name}</div>
                      <div className="text-xs text-muted leading-tight mt-1 tabular">
                        {accountTypeLabel(a.type)}{a.openingBalance > 0 ? ` · opens at ${fmtBDT(a.openingBalance)}` : ''}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-bold tabular text-[14px]">{fmtBDT(bal)}</span>
                    <RowMenu
                      ariaLabel={`Actions for ${a.name}`}
                      items={[
                        { label: 'Edit',   onSelect: () => navigate(`/accounts/${a.id}/edit`) },
                        { label: 'Delete', tone: 'danger', onSelect: () => onDelete(a) },
                      ]}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
      {dialog}
    </div>
  );
}

function accountTypeLabel(t: string): string {
  switch (t) {
    case 'cash': return 'Cash';
    case 'bank': return 'Bank Account';
    case 'mobile_wallet': return 'Mobile Wallet';
    case 'card': return 'Card';
    default: return 'Other';
  }
}