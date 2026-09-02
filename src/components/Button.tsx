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
 * 2026-09-01 polish: introduced an outlined family (outlined-primary /
 * outlined-danger / outlined-ghost). These render as thin outlined
 * pills with a transparent background, matching the SaveResetBar
 * toolbar shape used by the Investment Planner and Loan Calculator
 * detail screens. Use these for "Save" / "Delete" / "Cancel" actions
 * on form pages so the same visual language carries through the whole
 * app. Filled variants stay for hero CTAs and confirm dialogs.
 *
 * Variants:
 *   - primary:          filled bg-primary, ink-on color
 *   - secondary:        surface bg, surface-2 hover, border
 *   - danger:           danger bg, white text
 *   - ghost:            transparent bg, hover surface-2
 *   - outlined-primary: outlined pill, primary border + text (Save)
 *   - outlined-danger:  outlined pill, danger border + text (Delete)
 *   - outlined-ghost:   outlined pill, border + muted text (Cancel)
 *   - icon:             36×36 square with surface bg + border (IconButton)
 */
import { forwardRef, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react';
import { Check } from './icons/Icons';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | 'primary'
    | 'secondary'
    | 'danger'
    | 'ghost'
    | 'outlined-primary'
    | 'outlined-danger'
    | 'outlined-ghost';
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
  const isOutlined = variant.startsWith('outlined-');
  const base =
    'relative overflow-visible inline-flex items-center justify-center gap-2 rounded-btn font-bold tracking-tight ' +
    'transition disabled:opacity-50 disabled:cursor-not-allowed ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0 ' +
    'active:translate-y-px';
  const sizeCls = size === 'sm'
    ? (isOutlined ? 'px-2.5 py-1.5 text-[13px]' : 'px-3 py-1.5 text-[13px]')
    : (isOutlined ? 'px-2.5 py-1.5 text-[12.5px]' : 'px-[18px] py-2.5 text-sm');

  // Filled variants. Outlined ones branch below.
  let variantClass: string;
  switch (variant) {
    case 'primary':
      variantClass = 'bg-primary text-primary-on hover:opacity-95 focus-visible:ring-primary/40';
      break;
    case 'secondary':
      variantClass = 'bg-surface text-ink border border-border hover:bg-surface-2 focus-visible:ring-primary/40';
      break;
    case 'danger':
      variantClass = 'bg-danger text-white border border-danger hover:opacity-95 focus-visible:ring-danger/40';
      break;
    case 'ghost':
      variantClass = 'text-muted hover:text-ink hover:bg-surface-2 focus-visible:ring-primary/40';
      break;
    case 'outlined-primary':
      // Hover fills with the soft primary tint so the user sees a
      // clear colour cue when the cursor lands on the Save button.
      variantClass = 'bg-transparent border font-semibold hover:bg-[var(--btn-hover-bg)] focus-visible:ring-primary/40 transition-colors';
      break;
    case 'outlined-danger':
      variantClass = 'bg-transparent border font-semibold hover:bg-[var(--btn-hover-bg)] focus-visible:ring-danger/40 transition-colors';
      break;
    case 'outlined-ghost':
      variantClass = 'bg-transparent border font-semibold hover:bg-[var(--btn-hover-bg)] focus-visible:ring-primary/40 transition-colors';
      break;
    default:
      variantClass = 'bg-surface text-ink border border-border hover:bg-surface-2 focus-visible:ring-primary/40';
  }

  // Outlined variants: explicit color/border from CSS vars, and a
  // --btn-hover-bg custom property so the hover fill is a soft tint
  // of the border colour (the same recipe the rest of the app uses
  // for "primary-soft" / "danger-soft" surfaces). Reads cleanly
  // against any background and gives the user a clear hover cue
  // without the pill feeling filled.
  let outlinedStyle: CSSProperties | undefined;
  if (variant === 'outlined-primary') {
    outlinedStyle = {
      color: 'var(--primary)',
      borderColor: 'var(--primary)',
      // CSS variables used: see src/styles/theme.css — primary-soft
      // is already 30% opacity, exactly what the hover fill needs.
      '--btn-hover-bg': 'var(--primary-soft)',
    } as CSSProperties;
  } else if (variant === 'outlined-danger') {
    outlinedStyle = {
      color: 'var(--danger)',
      borderColor: 'var(--danger)',
      '--btn-hover-bg': 'var(--danger-soft)',
    } as CSSProperties;
  } else if (variant === 'outlined-ghost') {
    outlinedStyle = {
      color: 'var(--muted)',
      borderColor: 'var(--border)',
      // Cancel reads as a quiet neutral action — hover with the
      // muted surface so it doesn't shout.
      '--btn-hover-bg': 'var(--surface-2)',
    } as CSSProperties;
  }

  // Compose the className. Outlined variants get an inline style
  // (for color/border + hover-bg var) and a non-bold font weight
  // so the outlined pair feels visually lighter than the filled CTAs.
  const composed: string[] = [base, sizeCls, variantClass, className || ''];

  return (
    <button
      ref={ref}
      type="button"
      {...rest}
      style={outlinedStyle}
      className={composed.join(' ')}
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
          <span aria-hidden className="text-success inline-flex"><Check className="w-4 h-4" /></span>
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