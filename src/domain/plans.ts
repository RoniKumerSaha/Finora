/**
 * plans.ts — pure CRUD for the Month Planner and Event Planner
 * scratchpads (PRD §9.14 + §9.15).
 *
 * Pure-scratch — these entities never touch `state.transactions`. They
 * exist to let the user sketch what they intend to spend in a given
 * month / for a given event, separately from what they actually record.
 *
 * The Month Planner is keyed by calendar month (`YYYY-MM`). The Event
 * Planner is keyed by event id. Both auto-persist on every mutation
 * (see `runPlan` in store.ts) — no Save / Reset UI is needed.
 */
import type {
  EventPlan,
  ISODate,
  MonthPlan,
  PlanCategory,
  PlanItem,
  State,
} from './types';
import { uid } from './ids';
import { daysBetween } from './math';

/** Day in milliseconds. Single source for the "days to go" arithmetic. */
export const MS_PER_DAY = 86_400_000;

/**
 * Rotation of tonal hints for jars / categories. Indexed positionally
 * (category #0 → primary, #1 → accent, …). Single source for the
 * planner UIs.
 */
export const PLAN_TONES: NonNullable<PlanCategory['tone']>[] = [
  'primary', 'accent', 'info', 'warn', 'violet', 'danger', 'success',
];

/** '+1 month' / '-1 month' on a YYYY-MM key, clamped to month boundaries. */
export function shiftMonthKey(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, (m ?? 1) - 1 + delta, 1);
  return monthKey(d);
}

/* ─────────────────────────────────────────────────────────────────────
   Month Planner
   ──────────────────────────────────────────────────────────────────────*/

/** Returns the YYYY-MM key for a Date (or today). */
export function monthKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** "August 2026" — display label for a YYYY-MM key. */
export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  const months = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  return `${months[(m ?? 1) - 1]} ${y}`;
}

export function getMonthPlan(state: State, key: string): MonthPlan | undefined {
  return state.monthPlans.find(p => p.key === key);
}

export function ensureMonthPlan(state: State, key: string): MonthPlan {
  return getMonthPlan(state, key) ?? {
    key,
    plannedIncome: 0,
    categories: [],
  };
}

/**
 * Patch a field on a MonthPlan. The plan is created on demand if it
 * doesn't exist (typical: user lands on /plan and we want to start
 * editing without a separate "create" step). Every mutation auto-
 * persists via `runPlan` in store.ts — no dirty/savedAt fields
 * needed.
 */
export function patchMonthPlan(
  state: State,
  key: string,
  patch: Partial<Omit<MonthPlan, 'key'>>,
): State {
  const existing = getMonthPlan(state, key);
  // Build the merged plan: defaults first, then any existing draft, then
  // the patch.
  const next: MonthPlan = {
    key,
    plannedIncome: 0,
    categories: [],
    ...existing,
    ...patch,
  };
  const list = state.monthPlans.filter(p => p.key !== key);
  list.push(next);
  return { ...state, monthPlans: list };
}

export function addMonthCategory(state: State, key: string, cat: Omit<PlanCategory, 'id'>): State {
  const plan = ensureMonthPlan(state, key);
  return patchMonthPlan(state, key, {
    categories: [...plan.categories, { id: uid(), ...cat }],
  });
}

export function updateMonthCategory(state: State, key: string, id: string, patch: Partial<PlanCategory>): State {
  const plan = ensureMonthPlan(state, key);
  return patchMonthPlan(state, key, {
    categories: plan.categories.map(c => c.id === id ? { ...c, ...patch } : c),
  });
}

export function removeMonthCategory(state: State, key: string, id: string): State {
  const plan = ensureMonthPlan(state, key);
  return patchMonthPlan(state, key, {
    categories: plan.categories.filter(c => c.id !== id),
  });
}

/**
 * Batch-set the budget on every PlanCategory whose id appears in `ids`.
 * Categories not in the list are left untouched. Used by the
 * "batch update budget" affordance on /plan/month — a single store
 * write replaces N per-card edits so the UI doesn't re-render N times.
 *
 * Silently no-ops on unknown ids so a stale selection (e.g. a card
 * removed while the picker was open) doesn't throw.
 */
export function batchUpdateMonthCategoryBudget(
  state: State,
  key: string,
  ids: string[],
  budget: number,
): State {
  if (ids.length === 0) return state;
  const plan = ensureMonthPlan(state, key);
  const idSet = new Set(ids);
  let touched = false;
  const nextCats = plan.categories.map(c => {
    if (!idSet.has(c.id)) return c;
    if (Number(c.budget) === budget) return c;
    touched = true;
    return { ...c, budget };
  });
  if (!touched) return state;
  return patchMonthPlan(state, key, { categories: nextCats });
}

/**
 * Batch-set the budget on every PlanCategory using a per-id map.
 * Used by the percent-mode batch editor where each card's bump is
 * based on its own current value. Single store write. Unknown ids are silently skipped.
 */
export function batchUpdateMonthCategoryBudgetMap(
  state: State,
  key: string,
  budgetMap: Record<string, number>,
): State {
  const ids = Object.keys(budgetMap);
  if (ids.length === 0) return state;
  const plan = ensureMonthPlan(state, key);
  let touched = false;
  const nextCats = plan.categories.map(c => {
    const next = budgetMap[c.id];
    if (next === undefined) return c;
    if (Number(c.budget) === next) return c;
    touched = true;
    return { ...c, budget: next };
  });
  if (!touched) return state;
  return patchMonthPlan(state, key, { categories: nextCats });
}

/**
 * Add multiple categories in a single store write. Used by the
 * "add all preset cards" affordance on /plan/month. Each preset card
 * starts with budget 0 so the user can quickly edit and use for
 * planning. Idempotent on name collisions — duplicate names are
 * appended with " (n)" so the user doesn't lose any prior data.
 */
export function addMonthCategories(
  state: State,
  key: string,
  cats: ReadonlyArray<Omit<PlanCategory, 'id'>>,
): State {
  if (cats.length === 0) return state;
  const plan = ensureMonthPlan(state, key);
  const existingNames = new Set(plan.categories.map(c => c.name.toLowerCase()));
  const additions: PlanCategory[] = [];
  for (let i = 0; i < cats.length; i++) {
    const base = cats[i];
    let name = base.name;
    let suffix = 2;
    while (existingNames.has(name.toLowerCase())) {
      name = `${base.name} (${suffix++})`;
    }
    existingNames.add(name.toLowerCase());
    const tone = plans_TONE_AT(plan.categories.length + additions.length);
    additions.push({
      id: uid(),
      emoji: base.emoji,
      name,
      budget: base.budget,
      planned: base.planned,
      tone,
    });
  }
  return patchMonthPlan(state, key, {
    categories: [...plan.categories, ...additions],
  });
}

/** Tone picker that wraps when we run out of palette slots. */
function plans_TONE_AT(idx: number): NonNullable<PlanCategory['tone']> {
  return PLAN_TONES[idx % PLAN_TONES.length];
}

/* ─────────────────────────────────────────────────────────────────────
   Event Planner
   ──────────────────────────────────────────────────────────────────────*/

export function listEventPlans(state: State): EventPlan[] {
  return state.eventPlans;
}

export function getEventPlan(state: State, id: string): EventPlan | undefined {
  return state.eventPlans.find(p => p.id === id);
}

export function addEventPlan(
  state: State,
  input: { name: string; emoji?: string; eventDate: ISODate; unallocatedBudget?: number },
): { state: State; id: string } {
  const id = uid();
  // The event's overall budget is no longer a free-form input — it
  // derives from `Σ category.budget` (see `summariseEventPlan`). The
  // create form instead offers an optional "Unallocated" field that,
  // if > 0, seeds a single catch-all category so the user can enter a
  // top-down ballpark without having to split it across categories
  // upfront. We store `budget: 0` on the event itself and let the
  // derived sum pick up the category's budget on the very first read.
  //
  // Every event is auto-persisted on the next mutation (see
  // `runPlan` in store.ts); no dirty/savedAt fields needed.
  const unallocated = Math.max(0, Number(input.unallocatedBudget) || 0);
  const categories: EventPlan['categories'] = unallocated > 0
    ? [{
        id: uid(),
        emoji: '🪙',
        name: 'Unallocated',
        budget: unallocated,
        planned: 0,
        items: [],
      }]
    : [];
  const plan: EventPlan = {
    id,
    name: input.name.trim(),
    emoji: input.emoji,
    eventDate: input.eventDate,
    budget: 0,
    planned: 0,
    categories,
  };
  return { state: { ...state, eventPlans: [...state.eventPlans, plan] }, id };
}

export function updateEventPlan(state: State, id: string, patch: Partial<Omit<EventPlan, 'id' | 'budget'>>): State {
  const existing = getEventPlan(state, id);
  if (!existing) return state;
  // `budget` is intentionally NOT in the patch type — the event's
  // overall budget is auto-derived from `Σ category.budget` (see
  // `summariseEventPlan`). Strip any stray `budget` field that older
  // callers might still try to pass so the stored event never carries
  // a stale, divergent number.
  const { budget: _ignored, ...safePatch } = patch as Partial<EventPlan>;
  const next: EventPlan = { ...existing, ...safePatch };
  return {
    ...state,
    eventPlans: state.eventPlans.map(p => p.id === id ? next : p),
  };
}

export function removeEventPlan(state: State, id: string): State {
  return {
    ...state,
    eventPlans: state.eventPlans.filter(p => p.id !== id),
  };
}

export function addEventCategory(
  state: State,
  id: string,
  cat: Omit<EventPlan['categories'][number], 'id' | 'items'>,
  initialItems: PlanItem[] = [],
): State {
  const plan = getEventPlan(state, id);
  if (!plan) return state;
  return updateEventPlan(state, id, {
    categories: [...plan.categories, { id: uid(), items: initialItems, ...cat }],
  });
}

/**
 * Add multiple event categories in a single store write. Mirrors
 * `addMonthCategories` — used by the Event Planner's "add all
 * preset cards" affordance so a tap on Add all is one write, not N.
 *
 * Each input carries an optional `dueDate` (already computed by the
 * caller from `eventDate + suggestedOffsetDays`) and an optional
 * `defaultItemLabel` (the preset's first-line-item seed). Duplicate
 * names are suffixed with " (n)" so the user's prior data is never
 * overwritten.
 */
export function addEventCategories(
  state: State,
  id: string,
  cats: ReadonlyArray<{
    emoji: string;
    name: string;
    budget?: number;
    planned?: number;
    dueDate?: ISODate;
    defaultItemLabel?: string;
  }>,
): State {
  if (cats.length === 0) return state;
  const plan = getEventPlan(state, id);
  if (!plan) return state;
  const existingNames = new Set(plan.categories.map(c => c.name.toLowerCase()));
  const additions: EventPlan['categories'] = [];
  for (const base of cats) {
    let name = base.name;
    let suffix = 2;
    while (existingNames.has(name.toLowerCase())) {
      name = `${base.name} (${suffix++})`;
    }
    existingNames.add(name.toLowerCase());
    const tone = plans_TONE_AT(plan.categories.length + additions.length);
    const items: PlanItem[] = base.defaultItemLabel && base.defaultItemLabel.trim()
      ? [{ id: uid(), label: base.defaultItemLabel.trim(), amount: 0, done: false }]
      : [];
    additions.push({
      id: uid(),
      emoji: base.emoji,
      name,
      budget: base.budget ?? 0,
      planned: base.planned ?? 0,
      dueDate: base.dueDate,
      tone,
      items,
    });
  }
  return updateEventPlan(state, id, {
    categories: [...plan.categories, ...additions],
  });
}

export function updateEventCategory(
  state: State,
  id: string,
  catId: string,
  patch: Partial<EventPlan['categories'][number]>,
): State {
  const plan = getEventPlan(state, id);
  if (!plan) return state;
  return updateEventPlan(state, id, {
    categories: plan.categories.map(c => c.id === catId ? { ...c, ...patch } : c),
  });
}

export function removeEventCategory(state: State, id: string, catId: string): State {
  const plan = getEventPlan(state, id);
  if (!plan) return state;
  return updateEventPlan(state, id, {
    categories: plan.categories.filter(c => c.id !== catId),
  });
}

export function addEventItem(state: State, id: string, catId: string, item: Omit<PlanItem, 'id'>): State {
  const plan = getEventPlan(state, id);
  if (!plan) return state;
  const cat = plan.categories.find(c => c.id === catId);
  if (!cat) return state;
  return updateEventCategory(state, id, catId, {
    items: [...cat.items, { id: uid(), ...item }],
  });
}

export function updateEventItem(
  state: State,
  id: string,
  catId: string,
  itemId: string,
  patch: Partial<PlanItem>,
): State {
  const plan = getEventPlan(state, id);
  if (!plan) return state;
  const cat = plan.categories.find(c => c.id === catId);
  if (!cat) return state;
  return updateEventCategory(state, id, catId, {
    items: cat.items.map(i => i.id === itemId ? { ...i, ...patch } : i),
  });
}

export function removeEventItem(state: State, id: string, catId: string, itemId: string): State {
  const plan = getEventPlan(state, id);
  if (!plan) return state;
  const cat = plan.categories.find(c => c.id === catId);
  if (!cat) return state;
  return updateEventCategory(state, id, catId, {
    items: cat.items.filter(i => i.id !== itemId),
  });
}

/* ─────────────────────────────────────────────────────────────────────
   Derived: simple aggregates used by the UI.
   Kept here (not in `math.ts`) because they're display-only and only
   relevant to plan screens. No ledger involvement.
   ──────────────────────────────────────────────────────────────────────*/

export interface MonthSummary {
  plannedIncome: number;
  totalBudget: number;
  saved: number;
  overflow: number;
  count: number;
  overCount: number;
  /** True iff the user has planned to spend more than they earn. */
  deficit: boolean;
  /** The shortfall when `deficit` is true (>= 0); 0 otherwise. */
  shortfall: number;
}

export function summariseMonthPlan(plan: MonthPlan): MonthSummary {
  let plannedTotal = 0;
  let totalBudget = 0;
  let overCount = 0;
  const plannedIncome = Number(plan.plannedIncome) || 0;
  for (const c of plan.categories) {
    const planned = Number(c.planned) || 0;
    const budget = Number(c.budget) || 0;
    plannedTotal += planned;
    totalBudget += budget;
    if (planned > budget) overCount++;
  }
  // Saving = what's left over after planned spending. Clamped to 0:
  // a deficit (spend > income) means no saving — the user is over budget.
  const saved = Math.max(0, plannedIncome - plannedTotal);
  const shortfall = Math.max(0, plannedTotal - plannedIncome);
  const deficit = shortfall > 0;
  return {
    plannedIncome,
    totalBudget,
    saved,
    overflow: shortfall,
    count: plan.categories.length,
    overCount,
    deficit,
    shortfall,
  };
}

export interface EventSummary {
  budget: number;
  planned: number;
  paidSoFar: number;
  remaining: number;
  count: number;
  overdueCount: number;
  dueSoonCount: number;
}

export function summariseEventPlan(plan: EventPlan, today: Date = new Date()): EventSummary {
  let planned = 0;
  let paid = 0;
  let overdue = 0;
  let dueSoon = 0;
  let categoryBudgetSum = 0;
  const todayISO = today.toISOString().slice(0, 10);
  for (const c of plan.categories) {
    // "Spent" = sum of line items when any exist (the granular truth),
    // otherwise the manually entered planned amount (whole-category estimate).
    planned += categorySpent(c);
    categoryBudgetSum += Number(c.budget) || 0;
    for (const it of c.items) {
      if (it.done) paid += Number(it.amount) || 0;
    }
    if (c.dueDate) {
      const days = daysBetween(todayISO, c.dueDate);
      if (days < 0) overdue++;
      else if (days <= 7) dueSoon++;
    }
  }
  // The event's overall budget derives from `Σ category.budget` —
  // categories are the single source of truth. For legacy events that
  // were created before this rule shipped (older localStorage still
  // carries `plan.budget > 0` but no categories summing to it),
  // surface the legacy value so the user sees their previously-typed
  // number instead of a surprise zero. Newly-created events always
  // have `budget: 0` on the event and store any unallocated amount as
  // a category, so the legacy fallback only fires for pre-existing
  // plans.
  const legacy = Number(plan.budget) || 0;
  const budget = categoryBudgetSum > 0
    ? categoryBudgetSum
    : (legacy > 0 ? legacy : 0);
  return {
    budget,
    planned,
    paidSoFar: paid,
    remaining: Math.max(0, budget - planned),
    count: plan.categories.length,
    overdueCount: overdue,
    dueSoonCount: dueSoon,
  };
}

/**
 * Spent for a single category. When the user has added any line items,
 * those are summed — they're the granular truth. With no items, fall
 * back to the manually entered `planned` field as a whole-category
 * estimate. Used by `summariseEventPlan` and the modal.
 */
export function categorySpent(cat: { planned: number; items: { amount: number }[] }): number {
  if (cat.items.length > 0) {
    let sum = 0;
    for (const it of cat.items) sum += Number(it.amount) || 0;
    return sum;
  }
  return Number(cat.planned) || 0;
}
