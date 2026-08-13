/**
 * TypePicker + CategoryGrid + PresetChips
 *
 * Visual target: docs/ux-designs/.../mockups/v1/index.html
 * - .cat-tile: aspect-ratio 1, surface-2 bg, 14px radius, 22px emoji,
 *   selected => primary border + primary-hi bg + primary text
 * - .filter pill: 6px 14px padding, r-pill radius, surface bg,
 *   active => primary-soft bg + primary text + primary/40 border
 *
 * Pure presentational — parent owns selected-id state.
 */
import type { Category } from '../domain/types';
import { emojiForCategory } from '../lib/categoryEmoji';

/* ---------- Type picker (Income / Expense / Transfer cards) ---------- */

export function TypePicker({
  selected, onPick,
}: { selected?: 'income' | 'expense' | 'transfer'; onPick: (t: 'income' | 'expense' | 'transfer') => void }) {
  const items: Array<{
    key: 'income' | 'expense' | 'transfer';
    label: string;
    hint: string;
    glyph: string;
    glyphColor: string;
  }> = [
    { key: 'income',   label: 'Income',   hint: 'Money received',     glyph: '\u2191', glyphColor: 'text-primary' },
    { key: 'expense',  label: 'Expense',  hint: 'Money spent',        glyph: '\u2193', glyphColor: 'text-danger'  },
    { key: 'transfer', label: 'Transfer', hint: 'Between your accounts', glyph: '\u21C4', glyphColor: 'text-accent'  },
  ];

  return (
    <div className="grid grid-cols-3 gap-4 max-w-[780px]">
      {items.map(it => {
        const isSel = selected === it.key;
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => onPick(it.key)}
            className={[
              'bg-surface rounded-card p-6 text-center transition cursor-pointer border',
              isSel ? 'border-primary' : 'border-border hover:bg-surface-2',
            ].join(' ')}
          >
            <div className={`text-[42px] mb-1.5 ${it.glyphColor}`}>{it.glyph}</div>
            <div className="font-bold text-base">{it.label}</div>
            <div className="text-xs text-muted mt-1">{it.hint}</div>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Category tile grid (5 cols, emoji + label) ---------- */

export function CategoryGrid({
  categories, selectedId, onPick,
}: { categories: Category[]; selectedId?: string; onPick: (id: string) => void }) {
  if (categories.length === 0) {
    return <div className="text-muted text-sm">No categories yet.</div>;
  }
  return (
    <div className="grid grid-cols-5 gap-2">
      {categories.map(c => {
        const sel = selectedId === c.id;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onPick(c.id)}
            className={[
              'aspect-square rounded-btn flex flex-col items-center justify-center gap-1.5',
              'text-xs font-medium transition border',
              sel
                ? 'border-primary bg-primary-hi text-primary'
                : 'bg-surface-2 border-border text-muted hover:bg-surface-3',
            ].join(' ')}
          >
            <span className="text-[22px] leading-none">{emojiForCategory(c.name)}</span>
            <span className="truncate w-full px-1 text-center">{c.name}</span>
          </button>
        );
      })}
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
          className="px-[14px] py-1.5 rounded-pill bg-surface border border-border text-[13px] text-muted hover:text-ink transition"
        >
          {currencyPrefix}{n.toLocaleString('en-IN')}
        </button>
      ))}
    </div>
  );
}
