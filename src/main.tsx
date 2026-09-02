/**
 * main.tsx — entry point.
 *
 * Per AD-15/17/18: Vite + React 18 + React Router v7 (hash mode) +
 * Tailwind v4. The hash router preserves `file://` deploy so the
 * build output can still be opened by double-click.
 *
 * Persistence (AD-29): IndexedDB via Dexie. The boot sequence MUST
 * run in this exact order:
 *
 *   1. `await ensureReady()` — opens the DB, runs the one-shot
 *      migration from `localStorage['finora:v1']`, primes the
 *      in-memory cache with the real persisted state.
 *   2. `useStore.setState({state: load()})` — RE-SYNCS the store with
 *      the cache. Without this, `useStore.state` would be the
 *      DEFAULT_STATE that `store.ts` captured at module load time
 *      (before this boot ran), and the first mutation would persist
 *      a "default-state + delta" snapshot, erasing the real data.
 *   3. `useLockStore.init(...)` — feature-detect localStorage; if a
 *      PIN is configured AND storage is available, flip the lock
 *      flag so the root renders `<LockScreen />` instead of `<App />`.
 *   4. Mount React — Root decides which tree to render based on
 *      `useLockStore.locked`.
 *
 * Theme is applied imperatively before React mounts so the first paint
 * shows the correct palette, not a flash of the default theme.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { ensureReady, load } from './domain/persistence';
import { useStore } from './domain/store';
import { useLockStore } from './security';
import { hasPin, isLocalStorageAvailable } from './security/pin';
import { LockScreen } from './security/LockScreen';
import './styles/theme.css';
import './styles/app.css';

async function boot() {
  await ensureReady();

  // Re-sync the Zustand store with whatever the cache now holds.
  // Critical: store.ts evaluates at module load and captures
  // DEFAULT_STATE because ensureReady hasn't run yet. Without this
  // re-sync the first user mutation overwrites IndexedDB with the
  // default state. See AD-29.
  useStore.setState({ state: load() });

  // Decide whether to render the lock screen. If localStorage is
  // unavailable (private mode / storage full), skip the PIN
  // feature entirely — the SecuritySection surfaces a muted copy
  // explaining why. Otherwise locked=true iff a PIN is configured.
  const storageDisabled = !isLocalStorageAvailable();
  const locked = !storageDisabled && hasPin();
  useLockStore.getState().init({ locked, storageDisabled });

  const root = document.getElementById('root');
  if (!root) throw new Error('No #root element found');

  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <Root />
    </React.StrictMode>,
  );
}

/**
 * Root — render-time branch. When `locked`, only the LockScreen is
 * mounted and the entire app tree (router + screens) is not in the
 * React tree at all. No navigation, no other surface reachable.
 * When `locked` flips false (successful unlock OR no PIN configured),
 * the full App mounts on the next render.
 */
function Root() {
  const locked = useLockStore(s => s.locked);
  if (locked) return <LockScreen />;
  return <App />;
}

void boot();