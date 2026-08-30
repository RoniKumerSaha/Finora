/**
 * InvestmentRibbonChart — single balance curve whose stroke colour
 * splits at the principal line.
 *
 * The line traces month-by-month balance growth (use
 * `projectionSeries(plan)`). Up to the principal level, the stroke
 * is "your money" colour; above the principal level, it is "interest
 * earned" colour. Below the line, a soft gradient fill from your-
 * money tone into the interest tone reinforces the split without
 * competing with the line.
 *
 * Why a single line instead of two stacked bands?
 *   - The slope of the curve carries the temporal story — the user
 *     sees *when* interest starts to matter (DPS: gradually; FDR:
 *     immediately).
 *   - The colour split at the principal line is the visual punchline:
 *     "this much is yours, every pixel above is the bank's gift."
 *   - No stacked-area ambiguity about which series is which.
 *
 * Purely presentational. Scales via viewBox; accessible via
 * role="img" + aria-label so screen readers get the summary rather
 * than raw path data.
 */
export function InvestmentRibbonChart({
  series,
  principal,
  investedColor = 'var(--primary)',
  interestColor = 'var(--accent)',
  width = 520,
  height = 112,
  ariaLabel,
}: {
  /** Month-by-month balance. Length should be >= 2. */
  series: number[];
  /** Cumulative principal at maturity. The line colour splits here. */
  principal: number;
  investedColor?: string;
  interestColor?: string;
  width?: number;
  height?: number;
  ariaLabel?: string;
}) {
  // Degenerate input → flat baseline so the card doesn't collapse.
  const safe = series.length > 1 ? series.map(v => Math.max(0, Number(v) || 0)) : [0, 0];
  const len = safe.length;
  const max = Math.max(...safe, principal, 1);
  const principalLine = Math.max(0, Math.min(principal, max));

  const inset = 6;
  const innerW = width - inset * 2;
  const innerH = height - inset * 2;
  const stepX = innerW / (len - 1);
  const baseY = inset + innerH;

  const x = (i: number) => inset + i * stepX;
  const y = (v: number) => inset + innerH - (Math.max(0, v) / max) * innerH;
  const yPrincipal = y(principalLine);

  // Full polyline points (used for fill area and the principal split).
  const points = safe.map((v, i) => ({ x: x(i), y: y(v) }));
  const pointsStr = points.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`);

  // Split the polyline into "below principal" and "above principal"
  // segments by interpolating between sample points where the curve
  // crosses the principal line. We then render two strokes — the
  // eye reads them as one continuous line that changes colour.
  const below: string[] = [];
  const above: string[] = [];
  for (let i = 0; i < len; i++) {
    const cur = points[i];
    const prev = i > 0 ? points[i - 1] : null;
    const curAbove = cur.y < yPrincipal;
    const prevAbove = prev ? prev.y < yPrincipal : curAbove;

    if (prev) {
      // Detect a crossing between prev and cur.
      if (curAbove !== prevAbove) {
        const t = (prev.y - yPrincipal) / (prev.y - cur.y);
        const cx = prev.x + (cur.x - prev.x) * t;
        const cy = yPrincipal;
        below.push(`${cx.toFixed(2)},${cy.toFixed(2)}`);
        above.push(`${cx.toFixed(2)},${cy.toFixed(2)}`);
      }
    }

    if (curAbove) above.push(`${cur.x.toFixed(2)},${cur.y.toFixed(2)}`);
    else below.push(`${cur.x.toFixed(2)},${cur.y.toFixed(2)}`);
  }

  // Fill polygon: walk forward along the line, then back along the
  // baseline. Closed so the fill renders.
  const fillArea =
    `M ${x(0).toFixed(2)},${baseY.toFixed(2)} L ${pointsStr.join(' L ')} L ${x(len - 1).toFixed(2)},${baseY.toFixed(2)} Z`;

  // Gradient: your-money tone at the bottom (under the principal
  // line), interest tone where the line climbs above principal.
  const gradId = `ribbon-grad-${Math.random().toString(36).slice(2, 9)}`;
  const principalPct = max > 0 ? (principalLine / max) * 100 : 0;

  // Maturity annotations — last-point dot + small label.
  const finalX = x(len - 1);
  const finalY = y(safe[len - 1]);
  const finalInvested = principal;
  const finalInterest = Math.max(0, safe[len - 1] - principal);

  return (
    <svg
      role="img"
      aria-label={
        ariaLabel ??
        `Projection: ${finalInvested.toFixed(0)} of your money, ${finalInterest.toFixed(0)} of interest, total ${safe[len - 1].toFixed(0)}`
      }
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style={{ display: 'block', overflow: 'visible' }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor={investedColor} stopOpacity="0.28" />
          <stop offset={`${Math.max(0, Math.min(100, principalPct)).toFixed(2)}%`} stopColor={investedColor} stopOpacity="0.28" />
          <stop offset={`${Math.max(0, Math.min(100, principalPct)).toFixed(2)}%`} stopColor={interestColor} stopOpacity="0.18" />
          <stop offset="100%" stopColor={interestColor} stopOpacity="0.18" />
        </linearGradient>
      </defs>

      {/* Baseline */}
      <line
        x1={inset} x2={width - inset}
        y1={baseY} y2={baseY}
        stroke="currentColor" strokeOpacity="0.12" strokeWidth="1"
      />

      {/* Dashed principal reference — the line where "your money" ends
          and "interest" begins. */}
      <line
        x1={inset} x2={width - inset}
        y1={yPrincipal} y2={yPrincipal}
        stroke={investedColor}
        strokeOpacity="0.45"
        strokeWidth="1"
        strokeDasharray="3 4"
        vectorEffect="non-scaling-stroke"
      />

      {/* Gradient fill under the curve */}
      <path d={fillArea} fill={`url(#${gradId})`} stroke="none" />

      {/* The single curve, but rendered as two coloured segments so
          the eye reads a single line whose colour shifts at the
          principal level. */}
      {below.length >= 2 && (
        <path
          d={`M ${below.join(' L ')}`}
          fill="none"
          stroke={investedColor}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
      {above.length >= 2 && (
        <path
          d={`M ${above.join(' L ')}`}
          fill="none"
          stroke={interestColor}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      )}

      {/* Destination dot on the maturity value */}
      <circle
        cx={finalX} cy={finalY} r="3.5"
        fill={interestColor}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/**
 * Legend row for the ribbon chart. Kept in the same file because
 * the swatch colours must stay in lockstep with the chart defaults.
 */
export function InvestmentRibbonLegend({
  investedLabel,
  interestLabel,
  investedColor = 'var(--primary)',
  interestColor = 'var(--accent)',
}: {
  investedLabel: string;
  interestLabel: string;
  investedColor?: string;
  interestColor?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px]">
      <LegendSwatch color={investedColor} label={investedLabel} dashed />
      <LegendSwatch color={interestColor} label={interestLabel} />
    </div>
  );
}

function LegendSwatch({
  color, label, dashed,
}: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-muted">
      <span
        aria-hidden
        className="inline-block w-3 h-[3px] rounded-sm shrink-0"
        style={{
          background: dashed
            ? `repeating-linear-gradient(90deg, ${color} 0 3px, transparent 3px 6px)`
            : color,
          opacity: dashed ? 0.7 : 1,
        }}
      />
      {label}
    </span>
  );
}
