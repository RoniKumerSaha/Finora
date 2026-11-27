/**
 * Stat — single labelled number.
 *
 * The canonical atom for any "label + number" pair in the app.
 * Replaces the 5 duplicate `Stat` / `StatTile` definitions that
 * previously lived in HomeScreen, InsightsScreen, InvestmentDetailScreen,
 * InvestmentPlannerScreen, and LoanCalculatorDetailScreen.
 *
 * Rules (2026-08-31 component-consistency):
 *   - Label: the shared `.label` class — muted, uppercase, 11px, semibold
 *   - Value: always `text-ink` unless `tone` overrides; tabular-nums
 *   - Sizes: off the app's type scale — sm = 13px, md = 18px,
 *     lg = 22px, xl = 30px extrabold
 *   - Tones: ink (default), primary, danger, accent
 */
import type { ReactNode } from 'react';

export type StatSize = 'sm' | 'md' | 'lg' | 'xl';
export type StatTone = 'ink' | 'primary' | 'danger' | 'accent';

const SIZE_CLASS: Record<StatSize, string> = {
  sm: 't-13 font-semibold',
  md: 't-18 font-bold',
  lg: 't-22 font-bold',
  xl: 't-30 font-extrabold',
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
      <div className="label">
        {label}
      </div>
      <div className={`tabular leading-none ${SIZE_CLASS[size]} ${TONE_CLASS[tone]}`}>
        {value}
      </div>
      {hint != null && hint !== false && (
        <div className="t-11 text-muted mt-0.5 tabular">{hint}</div>
      )}
    </div>
  );
}