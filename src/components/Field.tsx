/**
 * Field — single form field with label + input + error slot.
 *
 * v1 visual target: docs/ux-designs/.../mockups/v1/index.html
 *   - label: 12px muted uppercase tracked
 *   - input:  bg-surface-2, border-border, padding 12px 14px,
 *             radius 14px (r-btn), focus → 2px primary outline
 *   - error:  danger text (inline three-part error formatting is
 *             applied by screens, this is just the slot)
 *
 * Used by every form screen. Pure presentational; validation happens
 * upstream in lib/errors.ts (AD-19).
 */
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

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
      <label className="text-xs text-muted uppercase tracking-wider font-semibold">{label}</label>
      {children}
      {hint && !error && <div className="text-xs text-muted">{hint}</div>}
      {error && <div className="text-xs text-danger">{error}</div>}
    </div>
  );
}

/** Text input — v1 `.modal input` shape. */
export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={[
        'w-full bg-surface-2 border border-border text-ink rounded-btn',
        'px-[14px] py-3 text-sm',
        'focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/40',
        'disabled:opacity-50',
        props.className || '',
      ].join(' ')}
    />
  );
}

/** Large "amount" input — used in add screens (v1 .num-input with 32px font). */
export function AmountInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={[
        'w-full bg-surface-2 border border-border text-primary rounded-btn',
        'px-[14px] py-3.5 text-[32px] font-bold tabular',
        'focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/40',
        props.className || '',
      ].join(' ')}
    />
  );
}

/** Select — v1 `.modal select` shape. */
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={[
        'w-full bg-surface-2 border border-border text-ink rounded-btn',
        'px-[14px] py-3 text-sm',
        'focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/40',
        props.className || '',
      ].join(' ')}
    />
  );
}

/** Textarea — same shell as Input. */
export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={[
        'w-full bg-surface-2 border border-border text-ink rounded-btn min-h-[80px]',
        'px-[14px] py-3 text-sm',
        'focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/40',
        props.className || '',
      ].join(' ')}
    />
  );
}
