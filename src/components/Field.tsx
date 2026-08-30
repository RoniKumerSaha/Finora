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
import { forwardRef } from 'react';
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

const INPUT_BASE =
  'w-full bg-surface-2 text-ink rounded-input border border-border ' +
  'px-[14px] py-2.5 text-sm leading-tight ' +
  'transition shadow-[var(--shadow-inset)] ' +
  'focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 ' +
  'disabled:opacity-50';

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
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] text-muted uppercase tracking-[0.08em] font-semibold">
        {label}
      </label>
      {children}
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