/**
 * DualValueLine — renders an "at maturity" sub-line beneath a
 * current-value headline, with the projection always clearly
 * labelled. Collapses to nothing when current and projected are the
 * same number (so FDR rows stay compact).
 *
 * Used by:
 *   - HomeScreen's net-worth tile
 *   - InvestmentsListScreen row + summary
 *   - InsightsScreen investments widget + row
 *
 * Why "≥ 1" not "> 0": rounding can leave a 0.4-taka gap between the
 * headline and the projection; the `1`-taka cutoff treats that as
 * "effectively equal" and skips the projection line.
 */
import { fmtBDT } from '../lib/format';

export interface DualValueLineProps {
  /** Real money tied up right now (the headline). */
  current: number;
  /** Future projection at the end of the term. */
  projected: number;
  /** Tone for the headline number (defaults to ink). */
  currentTone?: 'accent' | 'info' | 'primary' | 'ink';
  /** Override the sub-line copy. Defaults to "{value} at maturity (projection)". */
  projectionLabel?: string;
  /** Optional prefix on the headline (e.g. "Now", "Maturity"). */
  headlinePrefix?: string;
  /** Tailwind/text classes appended to the headline number. */
  className?: string;
}

const TONE_CLASS: Record<NonNullable<DualValueLineProps['currentTone']>, string> = {
  accent: 'text-accent',
  info: 'text-info',
  primary: 'text-primary',
  ink: 'text-ink',
};

export function DualValueLine({
  current,
  projected,
  currentTone = 'ink',
  projectionLabel,
  headlinePrefix,
  className,
}: DualValueLineProps) {
  const showProjection = projected - current > 1;
  const tone = TONE_CLASS[currentTone];
  return (
    <>
      <div className={['text-[13px] font-bold tabular', tone, className ?? ''].join(' ').trim()}>
        {headlinePrefix ? `${headlinePrefix} ` : ''}{fmtBDT(current)}
      </div>
      {showProjection && (
        <div className="text-[11.5px] text-muted mt-0.5 tabular">
          {projectionLabel ?? `${fmtBDT(projected)} at maturity`}{' '}
          <span className="opacity-70">(projection)</span>
        </div>
      )}
    </>
  );
}