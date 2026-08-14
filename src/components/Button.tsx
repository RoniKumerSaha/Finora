/**
 * Button — shared button styles.
 *
 * v1 visual target: docs/ux-designs/.../mockups/v1/index.html — pillowy
 * 12px radius buttons, padding 12px 18px, 14px font, weight 700.
 *
 * 2026-08-14 polish: refined sizes (sm / md), a subtle pressed-state
 * translate for tactile feel, and a focus ring that matches the global
 * focus contract.
 *
 * Variants:
 *   - primary:   filled bg-primary, ink-on color
 *   - secondary: surface bg, surface-2 hover, border
 *   - danger:    danger bg, white text
 *   - ghost:     transparent bg, hover surface-2
 *   - icon:      36×36 square with surface bg + border (IconButton)
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md';
  children: ReactNode;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  children,
  className,
  ...rest
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-btn font-bold tracking-tight ' +
    'transition disabled:opacity-50 disabled:cursor-not-allowed ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-0 ' +
    'active:translate-y-px';
  const sizeCls = size === 'sm' ? 'px-3 py-1.5 text-[13px]' : 'px-[18px] py-2.5 text-sm';
  const variantClass = {
    primary:   'bg-primary text-primary-on hover:opacity-95',
    secondary: 'bg-surface text-ink border border-border hover:bg-surface-2',
    danger:    'bg-danger text-white border border-danger hover:opacity-95',
    ghost:     'text-muted hover:text-ink hover:bg-surface-2',
  }[variant];
  return (
    <button
      type="button"
      {...rest}
      className={[base, sizeCls, variantClass, className || ''].join(' ')}
    >
      {children}
    </button>
  );
}

/** Icon-only button — 36×36 square, surface bg, border. */
export function IconButton({ children, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className={[
        'w-9 h-9 rounded-btn bg-surface text-muted border border-border grid place-items-center',
        'hover:bg-surface-2 hover:text-ink transition focus-visible:outline-none',
        'focus-visible:ring-2 focus-visible:ring-primary/40',
        className || '',
      ].join(' ')}
    >
      {children}
    </button>
  );
}