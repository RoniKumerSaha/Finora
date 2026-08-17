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
import type { FocusEvent } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../domain/store';
import * as plans from '../domain/plans';
import { fmtBDT, clampNonNegative } from '../lib/format';
import { Button } from '../components/Button';
import { Field, Input } from '../components/Field';
import { useConfirm } from '../components/ConfirmDialog';
import { EmojiPicker } from '../components/planner/EmojiPicker';
import { categoryFillStatus, CATEGORY_FILL, formatPct, pctOf, frostedPillStyle } from '../components/planner/jarVisuals';
import type { PlanCategory } from '../domain/types';

export function MonthPlanScreen() {
  const state = useStore(s => s.state);
  const savePlan = useStore(s => s.saveMonthPlan);
  const resetPlan = useStore(s => s.resetMonthPlan);
  const patchPlan = useStore(s => s.patchMonthPlan);
  const addCategory = useStore(s => s.addMonthCategory);
  const updateCategory = useStore(s => s.updateMonthCategory);
  const removeCategory = useStore(s => s.removeMonthCategory);
  const showBanner = useStore(s => s.showBanner);

  const [activeKey, setActiveKey] = useState(plans.monthKey());
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [newItemOpen, setNewItemOpen] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirm();

  const plan = plans.ensureMonthPlan(state, activeKey);
  const summary = plans.summariseMonthPlan(plan);

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
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 flex-1">
          <IncomePill
            value={summary.plannedIncome}
            onCommit={n => patchPlan(activeKey, { plannedIncome: n })}
          />
          {(() => {
            // Mirror the cards: 3-step palette (blue / green / red) so
            // the strip stays in lockstep with the ring colours.
            const over = summary.totalBudget > 0 && summary.plannedSpend > summary.totalBudget;
            const tight = summary.totalBudget > 0 && !over && summary.plannedSpend >= summary.totalBudget * 0.8;
            const spentColor = over ? 'var(--danger)' : tight ? 'var(--success)' : 'var(--info)';
            return (
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-pill" style={frostedPillStyle()}>
                <span className="text-[10.5px] uppercase tracking-[0.08em] font-semibold text-muted">Spent</span>
                <span className="font-bold text-[15px] tabular" style={{ color: spentColor }}>{fmtBDT(summary.plannedSpend)}</span>
                <span className="text-[12px] text-muted">/ {fmtBDT(summary.totalBudget)}</span>
              </span>
            );
          })()}
          {(() => {
            // Saving wears the same frosted-pill treatment as the other
            // stats. Positive → success pill; deficit → danger pill;
            // zero → muted. Mirrors the Event Planner strip exactly.
            if (summary.saved > 0) {
              return (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-pill" style={{
                  background: 'color-mix(in srgb, var(--success) 18%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--success) 35%, transparent)',
                }}>
                  <span className="text-[10.5px] uppercase tracking-[0.08em] font-semibold text-muted">Saved</span>
                  <span className="font-bold text-[15px] tabular" style={{ color: 'var(--success-title)' }}>{fmtBDT(summary.saved)}</span>
                </span>
              );
            }
            if (summary.deficit) {
              return (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-pill" style={{
                  background: 'var(--danger-callout-bg)',
                  border: '1px solid color-mix(in srgb, var(--danger) 35%, transparent)',
                }}>
                  <span aria-hidden>⚠</span>
                  <span className="text-[10.5px] uppercase tracking-[0.08em] font-semibold" style={{ color: 'var(--danger-title)' }}>Over income</span>
                  <span className="font-bold text-[15px] tabular" style={{ color: 'var(--danger-title)' }}>{fmtBDT(Math.abs(summary.saved))}</span>
                </span>
              );
            }
            return (
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-pill" style={frostedPillStyle()}>
                <span className="text-[10.5px] uppercase tracking-[0.08em] font-semibold text-muted">Saved</span>
                <span className="font-bold text-[15px] tabular text-muted">৳ 0</span>
              </span>
            );
          })()}
        </div>
        <div className="flex items-center gap-2 shrink-0">
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

      {summary.deficit && (
        <div
          className="text-[12.5px] rounded-pill px-3.5 py-2 inline-flex items-center gap-2"
          style={{
            background: 'var(--danger-callout-bg)',
            border: '1px solid var(--danger)',
            color: 'var(--danger-title)',
            boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--danger) 35%, transparent)',
          }}
        >
          <span aria-hidden>⚠️</span>
          <span>
            You're planning to spend <b className="text-ink">{fmtBDT(summary.shortfall)}</b> more than your income this month.
          </span>
        </div>
      )}

      {/* Grid panel: sits on --bg (page). Items use --surface-2 so each
          card visually lifts off the panel — the previous version
          had cards matching the panel exactly and only borders
          separated them. */}
      <div className="rounded-card border border-border p-6" style={{ background: 'var(--bg)' }}>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
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
                  dangerText: 'Planned and budget values for this item are removed.',
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
          onEmpty={() => updateCategory(activeKey, selectedCat.id, { planned: 0, budget: 0 })}
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
        ⓘ Tap an item to edit it in a pop-up. Switch months with ‹ › — the plan is only saved when you tap <b className="text-ink">Save plan</b>.
      </div>
      {confirmDialog}
    </div>
  );
}

/* ── Editable income pill ────────────────────────────────────────── */

function IncomePill({ value, onCommit }: { value: number; onCommit: (n: number) => void }) {
  // Frosted pill that doubles as the income editor. Click the number
  // to type, Enter commits, Escape reverts. Same draft pattern as the
  // Event Planner's EventBudgetField, but rendered as a pill so the
  // strip stays in lockstep with the Spent / Saving pills beside it.
  //
  // The blur-vs-click race: when the user clicks the ✓ or × buttons,
  // the input loses focus first (onBlur fires) *before* the button's
  // click handler. If onBlur discards unconditionally, the click then
  // commits a draft that's already been reset. We solve this by:
  //   1) wrapping the pill in a ref-checked container
  //   2) on blur, only discard when focus moved *outside* the pill —
  //      otherwise the click handler will own the lifecycle.
  const [draft, setDraft] = useState(String(value ?? ''));
  const [editing, setEditing] = useState(false);
  const pillRef = useRef<HTMLSpanElement>(null);
  useEffect(() => { if (!editing) setDraft(String(value ?? '')); }, [value, editing]);

  const dirty = editing && (Number(draft) || 0) !== value;

  function commit() {
    const n = clampNonNegative(draft);
    if (n !== value) onCommit(n);
    setDraft(String(n));
    setEditing(false);
  }

  function discard() {
    setDraft(String(value ?? ''));
    setEditing(false);
  }

  function handleBlur(e: FocusEvent<HTMLInputElement>) {
    // If focus moved into one of our own buttons, let the click own it.
    const next = e.relatedTarget as Node | null;
    if (next && pillRef.current?.contains(next)) return;
    if (dirty) discard();
  }

  return (
    <span
      ref={pillRef}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-pill"
      style={{
        background: 'color-mix(in srgb, var(--info) 18%, transparent)',
        border: '1px solid color-mix(in srgb, var(--info) 35%, transparent)',
      }}
    >
      <span className="text-[10.5px] uppercase tracking-[0.08em] font-semibold" style={{ color: 'var(--info)' }}>Income</span>
      <span className="font-bold text-[15px] tabular flex items-center gap-0.5" style={{ color: 'var(--info)' }}>
        <span className="text-[12px] opacity-70">৳</span>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          value={draft}
          onChange={e => { setEditing(true); setDraft(e.target.value); }}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); commit(); }
            else if (e.key === 'Escape') { e.preventDefault(); discard(); }
          }}
          onFocus={() => setEditing(true)}
          onBlur={handleBlur}
          placeholder="0"
          aria-label="Income"
          className="bg-transparent border-0 border-b border-dashed focus:outline-none tabular w-[80px] text-right"
          style={{
            color: 'var(--info)',
            borderColor: 'color-mix(in srgb, var(--info) 35%, transparent)',
          }}
        />
      </span>
      {dirty && (
        <span className="flex items-center gap-1">
          <button
            type="button"
            onClick={discard}
            aria-label="Discard income change"
            title="Discard"
            className="w-5 h-5 rounded-full inline-flex items-center justify-center text-muted hover:text-ink hover:bg-surface-2 transition"
          >
            <svg width="10" height="10" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path d="M2 2 L12 12 M12 2 L2 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
          <button
            type="button"
            onClick={commit}
            aria-label="Save income"
            title="Save"
            className="w-5 h-5 rounded-full inline-flex items-center justify-center text-success hover:bg-success-soft transition"
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path d="M2 7 L6 11 L12 3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </span>
      )}
    </span>
  );
}

/* ── Sub-components ──────────────────────────────────────────────── */

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
  const planned = Number(cat.planned) || 0;
  const budget = Number(cat.budget) || 0;
  const pct = pctOf(planned, budget);
  const overflow = budget > 0 && planned > budget;
  // 3-step category palette (blue / green / red) — keeps the ring in
  // lockstep with the Event Planner category cards.
  const status = categoryFillStatus(pct, overflow, budget);
  // Conic-gradient rings don't accept fill > 100% cleanly, so cap
  // visually at full and let the colour swap to red for overflow.
  const ringPct = Math.min(100, pct);
  const fillColor = CATEGORY_FILL[status].color;
  const hasBudget = budget > 0;
  // Inner disc is slightly smaller than the outer ring so the donut
  // has a clear, readable band. When there's no budget we keep the
  // disc opaque but make the surrounding track nearly transparent so
  // the card reads as "no budget yet" rather than "0% filled".
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
            ring (the track + sweep) and an inner solid disc with the
            emoji. A solid track on top is the only reliable way to
            avoid the conic-gradient's transparency showing through and
            making the unfilled portion look like a "cut". When there's
            no budget the entire ring stays muted so the card reads as
            "unset", not as "0% of an empty jar". */}
        <span
          aria-hidden
          className={`${ringOuter} rounded-full shrink-0 relative`}
          style={{
            background: hasBudget
              ? `conic-gradient(${fillColor} 0% ${ringPct}%, color-mix(in srgb, var(--border) 35%, var(--surface)) ${ringPct}% 100%)`
              : `conic-gradient(color-mix(in srgb, var(--border) 35%, var(--surface)) 0% 100%)`,
          }}
        >
          <span
            className={`${ringInner} rounded-full absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center text-[24px] leading-none`}
            style={{ background: 'var(--surface-2)' }}
          >
            {cat.emoji}
          </span>
        </span>

        {/* Body — name (2-line clamp), planned amount, status row.
            The budget number is hidden on the card because the ring
            already conveys budget vs planned visually; showing it twice
            adds noise. The budget value is set / edited inside the
            modal only. */}
        <div className="flex flex-col gap-1.5 min-w-0 flex-1">
          <div
            className="text-[14px] font-semibold text-ink leading-snug"
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              wordBreak: 'break-word',
            }}
          >
            {cat.name}
          </div>
          <div className="font-bold text-[15px] text-ink tabular leading-none">
            {fmtBDT(planned)}
          </div>
          {hasBudget ? (() => {
            const f = formatPct(pct, overflow);
            return (
              <div
                className="text-[10.5px] font-semibold uppercase tracking-[0.04em] leading-none tabular"
                style={{ color: fillColor }}
              >
                {f.number} {f.verb}
              </div>
            );
          })() : (
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.04em] leading-none text-muted">
              Tap to set a budget
            </div>
          )}
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
  const [emoji, setEmoji] = useState('🛒');
  const [name, setName] = useState('');
  const [budgetText, setBudgetText] = useState('');
  const [plannedText, setPlannedText] = useState('');
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
      planned: clampNonNegative(plannedText),
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
            Pick an icon, name the item, set the budget. You can edit any of these later.
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
          <div className="grid grid-cols-2 gap-3">
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
            <Field label="Already spent (optional)">
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                value={plannedText}
                onChange={e => setPlannedText(e.target.value)}
                placeholder="0"
              />
            </Field>
          </div>

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
  const [budgetText, setBudgetText] = useState(String(cat.budget ?? ''));
  const [plannedText, setPlannedText] = useState(String(cat.planned ?? ''));
  // Re-seed drafts when the modal opens for a different item.
  useEffect(() => {
    setBudgetText(String(cat.budget ?? ''));
    setPlannedText(String(cat.planned ?? ''));
  }, [cat.id]);

  const planned = Number(cat.planned) || 0;
  const budget = Number(cat.budget) || 0;
  const pct = budget > 0 ? Math.round((planned / budget) * 100) : 0;
  const overflow = budget > 0 && planned > budget;
  // 3-step category palette (blue / green / red) — same as the card
  // so the mini-preview in the editor matches what the user sees in the
  // grid. Mirrors the Event Planner category cards.
  const status = categoryFillStatus(pct, overflow, budget);

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
            <div className="text-muted text-[12.5px] mt-1">Set the budget, plan the spend.</div>
          </div>
          <span
            className="text-[11px] font-bold uppercase tracking-[0.04em] px-2.5 py-1 rounded-pill whitespace-nowrap flex items-center gap-1.5"
            style={{
              background: 'var(--surface-2)',
              color: 'var(--ink)',
              border: '1px solid var(--border)',
            }}
          >
            <span aria-hidden className="w-1.5 h-1.5 rounded-full" style={{ background: CATEGORY_FILL[status].color }} />
            {budget > 0 ? (overflow ? `${pct}% overflowing` : `${pct}% filled`) : 'No budget'}
          </span>
        </div>

        {/* Mini-preview — mirrors the ring-based card in the grid so
            the user can confirm the colour ramp matches. Same 68px
            ring + body layout. The track colour resolves against the
            card surface so the unfilled portion always reads as a
            clean ring rather than a "cut" through the gradient. */}
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
                background: budget > 0
                  ? `conic-gradient(${CATEGORY_FILL[status].color} 0% ${Math.min(100, pct)}%, color-mix(in srgb, var(--border) 35%, var(--surface-2)) ${Math.min(100, pct)}% 100%)`
                  : `conic-gradient(color-mix(in srgb, var(--border) 35%, var(--surface-2)) 0% 100%)`,
              }}
            >
              <span
                className="w-[56px] h-[56px] rounded-full absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center text-[24px] leading-none"
                style={{ background: 'var(--surface-2)' }}
              >
                {cat.emoji}
              </span>
            </span>
            <div className="flex flex-col gap-1.5 min-w-0 flex-1">
              <div
                className="text-[14px] font-semibold text-ink leading-snug"
                style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  wordBreak: 'break-word',
                }}
              >
                {cat.name}
              </div>
              <div className="font-bold text-[15px] text-ink tabular leading-none">
                {fmtBDT(planned)}
              </div>
              {budget > 0 ? (() => {
                const f = formatPct(pct, overflow);
                return (
                  <div
                    className="text-[10.5px] font-semibold uppercase tracking-[0.04em] leading-none tabular"
                    style={{ color: CATEGORY_FILL[status].color }}
                  >
                    {f.number} {f.verb}
                  </div>
                );
              })() : (
                <div className="text-[10.5px] font-semibold uppercase tracking-[0.04em] leading-none text-muted">
                  Tap to set a budget
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Budget">
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              value={budgetText}
              onChange={e => {
                const raw = e.target.value;
                setBudgetText(raw);
                const n = clampNonNegative(raw);
                if (raw !== '' && raw !== '-') onUpdate({ budget: n });
                else if (raw === '') onUpdate({ budget: 0 });
              }}
            />
          </Field>
          <Field label="Spent">
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              value={plannedText}
              onChange={e => {
                const raw = e.target.value;
                setPlannedText(raw);
                const n = clampNonNegative(raw);
                if (raw !== '' && raw !== '-') onUpdate({ planned: n });
                else if (raw === '') onUpdate({ planned: 0 });
              }}
            />
          </Field>
        </div>

        {/* Primary action row — only the safe actions. */}
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="ghost" onClick={onEmpty}>Empty item</Button>
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