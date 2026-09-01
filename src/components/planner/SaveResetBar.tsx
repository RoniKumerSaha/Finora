/**
 * SaveResetBar — shared toolbar for the Investment Planner and Loan
 * Calculator detail screens.
 *
 * Status dot (warn = unsaved, success = saved) with a one-line caption
 * sits on the left; the Save and Delete pills sit next to each other
 * on the right, kept together so the user reads them as a single
 * action group. The two pills are intentionally matched in size,
 * radius, border weight, and padding so they look like a symmetric
 * pair — only their color carries meaning (red = destructive, primary
 * = commit). Both pills use the outlined Button variants so the
 * hover-fill behaviour matches every other form in the app.
 *
 * The wiring is caller-supplied — this is pure presentation.
 */
import { Button } from '../Button';

export function SaveResetBar({
  dirty,
  onSave,
  onDelete,
  deleteLabel,
}: {
  dirty: boolean;
  onSave: () => void;
  onDelete?: () => void;
  deleteLabel?: string;
}) {
  const dotColor = dirty ? 'var(--warn)' : 'var(--success)';
  return (
    <div className="card-flat flex justify-between items-center border border-border rounded-card bg-surface px-4 py-2.5 gap-3 flex-wrap">
      <div className="flex items-center gap-2.5 text-[12.5px] text-muted min-w-0">
        <span
          aria-hidden
          className="w-2 h-2 rounded-full shrink-0"
          style={{
            background: dotColor,
            boxShadow: `0 0 0 3px color-mix(in srgb, ${dotColor} 25%, transparent)`,
          }}
        />
        <span className="min-w-0">
          {dirty
            ? <><b className="text-ink">Unsaved changes</b> — your edits haven't been saved yet.</>
            : <>Saved</>}
        </span>
      </div>
      {/* Action group — Save and Delete kept together so the user
          reads them as one toolbar unit. Save is the primary commit
          (left of the pair), Delete is the destructive escape
          hatch (right of the pair). Same shape, only the color
          carries the meaning. Both render as outlined pills so they
          share the hover-fill behaviour of every other form in the
          app. */}
      <div className="flex gap-2 shrink-0">
        <Button variant="outlined-primary" onClick={onSave}>Save plan</Button>
        {onDelete && (
          <Button
            variant="outlined-danger"
            onClick={onDelete}
            aria-label={deleteLabel ?? 'Delete this plan'}
          >
            {deleteLabel ?? 'Delete'}
          </Button>
        )}
      </div>
    </div>
  );
}
