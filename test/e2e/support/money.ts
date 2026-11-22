/**
 * money.ts — the app's own formatting and date arithmetic, mirrored.
 *
 * Some of the figures the manual cases assert are DERIVED from the
 * run date — the "৳ X/mo" line on a goal card is
 * `remaining / monthsToDeadline`, so its value moves with the
 * calendar. Freezing such a figure in the JSON store would make the
 * test fail on a different day, and asserting a stale literal would
 * encode a falsehood.
 *
 * So the expectation is COMPUTED here, with the same rules the app
 * uses, and the test asserts the app agrees with the computation.
 *
 * ## Why a mirror and not an import
 *
 * `src/lib/format.ts` and `src/domain/math.ts` are app source. The
 * e2e suite compiles against the app's own `State` type (see
 * `test/e2e/fixtures/app-state.ts`), so importing them would be
 * legitimate — but a test that imports the function under test is
 * not really testing it. The mirror is a deliberate, independent
 * re-implementation of the two rules the tests need, so a change in
 * the app shows up as a FAILURE rather than being mirrored silently.
 */

/**
 * Format an amount the way `fmtBDT` does.
 *
 * `src/lib/format.ts`:
 *
 *   '৳ ' + Math.round(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })
 *
 * The `en-IN` grouping is the lakh grouping — 1234567 renders as
 * "12,34,567", not the western "1,234,567".
 */
export function fmtBDT(value: number | string): string {
  const n = Math.round(Number(value) || 0);
  return '৳ ' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

/**
 * The number of whole months between two ISO dates.
 *
 * A mirror of `monthsBetween` in `src/domain/math.ts`: the month
 * difference, minus one when the `to` date falls before the `from`
 * date within the month.
 */
export function monthsBetween(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00Z`);
  const b = new Date(`${to}T00:00:00Z`);
  let months =
    (b.getUTCFullYear() - a.getUTCFullYear()) * 12 +
    (b.getUTCMonth() - a.getUTCMonth());
  if (b.getUTCDate() < a.getUTCDate()) months -= 1;
  return months;
}

/**
 * The per-month figure a goal card shows.
 *
 * A mirror of `goalRequiredPerMonth` in `src/domain/math.ts`:
 *
 *   remaining / monthsBetween(today, targetDate)
 *
 * with `Infinity` when the deadline has already passed (the app
 * renders that as "overdue").
 */
export function requiredPerMonth(
  remaining: number,
  targetDate: string,
  today: string,
): number {
  if (remaining <= 0) return 0;
  const months = monthsBetween(today, targetDate);
  if (months <= 0) return Infinity;
  return remaining / months;
}

/**
 * Today's date as `YYYY-MM-DD`, in the LOCAL timezone.
 *
 * The app's `today()` helper uses the local calendar day, and so
 * does this one — the two must agree or a month-boundary run would
 * compute a different month count than the app.
 */
export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}
