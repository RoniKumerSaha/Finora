/**
 * Field — single form field with label + input + error slot.
 *
 * Used by the screens' forms. The error slot is the AD-11 inline three-part
 * surface; this component renders the wrapper but the three-part error formatting
 * lives in lib/errors.ts (AD-19).
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
    <div className="flex flex-col gap-1">
      <label className="text-xs text-muted uppercase tracking-wide">{label}</label>
      {children}
      {hint && !error && <div className="text-xs text-muted-2">{hint}</div>}
      {error && <div className="text-xs text-danger">{error}</div>}
    </div>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={[
        'bg-surface-2 border border-border rounded-md px-3 py-2 text-sm',
        'focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary',
        'disabled:opacity-50',
        props.className || '',
      ].join(' ')}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={[
        'bg-surface-2 border border-border rounded-md px-3 py-2 text-sm',
        'focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary',
        props.className || '',
      ].join(' ')}
    />
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={[
        'bg-surface-2 border border-border rounded-md px-3 py-2 text-sm min-h-[80px]',
        'focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary',
        props.className || '',
      ].join(' ')}
    />
  );
}