/**
 * SyncStatusPill — always-visible cloud-sync status chip.
 *
 * Mounts in the empty theme-toggle slot at the bottom of the Shell
 * sidebar (see Shell.tsx around the comment block that used to host
 * the dark/light toggle). Reads `useSyncStatus()` so it re-renders on
 * every status transition.
 *
 * Status mapping (per the sync design):
 *   unconfigured                → "Cloud sync off"  (muted)
 *   signed-out                  → "Cloud off"        (muted)
 *   signed-in-synced            → "Synced · …"       (success)
 *   signed-in-syncing           → "Syncing…"         (info)
 *   signed-in-offline-queued    → "Offline · N pending" (warn)
 *   signed-in-error             → "Sync error"       (danger) — click surfaces a banner
 *
 * The pill is the entry-point for the AccountSection for two of these
 * states — clicking "Cloud off" navigates to Settings; clicking a
 * "Sync error" pill shows the error in a banner.
 */
import { useNavigate } from 'react-router-dom';
import { Pill } from './Pill';
import { useStore } from '../domain/store';
import { formatSyncError } from '../lib/errors';
import { useSyncStatus, type SyncStatus } from '../domain/sync';

function relativeTime(ms: number | null): string {
  if (ms === null) return 'never';
  const diff = Date.now() - ms;
  if (diff < 5_000) return 'just now';
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

/**
 * The label / tone / tooltip that the SyncStatusPill renders for a given
 * `SyncStatus`. Exported so other surfaces (e.g. AccountSection's inline
 * pill) can render the same status in the same way — single source of
 * truth, no chance of the pill and the AccountSection diverging.
 */
export function describeSyncStatus(status: SyncStatus): { label: string; tone: 'muted' | 'success' | 'info' | 'warn' | 'danger'; title: string } {
  switch (status.kind) {
    case 'unconfigured':
      return {
        label: 'Cloud sync off',
        tone: 'muted',
        title: 'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable cloud sync.',
      };
    case 'signed-out':
      return {
        label: 'Cloud off',
        tone: 'muted',
        title: 'Sign in from Settings → Account to sync across devices.',
      };
    case 'signed-in-synced':
      return {
        label: `Synced · ${relativeTime(status.lastSyncedAt)}`,
        tone: 'success',
        title: status.email
          ? `Last push to cloud: ${relativeTime(status.lastSyncedAt)} (${status.email})`
          : `Last push to cloud: ${relativeTime(status.lastSyncedAt)}`,
      };
    case 'signed-in-syncing':
      return {
        label: 'Syncing…',
        tone: 'info',
        title: 'Pushing your latest changes to the cloud.',
      };
    case 'signed-in-offline-queued':
      return {
        label: `Offline · ${status.pending} pending`,
        tone: 'warn',
        title: 'Reconnect to flush queued changes.',
      };
    case 'signed-in-error':
      return {
        label: 'Sync error',
        tone: 'danger',
        title: 'Click to see what went wrong.',
      };
  }
}

export function SyncStatusPill() {
  const status = useSyncStatus();
  const navigate = useNavigate();
  const showBanner = useStore(s => s.showBanner);

  const { label, tone, title } = describeSyncStatus(status);

  // Click handlers — signed-out goes to Settings; error shows a banner.
  const handleClick = () => {
    if (status.kind === 'signed-in-error') {
      const err = new Error(status.lastError);
      const formatted = formatSyncError(err);
      showBanner({ kind: 'error', what: formatted.what, why: formatted.why, fix: formatted.fix });
      return;
    }
    if (status.kind === 'signed-out' || status.kind === 'unconfigured') {
      navigate('/settings');
    }
  };

  const isInteractive =
    status.kind === 'signed-out'
    || status.kind === 'unconfigured'
    || status.kind === 'signed-in-error';

  return (
    <div className="px-2 pb-1">
      {isInteractive ? (
        <button
          type="button"
          onClick={handleClick}
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-pill"
          aria-label={title}
        >
          <Pill tone={tone} variant="soft">{label}</Pill>
        </button>
      ) : (
        <Pill tone={tone} variant="soft" title={title}>{label}</Pill>
      )}
    </div>
  );
}
