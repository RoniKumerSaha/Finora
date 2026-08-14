/**
 * RowMenu — small "⋯" overflow menu for list rows.
 *
 * Used on Accounts / Debts / Goals / Investments lists to hide
 * destructive actions (Delete) behind a deliberate click, instead
 * of a permanently visible red link that invites accidents.
 *
 * Visual target: a 28×28 button matching the IconButton ghost style,
 * rendering `⋯` (horizontal ellipsis). On click, a 2-item dropdown
 * floats below-right with a subtle modal shadow. Closes on:
 *   - clicking an item
 *   - clicking outside (mousedown listener)
 *   - pressing Escape
 *
 * Pure presentational — parent owns the menu items and their handlers.
 */
import { useEffect, useRef, useState } from 'react';

export interface RowMenuItem {
  label: string;
  onSelect: () => void;
  /** 'default' = primary text, 'danger' = red text. */
  tone?: 'default' | 'danger';
}

export function RowMenu({ items, ariaLabel = 'Row actions' }: { items: RowMenuItem[]; ariaLabel?: string }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(o => !o); }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
        className="w-7 h-7 inline-flex items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-ink transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <span aria-hidden="true" className="text-base leading-none">{'\u22EF'}</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-8 z-20 min-w-[140px] rounded-card border border-border bg-surface py-1"
          style={{ boxShadow: 'var(--shadow-modal)' }}
        >
          {items.map((it, i) => (
            <MenuItem key={i} item={it} onPick={() => setOpen(false)} />
          ))}
        </div>
      )}
    </div>
  );
}

function MenuItem({ item, onPick }: { item: RowMenuItem; onPick: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); item.onSelect(); onPick(); }}
      className={[
        'block w-full text-left px-3.5 py-2 text-[13px] transition',
        item.tone === 'danger'
          ? 'text-danger hover:bg-danger-soft'
          : 'text-ink hover:bg-surface-2',
      ].join(' ')}
    >
      {item.label}
    </button>
  );
}