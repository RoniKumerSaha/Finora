/**
 * AccountTypeIcon — solid pictograms keyed to account.type.
 *
 * Why SVG, not Unicode/emoji:
 *   - Inherits color via `currentColor` (theme-aware).
 *   - Renders identically on macOS / Windows / Linux.
 *   - Scales crisply at any size.
 *
 * Design system (Direction C — Solid pictograms):
 *   - 24×24 viewBox, single fill (currentColor), no strokes.
 *   - Soft rounded shapes — Material Symbols vibe, friendly at any
 *     size.
 *
 * Tile styling per account type — the wrapper tile picks up the tone
 * color, the pictogram stays in primary ink (uses `currentColor`):
 *
 *   cash          → accent (gold)
 *   bank          → primary (sage)
 *   mobile_wallet → info (cool blue)
 *   card          → danger (red, "spending")
 *   other         → muted (neutral)
 *
 * Each tone helper returns Tailwind classes for the 40×40 tile that
 * wraps the icon. The icon itself uses `currentColor`, so it
 * inherits the tile's text color automatically.
 */
import type { AccountType } from '../domain/types';

/* ---------------- Tone helpers ---------------- */

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
 * Tailwind classes for the 40×40 rounded tile that wraps the icon.
 * Returns a single string so consumers can pass it directly.
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
  return {
    backgroundImage: `linear-gradient(to bottom, color-mix(in srgb, ${toneVar} 12%, var(--bg)), transparent 70%)`,
  };
}

/**
 * Text-color class for the balance number on an account row.
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

/* ---------------- Solid pictogram helper (Direction C) ---------------- */

const SOLID_COMMON = {
  viewBox: '0 0 24 24',
  fill: 'currentColor',
  'aria-hidden': true as const,
};

function Solid({ children, className }: { children: React.ReactNode } & React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...SOLID_COMMON} className={className}>
      {children}
    </svg>
  );
}

/* ---------------- Account type icons ---------------- */

interface Props {
  type: AccountType | string;
  className?: string;
}

export function AccountTypeIcon({ type, className = 'w-[24px] h-[24px]' }: Props) {
  switch (type) {
    case 'cash':
      // Wallet body + a clasp dot. Reads instantly as "physical money".
      return (
        <Solid className={className}>
          <path d="M5 6h13a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3zm-.5 4.5h14a.5.5 0 0 0 0-1h-14a.5.5 0 0 0 0 1zM14 12.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM7 6V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v1H7z" />
        </Solid>
      );

    case 'bank':
      // Classical bank: pediment + 4 columns + base.
      return (
        <Solid className={className}>
          <path d="M11.2 2.4a1 1 0 0 1 1.6 0l8.5 6.4a1 1 0 0 1-.6 1.7H3.3a1 1 0 0 1-.6-1.7l8.5-6.4zM4.5 12a1 1 0 1 1 2 0v6h-2v-6zm4.5 0a1 1 0 1 1 2 0v6H9v-6zm4.5 0a1 1 0 1 1 2 0v6h-2v-6zm4.5 0a1 1 0 1 1 2 0v6h-2v-6zM3 19a1 1 0 1 0 0 2h18a1 1 0 1 0 0-2H3zm-1 3a1 1 0 1 0 0 2h20a1 1 0 1 0 0-2H2z" />
        </Solid>
      );

    case 'mobile_wallet':
      // A phone (rounded rect) with a small card tucked on top-right.
      return (
        <Solid className={className}>
          <path d="M8 3a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H8zm0 2h6v.5a.5.5 0 0 1-.5.5h-5a.5.5 0 0 1-.5-.5V5zm0 5h6a.5.5 0 0 1 .5.5V13a3 3 0 0 1-3 3H8a.5.5 0 0 1-.5-.5V10.5a.5.5 0 0 1 .5-.5z" />
          <path d="M14 11.5a1.5 1.5 0 0 0 0 3h5a1.5 1.5 0 0 0 0-3h-5zm1 1.5a.5.5 0 1 1 0 1 .5.5 0 0 1 0-1z" />
        </Solid>
      );

    case 'card':
      // Credit-card front: rounded rect, magnetic stripe, chip, number row.
      return (
        <Solid className={className}>
          <path d="M4 7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7zm0 2.5h18v-1.5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v1.5z" />
          <path d="M7 13.5a1 1 0 0 1 1-1h2a1 1 0 1 1 0 2H8a1 1 0 0 1-1-1zm6 0a1 1 0 0 1 1-1h3a1 1 0 1 1 0 2h-3a1 1 0 0 1-1-1zM6.5 17a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0zm5 0a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0z" />
        </Solid>
      );

    default:
      // "other" — a 3×3 dot grid in a rounded square. Reads as
      // "uncategorized / fallback".
      return (
        <Solid className={className}>
          <path d="M5 4a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H5z" />
          <circle cx="8" cy="8" r="1.4" fill="#fff" />
          <circle cx="12" cy="8" r="1.4" fill="#fff" />
          <circle cx="16" cy="8" r="1.4" fill="#fff" />
          <circle cx="8" cy="12" r="1.4" fill="#fff" />
          <circle cx="12" cy="12" r="1.4" fill="#fff" />
          <circle cx="16" cy="12" r="1.4" fill="#fff" />
          <circle cx="8" cy="16" r="1.4" fill="#fff" />
          <circle cx="12" cy="16" r="1.4" fill="#fff" />
          <circle cx="16" cy="16" r="1.4" fill="#fff" />
        </Solid>
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
