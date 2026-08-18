/**
 * TypePicker + CategoryGrid + PresetChips
 *
 * Visual target: docs/ux-designs/.../mockups/v1/index.html
 * - .cat-tile: aspect-ratio 1, surface-2 bg, 10px radius, 22px emoji,
 *   selected => primary border + primary-hi bg + primary text
 * - .filter pill: 6px 14px padding, r-pill radius, surface bg,
 *   active => primary-soft bg + primary text + primary/40 border
 *
 * 2026-08-14 polish: the picker cards now use the global .card primitive
 * for consistency, the category tiles get a subtle inset on select, and
 * the filter pills get a slight transition.
 *
 * 2026-08-18 polish: CategoryGrid gained a `variant` prop:
 *   - 'flat' (default): every category in one grid (income + transfer;
 *     anything < 12 categories). Original v1 behaviour.
 *   - 'grouped': splits expense categories into labelled sections
 *     (Housing / Utilities & bills / Daily life / Family & health /
 *     Giving / Fun) and adds a search input to filter the visible
 *     sections. Used on the Add Expense screen because it now ships
 *     31+ categories and a flat grid becomes a wall of tiles.
 * Pure presentational — parent owns selected-id state.
 */
import { useMemo, useState } from 'react';
import type { Category } from '../domain/types';
import { emojiForCategory, groupExpenseCategories } from '../lib/categoryEmoji';
import { ArrowUp, ArrowDown, ArrowLeftRight } from './icons/Icons';

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

/* ---------- Category tile grid (5 cols, emoji + label) ---------- */

type CategoryGridProps = {
  categories: Category[];
  selectedId?: string;
  onPick: (id: string) => void;
  /**
   * 'flat' (default) renders every category in one grid. 'grouped'
   * splits expense categories into labelled sections and adds a
   * search input. 'grouped' is intended for the expense picker — the
   * defaults ship 31 categories and a flat grid becomes a wall.
   */
  variant?: 'flat' | 'grouped';
};

/**
 * Single category tile — shared by both modes so the visual treatment
 * is identical regardless of which grid wrapper renders it.
 */
function CategoryTile({ category, selected, onPick }: {
  category: Category;
  selected: boolean;
  onPick: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(category.id)}
      className={[
        'aspect-square rounded-btn flex flex-col items-center justify-center gap-1.5',
        'text-xs font-medium transition border',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        selected
          ? 'border-primary bg-primary-hi text-primary'
          : 'bg-surface-2 border-border text-muted hover:bg-surface-3 hover:text-ink',
      ].join(' ')}
    >
      <span className="text-[22px] leading-none">{emojiForCategory(category.name)}</span>
      <span className="truncate w-full px-1 text-center">{category.name}</span>
    </button>
  );
}

export function CategoryGrid({
  categories,
  selectedId,
  onPick,
  variant = 'flat',
}: CategoryGridProps) {
  if (categories.length === 0) {
    return <div className="text-muted text-sm">No categories yet.</div>;
  }
  if (variant === 'flat') {
    return (
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {categories.map(c => (
          <CategoryTile key={c.id} category={c} selected={selectedId === c.id} onPick={onPick} />
        ))}
      </div>
    );
  }
  return <GroupedCategoryGrid categories={categories} selectedId={selectedId} onPick={onPick} />;
}

/**
 * Grouped picker (used for expenses) — labels each section, exposes a
 * search field that filters sections in place, and pins the selected
 * tile as a "Selected" row above the search so the user can confirm
 * what they picked before scrolling back up.
 */
function GroupedCategoryGrid({
  categories,
  selectedId,
  onPick,
}: { categories: Category[]; selectedId?: string; onPick: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const groups = useMemo(() => groupExpenseCategories(categories), [categories]);
  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return groups;
    return groups
      .map(g => ({
        ...g,
        items: g.items.filter(c => c.name.toLowerCase().includes(q)),
      }))
      .filter(g => g.items.length > 0);
  }, [groups, q]);
  const selected = categories.find(c => c.id === selectedId);
  const totalShown = filtered.reduce((n, g) => n + g.items.length, 0);

  return (
    <div className="flex flex-col gap-3">
      {/* Selected row — always visible so the user can confirm their pick
          without scrolling back up. Empty state is a soft hint instead of
          a forever-empty space. */}
      <div className="flex items-center gap-2 min-h-[28px]">
        <span className="text-[11px] text-muted uppercase tracking-[0.08em] font-semibold">
          Selected
        </span>
        {selected ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill bg-primary-hi text-primary text-[13px] font-semibold">
            <span aria-hidden>{emojiForCategory(selected.name)}</span>
            {selected.name}
          </span>
        ) : (
          <span className="text-xs text-muted">No category picked yet.</span>
        )}
      </div>

      {/* Search input — clears to default state when emptied. */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search categories…"
          aria-label="Search categories"
          className="w-full bg-surface-2 text-ink rounded-input border border-border px-[14px] py-2.5 pl-9 text-sm leading-tight transition shadow-[inset_0_1px_2px_rgba(0,0,0,0.18)] focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
        />
        <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted text-[15px]">
          {'\u{1F50D}'}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="text-sm text-muted py-6 text-center">
          No categories match “{query}”.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map(g => (
            <div key={g.key}>
              <div className="flex items-baseline justify-between mb-2">
                <h4 className="text-[11px] text-muted uppercase tracking-[0.08em] font-semibold m-0">
                  {g.label}
                </h4>
                <span className="text-[11px] text-muted">{g.items.length}</span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {g.items.map(c => (
                  <CategoryTile key={c.id} category={c} selected={selectedId === c.id} onPick={onPick} />
                ))}
              </div>
            </div>
          ))}
          <div className="text-[11px] text-muted text-right">
            {totalShown} of {categories.length}
          </div>
        </div>
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