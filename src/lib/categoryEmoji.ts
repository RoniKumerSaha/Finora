/**
 * categoryEmoji.ts — emoji tile for the category picker on add screens.
 *
 * v1 mockup renders categories as a 5-col grid of emoji tiles
 * (🍔 Food, 🛍 Shopping, 🚗 Transport, …). We don't store emoji on the
 * Category record yet, so we look up by category name (case-insensitive,
 * trimmed) and fall back to ➕ "Other" for anything not in the table.
 *
 * Kept here as a single small map so screens don't need to know the
 * emoji vocabulary. Add to it as new default categories appear.
 */

const DEFAULT_EMOJI: Record<string, string> = {
  // expense
  food: '🍔',
  'food & dining': '🍔',
  'food & drinks': '🍔',
  groceries: '🛒',
  shopping: '🛍',
  transport: '🚗',
  housing: '🏠',
  rent: '🏠',
  utilities: '💡',
  bills: '💡',
  health: '💊',
  education: '🎓',
  family: '👨‍👩‍👧',
  'gifts & family': '🎁',
  gifts: '🎁',
  fun: '🎬',
  entertainment: '🎬',
  other: '＋',
  // income
  salary: '💼',
  freelance: '💻',
  business: '🏪',
  gift: '🎁',
  interest: '📈',
};

/** Returns an emoji for a category name. Falls back to ➕. */
export function emojiForCategory(name: string): string {
  const key = name.trim().toLowerCase();
  if (DEFAULT_EMOJI[key]) return DEFAULT_EMOJI[key];
  // First character upper-cased as a final fallback.
  return key.charAt(0).toUpperCase() || '＋';
}
