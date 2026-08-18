/**
 * categoryEmoji.ts — emoji tile for the category picker on add screens
 * and for the pre-defined budget cards on the Month Planner.
 *
 * v1 mockup renders categories as a 5-col grid of emoji tiles
 * (🍔 Food, 🛍 Shopping, 🚗 Transport, …). We don't store emoji on the
 * Category record yet, so we look up by category name (case-insensitive,
 * trimmed) and fall back to ➕ "Other" for anything not in the table.
 *
 * Kept here as a single small map so screens don't need to know the
 * emoji vocabulary. Add to it as new default categories appear.
 */

/**
 * Master emoji vocabulary used by the picker AND the preset
 * budget cards. Grouped into spending categories that mirror how
 * Bangladesh households actually budget (rent first, then food,
 * transport, etc.) so the pre-defined cards on the Month Planner
 * feel like a real starter kit — not a random emoji dump.
 *
 * Adding new entries here automatically makes them available to:
 *   1. The EmojiPicker grid (uses the same array)
 *   2. The PRESET_BUDGET_CARDS list on /plan/month
 *   3. The emojiForCategory() lookup for legacy categories
 */
export const CATEGORY_EMOJI_LIBRARY: ReadonlyArray<{ emoji: string; label: string; aliases: string[] }> = [
  // ── Essentials (the big three: rent, food, utilities) ─────────────
  { emoji: '🏠', label: 'Rent',        aliases: ['rent', 'house rent', 'housing', 'home rent'] },
  { emoji: '🛒', label: 'Groceries',   aliases: ['groceries', 'grocery', 'market', 'bazaar'] },
  { emoji: '💡', label: 'Utilities',   aliases: ['utilities', 'bills', 'electricity', 'gas', 'water', 'internet', 'wifi'] },

  // ── Food & dining ──────────────────────────────────────────────────
  { emoji: '🍔', label: 'Food',        aliases: ['food', 'food & dining', 'food & drinks', 'eating out', 'meals'] },
  { emoji: '☕', label: 'Café',        aliases: ['cafe', 'coffee', 'tea', 'snacks'] },
  { emoji: '🥦', label: 'Vegetables',  aliases: ['vegetables', 'veggies', 'produce'] },
  { emoji: '🍞', label: 'Bakery',      aliases: ['bakery', 'bread', 'breakfast'] },
  { emoji: '🥩', label: 'Meat & fish', aliases: ['meat', 'fish', 'chicken', 'protein'] },
  { emoji: '�', label: 'Fruits',      aliases: ['fruits', 'fruit'] },
  { emoji: '🥛', label: 'Dairy',       aliases: ['dairy', 'milk', 'yogurt'] },
  { emoji: '🍱', label: 'Lunch',       aliases: ['lunch', 'tiffin'] },
  { emoji: '�', label: 'Healthy',     aliases: ['healthy', 'salad', 'diet'] },
  { emoji: '🍕', label: 'Dining out',  aliases: ['dining out', 'restaurant', 'pizza'] },

  // ── Transport ──────────────────────────────────────────────────────
  { emoji: '🚗', label: 'Transport',   aliases: ['transport', 'transportation', 'car'] },
  { emoji: '🚌', label: 'Bus',         aliases: ['bus', 'public transport'] },
  { emoji: '⛽', label: 'Fuel',        aliases: ['fuel', 'petrol', 'gas station', 'cng'] },
  { emoji: '🚕', label: 'Taxi',        aliases: ['taxi', 'uber', 'ride share'] },
  { emoji: '🛵', label: 'Bike',        aliases: ['bike', 'scooter', 'motorbike'] },
  { emoji: '✈️', label: 'Travel',      aliases: ['travel', 'flight', 'airfare'] },

  // ── Lifestyle ──────────────────────────────────────────────────────
  { emoji: '�️', label: 'Shopping',    aliases: ['shopping', 'clothes', 'apparel'] },
  { emoji: '💄', label: 'Personal',    aliases: ['personal care', 'cosmetics', 'grooming'] },
  { emoji: '🏋️', label: 'Gym',         aliases: ['gym', 'fitness', 'workout'] },
  { emoji: '🎬', label: 'Entertainment', aliases: ['entertainment', 'fun', 'movies', 'streaming'] },
  { emoji: '🎮', label: 'Gaming',      aliases: ['gaming', 'games', 'video games'] },
  { emoji: '🎵', label: 'Music',       aliases: ['music', 'subscription'] },
  { emoji: '📱', label: 'Phone',       aliases: ['phone', 'mobile', 'recharge', 'data plan'] },
  { emoji: '🏨', label: 'Stay',        aliases: ['hotel', 'lodging', 'stay'] },

  // ── Family & health ────────────────────────────────────────────────
  { emoji: '💊', label: 'Health',      aliases: ['health', 'healthcare', 'medical', 'medicine', 'pharmacy'] },
  { emoji: '🏥', label: 'Hospital',    aliases: ['hospital', 'doctor', 'clinic'] },
  { emoji: '🎓', label: 'Education',   aliases: ['education', 'school', 'tuition', 'college', 'university', 'books'] },
  { emoji: '📚', label: 'Books',       aliases: ['books', 'supplies', 'stationery'] },
  { emoji: '👶', label: 'Kids',        aliases: ['kids', 'children', 'baby', 'daycare'] },
  { emoji: '🐾', label: 'Pets',        aliases: ['pets', 'pet care', 'vet'] },

  // ── Giving & saving ────────────────────────────────────────────────
  { emoji: '🎁', label: 'Gifts',       aliases: ['gifts', 'gift', 'presents'] },
  { emoji: '👨‍👩‍👧', label: 'Family',   aliases: ['family', 'gifts & family'] },
  { emoji: '🕌', label: 'Charity',     aliases: ['charity', 'donation', 'zakat', 'sadaqah'] },
  { emoji: '🐷', label: 'Savings',     aliases: ['savings', 'save', 'emergency fund'] },
  { emoji: '💰', label: 'Investment',  aliases: ['investment', 'investing'] },
  { emoji: '🎯', label: 'Goals',       aliases: ['goals', 'targets', 'sinking fund'] },

  // ── Tech & bills ───────────────────────────────────────────────────
  { emoji: '📺', label: 'Subscriptions', aliases: ['subscriptions', 'streaming services'] },

  // ── Fun & occasions ────────────────────────────────────────────────
  { emoji: '🎉', label: 'Party',       aliases: ['party', 'celebration'] },
  { emoji: '🎂', label: 'Birthday',    aliases: ['birthday'] },
  { emoji: '🏖️', label: 'Vacation',    aliases: ['vacation', 'holiday', 'outing'] },
  { emoji: '📸', label: 'Hobbies',     aliases: ['hobbies', 'photography'] },
  { emoji: '�', label: 'Home',        aliases: ['home', 'furniture', 'appliances'] },
  { emoji: '🌴', label: 'Outing',      aliases: ['outing', 'outing & events'] },
  { emoji: '🍽️', label: 'Dining',      aliases: ['dining', 'eating'] },

  // ── Income sources ─────────────────────────────────────────────────
  { emoji: '💼', label: 'Salary',      aliases: ['salary', 'wages'] },
  { emoji: '💻', label: 'Freelance',   aliases: ['freelance', 'remote work'] },
  { emoji: '🏪', label: 'Business',    aliases: ['business', 'shop', 'trade'] },
  { emoji: '📈', label: 'Interest',    aliases: ['interest', 'dividend'] },
  { emoji: '💍', label: 'Wedding',     aliases: ['wedding', 'marriage'] },

  // ── Misc ───────────────────────────────────────────────────────────
  { emoji: '＋', label: 'Other',       aliases: ['other', 'misc', 'miscellaneous'] },
];

/** Lookup map: any alias → emoji. Built once from CATEGORY_EMOJI_LIBRARY. */
const ALIAS_TO_EMOJI: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const entry of CATEGORY_EMOJI_LIBRARY) {
    for (const alias of entry.aliases) m[alias.toLowerCase()] = entry.emoji;
  }
  return m;
})();

/**
 * Pre-defined budget cards shown on the Month Planner when the user
 * has no items yet (and as one-click "add all" affordance). Each card
 * starts with budget 0 so the user can quickly edit and commit. The
 * order is the typical Bangladesh household budget priority: rent,
 * groceries, utilities, transport — the things that hit first every
 * month. Users can remove what they don't need.
 */
export interface PresetBudgetCard {
  emoji: string;
  name: string;
  /** Short helper text shown under the card name on the picker. */
  hint: string;
}

export const PRESET_BUDGET_CARDS: ReadonlyArray<PresetBudgetCard> = [
  { emoji: '🏠', name: 'Rent',        hint: 'House / flat rent' },
  { emoji: '🛒', name: 'Groceries',   hint: 'Market & household supplies' },
  { emoji: '💡', name: 'Utilities',   hint: 'Electricity, gas, water, internet' },
  { emoji: '🚗', name: 'Transport',   hint: 'Bus, CNG, fuel, ride share' },
  { emoji: '🍔', name: 'Food',        hint: 'Meals, tiffin, snacks' },
  { emoji: '☕', name: 'Café',        hint: 'Coffee, tea, eating out' },
  { emoji: '📱', name: 'Phone',       hint: 'Recharge, mobile data' },
  { emoji: '💊', name: 'Health',      hint: 'Medicine, doctor visits' },
  { emoji: '🎓', name: 'Education',   hint: 'Tuition, books, supplies' },
  { emoji: '�', name: 'Kids',        hint: 'Daycare, school fees, toys' },
  { emoji: '🐾', name: 'Pets',        hint: 'Food, vet, grooming' },
  { emoji: '🏋️', name: 'Gym',         hint: 'Membership, classes' },
  { emoji: '🎬', name: 'Entertainment', hint: 'Movies, streaming, outings' },
  { emoji: '🛍️', name: 'Shopping',    hint: 'Clothes, household items' },
  { emoji: '💄', name: 'Personal',    hint: 'Cosmetics, grooming' },
  { emoji: '🎁', name: 'Gifts',       hint: 'Birthdays, occasions' },
  { emoji: '🕌', name: 'Charity',     hint: 'Zakat, sadaqah, donations' },
  { emoji: '🐷', name: 'Savings',     hint: 'Set aside this month' },
  { emoji: '💰', name: 'Investment',  hint: 'DPS, FDR, stocks' },
  { emoji: '🎯', name: 'Goals',       hint: 'Sinking funds & targets' },
];

/** Returns an emoji for a category name. Falls back to �. */
export function emojiForCategory(name: string): string {
  const key = name.trim().toLowerCase();
  if (ALIAS_TO_EMOJI[key]) return ALIAS_TO_EMOJI[key];
  // First character upper-cased as a final fallback.
  return key.charAt(0).toUpperCase() || '＋';
}

/**
 * Returns a stable, recognisable emoji for a name from the
 * CATEGORY_EMOJI_LIBRARY. Used by the EmojiPicker to seed its
 * initial selection and by add screens to suggest an icon for a
 * typed name. Falls back to the first library entry.
 */
export function suggestEmojiForName(name: string): string {
  const e = emojiForCategory(name);
  if (e && e !== '＋') return e;
  // Last-ditch: any token in the name that matches an alias wins.
  const tokens = name.toLowerCase().split(/\s+/);
  for (const tok of tokens) {
    if (ALIAS_TO_EMOJI[tok]) return ALIAS_TO_EMOJI[tok];
  }
  return CATEGORY_EMOJI_LIBRARY[0].emoji;
}
