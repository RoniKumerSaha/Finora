/**
 * InvestmentTypeBadge — coloured pill showing the investment scheme
 * (DPS / FDR / savings) with a per-type accent colour.
 *
 * Previously rendered a leading pictogram (Direction-C glyph) inside
 * the pill; the icon has been removed so the badge stays compact
 * and the surrounding icon tile (`<InvestTile>`) carries the visual
 * identity instead.
 *
 * Used on the Investment Planner list cards and the detail screen's
 * hero card. The per-type colour tracks the shared `investmentTone`
 * mapping (DPS=primary, FDR=accent, Savings=info) so the badge, the
 * card wash, and the 3px bar all carry one color family.
 */
import type { InvestmentType } from '../../domain/types';

const META: Record<InvestmentType, { label: string; color: string; soft: string }> = {
  dps:     { label: 'DPS',     color: 'var(--primary)', soft: 'var(--primary-soft)' },
  fdr:     { label: 'FDR',     color: 'var(--accent)',  soft: 'var(--accent-soft)' },
  savings: { label: 'Savings', color: 'var(--info)',    soft: 'var(--info-soft)' },
};

export function InvestmentTypeBadge({
  type,
  size = 'sm',
}: {
  type: InvestmentType;
  size?: 'sm' | 'md';
}) {
  const m = META[type];
  const sizing = size === 'md'
    ? 'px-3 py-1.5 text-[13px]'
    : 'px-2.5 py-1 text-[11px]';
  return (
    <span
      className={`inline-flex items-center rounded-pill border border-border ${sizing} font-semibold uppercase tracking-[0.04em] whitespace-nowrap`}
      style={{ background: m.soft, color: m.color }}
    >
      <span>{m.label}</span>
    </span>
  );
}

/** Returns just the accent colour for a type — used by cards that
 *  draw a left-edge colour band instead of (or alongside) the badge. */
export function investmentTypeColor(type: InvestmentType): string {
  return META[type].color;
}
