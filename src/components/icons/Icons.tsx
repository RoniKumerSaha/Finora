/**
 * Icons — app-wide SVG icon library.
 *
 * Why SVG icons, not Unicode/emoji:
 *   - Inherits color via `currentColor` (theme-aware).
 *   - Renders identically on macOS / Windows / Linux (no OS emoji font
 *     variance).
 *   - Scales crisply at any size.
 *   - Distinct, recognizable silhouettes — Unicode arrows/checks tend
 *     to read as "math symbols" at small sizes.
 *
 * Design system:
 *   - 24×24 viewBox (de-facto icon-grid standard).
 *   - 1.5px stroke, round caps + joins (matches the app's pillowy
 *     aesthetic — see account icons).
 *   - `stroke="currentColor"`, `fill="none"` for outline icons.
 *   - Solid icons (rare, for emphasis) use `fill="currentColor"`.
 *   - No gradients, no multi-color fills.
 *
 * Naming:
 *   - `Nav*` — sidebar nav icons (Home, Insights, Transactions, ...).
 *   - `Ui*` — UI primitives (Menu, Close, Check, ChevronRight, Plus).
 *   - `Arrow*` — directional semantics used in transaction/debt tiles.
 *
 * The `<AccountTypeIcon>` set is a separate file (one icon per
 * AccountType enum value, with a tone helper). This file holds the
 * generic library so screens and primitives can share icons.
 */
import type { SVGProps } from 'react';

/**
 * Shared SVG attributes. Consumers add className / width / height.
 * `aria-hidden` is set by default; consumers that need an accessible
 * label should pass `role="img"` + `<title>` themselves.
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

type IconProps = SVGProps<SVGSVGElement>;

/* ---------------- Nav icons ---------------- */

/** Home — a house with a chimney dot. */
export function NavHome(props: IconProps) {
  return (
    <svg {...COMMON} {...props}>
      <path d="M3.5 10.5 12 4l8.5 6.5" />
      <path d="M5 10v9.5h14V10" />
      <path d="M10 19.5v-5h4v5" />
    </svg>
  );
}

/**
 * Insights — an "eye"-like shape with a small sparkle dot, suggesting
 * analysis + discovery. Reads as "look closer" without literally
 * drawing an eye.
 */
export function NavInsights(props: IconProps) {
  return (
    <svg {...COMMON} {...props}>
      <path d="M12 4.5c4.5 0 8.2 3 9.2 7.5-.9 4.5-4.6 7.5-9.2 7.5S3.7 16.5 2.8 12C3.8 7.5 7.5 4.5 12 4.5z" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M16.5 4l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4L14.5 6l1.4-.6z" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Transactions — two arrows pointing in opposite directions (swap). */
export function NavTransactions(props: IconProps) {
  return (
    <svg {...COMMON} {...props}>
      <path d="M4 8h13" />
      <path d="m14 5 3 3-3 3" />
      <path d="M20 16H7" />
      <path d="m10 13-3 3 3 3" />
    </svg>
  );
}

/** Accounts — three stacked people-figures (account = user/entity). */
export function NavAccounts(props: IconProps) {
  return (
    <svg {...COMMON} {...props}>
      <circle cx="9" cy="9" r="3" />
      <path d="M3 19c.5-3 3-5 6-5s5.5 2 6 5" />
      <circle cx="16.5" cy="8" r="2.2" />
      <path d="M14.5 14.5c2.4-.4 5 .7 6 3" />
    </svg>
  );
}

/**
 * Goals — a star with a dot at the center, suggesting "shooting for
 * something" / aspirational.
 */
export function NavGoals(props: IconProps) {
  return (
    <svg {...COMMON} {...props}>
      <path d="m12 4 2.5 5.2 5.7.8-4.1 4 1 5.6-5.1-2.7-5.1 2.7 1-5.6-4.1-4 5.7-.8z" />
    </svg>
  );
}

/** Investments — a small line chart in a square, suggesting growth. */
export function NavInvestments(props: IconProps) {
  return (
    <svg {...COMMON} {...props}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />
      <path d="M6 16l4-4 3 3 5-6" />
      <path d="m14 9h4v4" />
    </svg>
  );
}

/**
 * Debts — two opposing arrows on a horizontal line. The classic
 * "balance / give-and-take" iconography for IOUs.
 */
export function NavDebts(props: IconProps) {
  return (
    <svg {...COMMON} {...props}>
      <path d="M3.5 12h17" />
      <path d="m7 8-3 4 3 4" />
      <path d="m17 8 3 4-3 4" />
    </svg>
  );
}

/** Settings — a gear with 8 teeth. Iconic, recognizable. */
export function NavSettings(props: IconProps) {
  return (
    <svg {...COMMON} {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 14a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V20a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H4a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H10a1.7 1.7 0 0 0 1-1.5V4a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V10a1.7 1.7 0 0 0 1.5 1H20a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}

/* ---------------- UI primitives ---------------- */

/** Hamburger menu — three horizontal lines. */
export function Menu(props: IconProps) {
  return (
    <svg {...COMMON} {...props}>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </svg>
  );
}

/** Close — an X formed by two crossing lines. */
export function Close(props: IconProps) {
  return (
    <svg {...COMMON} {...props}>
      <path d="m6 6 12 12" />
      <path d="M18 6 6 18" />
    </svg>
  );
}

/** Check — a single checkmark stroke. */
export function Check(props: IconProps) {
  return (
    <svg {...COMMON} {...props}>
      <path d="m5 12 5 5L20 7" />
    </svg>
  );
}

/** Chevron right — a single `>` chevron for row hover affordances. */
export function ChevronRight(props: IconProps) {
  return (
    <svg {...COMMON} {...props}>
      <path d="m9 5 7 7-7 7" />
    </svg>
  );
}

/** Plus — used for "Add" buttons. Solid variant for emphasis. */
export function Plus(props: IconProps) {
  return (
    <svg {...COMMON} {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

/* ---------------- Directional arrows ----------------
   Used as the icon inside the small rounded tile that appears in
   transaction / debt rows. The stroke weight and overall footprint
   match the account-type icons so they read as one family. */

/**
 * ArrowUp — used for "income" tiles and "owed to me" debts. The
 * arrowhead is solid (filled triangle) so it reads as directional
 * even at 18px inside a 36px tile.
 */
export function ArrowUp(props: IconProps) {
  return (
    <svg {...COMMON} {...props}>
      <path d="M12 4v16" />
      <path d="m6 10 6-6 6 6" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

/** ArrowDown — used for "expense" tiles and "i owe" debts. */
export function ArrowDown(props: IconProps) {
  return (
    <svg {...COMMON} {...props}>
      <path d="M12 20V4" />
      <path d="m6 14 6 6 6-6" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * ArrowLeftRight — used for "transfer" tiles. Two parallel arrows
 * pointing in opposite directions; reads as "swap" / "exchange".
 */
export function ArrowLeftRight(props: IconProps) {
  return (
    <svg {...COMMON} {...props}>
      <path d="M3 8h14" />
      <path d="m14 5 3 3-3 3" />
      <path d="M21 16H7" />
      <path d="m10 13-3 3 3 3" />
    </svg>
  );
}

/* ---------------- Category icons ----------------
   Used by InsightsScreen category chips. Each renders inside an 8px
   tile so they should be readable at 16×16. */

/** Food — a fork and knife crossed. */
export function CatFood(props: IconProps) {
  return (
    <svg {...COMMON} {...props}>
      <path d="M7 3v8a2 2 0 0 0 2 2v8" />
      <path d="M9 3v6" />
      <path d="M11 3v6" />
      <path d="M16 3c-1.5 1.5-2 3.5-2 5.5s.5 4 2 5.5V21" />
    </svg>
  );
}

/** Transport — a car silhouette. */
export function CatTransport(props: IconProps) {
  return (
    <svg {...COMMON} {...props}>
      <path d="M3 16v-3l2-6h14l2 6v3" />
      <path d="M3 16h18" />
      <circle cx="7" cy="18" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="17" cy="18" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Shopping — a shopping bag. */
export function CatShopping(props: IconProps) {
  return (
    <svg {...COMMON} {...props}>
      <path d="M5 8h14l-1.2 11a2 2 0 0 1-2 1.7H8.2a2 2 0 0 1-2-1.7z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  );
}

/** Bills — a receipt with zigzag bottom. */
export function CatBills(props: IconProps) {
  return (
    <svg {...COMMON} {...props}>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
      <path d="M9 8h6" />
      <path d="M9 12h6" />
    </svg>
  );
}

/** Salary — a stack of coins. */
export function CatSalary(props: IconProps) {
  return (
    <svg {...COMMON} {...props}>
      <ellipse cx="12" cy="6" rx="7" ry="2.5" />
      <path d="M5 6v6c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6" />
      <path d="M5 12v6c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-6" />
    </svg>
  );
}

/**
 * CategoryFallback — a generic tag/label icon for categories we don't
 * have a custom icon for. Reads as "uncategorized / other".
 */
export function CatFallback(props: IconProps) {
  return (
    <svg {...COMMON} {...props}>
      <path d="M4 12V5a1 1 0 0 1 1-1h7l8 8-8 8-8-8z" />
      <circle cx="8.5" cy="8.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}