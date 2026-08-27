/**
 * TypePicker + CategoryGrid + PresetChips
 *
 * Visual target: docs/ux-designs/.../mockups/v1/index.html
 * - .cat-tile: compact rounded pill, surface bg, primary border on select,
 *   primary-hi bg + primary text when selected
 * - .filter pill: 6px 14px padding, r-pill radius, surface bg,
 *   active => primary-soft bg + primary text + primary/40 border
 *
 * 2026-08-14 polish: the picker cards now use the global .card primitive
 * for consistency, the category tiles get a subtle inset on select, and
 * the filter pills get a slight transition.
 *
 * 2026-08-18 polish: CategoryGrid gained a `variant` prop:
 *   - 'flat' (default): every category in one chip cloud (income +
 *     transfer; anything < 12 categories). Original v1 behaviour.
 *   - 'grouped': splits expense categories into labelled sections
 *     (Housing / Utilities & bills / Daily life / Family & health /
 *     Giving / Fun) for the Add Expense screen.
 *
 * 2026-08-27 polish: tiles are compact chips (no row rectangles, no
 * icon button, no `+` placeholder). Income (flat) shows the full
 * chip list; expense (grouped) shows just the first group
 * (Housing) with a primary "Show all N categories" button beneath
 * it. Clicking expands all groups inline; "Hide list" collapses
 * back. No emoji picker affordance on Add Transaction; the
 * Category.emoji data field still exists (used by the Month /
 * Event Planner) but no UI surfaces it from this flow. Pure
 * presentational — parent owns the selected-id.
 */
import { useMemo, useState } from 'react';
import type { Category } from '../domain/types';
import { groupExpenseCategories } from '../lib/categoryEmoji';
import { ArrowUp, ArrowDown, ArrowLeftRight, Close } from './icons/Icons';

/* ---------- Type picker (Income / Expense / Transfer cards) ---------- */

export function TypePicker({
  selected, onPick,
}: { selected?: 'income' | 'expense' | 'transfer'; onPick: (t: 'income' | 'expense' | 'transfer') => void }) {
  const items: Array<{
    key: 'income' | 'expense' | 'transfer';
    label: string;
    hint: string;
    Icon: (props: any) => JSX.Element;
    glyphColor: string;
  }> = [
    { key: 'income',   label: 'Income',   hint: 'Money received',        Icon: ArrowUp,         glyphColor: 'text-primary' },
    { key: 'expense',  label: 'Expense',  hint: 'Money spent',           Icon: ArrowDown,       glyphColor: 'text-danger'  },
    { key: 'transfer', label: 'Transfer', hint: 'Between your accounts', Icon: ArrowLeftRight,  glyphColor: 'text-accent'  },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 max-w-full sm:max-w-[780px]">
      {items.map(it => {
        const isSel = selected === it.key;
        const Icon = it.Icon;
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => onPick(it.key)}
            className={[
              'rounded-card p-4 sm:p-6 text-center transition cursor-pointer border',
              'bg-surface hover:bg-surface-2 active:translate-y-px',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
              isSel ? 'border-primary' : 'border-border',
            ].join(' ')}
            style={isSel ? { boxShadow: 'var(--shadow-card), inset 0 0 0 1px var(--primary)' } : { boxShadow: 'var(--shadow-card)' }}
          >
            <Icon className={`w-11 h-11 sm:w-12 sm:h-12 mx-auto mb-2 ${it.glyphColor}`} strokeWidth={1.75} />
            <div className="font-bold text-[15px] tracking-tight">{it.label}</div>
            <div className="text-xs text-muted mt-1">{it.hint}</div>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Category row (icon button + name) ---------- */

type CategoryGridProps = {
  categories: Category[];
  selectedId?: string;
  onPick: (id: string) => void;
  /**
   * 'flat' (default) renders every category as a chip cloud (income +
   * transfer; anything < 12 categories). 'grouped' splits expense
   * categories into labelled sections (Housing / Utilities & bills /
   * Daily life / Family & health / Giving / saving / Fun & occasions).
   */
  variant?: 'flat' | 'grouped';
};

/**
 * Single category chip — compact "label" / pill. Clicking the chip
 * selects the category. Pure name tag; no icon affordances. The
 * Category.emoji data field still exists for the planners but is not
 * surfaced from the Add Transaction flow.
 *
 * Visual: small horizontal padding, tight vertical padding, fully
 * rounded (rounded-pill), name only. Selected state matches the
 * existing Selected pill (primary border + primary-hi bg + primary
 * text).
 */
function CategoryTile({
  category,
  selected,
  onPick,
}: {
  category: Category;
  selected: boolean;
  onPick: (id: string) => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onPick(category.id)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onPick(category.id);
        }
      }}
      className={[
        'inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-[13px] font-medium',
        'transition cursor-pointer select-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        selected
          ? 'border-primary bg-primary-hi text-primary'
          : 'bg-surface border-border text-muted hover:bg-primary-soft hover:text-primary hover:border-primary',
      ].join(' ')}
    >
      <span className="truncate">{category.name}</span>
    </div>
  );
}

export function CategoryGrid({
  categories,
  selectedId,
  onPick,
  variant = 'flat',
}: CategoryGridProps) {
  // Local toggle for the expense (grouped) variant — defaults to
  // collapsed (just the first group rendered, with a prominent Show
  // all button). Resetting the form remounts the picker, so reopening
  // Add Transaction starts fresh.
  const [showAll, setShowAll] = useState(false);
  if (categories.length === 0) {
    return <div className="text-muted text-sm">No categories yet.</div>;
  }
  const selected = categories.find(c => c.id === selectedId);
  const flat = variant === 'flat';

  return (
    <div className="flex flex-col gap-3">
      {/* Selected row — visible only when the user has picked something.
          The empty-state hint is dropped: the chips themselves are the
          affordance. */}
      {selected && (
        <div className="flex items-center gap-2 min-h-[28px]">
          <span className="text-[11px] text-muted uppercase tracking-[0.08em] font-semibold">
            Selected
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill bg-primary-hi text-primary text-[13px] font-semibold">
            {selected.name}
          </span>
          <button
            type="button"
            onClick={() => onPick('')}
            aria-label="Clear selected category"
            className="text-muted hover:text-ink rounded-full p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <Close className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
        </div>
      )}

      {/* Income (flat) — short chip cloud, always visible. No search,
          no group headings, no Show all toggle (categories < 12). */}
      {flat && (
        <FlatList
          categories={categories}
          selectedId={selectedId}
          onPick={onPick}
        />
      )}

      {/* Expense (grouped) — first group (Housing) by default, with a
          Show all button to expand the rest of the groups inline. */}
      {!flat && (
        <GroupedList
          categories={categories}
          selectedId={selectedId}
          onPick={onPick}
          showAll={showAll}
          setShowAll={setShowAll}
        />
      )}
    </div>
  );
}

/* ---------- List sub-components ---------- */

/**
 * Flat (income-style) list — no grouping, no emoji affordance. Used
 * for the un-filtered "Show all" view and the filtered search view.
 *
 * Chips wrap horizontally as a tag cloud (flex-wrap). Each chip is
 * a compact pill — labels are short enough that line-wrapping inside
 * the chip itself is rare; the section grid wraps instead.
 */
function FlatList({
  categories,
  selectedId,
  onPick,
}: {
  categories: Category[];
  selectedId?: string;
  onPick: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {categories.map(c => (
        <CategoryTile
          key={c.id}
          category={c}
          selected={selectedId === c.id}
          onPick={onPick}
        />
      ))}
    </div>
  );
}

/**
 * Grouped expense-category list — sections with chips. When `showAll`
 * is false, only the first group (Housing) renders; a "Show all N
 * categories" button sits beneath it. When `showAll` is true, all
 * groups render and a "Hide list" pill sits beneath them. Keeps the
 * modal compact for the common case (user picks a Housing category)
 * while staying one tap away from the full list.
 *
 * Chips are pure name tags; the Category.emoji data field still exists
 * for the planners but no UI surfaces it from Add Transaction.
 */
function GroupedList({
  categories,
  selectedId,
  onPick,
  showAll,
  setShowAll,
}: {
  categories: Category[];
  selectedId?: string;
  onPick: (id: string) => void;
  showAll: boolean;
  setShowAll: (v: boolean) => void;
}) {
  const groups = useMemo(() => groupExpenseCategories(categories), [categories]);
  const visibleGroups = showAll ? groups : groups.slice(0, 1);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-4">
        {visibleGroups.map(g => (
          <div key={g.key}>
            <h4 className="text-[11px] text-muted uppercase tracking-[0.08em] font-semibold m-0 mb-2">
              {g.label}
            </h4>
            <div className="flex flex-wrap gap-2">
              {g.items.map(c => (
                <CategoryTile
                  key={c.id}
                  category={c}
                  selected={selectedId === c.id}
                  onPick={onPick}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      {groups.length > 1 && (
        showAll ? (
          <div className="flex justify-start">
            <button
              type="button"
              onClick={() => setShowAll(false)}
              className="inline-flex items-center gap-1.5 rounded-pill border border-primary/40 bg-primary-hi px-3.5 py-2 text-[13px] font-semibold text-primary hover:bg-primary/15 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <Close className="w-3.5 h-3.5" strokeWidth={2} />
              Hide list
            </button>
          </div>
        ) : (
          <div className="flex justify-start">
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="inline-flex items-center gap-1.5 rounded-pill border border-primary/40 bg-primary-hi px-3.5 py-2 text-[13px] font-semibold text-primary hover:bg-primary/15 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              Show all {categories.length} categor{categories.length === 1 ? 'y' : 'ies'}
            </button>
          </div>
        )
      )}
    </div>
  );
}

/* ---------- Preset amount chips ---------- */

export function PresetChips({
  amounts, onPick, currencyPrefix = '\u09F3 ',
}: { amounts: number[]; onPick: (n: number) => void; currencyPrefix?: string }) {
  return (
    <div className="flex gap-2 flex-wrap mt-2">
      {amounts.map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onPick(n)}
          className="px-[14px] py-1.5 rounded-pill bg-surface border border-border text-[13px] text-muted hover:text-ink hover:border-primary/40 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          {currencyPrefix}{n.toLocaleString('en-IN')}
        </button>
      ))}
    </div>
  );
}