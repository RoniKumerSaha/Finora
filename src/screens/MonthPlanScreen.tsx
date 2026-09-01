/**
 * MonthPlanScreen — Month Planner.
 *
 * Visual target: docs/ux-designs/ux-finora-2026-08-17-month-planner/
 * .working-jars-redesign/index.html — variant #5 (progress ring).
 * Each item is a card with a conic-gradient ring around the emoji
 * and a compact body on the right showing the planned amount, the
 * budget, and a coloured percent label. The 3-step palette (blue /
 * green / red) matches the Event Planner category cards.
 *
 * 2026-08-17 polish: editor moved into a modal pop-up so the tile
 * grid stays put while editing; income is editable inline above the
 * summary strip. Plan items are user-visible as "items" (not "jars") —
 * the metaphors are still code-named `Jar*` internally.
 */
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../domain/store';
import * as plans from '../domain/plans';
import { fmtBDT, clampNonNegative } from '../lib/format';
import { Button } from '../components/Button';
import { Field, Input } from '../components/Field';
import { useConfirm } from '../components/ConfirmDialog';
import { EmojiPicker } from '../components/planner/EmojiPicker';
import { PresetBudgetCards } from '../components/planner/PresetBudgetCards';
import {
  BatchEditorControls,
  BatchFloatingBar,
  SelectionModeToggle,
} from '../components/planner/BatchBudgetEditor';
import { suggestEmojiForName } from '../lib/categoryEmoji';
import type { PlanCategory } from '../domain/types';
import { CardTotalChecker } from './plan/CardTotalChecker';

export function MonthPlanScreen() {
  const state = useStore(s => s.state);
  const addCategory = useStore(s => s.addMonthCategory);
  const updateCategory = useStore(s => s.updateMonthCategory);
  const removeCategory = useStore(s => s.removeMonthCategory);
  const showBanner = useStore(s => s.showBanner);

  // Always edits the current calendar month — the screen no longer
  // surfaces a month selector, so there is only ever one active plan.
  const activeKey = plans.monthKey();
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [newItemOpen, setNewItemOpen] = useState(false);
  // Selection-mode lives at the screen level so the grid header
  // (toggle pill) and the grid tiles (checkbox overlay) stay in
  // sync. The floating bar reads it; the editor modal reads it too.
  const [selectionMode, setSelectionMode] = useState(false);
  const [batchSelected, setBatchSelected] = useState<Set<string>>(() => new Set());
  const [batchEditorOpen, setBatchEditorOpen] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirm();

  const plan = plans.ensureMonthPlan(state, activeKey);

  function startNewCategory() {
    setNewItemOpen(true);
    setSelectedCatId(null);
  }

  function commitNewCategory(input: { emoji: string; name: string; budget: number; planned: number }) {
    if (!input.name.trim()) {
      showBanner({ what: 'Name the item', why: 'An item without a name has no plan.', fix: 'Type a name (e.g. "Groceries") then save.' });
      return;
    }
    addCategory(activeKey, {
      emoji: input.emoji,
      name: input.name.trim(),
      budget: input.budget,
      planned: input.planned,
      tone: plans.PLAN_TONES[plan.categories.length % plans.PLAN_TONES.length],
    });
    setNewItemOpen(false);
  }

  const selectedCat = selectedCatId
    ? plan.categories.find(c => c.id === selectedCatId) ?? null
    : null;

  return (
    <div className="flex flex-col gap-5 max-w-5xl w-full">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="heading h1-screen">Plan my month</h1>
          <div className="text-muted text-[13px] mt-1.5 max-w-prose">
            Fill the items with budgets for what you intend to spend. Changes save as you go.
          </div>
        </div>
        {plan.categories.length > 0 && (
          <div className="flex items-center gap-2 text-[12px] text-muted">
            <span
              aria-hidden
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: 'var(--primary)' }}
            />
            <span>
              <b className="text-ink font-bold text-[15px]">{plan.categories.length}</b>
              <span className="ml-1">card{plan.categories.length === 1 ? '' : 's'} in plan</span>
            </span>
          </div>
        )}
      </div>

      {/* Deficit warning removed: income is no longer a per-plan surface,
          so the "planning to spend more than income" comparison no
          longer applies. */}

      {/* Card-total checker — multi-select checklist for a quick sum
          of selected items in this month. Sits between the summary
          strip and the items grid so it's the first thing the user
          sees when they want to know "if I pay these today, how
          much?". */}
      <CardTotalChecker />

      {/* Quick-start preset cards — one-click starter set covering
          typical Bangladesh household budget categories (rent,
          groceries, utilities, transport, etc.). Each card lands
          with budget 0 so the user can edit and commit. Hidden
          once the user already has items so it doesn't compete with
          the working plan. */}
      <PresetBudgetCards
        activeKey={activeKey}
        existing={plan.categories}
      />

      {/* Grid panel: sits on --bg (page). Items use --surface-2 so each
          card visually lifts off the panel — the previous version
          had cards matching the panel exactly and only borders
          separated them. The grid header holds the selection-mode
          toggle so the user can switch to "select multiple" any
          time without leaving the grid. */}
      <div className="rounded-card border border-border p-6" style={{ background: 'var(--bg)' }}>
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <div className="text-[11px] text-muted uppercase tracking-[0.08em] font-semibold">
              Your items
            </div>
            <div className="inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-pill bg-surface-2 text-[11px] font-bold tabular text-ink border border-border">
              {plan.categories.length}
            </div>
            {selectionMode && (
              <span className="text-[12px] text-primary font-semibold">
                · Tap cards to select
              </span>
            )}
          </div>
          <SelectionModeToggle
            selectionMode={selectionMode}
            onToggle={() => {
              setSelectionMode(v => {
                if (v) setBatchSelected(new Set());
                return !v;
              });
            }}
            selectedCount={batchSelected.size}
            totalCount={plan.categories.length}
          />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {plan.categories.map(c => (
            <JarTile
              key={c.id}
              cat={c}
              selected={c.id === selectedCatId}
              selectionMode={selectionMode}
              isSelectedForBatch={batchSelected.has(c.id)}
              onSelect={() => {
                if (selectionMode) {
                  // Toggle selection; do NOT open the editor modal
                  // in selection mode — tapping the card just picks /
                  // unpicks it.
                  setBatchSelected(prev => {
                    const next = new Set(prev);
                    if (next.has(c.id)) next.delete(c.id); else next.add(c.id);
                    return next;
                  });
                  return;
                }
                setSelectedCatId(c.id);
                setNewItemOpen(false);
              }}
              onRemove={async () => {
                // Confirm before discarding the item — pure scratch,
                // but a tap in the wrong place shouldn't lose work.
                const ok = await confirm({
                  title: `Delete “${c.name}”?`,
                  body: 'This item will be removed from this month\u2019s plan.',
                  dangerText: 'The budget value for this item is removed.',
                  confirmLabel: 'Delete',
                  danger: true,
                });
                if (!ok) return;
                removeCategory(activeKey, c.id);
                if (selectedCatId === c.id) setSelectedCatId(null);
                setBatchSelected(prev => {
                  if (!prev.has(c.id)) return prev;
                  const next = new Set(prev);
                  next.delete(c.id);
                  return next;
                });
              }}
            />
          ))}
          <button
            type="button"
            onClick={startNewCategory}
            aria-label="Add new item"
            className="min-h-[110px] rounded-card border border-dashed border-border text-muted hover:text-primary hover:border-primary text-[13px] font-semibold px-4 py-3 flex flex-col items-center justify-center gap-1.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            style={{ background: 'color-mix(in srgb, var(--surface-2) 60%, transparent)' }}
          >
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-dashed border-current" aria-hidden>
              <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
                <path d="M7 1.5 V12.5 M1.5 7 H12.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </span>
            <span>New item</span>
            <span className="text-[10.5px] font-normal text-muted/80 text-center leading-tight px-1">
              Custom card not in the picker
            </span>
          </button>
        </div>
        {/* Legend / help text — explains what each affordance on
            the items grid does so users don't have to guess. The
            "tap to edit" hint is universal, but selection mode,
            delete-X, and the new-item button are easy to miss. */}
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[11.5px] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-primary-on" aria-hidden>
              <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                <path d="M2 5 L4.2 7.2 L8 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            Selected — tap to open the budget editor
          </span>
          <span className="inline-flex items-center gap-1.5">
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path d="M3 3 L11 11 M11 3 L3 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            Hover a card to delete it
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-4 h-4 rounded border border-current" aria-hidden>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 5 L4.2 7.2 L8 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            Tap “Select multiple” to bulk-edit budgets
          </span>
        </div>
      </div>

      {/* Floating selection action bar — slides up from the bottom
          when selectionMode is on. The primary CTA opens the editor
          modal directly (no intermediate chip-picker step). */}
      <BatchFloatingBar
        categories={plan.categories}
        selectedIds={batchSelected}
        selectionMode={selectionMode}
        onClearSelection={() => setBatchSelected(new Set())}
        onSelectAll={() => setBatchSelected(new Set(plan.categories.map(c => c.id)))}
        onExitSelection={() => {
          setSelectionMode(false);
          setBatchSelected(new Set());
        }}
        onOpenEditor={() => setBatchEditorOpen(true)}
      />

      {/* Editor modal — same Custom / Same amount / Adjust % / Clear
          modes as before. Single store write per apply. */}
      <BatchEditorControls
        open={batchEditorOpen}
        categories={plan.categories}
        selectedIds={Array.from(batchSelected)}
        onDone={() => {
          setBatchEditorOpen(false);
          setSelectionMode(false);
          setBatchSelected(new Set());
        }}
        onCancel={() => setBatchEditorOpen(false)}
      />

      {selectedCat && !selectionMode && (
        <JarEditorModal
          cat={selectedCat}
          onUpdate={patch => updateCategory(activeKey, selectedCat.id, patch)}
          onRemove={() => { removeCategory(activeKey, selectedCat.id); setSelectedCatId(null); }}
          onEmpty={() => updateCategory(activeKey, selectedCat.id, { budget: 0 })}
          onClose={() => setSelectedCatId(null)}
        />
      )}

      {newItemOpen && (
        <NewItemModal
          onSave={commitNewCategory}
          onClose={() => setNewItemOpen(false)}
        />
      )}

      <div className="text-xs text-muted text-center">
        ⓘ Tap an item to edit it in a pop-up. Changes save automatically.
      </div>
      {confirmDialog}
    </div>
  );
}

/* ── Editable income pill (removed: income is no longer a per-plan
      field on this surface — the user only needs the items grid
      and the deficit warning now). ──────────────────────────────── */

/* ── Sub-components ──────────────────────────────────────────────── */

// Tonal palette used to paint the ring of a budget-less item.
// Deterministic per id (same item always gets the same colour).
// Picks the same family as the Event Planner category tone palette
// so the planners feel of-a-piece, minus the danger/success tones
// (those read as status alerts, not decoration).
const TONE_COLOR_VARS: ReadonlyArray<string> = [
  'var(--primary)', 'var(--accent)', 'var(--info)',
  'var(--warn)', 'var(--cyan)', 'var(--orange)',
];

/**
 * Pick a stable random colour from the tonal palette based on the
 * category id. Used for budget-less items so their ring still reads
 * as a card (full + coloured) rather than an empty hole.
 *
 * The hash is trivial (sum of char codes modded into the palette
 * length) because distribution across 7 buckets doesn't need to be
 * cryptographic — we just want each id to land somewhere stable and
 * different-looking from its neighbours.
 */
function randomToneColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i)) | 0;
  const idx = Math.abs(h) % TONE_COLOR_VARS.length;
  return TONE_COLOR_VARS[idx];
}


function JarTile({
  cat,
  selected,
  selectionMode,
  isSelectedForBatch,
  onSelect,
  onRemove,
}: {
  cat: PlanCategory;
  selected: boolean;
  selectionMode: boolean;
  isSelectedForBatch: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const budget = Number(cat.budget) || 0;
  const hasBudget = budget > 0;
  // Every card's ring fills 100% with a stable random colour drawn
  // from the tonal palette (deterministic on the id, so reloads don't
  // reshuffle the assignment). Planned-vs-budget no longer drives the
  // ring — the body text shows the budget figure instead.
  const ringColor = randomToneColor(cat.id);
  // Inner disc is slightly smaller than the outer ring so the donut
  // has a clear, readable band.
  const ringOuter = 'w-[68px] h-[68px]';
  const ringInner = 'w-[56px] h-[56px]';

  // Visual states:
  //   - Resting:       bordered, no extra overlay.
  //   - Selected:      ring + tinted border to confirm "this opens the editor".
  //   - Selection mode, picked:  primary-tinted bg + ring + filled checkbox.
  //   - Selection mode, unpicked: muted checkbox hint, no ring.
  // In selection mode we deliberately drop the hover-X delete button
  // — the user is in "pick a batch" mode, not "edit a card" mode.
  const showPickedOverlay = selectionMode && isSelectedForBatch;
  const showEditorRing = !selectionMode && selected;
  const accentBorder = showPickedOverlay
    ? 'border-primary ring-2 ring-primary'
    : selectionMode
      ? 'border-border'
      : selected
        ? 'border-primary'
        : 'border-border';

  return (
    <div className="relative group">
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selectionMode ? isSelectedForBatch : undefined}
        className={[
          'w-full min-h-[110px] rounded-card border text-left pl-4 pr-9 py-3 flex items-center gap-3 transition',
          selectionMode ? '' : 'hover:-translate-y-0.5',
          accentBorder,
        ].join(' ')}
        style={{
          background: showPickedOverlay
            ? 'color-mix(in srgb, var(--primary) 14%, var(--surface-2))'
            : 'var(--surface-2)',
          boxShadow: showEditorRing
            ? 'var(--shadow-planner-card-hi2)'
            : showPickedOverlay
              ? 'var(--shadow-planner-card-hi)'
              : 'var(--shadow-planner-card)',
        }}
      >
        {/* Progress ring. Two layered circles: an outer ring and an
            inner solid disc with the emoji. Always fills 100% with
            a stable random colour — there's no planned-vs-budget
            math driving it. */}
        <span
          aria-hidden
          className={`${ringOuter} rounded-full shrink-0 relative`}
          style={{
            background: ringColor,
          }}
        >
          <span
            className={`${ringInner} rounded-full absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center text-[24px] leading-none`}
            style={{ background: 'var(--surface-2)' }}
          >
            {cat.emoji}
          </span>
        </span>

        {/* Body — title and budget figure. */}
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <div
            className="text-[14px] font-semibold text-ink leading-snug truncate"
            title={cat.name}
          >
            {cat.name}
          </div>
          <div className="flex items-baseline gap-1 min-w-0">
            <span className="shrink-0 text-[10px] uppercase tracking-[0.08em] font-semibold text-muted">
              Budget
            </span>
            <span className="font-bold text-[15px] text-ink tabular leading-none whitespace-nowrap truncate">
              {hasBudget ? fmtBDT(budget) : '—'}
            </span>
          </div>
        </div>
      </button>

      {/* Selection-mode big checkbox — sits in the top-right corner
          of the card. Always visible in selection mode so users see
          "this is a pickable surface" without having to hover. In
          normal mode it stays hidden (default hover-X takes its
          place). The filled state shows a tick; the empty state
          shows a faint hint ring so it's never "invisible". */}
      {selectionMode ? (
        <span
          aria-hidden
          className={[
            'absolute top-2 right-2 w-7 h-7 rounded-full inline-flex items-center justify-center transition border-2',
            isSelectedForBatch
              ? 'bg-primary border-primary text-primary-on'
              : 'bg-surface-2 border-border text-transparent',
          ].join(' ')}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 6 L5 8.5 L9.5 3.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      ) : (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onRemove(); }}
          aria-label={`Delete ${cat.name}`}
          title="Delete item"
          className="absolute top-2 right-2 w-7 h-7 rounded-full inline-flex items-center justify-center text-muted hover:text-danger hover:bg-surface transition opacity-0 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-primary/40 [.group:hover>&]:opacity-100"
          style={{ background: 'color-mix(in srgb, var(--surface) 60%, transparent)' }}
        >
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden>
            <path d="M3 3 L11 11 M11 3 L3 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
}

function NewItemModal({ onSave, onClose }: {
  onSave: (input: { emoji: string; name: string; budget: number; planned: number }) => void;
  onClose: () => void;
}) {
  // Local drafts so the user can type freely without committing half-
  // typed values to the store (the existing JarEditorModal uses the
  // same pattern). Escape closes; Enter submits the form.
  //
  // Create flow is budget-only: a fresh item starts at planned=0 and
  // the user can bump the planned amount later (e.g. via the card
  // total checker on /plan/month). No second field here.
  const [emoji, setEmoji] = useState('🛒');
  const [name, setName] = useState('');
  const [budgetText, setBudgetText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  // Auto-suggest an icon as the user types — typing "rent" swaps
  // the default 🛒 for 🏠, "groceries" for 🛒, etc. The user can
  // still pick anything from the picker; this is just a hint.
  const userPickedEmojiRef = useRef(false);
  useEffect(() => {
    if (userPickedEmojiRef.current) return;
    const guess = suggestEmojiForName(name);
    if (guess && guess !== emoji) setEmoji(guess);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    onSave({
      emoji,
      name: name.trim(),
      budget: clampNonNegative(budgetText),
      planned: 0,
    });
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-item-title"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
        style={{
          background: 'var(--overlay)',
          backdropFilter: 'blur(8px)',
          animation: 'backdrop-fade-in 180ms ease-out both',
        }}
      />
      <div
        className="relative rounded-card w-[480px] max-w-full shadow-modal"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-modal), var(--card-inset)',
          padding: '28px',
          animation: 'modal-pop-in 180ms ease-out both',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 w-8 h-8 rounded-full inline-flex items-center justify-center text-muted hover:text-ink hover:bg-surface-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
            <path d="M2 2 L12 12 M12 2 L2 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </button>

        <div className="mb-4 pr-8">
          <h3 id="new-item-title" className="heading h3-modal m-0">Add new item</h3>
          <div className="text-muted text-[12.5px] mt-1">
            Pick an icon, name the item, set the budget. You can edit the budget later.
          </div>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.08em] text-muted font-semibold mb-1.5">Icon</div>
            <EmojiPicker value={emoji} onChange={(next) => { userPickedEmojiRef.current = true; setEmoji(next); }} />
          </div>
          <Field label="Name">
            <Input
              ref={inputRef}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Groceries, Rent, Transport…"
              autoFocus
            />
          </Field>
          <Field label="Budget (optional)">
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              value={budgetText}
              onChange={e => setBudgetText(e.target.value)}
              placeholder="0"
            />
          </Field>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outlined-ghost" onClick={onClose}>Cancel</Button>
            <Button variant="outlined-primary" type="submit">Save item</Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

/* ── Modal item editor ────────────────────────────────────────────── */

function JarEditorModal({ cat, onUpdate, onRemove, onEmpty, onClose }: {
  cat: PlanCategory;
  onUpdate: (patch: Partial<PlanCategory>) => void;
  onRemove: () => void;
  onEmpty: () => void;
  onClose: () => void;
}) {
  // Zero values render as empty drafts (placeholder takes over) so
  // the field doesn't pre-place "0" when the user means "not set".
  // Empty still commits as 0 via clampNonNegative in the change path.
  //
  // Edit flow is budget-only: planned is read-only here (set when the
  // item is created or implicitly bumped by ticking it in the card
  // total checker on /plan/month). Keeps the modal surface small and
  // matches the create flow.
  const [budgetText, setBudgetText] = useState(cat.budget > 0 ? String(cat.budget) : '');
  // Re-seed drafts when the modal opens for a different item.
  useEffect(() => {
    setBudgetText(cat.budget > 0 ? String(cat.budget) : '');
  }, [cat.id]);

  const budget = Number(cat.budget) || 0;
  // Mini-preview mirrors the card: the ring is a solid 100% colour
  // drawn from the same random palette, no planned-vs-budget math.
  const ringColor = randomToneColor(cat.id);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="item-editor-title"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
        style={{
          background: 'var(--overlay)',
          backdropFilter: 'blur(8px)',
          animation: 'backdrop-fade-in 180ms ease-out both',
        }}
      />
      <div
        className="relative rounded-card w-[480px] max-w-full shadow-modal"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-modal), var(--card-inset)',
          padding: '28px',
          animation: 'modal-pop-in 180ms ease-out both',
        }}
      >
        {/* Close button — top right, always present. */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 w-8 h-8 rounded-full inline-flex items-center justify-center text-muted hover:text-ink hover:bg-surface-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
            <path d="M2 2 L12 12 M12 2 L2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        <div className="flex items-start justify-between gap-3 mb-2 pr-8">
          <div>
            <h3 id="item-editor-title" className="heading h3-modal m-0">
              {cat.emoji} {cat.name}
            </h3>
            <div className="text-muted text-[12.5px] mt-1">Set the budget.</div>
          </div>
          <span
            className="text-[11px] font-bold uppercase tracking-[0.04em] px-2.5 py-1 rounded-pill whitespace-nowrap flex items-center gap-1.5"
            style={{
              background: 'var(--surface-2)',
              color: 'var(--ink)',
              border: '1px solid var(--border)',
            }}
          >
            <span aria-hidden className="w-1.5 h-1.5 rounded-full" style={{ background: ringColor }} />
            {budget > 0 ? 'Budget set' : 'No budget'}
          </span>
        </div>

        {/* Mini-preview — mirrors the card in the grid. Same 68px
            ring + body layout. Ring is a solid 100% fill in the
            item's stable random colour so the preview matches what
            the user sees on the grid card. */}
        <div className="my-3 flex justify-center">
          <div
            className="w-full max-w-[300px] min-h-[110px] rounded-card border px-4 py-3 flex items-center gap-3"
            style={{
              background: 'var(--surface-2)',
              borderColor: 'var(--border)',
              boxShadow: 'var(--shadow-planner-card)',
            }}
          >
            <span
              aria-hidden
              className="w-[68px] h-[68px] rounded-full shrink-0 relative"
              style={{
                background: ringColor,
              }}
            >
              <span
                className="w-[56px] h-[56px] rounded-full absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center text-[24px] leading-none"
                style={{ background: 'var(--surface-2)' }}
              >
                {cat.emoji}
              </span>
            </span>
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <div
                className="text-[14px] font-semibold text-ink leading-snug truncate"
                title={cat.name}
              >
                {cat.name}
              </div>
              <div className="flex items-baseline gap-1 min-w-0">
                <span className="shrink-0 text-[10px] uppercase tracking-[0.08em] font-semibold text-muted">
                  Budget
                </span>
                <span className="font-bold text-[15px] text-ink tabular leading-none whitespace-nowrap truncate">
                  {budget > 0 ? fmtBDT(budget) : '—'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Budget field only. Planned is no longer edited here — it's
            set at create time (0) and updated elsewhere; the card's
            title-and-budget body reflects that. */}
        <div className="grid grid-cols-1 gap-3">
          <Field label="Budget">
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              value={budgetText}
              placeholder="0"
              onChange={e => {
                const raw = e.target.value;
                setBudgetText(raw);
                const n = clampNonNegative(raw);
                if (raw !== '' && raw !== '-') onUpdate({ budget: n });
                else if (raw === '') onUpdate({ budget: 0 });
              }}
            />
          </Field>
        </div>

        {/* Primary action row — only the safe actions. */}
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="outlined-ghost" onClick={onEmpty}>Clear budget</Button>
          <Button variant="outlined-primary" onClick={onClose}>Save</Button>
        </div>

        {/* Danger zone — visually separated so users don't hit Remove by accident. */}
        <div
          className="mt-4 pt-3 flex justify-between items-center text-[12px]"
          style={{
            borderTop: '1px dashed var(--border)',
          }}
        >
          <span className="text-muted">Done with this item?</span>
          <Button variant="ghost" className="text-danger hover:text-danger" onClick={onRemove}>Remove item</Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}