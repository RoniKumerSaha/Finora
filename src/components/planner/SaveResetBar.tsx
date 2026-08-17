/**
 * SaveResetBar — shared header strip for the two planner screens.
 *
 * Shows a status dot (warn = unsaved, success = saved) with a one-line
 * caption, plus a Reset / Save plan button pair. Used by both the
 * Month Planner and the Event Planner detail screen.
 *
 * The reset / save wiring is caller-supplied — this is pure presentation.
 */
import { Button } from '../Button';

export function SaveResetBar({
  dirty,
  onReset,
  onSave,
}: {
  dirty: boolean;
  onReset: () => void;
  onSave: () => void;
}) {
  const dotColor = dirty ? 'var(--warn)' : 'var(--success)';
  return (
    <div className="card-flat flex justify-between items-center border border-border rounded-card bg-surface px-4 py-2.5">
      <div className="flex items-center gap-2.5 text-[12.5px] text-muted">
        <span
          aria-hidden
          className="w-2 h-2 rounded-full"
          style={{
            background: dotColor,
            boxShadow: `0 0 0 3px color-mix(in srgb, ${dotColor} 25%, transparent)`,
          }}
        />
        <span>
          {dirty
            ? <><b className="text-ink">Unsaved changes</b> — your edits haven't been saved yet.</>
            : <>Saved</>}
        </span>
      </div>
      <div className="flex gap-2">
        <Button variant="ghost" onClick={onReset}>Reset</Button>
        <Button variant="primary" onClick={onSave}>Save plan</Button>
      </div>
    </div>
  );
}
