/**
 * persistence.ts — localStorage single-blob (AD-2, AD-3).
 *
 * Key: finora:v1. JSON.stringify with 2-space indent per AD-10.
 * Returns DEFAULT_STATE when missing or unparseable.
 */
import type { Category, EventPlan, MonthPlan, State } from './types';

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

/**
 * Seed plan data so a fresh install never sees an empty planner.
 *
 * Two months (current + previous) show the Month Planner in different
 * states (in-progress vs. fully-paid). Two events (an upcoming trip
 * and a past Eid) cover the Event Planner's timeline cascade plus
 * the "Event completed" callout.
 *
 * Dates are derived from the current clock so the samples always look
 * "recent" — "two months ago" stays "two months ago" even months later.
 * All numeric values are picked so the summary strip and jars land in
 * each palette band (blue / green / red) at least once, exercising the
 * full 3-step colour ramp.
 */
export function buildDefaultMonthPlans(): MonthPlan[] {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth(); // 0-based
  const yyyymm = (year: number, month1: number) =>
    `${year}-${String(month1).padStart(2, '0')}`;
  // Anchor the seeded months to "now" and "last month" so the demo
  // always looks fresh.
  const current = yyyymm(y, m + 1);
  const prev = m === 0 ? yyyymm(y - 1, 12) : yyyymm(y, m);
  const currentISOSaved = new Date(Date.UTC(y, m, 8)).toISOString().slice(0, 10);
  const prevISOSaved = new Date(Date.UTC(y, m - 1, 22)).toISOString().slice(0, 10);
  return [
    {
      key: current,
      plannedIncome: 50000,
      savedAt: currentISOSaved,
      dirty: false,
      categories: [
        { id: 'seed-mp-groc',  emoji: '🥦', name: 'Groceries',         budget: 12000, planned: 0, tone: 'success' },
        { id: 'seed-mp-rent',  emoji: '🏠', name: 'Rent',              budget: 18000, planned: 0, tone: 'primary' },
        { id: 'seed-mp-trans', emoji: '🚗', name: 'Transport',         budget:  6000, planned: 0, tone: 'info'    },
        { id: 'seed-mp-bills', emoji: '💡', name: 'Bills',             budget:  4000, planned: 0, tone: 'info'    },
        { id: 'seed-mp-fun',   emoji: '🎮', name: 'Fun',               budget:  3000, planned: 0, tone: 'accent'  },
        { id: 'seed-mp-dining',emoji: '🍜', name: 'Dining out',        budget:  2500, planned: 0, tone: 'warn'    },
        { id: 'seed-mp-gifts', emoji: '🎁', name: 'Gifts',             budget:  1500, planned: 0, tone: 'violet'  },
      ],
    },
    {
      key: prev,
      plannedIncome: 48000,
      savedAt: prevISOSaved,
      dirty: false,
      categories: [
        { id: 'seed-mp-p-groc',  emoji: '🥦', name: 'Groceries',     budget: 12000, planned: 0, tone: 'success' },
        { id: 'seed-mp-p-rent',  emoji: '🏠', name: 'Rent',          budget: 18000, planned: 0, tone: 'primary' },
        { id: 'seed-mp-p-trans', emoji: '🚗', name: 'Transport',     budget:  5000, planned: 0, tone: 'info'    },
        { id: 'seed-mp-p-bills', emoji: '💡', name: 'Bills',         budget:  4000, planned: 0, tone: 'info'    },
        { id: 'seed-mp-p-fun',   emoji: '🎮', name: 'Fun',           budget:  3000, planned: 0, tone: 'accent'  },
      ],
    },
  ];
}

export function buildDefaultEventPlans(): EventPlan[] {
  const now = new Date();
  // Wedding: ~95 days out, mid-future. Exercises due-soon + paid-mix states.
  const wedding = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 95));
  const weddingISOSaved = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 2)).toISOString().slice(0, 10);
  // Cox's Bazar trip: ~32 days out, near-future, due-soon chip fires.
  const trip = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 32));
  const tripISOSaved = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 4)).toISOString().slice(0, 10);
  // Past Eid: 5 days before today — exercises "Days ago" branch + completed callout.
  const eid = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 5));
  const eidISOSaved = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 12)).toISOString().slice(0, 10);
  return [
    {
      id: 'seed-e-coxbazar',
      name: "Cox's Bazar Trip",
      emoji: '🏖️',
      eventDate: trip.toISOString().slice(0, 10),
      budget: 60000,
      planned: 0, // recomputed by categorySpent
      savedAt: tripISOSaved,
      dirty: false,
      categories: [
        {
          id: 'seed-e-c-hotel', emoji: '🏨', name: 'Hotel', budget: 18000, planned: 0,
          dueDate: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 14)).toISOString().slice(0, 10),
          tone: 'primary',
          items: [
            { id: 'seed-e-c-hotel-i1', label: 'Seaside resort — 3 nights', amount: 18000, done: false },
          ],
        },
        {
          id: 'seed-e-c-food', emoji: '🍽️', name: 'Food', budget: 9000, planned: 0,
          tone: 'accent',
          items: [
            { id: 'seed-e-c-food-i1', label: 'Friday dinner', amount: 2500, done: false },
            { id: 'seed-e-c-food-i2', label: 'Saturday lunch', amount: 1800, done: false },
            { id: 'seed-e-c-food-i3', label: 'Sunday snacks', amount: 1200, done: false },
          ],
        },
        {
          id: 'seed-e-c-trans', emoji: '🚗', name: 'Transport', budget: 6000, planned: 0,
          dueDate: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 21)).toISOString().slice(0, 10),
          tone: 'info',
          items: [
            { id: 'seed-e-c-trans-i1', label: 'Bus tickets (round trip)', amount: 3200, done: true },
            { id: 'seed-e-c-trans-i2', label: 'Local rides', amount: 1500, done: false },
          ],
        },
        {
          id: 'seed-e-c-misc', emoji: '🎒', name: 'Misc', budget: 4000, planned: 0,
          tone: 'violet',
          items: [
            { id: 'seed-e-c-misc-i1', label: 'Souvenirs', amount: 2000, done: false },
          ],
        },
      ],
    },
    {
      id: 'seed-e-wedding',
      name: 'Wedding',
      emoji: '💍',
      eventDate: wedding.toISOString().slice(0, 10),
      budget: 250000,
      planned: 0,
      savedAt: weddingISOSaved,
      dirty: false,
      categories: [
        {
          id: 'seed-e-w-venue', emoji: '🏛️', name: 'Venue', budget: 80000, planned: 0,
          dueDate: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 60)).toISOString().slice(0, 10),
          tone: 'primary',
          items: [
            { id: 'seed-e-w-venue-i1', label: 'Hall booking', amount: 65000, done: false },
            { id: 'seed-e-w-venue-i2', label: 'Decoration', amount: 15000, done: false },
          ],
        },
        {
          id: 'seed-e-w-food', emoji: '🍱', name: 'Catering', budget: 70000, planned: 0,
          dueDate: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 70)).toISOString().slice(0, 10),
          tone: 'accent',
          items: [
            { id: 'seed-e-w-food-i1', label: 'Lunch platter', amount: 45000, done: false },
            { id: 'seed-e-w-food-i2', label: 'Tea + sweets', amount: 12000, done: false },
          ],
        },
        {
          id: 'seed-e-w-photo', emoji: '📸', name: 'Photography', budget: 40000, planned: 0,
          tone: 'info',
          items: [
            { id: 'seed-e-w-photo-i1', label: 'Photographer', amount: 30000, done: true },
            { id: 'seed-e-w-photo-i2', label: 'Album + prints', amount: 10000, done: false },
          ],
        },
        {
          id: 'seed-e-w-outfit', emoji: '👗', name: 'Outfit', budget: 35000, planned: 0,
          tone: 'violet',
          items: [
            { id: 'seed-e-w-outfit-i1', label: 'Bride lehenga', amount: 28000, done: false },
            { id: 'seed-e-w-outfit-i2', label: 'Groom sherwani', amount: 7000, done: false },
          ],
        },
        {
          id: 'seed-e-w-gifts', emoji: '🎁', name: 'Return gifts', budget: 25000, planned: 0,
          tone: 'warn',
          items: [
            { id: 'seed-e-w-gifts-i1', label: 'Boxes for guests', amount: 25000, done: false },
          ],
        },
      ],
    },
    {
      id: 'seed-e-eid',
      name: 'Eid 2026',
      emoji: '🕌',
      eventDate: eid.toISOString().slice(0, 10),
      budget: 25000,
      planned: 0,
      savedAt: eidISOSaved,
      dirty: false,
      // All categories paid — exercises the "Event completed" callout.
      categories: [
        {
          id: 'seed-e-eid-clothes', emoji: '👔', name: 'New clothes', budget: 8000, planned: 0,
          dueDate: eid.toISOString().slice(0, 10),
          tone: 'primary',
          items: [
            { id: 'seed-e-eid-clothes-i1', label: 'Family outfits', amount: 8000, done: true },
          ],
        },
        {
          id: 'seed-e-eid-food', emoji: '🍱', name: 'Eid feast', budget: 9000, planned: 0,
          tone: 'accent',
          items: [
            { id: 'seed-e-eid-food-i1', label: 'Groceries', amount: 4800, done: true },
            { id: 'seed-e-eid-food-i2', label: 'Sweets', amount: 2200, done: true },
          ],
        },
        {
          id: 'seed-e-eid-gifts', emoji: '🎁', name: 'Gifts', budget: 5000, planned: 0,
          tone: 'warn',
          items: [
            { id: 'seed-e-eid-gifts-i1', label: 'Parents', amount: 3000, done: true },
            { id: 'seed-e-eid-gifts-i2', label: 'Siblings', amount: 2000, done: true },
          ],
        },
      ],
    },
  ];
}

export const DEFAULT_STATE: State = {
  version: 1,
  accounts: [],
  transactions: [],
  goals: [],
  debts: [],
  investments: [],
  categories: buildDefaultCategories(),
  monthPlans: buildDefaultMonthPlans(),
  eventPlans: buildDefaultEventPlans(),
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
 * Plan arrays (monthPlans, eventPlans) are seeded with the demo data
 * ONLY when the field is absent from the persisted blob — a v1 install
 * that pre-dates the planner feature won't have them, and seeding on
 * upgrade means existing users get the planners populated too rather
 * than opening them to an empty list.
 *
 * Important: the seed only fires when the field is *missing*, not when
 * it's an empty array. An empty array is a deliberate user choice
 * (they wiped their plans) and we must respect it — otherwise deleting
 * every plan would resurrect them on the next reload.
 */
function mergeDefaults(s: Partial<State>): State {
  const seededPlans = buildDefaultPlans();
  const merged: State = {
    ...DEFAULT_STATE,
    ...s,
    settings: { ...DEFAULT_STATE.settings, ...(s.settings || {}) },
    // Seed when the field is missing entirely (pre-planner install).
    // If the field is present, keep whatever the user saved — including
    // an empty array, which means "I don't want plans".
    monthPlans: 'monthPlans' in s
      ? (s.monthPlans ?? [])
      : seededPlans.monthPlans,
    eventPlans: 'eventPlans' in s
      ? (s.eventPlans ?? [])
      : seededPlans.eventPlans,
  };
  merged.categories = mergeCategories(merged.categories ?? []);
  return merged;
}

/**
 * Snapshot of the seeded plan data. Built once per call so defaults
 * can't accidentally be shared (mutated) across merges.
 */
function buildDefaultPlans(): { monthPlans: MonthPlan[]; eventPlans: EventPlan[] } {
  return {
    monthPlans: buildDefaultMonthPlans(),
    eventPlans: buildDefaultEventPlans(),
  };
}

function mergeCategories(existing: Category[]): Category[] {
  const existingNames = new Set(existing.map(c => c.name.toLowerCase()));
  const additions = buildDefaultCategories().filter(
    c => !existingNames.has(c.name.toLowerCase())
  );
  return [...existing, ...additions];
}
