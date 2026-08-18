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
  { emoji: '💳', label: 'EMI',         aliases: ['emi', 'loan', 'installment', 'installments', 'monthly installment'] },
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
  { emoji: '💳', name: 'EMI',         hint: 'Loan installments (car, appliance, personal)' },
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

/**
 * Pre-defined categories for the Event Planner. Unlike the Month
 * Planner (recurring essentials), events are *occasions* with one-off
 * line items — weddings, trips, Eid, parties. To stay useful across
 * all of them we group by *kit* (the user's event archetype) and ship
 * two extra signals on each card:
 *
 *   - `suggestedOffsetDays`: when this typically falls relative to
 *     the event date (negative = before). The UI seeds `dueDate` =
 *     `eventDate + suggestedOffsetDays` so the timeline populates
 *     immediately. The user can override on each card.
 *
 *   - `defaultItemLabel`: a one-line seed for the category's first
 *     line item (e.g. "Deposit", "Tickets"). Amount 0 — the user fills
 *     it in. Mirrors the 'Main cost' seed that custom categories get.
 *
 * The `kit` field is the tab/section key the picker groups by.
 * 'generic' is always available and acts as a fallback for events
 * that don't match any of the named kits (project launches, business
 * trips, etc.). The picker renders a kit selector when more than one
 * kit applies.
 */
export type EventKit = 'wedding' | 'trip' | 'eid' | 'party' | 'generic';

export interface PresetEventCategory {
  emoji: string;
  name: string;
  hint: string;
  kit: EventKit;
  /** Days relative to the event date. Negative = before, positive = after. 0 = on the day. */
  suggestedOffsetDays: number;
  /** First-line-item label seeded for the category. Empty = no seed (user adds their own). */
  defaultItemLabel: string;
}

export const PRESET_EVENT_CATEGORIES: ReadonlyArray<PresetEventCategory> = [
  // ── Wedding (বিয়ে) ─────────────────────────────────────────────────
  { emoji: '🏛️', name: 'Venue',          hint: 'Hall / community centre / farm', kit: 'wedding', suggestedOffsetDays: 0,   defaultItemLabel: 'Hall booking' },
  { emoji: '🍛', name: 'Catering',       hint: 'Per-plate menu + service',     kit: 'wedding', suggestedOffsetDays: -3,  defaultItemLabel: 'Per-plate cost' },
  { emoji: '📸', name: 'Photography',    hint: 'Photographer + album',         kit: 'wedding', suggestedOffsetDays: -7,  defaultItemLabel: 'Photographer fee' },
  { emoji: '💐', name: 'Decor',          hint: 'Stage + table decor',          kit: 'wedding', suggestedOffsetDays: -2,  defaultItemLabel: 'Stage decor' },
  { emoji: '💌', name: 'Invitations',    hint: 'Print + cards + delivery',     kit: 'wedding', suggestedOffsetDays: -14, defaultItemLabel: 'Print cards' },
  { emoji: '👗', name: 'Outfit',         hint: 'Bride / groom attire',         kit: 'wedding', suggestedOffsetDays: -7,  defaultItemLabel: 'Outfit cost' },
  { emoji: '💍', name: 'Rings',          hint: 'Engagement + wedding rings',   kit: 'wedding', suggestedOffsetDays: -3,  defaultItemLabel: 'Rings' },
  { emoji: '🚗', name: 'Transport',      hint: 'Guest cars / microbus',        kit: 'wedding', suggestedOffsetDays: -1,  defaultItemLabel: 'Guest transport' },
  { emoji: '🎵', name: 'Music & DJ',     hint: 'Sound system + DJ',            kit: 'wedding', suggestedOffsetDays: -2,  defaultItemLabel: 'DJ fee' },
  { emoji: '🏝️', name: 'Honeymoon',     hint: 'Trip + stay + food',           kit: 'wedding', suggestedOffsetDays: 7,   defaultItemLabel: 'Tickets' },

  // ── Trip ────────────────────────────────────────────────────────────
  { emoji: '✈️', name: 'Transport',      hint: 'Flights / bus / train',        kit: 'trip', suggestedOffsetDays: -7,  defaultItemLabel: 'Tickets' },
  { emoji: '🏨', name: 'Stay',           hint: 'Hotel / homestay',             kit: 'trip', suggestedOffsetDays: -3,  defaultItemLabel: 'Hotel / night' },
  { emoji: '🍔', name: 'Food',           hint: 'Meals + snacks',               kit: 'trip', suggestedOffsetDays: 0,   defaultItemLabel: 'Daily food' },
  { emoji: '🎢', name: 'Activities',     hint: 'Tours + entry fees',           kit: 'trip', suggestedOffsetDays: 0,   defaultItemLabel: 'Entry tickets' },
  { emoji: '🛍️', name: 'Shopping',      hint: 'Souvenirs + gifts',            kit: 'trip', suggestedOffsetDays: 0,   defaultItemLabel: 'Souvenirs' },
  { emoji: '📱', name: 'SIM / Data',     hint: 'Local SIM + roaming',          kit: 'trip', suggestedOffsetDays: -2,  defaultItemLabel: 'SIM card' },
  { emoji: '🛡️', name: 'Insurance',     hint: 'Travel insurance',             kit: 'trip', suggestedOffsetDays: -3,  defaultItemLabel: 'Premium' },
  { emoji: '🎒', name: 'Gear',           hint: 'Backpack / clothes',           kit: 'trip', suggestedOffsetDays: -7,  defaultItemLabel: 'Backpack' },

  // ── Eid ─────────────────────────────────────────────────────────────
  { emoji: '👕', name: 'Outfit',         hint: 'New clothes for Eid',          kit: 'eid', suggestedOffsetDays: -3,  defaultItemLabel: 'Outfit' },
  { emoji: '💵', name: 'Eidi',           hint: 'Cash gifts for kids / family', kit: 'eid', suggestedOffsetDays: 0,   defaultItemLabel: 'Eidi budget' },
  { emoji: '🍛', name: 'Food',           hint: 'Special Eid dishes',           kit: 'eid', suggestedOffsetDays: 0,   defaultItemLabel: 'Ingredients' },
  { emoji: '🕌', name: 'Charity',        hint: 'Zakat + sadaqah',              kit: 'eid', suggestedOffsetDays: -2,  defaultItemLabel: 'Zakat' },
  { emoji: '🎀', name: 'Décor',          hint: 'Home decor + lights',          kit: 'eid', suggestedOffsetDays: -1,  defaultItemLabel: 'Decor' },
  { emoji: '🚗', name: 'Travel Home',    hint: 'Bus / train / plane home',     kit: 'eid', suggestedOffsetDays: -2,  defaultItemLabel: 'Tickets' },

  // ── Party / Birthday ────────────────────────────────────────────────
  { emoji: '🏛️', name: 'Venue',          hint: 'Hall / rooftop / home',        kit: 'party', suggestedOffsetDays: -3,  defaultItemLabel: 'Booking' },
  { emoji: '🎂', name: 'Cake',           hint: 'Cake + sweets',                kit: 'party', suggestedOffsetDays: -2,  defaultItemLabel: 'Cake' },
  { emoji: '🎀', name: 'Decor',          hint: 'Balloons + banners',           kit: 'party', suggestedOffsetDays: -1,  defaultItemLabel: 'Decor kit' },
  { emoji: '🍕', name: 'Food',           hint: 'Catering / snacks',            kit: 'party', suggestedOffsetDays: -1,  defaultItemLabel: 'Per-plate' },
  { emoji: '🎵', name: 'Music',          hint: 'Speaker + playlist',           kit: 'party', suggestedOffsetDays: -1,  defaultItemLabel: 'Speaker rental' },
  { emoji: '💌', name: 'Invitations',    hint: 'WhatsApp / cards',             kit: 'party', suggestedOffsetDays: -7,  defaultItemLabel: 'Cards' },
  { emoji: '🎁', name: 'Gifts',          hint: 'For the host / guests',        kit: 'party', suggestedOffsetDays: 0,   defaultItemLabel: 'Gifts' },

  // ── Generic (always available, no archetype required) ───────────────
  { emoji: '🏛️', name: 'Venue',          hint: 'Place + booking',              kit: 'generic', suggestedOffsetDays: -3,  defaultItemLabel: 'Booking' },
  { emoji: '🍔', name: 'Food',           hint: 'Meals + catering',             kit: 'generic', suggestedOffsetDays: 0,   defaultItemLabel: 'Per-plate' },
  { emoji: '🚗', name: 'Transport',      hint: 'Tickets + rides',              kit: 'generic', suggestedOffsetDays: -1,  defaultItemLabel: 'Tickets' },
  { emoji: '🏨', name: 'Stay',           hint: 'Hotel / lodging',              kit: 'generic', suggestedOffsetDays: -1,  defaultItemLabel: 'Hotel' },
  { emoji: '🎀', name: 'Decor',          hint: 'Decor + setup',                kit: 'generic', suggestedOffsetDays: -1,  defaultItemLabel: 'Decor' },
  { emoji: '🎁', name: 'Gifts',          hint: 'Gifts + souvenirs',            kit: 'generic', suggestedOffsetDays: 0,   defaultItemLabel: 'Gifts' },
  { emoji: '➕', name: 'Other',          hint: 'Anything else',                kit: 'generic', suggestedOffsetDays: 0,   defaultItemLabel: 'Main cost' },
];

/** Friendly kit labels for the picker UI. */
export const EVENT_KIT_LABELS: Record<EventKit, string> = {
  wedding: 'Wedding',
  trip: 'Trip',
  eid: 'Eid',
  party: 'Party',
  generic: 'Generic',
};

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
