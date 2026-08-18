/**
 * plans.ts — pure CRUD for the Month Planner and Event Planner
 * scratchpads (PRD §9.14 + §9.15).
 *
 * Pure-scratch — these entities never touch `state.transactions`. They
 * exist to let the user sketch what they intend to spend in a given
 * month / for a given event, separately from what they actually record.
 *
 * The Month Planner is keyed by calendar month (`YYYY-MM`). The Event
 * Planner is keyed by event id. Both carry a `dirty` flag so the UI can
 * surface "unsaved changes" without diffing — explicit Save / Reset
 * actions flip it.
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
import { daysBetween, today } from './math';

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
    savedAt: null,
    dirty: true,
  };
}

/**
 * Patch a field on a MonthPlan. The plan is created on demand if it
 * doesn't exist (typical: user lands on /plan and we want to start
 * editing without a separate "create" step). Always marks dirty=true
 * unless explicitly cleared via `saveMonthPlan`.
 */
export function patchMonthPlan(
  state: State,
  key: string,
  patch: Partial<Omit<MonthPlan, 'key' | 'dirty' | 'savedAt'>>,
): State {
  const existing = getMonthPlan(state, key);
  // Build the merged plan: defaults first, then any existing draft, then
  // the patch. dirty is forced true at the end via destructure-spread.
  const { dirty: _ignored, ...rest } = { ...existing, ...patch };
  const next: MonthPlan = {
    key,
    plannedIncome: 0,
    categories: [],
    savedAt: null,
    dirty: true,
    ...rest,
  };
  const list = state.monthPlans.filter(p => p.key !== key);
  list.push(next);
  return { ...state, monthPlans: list };
}

/** Mark the plan as saved NOW. Clears dirty. */
export function saveMonthPlan(state: State, key: string): State {
  const existing = getMonthPlan(state, key);
  if (!existing) return state;
  const next: MonthPlan = {
    ...existing,
    dirty: false,
    savedAt: new Date().toISOString().slice(0, 10),
  };
  return {
    ...state,
    monthPlans: state.monthPlans.map(p => p.key === key ? next : p),
  };
}

/** Reset the plan to a fresh empty state. */
export function resetMonthPlan(state: State, key: string): State {
  const next: MonthPlan = {
    key,
    plannedIncome: 0,
    categories: [],
    savedAt: getMonthPlan(state, key)?.savedAt ?? null,
    dirty: true,
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
 * write replaces N per-card edits so the dirty flag only flips once
 * and the user can save / undo in one step.
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
 * based on its own current value. Single store write — dirty flag
 * flips once. Unknown ids are silently skipped.
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
  input: { name: string; emoji?: string; eventDate: ISODate; budget?: number },
): { state: State; id: string } {
  const id = uid();
  // No savedSnapshot at creation time — Reset shouldn't revert to the
  // pre-creation shell, only to the user's last explicit Save. If the
  // user never saves, the legacy fallback in resetEventPlan fires:
  // clear the working draft (planned + categories) but keep the
  // event shell (name/date/budget/emoji) so the user's typed values
  // stay intact.
  const plan: EventPlan = {
    id,
    name: input.name.trim(),
    emoji: input.emoji,
    eventDate: input.eventDate,
    budget: input.budget ?? 0,
    planned: 0,
    categories: [],
    savedAt: null,
    dirty: true,
  };
  return { state: { ...state, eventPlans: [...state.eventPlans, plan] }, id };
}

export function updateEventPlan(state: State, id: string, patch: Partial<Omit<EventPlan, 'id' | 'dirty' | 'savedAt'>>): State {
  const existing = getEventPlan(state, id);
  if (!existing) return state;
  const next: EventPlan = { ...existing, ...patch, dirty: true };
  return {
    ...state,
    eventPlans: state.eventPlans.map(p => p.id === id ? next : p),
  };
}

export function saveEventPlan(state: State, id: string): State {
  const existing = getEventPlan(state, id);
  if (!existing) return state;
  // Capture a deep snapshot of the live plan so a later Reset can
  // restore it verbatim — including event-level fields like budget
  // and date that the user can edit. The snapshot deliberately omits
  // itself so we don't recurse forever.
  const { savedSnapshot: _ignored, ...live } = existing;
  const next: EventPlan = {
    ...existing,
    savedSnapshot: live,
    dirty: false,
    savedAt: new Date().toISOString().slice(0, 10),
  };
  return {
    ...state,
    eventPlans: state.eventPlans.map(p => p.id === id ? next : p),
  };
}

export function resetEventPlan(state: State, id: string): State {
  const existing = getEventPlan(state, id);
  if (!existing) return state;
  // Reset blanks all planning data on the event: budget → 0, date →
  // today (so "days ago" / "days to go" both read 0), planned → 0,
  // categories wiped. The event shell (id, name, emoji) is kept so
  // the user doesn't lose the event itself. The savedSnapshot is
  // also preserved so subsequent Saves still work and the user can
  // hit Reset again later.
  //
  // Why blank today rather than restore the snapshot: the user
  // expectation is "Reset = wipe the planning state." Restoring to a
  // previously-saved snapshot would re-introduce the very budget and
  // date the user is trying to clear. Today's date is used so the
  // page no longer reads "5 days ago" — the user just reset, so the
  // event is back to a clean slate.
  const todayISO = today().toISOString().slice(0, 10);
  const next: EventPlan = {
    ...existing,
    budget: 0,
    eventDate: todayISO,
    planned: 0,
    categories: [],
    dirty: true,
  };
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
  const todayISO = today.toISOString().slice(0, 10);
  const budget = Number(plan.budget) || 0;
  for (const c of plan.categories) {
    // "Spent" = sum of line items when any exist (the granular truth),
    // otherwise the manually entered planned amount (whole-category estimate).
    planned += categorySpent(c);
    for (const it of c.items) {
      if (it.done) paid += Number(it.amount) || 0;
    }
    if (c.dueDate) {
      const days = daysBetween(todayISO, c.dueDate);
      if (days < 0) overdue++;
      else if (days <= 7) dueSoon++;
    }
  }
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
