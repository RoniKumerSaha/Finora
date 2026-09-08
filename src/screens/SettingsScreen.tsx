import { useRef } from 'react';
import { useStore } from '../domain/store';
import { useConfirm } from '../components/ConfirmDialog';
import { Button } from '../components/Button';
import { SecuritySection } from '../security';
import { clearPin } from '../security/pin';
import { resetRateLimit } from '../security/rateLimit';
import { downloadExport, parseImport, ImportError } from '../lib/exportImport';
import { clearSyncRows } from '../domain/persistence';
import { AccountSection } from '../components/AccountSection';
import { syncEngine } from '../domain/sync';

/**
 * SettingsScreen — local-only app preferences.
 *
 * Spine: docs/ux-designs/ux-finora-2026-08-14-about-section/EXPERIENCE.md
 *
 * Two-column layout on desktop (>=768px): existing controls on the
 * left, an About panel on the right. On narrow viewports the layout
 * collapses to a single column with About rendered after the Danger
 * zone.
 */
export function SettingsScreen() {
  const importAndReplace = useStore(s => s.importAndReplace);
  const showBanner = useStore(s => s.showBanner);
  const { confirm, dialog } = useConfirm();
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Single destructive button — wipes everything, on this device AND
   * in the cloud (if signed in). The behaviour depends on sign-in
   * state:
   *
   *   - **Signed in**: confirmation copy says local + cloud will be
   *     deleted. Cloud is deleted FIRST so a failed network call
   *     aborts before we nuke local. Local wipe uses `reset()` (not
   *     `update()`) so the wiped state doesn't bump `stateUpdatedAt`
   *     and trigger a debounced re-push that would re-create the
   *     cloud row we just deleted.
   *   - **Signed out**: confirmation copy says only local will be
   *     deleted. The cloud copy is untouched — there is no cloud
   *     copy on this account's userId, and signing back in will
   *     pull whatever the user has on their other devices.
   *
   * In both branches we wipe the local IDB sync metadata and the
   * engine's in-memory metadata so the next boot (or the next sign-in)
   * treats the device as fresh.
   */
  async function onWipeEverything() {
    const signedIn = Boolean(syncEngine.getEmail());
    const body = signedIn
      ? 'Every account, transaction, goal, debt, investment, and plan will be deleted from THIS DEVICE and from your cloud copy on Supabase. This cannot be undone.'
      : 'Every account, transaction, goal, debt, investment, and plan will be deleted from this device. Your cloud copy (if any) is preserved so signing back in will restore the latest snapshot. This cannot be undone.';
    const ok = await confirm({
      title: 'Wipe all data?',
      body,
      confirmLabel: 'Wipe everything',
      danger: true,
    });
    if (!ok) return;

    // Cloud first — if it fails, abort before we nuke local.
    if (signedIn) {
      try {
        await syncEngine.deleteCloudCopy();
      } catch (err) {
        showBanner({
          kind: 'error',
          what: 'Couldn\'t delete cloud copy',
          why: (err as Error).message || 'The request failed.',
          fix: 'Check your connection and try again. Local data was NOT wiped.',
        });
        return;
      }
    }

    // Local: use `reset()` (not `update()`). `update()` would route
    // through `saveAndMaybeSync` and bump `stateUpdatedAt` to NOW,
    // then schedule a debounced push. For the signed-in branch that
    // push would re-create the cloud row we just deleted — wiping
    // data on this device AND clobbering whatever the user has on
    // other devices when they next reconcile. `reset()` clears IDB
    // and stamps the store to DEFAULT_STATE without bumping
    // `stateUpdatedAt` or scheduling a push.
    useStore.getState().reset();
    // PIN + rate-limit reset so a forgotten PIN doesn't strand the user.
    clearPin();
    resetRateLimit();
    // Wipe sync metadata so the next boot treats this device as fresh.
    // Without this, the engine would still think it has synced before
    // (lastSyncedAt in IDB), and the reconcile code path would skip
    // the empty-state guard — risking pushing empty local over the
    // other device's cloud row.
    await clearSyncRows();
    syncEngine.resetSyncMetadata();
    showBanner({
      kind: 'success',
      what: 'All data wiped',
      why: signedIn
        ? 'Your local store and cloud copy are now empty.'
        : 'Your local store is now empty. Your cloud copy (if any) is preserved — sign back in to restore.',
      fix: signedIn
        ? 'Add an account to start tracking again.'
        : 'Add an account to start tracking again, or sign back in to pull from the cloud.',
    });
  }

  function onExport() {
    const state = useStore.getState().state;
    const filename = downloadExport(state);
    showBanner({
      kind: 'success',
      what: `Downloaded ${filename}`,
      why: 'This file contains every account, transaction, goal, debt, and investment from your local store.',
      fix: 'Keep it somewhere safe — it\'s the only way to restore from a wipe.',
    });
  }

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-import of the same file
    if (!file) return;
    let text: string;
    try {
      text = await file.text();
    } catch {
      showBanner({
        kind: 'error',
        what: 'Could not read the file',
        why: 'The browser couldn\'t open the file you picked.',
        fix: 'Try a different file or copy-paste from TextEdit.',
      });
      return;
    }
    let parsed;
    try {
      parsed = parseImport(text);
    } catch (err) {
      if (err instanceof ImportError) {
        showBanner({ kind: 'error', what: err.what, why: err.why, fix: err.fix });
      } else {
        showBanner({ kind: 'error', what: 'Import failed', why: (err as Error).message, fix: 'Try a different file.' });
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
  }

  return (
    <div className="flex flex-col gap-6 max-w-[1100px]">
      <div>
        <h1 className="heading h1-screen">Settings</h1>
        <div className="text-muted text-[13px] mt-1.5">Backup and reset.</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-6 items-start">
        {/* Left column — existing controls */}
        <div className="flex flex-col gap-6">
          <SecuritySection />
          <AccountSection />
          <section className="card">
            <h2 className="heading h3-modal mb-4">Backup</h2>
            <div className="flex gap-2 flex-wrap">
              <Button variant="primary" onClick={onExport}>Export backup</Button>
              <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>Import backup</Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                onChange={onImportFile}
                className="hidden"
              />
            </div>
            <p className="text-xs text-muted mt-4">
              Save a JSON file to your device. Use Import to restore from a backup later (replaces all data after confirmation).
            </p>
          </section>

          <section
            className="rounded-card p-6"
            style={{
              background: 'var(--danger-callout-bg)',
              border: '1px solid var(--danger)',
              boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--danger) 35%, transparent)',
            }}
          >
            <h2 className="heading h3-modal mb-3" style={{ color: 'var(--danger-title)' }}>Danger zone</h2>
            <p className="text-[13px] text-muted mb-5">
              This action is destructive. Export first if unsure.
            </p>

            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1 max-w-prose">
                <div className="font-semibold text-[14px] text-ink">Wipe all data</div>
                <div className="text-[12px] text-muted mt-1">
                  Deletes every account, transaction, goal, debt, investment, and plan from this device{syncEngine.getEmail() ? ' and from your cloud copy on Supabase' : ''} — leaves the app as a clean install.
                </div>
              </div>
              <Button variant="danger" onClick={onWipeEverything} className="shrink-0">Wipe all data</Button>
            </div>
          </section>
        </div>

        {/* Right column — About */}
        <AboutPanel onReset={onWipeEverything} />
      </div>

      {dialog}
    </div>
  );
}

/* ---------- About panel ---------- */

function AboutPanel({ onReset }: { onReset: () => void | Promise<void> }) {
  const entryCount = useStore(s =>
    s.state.accounts.length +
    s.state.transactions.length +
    s.state.goals.length +
    s.state.debts.length +
    s.state.investments.length
  );

  const email = syncEngine.getEmail();

  // VITE_APP_VERSION is set at build time when a release is cut.
  // Hard-coded fallback matches package.json "version" (1.0.0).
  const version = (import.meta as any).env?.VITE_APP_VERSION || '1.0.0';

  return (
    <aside className="card">
      <h2 className="text-[11px] text-muted uppercase tracking-[0.08em] font-semibold m-0 mb-4">
        About
      </h2>

      <div className="heading h3-modal mb-2">Finora</div>
      <p className="text-[13px] text-muted leading-[1.5] mb-5">
        A quiet place for your money. Track what you have, where it goes, and what you're aiming for — without an account, an inbox, or a notification asking for anything back.
      </p>

      <dl className="flex flex-col gap-3 text-[12.5px] mb-5">
        <MetaRow label="Version" value={`v${version}`} />
        <MetaRow
          label="Privacy"
          value={
            email
              ? 'Stored on this device and synced to your cloud copy on Supabase. RLS scopes every read and write to your account.'
              : 'Stored on this device only. Cloud sync is opt-in — see the Cloud sync panel above.'
          }
          block
        />
        <MetaRow
          label="Storage"
          value={
            entryCount === 0
              ? 'Saved on this device only'
              : `Saved on this device · ${entryCount} ${entryCount === 1 ? 'entry' : 'entries'}`
          }
        />
      </dl>

      <div className="pt-4 border-t border-border flex flex-col gap-2.5">
        <button
          type="button"
          onClick={onReset}
          className="self-start text-primary text-[12.5px] font-semibold hover:underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-sm"
        >
          Erase everything and start over {'\u2192'}
        </button>
      </div>
    </aside>
  );
}

function MetaRow({ label, value, block }: { label: string; value: string; block?: boolean }) {
  return (
    <div className={block ? 'flex flex-col gap-1' : 'flex justify-between items-baseline gap-3'}>
      <dt className="text-muted">{label}</dt>
      <dd className={block ? 'text-ink leading-[1.45]' : 'text-ink text-right'}>{value}</dd>
    </div>
  );
}