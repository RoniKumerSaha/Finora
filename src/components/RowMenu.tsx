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
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface RowMenuItem {
  label: string;
  onSelect: () => void;
  /** 'default' = primary text, 'danger' = red text. */
  tone?: 'default' | 'danger';
}

/**
 * The dropdown's position, measured against the trigger's viewport
 * rect. The menu is rendered in a PORTAL (attached to <body>, not to
 * the row), because the rows that use this menu live inside cards
 * with `overflow: hidden` — an in-flow dropdown would be clipped by
 * the card's rounded corners.
 */
interface MenuPos {
  top: number;
  left: number;
}

export function RowMenu({ items, ariaLabel = 'Row actions' }: { items: RowMenuItem[]; ariaLabel?: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<MenuPos | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Measure the trigger once the menu opens, and re-measure on scroll
  // or resize so the dropdown stays pinned to it.
  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      const btn = wrapRef.current?.getBoundingClientRect();
      if (!btn) return;
      const w = menuRef.current?.offsetWidth ?? 140;
      const h = menuRef.current?.offsetHeight ?? 80;
      // Flip to the left of the trigger when the menu would overflow
      // the viewport's right edge.
      const left = Math.max(8, Math.min(btn.right - w, window.innerWidth - w - 8));
      // Flip above the trigger when there is no room below.
      const top = btn.bottom + h + 8 > window.innerHeight && btn.top - h - 8 > 8
        ? btn.top - h - 4
        : btn.bottom + 4;
      setPos({ top, left });
    }
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (!wrapRef.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false);
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
        <span aria-hidden="true" className="t-13 leading-none">{'\u22EF'}</span>
      </button>
      {open && pos && createPortal(
        <div
          ref={menuRef}
          role="menu"
          className="fixed z-[60] min-w-[140px] rounded-card border border-border bg-surface py-1"
          style={{ top: pos.top, left: pos.left, boxShadow: 'var(--shadow-modal)' }}
        >
          {items.map((it, i) => (
            <MenuItem key={i} item={it} onPick={() => setOpen(false)} />
          ))}
        </div>,
        document.body,
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
        'block w-full text-left px-3.5 py-2 t-13 transition',
        item.tone === 'danger'
          ? 'text-danger hover:bg-danger-soft'
          : 'text-ink hover:bg-surface-2',
      ].join(' ')}
    >
      {item.label}
    </button>
  );
}