/**
 * Button — shared button styles.
 *
 * v1 visual target: docs/ux-designs/.../mockups/v1/index.html — pillowy
 * 14px radius buttons, padding 12px 18px, 14px font, weight 700.
 *
 * Three primary variants:
 *   - primary: filled bg-primary, ink-on color
 *   - secondary (ghost): surface bg, surface-2 hover
 *   - danger: danger-soft bg, danger border
 *   - icon: square 36×36 with surface bg + border
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  children: ReactNode;
}

export function Button({ variant = 'secondary', children, className, ...rest }: ButtonProps) {
  const base = 'inline-flex items-center justify-center gap-2 px-[18px] py-3 rounded-btn font-bold text-sm transition disabled:opacity-50 disabled:cursor-not-allowed';
  const variantClass = {
    primary:   'bg-primary text-primary-on hover:opacity-90',
    secondary: 'bg-surface text-ink border border-border hover:bg-surface-2',
    danger:    'bg-danger-soft text-danger border border-danger hover:opacity-80',
    ghost:     'text-muted hover:text-ink hover:bg-surface-2',
  }[variant];
  return <button type="button" {...rest} className={[base, variantClass, className || ''].join(' ')}>{children}</button>;
}

/** Icon-only button — v1 .icon-btn: 36×36 square, surface bg, border. */
export function IconButton({ children, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className={[
        'w-9 h-9 rounded-lg bg-surface border border-border grid place-items-center',
        'hover:bg-surface-2 transition',
        className || '',
      ].join(' ')}
    >
      {children}
    </button>
  );
}
