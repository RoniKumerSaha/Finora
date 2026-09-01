/**
 * ProgressBar — filled pill showing 0–100% with a cool
 * info → primary gradient.
 *
 * 2-stop cool sweep (steel-blue → sage green) reads as a calm,
 * monochrome "money moving" bar at every height. The blue end
 * ties to the new event-card info band (50–89% spending) so the
 * bar mid-fill visually agrees with the card wash around it.
 *
 * Optional `tone="overflow"` swaps the gradient to an info → deep
 * brick-red sweep (--info → #A33025). The blue start is kept in
 * common with the normal bar so the eye reads "same bar, status
 * changed" rather than two unrelated elements; the right end jumps
 * to a darker, more saturated brick than `--danger` so the gloss
 * holds against the dark surface. Used when the underlying
 * allocation is over budget — the fill still caps at 100% width
 * (you can't visually overflow a 100% bar), but the colour now
 * agrees with the red card wash + danger pill, so the bar, the
 * card, and the label all read as "over budget" together.
 *
 * Width animates over 200ms so the fill slides smoothly when
 * the value changes — e.g. when the Insights period tab flips
 * and every bar recomputes, or when a contribution transaction
 * bumps a goal's percent.
 *
 * Optional `animateOnMount` runs a one-shot `progressbar-grow-in`
 * keyframe (defined in app.css) so the bar tweens from 0 → target
 * over 1800ms when the screen first mounts. Used by grids of bars
 * (e.g. EventPlanScreen) so the cards fill in a wave instead of
 * snapping to their final state. Pass `animationDelay` (ms) to
 * stagger bars across a row.
 *
 * When `animateOnMount` is on, the component also exposes a
 * `data-progress-target` attribute on the track so a sibling
 * label can drive its own count-up via a CSS counter animation
 * (`progressbar-count-up`). The companion pill lives outside
 * ProgressBar — see EventPlanScreen for the wiring pattern.
 *
 * Height is parameterised so each context can pick its weight
 * without losing the same gradient: goal cards use 10px, debt
 * rows 6px, planner preview 4px. The component never renders
 * a border, shadow, or label — keep it pure and visual.
 */
export function ProgressBar({
  value,
  height = 6,
  tone = 'normal',
  className = '',
  animateOnMount = false,
  animationDelay = 0,
}: {
  /** Percent (0–100). Values outside the range are clamped. */
  value: number;
  /** Bar height in px. Defaults to 6px (matches Insights Goals). */
  height?: number;
  /** Fill tone. `'overflow'` swaps the gradient to cyan → deep brick. */
  tone?: 'normal' | 'overflow';
  className?: string;
  /** One-shot grow-in from 0 → target width when the bar mounts. */
  animateOnMount?: boolean;
  /** Per-bar delay (ms) so a grid of bars fills in a wave. */
  animationDelay?: number;
}) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  const fill =
    tone === 'overflow'
      ? 'linear-gradient(90deg, var(--info), #A33025)'
      : 'linear-gradient(90deg, var(--info), var(--primary))';
  const fillStyle: React.CSSProperties = {
    width: `${pct}%`,
    background: fill,
    transformOrigin: 'left center',
  };
  if (animateOnMount) {
    fillStyle.animation = `progressbar-grow-in 3000ms cubic-bezier(.22,.61,.36,1) ${animationDelay}ms both`;
  }
  return (
    <div
      className={`rounded-pill overflow-hidden bg-surface-2 ${className}`}
      style={{ height: `${height}px` }}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      data-progress-target={animateOnMount ? Math.round(pct) : undefined}
    >
      <div
        className={animateOnMount ? 'h-full rounded-pill' : 'h-full rounded-pill transition-[width] duration-200 ease-out'}
        style={fillStyle}
      />
    </div>
  );
}
