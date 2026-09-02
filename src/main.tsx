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
 *   3. Mount React — now safe to render with real data.
 *
 * Theme is applied imperatively before React mounts so the first paint
 * shows the correct palette, not a flash of the default theme.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { ensureReady, load } from './domain/persistence';
import { useStore } from './domain/store';
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

  const root = document.getElementById('root');
  if (!root) throw new Error('No #root element found');

  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

void boot();