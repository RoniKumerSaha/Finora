/**
 * EmojiPicker — small grid picker shared by the Month Planner jars,
 * the Event Planner categories, and the Add Transaction category tiles.
 * Click the icon button to toggle; click a tile to commit and close.
 *
 * Renders raw unicode emoji and writes the emoji string (e.g. '🏠')
 * into the data field — consumers render it directly with `{emoji}`.
 *
 * If `onRemove` is provided, the popover gets a leading "Remove" tile
 * that clears the value (calls `onChange('')` + `onRemove?.()`). This
 * is what the Add Transaction category tiles use so the user can drop
 * a category's icon after picking one.
 */
import { useState } from 'react';
import { CATEGORY_EMOJI_LIBRARY, emojiForCategory } from '../../lib/categoryEmoji';

export function EmojiPicker({
  value,
  onChange,
  onRemove,
  compact,
}: {
  value: string;
  onChange: (next: string) => void;
  onRemove?: () => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const triggerSize = compact ? 36 : 48;
  const tileSize = compact ? 28 : 32;
  const panel = compact ? 'w-[252px] grid-cols-7' : 'w-[360px] grid-cols-8';
  // Selected highlight resolves through emojiForCategory so a glyph-key
  // value (e.g. from a fresh write to the data field) still highlights
  // the matching emoji tile. New writes store the emoji string.
  const selectedEmoji = value && value.length > 0 ? value : emojiForCategory(value);
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-label="Pick an icon"
        className="rounded-btn bg-surface-2 border border-border flex items-center justify-center focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 overflow-hidden p-0"
        style={{ width: triggerSize, height: triggerSize, fontSize: compact ? 18 : 22, lineHeight: 1 }}
      >
        <span aria-hidden>{value || '＋'}</span>
      </button>
      {open && (
        <div className={`absolute left-0 top-full mt-1.5 z-10 bg-surface border border-border rounded-btn p-1.5 grid gap-1 shadow-lg ${panel}`}>
          {onRemove && (
            <button
              type="button"
              title="Remove icon"
              aria-label="Remove icon"
              onClick={() => { onRemove(); setOpen(false); }}
              className="rounded-md hover:bg-surface-2 text-muted flex items-center justify-center text-lg"
              style={{ width: tileSize, height: tileSize }}
            >×</button>
          )}
          {CATEGORY_EMOJI_LIBRARY.map((entry, idx) => (
            <button
              key={`${entry.emoji}-${idx}`}
              type="button"
              title={entry.label}
              aria-label={entry.label}
              onClick={() => { onChange(entry.emoji); setOpen(false); }}
              className={[
                'rounded-md',
                'flex items-center justify-center text-lg',
                selectedEmoji === entry.emoji ? 'bg-bg ring-1 ring-primary' : 'hover:bg-surface-2',
              ].join(' ')}
              style={{ width: tileSize, height: tileSize }}
            >
              <span aria-hidden>{entry.emoji}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
