/**
 * categories.spec.ts — coverage for the small category helpers.
 *
 * The Investment-category lookup is the spine of the auto-tagging
 * feature (DPS contributions, FDR/Savings principal deductions). If
 * this ever changes, the auto-tag silently breaks across the app.
 */
import { describe, it, expect } from 'vitest';
import { findInvestmentCategoryId } from './categories';
import { DEFAULT_STATE } from './persistence';
import type { State } from './types';

const base = (over: Partial<State> = {}): State => ({
  ...DEFAULT_STATE,
  ...over,
});

describe('findInvestmentCategoryId', () => {
  it('returns the default "Investment" category id when it exists', () => {
    const state = base(); // default has "Investment" in the expense list
    const id = findInvestmentCategoryId(state);
    expect(id).toBeTruthy();
    const cat = state.categories.find(c => c.id === id);
    expect(cat?.name.toLowerCase()).toBe('investment');
  });

  it('matches case-insensitively', () => {
    const state = base({
      categories: DEFAULT_STATE.categories.map(c =>
        c.name === 'Investment' ? { ...c, name: 'INVESTMENT' } : c,
      ),
    });
    const id = findInvestmentCategoryId(state);
    expect(id).toBeTruthy();
  });

  it('falls back to a fuzzy match when exact "Investment" is missing', () => {
    // User deleted the default and created "My Investments" instead.
    const state = base({
      categories: [
        ...DEFAULT_STATE.categories.filter(c => c.name !== 'Investment'),
        { id: 'custom-1', type: 'expense' as const, name: 'My Investments' },
      ],
    });
    expect(findInvestmentCategoryId(state)).toBe('custom-1');
  });

  it('returns undefined when no Investment-flavoured category exists', () => {
    const state = base({
      categories: DEFAULT_STATE.categories.filter(c => c.name !== 'Investment'),
    });
    expect(findInvestmentCategoryId(state)).toBeUndefined();
  });

  it('ignores income-type categories even when named "Investment"', () => {
    // Edge case: the only "Investment" category is income-type.
    // We must not pick it — an income category tagged onto an
    // expense transaction is nonsense.
    const state = base({
      categories: [
        { id: 'income-inv', type: 'income' as const, name: 'Investment' },
        ...DEFAULT_STATE.categories.filter(c => c.name !== 'Investment'),
      ],
    });
    expect(findInvestmentCategoryId(state)).toBeUndefined();
  });
});