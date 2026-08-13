import { Link } from 'react-router-dom';
import { useStore } from '../domain/store';
import * as accounts from '../domain/accounts';
import { accountBalance } from '../domain/math';
import { useConfirm } from '../components/ConfirmDialog';
import type { Account } from '../domain/types';
import { DeleteError } from '../domain/accounts';

export function AccountsListScreen() {
  const state = useStore(s => s.state);
  const update = useStore(s => s.update);
  const showBanner = useStore(s => s.showBanner);
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
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Accounts</h1>
        <Link to="/accounts/add" className="bg-primary text-primary-on px-4 py-2 rounded-md">Add Account</Link>
      </header>
      {accs.length === 0 ? (
        <div className="text-muted">No accounts yet.</div>
      ) : (
        <ul className="flex flex-col gap-2">
          {accs.map(a => {
            const bal = accountBalance(a, state.transactions);
            return (
              <li key={a.id} className="bg-surface border border-border rounded-md p-3 flex justify-between items-center">
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between gap-4">
                    <span className="font-medium">{a.name}</span>
                    <span>{fmtBDT(bal)}</span>
                  </div>
                  <div className="text-xs text-muted">{a.type} · opens at {fmtBDT(a.openingBalance)}</div>
                </div>
                <div className="flex gap-2">
                  <Link to={`/accounts/${a.id}/edit`} className="text-xs text-muted hover:text-ink">Edit</Link>
                  <button type="button" onClick={() => onDelete(a)} className="text-xs text-danger hover:underline">Delete</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {dialog}
    </div>
  );
}

function fmtBDT(n: number) {
  return '৳' + (Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}