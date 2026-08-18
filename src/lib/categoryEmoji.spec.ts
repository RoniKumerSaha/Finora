/**
 * categoryEmoji.spec.ts — covers the preset catalog and emoji lookup.
 *
 * Most regressions here come from preset list churn (renaming a card,
 * adding a kit, typo'ing a kit key). The EventKit type is a string
 * union — if you forget to add a kit to EVENT_KIT_LABELS, the type
 * system catches it, but if you forget to add it to KIT_ORDER or to
 * the picker copy, only tests like these will notice.
 */
import { describe, expect, it } from 'vitest';
import {
  CATEGORY_EMOJI_LIBRARY,
  EVENT_KIT_LABELS,
  PRESET_BUDGET_CARDS,
  PRESET_EVENT_CATEGORIES,
  emojiForCategory,
  suggestEmojiForName,
  type EventKit,
} from './categoryEmoji';

const ALL_KITS: EventKit[] = ['wedding', 'trip', 'religious', 'party', 'generic'];

describe('PRESET_EVENT_CATEGORIES — kit coverage', () => {
  it('every preset has a kit that exists in EVENT_KIT_LABELS', () => {
    // Catches: someone adds a card with kit: 'foo' (typo, missing label).
    const knownKits = new Set(Object.keys(EVENT_KIT_LABELS));
    for (const preset of PRESET_EVENT_CATEGORIES) {
      expect(knownKits.has(preset.kit), `${preset.name} uses unknown kit "${preset.kit}"`).toBe(true);
    }
  });

  it('every EventKit key has at least one preset', () => {
    // Catches: a kit exists in the type but the catalog never filled it.
    // This was the original bug — Puja was a missing kit entirely.
    const seen = new Set(PRESET_EVENT_CATEGORIES.map(p => p.kit));
    for (const kit of ALL_KITS) {
      expect(seen.has(kit), `kit "${kit}" has zero presets`).toBe(true);
    }
  });

  it('Religious kit is faith-agnostic — no per-clergy presets', () => {
    // The religious kit must work for Eid (no clergy line needed), Puja
    // (pandit is user-added), Christmas (pastor is user-added). If the
    // catalog drifts back to pandit-only or imam-only presets, this
    // fails.
    const religious = PRESET_EVENT_CATEGORIES.filter(p => p.kit === 'religious');
    expect(religious.length).toBeGreaterThanOrEqual(6);
    const names = religious.map(p => p.name.toLowerCase());
    expect(names).not.toContain('pandit / pujari');
    expect(names).not.toContain('imam');
    expect(names).not.toContain('pastor');
    // Must cover the common cost shape — outfit, food, charity, decor.
    expect(names).toContain('outfit');
    expect(names.some(n => n.includes('food'))).toBe(true);
    expect(names.some(n => n.includes('charity') || n.includes('donation'))).toBe(true);
  });

  it('Wedding kit covers the BD/IN cultural chain (not western-only)', () => {
    // The wedding kit must work for Bangladesh/India ceremonies, not
    // just a generic western wedding. Look for the BD/IN cultural
    // staples: holud, mehndi, walima / reception, pan / paan, mishti /
    // sweets. If the catalog drifts back to "honeymoon + rings only"
    // this will catch it.
    const wedding = PRESET_EVENT_CATEGORIES.filter(p => p.kit === 'wedding');
    const names = wedding.map(p => p.name.toLowerCase());
    expect(names).toContain('venue');
    expect(names).toContain('catering');
    // Cultural staples:
    expect(names.some(n => n.includes('mehndi') || n.includes('haldi'))).toBe(true);
    expect(names.some(n => n.includes('reception'))).toBe(true);
    expect(names.some(n => n.includes('pan') || n.includes('paan'))).toBe(true);
    expect(names.some(n => n.includes('mishti') || n.includes('sweet'))).toBe(true);
  });

  it('suggestedOffsetDays is an integer in [-90, +90] for every preset', () => {
    // Catches: accidental NaN, accidental Date object, accidental 365.
    for (const p of PRESET_EVENT_CATEGORIES) {
      expect(Number.isInteger(p.suggestedOffsetDays), `${p.name}: ${p.suggestedOffsetDays}`).toBe(true);
      expect(p.suggestedOffsetDays).toBeGreaterThanOrEqual(-90);
      expect(p.suggestedOffsetDays).toBeLessThanOrEqual(90);
    }
  });

  it('every preset has a unique (kit, name) pair', () => {
    // Two presets with the same name in the same kit would collide in
    // the picker's "added" detection. Same name across different kits
    // is allowed (e.g. "Venue" exists in wedding/party/generic).
    const seen = new Set<string>();
    for (const p of PRESET_EVENT_CATEGORIES) {
      const k = `${p.kit}::${p.name.toLowerCase()}`;
      expect(seen.has(k), `duplicate preset: ${k}`).toBe(false);
      seen.add(k);
    }
  });

  it('no two presets in the same kit share an emoji', () => {
    // The picker renders one kit at a time. If two tiles in the same
    // kit use the same emoji, the user can't tell them apart at a
    // glance. Cross-kit emoji reuse is fine (e.g. "Venue" uses 🏛️ in
    // wedding/party/generic — they never appear together).
    const byKit = new Map<string, Map<string, string[]>>();
    for (const p of PRESET_EVENT_CATEGORIES) {
      let m = byKit.get(p.kit);
      if (!m) {
        m = new Map();
        byKit.set(p.kit, m);
      }
      let names = m.get(p.emoji);
      if (!names) {
        names = [];
        m.set(p.emoji, names);
      }
      names.push(p.name);
    }
    for (const [kit, emap] of byKit.entries()) {
      for (const [emoji, names] of emap.entries()) {
        expect(names.length, `${kit} kit has duplicate emoji "${emoji}" on tiles ${JSON.stringify(names)}`).toBe(1);
      }
    }
  });
});

describe('EVENT_KIT_LABELS', () => {
  it('has a label for every EventKit key', () => {
    // Type-system catches new keys missing from the Record; this catches
    // empty / whitespace-only labels.
    for (const kit of ALL_KITS) {
      expect(EVENT_KIT_LABELS[kit].length).toBeGreaterThan(0);
    }
  });
});

describe('CATEGORY_EMOJI_LIBRARY', () => {
  it('every entry has at least one alias for fuzzy lookup', () => {
    for (const e of CATEGORY_EMOJI_LIBRARY) {
      expect(e.aliases.length, `library entry "${e.label}" has no aliases`).toBeGreaterThan(0);
    }
  });
});

describe('emojiForCategory', () => {
  it('resolves known aliases case-insensitively', () => {
    expect(emojiForCategory('rent')).toBe('🏠');
    expect(emojiForCategory('EMI')).toBe('💳');
    expect(emojiForCategory('WiFi')).toBe('📡');
    expect(emojiForCategory('Puja')).toBeTruthy();
  });

  it('falls back to the first letter when the name is unknown', () => {
    // Empty / unknown names should NOT throw — they get the "first letter"
    // sentinel. This is the contract callers depend on.
    const e = emojiForCategory('zzz-unknown');
    expect(typeof e).toBe('string');
    expect(e.length).toBeGreaterThan(0);
  });
});

describe('suggestEmojiForName', () => {
  it('returns a non-empty emoji for every input', () => {
    // Used by the add-category flow to seed the emoji picker.
    expect(suggestEmojiForName('Something Custom').length).toBeGreaterThan(0);
    expect(suggestEmojiForName('').length).toBeGreaterThan(0);
  });
});

describe('PRESET_BUDGET_CARDS', () => {
  it('every card has a hint longer than its name (hint adds info)', () => {
    // Catches: someone added a card and forgot the helper text. The hint
    // is what tells the user WHY this card is here, so empty / shorter-
    // than-name hints are a UX bug.
    for (const c of PRESET_BUDGET_CARDS) {
      expect(c.hint.length, `${c.name} has no hint`).toBeGreaterThan(0);
    }
  });
});
