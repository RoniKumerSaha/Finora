/**
 * AccountSection — Settings → Cloud sync panel.
 *
 * Two states:
 *   - signed-out: explains what cloud sync does, lets the user open
 *     SignInDialog to send a magic link, and offers a toggle to
 *     enable sync (the toggle is meaningless until signed in but
 *     we surface it so the user can pre-commit to the choice).
 *   - signed-in: shows email + last-synced timestamp, exposes
 *     "Force sync now" and "Sign out". The "Delete cloud copy" action
 *     lives in the parent SettingsScreen's Danger zone so it follows
 *     the existing destructive-action convention.
 *
 * Reads `useSyncStatus()` for the live state and `useStore` for the
 * settings toggle. Doesn't own any state besides the SignInDialog's
 * open flag.
 */
import { useState } from 'react';
import { Button } from './Button';
import { SignInDialog } from './SignInDialog';
import { useSyncStatus, syncEngine } from '../domain/sync';
import { useStore } from '../domain/store';

function relativeTime(ms: number | null): string {
  if (ms === null) return 'never';
  const diff = Date.now() - ms;
  if (diff < 5_000) return 'just now';
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export function AccountSection() {
  const status = useSyncStatus();
  const cloudSyncEnabled = useStore(s => s.state.settings.cloudSyncEnabled ?? false);
  const setCloudSyncEnabled = useStore(s => s.setCloudSyncEnabled);
  const recordSignOut = useStore(s => s.recordSignOut);
  const showToast = useStore(s => s.showToast);
  const [signInOpen, setSignInOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (status.kind === 'unconfigured') {
    return (
      <section className="card">
        <h2 className="heading h3-modal mb-4">Cloud sync</h2>
        <div
          className="text-[13px] text-muted rounded-btn px-3.5 py-2.5"
          style={{ background: 'var(--surface-2)' }}
        >
          Cloud sync is disabled in this build. Set <code>BASE_URL</code> and
          {' '}<code>BASE_ANON_KEY</code> in <code>.env.local</code> to enable it.
        </div>
      </section>
    );
  }

  async function onForceSync() {
    if (busy) return;
    setBusy(true);
    try {
      await syncEngine.forceSync();
      showToast({ kind: 'success', what: 'Sync complete' });
    } catch (err) {
      showToast({ kind: 'error', what: (err as Error).message || 'Sync failed' });
    } finally {
      setBusy(false);
    }
  }

  async function onSignOut() {
    if (busy) return;
    setBusy(true);
    try {
      await syncEngine.signOut();
      recordSignOut();
      showToast({ kind: 'success', what: 'Signed out' });
    } catch (err) {
      showToast({ kind: 'error', what: (err as Error).message || 'Sign out failed' });
    } finally {
      setBusy(false);
    }
  }

  const signedIn = status.kind !== 'signed-out';
  const email = syncEngine.getEmail();
  const lastSynced = syncEngine.getLastSyncedAt();

  return (
    <section className="card">
      <h2 className="heading h3-modal mb-4">Cloud sync</h2>

      {signedIn ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <div className="text-[11px] text-muted uppercase tracking-[0.08em] font-semibold">
              Signed in as
            </div>
            <div className="text-[14px] text-ink">{email ?? '(unknown email)'}</div>
          </div>
          <div className="flex flex-col gap-1">
            <div className="text-[11px] text-muted uppercase tracking-[0.08em] font-semibold">
              Last synced
            </div>
            <div className="text-[14px] text-ink">{relativeTime(lastSynced)}</div>
          </div>
          <div className="flex gap-2 flex-wrap pt-1">
            <Button variant="primary" onClick={onForceSync} disabled={busy}>
              {busy ? 'Syncing…' : 'Force sync now'}
            </Button>
            <Button variant="secondary" onClick={onSignOut} disabled={busy}>
              Sign out
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-[13px] text-muted leading-relaxed">
            Sync your data across devices with end-to-end RLS-scoped storage. Optional —
            Finora works fine without it, and local data is never deleted when you sign out.
          </p>
          <div className="flex gap-2 flex-wrap">
            <Button variant="primary" onClick={() => setSignInOpen(true)}>
              Sign in
            </Button>
          </div>
        </div>
      )}

      {/* Toggle is always shown so the user can pre-commit; the engine
          ignores it until signed-in. */}
      <label className="flex items-center gap-3 mt-5 pt-5 cursor-pointer" style={{ borderTop: '1px solid var(--border)' }}>
        <input
          type="checkbox"
          checked={cloudSyncEnabled}
          onChange={e => setCloudSyncEnabled(e.target.checked)}
          className="w-4 h-4 rounded border-border accent-primary"
        />
        <span className="text-[13px] text-ink">
          Enable cloud sync
          <span className="block text-[11.5px] text-muted mt-0.5">
            When off, your data stays on this device only.
          </span>
        </span>
      </label>

      <SignInDialog open={signInOpen} onClose={() => setSignInOpen(false)} />
    </section>
  );
}