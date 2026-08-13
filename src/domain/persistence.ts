/**
 * persistence.ts — localStorage single-blob (AD-2, AD-3).
 *
 * Key: finora:v1. JSON.stringify with 2-space indent per AD-10.
 * Returns DEFAULT_STATE when missing or unparseable.
 */
import type { State } from './types';

const KEY = 'finora:v1';

export const DEFAULT_STATE: State = {
  version: 1,
  accounts: [],
  transactions: [],
  goals: [],
  debts: [],
  investments: [],
  categories: [],
  settings: { theme: 'dark', onboardingComplete: false },
};

export function load(): State {
  try {
    const raw = (typeof localStorage !== 'undefined') ? localStorage.getItem(KEY) : null;
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw);
    return validate(parsed) ? merge(parsed) : { ...DEFAULT_STATE };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function save(state: State): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(state, null, 2));
}

export function clear(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(KEY);
}

// Drop unknown keys, fill missing required fields with defaults. Conservative.
function validate(s: unknown): s is Partial<State> {
  if (!s || typeof s !== 'object') return false;
  const obj = s as Record<string, unknown>;
  return ['accounts', 'transactions', 'goals', 'debts', 'investments', 'categories', 'settings']
    .every(k => Array.isArray(obj[k]) || (k === 'settings' && typeof obj[k] === 'object'));
}

function merge(s: Partial<State>): State {
  return {
    ...DEFAULT_STATE,
    ...s,
    settings: { ...DEFAULT_STATE.settings, ...(s.settings || {}) },
  };
}