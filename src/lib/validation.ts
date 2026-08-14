/**
 * validation.ts — small string-level predicates used by form screens.
 *
 * Spine: docs/ux-designs/ux-finora-2026-08-14-negative-guard/EXPERIENCE.md
 *
 * Two rules are exposed:
 *   - isPositiveMoney(s):     string is a finite number strictly > 0
 *   - isNonNegativeMoney(s):  string is a finite number >= 0
 *
 * The error copy strings are co-located here so the inline layer and
 * the domain layer agree. The domain layer uses these via
 * TransactionError / similar; the form screens render them inline.
 *
 * These helpers do NOT mutate the input. Validation is purely
 * presentational — the user keeps what they typed. See EXPERIENCE.md
 * "Inline error contract" for why.
 */

export const POSITIVE_MONEY_ERROR = 'Amount must be greater than zero.';
export const NON_NEGATIVE_MONEY_ERROR = 'Amount must be zero or greater.';

/**
 * Strictly positive money amount.
 *
 * Accepts: "250", "12.50", "2.5e2", "0250" (coerces to 250).
 * Rejects: "", "0", "0.0", "0e0", "-250", "-12.50", "-2.5e2", "abc",
 *          "NaN", "Infinity", "-Infinity", whitespace.
 */
export function isPositiveMoney(s: string): boolean {
  if (typeof s !== 'string' || s.trim() === '') return false;
  const n = Number(s);
  return Number.isFinite(n) && n > 0;
}

/**
 * Zero-or-positive money amount.
 *
 * Same accept/reject rules as isPositiveMoney except `0` is allowed.
 * Used for fields that legitimately can be zero (account opening
 * balance, goal "already saved").
 */
export function isNonNegativeMoney(s: string): boolean {
  if (typeof s !== 'string' || s.trim() === '') return false;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0;
}

/**
 * Convenience: the error message to show inline when the rule fails.
 * Drops the trailing period for consistent typography — the inline
 * error slot renders the message verbatim below the field. The period
 * stays for the banner because banners use full sentences.
 */
export function positiveMoneyError(): string {
  return POSITIVE_MONEY_ERROR;
}

export function nonNegativeMoneyError(): string {
  return NON_NEGATIVE_MONEY_ERROR;
}
