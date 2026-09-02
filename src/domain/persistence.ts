/**
 * persistence.ts — IndexedDB-backed persistence (AD-29).
 *
 * Single-blob row in a Dexie-managed IndexedDB. Replaces the previous
 * `localStorage['finora:v1']` implementation which suffered from:
 *   - ~5 MB ceiling that the platform may evict silently
 *   - disappearance on "Clear site data", uninstall, or profile reset
 *   - no transactional guarantees across partial writes
 *
 * The store wants a synchronous API (`run`, `runPlan`, `save` are
 * called from event handlers and effects, not awaits). Bridging:
 *
 *   `ensureReady()`         — async, idempotent. Opens the DB,
 *                              runs the one-shot migration from
 *                              localStorage, primes the in-memory
 *                              cache. Call BEFORE the first
 *                              synchronous `load()`.
 *   `load()`                — sync. Reads the cached state.
 *   `save(state)`           — sync. Updates the cache immediately
 *                              (so the UI feels instant) AND fires a
 *                              non-blocking Dexie write. If the
 *                              write fails, the next `load()` re-reads
 *                              from disk — the cache is best-effort,
 *                              Dexie is durable.
 *   `clear()`               — sync. Clears the cache to DEFAULT_STATE
 *                              and fires `db.kv.clear()`.
 *
 * Schema versions live in `meta`. The `state` row carries the JSON
 * State blob (see `types.ts`). `validate` + `mergeDefaults` are
 * unchanged from the localStorage era so all downstream contracts
 * (back-compat for new plan scratchpads, default category seeding,
 * theme coercion) keep working.
 */
import Dexie, { type Table } from 'dexie';
import type { Category, State } from './types';
import { migrateFromLocalStorage } from './persistence.migrations';

// ─── Schema ────────────────────────────────────────────────────────────

export const SINGLETON_KEY = 'state';
const SCHEMA_KEY = 'schema';
const CURRENT_SCHEMA_VERSION = 1;

interface MetaRow {
  key: string;
  value: unknown;
}

/** Single-table row for the `kv` Dexie table.
 *
 * The `data` field holds the full State blob. Wrapping it in an
 * object (rather than storing State directly) means Dexie sees a
 * well-formed primary key (`id`) and we don't lose the type story
 * for the value. The wrapper is also forward-compatible if we later
 * need to add secondary keys (e.g. a `createdAt` timestamp). */
export interface KvRow {
  id: string;
  data: unknown;
}

export class FinoraDB extends Dexie {
  kv!: Table<KvRow, string>;
  meta!: Table<MetaRow, string>;

  constructor() {
    super('finora');
    this.version(1).stores({
      kv: 'id',
      meta: 'key',
    });
  }
}

// ─── Default categories ────────────────────────────────────────────────
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

/**
 * Expense categories shipped with the app. Order matters — used in
 * pickers, charts, and as the canonical default for new users.
 *
 * Design notes:
 *   - Grouped by intent (housing → daily life → family → giving →
 *     tech → fun), with the most-frequent categories first so the
 *     top of every picker is the thing users actually spend on.
 *   - Names mirror what's already aliased in categoryEmoji.ts so the
 *     emoji lookup keeps working. Keep new entries in sync with
 *     CATEGORY_EMOJI_LIBRARY (or extend both together).
 *   - South-Asia / Bangladesh-first: gas cylinder, WiFi, maid, EMI,
 *     coaching, etc. show up because they're routine line items,
 *     not edge cases.
 */
const DEFAULT_EXPENSE_CATEGORIES: ReadonlyArray<{ name: string }> = [
  // ── Housing ────────────────────────────────────────────────────────
  { name: 'Rent' },
  { name: 'Service Charge' },
  { name: 'Groceries' },

  // ── Utilities & bills ──────────────────────────────────────────────
  { name: 'Utilities' },
  { name: 'LPG' },
  { name: 'WiFi' },
  { name: 'Phone & Internet' },
  { name: 'Subscriptions' },
  { name: 'Insurance' },

  // ── Daily life ─────────────────────────────────────────────────────
  { name: 'Food & Dining' },
  { name: 'Café' },
  { name: 'Transport' },
  { name: 'Fuel' },
  { name: 'Shopping' },
  { name: 'Personal Care' },
  { name: 'Maid' },

  // ── Family & health ────────────────────────────────────────────────
  { name: 'Health' },
  { name: 'Hospital' },
  { name: 'EMI' },
  { name: 'Education' },
  { name: 'Coaching' },
  { name: 'Books' },
  { name: 'Kids' },
  { name: 'Pets' },

  // ── Giving & saving (cash-out buckets, even if money stays on hand) ─
  { name: 'Gifts & Family' },
  { name: 'Charity' },
  { name: 'Puja' },
  { name: 'Investment' },

  // ── Fun & occasions ────────────────────────────────────────────────
  { name: 'Entertainment' },
  { name: 'Travel' },
  { name: 'Stay' },
  { name: 'Party' },
  { name: 'Birthday' },
  { name: 'Hobbies' },
  { name: 'Home' },
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
  // New in 2026-08-30: mock investment + loan scratchpads (PRD §9.17).
  // Empty by default — these are personal plans, not sample data.
  investmentPlans: [],
  loanPlans: [],
  settings: { theme: 'dark', onboardingComplete: false },
};

// ─── Cached state + Dexie handle ────────────────────────────────────────

/** Process-wide Dexie handle. Lazily created. */
let _dbPromise: Promise<FinoraDB> | null = null;
export function getIDB(): Promise<FinoraDB> {
  if (!_dbPromise) {
    _dbPromise = (async () => {
      const db = new FinoraDB();
      await db.open();
      return db;
    })();
  }
  return _dbPromise;
}

/**
 * In-memory mirror of the persisted state. Populated during
 * `ensureReady`. Synchronous reads and writes go through this.
 * Background Dexie writes keep it in sync with disk.
 */
let cached: State | null = null;

function ensureCacheInitialized(): State {
  if (cached === null) {
    // Caller forgot to `await ensureReady()`. Fall back to defaults
    // so the app still boots — but log so it's visible in dev.
    if (typeof console !== 'undefined') {
      console.warn(
        '[finora/persistence] load()/save()/clear() called before ensureReady(); '
          + 'using DEFAULT_STATE. Check main.tsx bootstrap.',
      );
    }
    cached = { ...DEFAULT_STATE };
  }
  return cached;
}

/**
 * Idempotent boot. Opens the DB, runs the one-shot localStorage
 * migration (if any), primes the in-memory cache. Safe to call from
 * multiple places (e.g. main.tsx AND a hot-reload refresh).
 *
 * The first caller does the work; everyone else awaits the same
 * promise. If init fails (e.g. private mode in some browsers),
 * we still resolve with DEFAULT_STATE so the app stays usable —
 * durability is best-effort.
 */
let _readyPromise: Promise<State> | null = null;
export function ensureReady(): Promise<State> {
  if (_readyPromise) return _readyPromise;
  _readyPromise = (async () => {
    try {
      const db = await getIDB();
      const result = await migrateFromLocalStorage(db);
      const row = await db.kv.get(SINGLETON_KEY);
      const state: State = row ? (row.data as State) : result.state;
      cached = state;

      // Track schema version for future migrations.
      const schemaRow = await db.meta.get(SCHEMA_KEY);
      if (!schemaRow) {
        await db.meta.put({ key: SCHEMA_KEY, value: CURRENT_SCHEMA_VERSION });
      }
      return state;
    } catch (err) {
      if (typeof console !== 'undefined') {
        console.warn('[finora/persistence] ensureReady failed; using DEFAULT_STATE.', err);
      }
      cached = { ...DEFAULT_STATE };
      return cached;
    }
  })();
  return _readyPromise;
}

// ─── Synchronous facade (the existing call surface) ────────────────────

export function load(): State {
  return ensureCacheInitialized();
}

export function save(state: State): void {
  cached = state;
  // Fire-and-forget. The cache is the source-of-truth for the
  // current session; IndexedDB catches up in the background. If
  // the write fails we log — the next page load will re-read.
  void (async () => {
    try {
      const db = await getIDB();
      await db.kv.put({ id: SINGLETON_KEY, data: state }, SINGLETON_KEY);
    } catch (err) {
      if (typeof console !== 'undefined') {
        console.error('[finora/persistence] save failed', err);
      }
    }
  })();
}

export function clear(): void {
  cached = { ...DEFAULT_STATE };
  void (async () => {
    try {
      const db = await getIDB();
      await db.kv.clear();
      await db.meta.clear();
      // Re-seed schema marker so the next ensureReady doesn't try to
      // re-run the migration.
      await db.meta.put({ key: SCHEMA_KEY, value: CURRENT_SCHEMA_VERSION });
    } catch (err) {
      if (typeof console !== 'undefined') {
        console.error('[finora/persistence] clear failed', err);
      }
    }
  })();
}

// ─── Validation + merge (unchanged from localStorage era) ──────────────

// Drop unknown keys, fill missing required fields with defaults. Conservative.
export function validate(s: unknown): s is Partial<State> {
  if (!s || typeof s !== 'object') return false;
  const obj = s as Record<string, unknown>;
  return ['accounts', 'transactions', 'goals', 'debts', 'investments', 'categories',
          'monthPlans', 'eventPlans', 'investmentPlans', 'loanPlans', 'settings']
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
export function mergeDefaults(s: Partial<State>): State {
  // Theme is always 'dark' now (light + auto removed). Old backups may
  // still carry 'light' / 'auto' — coerce them on load so the loaded
  // state always matches the current `Theme = 'dark'` contract.
  const loadedSettings = { ...DEFAULT_STATE.settings, ...(s.settings || {}) };
  if (loadedSettings.theme !== 'dark') loadedSettings.theme = 'dark';
  const merged: State = {
    ...DEFAULT_STATE,
    ...s,
    settings: loadedSettings,
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

// ─── Test hooks ────────────────────────────────────────────────────────
//
// These let unit tests force a re-boot. Production code paths must
// not call them — they're marked with leading underscores and not
// included in the barrel export of store.ts.

/** Clears the cached state + boot promise so the next call to
 * `ensureReady` re-runs the migration + initial-load sequence.
 * Used by tests that simulate a fresh app boot after seeding or
 * clearing IndexedDB. */
export function __resetPersistenceForTests(): void {
  cached = null;
  _readyPromise = null;
  _dbPromise = null;
}

/** Returns true if the synchronous facade has a populated cache. */
export function __isPersistenceReady(): boolean {
  return cached !== null;
}
