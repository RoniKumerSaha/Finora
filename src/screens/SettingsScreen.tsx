import { lazy, Suspense, useEffect, useRef } from 'react';
import { useStore } from '../domain/store';
import type { Theme } from '../domain/store';
import { useConfirm } from '../components/ConfirmDialog';
import { Button } from '../components/Button';
import { downloadExport, parseImport, ImportError } from '../lib/exportImport';
import { isFeatureEnabled } from '../lib/googleDrive';
import { isFileProtocol } from '../lib/envCheck';

// GD-4.5 — lazy-load the entire Cloud backup subsystem so the V1.0
// initial bundle stays under the 5 KB-gzip growth budget when the
// feature flag is off. The section lives in its own chunk that's only
// fetched on demand.
const CloudBackupSection = lazy(() =>
  import('../components/CloudBackupSection').then((m) => ({ default: m.CloudBackupSection })),
);

export function SettingsScreen() {
  const { confirm, dialog } = useConfirm();
  const theme = useStore((s) => s.state.settings.theme);
  const setTheme = useStore((s) => s.setTheme);
  const update = useStore((s) => s.update);
  const importAndReplace = useStore((s) => s.importAndReplace);
  const showBanner = useStore((s) => s.showBanner);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // GD-4.2 — when the flag is on AND the app is on file://, surface the
  // graceful-degradation notice so users know why Cloud isn't here.
  const fileProtocol = isFileProtocol();
  const flagOn = isFeatureEnabled();

  // GD-4.1 — console.warn when Cloud is unavailable because of file://.
  // Lives at screen-level so it fires regardless of whether the Cloud
  // chunk has been lazy-loaded yet (the section is gated by `flagOn`
  // above, which is the same condition the warn is for).
  //
  // The DEV gate is intentional but Vite snapshots `import.meta.env`
  // at module-eval, so we cannot flip it from a test setup file. We
  // skip the gate in production too — the cost is one console line on
  // file:// origins, which is exactly when we want to surface the why.
  useEffect(() => {
    if (!flagOn) return;
    if (!fileProtocol) return;
    console.warn(
      '[Finora] Cloud backup is unavailable on file:// origins. ' +
      'Host this build on the web (Netlify, Vercel, GitHub Pages) to enable Google Drive sync.',
    );
  }, [flagOn, fileProtocol]);

  async function onWipe() {
    const ok = await confirm({
      title: 'Wipe all data?',
      body: 'Every account, transaction, goal, debt, investment, and plan will be deleted. This cannot be undone.',
      confirmLabel: 'Wipe everything',
      danger: true,
    });
    if (!ok) return;
    update((s) => ({
      version: 1,
      accounts: [], transactions: [], goals: [], debts: [], investments: [], categories: [],
      monthPlans: [], eventPlans: [],
      settings: { ...s.settings, onboardingComplete: true },
    }));
    showBanner({
      kind: 'success',
      what: 'All data wiped',
      why: 'Your local store is now empty.',
      fix: 'Add an account to start tracking again.',
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
        <div className="text-muted text-[13px] mt-1.5">Theme, backup, and reset.</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-6 items-start">
        {/* Left column — existing controls */}
        <div className="flex flex-col gap-6">
          <section className="card">
            <h2 className="heading h3-modal mb-4">Theme</h2>
            <div className="flex gap-2 flex-wrap">
              {(['dark', 'light', 'auto'] as Theme[]).map((t) => {
                const active = theme === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTheme(t)}
                    className={[
                      'px-4 py-2.5 rounded-btn text-[13.5px] font-bold transition border',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                      active
                        ? 'bg-primary text-primary-on border-primary'
                        : 'bg-surface text-muted border-border hover:text-ink hover:bg-surface-2',
                    ].join(' ')}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                );
              })}
            </div>
          </section>

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
            {flagOn && (
              <div className="mt-5 pt-5 border-t border-border">
                <Suspense fallback={null}>
                  <CloudBackupSection showBanner={showBanner} />
                </Suspense>
              </div>
            )}
            {fileProtocol && flagOn && (
              <p
                className="text-[12.5px] text-muted mt-4"
                data-testid="file-protocol-notice"
              >
                Cloud backup requires hosting this app on the web. Use Export/Import or host the build on Netlify/Vercel/GitHub Pages to enable it.
              </p>
            )}
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
              This permanently deletes all data on this device. Export first if unsure.
            </p>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1 max-w-prose">
                <div className="font-semibold text-[14px] text-ink">Wipe everything</div>
                <div className="text-[12px] text-muted mt-1">
                  Deletes every account, transaction, goal, debt, investment, and plan — leaves the app as a clean install.
                </div>
              </div>
              <Button variant="danger" onClick={onWipe} className="shrink-0">Wipe all data</Button>
            </div>
          </section>
        </div>

        {/* Right column — About */}
        <AboutPanel onReset={onWipe} />
      </div>

      {dialog}
    </div>
  );
}

/* ---------- About panel ---------- */

function AboutPanel({ onReset }: { onReset: () => void | Promise<void> }) {
  const entryCount = useStore((s) =>
    s.state.accounts.length +
    s.state.transactions.length +
    s.state.goals.length +
    s.state.debts.length +
    s.state.investments.length,
  );

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
        A Bangladesh-first personal finance notebook. Local-only, single user, one currency (BDT ৳).
      </p>

      <dl className="flex flex-col gap-3 text-[12.5px] mb-5">
        <MetaRow label="Version" value={`v${version}`} />
        <MetaRow
          label="Privacy"
          value="All data lives in your browser. No accounts, no cloud, no telemetry."
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
