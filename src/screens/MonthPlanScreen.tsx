/**
 * MonthPlanScreen — Month Planner.
 *
 * Visual target: docs/ux-designs/ux-finora-2026-08-17-month-planner/
 * .working/option-G-jars-save.html — piggy jar visuals with a
 * Save plan / Reset row, pager steps months in-memory, no history.
 *
 * 2026-08-17 polish: jar editor moved into a modal pop-up so the tile
 * grid stays put while editing; jar fill colour follows a 4-step ramp
 * (green / yellow / orange / red) keyed off planned ÷ budget; income
 * is editable inline above the summary strip.
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
import { categoryFillStatus, CATEGORY_FILL, formatPct, pctOf, liquidTop, frostedPillStyle } from '../components/planner/jarVisuals';
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
  const [newCatDraft, setNewCatDraft] = useState<{ emoji: string; name: string } | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirm();

  const plan = plans.ensureMonthPlan(state, activeKey);
  const summary = plans.summariseMonthPlan(plan);

  function shiftMonth(delta: number) {
    setActiveKey(plans.shiftMonthKey(activeKey, delta));
    setSelectedCatId(null);
    setNewCatDraft(null);
  }

  function startNewCategory() {
    setNewCatDraft({ emoji: '🛒', name: '' });
    setSelectedCatId(null);
  }

  function commitNewCategory() {
    if (!newCatDraft || !newCatDraft.name.trim()) {
      showBanner({ what: 'Name the jar', why: 'A jar without a name has no plan.', fix: 'Type a name (e.g. "Groceries") then save.' });
      return;
    }
    addCategory(activeKey, {
      emoji: newCatDraft.emoji,
      name: newCatDraft.name.trim(),
      budget: 0,
      planned: 0,
      tone: plans.PLAN_TONES[plan.categories.length % plans.PLAN_TONES.length],
    });
    setNewCatDraft(null);
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
            Fill the jars. Tap <b className="text-ink">Save plan</b> when it looks right — or <b className="text-ink">Reset</b> to start over.
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
            // Mirror the jars: 3-step palette (blue / green / red) so
            // the strip stays in lockstep with the Month Planner jars.
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
            // Reset wipes income + every jar back to the plan's saved
            // state — confirm before discarding the working draft.
            const ok = await confirm({
              title: 'Reset month plan?',
              body: 'Your working draft will be discarded and the plan will snap back to the last saved state.',
              dangerText: 'Income and every jar value are reverted — this can\u2019t be undone.',
              confirmLabel: 'Reset',
              danger: true,
            });
            if (!ok) return;
            resetPlan(activeKey);
            setSelectedCatId(null);
            setNewCatDraft(null);
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

      <div className="card-flat border border-border rounded-card bg-surface p-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {plan.categories.map(c => (
            <JarTile
              key={c.id}
              cat={c}
              selected={c.id === selectedCatId}
              onSelect={() => { setSelectedCatId(c.id); setNewCatDraft(null); }}
            />
          ))}
          {newCatDraft ? (
            <NewJarTile
              draft={newCatDraft}
              onChange={setNewCatDraft}
              onSave={commitNewCategory}
              onCancel={() => setNewCatDraft(null)}
            />
          ) : (
            <button
              type="button"
              onClick={startNewCategory}
              className="rounded-[14px_14px_32px_32px] border border-dashed border-border bg-transparent text-muted text-[13px] font-semibold h-[220px] flex items-center justify-center hover:border-primary hover:text-primary transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              + New jar
            </button>
          )}
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

      <div className="text-xs text-muted text-center">
        ⓘ Tap a jar to edit it in a pop-up. Switch months with ‹ › — the plan is only saved when you tap <b className="text-ink">Save plan</b>.
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

function JarTile({ cat, selected, onSelect }: { cat: PlanCategory; selected: boolean; onSelect: () => void }) {
  const planned = Number(cat.planned) || 0;
  const budget = Number(cat.budget) || 0;
  const pct = pctOf(planned, budget);
  const overflow = budget > 0 && planned > budget;
  // 3-step category palette (blue / green / red) — keeps the jar band
  // in lockstep with the Event Planner category cards, so a half-filled
  // jar reads as "still room" and a 90% jar reads as "at budget".
  const status = categoryFillStatus(pct, overflow, budget);
  const fillTop = liquidTop(planned, budget); // percent from top of jar

  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        'h-[220px] rounded-[14px_14px_32px_32px] border text-left relative overflow-hidden transition',
        'hover:-translate-y-0.5',
        selected ? 'ring-2 ring-primary shadow-[0_6px_14px_rgba(0,0,0,0.35)] border-primary' : 'border-border',
      ].join(' ')}
      style={{ background: 'var(--surface)' }}
    >
      {/* Liquid layer — fills from the bottom up. Stronger gradient so
          the colour is unmistakable even when the fill is small. */}
      <span
        aria-hidden
        className="absolute left-0 right-0 bottom-0 transition-[top]"
        style={{
          top: `${fillTop}%`,
          background: `linear-gradient(180deg, ${CATEGORY_FILL[status].soft} 0%, ${CATEGORY_FILL[status].color} 30%, ${CATEGORY_FILL[status].color} 100%)`,
          opacity: status === 'empty' ? 0 : 1,
        }}
      />
      {/* Tiny status dot */}
      <span
        aria-hidden
        className="absolute right-3 top-3 w-2 h-2 rounded-full z-[3]"
        style={{
          background: CATEGORY_FILL[status].color,
          boxShadow: status === 'empty' ? 'none' : `0 0 0 3px color-mix(in srgb, ${CATEGORY_FILL[status].color} 25%, transparent)`,
        }}
      />
      {/* Title — wrapped in a frosted pill so the text is readable no
          matter what colour band sits underneath. Without this the
          title disappears into the soft tints of yellow/orange. */}
      <div className="absolute top-3 left-3 right-9 z-[2]">
        <div
          className="inline-flex items-center gap-1.5 text-[13px] font-bold max-w-full px-2.5 py-1 rounded-pill"
          style={{ ...frostedPillStyle(), color: 'var(--ink)' }}
        >
          <span className="text-[16px]">{cat.emoji}</span>
          <span className="truncate">{cat.name}</span>
        </div>
      </div>
      {/* Footer amounts — same frosted-pill treatment so the percent
          label is always visible, including on the red overflow jar.
          Percent text is neutral so it stays readable on every band;
          the band colour is conveyed by a small leading dot. */}
      <div className="absolute bottom-2.5 left-2.5 right-2.5 z-[2]">
        <div
          className="px-2.5 py-1.5 rounded-pill flex flex-col gap-0.5"
          style={frostedPillStyle()}
        >
          <div className="font-bold text-[15px] tabular text-ink leading-none">
            {fmtBDT(planned)}
          </div>
          <div className="flex items-center gap-1.5 text-[10.5px] font-bold leading-none text-ink whitespace-nowrap">
            <span
              aria-hidden
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: CATEGORY_FILL[status].color }}
            />
            <span className="uppercase tracking-[0.04em]">
              {budget > 0
                ? (() => {
                    const f = formatPct(pct, overflow);
                    return `${f.number} ${f.verb}`;
                  })()
                : 'No budget set'}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

function NewJarTile({ draft, onChange, onSave, onCancel }: {
  draft: { emoji: string; name: string };
  onChange: (next: { emoji: string; name: string }) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="h-[220px] rounded-[14px_14px_32px_32px] border-2 border-dashed border-border bg-surface-2/40 p-3 flex flex-col gap-2 text-ink">
      <div className="flex items-center gap-2">
        <EmojiPicker value={draft.emoji} onChange={emoji => onChange({ ...draft, emoji })} compact />
        <Input
          value={draft.name}
          onChange={e => onChange({ ...draft, name: e.target.value })}
          placeholder="Jar name"
          autoFocus
        />
      </div>
      <div className="mt-auto flex gap-2">
        <Button variant="primary" onClick={onSave} className="flex-1">Save jar</Button>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

/* ── Modal jar editor ────────────────────────────────────────────── */

function JarEditorModal({ cat, onUpdate, onRemove, onEmpty, onClose }: {
  cat: PlanCategory;
  onUpdate: (patch: Partial<PlanCategory>) => void;
  onRemove: () => void;
  onEmpty: () => void;
  onClose: () => void;
}) {
  const [budgetText, setBudgetText] = useState(String(cat.budget ?? ''));
  const [plannedText, setPlannedText] = useState(String(cat.planned ?? ''));
  // Re-seed drafts when the modal opens for a different jar.
  useEffect(() => {
    setBudgetText(String(cat.budget ?? ''));
    setPlannedText(String(cat.planned ?? ''));
  }, [cat.id]);

  const planned = Number(cat.planned) || 0;
  const budget = Number(cat.budget) || 0;
  const pct = budget > 0 ? Math.round((planned / budget) * 100) : 0;
  const overflow = budget > 0 && planned > budget;
  // 3-step category palette (blue / green / red) — same as the jar tile
  // so the mini-preview in the editor matches what the user sees in the
  // grid. Mirrors the Event Planner category cards.
  const status = categoryFillStatus(pct, overflow, budget);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="jar-editor-title"
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
            <h3 id="jar-editor-title" className="heading h3-modal m-0">
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

        {/* Mini jar preview — mirrors the tile so the user can confirm
            the colour ramp matches what they'll see in the grid. */}
        <div className="my-3 flex justify-center">
          <div
            className="w-[120px] h-[140px] rounded-[10px_10px_22px_22px] border border-border relative overflow-hidden"
            style={{ background: 'var(--surface-2)' }}
          >
            <span
              aria-hidden
              className="absolute left-0 right-0 bottom-0"
              style={{
                top: `${overflow ? 0 : Math.max(0, 100 - pct)}%`,
                background: `linear-gradient(180deg, ${CATEGORY_FILL[status].soft} 0%, ${CATEGORY_FILL[status].color} 100%)`,
                opacity: status === 'empty' ? 0 : 1,
              }}
            />
            <div className="absolute bottom-2 left-2 right-2 flex justify-center">
              <div
                className="inline-flex flex-col gap-0.5 px-2 py-1 rounded-pill"
                style={{
                  background: 'color-mix(in srgb, var(--surface) 85%, transparent)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid color-mix(in srgb, var(--border) 40%, transparent)',
                }}
              >
                <div className="font-bold text-[13px] tabular text-ink leading-none">{fmtBDT(planned)}</div>
                <div className="flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-[0.04em] leading-none text-ink">
                  <span aria-hidden className="w-1.5 h-1.5 rounded-full" style={{ background: CATEGORY_FILL[status].color }} />
                  <span>{overflow ? `${pct}% overflowing` : `${pct}% filled`}</span>
                </div>
              </div>
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
          <Button variant="ghost" onClick={onEmpty}>Empty jar</Button>
          <Button variant="primary" onClick={onClose}>Save</Button>
        </div>

        {/* Danger zone — visually separated so users don't hit Remove by accident. */}
        <div
          className="mt-4 pt-3 flex justify-between items-center text-[12px]"
          style={{
            borderTop: '1px dashed var(--border)',
          }}
        >
          <span className="text-muted">Done with this jar?</span>
          <Button variant="ghost" className="text-danger hover:text-danger" onClick={onRemove}>Remove jar</Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}