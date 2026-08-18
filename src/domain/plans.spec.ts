/**
 * plans.spec.ts — covers event plan mutations end-to-end so we can
 * catch regressions where line items don't persist after editing,
 * plus the new batch / preset helpers on the Month Planner.
 */
import { describe, expect, it } from 'vitest';
import {
  addEventItem,
  updateEventItem,
  addMonthCategories,
  batchUpdateMonthCategoryBudget,
  batchUpdateMonthCategoryBudgetMap,
  ensureMonthPlan,
  addEventCategories,
} from './plans';
import { DEFAULT_STATE } from './persistence';
import type { State } from './types';

function makePlanState(): State {
  const baseEventId = 'evt-1';
  const catId = 'cat-1';
  const state: State = {
    ...DEFAULT_STATE,
    eventPlans: [
      {
        id: baseEventId,
        name: 'Test event',
        emoji: '🎉',
        eventDate: '2026-08-20',
        budget: 10000,
        planned: 0,
        categories: [
          {
            id: catId,
            name: 'Food',
            emoji: '🍔',
            dueDate: '2026-08-20',
            budget: 5000,
            planned: 800,
            items: [
              { id: 'item-1', label: 'Lunch', amount: 800, done: false },
            ],
          },
        ],
        dirty: false,
        savedAt: '2026-08-17',
        savedSnapshot: undefined,
      },
    ],
  };
  return state;
}

describe('updateEventItem', () => {
  it('updates the amount of a line item', () => {
    const state = makePlanState();
    const next = updateEventItem(state, 'evt-1', 'cat-1', 'item-1', { amount: 9999 });
    const item = next.eventPlans[0].categories[0].items[0];
    expect(item.amount).toBe(9999);
    expect(item.label).toBe('Lunch');
  });

  it('preserves other items in the category', () => {
    const state = makePlanState();
    // Add a second item, then update the first — second should survive.
    let s = addEventItem(state, 'evt-1', 'cat-1', { label: 'Dinner', amount: 1500, done: false });
    const dinnerId = s.eventPlans[0].categories[0].items[1].id;
    s = updateEventItem(s, 'evt-1', 'cat-1', 'item-1', { amount: 9999 });
    const items = s.eventPlans[0].categories[0].items;
    expect(items).toHaveLength(2);
    expect(items[0].amount).toBe(9999);
    expect(items[1].id).toBe(dinnerId);
    expect(items[1].amount).toBe(1500);
  });

  it('marks the plan dirty after update', () => {
    const state = makePlanState();
    const next = updateEventItem(state, 'evt-1', 'cat-1', 'item-1', { amount: 100 });
    expect(next.eventPlans[0].dirty).toBe(true);
  });

  it('no-op when category does not exist', () => {
    const state = makePlanState();
    const next = updateEventItem(state, 'evt-1', 'cat-doesnt-exist', 'item-1', { amount: 100 });
    expect(next).toBe(state);
  });

  it('no-op when item does not exist within the category', () => {
    const state = makePlanState();
    const next = updateEventItem(state, 'evt-1', 'cat-1', 'item-doesnt-exist', { amount: 100 });
    // state eventPlans[0].categories[0].items[0] is unchanged
    expect(next.eventPlans[0].categories[0].items[0].amount).toBe(800);
  });
});

describe('addEventItem', () => {
  it('adds a new line item with a generated id', () => {
    const state = makePlanState();
    const next = addEventItem(state, 'evt-1', 'cat-1', { label: 'Snack', amount: 200, done: false });
    const items = next.eventPlans[0].categories[0].items;
    expect(items).toHaveLength(2);
    expect(items[1].label).toBe('Snack');
    expect(items[1].amount).toBe(200);
    expect(items[1].id).toBeTruthy();
    expect(items[1].id).not.toBe(items[0].id);
  });

  it('persists across sequential updates', () => {
    const state = makePlanState();
    let s = addEventItem(state, 'evt-1', 'cat-1', { label: 'Dinner', amount: 1500, done: false });
    const dinnerId = s.eventPlans[0].categories[0].items[1].id;
    s = updateEventItem(s, 'evt-1', 'cat-1', dinnerId, { amount: 2200 });
    expect(s.eventPlans[0].categories[0].items[1].amount).toBe(2200);
  });
});

/* ── Month planner batch + preset helpers ─────────────────────────── */

function makeMonthStateWithCats(): State {
  // Three existing categories, with predictable budgets so we can
  // assert the batch helpers leave non-selected rows alone.
  return {
    ...DEFAULT_STATE,
    monthPlans: [
      {
        key: '2026-08',
        plannedIncome: 0,
        categories: [
          { id: 'a', emoji: '🏠', name: 'Rent', budget: 10000, planned: 0 },
          { id: 'b', emoji: '🛒', name: 'Groceries', budget: 5000, planned: 0 },
          { id: 'c', emoji: '🚗', name: 'Transport', budget: 2000, planned: 0 },
        ],
        savedAt: '2026-08-17',
        dirty: false,
      },
    ],
  };
}

describe('addMonthCategories', () => {
  it('adds multiple categories in a single write with budget 0', () => {
    const state = { ...DEFAULT_STATE, monthPlans: [] };
    const next = addMonthCategories(state, '2026-08', [
      { emoji: '🏠', name: 'Rent', budget: 0, planned: 0 },
      { emoji: '🛒', name: 'Groceries', budget: 0, planned: 0 },
      { emoji: '�', name: 'Education', budget: 0, planned: 0 },
    ]);
    const cats = ensureMonthPlan(next, '2026-08').categories;
    expect(cats).toHaveLength(3);
    expect(cats.map(c => c.name)).toEqual(['Rent', 'Groceries', 'Education']);
    expect(cats.every(c => c.budget === 0)).toBe(true);
  });

  it('appends rather than replaces existing categories', () => {
    const state = makeMonthStateWithCats();
    const next = addMonthCategories(state, '2026-08', [
      { emoji: '🎓', name: 'Education', budget: 0, planned: 0 },
    ]);
    const cats = ensureMonthPlan(next, '2026-08').categories;
    expect(cats).toHaveLength(4);
    expect(cats[3].name).toBe('Education');
    // Original three categories survive untouched.
    expect(cats[0].budget).toBe(10000);
    expect(cats[1].budget).toBe(5000);
  });

  it('renames duplicate names with a numeric suffix', () => {
    const state = makeMonthStateWithCats();
    const next = addMonthCategories(state, '2026-08', [
      { emoji: '🏠', name: 'Rent', budget: 0, planned: 0 },
      { emoji: '🏠', name: 'Rent', budget: 0, planned: 0 },
    ]);
    const cats = ensureMonthPlan(next, '2026-08').categories;
    expect(cats.map(c => c.name)).toEqual(['Rent', 'Groceries', 'Transport', 'Rent (2)', 'Rent (3)']);
    // The original "Rent" must remain the first — only the new ones are suffixed.
    expect(cats[0].id).toBe('a');
  });

  it('is a no-op when the input list is empty', () => {
    const state = makeMonthStateWithCats();
    const next = addMonthCategories(state, '2026-08', []);
    expect(next).toBe(state);
  });
});

describe('batchUpdateMonthCategoryBudget', () => {
  it('writes the same budget to every selected category in a single store write', () => {
    const state = makeMonthStateWithCats();
    const next = batchUpdateMonthCategoryBudget(state, '2026-08', ['a', 'b'], 7000);
    const cats = ensureMonthPlan(next, '2026-08').categories;
    expect(cats[0].budget).toBe(7000);
    expect(cats[1].budget).toBe(7000);
    // The unselected row is untouched.
    expect(cats[2].budget).toBe(2000);
    // The dirty flag flips once — caller can save / reset in one step.
    expect(ensureMonthPlan(next, '2026-08').dirty).toBe(true);
  });

  it('ignores unknown ids without throwing', () => {
    const state = makeMonthStateWithCats();
    const next = batchUpdateMonthCategoryBudget(state, '2026-08', ['a', 'nope'], 100);
    const cats = ensureMonthPlan(next, '2026-08').categories;
    expect(cats[0].budget).toBe(100);
    expect(cats[1].budget).toBe(5000); // unchanged
    expect(cats[2].budget).toBe(2000); // unchanged
  });

  it('no-ops when the selection is empty', () => {
    const state = makeMonthStateWithCats();
    const next = batchUpdateMonthCategoryBudget(state, '2026-08', [], 100);
    expect(next).toBe(state);
  });
});

describe('batchUpdateMonthCategoryBudgetMap', () => {
  it('writes per-id budgets in a single store write', () => {
    const state = makeMonthStateWithCats();
    const next = batchUpdateMonthCategoryBudgetMap(state, '2026-08', {
      a: 12000,
      c: 3000,
    });
    const cats = ensureMonthPlan(next, '2026-08').categories;
    expect(cats[0].budget).toBe(12000);
    expect(cats[1].budget).toBe(5000); // unchanged
    expect(cats[2].budget).toBe(3000);
  });

  it('no-ops when every per-id value equals the current value', () => {
    const state = makeMonthStateWithCats();
    const next = batchUpdateMonthCategoryBudgetMap(state, '2026-08', {
      a: 10000, // already 10000 — no change
      b: 5000,  // already 5000 — no change
    });
    expect(next).toBe(state);
  });
});

/* ── Event planner batch helper (predefined kits) ───────────────── */

function makeEventStateWithCats(): State {
  // Single existing category ("Venue") so we can assert append-not-
  // replace and duplicate-name suffixing without rebuilding the world.
  return {
    ...DEFAULT_STATE,
    eventPlans: [
      {
        id: 'evt-1',
        name: 'Test event',
        emoji: '🎉',
        eventDate: '2026-08-20',
        budget: 100000,
        planned: 0,
        categories: [
          {
            id: 'venue-1',
            name: 'Venue',
            emoji: '🏛️',
            dueDate: '2026-08-20',
            budget: 30000,
            planned: 0,
            tone: 'primary',
            items: [],
          },
        ],
        dirty: false,
        savedAt: '2026-08-17',
      },
    ],
  };
}

describe('addEventCategories', () => {
  // Bare event used by the "fresh plan" tests — no categories, no
  // helper-only assumptions. addEventCategories doesn't auto-create
  // the event; the caller does.
  const bareEvent: State = {
    ...DEFAULT_STATE,
    eventPlans: [{
      id: 'evt-fresh',
      name: 'Fresh event',
      emoji: '🎉',
      eventDate: '2026-08-20',
      budget: 0,
      planned: 0,
      categories: [],
      dirty: false,
      savedAt: null,
    }],
  };

  it('adds multiple categories in a single write with budget 0', () => {
    const next = addEventCategories(bareEvent, 'evt-fresh', [
      { emoji: '🍛', name: 'Catering',   dueDate: '2026-08-17' },
      { emoji: '📸', name: 'Photography',dueDate: '2026-08-13' },
      { emoji: '💐', name: 'Decor',      dueDate: '2026-08-18' },
    ]);
    const plan = next.eventPlans.find(p => p.id === 'evt-fresh')!;
    expect(plan).toBeDefined();
    expect(plan.categories).toHaveLength(3);
    expect(plan.categories.map(c => c.name)).toEqual(['Catering', 'Photography', 'Decor']);
    expect(plan.categories.every(c => c.budget === 0)).toBe(true);
    // dueDate is preserved verbatim on every added category.
    expect(plan.categories[0].dueDate).toBe('2026-08-17');
  });

  it('seeds one default line item when defaultItemLabel is provided', () => {
    const next = addEventCategories(bareEvent, 'evt-fresh', [
      { emoji: '🍛', name: 'Catering', dueDate: '2026-08-17', defaultItemLabel: 'Per-plate cost' },
    ]);
    const cat = next.eventPlans[0].categories[0];
    expect(cat.items).toHaveLength(1);
    expect(cat.items[0].label).toBe('Per-plate cost');
    expect(cat.items[0].amount).toBe(0);
    expect(cat.items[0].done).toBe(false);
    // Each line item has a generated id so the UI can edit/remove it.
    expect(cat.items[0].id).toBeTruthy();
  });

  it('leaves items empty when no defaultItemLabel is provided', () => {
    const next = addEventCategories(bareEvent, 'evt-fresh', [
      { emoji: '🍛', name: 'Catering', dueDate: '2026-08-17' },
    ]);
    expect(next.eventPlans[0].categories[0].items).toEqual([]);
  });

  it('appends rather than replaces existing categories', () => {
    const state = makeEventStateWithCats();
    const next = addEventCategories(state, 'evt-1', [
      { emoji: '🍛', name: 'Catering', dueDate: '2026-08-17' },
    ]);
    expect(next.eventPlans[0].categories).toHaveLength(2);
    expect(next.eventPlans[0].categories[0].id).toBe('venue-1'); // original survives
    expect(next.eventPlans[0].categories[1].name).toBe('Catering');
  });

  it('renames duplicate names with a numeric suffix', () => {
    const state = makeEventStateWithCats();
    const next = addEventCategories(state, 'evt-1', [
      { emoji: '🏛️', name: 'Venue', dueDate: '2026-08-15' },
      { emoji: '🏛️', name: 'Venue', dueDate: '2026-08-16' },
    ]);
    expect(next.eventPlans[0].categories.map(c => c.name)).toEqual(['Venue', 'Venue (2)', 'Venue (3)']);
  });

  it('is a no-op when the input list is empty', () => {
    const state = makeEventStateWithCats();
    const next = addEventCategories(state, 'evt-1', []);
    expect(next).toBe(state);
  });

  it('is a no-op when the event id does not exist', () => {
    const state = makeEventStateWithCats();
    const next = addEventCategories(state, 'evt-nope', [
      { emoji: '🍛', name: 'Catering', dueDate: '2026-08-17' },
    ]);
    expect(next).toBe(state);
  });

  it('marks the plan dirty after a successful add', () => {
    const state = { ...DEFAULT_STATE, eventPlans: [{
      ...makeEventStateWithCats().eventPlans[0],
      dirty: false,
    }] };
    const next = addEventCategories(state, 'evt-1', [
      { emoji: '🍛', name: 'Catering', dueDate: '2026-08-17' },
    ]);
    expect(next.eventPlans[0].dirty).toBe(true);
  });
});