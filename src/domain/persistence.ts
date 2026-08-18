/**
 * persistence.ts — localStorage single-blob (AD-2, AD-3).
 *
 * Key: finora:v1. JSON.stringify with 2-space indent per AD-10.
 * Returns DEFAULT_STATE when missing or unparseable.
 */
import type { Category, State } from './types';

const KEY = 'finora:v1';

/**
 * Canonical income and expense categories shipped with the app. These
 * appear in every user's category picker regardless of whether they've
 * reset to demo data, so existing users see new categories added in
 * future releases without losing anything they've created themselves.
 *
 * Adding to this list is a one-liner — existing installs get them on
 * their next load via `mergeDefaults`.
 */
const DEFAULT_INCOME_CATEGORIES: ReadonlyArray<{ name: string }> = [
  { name: 'Salary' },
  { name: 'Freelance' },
  { name: 'Business' },
  { name: 'Gift' },
  { name: 'Other Income' },
];

const DEFAULT_EXPENSE_CATEGORIES: ReadonlyArray<{ name: string }> = [
  { name: 'Rent' },
  { name: 'Food & Dining' },
  { name: 'Transport' },
  { name: 'Utilities' },
  { name: 'Shopping' },
  { name: 'Gifts & Family' },
  { name: 'Phone & Internet' },
  { name: 'Health' },
  { name: 'Education' },
  { name: 'Travel' },
];

/**
 * Build the default Category[] list. IDs are stable string seeds so
 * they're recognisable across loads (useful for tests / debugging),
 * not cryptographic uids. Real users get fresh uids via uid() — these
 * are only the defaults.
 */
export function buildDefaultCategories(): Category[] {
  const inc = DEFAULT_INCOME_CATEGORIES.map((c, i) => ({
    id: `default-inc-${i}-${c.name.toLowerCase().replace(/[^a-z]+/g, '-')}`,
    type: 'income' as const,
    name: c.name,
  }));
  const exp = DEFAULT_EXPENSE_CATEGORIES.map((c, i) => ({
    id: `default-exp-${i}-${c.name.toLowerCase().replace(/[^a-z]+/g, '-')}`,
    type: 'expense' as const,
    name: c.name,
  }));
  return [...inc, ...exp];
}

export const DEFAULT_STATE: State = {
  version: 1,
  accounts: [],
  transactions: [],
  goals: [],
  debts: [],
  investments: [],
  categories: buildDefaultCategories(),
  // Plan arrays start empty — the planner is for the user's own
  // plans, not sample data. Empty arrays are a deliberate "I don't
  // have plans yet" state, not a missing one.
  monthPlans: [],
  eventPlans: [],
  settings: { theme: 'dark', onboardingComplete: false },
};

export function load(): State {
  try {
    const raw = (typeof localStorage !== 'undefined') ? localStorage.getItem(KEY) : null;
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw);
    if (!validate(parsed)) return { ...DEFAULT_STATE };
    return mergeDefaults(parsed);
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
  return ['accounts', 'transactions', 'goals', 'debts', 'investments', 'categories',
          'monthPlans', 'eventPlans', 'settings']
    .every(k => Array.isArray(obj[k]) || (k === 'settings' && typeof obj[k] === 'object'));
}

/**
 * Merge persisted state on top of DEFAULT_STATE, and additionally add
 * any *new* default categories the user is missing. Existing categories
 * (matched by `name`) are preserved (keeping their ids and any of the
 * user's edits); new defaults are appended.
 *
 * Plan arrays are NOT seeded — the planner is for the user's own plans,
 * not sample data. Whatever the user has saved (including an empty
 * array, which means "I don't have plans") is respected.
 */
function mergeDefaults(s: Partial<State>): State {
  const merged: State = {
    ...DEFAULT_STATE,
    ...s,
    settings: { ...DEFAULT_STATE.settings, ...(s.settings || {}) },
  };
  merged.categories = mergeCategories(merged.categories ?? []);
  return merged;
}

function mergeCategories(existing: Category[]): Category[] {
  const existingNames = new Set(existing.map(c => c.name.toLowerCase()));
  const additions = buildDefaultCategories().filter(
    c => !existingNames.has(c.name.toLowerCase())
  );
  return [...existing, ...additions];
}
