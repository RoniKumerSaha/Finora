/**
 * BatchBudgetEditor — bulk-edit the budget on multiple PlanCategories
 * at once. Selection happens on the items grid itself (each tile gets
 * a big checkbox in selection mode); this file owns:
 *
 *   1. The selection-mode toggle pill rendered in the grid header.
 *   2. The floating action bar that slides up when ≥1 card is
 *      selected. Shows count, "Select all", "Clear", and a primary
 *      "Edit budgets" CTA that opens the editor modal directly.
 *   3. The editor modal itself — same Custom / Same amount / Adjust %
 *      / Clear modes as before, single store write per apply.
 *
 * The previous version had a separate chip-grid picker that
 * duplicated the items grid. That was confusing — the user had to
 * context-switch between two views to find the cards they wanted.
 * Selection now lives on the actual cards, so there's nothing to
 * translate. A tap on a selected card in selection mode toggles it
 * off; the editor modal opens via the bottom CTA, not by tapping.
 *
 * The bottom-sheet editor modal (BatchEditorControls) keeps its full
 * feature set: custom per-card amounts, same-amount, percent bump,
 * and clear. Single store write per apply so the dirty flag only
 * flips once.
 */
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../../domain/store';
import type { PlanCategory } from '../../domain/types';
import { fmtBDT, clampNonNegative } from '../../lib/format';
import { CategoryGlyph } from '../icons/categoryGlyphs';

/* ── Selection-mode toggle ───────────────────────────────────────── */

/**
 * Pill rendered on the grid header. Off by default — tapping it
 * enters selection mode (tiles get checkboxes, tap-to-toggle,
 * single-card editor disabled). Tapping again or pressing the
 * floating bar's "Done" exits.
 */
export function SelectionModeToggle({
  selectionMode,
  onToggle,
  selectedCount,
  totalCount,
}: {
  selectionMode: boolean;
  onToggle: () => void;
  selectedCount: number;
  totalCount: number;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selectionMode}
      className={[
        'inline-flex items-center gap-2 px-3 py-2 rounded-pill text-[12.5px] font-semibold transition',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        selectionMode
          ? 'bg-primary text-primary-on border border-primary'
          : 'bg-surface text-ink border border-border hover:border-primary',
      ].join(' ')}
    >
      {/* Small checkbox glyph so the affordance reads as a toggle,
          not just a button. */}
      <span
        aria-hidden
        className={[
          'w-4 h-4 rounded inline-flex items-center justify-center shrink-0 transition',
          selectionMode ? 'bg-surface text-primary' : 'border border-border bg-surface-2',
        ].join(' ')}
      >
        {selectionMode ? (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
            <path d="M2 5 L4.2 7.2 L8 3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
      </span>
      {selectionMode
        ? selectedCount > 0
          ? `${selectedCount} of ${totalCount} selected`
          : 'Selecting cards…'
        : 'Select multiple'}
    </button>
  );
}

/* ── Floating action bar ─────────────────────────────────────────── */

/**
 * Slides up from the bottom of the items grid when the user has
 * selected ≥1 card. Fixed-position so it stays in view as the user
 * scrolls. The primary CTA opens the editor modal directly — no
 * extra click needed.
 *
 * Why a floating bar (not an inline row): it stays visible while the
 * user scrolls through a long list of cards, so they never lose
 * context of what they've picked. It also doesn't take up grid
 * vertical space when nothing is selected.
 */
export function BatchFloatingBar({
  categories,
  selectedIds,
  selectionMode,
  onClearSelection,
  onSelectAll,
  onExitSelection,
  onOpenEditor,
}: {
  categories: PlanCategory[];
  selectedIds: Set<string>;
  selectionMode: boolean;
  onClearSelection: () => void;
  onSelectAll: () => void;
  onExitSelection: () => void;
  onOpenEditor: () => void;
}) {
  if (!selectionMode) return null;
  const selectedCount = selectedIds.size;
  const totalCount = categories.length;
  const allSelected = selectedCount === totalCount && totalCount > 0;
  const nothingSelected = selectedCount === 0;

  return createPortal(
    <div
      role="region"
      aria-label="Batch selection actions"
      className="fixed left-1/2 -translate-x-1/2 bottom-4 z-30 w-[min(640px,calc(100vw-32px))]"
      style={{ animation: 'banner-slide-in 180ms ease-out both' }}
    >
      <div
        className="rounded-card shadow-modal flex items-center gap-2 px-3 py-2.5 flex-wrap"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-modal)',
        }}
      >
        {/* Count chip */}
        <div className="flex items-center gap-2 shrink-0">
          <span
            aria-hidden
            className={[
              'inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-pill text-[11px] font-bold tabular',
              nothingSelected
                ? 'bg-surface-2 text-muted border border-border'
                : 'bg-primary text-primary-on border border-primary',
            ].join(' ')}
          >
            {selectedCount}
          </span>
          <span className="text-[12.5px] text-ink font-semibold">
            {nothingSelected
              ? 'Tap cards to select'
              : selectedCount === 1
                ? 'card selected'
                : 'cards selected'}
          </span>
        </div>

        <div className="hidden sm:block h-5 w-px bg-border shrink-0" aria-hidden />

        {/* Quick actions */}
        <div className="flex items-center gap-1 shrink-0 ml-auto flex-wrap">
          {nothingSelected ? (
            <button
              type="button"
              onClick={onSelectAll}
              disabled={totalCount === 0}
              className={[
                'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-btn text-[12px] font-semibold transition',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                totalCount === 0
                  ? 'bg-surface-2 text-muted border border-border cursor-not-allowed'
                  : 'bg-surface border border-border text-ink hover:border-primary',
              ].join(' ')}
            >
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
                <path d="M2 6 L5 9 L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Select all
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onSelectAll}
                disabled={allSelected}
                className={[
                  'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-btn text-[12px] font-semibold transition',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                  allSelected
                    ? 'bg-surface-2 text-muted border border-border cursor-not-allowed'
                    : 'bg-surface border border-border text-ink hover:border-primary',
                ].join(' ')}
              >
                {allSelected ? 'All selected' : 'Select all'}
              </button>
              <button
                type="button"
                onClick={onClearSelection}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-btn text-[12px] font-semibold text-muted hover:text-ink hover:bg-surface-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                Clear
              </button>
            </>
          )}

          {/* Primary CTA — opens the editor modal. Disabled until at
              least one card is selected (apply is a no-op otherwise). */}
          <button
            type="button"
            onClick={onOpenEditor}
            disabled={nothingSelected}
            className={[
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-btn text-[12px] font-bold transition',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
              nothingSelected
                ? 'bg-surface-2 text-muted border border-border cursor-not-allowed'
                : 'bg-primary text-primary-on border border-primary hover:opacity-90',
            ].join(' ')}
          >
            Edit budgets
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden>
              <path d="M3 6 H9 M6.5 3.5 L9 6 L6.5 8.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* Exit selection mode */}
          <button
            type="button"
            onClick={onExitSelection}
            aria-label="Exit selection mode"
            className="inline-flex items-center justify-center w-8 h-8 rounded-full text-muted hover:text-ink hover:bg-surface-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
              <path d="M2 2 L10 10 M10 2 L2 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ── Batch editor bottom-sheet modal ────────────────────────────── */

type BatchMode = 'apply' | 'custom' | 'percent' | 'clear';

export function BatchEditorControls({
  open,
  categories,
  selectedIds,
  onDone,
  onCancel,
}: {
  open: boolean;
  categories: PlanCategory[];
  selectedIds: string[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const batchUpdate = useStore(s => s.batchUpdateMonthCategoryBudget);
  const batchUpdateMap = useStore(s => s.batchUpdateMonthCategoryBudgetMap);
  const showBanner = useStore(s => s.showBanner);
  const activeKey = useStore(s => s.state.monthPlans[0]?.key ?? '');
  const [mode, setMode] = useState<BatchMode>('custom');
  const [amountText, setAmountText] = useState('');
  const [customDrafts, setCustomDrafts] = useState<Record<string, string>>({});

  // Re-seed drafts when the modal opens or the selection changes.
  useEffect(() => {
    if (!open) return;
    setAmountText('');
    setMode('custom');
    const idSet = new Set(selectedIds);
    const next: Record<string, string> = {};
    for (const c of categories) {
      if (!idSet.has(c.id)) continue;
      const v = Number(c.budget) || 0;
      next[c.id] = v > 0 ? String(v) : '';
    }
    setCustomDrafts(next);
  }, [open, selectedIds.join('|'), categories]);

  if (!open) return null;
  if (selectedIds.length === 0) {
    return createPortal(
      <div
        className="fixed inset-0 z-40"
        role="dialog"
        aria-modal="true"
        aria-labelledby="batch-editor-title"
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onCancel}
          className="absolute inset-0 cursor-default"
          style={{
            background: 'var(--overlay)',
            backdropFilter: 'blur(6px)',
            animation: 'backdrop-fade-in 160ms ease-out both',
          }}
        />
        <div
          className="absolute left-1/2 -translate-x-1/2 bottom-4 w-[min(640px,calc(100vw-32px))] rounded-card shadow-modal"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            padding: '20px',
            animation: 'modal-pop-in 160ms ease-out both',
          }}
        >
          <h3 id="batch-editor-title" className="heading h3-modal m-0">Batch update budget</h3>
          <div className="text-muted text-[12.5px] mt-2">
            Nothing is selected. Pick a few cards first, then come back here.
          </div>
          <div className="flex justify-end mt-4">
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-2 rounded-btn text-[12.5px] font-semibold text-ink hover:bg-surface-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >Close</button>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  const idSet = new Set(selectedIds);
  const liveCategories = categories.filter(c => idSet.has(c.id));

  const previewRows = liveCategories.map(c => {
    const current = Number(c.budget) || 0;
    let next: number = current;
    if (mode === 'apply') {
      next = clampNonNegative(amountText);
    } else if (mode === 'custom') {
      next = clampNonNegative(customDrafts[c.id] ?? '');
    } else if (mode === 'percent') {
      const pct = Number(amountText);
      if (Number.isFinite(pct)) next = Math.max(0, Math.round(current * (1 + pct / 100)));
    } else if (mode === 'clear') {
      next = 0;
    }
    return { id: c.id, name: c.name, emoji: c.emoji, current, next };
  });
  const totalCurrent = previewRows.reduce((s, r) => s + r.current, 0);
  const totalNext = previewRows.reduce((s, r) => s + r.next, 0);
  const delta = totalNext - totalCurrent;

  const dirty = (() => {
    if (mode === 'clear') return false;
    if (mode === 'percent') return !Number.isFinite(Number(amountText));
    if (mode === 'apply') return amountText.trim() === '';
    if (mode === 'custom') {
      return !previewRows.some(r => customDrafts[r.id] !== undefined && customDrafts[r.id].trim() !== '');
    }
    return true;
  })();

  function apply() {
    if (!activeKey) return;
    if (mode === 'clear') {
      batchUpdate(activeKey, selectedIds, 0);
      showBanner({
        kind: 'info',
        what: `${selectedIds.length} card${selectedIds.length === 1 ? '' : 's'} cleared`,
        why: 'Budgets set to ৳0. Edit them back any time.',
        fix: 'Tap Save plan to keep the change.',
      });
      onDone();
      return;
    }
    if (mode === 'percent') {
      const pct = Number(amountText);
      if (!Number.isFinite(pct)) return;
      const budgetMap: Record<string, number> = {};
      for (const c of liveCategories) {
        const current = Number(c.budget) || 0;
        budgetMap[c.id] = Math.max(0, Math.round(current * (1 + pct / 100)));
      }
      batchUpdateMap(activeKey, budgetMap);
      showBanner({
        kind: 'success',
        what: `${selectedIds.length} card${selectedIds.length === 1 ? '' : 's'} updated`,
        why: `Applied ${pct >= 0 ? '+' : ''}${pct}% to selected budgets.`,
        fix: 'Tap Save plan to keep the change.',
      });
      onDone();
      return;
    }
    if (mode === 'apply') {
      const n = clampNonNegative(amountText);
      batchUpdate(activeKey, selectedIds, n);
      showBanner({
        kind: 'success',
        what: `${selectedIds.length} card${selectedIds.length === 1 ? '' : 's'} updated`,
        why: `Budget set to ${fmtBDT(n)} for each selected card.`,
        fix: 'Tap Save plan to keep the change.',
      });
      onDone();
      return;
    }
    const budgetMap: Record<string, number> = {};
    let touched = 0;
    for (const row of previewRows) {
      const draft = customDrafts[row.id];
      if (draft === undefined || draft.trim() === '') continue;
      const n = clampNonNegative(draft);
      if (n === row.current) continue;
      budgetMap[row.id] = n;
      touched++;
    }
    if (touched === 0) {
      onDone();
      return;
    }
    batchUpdateMap(activeKey, budgetMap);
    showBanner({
      kind: 'success',
      what: `${touched} card${touched === 1 ? '' : 's'} updated`,
      why: `Custom budgets applied to ${touched} of ${selectedIds.length} selected.`,
      fix: 'Tap Save plan to keep the change.',
    });
    onDone();
  }

  return createPortal(
    <div
      className="fixed inset-0 z-40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="batch-editor-title"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onCancel}
        className="absolute inset-0 cursor-default"
        style={{
          background: 'var(--overlay)',
          backdropFilter: 'blur(6px)',
          animation: 'backdrop-fade-in 160ms ease-out both',
        }}
      />
      <div
        className="absolute left-1/2 -translate-x-1/2 bottom-4 w-[min(720px,calc(100vw-32px))] max-h-[85vh] overflow-y-auto rounded-card shadow-modal"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          padding: '20px',
          animation: 'modal-pop-in 160ms ease-out both',
        }}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h3 id="batch-editor-title" className="heading h3-modal m-0">Batch update budget</h3>
            <div className="text-muted text-[12.5px] mt-1">
              {selectedIds.length} card{selectedIds.length === 1 ? '' : 's'} selected. Pick a mode and apply.
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onCancel}
            className="w-8 h-8 rounded-full inline-flex items-center justify-center text-muted hover:text-ink hover:bg-surface-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path d="M2 2 L12 12 M12 2 L2 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Mode toggle */}
        <div className="inline-flex rounded-input border border-border bg-surface-2 p-0.5 mb-3 flex-wrap" role="tablist" aria-label="Batch mode">
          {([
            ['custom', 'Custom amounts'],
            ['apply', 'Same amount'],
            ['percent', 'Adjust %'],
            ['clear', 'Clear'],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={mode === k}
              onClick={() => setMode(k)}
              className={[
                'px-3 py-1.5 text-[12.5px] font-semibold rounded-input transition',
                mode === k ? 'bg-primary text-primary-on' : 'text-muted hover:text-ink',
              ].join(' ')}
            >{label}</button>
          ))}
        </div>

        {/* Input area — varies by mode */}
        {mode === 'custom' ? (
          <CustomAmountInputs
            rows={previewRows}
            drafts={customDrafts}
            onChange={(id, text) => setCustomDrafts(prev => ({ ...prev, [id]: text }))}
          />
        ) : mode === 'clear' ? (
          <div className="text-[12.5px] text-muted">
            All selected cards will be set to <b className="text-ink">৳0</b>. You can edit them back afterwards.
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {mode === 'apply' && <span className="text-[13px] text-muted">৳</span>}
            <input
              type="number"
              inputMode="decimal"
              min={mode === 'percent' ? undefined : 0}
              value={amountText}
              onChange={e => setAmountText(e.target.value)}
              placeholder={mode === 'percent' ? '+10' : '0'}
              aria-label={mode === 'percent' ? 'Percentage change' : 'New budget'}
              className="bg-surface-2 border border-border rounded-input px-3 py-2 text-right font-semibold text-ink tabular w-full focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
            {mode === 'percent' && <span className="text-[13px] text-muted">%</span>}
          </div>
        )}

        {/* Footer summary for non-custom modes */}
        {previewRows.length > 0 && mode !== 'custom' && (
          <div className="mt-3 rounded-input border border-border bg-surface-2">
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 text-[12.5px] px-2.5 py-2">
              <span className="text-ink uppercase tracking-[0.06em] font-bold text-[10.5px]">Total</span>
              <span className="text-muted tabular text-right whitespace-nowrap">{fmtBDT(totalCurrent)}</span>
              <span className="text-ink tabular font-bold text-right whitespace-nowrap">
                {fmtBDT(totalNext)}{delta !== 0 && (
                  <span className={['ml-1', delta > 0 ? 'text-danger' : 'text-success'].join(' ')}>
                    ({delta > 0 ? '+' : ''}{fmtBDT(delta)})
                  </span>
                )}
              </span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-2 rounded-btn text-[12.5px] font-semibold text-ink hover:bg-surface-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >Cancel</button>
          <button
            type="button"
            onClick={apply}
            disabled={selectedIds.length === 0 || dirty}
            className={[
              'inline-flex items-center gap-1.5 px-3 py-2 rounded-btn text-[12.5px] font-semibold transition',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
              selectedIds.length === 0 || dirty
                ? 'bg-surface-2 text-muted border border-border cursor-not-allowed'
                : 'bg-primary text-primary-on border border-primary hover:opacity-90',
            ].join(' ')}
          >
            Apply to {selectedIds.length} card{selectedIds.length === 1 ? '' : 's'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ── Custom amount inputs (per-card editor inside the modal) ─────── */

function CustomAmountInputs({
  rows,
  drafts,
  onChange,
}: {
  rows: { id: string; name: string; emoji: string; current: number; next: number }[];
  drafts: Record<string, string>;
  onChange: (id: string, text: string) => void;
}) {
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Run the footer total from the live drafts so the user sees
  // instant feedback as they type. Empty drafts → unchanged value,
  // so the row stays in place rather than snapping to 0.
  const liveRows = rows.map(r => {
    const draft = drafts[r.id];
    const next = draft === undefined || draft.trim() === ''
      ? r.current
      : clampNonNegative(draft);
    return { ...r, next };
  });
  const totalCurrent = liveRows.reduce((s, r) => s + r.current, 0);
  const totalNext = liveRows.reduce((s, r) => s + r.next, 0);
  const delta = totalNext - totalCurrent;

  useEffect(() => {
    const empty = rows.find(r => {
      const d = drafts[r.id];
      return d === undefined || d.trim() === '';
    });
    if (empty) firstInputRef.current?.focus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-[12px] text-muted">
          Type a new budget for each card. Leave blank to skip that card.
        </div>
        <BulkFillButtons
          onFill={(value) => {
            for (const r of rows) onChange(r.id, String(value));
          }}
          onClearAll={() => {
            for (const r of rows) onChange(r.id, '');
          }}
        />
      </div>
      <div className="rounded-input border border-border bg-surface-2 overflow-hidden">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 text-[12px] px-3 py-2 sticky top-0 bg-surface-2 border-b border-border z-10">
          <span className="text-muted uppercase tracking-[0.06em] font-semibold text-[10.5px]">Card</span>
          <span className="text-muted uppercase tracking-[0.06em] font-semibold text-[10.5px] text-right tabular">Current</span>
          <span className="text-muted uppercase tracking-[0.06em] font-semibold text-[10.5px] text-right tabular">New</span>
        </div>
        <div className="max-h-[260px] overflow-y-auto">
          {liveRows.map((r, idx) => {
            const draft = drafts[r.id] ?? '';
            return (
              <div
                key={r.id}
                className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 items-center text-[12.5px] px-3 py-2 border-b border-border last:border-b-0"
              >
                <span className="truncate flex items-center gap-1.5 min-w-0">
                  <span aria-hidden className="shrink-0">
                    <CategoryGlyph name={r.emoji} className="w-4 h-4 text-muted" />
                  </span>
                  <span className="text-ink font-semibold truncate">{r.name}</span>
                </span>
                <span className="text-muted tabular text-right whitespace-nowrap">{fmtBDT(r.current)}</span>
                <span className="inline-flex items-center gap-1 bg-surface rounded-input border border-border px-2 py-1 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/30 w-[120px]">
                  <span className="text-[11.5px] text-muted">�</span>
                  <input
                    ref={idx === 0 ? firstInputRef : undefined}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={draft}
                    placeholder="0"
                    aria-label={`New budget for ${r.name}`}
                    onChange={e => onChange(r.id, e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                    className="bg-transparent border-0 outline-none tabular text-right font-semibold text-ink w-full text-[12.5px]"
                  />
                </span>
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 text-[12.5px] px-3 py-2 border-t border-border bg-surface">
          <span className="text-ink uppercase tracking-[0.06em] font-bold text-[10.5px]">Total</span>
          <span className="text-muted tabular text-right whitespace-nowrap">{fmtBDT(totalCurrent)}</span>
          <span className="text-ink tabular font-bold text-right whitespace-nowrap">
            {fmtBDT(totalNext)}{delta !== 0 && (
              <span className={['ml-1', delta > 0 ? 'text-danger' : 'text-success'].join(' ')}>
                ({fmtBDT(Math.abs(delta))})
              </span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

function BulkFillButtons({
  onFill,
  onClearAll,
}: {
  onFill: (value: number) => void;
  onClearAll: () => void;
}) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);

  function commit() {
    const n = clampNonNegative(text);
    if (n > 0) onFill(n);
    setText('');
    setOpen(false);
  }

  if (!open) {
    return (
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onClearAll}
          className="text-[11.5px] text-muted hover:text-ink font-semibold underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-sm"
        >
          Clear all
        </button>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-[11.5px] text-muted hover:text-ink font-semibold underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-sm"
        >
          Fill all with…
        </button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <span className="text-[11.5px] text-muted">৳</span>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}
        onBlur={commit}
        placeholder="5000"
        aria-label="Fill all with"
        autoFocus
        className="bg-surface border border-border rounded-input px-2 py-1 text-right font-semibold text-ink tabular w-[90px] text-[12px] focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
      />
    </div>
  );
}
