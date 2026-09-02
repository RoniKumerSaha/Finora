/**
 * InvestTile / LoanTile — canonical icon tile for the investment and
 * loan surfaces (real screens AND planner previews).
 *
 * Both use the same w-10 h-10 rounded-input surface tile from
 * `ICON_TILE_CLASS`, but the *icon itself* is tinted by type:
 *
 *   - InvestTile — DPS  → green (success) icon
 *                  FDR  → gold (accent) icon
 *                  Savings → blue (info) icon
 *                  default → green (success)
 *   - LoanTile   — red (danger)  icon
 *
 * The wrapper chrome is uniformly neutral (`bg-surface-2 text-muted`)
 * so it matches every other icon-tile wrapper across the app. The
 * icon's semantic color (green for DPS, gold for FDR, blue for
 * savings, red for loan) is applied to a child <span> so the
 * pictogram itself carries the meaning while the wrapper stays
 * consistent.
 *
 * The icon source comes from the navbar / shared icon library so
 * every "this is an investment" and "this is a loan" surface across
 * the app uses the same silhouette.
 */
import { NavInvestments, Bank, NavGoals } from './icons/Icons';
import type { InvestmentType } from '../domain/types';

const TILE_BASE =
  'w-10 h-10 rounded-input flex items-center justify-center shrink-0 bg-surface-2';

function investmentIconTone(type: InvestmentType | string | undefined): string {
  switch (type) {
    case 'fdr':     return 'text-accent';   // gold/yellow
    case 'savings': return 'text-info';     // blue
    case 'dps':
    default:        return 'text-success';  // green
  }
}

export function InvestTile({
  size = 22,
  type,
}: { size?: number; type?: InvestmentType | string }) {
  return (
    <span aria-hidden className={TILE_BASE}>
      <span className={`${investmentIconTone(type)} inline-flex`}>
        <NavInvestments style={{ width: size, height: size }} />
      </span>
    </span>
  );
}

export function LoanTile({ size = 22 }: { size?: number }) {
  return (
    <span aria-hidden className={TILE_BASE}>
      <span className="text-danger inline-flex">
        <Bank style={{ width: size, height: size }} />
      </span>
    </span>
  );
}

/**
 * GoalTile — the canonical icon tile for goal surfaces (real cards,
 * Insights rows, planner previews). Uses the navbar `NavGoals` star
 * pictogram, tinted info/blue so it matches the goal card's wash +
 * accent bar (the cool-blue family every goal surface carries).
 *
 * Wrapper stays uniformly neutral; the icon's semantic color is
 * applied to a child span.
 */
export function GoalTile({ size = 22 }: { size?: number }) {
  return (
    <span aria-hidden className={TILE_BASE}>
      <span className="text-info inline-flex">
        <NavGoals style={{ width: size, height: size }} />
      </span>
    </span>
  );
}
