/**
 * Button — shared button styles.
 *
 * Three variants: primary, secondary, danger. All buttons share the same
 * padding / radius / text-size so screen layouts stay consistent.
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  children: ReactNode;
}

export function Button({ variant = 'secondary', children, className, ...rest }: ButtonProps) {
  const base = 'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed';
  const variantClass = {
    primary:   'bg-primary text-primary-on hover:opacity-90',
    secondary: 'bg-surface-2 text-ink border border-border hover:bg-surface-3',
    danger:    'bg-danger-soft text-danger border border-danger hover:opacity-80',
    ghost:     'text-muted hover:text-ink hover:bg-surface-2',
  }[variant];
  return <button type="button" {...rest} className={[base, variantClass, className || ''].join(' ')}>{children}</button>;
}