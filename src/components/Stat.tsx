/**
 * Stat — single labelled number.
 *
 * The canonical atom for any "label + number" pair in the app.
 * Replaces the 5 duplicate `Stat` / `StatTile` definitions that
 * previously lived in HomeScreen, InsightsScreen, InvestmentDetailScreen,
 * InvestmentPlannerScreen, and LoanCalculatorDetailScreen.
 *
 * Rules (2026-08-31 component-consistency):
 *   - Label: always `text-muted`, uppercase, 11px, tracking-[0.08em], semibold
 *   - Value: always `text-ink` unless `tone` overrides; tabular-nums
 *   - Sizes: sm = 14px, md = 18px, lg = 24px, xl = 28px extrabold
 *   - Tones: ink (default), primary, danger, accent
 */
import type { ReactNode } from 'react';

export type StatSize = 'sm' | 'md' | 'lg' | 'xl';
export type StatTone = 'ink' | 'primary' | 'danger' | 'accent';

const SIZE_CLASS: Record<StatSize, string> = {
  sm: 'text-[14px] font-semibold',
  md: 'text-[18px] font-bold',
  lg: 'text-[24px] font-bold',
  xl: 'text-[28px] font-extrabold',
};

const TONE_CLASS: Record<StatTone, string> = {
  ink:     'text-ink',
  primary: 'text-primary',
  danger:  'text-danger',
  accent:  'text-accent',
};

export function Stat({
  label,
  value,
  size = 'md',
  tone = 'ink',
  hint,
  className = '',
}: {
  label: string;
  value: string;
  size?: StatSize;
  tone?: StatTone;
  /**
   * Optional caption beneath the value. Accepts a ReactNode so callers
   * can colour part of it (e.g. an "↑ 5%" delta rendered with the
   * primary tone for "improving" or danger for "worsening"). Plain
   * string callers still work — Stat renders it inside the muted
   * hint line.
   */
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div className="text-[11px] text-muted uppercase tracking-[0.08em] font-semibold">
        {label}
      </div>
      <div className={`tabular leading-none ${SIZE_CLASS[size]} ${TONE_CLASS[tone]}`}>
        {value}
      </div>
      {hint != null && hint !== false && (
        <div className="text-[11px] text-muted mt-0.5 tabular">{hint}</div>
      )}
    </div>
  );
}