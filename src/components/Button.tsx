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
 * 2026-08-18 polish: a `success` prop fires a one-shot CTA confirm
 * — sage ring pulse + ✓ glyph — for the moment right after a form
 * save. Pair with a 600ms delay before navigation so the pulse lands
 * before the screen unmounts.
 *
 * Variants:
 *   - primary:   filled bg-primary, ink-on color
 *   - secondary: surface bg, surface-2 hover, border
 *   - danger:    danger bg, white text
 *   - ghost:     transparent bg, hover surface-2
 *   - icon:      36×36 square with surface bg + border (IconButton)
 */
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md';
  /**
   * Fires the one-shot sage pulse + ✓ glyph. Used for the moment
   * right after a form save. Pulses for 1.5s; the caller should pair
   * with a brief navigate-delay so users see it.
   */
  success?: boolean;
  /**
   * When `success` is true, the label to swap in (defaults to keeping
   * the original label + prefixing ✓). Override when the action doesn't
   * read naturally with a prefix glyph.
   */
  successLabel?: string;
  children: ReactNode;
}

/**
 * Button — ref is forwarded so parents can imperatively focus the
 * underlying <button> (e.g. ConfirmDialog autofocusing Cancel).
 * 2026-08-31 component-consistency: confirmed.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    children,
    className,
    success,
    successLabel,
    ...rest
  },
  ref,
) {
  const base =
    'relative overflow-visible inline-flex items-center justify-center gap-2 rounded-btn font-bold tracking-tight ' +
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
      ref={ref}
      type="button"
      {...rest}
      className={[base, sizeCls, variantClass, className || ''].join(' ')}
    >
      {success && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-btn"
          style={{
            animation: 'cta-pulse 1.5s ease-out forwards',
            boxShadow: '0 0 0 2px color-mix(in srgb, var(--success) 60%, transparent)',
          }}
        />
      )}
      {success ? (
        <>
          <span aria-hidden className="text-success">{'✓'}</span>
          <span>{successLabel ?? children}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
});

/** Icon-only button — 36×36 square, surface bg, border. */
export const IconButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  function IconButton({ children, className, ...rest }, ref) {
    return (
      <button
        ref={ref}
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
  },
);