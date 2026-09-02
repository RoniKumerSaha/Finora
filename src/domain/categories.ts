/**
 * categories.ts — small, pure helpers for working with the user's
 * category list. Kept separate from `types.ts` (the data shape) so
 * the domain logic stays testable without importing the persistence
 * layer.
 *
 * Categories are user-editable: they may add their own "Investment"
 * category, rename it, delete the default, or never have one. The
 * investment flows (DPS contributions, FDR/Savings principal) prefer
 * to tag their transactions with an Investment category by default,
 * but fall back to `undefined` if the user doesn't have one — better
 * than guessing wrong or crashing.
 */
import type { Category, State } from './types';

/**
 * Find the user's preferred Investment-category id.
 *
 * Resolution order (the first match wins):
 *   1. An expense category literally named "Investment" (case-insensitive).
 *   2. An expense category whose name contains "invest" (case-insensitive).
 *   3. `undefined` — caller decides what to do (we don't auto-create).
 *
 * Returns `undefined` (not `null`) so the result can be passed straight
 * into the `categoryId?: string` field of `Transaction`.
 */
export function findInvestmentCategoryId(state: State): string | undefined {
  const expenses = state.categories.filter(c => c.type === 'expense');
  const exact = expenses.find(c => c.name.trim().toLowerCase() === 'investment');
  if (exact) return exact.id;
  const fuzzy = expenses.find(c => c.name.trim().toLowerCase().includes('invest'));
  if (fuzzy) return fuzzy.id;
  return undefined;
}

/**
 * Find a category by id, or return undefined if it's been deleted.
 * Useful for derived displays that should silently drop missing rows.
 */
export function findCategory(state: State, id: string | undefined): Category | undefined {
  if (!id) return undefined;
  return state.categories.find(c => c.id === id);
}
