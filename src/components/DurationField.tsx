/**
 * DurationField — a term input the user can fill in **months** or
 * **years**.
 *
 * The stored term is always a month count (`termMonths`); this control
 * is purely a presentation-layer converter. The number the user types is
 * interpreted in the currently-selected unit and handed back to the
 * caller already converted to months.
 *
 * Two rules drive the design:
 *
 *   1. **One source of truth.** The component takes `months` and emits
 *      `months`. The unit toggle is local state that only decides how
 *      the stored month count is *displayed*. Switching units therefore
 *      re-expresses the value (12 months → "1" year) instead of
 *      discarding it.
 *   2. **A stable accessible name.** The label is "Term" whatever the
 *      active unit — the unit lives in the toggle, not the label. That
 *      keeps `getByLabel('Term')` working no matter which unit is
 *      selected.
 *
 * Used by the Loan Calculator and Investment Planner detail forms so
 * the two planner surfaces stay siblings.
 *
 * ## Layout note
 *
 * The number input is the FIRST child of `Field`, so `Field`'s
 * label-association logic points the "Term" label at it. `Field` only
 * associates with the first *labelable* child, and a wrapping `<div>`
 * would not be labelable — so the toggle is a decorative sibling that
 * renders after the input instead of around it.
 */
import { useState } from 'react';
import { Field, Input } from './Field';
import {
  durationToMonths,
  monthsToUnit,
  splitDuration,
  type DurationUnit,
} from '../domain/duration';

const UNIT_LABEL: Record<DurationUnit, string> = {
  months: 'Months',
  years: 'Years',
};

export function DurationField({
  months,
  onChange,
  label = 'Term',
  hint,
}: {
  /** The canonical term, in whole months. */
  months: number;
  /** Called with the new term, in whole months. */
  onChange: (months: number) => void;
  label?: string;
  /** Overrides the default hint for the active unit. */
  hint?: string;
}) {
  // The unit the user last chose. Seeded from the stored value so an
  // existing 36-month plan opens in Years ("3") rather than forcing the
  // user to re-read "36" as months.
  const [unit, setUnit] = useState<DurationUnit>(() => monthsToUnit(months));

  const { value } = splitDuration(months, unit);

  function switchUnit(next: DurationUnit) {
    if (next === unit) return;
    // The month count is untouched — only the way we show it changes.
    setUnit(next);
  }

  function onValueChange(raw: string) {
    const n = Number(raw);
    onChange(durationToMonths(Number.isFinite(n) ? n : 0, unit));
  }

  const defaultHint = unit === 'years'
    ? 'Years are converted to months — 1 year = 12 months.'
    : 'Use the same number of months as your bank contract.';

  return (
    <Field label={label} hint={hint ?? defaultHint}>
      {/* The number input comes FIRST so `Field` associates the "Term"
          label with it. */}
      <Input
        type="number"
        inputMode={unit === 'years' ? 'decimal' : 'numeric'}
        min={0}
        step={unit === 'years' ? '0.5' : '1'}
        value={value === 0 && months === 0 ? '' : String(value)}
        onChange={e => onValueChange(e.target.value)}
        placeholder={unit === 'years' ? '3' : '12'}
      />

      {/* Unit toggle — a `group` of two `aria-pressed` buttons, using
          the segmented idiom already established by SignInDialog and
          BatchBudgetEditor. A decorative sibling of the control, so it
          renders untouched by `Field`'s id-cloning. */}
      <div
        role="group"
        aria-label="Term unit"
        className="flex rounded-btn p-1 shrink-0 self-start"
        style={{ background: 'var(--surface-2)' }}
      >
        {(['months', 'years'] as const).map(u => (
          <button
            key={u}
            type="button"
            aria-pressed={unit === u}
            onClick={() => switchUnit(u)}
            className={[
              'px-2.5 py-1.5 rounded-btn text-[12px] font-semibold transition',
              unit === u
                ? 'bg-surface text-ink shadow-[var(--shadow-inset)]'
                : 'text-muted hover:text-ink',
            ].join(' ')}
          >
            {UNIT_LABEL[u]}
          </button>
        ))}
      </div>
    </Field>
  );
}
