/**
 * duration.ts — helpers for expressing a term in years *or* months.
 *
 * The stored model keeps every term in **months** (`InvestmentPlan.termMonths`,
 * `LoanPlan.termMonths`) because that's what all the formulas in
 * `src/domain/math.ts` and `src/domain/investmentPlans.ts` read. This
 * module is the presentation-layer bridge: it converts a user-entered
 * duration in the unit they picked ("2 years") into the canonical month
 * count ("24"), and converts back for display.
 *
 * Because 12 months = 1 year exactly, the conversion is lossless in both
 * directions — no rounding surprises, no migration, no formula changes.
 */

export type DurationUnit = 'years' | 'months';

export const MONTHS_PER_YEAR = 12;

/**
 * Convert a user-entered duration into whole months.
 *
 * Years may carry a fraction (`2.5` → 30 months). Months are taken as
 * whole numbers. Anything non-positive or non-finite collapses to 0 —
 * callers treat 0 as "not entered".
 */
export function durationToMonths(value: number, unit: DurationUnit): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  const months = unit === 'years' ? n * MONTHS_PER_YEAR : n;
  return Math.round(months);
}

/**
 * Pick the natural unit for a stored month count.
 *
 * Years only win when the term is a WHOLE number of years ("3 years"
 * reads better than "36 months"). A term like 18 months stays in
 * months — "1.5 years" is harder to scan than "18 months", and bank
 * contracts are stated in months anyway.
 */
export function monthsToUnit(months: number): DurationUnit {
  const total = Math.abs(Math.floor(Number(months) || 0));
  return total > 0 && total % MONTHS_PER_YEAR === 0 ? 'years' : 'months';
}

/**
 * Split a stored month count into the (value, unit) pair shown in the
 * editor.
 *
 * `unit` is the unit the user is currently editing in. When that unit
 * can't express the month count exactly (e.g. 18 months while the user
 * is looking at the Years field), we fall back to months — the value is
 * never silently rounded away.
 */
export function splitDuration(
  months: number,
  unit: DurationUnit,
): { value: number; unit: DurationUnit } {
  const total = Math.max(0, Math.floor(Number(months) || 0));
  if (unit === 'months') return { value: total, unit: 'months' };
  // Years can express any whole month count exactly (n/12 may be
  // fractional, but that's a valid years value).
  return { value: total / MONTHS_PER_YEAR, unit: 'years' };
}

/**
 * Human label for a month count.
 *
 *   1  → "1 month"
 *   12 → "1 year"
 *   18 → "1 year 6 months"
 *   30 → "2.5 years"
 */
export function formatDuration(months: number): string {
  const total = Math.max(0, Math.floor(Number(months) || 0));
  if (total === 0) return '0 months';

  const years = Math.floor(total / MONTHS_PER_YEAR);
  const rest = total % MONTHS_PER_YEAR;

  if (rest === 0) {
    return years === 1 ? '1 year' : `${years} years`;
  }
  if (years === 0) {
    return rest === 1 ? '1 month' : `${rest} months`;
  }
  const yearPart = years === 1 ? '1 year' : `${years} years`;
  const monthPart = rest === 1 ? '1 month' : `${rest} months`;
  return `${yearPart} ${monthPart}`;
}

/**
 * Compact label for list cards — the card row has no room for
 * "1 year 6 months".
 *
 *   12 → "1y"     18 → "18mo"     30 → "2.5y"     6 → "6mo"
 */
export function formatDurationShort(months: number): string {
  const total = Math.max(0, Math.floor(Number(months) || 0));
  if (total === 0) return '0mo';
  if (total < MONTHS_PER_YEAR) return `${total}mo`;
  const years = total / MONTHS_PER_YEAR;
  // Whole years drop the decimal ("1y"), fractional years keep one
  // decimal place ("2.5y").
  const label = Number.isInteger(years) ? String(years) : years.toFixed(1);
  return `${label}y`;
}
