/**
 * EmojiPicker — small grid picker shared by the Month Planner jars,
 * the Event Planner categories, and the Add Transaction category tiles.
 * Click the icon button to toggle; click an emoji to commit and close.
 *
 * Backed by `CATEGORY_EMOJI_LIBRARY` so the picker stays in sync with
 * the pre-defined budget cards on the Month Planner.
 *
 * If `onRemove` is provided, the popover gets a leading "Remove" tile
 * that clears the value (calls `onChange('')` + `onRemove?.()`). This
 * is what the Add Transaction category tiles use so the user can drop
 * a category's icon after picking one.
 */
import { useState } from 'react';
import { CATEGORY_EMOJI_LIBRARY } from '../../lib/categoryEmoji';

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
  const trigger = compact ? 'w-9 h-9 text-xl' : 'w-12 h-12 text-2xl';
  const panel = compact ? 'w-[224px] grid-cols-7' : 'w-[320px] grid-cols-8';
  const tile = compact ? 'w-7 h-7 text-base' : 'w-8 h-8 text-lg';
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-label="Pick an icon"
        className={`${trigger} rounded-btn bg-surface-2 border border-border text-center focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30`}
      >{value}</button>
      {open && (
        <div className={`absolute left-0 top-full mt-1.5 z-10 bg-surface border border-border rounded-btn p-1.5 grid gap-1 shadow-lg ${panel}`}>
          {onRemove && (
            <button
              type="button"
              title="Remove icon"
              aria-label="Remove icon"
              onClick={() => { onRemove(); setOpen(false); }}
              className={`${tile} rounded-md hover:bg-surface-2 text-muted flex items-center justify-center`}
            >×</button>
          )}
          {CATEGORY_EMOJI_LIBRARY.map(({ emoji, label }) => (
            <button
              key={emoji}
              type="button"
              title={label}
              aria-label={label}
              onClick={() => { onChange(emoji); setOpen(false); }}
              className={[
                'rounded-md',
                tile,
                emoji === value ? 'bg-bg ring-1 ring-primary' : 'hover:bg-surface-2',
              ].join(' ')}
            >{emoji}</button>
          ))}
        </div>
      )}
    </div>
  );
}
