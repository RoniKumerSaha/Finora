import { useRef } from 'react';
import { useStore } from '../domain/store';
import type { Theme } from '../domain/store';
import { seedDemo } from '../lib/demoSeed';
import { useConfirm } from '../components/ConfirmDialog';
import { Button } from '../components/Button';
import { downloadExport, parseImport, ImportError } from '../lib/exportImport';

export function SettingsScreen() {
  const theme = useStore(s => s.state.settings.theme);
  const setTheme = useStore(s => s.setTheme);
  const update = useStore(s => s.update);
  const importAndReplace = useStore(s => s.importAndReplace);
  const showBanner = useStore(s => s.showBanner);
  const hasData = useStore(s => s.state.accounts.length > 0 || s.state.transactions.length > 0);
  const { confirm, dialog } = useConfirm();
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function onSeedDemo() {
    const ok = hasData
      ? await confirm({
          title: 'Replace existing data with demo?',
          body: 'This will overwrite your current accounts, transactions, goals, and investments with a small demo dataset.',
          confirmLabel: 'Replace',
          danger: true,
        })
      : true;
    if (!ok) return;
    update(seedDemo);
    showBanner({
      what: 'Demo data loaded',
      why: 'You\'re now seeing 3 accounts, 4 transactions, 1 goal, 1 investment.',
      fix: 'Open any module from the sidebar.',
    });
  }

  async function onWipe() {
    const ok = await confirm({
      title: 'Wipe all data?',
      body: 'Every account, transaction, goal, debt, and investment will be deleted. This cannot be undone.',
      confirmLabel: 'Wipe everything',
      danger: true,
    });
    if (!ok) return;
    update(s => ({
      version: 1,
      accounts: [], transactions: [], goals: [], debts: [], investments: [], categories: [],
      settings: { ...s.settings, onboardingComplete: true },
    }));
    showBanner({
      what: 'All data wiped',
      why: 'Your local store is now empty.',
      fix: 'Add an account to start tracking again.',
    });
  }

  function onExport() {
    const state = useStore.getState().state;
    const filename = downloadExport(state);
    showBanner({
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
        showBanner({ what: err.what, why: err.why, fix: err.fix });
      } else {
        showBanner({ what: 'Import failed', why: (err as Error).message, fix: 'Try a different file.' });
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
      what: 'Backup restored',
      why: 'Your data is now identical to the backup file.',
      fix: 'Open Home to see the totals.',
    });
  }

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <section className="bg-surface border border-border rounded-xl p-4">
        <h2 className="font-medium mb-2">Theme</h2>
        <div className="flex gap-2">
          {(['dark', 'light', 'auto'] as Theme[]).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTheme(t)}
              className={[
                'px-4 py-2 rounded-md text-sm border',
                theme === t ? 'bg-primary text-primary-on border-primary' : 'border-border',
              ].join(' ')}
            >
              {t}
            </button>
          ))}
        </div>
      </section>

      <section className="bg-surface border border-border rounded-xl p-4">
        <h2 className="font-medium mb-2">Backup</h2>
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
        <p className="text-xs text-muted mt-2">
          Exports save to <code>finora-backup-YYYY-MM-DD.json</code>. Import replaces all data after confirmation.
        </p>
      </section>

      <section className="bg-surface border border-border rounded-xl p-4">
        <h2 className="font-medium mb-2">Demo data</h2>
        <p className="text-xs text-muted mb-3">
          Load a small sample dataset (3 accounts, 4 transactions, 1 goal, 1 DPS) so the app isn't empty.
        </p>
        <Button variant="primary" onClick={onSeedDemo}>Load demo data</Button>
      </section>

      <section className="bg-danger-soft border border-danger rounded-xl p-4">
        <h2 className="font-medium mb-2 text-danger">Danger zone</h2>
        <Button variant="danger" onClick={onWipe}>Wipe all data</Button>
      </section>

      {dialog}
    </div>
  );
}