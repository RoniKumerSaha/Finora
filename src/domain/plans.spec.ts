/**
 * plans.spec.ts — covers event plan mutations end-to-end so we can
 * catch regressions where line items don't persist after editing.
 */
import { describe, expect, it } from 'vitest';
import { addEventItem, updateEventItem } from './plans';
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