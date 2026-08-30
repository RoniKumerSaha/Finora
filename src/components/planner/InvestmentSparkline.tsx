/**
 * InvestmentSparkline — tiny inline SVG that traces month-by-month
 * balance growth for a mock investment plan.
 *
 * Visual:
 *   - DPS   → curved annuity-due growth (steepens at the end).
 *   - FDR   → straight linear ramp from 0 to the maturity value.
 *
 * The component is purely presentational: pass in the `series` array
 * (use `projectionSeries(plan)` from the domain) and a CSS colour
 * string. It scales via `viewBox` so it looks crisp at any size.
 *
 * Accessibility: the SVG gets a `role="img"` plus an `aria-label`
 * summarising the start → end values so screen readers don't read
 * the raw path data.
 */
export function InvestmentSparkline({
  series,
  color,
  width = 220,
  height = 64,
  ariaLabel,
}: {
  series: number[];
  color: string;
  width?: number;
  height?: number;
  ariaLabel?: string;
}) {
  // Empty / single-point: render a flat line so the card doesn't collapse.
  const safe = series.length > 1 ? series : [0, 0];
  const max = Math.max(...safe, 1);
  const min = Math.min(...safe, 0);
  const span = Math.max(1, max - min);

  // Build a polyline path with normalised coordinates. We use a tiny
  // 4px inset on every side so the stroke doesn't get clipped by the
  // SVG viewBox edges.
  const inset = 4;
  const innerW = width - inset * 2;
  const innerH = height - inset * 2;
  const stepX = innerW / (safe.length - 1);
  const points = safe.map((v, i) => {
    const x = inset + i * stepX;
    const y = inset + innerH - ((v - min) / span) * innerH;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const pathD = `M ${points.join(' L ')}`;

  // The "last point" dot — uses the same colour, slightly larger so
  // it reads as a destination marker.
  const lastX = inset + (safe.length - 1) * stepX;
  const lastY = inset + innerH - ((safe[safe.length - 1] - min) / span) * innerH;
  const firstVal = safe[0];
  const lastVal = safe[safe.length - 1];

  return (
    <svg
      role="img"
      aria-label={ariaLabel ?? `Projection: from ${firstVal.toFixed(0)} to ${lastVal.toFixed(0)}`}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style={{ display: 'block', overflow: 'visible' }}
    >
      {/* Soft baseline */}
      <line
        x1={inset} x2={width - inset}
        y1={height - inset} y2={height - inset}
        stroke="currentColor" strokeOpacity="0.12" strokeWidth="1"
      />
      {/* The growth path */}
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {/* Destination dot */}
      <circle
        cx={lastX} cy={lastY} r="3"
        fill={color}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
