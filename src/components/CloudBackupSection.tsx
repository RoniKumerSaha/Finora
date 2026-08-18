/**
 * CloudBackupSection — Settings → Cloud backup card (GD-3.1, GD-3.2,
 * GD-3.3, GD-3.4, GD-4.5).
 *
 * Self-contained: owns the cloud lifecycle, picker state, and banner
 * surface. Receives only `showBanner` from the parent. Loaded via
 * React.lazy() in SettingsScreen so the V1.0 main bundle stays under
 * the 5 KB-gzip growth budget when the feature flag is off.
 */
import { useEffect, useState } from 'react';
import { Button } from './Button';
import { BackupPickerModal } from './BackupPickerModal';
import { fmtRelativeShort } from '../lib/format';
import {
  isGisReady,
  isFeatureEnabled,
  onGisReady,
  loadTokens,
  saveTokens,
  clearTokens,
  connect as gdriveConnect,
  disconnect as gdriveDisconnect,
  saveBackup as gdriveSaveBackup,
  listBackups as gdriveListBackups,
  fetchBackupText as gdriveFetchBackupText,
  GdriveError,
  type GdriveTokens,
  type BackupFile,
} from '../lib/googleDrive';
import { formatGdriveError } from '../lib/errors';
import { exportFilename, parseImport, ImportError } from '../lib/exportImport';
import { useStore } from '../domain/store';
import { useConfirm } from './ConfirmDialog';
import { isFileProtocol } from '../lib/envCheck';

interface ShowBannerArgs {
  kind: 'success' | 'error' | 'info';
  what: string;
  why: string;
  fix: string;
}
type ShowBanner = (b: ShowBannerArgs) => void;

export function CloudBackupSection({ showBanner }: { showBanner: ShowBanner }) {
  if (!isFeatureEnabled()) return null;

  const { confirm, dialog } = useConfirm();
  const [ready, setReady] = useState(isGisReady());
  const [tokens, setTokens] = useState<GdriveTokens | null>(() => loadTokens());
  const [working, setWorking] = useState(false);
  const [driveBackups, setDriveBackups] = useState<BackupFile[] | null>(null);
  const lastSavedAt = useStore((s) => s.state.settings.cloudBackup?.lastSavedAt);
  const importAndReplace = useStore((s) => s.importAndReplace);

  // GD-4.1 — hide the Cloud section on file:// origins. The GIS OAuth
  // popup cannot complete its redirect when the page is loaded from a
  // local file, so rendering the Connect button would just mislead.
  const fileProtocol = isFileProtocol();

  if (fileProtocol) return null;

  useEffect(() => {
    if (ready) return;
    const unsub = onGisReady(() => setReady(true));
    return unsub;
  }, [ready]);

  if (!ready) return null;

  async function onConnect() {
    try {
      const t = await gdriveConnect();
      setTokens(t);
      saveTokens(t);
    } catch (err) {
      showBanner({
        kind: 'error',
        what: 'Could not connect to Google Drive',
        why: (err as Error)?.message ?? 'The OAuth popup did not complete.',
        fix: 'Try again — make sure your browser allows popups for this site.',
      });
    }
  }

  async function onDisconnect() {
    const ok = await confirm({
      title: 'Disconnect Google Drive?',
      body: 'You can still use local backup. To reconnect, tap Connect Google Drive again.',
      confirmLabel: 'Disconnect',
      danger: true,
    });
    if (!ok) return;
    await gdriveDisconnect();
    clearTokens();
    setTokens(null);
    showBanner({
      kind: 'success',
      what: 'Disconnected from Google Drive',
      why: 'Your local backup is still on this device.',
      fix: 'Tap Connect Google Drive any time to resume cloud backups.',
    });
  }

  async function onSaveToDrive() {
    if (working) return;
    setWorking(true);
    try {
      const state = useStore.getState().state;
      const r = await gdriveSaveBackup(state);
      useStore.getState().setCloudBackupLastSavedAt(r.modifiedTime || new Date().toISOString());
      showBanner({
        kind: 'success',
        what: 'Saved to Drive',
        why: `File ${exportFilename()} was updated in your Finora backups folder.`,
        fix: 'Open drive.google.com to see it.',
      });
    } catch (err) {
      if (err instanceof GdriveError && err.code === 'auth_expired') {
        await gdriveDisconnect();
        clearTokens();
        setTokens(null);
        const e = formatGdriveError(err);
        showBanner({ kind: 'error', what: e.what, why: e.why, fix: e.fix });
      } else {
        const e = formatGdriveError(err);
        showBanner({ kind: 'error', what: e.what, why: e.why, fix: e.fix });
      }
    } finally {
      setWorking(false);
    }
  }

  async function confirmAndRestore(file: BackupFile) {
    const ok = await confirm({
      title: 'Restore from Drive?',
      body: `This will overwrite every account, transaction, goal, debt, investment, and plan currently in the app with the backup dated ${fmtRelativeShort(file.modifiedTime)}.`,
      confirmLabel: 'Restore',
      danger: true,
    });
    if (!ok) return;
    await actuallyRestore(file.id);
  }

  async function actuallyRestore(fileId: string) {
    setWorking(true);
    try {
      const text = await gdriveFetchBackupText(fileId);
      let parsed;
      try {
        parsed = parseImport(text);
      } catch (err) {
        if (err instanceof ImportError) {
          showBanner({ kind: 'error', what: err.what, why: err.why, fix: err.fix });
        } else {
          showBanner({
            kind: 'error',
            what: 'Import failed',
            why: (err as Error).message,
            fix: 'Try a different backup.',
          });
        }
        return;
      }
      const ok = await confirm({
        title: 'Replace current data with backup?',
        body: 'This will overwrite every account, transaction, goal, debt, and investment currently in the app.',
        confirmLabel: 'Replace',
        danger: true,
      });
      if (!ok) return;
      importAndReplace(parsed);
      showBanner({
        kind: 'success',
        what: 'Backup restored',
        why: 'Your data is now identical to the backup file.',
        fix: 'Open Home to see the totals.',
      });
    } catch (err) {
      if (err instanceof GdriveError && err.code === 'auth_expired') {
        await gdriveDisconnect();
        clearTokens();
        setTokens(null);
        const e = formatGdriveError(err);
        showBanner({ kind: 'error', what: e.what, why: e.why, fix: e.fix });
      } else {
        const e = formatGdriveError(err);
        showBanner({ kind: 'error', what: e.what, why: e.why, fix: e.fix });
      }
    } finally {
      setWorking(false);
    }
  }

  async function onRestoreFromDrive() {
    if (working) return;
    setWorking(true);
    try {
      const list = await gdriveListBackups();
      if (list.length === 0) {
        showBanner({
          kind: 'info',
          what: 'No backups found in your Finora backups folder.',
          why: 'Save one first.',
          fix: 'Open drive.google.com → Finora backups.',
        });
        return;
      }
      if (list.length === 1) {
        await confirmAndRestore(list[0]);
        return;
      }
      setDriveBackups(list);
    } catch (err) {
      if (err instanceof GdriveError && err.code === 'auth_expired') {
        await gdriveDisconnect();
        clearTokens();
        setTokens(null);
        const e = formatGdriveError(err);
        showBanner({ kind: 'error', what: e.what, why: e.why, fix: e.fix });
      } else {
        const e = formatGdriveError(err);
        showBanner({ kind: 'error', what: e.what, why: e.why, fix: e.fix });
      }
    } finally {
      setWorking(false);
    }
  }

  if (!tokens) {
    return (
      <section className="card">
        <h2 className="heading h3-modal mb-2">Cloud backup (Google Drive)</h2>
        <p className="text-[13px] text-muted mb-4">
          Save a backup to your Google Drive so you can restore from another device.
        </p>
        <Button variant="primary" onClick={onConnect}>
          Connect Google Drive
        </Button>
        {dialog}
      </section>
    );
  }

  return (
    <section className="card">
      <div className="flex items-start justify-between gap-3 mb-2">
        <h2 className="heading h3-modal m-0">Cloud backup (Google Drive)</h2>
        <button
          type="button"
          onClick={onDisconnect}
          disabled={working}
          className="text-[12.5px] font-semibold text-muted hover:text-ink hover:underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline"
        >
          Disconnect
        </button>
      </div>
      <p className="text-[13px] text-muted mb-1">
        Signed in as <span className="text-ink font-semibold">{tokens.email ?? 'Google account'}</span>.
      </p>
      <p className="text-[12.5px] text-muted mb-4">
        Last saved: <span className="text-ink">{fmtRelativeShort(lastSavedAt)}</span>
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          onClick={onSaveToDrive}
          disabled={working}
        >
          {working ? 'Saving…' : 'Save backup to Drive'}
        </Button>
        <Button
          variant="secondary"
          onClick={onRestoreFromDrive}
          disabled={working}
        >
          {working ? 'Working…' : 'Restore from Drive'}
        </Button>
      </div>
      {driveBackups && (
        <BackupPickerModal
          backups={driveBackups}
          onPick={(fileId) => {
            const picked = driveBackups.find((b) => b.id === fileId);
            setDriveBackups(null);
            if (picked) void confirmAndRestore(picked);
          }}
          onCancel={() => setDriveBackups(null)}
        />
      )}
      {dialog}
    </section>
  );
}