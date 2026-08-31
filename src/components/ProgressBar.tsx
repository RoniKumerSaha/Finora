/**
 * ProgressBar — filled pill showing 0–100% with the canonical
 * primary → accent gradient.
 *
 * Same fill everywhere in the app: cool primary (sage) on the
 * left, warm accent (honey) on the right. Reads as "money
 * growing" / "making progress" — same gradient the Goals +
 * Debts widgets on the Insights page already use, now lifted
 * into one shared component so the visual language is enforced
 * everywhere a bar appears (list cards, detail surfaces,
 * Insights widgets, planner previews).
 *
 * Width animates over 200ms so the fill slides smoothly when
 * the value changes — e.g. when the Insights period tab flips
 * and every bar recomputes, or when a contribution transaction
 * bumps a goal's percent.
 *
 * Height is parameterised so each context can pick its weight
 * without losing the same gradient: goal cards use 10px, debt
 * rows 6px, planner preview 4px. The component never renders
 * a border, shadow, or label — keep it pure and visual.
 */
export function ProgressBar({
  value,
  height = 6,
  className = '',
}: {
  /** Percent (0–100). Values outside the range are clamped. */
  value: number;
  /** Bar height in px. Defaults to 6px (matches Insights Goals). */
  height?: number;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div
      className={`rounded-pill overflow-hidden bg-surface-2 ${className}`}
      style={{ height: `${height}px` }}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-pill transition-[width] duration-200 ease-out"
        style={{
          width: `${pct}%`,
          background: 'linear-gradient(90deg, var(--primary), var(--accent))',
        }}
      />
    </div>
  );
}
