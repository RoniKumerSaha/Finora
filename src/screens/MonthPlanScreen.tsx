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
import type { PlanCategory } from '../domain/types';
import { CardTotalChecker } from './plan/CardTotalChecker';

export function MonthPlanScreen() {
  const state = useStore(s => s.state);
  const savePlan = useStore(s => s.saveMonthPlan);
  const resetPlan = useStore(s => s.resetMonthPlan);
  const addCategory = useStore(s => s.addMonthCategory);
  const updateCategory = useStore(s => s.updateMonthCategory);
  const removeCategory = useStore(s => s.removeMonthCategory);
  const showBanner = useStore(s => s.showBanner);

  const [activeKey, setActiveKey] = useState(plans.monthKey());
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [newItemOpen, setNewItemOpen] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirm();

  const plan = plans.ensureMonthPlan(state, activeKey);

  function shiftMonth(delta: number) {
    setActiveKey(plans.shiftMonthKey(activeKey, delta));
    setSelectedCatId(null);
    setNewItemOpen(false);
  }

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
      <div className="flex flex-wrap justify-between items-end gap-3">
        <div>
          <h1 className="heading h1-screen">Plan my month</h1>
          <div className="text-muted text-[13px] mt-1.5">
            Fill the items. Tap <b className="text-ink">Save plan</b> when it looks right — or <b className="text-ink">Reset</b> to start over.
          </div>
        </div>
        <MonthPager activeKey={activeKey} onShift={shiftMonth} />
      </div>

      <div className="card flex flex-wrap items-center gap-3 sm:gap-5 px-4 py-3">
        <div className="flex items-center gap-2 text-[12.5px] text-muted shrink-0">
          <span
            aria-hidden
            className="w-2 h-2 rounded-full"
            style={{
              background: plan.dirty ? 'var(--warn)' : 'var(--success)',
              boxShadow: `0 0 0 3px color-mix(in srgb, ${plan.dirty ? 'var(--warn)' : 'var(--success)'} 25%, transparent)`,
            }}
          />
          <span>
            {plan.dirty ? <>Unsaved changes</> : <>Saved</>}
          </span>
        </div>
        <div className="hidden sm:block h-5 w-px bg-border" aria-hidden />
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          <Button variant="ghost" onClick={async () => {
            // Reset wipes income + every item back to the plan's saved
            // state — confirm before discarding the working draft.
            const ok = await confirm({
              title: 'Reset month plan?',
              body: 'Your working draft will be discarded and the plan will snap back to the last saved state.',
              dangerText: 'Income and every item value are reverted — this can\u2019t be undone.',
              confirmLabel: 'Reset',
              danger: true,
            });
            if (!ok) return;
            resetPlan(activeKey);
            setSelectedCatId(null);
            setNewItemOpen(false);
          }}>Reset</Button>
          <Button variant="primary" onClick={() => savePlan(activeKey)}>Save plan</Button>
        </div>
      </div>

      {/* Deficit warning removed: income is no longer a per-plan surface,
          so the "planning to spend more than income" comparison no
          longer applies. */}

      {/* Card-total checker — multi-select checklist for a quick sum
          of selected items in this month. Sits between the summary
          strip and the items grid so it's the first thing the user
          sees when they want to know "if I pay these today, how
          much?". */}
      <CardTotalChecker activeKey={activeKey} />

      {/* Grid panel: sits on --bg (page). Items use --surface-2 so each
          card visually lifts off the panel — the previous version
          had cards matching the panel exactly and only borders
          separated them. */}
      <div className="rounded-card border border-border p-6" style={{ background: 'var(--bg)' }}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {plan.categories.map(c => (
            <JarTile
              key={c.id}
              cat={c}
              selected={c.id === selectedCatId}
              onSelect={() => { setSelectedCatId(c.id); setNewItemOpen(false); }}
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
              }}
            />
          ))}
          <button
            type="button"
            onClick={startNewCategory}
            aria-label="Add new item"
            className="min-h-[110px] rounded-card border border-dashed border-border text-muted text-[13px] font-semibold px-4 py-3 flex items-center justify-center gap-2 hover:border-primary hover:text-primary transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            style={{ background: 'color-mix(in srgb, var(--surface-2) 60%, transparent)' }}
          >
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path d="M7 1.5 V12.5 M1.5 7 H12.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span>+ New item</span>
          </button>
        </div>
      </div>

      {selectedCat && (
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
        ⓘ Tap an item to edit it in a pop-up. Switch months with ‹ › — changes are only saved when you tap <b className="text-ink">Save plan</b>.
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


function MonthPager({ activeKey, onShift }: { activeKey: string; onShift: (d: number) => void }) {
  return (
    <div className="inline-flex items-center gap-1 bg-surface border border-border rounded-pill px-2 py-1 text-[13px] text-muted">
      <button
        type="button"
        onClick={() => onShift(-1)}
        aria-label="Previous month"
        className="w-7 h-7 rounded-full inline-flex items-center justify-center hover:bg-surface-2 hover:text-ink transition"
      >‹</button>
      <span className="text-ink font-semibold px-2">{plans.monthLabel(activeKey)}</span>
      <button
        type="button"
        onClick={() => onShift(1)}
        aria-label="Next month"
        className="w-7 h-7 rounded-full inline-flex items-center justify-center hover:bg-surface-2 hover:text-ink transition"
      >›</button>
    </div>
  );
}

function JarTile({ cat, selected, onSelect, onRemove }: {
  cat: PlanCategory;
  selected: boolean;
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

  return (
    <div className="relative group">
      <button
        type="button"
        onClick={onSelect}
        className={[
          'w-full min-h-[110px] rounded-card border text-left pl-4 pr-9 py-3 flex items-center gap-3 transition',
          'hover:-translate-y-0.5',
          selected ? 'ring-2 ring-primary border-primary' : 'border-border',
        ].join(' ')}
        style={{
          background: 'var(--surface-2)',
          boxShadow: selected ? '0 6px 14px rgba(0,0,0,0.25)' : '0 2px 6px rgba(0,0,0,0.18)',
        }}
      >
        {/* Progress ring. Two layered circles: an outer conic-gradient
            ring and an inner solid disc with the emoji. Always fills
            to 100% with a stable random colour from the tonal palette
            so every card reads the same — there's no more planned-vs-
            budget math driving the ring. */}
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

        {/* Body — title (2-line clamp) and budget figure. The card
            shows title + budget only; the ring does the fill work
            visually so we don't repeat the percentage in text. When
            there's no budget the figure slot reads an em-dash so the
            layout doesn't shift. Single horizontal row to keep the
            number from wrapping on narrow grid columns (4-up at md+). */}
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

      {/* Delete button — sits in the top-right corner of the card.
          Shown on hover/focus only so it doesn't clutter the resting
          state but is still keyboard-discoverable. stopPropagation
          keeps the click from also opening the editor. */}
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
            <EmojiPicker value={emoji} onChange={setEmoji} />
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
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="primary" type="submit">Save item</Button>
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
              boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
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
          <Button variant="ghost" onClick={onEmpty}>Clear budget</Button>
          <Button variant="primary" onClick={onClose}>Save</Button>
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