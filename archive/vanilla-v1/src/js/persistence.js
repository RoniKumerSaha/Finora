/**
 * persistence.js — localStorage save/load for the Finora V1 state blob.
 *
 * Per AD-2 (single key) + AD-3 (no chunking). Per AD-10 the export/import
 * format is separate (see export-import.js); this module handles the
 * live-state blob under key `finora:v1`.
 *
 * Browser path: uses window.localStorage. Node/test path: pluggable storage
 * (anything with getItem/setItem) so persistence can be exercised in Vitest
 * without a DOM.
 */

import { recomputeDerived } from './recompute.js';

export const STORAGE_KEY = 'finora:v1';

export const DEFAULT_STATE = Object.freeze({
  version: 1,
  accounts: [],
  transactions: [],
  goals: [],
  debts: [],
  investments: [],
  categories: [],
  settings: {
    theme: 'dark',          // 'dark' | 'light' | 'auto'
    onboardingComplete: false,
  },
});

/**
 * Load the current state. If storage is empty, return DEFAULT_STATE.
 * If stored data fails to parse, throw — the caller (boot path) decides
 * whether to fall back to defaults or surface an error to the user.
 */
export function load(storage = getDefaultStorage()) {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw == null) return { ...DEFAULT_STATE };
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`Could not parse stored state: ${e.message}`);
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Stored state is not an object.');
  }
  // Merge onto defaults so any new top-level field added in a later version
  // has a safe initial value on first load.
  const merged = { ...DEFAULT_STATE, ...parsed };
  return recomputeDerived(merged);
}

/** Save the state. Throws if storage.setItem rejects (QuotaExceeded, etc.). */
export function save(state, storage = getDefaultStorage()) {
  storage.setItem(STORAGE_KEY, JSON.stringify(state, null, 2));
}

/** Wipe stored state (Delete All Data flow). */
export function clear(storage = getDefaultStorage()) {
  storage.removeItem(STORAGE_KEY);
}

/** Detect the default storage backend: localStorage in the browser, in-memory in Node. */
function getDefaultStorage() {
  if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
    return globalThis.localStorage;
  }
  // In-memory fallback for tests / Node.
  return _memoryStorage();
}

function _memoryStorage() {
  const map = new Map();
  return {
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: k => map.delete(k),
    clear: () => map.clear(),
  };
}