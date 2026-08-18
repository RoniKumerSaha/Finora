/**
 * PresetEventCategories — kit-aware preset picker for the Event Planner.
 *
 * Mirrors the Month Planner's `PresetBudgetCards` pattern but with
 * three event-specific adaptations:
 *
 *   1. **Kit selector** — Wedding / Trip / Eid / Party / Generic tabs
 *      along the top. Auto-suggests the most likely kit from the
 *      event name; the user can flip between kits freely.
 *
 *   2. **Date seeding** — each preset ships with a
 *      `suggestedOffsetDays` (e.g. -7, -3, 0, +7). On tap, the
 *      category is added with `dueDate = eventDate + offset`, so the
 *      timeline auto-populates. The user can edit the date inside
 *      the category editor.
 *
 *   3. **Default line item** — each preset carries a
 *      `defaultItemLabel` (e.g. "Tickets", "Per-plate cost"). The
 *      first line item is auto-seeded with that label and amount 0
 *      so the user can immediately type the cost — same gesture as
 *      the 'Main cost' seed for custom categories.
 *
 * The panel auto-collapses once the user has any categories, exactly
 * like the Month Planner. Tap a tile that's NOT in the plan to add it.
 * Tap a tile that IS in the plan (checkmark) to remove it (with
 * confirm, since removal discards the budget the user might have
 * typed). The checkmark tile stays visible — users can flip between
 * added / removed without leaving the picker.
 *
 * `Add all` and `Remove all` are always available in the header.
 */
import { useMemo, useState } from 'react';
import { useStore } from '../../domain/store';
import { useConfirm } from '../ConfirmDialog';
import type { EventPlan } from '../../domain/types';
import {
  PRESET_EVENT_CATEGORIES,
  EVENT_KIT_LABELS,
  type EventKit,
  type PresetEventCategory,
} from '../../lib/categoryEmoji';

/** Shifts an ISO date by N days (negative = earlier). Returns the
 *  empty string if the source doesn't parse, so an in-the-past event
 *  with no offset still seeds `undefined` (no due date) rather than
 *  surfacing `1970-01-01`. */
function shiftDateISO(iso: string | undefined, days: number): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return undefined;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Heuristic kit suggestion from the event name. Used only to seed the
 * initial active tab; the user can change it. Looks for the kit's
 * label (English) as a whole-word substring. Misses → Generic (which
 * is always available anyway).
 */
function suggestKit(eventName: string | undefined): EventKit {
  const name = (eventName ?? '').toLowerCase();
  if (/\bwedding|byah\b|বিয়ে|shadi\b/i.test(name)) return 'wedding';
  if (/\btrip|tour|travel|vacation|holiday\b/i.test(name)) return 'trip';
  // Religious-occasion kit is intentionally broad — any faith-based
  // celebration. We match across faiths because the kit itself is
  // generic (no per-clergy presets). Order: eid → puja → christmas →
  // vesak etc., so the heuristic never stalls on ties.
  if (/\beid|puja|pooja|christmas|vesak|diwali|buddha|holi|ramadan|navratri|দূর্গা|পূজা/i.test(name)) return 'religious';
  if (/\bbirthday|party|anniversary\b/i.test(name)) return 'party';
  return 'generic';
}

const KIT_ORDER: EventKit[] = ['wedding', 'trip', 'religious', 'party', 'generic'];

export function PresetEventCategories({ plan }: { plan: EventPlan }) {
  const addEventCategories = useStore(s => s.addEventCategories);
  const removeEventCategory = useStore(s => s.removeEventCategory);
  const showBanner = useStore(s => s.showBanner);
  const { confirm, dialog: confirmDialog } = useConfirm();

  // Active kit starts at the heuristic-suggested one, falls back to
  // generic. The user can flip freely.
  const [activeKit, setActiveKit] = useState<EventKit>(() => suggestKit(plan.name));

  // Auto-collapse once the user already has categories — the picker
  // is a starter tool, not a working surface. Re-open with
  // "Browse presets" any time.
  const [expanded, setExpanded] = useState(plan.categories.length === 0);

  const existing = plan.categories;
  const existingNames = useMemo(
    () => new Set(existing.map(c => c.name.toLowerCase())),
    [existing],
  );

  // Filtered tiles for the active kit.
  const tiles: PresetEventCategory[] = useMemo(
    () => PRESET_EVENT_CATEGORIES.filter(p => p.kit === activeKit),
    [activeKit],
  );

  // Counts across the WHOLE catalog, not just the active kit — so the
  // header chrome stays stable when the user flips tabs (no surprise
  // numbers / chrome jumps).
  const totalAcrossKits = PRESET_EVENT_CATEGORIES.length;
  const addedCount = useMemo(
    () => PRESET_EVENT_CATEGORIES.filter(p => existingNames.has(p.name.toLowerCase())).length,
    [existingNames],
  );
  const missingCount = totalAcrossKits - addedCount;
  const allAdded = missingCount === 0;

  function addTiles(targets: PresetEventCategory[]) {
    if (targets.length === 0) return;
    addEventCategories(
      plan.id,
      targets.map(t => ({
        emoji: t.emoji,
        name: t.name,
        budget: 0,
        planned: 0,
        dueDate: shiftDateISO(plan.eventDate, t.suggestedOffsetDays),
        defaultItemLabel: t.defaultItemLabel,
      })),
    );
  }

  function addOne(tile: PresetEventCategory) {
    addTiles([tile]);
  }

  async function removeOne(name: string) {
    const target = existing.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (!target) return;
    const ok = await confirm({
      title: `Remove “${target.name}”?`,
      body: 'This category and its line items will be taken out of this event\u2019s plan.',
      dangerText: 'Any budget you set on it is removed.',
      confirmLabel: 'Remove',
      danger: true,
    });
    if (!ok) return;
    removeEventCategory(plan.id, target.id);
    showBanner({
      kind: 'info',
      what: `Removed “${target.name}”`,
      why: 'The preset is back in the picker — add it again any time.',
      fix: 'Tap Save plan to keep the change.',
    });
  }

  function addAll() {
    // Kit-scoped: when the user is on the Wedding tab, "Add all" means
    // "add the Wedding starter kit". This is the natural "predefined
    // event" gesture — pick a kit, get its categories with seeded dates.
    const missing = tiles.filter(t => !existingNames.has(t.name.toLowerCase()));
    if (missing.length === 0) return;
    addTiles(missing);
    showBanner({
      kind: 'success',
      what: `${missing.length} ${EVENT_KIT_LABELS[activeKit]} categor${missing.length === 1 ? 'y' : 'ies'} added`,
      why: 'Dates suggested relative to the event, each with a starting line item. Tap any category below to adjust.',
      fix: 'Flip tabs to add from another kit, or tap Save plan when you\u2019re done.',
    });
  }

  function addAllAcrossKits() {
    const missing = PRESET_EVENT_CATEGORIES.filter(t => !existingNames.has(t.name.toLowerCase()));
    if (missing.length === 0) return;
    addTiles(missing);
    showBanner({
      kind: 'success',
      what: `${missing.length} categor${missing.length === 1 ? 'y' : 'ies'} added across all kits`,
      why: 'Dates suggested relative to the event, each with a starting line item. Tap any category below to adjust.',
      fix: 'Remove what you don\u2019t need, or tap Save plan when you\u2019re done.',
    });
  }

  async function removeAllPresets() {
    const targets = existing.filter(c => {
      const key = c.name.toLowerCase();
      return PRESET_EVENT_CATEGORIES.some(t => t.name.toLowerCase() === key);
    });
    if (targets.length === 0) return;
    const ok = await confirm({
      title: `Remove all ${targets.length} preset categor${targets.length === 1 ? 'y' : 'ies'}?`,
      body: 'Every preset category you added will be taken out of this event\u2019s plan.',
      dangerText: 'Any budgets + line items you set on these categories are removed. Custom categories (not from this list) stay.',
      confirmLabel: `Remove ${targets.length}`,
      danger: true,
    });
    if (!ok) return;
    // One store action per category so dirty flips are explicit; the
    // alternative (single bulk remove helper) isn't worth a new
    // domain method for a one-shot gesture like this.
    for (const c of targets) removeEventCategory(plan.id, c.id);
    showBanner({
      kind: 'info',
      what: `Removed ${targets.length} categor${targets.length === 1 ? 'y' : 'ies'}`,
      why: 'All preset categories are back in the picker — add what you need, then save.',
      fix: 'Tap Save plan to keep the change.',
    });
  }

  return (
    <section
      aria-label="Quick add event categories"
      className="rounded-card border border-border p-4 sm:p-5 flex flex-col gap-3"
      style={{ background: 'var(--surface-2)' }}
    >
      {/* Header row — title + bulk actions + collapse toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex items-center gap-3">
          <div
            aria-hidden
            className="w-9 h-9 rounded-full bg-primary/10 inline-flex items-center justify-center shrink-0 text-primary"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 2 L8 9 M5 6 L8 9 L11 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M3 13 H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-[14.5px] text-ink flex items-center gap-2 flex-wrap">
              <span>
                {expanded
                  ? 'Quick start'
                  : allAdded
                    ? `All ${totalAcrossKits} presets added`
                    : `${missingCount} preset${missingCount === 1 ? '' : 's'} ready to add`}
              </span>
              {addedCount > 0 && !expanded && (
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-pill bg-primary/15 text-[11px] font-bold tabular text-primary border border-primary/30">
                  {addedCount} in plan
                </span>
              )}
            </div>
            <div className="text-[12px] text-muted mt-0.5 truncate">
              {expanded
                ? 'Pick a kit, tap tiles to add. Dates suggested relative to the event.'
                : allAdded
                  ? 'Tap "Browse presets" to remove individual categories, or "Remove all" to start over.'
                  : 'Wedding, trip, religious occasions, party — pick a kit and drop in the basics.'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {missingCount > 0 && (
            <>
              <button
                type="button"
                onClick={addAll}
                title={`Add every missing ${EVENT_KIT_LABELS[activeKit]} preset`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-btn text-[12px] font-semibold transition bg-surface border border-border text-ink hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
                  <path d="M2 6 L5 9 L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Add {EVENT_KIT_LABELS[activeKit]} kit
              </button>
              {(() => {
                // Only show the cross-kit "Add all" affordance when there
                // are missing categories from OTHER kits — otherwise it
                // duplicates the kit-scoped button.
                const missingOtherKits = PRESET_EVENT_CATEGORIES.filter(
                  p => p.kit !== activeKit && !existingNames.has(p.name.toLowerCase()),
                );
                if (missingOtherKits.length === 0) return null;
                return (
                  <button
                    type="button"
                    onClick={addAllAcrossKits}
                    title={`Add ${missingOtherKits.length} more preset${missingOtherKits.length === 1 ? '' : 's'} from other kits`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-btn text-[12px] font-medium transition bg-surface border border-border text-muted hover:text-ink hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    + Add all kits ({missingOtherKits.length})
                  </button>
                );
              })()}
            </>
          )}
          {addedCount > 0 && (
            <button
              type="button"
              onClick={removeAllPresets}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-btn text-[12px] font-semibold transition bg-surface border border-border text-muted hover:text-danger hover:border-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/40"
            >
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
                <path d="M2 2 L10 10 M10 2 L2 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Remove all
            </button>
          )}
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            aria-expanded={expanded}
            className={[
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-btn text-[12px] font-semibold transition',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
              expanded
                ? 'bg-surface border border-border text-ink hover:border-primary'
                : 'bg-primary text-primary-on border border-primary hover:opacity-90',
            ].join(' ')}
          >
            {expanded ? (
              <>
                Collapse
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden>
                  <path d="M3 4.5 L6 7.5 L9 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </>
            ) : (
              <>
                Browse presets
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden>
                  <path d="M3 7.5 L6 4.5 L9 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </>
            )}
          </button>
        </div>
      </div>

      {expanded && (
        <>
          {/* Kit selector — strip of pills above the tile grid. The
              active kit's tiles render below; flipping the pill keeps
              the same Add all / Remove all chrome. "Generic" is always
              last so the user has a non-archetype fallback. */}
          <div
            role="tablist"
            aria-label="Event kit"
            className="flex flex-wrap gap-1.5"
          >
            {KIT_ORDER.map(kit => {
              const isActive = kit === activeKit;
              const kitTotal = PRESET_EVENT_CATEGORIES.filter(p => p.kit === kit).length;
              // Number of this kit's tiles already added to the plan —
              // shows progress per kit.
              const kitAdded = PRESET_EVENT_CATEGORIES.filter(
                p => p.kit === kit && existingNames.has(p.name.toLowerCase()),
              ).length;
              return (
                <button
                  key={kit}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveKit(kit)}
                  className={[
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill text-[12px] font-semibold border transition',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                    isActive
                      ? 'bg-primary text-primary-on border-primary shadow-sm'
                      : 'bg-surface border-border text-ink hover:border-primary',
                  ].join(' ')}
                >
                  <span>{EVENT_KIT_LABELS[kit]}</span>
                  <span
                    className={[
                      'text-[10.5px] tabular px-1 py-px rounded-pill',
                      isActive
                        ? 'bg-primary-on/15 text-primary-on'
                        : 'bg-surface-2 text-muted',
                    ].join(' ')}
                  >
                    {kitAdded}/{kitTotal}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Expanded-mode bulk action — same "Remove all" handler as
              the header button. Sits above the grid as a small footer
              so it doesn't compete with the tiles for attention. */}
          {addedCount > 0 && (
            <div className="flex items-center justify-between gap-2 pt-1">
              <div className="text-[11.5px] text-muted">
                <b className="text-ink">{addedCount}</b> of {totalAcrossKits} added
              </div>
              <button
                type="button"
                onClick={removeAllPresets}
                className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-muted hover:text-danger transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/40 rounded-sm underline-offset-2 hover:underline"
              >
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
                  <path d="M2 2 L10 10 M10 2 L2 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                Remove all added
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 pt-1">
            {tiles.map(tile => {
              const added = existingNames.has(tile.name.toLowerCase());
              const suggested = tile.suggestedOffsetDays;
              // Render the offset as a short hint on the tile so the
              // user can see at a glance that "Catering" comes 3 days
              // before the event and they don't need to edit the date.
              const offsetHint =
                suggested === 0
                  ? 'On event day'
                  : suggested > 0
                    ? `+${suggested}d after`
                    : `${suggested}d before`;
              return (
                <button
                  key={`${tile.kit}-${tile.name}`}
                  type="button"
                  onClick={() => added ? removeOne(tile.name) : addOne(tile)}
                  title={
                    added
                      ? `Remove ${tile.name} from this event`
                      : `Add ${tile.name} — ${offsetHint}`
                  }
                  aria-pressed={added}
                  className={[
                    'group rounded-input border text-left px-3 py-2.5 flex items-center gap-2.5 transition',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                    added
                      ? 'bg-primary/10 border-primary text-ink hover:bg-primary/15'
                      : 'bg-surface border-border hover:border-primary hover:-translate-y-0.5',
                  ].join(' ')}
                >
                  <span className="text-[20px] shrink-0" aria-hidden>{tile.emoji}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold text-ink truncate">
                      {tile.name}
                    </span>
                    <span className="block text-[10.5px] text-muted truncate">
                      {added ? 'Tap to remove' : tile.hint}
                    </span>
                  </span>
                  {added ? (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      fill="none"
                      aria-hidden
                      className="shrink-0 text-muted group-hover:text-danger transition"
                    >
                      <path d="M3 3 L11 11 M11 3 L3 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 14 14"
                      fill="none"
                      aria-hidden
                      className="shrink-0 text-muted group-hover:text-primary transition"
                    >
                      <path d="M7 1.5 V12.5 M1.5 7 H12.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>

          {/* Active-kit summary footer — tells the user the active kit
              (so they know where they are when flipping tabs) and the
              seeding rule (so they know what to expect). Drawn AFTER
              the grid so the first thing in the panel is "what can I
              add", and the last thing is "what just happened". */}
          <div className="text-[11.5px] text-muted pt-2 border-t border-border/60 flex flex-wrap gap-x-4 gap-y-1">
            <span>
              <b className="text-ink">{EVENT_KIT_LABELS[activeKit]}</b> kit
              {tiles.length > 0 ? ` · ${tiles.length} preset${tiles.length === 1 ? '' : 's'}` : ''}
            </span>
            <span>
              Dates land at <b className="text-ink">event date + offset</b>. Adjust per category.
            </span>
            {activeKit === 'generic' && (
              <span>Generic covers events that don't fit the named kits.</span>
            )}
            {activeKit === 'religious' && (
              <span>Religious covers faith-based occasions — Eid, Puja, Christmas, Buddha Purnima, etc. Add your own clergy presets.</span>
            )}
          </div>
        </>
      )}
      {confirmDialog}
    </section>
  );
}
