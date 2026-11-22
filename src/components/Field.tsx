/**
 * Field — single form field with label + input + error slot.
 *
 * v1 visual target: docs/ux-designs/.../mockups/v1/index.html
 *   - label: 11px muted uppercase tracked
 *   - input:  bg-surface-2, border-border, padding 10×14,
 *             radius 10px (r-input), focus → 2px primary outline
 *   - error:  danger text (inline three-part error formatting is
 *             applied by screens, this is just the slot)
 *
 * 2026-08-14 polish: tight label rhythm (4px gap), a subtle inset
 * shadow on inputs for a "recessed" feel, and a focus ring that uses
 * the global focus contract (3px primary at 28% opacity).
 *
 * Used by every form screen. Pure presentational; validation happens
 * upstream in lib/errors.ts (AD-19).
 *
 * Number inputs: blur on wheel so the page scrolls instead of the value
 * incrementing. Wheel-over-number-input is a footgun users hit when
 * they scroll past the field without clicking out first.
 */
import { Children, cloneElement, forwardRef, isValidElement, useId } from 'react';
import type { InputHTMLAttributes, ReactElement, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

const INPUT_BASE =
  'w-full bg-surface-2 text-ink rounded-input border border-border ' +
  'px-[14px] py-2.5 text-sm leading-tight ' +
  'transition shadow-[var(--shadow-inset)] ' +
  'focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 ' +
  'disabled:opacity-50';

/**
 * Host elements that accept a `label[for]` association.
 *
 * Per the HTML spec only `button`, `input`, `meter`, `output`,
 * `progress`, `select` and `textarea` are labelable. A `<div>` is a
 * host element but NOT labelable, so it must not receive the id.
 */
const LABELABLE_HOST_TAGS = new Set([
  'button',
  'input',
  'meter',
  'output',
  'progress',
  'select',
  'textarea',
]);

/**
 * Controls that can carry a `label[for]` association.
 *
 * `Input`, `Select`, `Textarea` and `AmountInput` all forward `id` to
 * a native `<input>` / `<select>` / `<textarea>`, so the label can
 * point at them. A raw host element (`<select>` written inline in a
 * screen) qualifies too — the id lands directly on it.
 *
 * Anything else — `CategoryGrid`, a `div`, a `Button` — is NOT
 * labelable. Wiring `htmlFor` to a non-labelable element is invalid
 * HTML and would point assistive tech at the wrong thing, so those
 * children render untouched.
 *
 * The set is built lazily inside the component body: `Input` is a
 * `forwardRef` object and the others are function components, so the
 * identity check has to happen after module evaluation.
 */
function isLabelable(type: unknown, controls: Set<unknown>): boolean {
  if (typeof type === 'string') return LABELABLE_HOST_TAGS.has(type);
  return controls.has(type);
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: ReactNode;
  children: ReactNode;
}) {
  // Accessibility + testability: wire the label to its control with
  // `htmlFor`/`id` so screen readers announce the field and so
  // `getByLabel('Amount')` resolves in tests. Previously the label had
  // no `htmlFor` and the control had no `id`, which made every form
  // field reachable only by placeholder.
  //
  // React's `useId` emits ids like `:r0:`. Colons are legal in an HTML
  // id but break CSS `#id` selectors, so they're stripped.
  const generatedId = useId();
  const id = `field-${generatedId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  // The first *labelable* child is the control the label points at.
  // Siblings are decorative — e.g. the "Balance: ৳5,000" hint under a
  // `<Select>` in AddTransactionForm — and must still render, so the
  // children are mapped rather than replaced.
  const controls = new Set<unknown>([Input, Select, Textarea, AmountInput]);
  const childArray = Children.toArray(children);
  const controlIndex = childArray.findIndex(
    c => isValidElement(c) && isLabelable(c.type, controls),
  );
  const labelable = controlIndex >= 0;

  // Respect an id the caller already set — only fill in a blank one.
  // `htmlFor` must point at whichever id actually lands on the control.
  const existingId = labelable
    ? ((childArray[controlIndex] as ReactElement).props.id as string | undefined)
    : undefined;
  const controlId = existingId ?? id;

  const rendered = childArray.map((child, i) =>
    i === controlIndex ? cloneElement(child as ReactElement, { id: controlId }) : child,
  );

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={labelable ? controlId : undefined}
        className="text-[11px] text-muted uppercase tracking-[0.08em] font-semibold"
      >
        {label}
      </label>
      {rendered}
      {hint && !error && <div className="text-xs text-muted mt-0.5">{hint}</div>}
      {error && <div className="text-xs text-danger mt-0.5">{error}</div>}
    </div>
  );
}

/** Text input — refined .modal input shape. Forwarded ref so callers
 *  can focus / blur the underlying <input> from outside the component. */
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input(props, ref) {
    const { className, onWheel, type, ...rest } = props;
    const blurOnWheel = type === 'number' && !props.disabled;
    return (
      <input
        {...rest}
        ref={ref}
        type={type}
        onWheel={blurOnWheel ? (e => { (e.target as HTMLInputElement).blur(); onWheel?.(e); }) : onWheel}
        className={[INPUT_BASE, className || ''].join(' ')}
      />
    );
  },
);

/** Large "amount" input — used in add screens (32px font, primary color). */
export function AmountInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className, onWheel, type, ...rest } = props;
  const blurOnWheel = type === 'number' && !props.disabled;
  return (
    <input
      {...rest}
      type={type}
      onWheel={blurOnWheel ? (e => { (e.target as HTMLInputElement).blur(); onWheel?.(e); }) : onWheel}
      className={[
        INPUT_BASE,
        'rounded-btn text-[32px] font-bold tabular text-primary py-3.5',
        'shadow-[var(--shadow-inset)]',
        className || '',
      ].join(' ')}
    />
  );
}

/** Select — same shell as Input, with a custom chevron caret. */
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className, ...rest } = props;
  return (
    <div className="relative">
      <select
        {...rest}
        className={[
          INPUT_BASE,
          'appearance-none pr-9 cursor-pointer',
          className || '',
        ].join(' ')}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted text-xs"
      >
        {'\u25BE'}
      </span>
    </div>
  );
}

/** Textarea — same shell as Input. */
export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className, ...rest } = props;
  return (
    <textarea
      {...rest}
      className={[
        INPUT_BASE,
        'min-h-[88px] py-3 leading-relaxed resize-y',
        className || '',
      ].join(' ')}
    />
  );
}