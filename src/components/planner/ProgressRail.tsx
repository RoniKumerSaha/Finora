/**
 * ProgressRail — one progress bar, honest about what it measures.
 *
 * The app had three different progress bars that each drew a bar and
 * a caption, and each one told the reader something different:
 *
 *   - the DEBT card's rail meant "share of the principal settled";
 *   - the LOAN card's rail meant "share of the term elapsed";
 *   - the INVESTMENT planner's rail meant "share of the term elapsed";
 *   - and the loan detail's rail was hard-coded to 0%.
 *
 * The trouble is that "elapsed" is not "progress". A loan projection
 * that is 40% through its term has made no payments at all, so a bar
 * claiming 40% settled is a lie; and a plan that has not started yet
 * cannot be 0% *done* — it is not on the board. The reader could not
 * tell which of those a bar meant.
 *
 * So this component forces the author to say what the bar measures,
 * and it draws the states honestly:
 *
 *   - `pending`  → an EMPTY rail. Nothing has happened yet, so the
 *                   rail is empty and the caption says what is
 *                   waiting. An empty bar is a fact; "0%" is a
 *                   number pretending to be a fact.
 *   - `active`   → a filled rail, with the caption naming the thing
 *                   being measured.
 *   - `done`     → a full rail, with the caption in the past tense.
 *
 * The rail is deliberately the same shape everywhere (`4px`, rounded,
 * the record's own tone) so the documents read as one family, while
 * the CAPTION is what tells the reader which of them they are
 * looking at.
 */
import type { ReactNode } from 'react';

export type ProgressRailState = 'pending' | 'active' | 'done';

export function ProgressRail({
  /** 0–100. Ignored when the state is `pending` or `done`. */
  value,
  state,
  /** The name of the thing being measured: "principal settled". */
  measure,
  /** What the reader should see. */
  caption,
  /** Shown instead of the rail when there is nothing to show. */
  children,
  label,
  /** Per-row stagger so a list fills in as a wave. */
  animDelay = 0,
  className = '',
}: {
  value: number;
  state: ProgressRailState;
  /** What the bar measures — used for the accessible name. */
  measure: string;
  caption: ReactNode;
  /** Optional content shown in place of the rail (e.g. a plan note). */
  children?: ReactNode;
  /** The accessible name for the progressbar role. */
  label?: string;
  /** Per-row stagger so a list fills in as a wave. */
  animDelay?: number;
  className?: string;
}) {
  // A pending rail is empty and a done rail is full, whatever the
  // number says — the state is the truth, the number is the detail.
  const pct = state === 'pending' ? 0 : state === 'done' ? 100 : Math.max(0, Math.min(100, value));

  return (
    <div className={className}>
      <div
        className="debt-cert__rail"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={typeof caption === 'string' ? caption : measure}
        aria-label={label ?? measure}
      >
        {/* An empty rail paints NO fill at all. A zero-width fill with a
            hairline edge still shows as a coloured speck at the start of
            the track, which reads as a stray mark rather than as
            "nothing has happened". */}
        {pct > 0 && <i style={{ width: `${pct}%`, animationDelay: `${animDelay}ms` }} />}
      </div>
      <div className="debt-cert__railhint">{caption}</div>
      {children}
    </div>
  );
}
