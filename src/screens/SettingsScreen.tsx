import { useStore } from '../domain/store';
import type { Theme } from '../domain/store';

export function SettingsScreen() {
  const theme = useStore(s => s.state.settings.theme);
  const setTheme = useStore(s => s.setTheme);

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
        <div className="flex gap-2">
          <button type="button" className="px-4 py-2 rounded-md bg-primary text-primary-on text-sm">
            Export (TODO AD-20)
          </button>
          <button type="button" className="px-4 py-2 rounded-md border border-border text-sm">
            Import (TODO AD-20)
          </button>
        </div>
      </section>

      <section className="bg-danger-soft border border-danger rounded-xl p-4">
        <h2 className="font-medium mb-2 text-danger">Danger zone</h2>
        <button type="button" className="px-4 py-2 rounded-md border border-danger text-danger text-sm">
          Wipe all data (TODO AD-20)
        </button>
      </section>
    </div>
  );
}