/**
 * SplitBar — a horizontal stacked bar showing the proportion of
 * "part A" vs "part B". Used by the planner list cards to convey
 * "your money vs bank interest" at a glance.
 *
 * - Two stops; the bar is filled with a base→accent gradient.
 * - 4px track (h-1) matches InvestmentProgressBar and the rest of
 *   the planner module. Transitions at 200ms ease for value changes.
 * - Renders the part labels with their absolute values, plus the
 *   percentages so the user can read both the magnitude and the
 *   ratio without doing math.
 * - 0% / 100% edge cases collapse gracefully to a single segment.
 *
 * Pure presentational. Colours default to theme tokens so dark/light
 * parity is automatic.
 */
export function SplitBar({
  a,
  b,
  aLabel,
  bLabel,
  aColor = 'var(--primary)',
  bColor = 'var(--accent)',
  formatValue,
}: {
  a: number;
  b: number;
  aLabel: string;
  bLabel: string;
  aColor?: string;
  bColor?: string;
  /** Format the absolute value next to each label. Defaults to locale int. */
  formatValue?: (n: number) => string;
}) {
  const safeA = Math.max(0, Number(a) || 0);
  const safeB = Math.max(0, Number(b) || 0);
  const total = safeA + safeB;
  const pctA = total > 0 ? (safeA / total) * 100 : 100;
  const pctB = total > 0 ? 100 - pctA : 0;
  const fmt = formatValue ?? ((n: number) => Math.round(n).toLocaleString());

  return (
    <div className="flex flex-col gap-1.5">
      <div className="h-1 rounded-pill bg-surface-2 overflow-hidden flex">
        <div
          className="h-full"
          style={{
            width: `${pctA}%`,
            background: aColor,
            opacity: 0.85,
            transition: 'width 200ms ease',
          }}
        />
        {pctB > 0 && (
          <div
            className="h-full"
            style={{
              width: `${pctB}%`,
              background: bColor,
              opacity: 0.85,
              transition: 'width 200ms ease',
            }}
          />
        )}
      </div>
      <div className="flex items-center gap-3 text-[11px] text-muted tabular">
        <span className="inline-flex items-center gap-1.5 min-w-0">
          <span
            aria-hidden
            className="inline-block w-2 h-2 rounded-[2px] shrink-0"
            style={{ background: aColor, opacity: 0.85 }}
          />
          <span className="truncate">
            <b className="text-ink font-semibold">{aLabel}</b>
            {' · '}
            {fmt(safeA)}
            {total > 0 && (
              <span className="text-muted"> ({pctA.toFixed(0)}%)</span>
            )}
          </span>
        </span>
        <span className="inline-flex items-center gap-1.5 min-w-0">
          <span
            aria-hidden
            className="inline-block w-2 h-2 rounded-[2px] shrink-0"
            style={{ background: bColor, opacity: 0.85 }}
          />
          <span className="truncate">
            <b className="text-ink font-semibold">{bLabel}</b>
            {' · '}
            {fmt(safeB)}
            {total > 0 && (
              <span className="text-muted"> ({pctB.toFixed(0)}%)</span>
            )}
          </span>
        </span>
      </div>
    </div>
  );
}
