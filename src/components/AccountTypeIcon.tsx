/**
 * AccountTypeIcon — inline SVG icons keyed to account.type.
 *
 * Why SVG, not Unicode/emoji:
 *   - Inherits color via `currentColor` (theme-aware).
 *   - Renders identically on macOS / Windows / Linux (no OS emoji font
 *     variance).
 *   - Scales crisply at any size.
 *   - Can carry actual visual detail (a bank has columns, a card has
 *     a stripe, a wallet has a phone).
 *
 * The earlier placeholder set (৳ ⌂ ◉ ▭ ◇) was generic and read as
 * "math symbols". This set is rich enough that you can tell two
 * accounts apart at a glance.
 *
 * Visual language:
 *   - 1.5px stroke weight at 24×24 viewBox — keeps lines crisp at the
 *     18px tile size used in list rows without going to mush.
 *   - `stroke-linecap="round" stroke-linejoin="round"` — soft edges
 *     match the rest of the app's pillowy aesthetic.
 *   - Single fill or stroke color, no gradients — reads cleanly at small
 *     sizes and never fights the surface-2 background.
 *
 * The wrapper tile (rounded square, surface-2 background, primary
 * text color) lives with the consumer — the icon itself is just the
 * SVG so it can be embedded anywhere.
 */
import type { AccountType } from '../domain/types';

/**
 * Tile styling per account type. Mirrors the transaction-direction
 * tone system so an "Accounts" row reads with the same visual
 * vocabulary as a "Transactions" row:
 *
 *   income → primary (green)        cash          → accent (gold)
 *   expense → danger (red)          bank          → primary (green)
 *   transfer → accent (gold)        mobile_wallet → info (cool blue)
 *                                    card          → danger (red, "spending")
 *                                    other         → muted (neutral)
 *
 * Each entry returns `{ bg, fg }` classes for the 36px rounded tile
 * that wraps the icon. The icon itself uses `currentColor`, so it
 * inherits `fg` automatically.
 */
export type AccountTone = 'accent' | 'primary' | 'info' | 'danger' | 'muted';

const TONES: Record<AccountType, AccountTone> = {
  cash:          'accent',
  bank:          'primary',
  mobile_wallet: 'info',
  card:          'danger',
  other:         'muted',
};

export function accountTone(type: AccountType | string): AccountTone {
  return TONES[type as AccountType] ?? 'muted';
}

/**
 * Tailwind classes for the small rounded tile that wraps the icon.
 * Returns a single string so consumers can pass it directly.
 */
/**
 * Tile chrome: `bg-*-soft text-*-*` classes only. Use `accountTileStyle`
 * to also overlay a radial highlight that makes the icon square glow.
 */
export function accountTileClass(tone: AccountTone): string {
  switch (tone) {
    case 'accent':  return 'bg-accent-soft text-accent';
    case 'primary': return 'bg-primary-soft text-primary';
    case 'info':    return 'bg-info-soft text-info';
    case 'danger':  return 'bg-danger-soft text-danger';
    default:        return 'bg-surface-2 text-muted';
  }
}

/**
 * Inline style for the icon tile that overlays a soft-tone flat fill
 * with a radial highlight, so the centre of the square "lights up" in
 * the tone colour. Used on card surfaces (Accounts list, Home rows)
 * where the icon is large enough for the glow to read.
 */
export function accountTileStyle(tone: AccountTone): React.CSSProperties {
  const toneVar =
    tone === 'accent'  ? 'var(--accent)' :
    tone === 'primary' ? 'var(--primary)' :
    tone === 'info'    ? 'var(--info)' :
    tone === 'danger'  ? 'var(--danger)' :
                         'var(--muted)';
  // backgroundImage layers on top of backgroundColor set via className,
  // so the soft-tone fill shows through the radial highlight.
  return {
    backgroundImage: `linear-gradient(to bottom, color-mix(in srgb, ${toneVar} 12%, var(--bg)), transparent 70%)`,
  };
}

/**
 * Text-color class for the balance number on an account row. Mirrors
 * `accountTileClass` so the balance picks up the same color family as
 * its icon tile — cash balances read gold, mobile wallets read blue,
 * card balances read red, and so on. Centralized here so the home
 * preview and the accounts list stay in sync.
 */
export function accountBalanceColor(tone: AccountTone): string {
  switch (tone) {
    case 'accent':  return 'text-accent';
    case 'primary': return 'text-primary';
    case 'info':    return 'text-info';
    case 'danger':  return 'text-danger';
    default:        return 'text-ink';
  }
}

interface Props {
  type: AccountType | string;
  className?: string;
}

/**
 * Shared SVG attributes. viewBox 24×24 is the de-facto icon-grid
 * standard; the consumer sizes with `width` / `height` utilities.
 */
const COMMON = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true as const,
};

export function AccountTypeIcon({ type, className = 'w-[18px] h-[18px]' }: Props) {
  switch (type) {
    case 'cash':
      // Wallet with a bill peeking out + a ৳ corner mark.
      // Reads instantly as "physical money".
      return (
        <svg {...COMMON} className={className}>
          <rect x="2.5" y="6" width="19" height="13" rx="2.5" />
          <path d="M2.5 10h19" />
          <circle cx="17" cy="14.5" r="1.4" fill="currentColor" stroke="none" />
          <path d="M5.5 6V4.5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1V6" />
        </svg>
      );

    case 'bank':
      // Classical bank: pediment + 4 columns + base. The strongest
      // "this is a bank" silhouette in 24×24.
      return (
        <svg {...COMMON} className={className}>
          <path d="M3 9.5 12 4l9 5.5" />
          <path d="M4.5 10.5h15" />
          <path d="M5 10.5v8M9.5 10.5v8M14.5 10.5v8M19 10.5v8" />
          <path d="M3.5 19h17" />
          <path d="M3 21h18" />
        </svg>
      );

    case 'mobile_wallet':
      // A phone (rounded rect) with a small card tucked on top-right.
      // Reads as "digital wallet on a phone".
      return (
        <svg {...COMMON} className={className}>
          <rect x="6" y="2.5" width="11" height="19" rx="2.2" />
          <path d="M9.5 5.5h4" />
          <rect x="11" y="11" width="10.5" height="6.5" rx="1.3" />
          <path d="M14.5 14.3h1.6" />
        </svg>
      );

    case 'card':
      // Credit-card front: rounded rect, magnetic stripe, and the chip
      // + number-row. Universally recognizable.
      return (
        <svg {...COMMON} className={className}>
          <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
          <path d="M2.5 9.5h19" />
          <path d="M6 13.5h4" />
          <rect x="14" y="12.5" width="3.5" height="2.6" rx="0.5" fill="currentColor" stroke="none" opacity="0.85" />
        </svg>
      );

    default:
      // "other" — a small dotted grid in a rounded square. Reads as
      // "uncategorized / fallback". Distinct from the card icon.
      return (
        <svg {...COMMON} className={className}>
          <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />
          <circle cx="8" cy="8" r="0.9" fill="currentColor" stroke="none" />
          <circle cx="12" cy="8" r="0.9" fill="currentColor" stroke="none" />
          <circle cx="16" cy="8" r="0.9" fill="currentColor" stroke="none" />
          <circle cx="8" cy="12" r="0.9" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none" />
          <circle cx="16" cy="12" r="0.9" fill="currentColor" stroke="none" />
          <circle cx="8" cy="16" r="0.9" fill="currentColor" stroke="none" />
          <circle cx="12" cy="16" r="0.9" fill="currentColor" stroke="none" />
          <circle cx="16" cy="16" r="0.9" fill="currentColor" stroke="none" />
        </svg>
      );
  }
}

/**
 * Human-readable label for an account type. Centralized so the list
 * page, the home preview, and the add/edit form picker all agree.
 */
export function accountTypeLabel(t: AccountType | string): string {
  switch (t) {
    case 'cash':          return 'Cash';
    case 'bank':          return 'Bank Account';
    case 'mobile_wallet': return 'Mobile Wallet';
    case 'card':          return 'Card';
    default:              return 'Other';
  }
}