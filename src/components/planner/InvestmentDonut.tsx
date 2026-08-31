/**
 * InvestmentDonut — composition of the maturity value as a donut
 * with a percentage label in the centre.
 *
 * Replaces the previous ribbon chart for the projection hero card.
 * Rationale:
 *   - A line chart of a 9% FDR is essentially flat — there's no
 *     movement to draw. The shape lied about the product.
 *   - A donut of "X% your money / Y% interest" is honest: for a
 *     small interest slice, the donut looks mostly one colour;
 *     for a big slice, you see a clear arc.
 *
 * Visual:
 *   - 124px diameter, hollow centre (donut, not pie).
 *   - Background ring in the band colour at low opacity.
 *   - Foreground arc in the *opposite* polarity colour (primary
 *     for the "your money" portion of an FDR-product, accent for
 *     DPS) so the slice is visible against the ring.
 *   - Centre text: the *smaller* segment as a percentage + label,
 *     to direct the eye to "the interesting bit".
 *
 * Purely presentational. Scales via viewBox; accessible via
 * role="img" + aria-label summarising both segments.
 */
import { fmtBDT } from '../../lib/format';

export function InvestmentDonut({
  total,
  invested,
  interest,
  investedColor = 'var(--primary)',
  interestColor = 'var(--accent)',
  ringColor,
  size = 124,
  strokeWidth = 18,
  ariaLabel,
}: {
  /** Final maturity value (denominator for percentages). */
  total: number;
  /** Principal / total contributed. */
  invested: number;
  /** Interest earned. */
  interest: number;
  investedColor?: string;
  interestColor?: string;
  /** Background ring colour (falls back to investedColor @ low opacity). */
  ringColor?: string;
  size?: number;
  strokeWidth?: number;
  ariaLabel?: string;
}) {
  // Degenerate input → just render a neutral ring with 0%.
  const safeTotal = Math.max(0, Number(total) || 0);
  const safeInvested = Math.max(0, Number(invested) || 0);
  const safeInterest = Math.max(0, Number(interest) || 0);
  // invested slice dominates the ring; interest is the arc.
  const investedFraction = safeTotal > 0 ? safeInvested / safeTotal : 0;
  const interestFraction = safeTotal > 0 ? safeInterest / safeTotal : 0;
  const investedPct = Math.round(investedFraction * 100);
  const interestPct = 100 - investedPct;

  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;

  // Background ring colour: a low-opacity tint of the *other* tone
  // so the active arc reads on top of it. Falls back to invested.
  const ring = ringColor ?? `color-mix(in srgb, ${investedColor} 30%, transparent)`;

  // For products where interest is the *slice* we want to draw
  // (most cases), draw the active arc in `interestColor` over a
  // tinted ring in `investedColor`. For products where invested
  // itself is the smaller piece we invert. Here "interest" is
  // always the sliver, so the active arc uses interestColor.
  const activeColor = interestColor;
  const activeFraction = interestFraction;
  const activePct = interestPct;

  // Circle arc length = fraction * circumference. Remaining = (1-f) * C.
  const activeLen = activeFraction * circumference;
  const remainderLen = circumference - activeLen;

  return (
    <svg
      role="img"
      aria-label={
        ariaLabel ??
        `${investedPct}% your money (${fmtBDT(safeInvested)}), ${interestPct}% interest (${fmtBDT(safeInterest)}), total ${fmtBDT(safeTotal)}`
      }
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ display: 'block', overflow: 'visible' }}
    >
      {/* Background ring — full circle in the muted ring tone */}
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={ring}
        strokeWidth={strokeWidth}
      />
      {/* Active arc — interest slice. Start at 12 o'clock, sweep clockwise.
          `stroke-dasharray` is "active, gap" and we offset by 0. */}
      {activeFraction > 0 && (
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={activeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="butt"
          strokeDasharray={`${activeLen.toFixed(2)} ${remainderLen.toFixed(2)}`}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      )}
      {/* Centre label: percentage of the *active* slice */}
      <text
        x={cx} y={cy - 2}
        textAnchor="middle"
        fontSize={size * 0.18}
        fontWeight={700}
        fill="var(--ink)"
        fontFamily="inherit"
      >
        {activePct}%
      </text>
      <text
        x={cx} y={cy + size * 0.13}
        textAnchor="middle"
        fontSize={size * 0.085}
        fill="var(--muted)"
        fontFamily="inherit"
        letterSpacing="0.05em"
        style={{ textTransform: 'uppercase' }}
      >
        {activeFraction > 0 ? 'interest' : 'your money'}
      </text>
    </svg>
  );
}
