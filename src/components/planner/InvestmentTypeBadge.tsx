/**
 * InvestmentTypeBadge — coloured pill showing the investment scheme
 * (DPS / FDR / savings) with its emoji + a per-type accent colour.
 *
 * Used on the Investment Planner list cards and the detail screen's
 * hero card. The colour tokens match the rest of the app's planner
 * palette so the badges sit naturally next to other category chips.
 */
import type { InvestmentType } from '../../domain/types';

const META: Record<InvestmentType, { label: string; emoji: string; color: string; soft: string }> = {
  dps:     { label: 'DPS',           emoji: '🗓️', color: 'var(--info)',   soft: 'var(--info-soft)' },
  fdr:     { label: 'FDR',           emoji: '🏦', color: 'var(--accent)', soft: 'var(--accent-soft)' },
  savings: { label: 'Savings',       emoji: '💼', color: 'var(--cyan)',   soft: 'var(--cyan-soft)' },
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
      className={`inline-flex items-center gap-1.5 rounded-pill border border-border ${sizing} font-semibold uppercase tracking-[0.04em] whitespace-nowrap`}
      style={{ background: m.soft, color: m.color }}
    >
      <span aria-hidden className="text-[14px] leading-none">{m.emoji}</span>
      <span>{m.label}</span>
    </span>
  );
}

/** Returns just the accent colour for a type — used by cards that
 *  draw a left-edge colour band instead of (or alongside) the badge. */
export function investmentTypeColor(type: InvestmentType): string {
  return META[type].color;
}
