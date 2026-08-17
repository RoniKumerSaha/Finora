/**
 * EmojiPicker — small grid picker shared by the Month Planner jars and
 * the Event Planner categories. Click the icon button to toggle; click
 * an emoji to commit and close.
 */
import { useState } from 'react';

const PICKER = [
  '🛒','🥦','🍞','🥩','🍎','🥛','🍳','🌶️','🍱','🧀','🥗','🍕',
  '🚗','🚌','⛽','🚕','🛵','✈️','🏨','🛍️','🎁','💡','📱','🎮',
  '🐷','💰','🎯','💊','📚','🎵','🏋️','🐾','☕',
  '💍','🕌','🎓','🏠','🎉','🎂','🏖️','🌴','🍽️','📸','🪑','💄',
];

export function EmojiPicker({
  value,
  onChange,
  compact,
}: {
  value: string;
  onChange: (next: string) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const trigger = compact ? 'w-9 h-9 text-xl' : 'w-12 h-12 text-2xl';
  const panel = compact ? 'w-[224px] grid-cols-7' : 'w-[256px] grid-cols-8';
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
          {PICKER.map(em => (
            <button
              key={em}
              type="button"
              onClick={() => { onChange(em); setOpen(false); }}
              className={[
                'rounded-md',
                tile,
                em === value ? 'bg-bg ring-1 ring-primary' : 'hover:bg-surface-2',
              ].join(' ')}
            >{em}</button>
          ))}
        </div>
      )}
    </div>
  );
}