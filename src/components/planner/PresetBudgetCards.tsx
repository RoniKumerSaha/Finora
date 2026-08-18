/**
 * PresetBudgetCards — quick-add grid of common budget categories.
 *
 * Shown on the Month Planner when the user has no items yet (and
 * available any time via a "Quick add" toggle). Each card starts
 * with budget = 0 so the user can drop a card in, then tap it to
 * open the editor and set the actual amount.
 *
 * Toggleable: tapping a tile that's NOT in the plan adds it.
 * Tapping a tile that IS in the plan (and confirmed via dialog
 * because removing discards the budget the user might have typed)
 * removes it. The checkmark tile stays visible — users can flip
 * between added / removed freely without leaving the picker.
 *
 * Visual: a compact 5-col grid of mini-tiles. Each tile shows the
 * emoji, the label, and a small "0" hint so the user knows the
 * budget is unset. Tapping a tile dispatches the add. Tapping
 * "Add all" drops every preset into the plan in a single store
 * write so the dirty flag only flips once.
 */
import { useState } from 'react';
import { useStore } from '../../domain/store';
import { useConfirm } from '../ConfirmDialog';
import type { PlanCategory } from '../../domain/types';
import { PRESET_BUDGET_CARDS } from '../../lib/categoryEmoji';

export function PresetBudgetCards({ activeKey, existing }: {
  activeKey: string;
  existing: PlanCategory[];
}) {
  const addMonthCategories = useStore(s => s.addMonthCategories);
  const removeCategory = useStore(s => s.removeMonthCategory);
  const showBanner = useStore(s => s.showBanner);
  const { confirm, dialog: confirmDialog } = useConfirm();

  const existingNames = new Set(existing.map(c => c.name.toLowerCase()));
  const tiles = PRESET_BUDGET_CARDS;

  // Auto-collapse the panel once the user already has cards in their
  // plan — the picker is most useful as a *starter* tool, so it
  // shouldn't compete with the working grid for vertical space.
  // The user can re-open it any time with "Show presets".
  const [expanded, setExpanded] = useState(existing.length === 0);

  function addOne(emoji: string, name: string) {
    addMonthCategories(activeKey, [
      { emoji, name, budget: 0, planned: 0 },
    ]);
  }

  async function removeOne(name: string) {
    const target = existing.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (!target) return;
    // Confirm before removing a preset card. Removing a card that
    // has a budget = 0 is safe-ish but still discards a tile the
    // user explicitly added; confirm keeps the gesture intentional
    // and lets the user back out if they tapped the wrong tile.
    const ok = await confirm({
      title: `Remove “${target.name}”?`,
      body: 'This card will be taken out of this month\u2019s plan.',
      dangerText: 'The budget you set for this card is removed.',
      confirmLabel: 'Remove',
      danger: true,
    });
    if (!ok) return;
    removeCategory(activeKey, target.id);
    showBanner({
      kind: 'info',
      what: `Removed “${target.name}”`,
      why: 'The preset card is back in the picker — add it again any time.',
      fix: 'Tap Save plan to keep the change.',
    });
  }

  function addAll() {
    const missing = tiles.filter(t => !existingNames.has(t.name.toLowerCase()));
    if (missing.length === 0) return;
    addMonthCategories(
      activeKey,
      missing.map(t => ({ emoji: t.emoji, name: t.name, budget: 0, planned: 0 })),
    );
    showBanner({
      kind: 'success',
      what: `${missing.length} card${missing.length === 1 ? '' : 's'} added`,
      why: 'Dropped in with budget ৳0 — tap any card below to set the amount.',
      fix: 'Remove what you don\'t need, or tap Save plan when you\'re done.',
    });
  }

  const allAdded = tiles.every(t => existingNames.has(t.name.toLowerCase()));
  const missingCount = tiles.length - existingNames.size;

  // If every preset is already in the plan and there are no other
  // categories to add, hide the entire panel. The user has nothing
  // useful to do here.
  if (allAdded) return null;

  return (
    <section
      aria-label="Quick add budget cards"
      className="rounded-card border border-border p-4 sm:p-5 flex flex-col gap-3"
      style={{ background: 'var(--surface-2)' }}
    >
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
            <div className="font-semibold text-[14.5px] text-ink">
              {expanded ? 'Quick start' : `${missingCount} preset${missingCount === 1 ? '' : 's'} ready to add`}
            </div>
            <div className="text-[12px] text-muted mt-0.5 truncate">
              {expanded
                ? 'Tap a tile to add or remove it. Cards land with budget ৳0.'
                : 'Rent, groceries, utilities, transport, and more — one click to drop in.'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!expanded && missingCount > 0 && (
            <button
              type="button"
              onClick={addAll}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-btn text-[12px] font-semibold transition bg-surface border border-border text-ink hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
                <path d="M2 6 L5 9 L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Add all
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 pt-1">
          {tiles.map(card => {
            const added = existingNames.has(card.name.toLowerCase());
            return (
              <button
                key={card.name}
                type="button"
                onClick={() => added ? removeOne(card.name) : addOne(card.emoji, card.name)}
                title={
                  added
                    ? `Remove ${card.name} from your plan`
                    : `Add ${card.name}`
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
                <span className="text-[20px] shrink-0" aria-hidden>{card.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-ink truncate">
                    {card.name}
                  </span>
                  <span className="block text-[10.5px] text-muted truncate">
                    {added ? 'Tap to remove' : card.hint}
                  </span>
                </span>
                {added ? (
                  // X icon for remove. Stays small + low contrast so
                  // the tile doesn't shout "delete" when scanning the
                  // grid — but it's there on hover/focus.
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
      )}
      {confirmDialog}
    </section>
  );
}
