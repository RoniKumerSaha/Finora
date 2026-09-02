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
 * Design system (Direction C — Solid pictograms):
 *
 *   Nav icons (`Nav*`) — kept in stroke style. The sidebar rail
 *   reads them at 18–22 px and a flat outline is the most legible.
 *   They render at 24×24, 1.5 px stroke, currentColor.
 *
 *   Everything else (`Ui*`, `Arrow*`, `Cat*`) — Direction C solid
 *   pictograms: 24×24 viewBox, single fill (currentColor), no
 *   strokes, soft rounded shapes. Material Symbols vibe — the
 *   silhouette carries the meaning at any size.
 *
 *   The standard tile wrapper (40×40, rounded, surface-2 bg, primary
 *   text) lives in `ICON_TILE_CLASS`. Use `<IconTile>` to wrap an
 *   icon, or apply the class directly.
 *
 * Naming:
 *   - `Nav*` — sidebar nav icons (Home, Insights, Transactions, ...).
 *   - `Ui*` — UI primitives (Menu, Close, Check, ChevronRight, Plus).
 *   - `Arrow*` — directional semantics used in transaction/debt tiles.
 *
 * The `<AccountTypeIcon>` set is a separate file (one icon per
 * AccountType enum value, with a tone helper). The category glyphs
 * (`<CategoryGlyph>`) live in `categoryGlyphs.tsx` — they're keyed by
 * the category name / alias rather than enum value, since categories
 * are open-ended (user-created).
 */
import type { SVGProps } from 'react';

/* ---------------- Nav icons — kept in original stroke style ----------------
   These render at 24×24, 1.5 px stroke, currentColor. The sidebar nav
   row provides its own surface. */

const NAV_COMMON = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true as const,
};

type IconProps = SVGProps<SVGSVGElement>;

/** Home — a house with a chimney dot. */
export function NavHome(props: IconProps) {
  return (
    <svg {...NAV_COMMON} {...props}>
      <path d="M3.5 10.5 12 4l8.5 6.5" />
      <path d="M5 10v9.5h14V10" />
      <path d="M10 19.5v-5h4v5" />
    </svg>
  );
}

/**
 * Insights — an "eye"-like shape with a small sparkle dot, suggesting
 * analysis + discovery.
 */
export function NavInsights(props: IconProps) {
  return (
    <svg {...NAV_COMMON} {...props}>
      <path d="M12 4.5c4.5 0 8.2 3 9.2 7.5-.9 4.5-4.6 7.5-9.2 7.5S3.7 16.5 2.8 12C3.8 7.5 7.5 4.5 12 4.5z" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M16.5 4l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4L14.5 6l1.4-.6z" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Transactions — two arrows pointing in opposite directions (swap). */
export function NavTransactions(props: IconProps) {
  return (
    <svg {...NAV_COMMON} {...props}>
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
    <svg {...NAV_COMMON} {...props}>
      <circle cx="9" cy="9" r="3" />
      <path d="M3 19c.5-3 3-5 6-5s5.5 2 6 5" />
      <circle cx="16.5" cy="8" r="2.2" />
      <path d="M14.5 14.5c2.4-.4 5 .7 6 3" />
    </svg>
  );
}

/** Goals — a star outline. */
export function NavGoals(props: IconProps) {
  return (
    <svg {...NAV_COMMON} {...props}>
      <path d="m12 4 2.5 5.2 5.7.8-4.1 4 1 5.6-5.1-2.7-5.1 2.7 1-5.6-4.1-4 5.7-.8z" />
    </svg>
  );
}

/** Investments — a small line chart in a square, suggesting growth. */
export function NavInvestments(props: IconProps) {
  return (
    <svg {...NAV_COMMON} {...props}>
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
    <svg {...NAV_COMMON} {...props}>
      <path d="M3.5 12h17" />
      <path d="m7 8-3 4 3 4" />
      <path d="m17 8 3 4-3 4" />
    </svg>
  );
}

/**
 * Plan — a calendar with a small check inside the day, suggesting
 * "planning what you'll do / spend".
 */
export function NavPlan(props: IconProps) {
  return (
    <svg {...NAV_COMMON} {...props}>
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 9.5h17" />
      <path d="M8 3.5v3" />
      <path d="M16 3.5v3" />
      <path d="m8.5 14.5 2 2 4-4" />
    </svg>
  );
}

/** Settings — a gear with 8 teeth. */
export function NavSettings(props: IconProps) {
  return (
    <svg {...NAV_COMMON} {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 14a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V20a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H4a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H10a1.7 1.7 0 0 0 1-1.5V4a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V10a1.7 1.7 0 0 0 1.5 1H20a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}

/* ---------------- Direction C — Solid pictogram helper ---------------- */

/**
 * 24×24 frame, single fill (currentColor), no strokes. Material-Symbols
 * vibe — the silhouette carries the meaning at any size. The shapes
 * lean on soft rounded corners (rx/ry on rects, smooth path curves)
 * so they read as friendly, not technical.
 */
const SOLID_COMMON = {
  viewBox: '0 0 24 24',
  fill: 'currentColor',
  'aria-hidden': true as const,
};

function Solid({ children, ...props }: { children: React.ReactNode } & IconProps) {
  return (
    <svg {...SOLID_COMMON} {...props}>
      {children}
    </svg>
  );
}

/* ---------------- UI primitives ---------------- */

/** Clock — circle face with two soft "hands" (rectangles). */
export function Clock(props: IconProps) {
  return (
    <Solid {...props}>
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16z" />
      <path d="M11 6.5a1 1 0 0 1 2 0V12l3.7 2.2a1 1 0 1 1-1 1.7l-4.2-2.5a1 1 0 0 1-.5-.9V6.5z" />
    </Solid>
  );
}

/** Hamburger menu — three rounded pills. */
export function Menu(props: IconProps) {
  return (
    <Solid {...props}>
      <rect x="3" y="5.5" width="18" height="2.5" rx="1.25" />
      <rect x="3" y="10.75" width="18" height="2.5" rx="1.25" />
      <rect x="3" y="16" width="18" height="2.5" rx="1.25" />
    </Solid>
  );
}

/** Close — an X formed by two crossing rounded pills. */
export function Close(props: IconProps) {
  return (
    <Solid {...props}>
      <path d="M5.3 4.3a1 1 0 0 1 1.4 0L12 9.6l5.3-5.3a1 1 0 1 1 1.4 1.4L13.4 11l5.3 5.3a1 1 0 1 1-1.4 1.4L12 12.4l-5.3 5.3a1 1 0 1 1-1.4-1.4L10.6 11 5.3 5.7a1 1 0 0 1 0-1.4z" />
    </Solid>
  );
}

/** Check — a fat checkmark. */
export function Check(props: IconProps) {
  return (
    <Solid {...props}>
      <path d="M20.3 5.7a1.5 1.5 0 0 1 0 2.1l-10 10a1.5 1.5 0 0 1-2.1 0l-4.5-4.5a1.5 1.5 0 1 1 2.1-2.1l3.4 3.5 9-9a1.5 1.5 0 0 1 2.1 0z" />
    </Solid>
  );
}

/** Chevron right — a fat `>` chevron for row hover affordances. */
export function ChevronRight(props: IconProps) {
  return (
    <Solid {...props}>
      <path d="M9 5.6a1.5 1.5 0 0 1 2.1 0l5.5 5.5a1.5 1.5 0 0 1 0 2.1l-5.5 5.5a1.5 1.5 0 1 1-2.1-2.1L13.4 12 9 7.7a1.5 1.5 0 0 1 0-2.1z" />
    </Solid>
  );
}

/** Plus — used for "Add" buttons. */
export function Plus(props: IconProps) {
  return (
    <Solid {...props}>
      <path d="M11 4.5a1 1 0 0 1 2 0V11h6.5a1 1 0 1 1 0 2H13v6.5a1 1 0 1 1-2 0V13H4.5a1 1 0 1 1 0-2H11V4.5z" />
    </Solid>
  );
}

/**
 * Bank — a classical bank facade (pediment + columns + base).
 * Used as the loan tile pictogram (in a red tile on the loan
 * surfaces) and anywhere "money held by a bank" needs to read
 * distinctly from generic "investments".
 */
export function Bank(props: IconProps) {
  return (
    <Solid {...props}>
      <path d="M12 2.5a1 1 0 0 1 .5.1l9 4a1 1 0 0 1-.5 1.9H3a1 1 0 0 1-.5-1.9l9-4a1 1 0 0 1 .5-.1z" />
      <rect x="4" y="9.5" width="2.4" height="8.5" rx=".4" />
      <rect x="8.2" y="9.5" width="2.4" height="8.5" rx=".4" />
      <rect x="13.4" y="9.5" width="2.4" height="8.5" rx=".4" />
      <rect x="17.6" y="9.5" width="2.4" height="8.5" rx=".4" />
      <rect x="2.5" y="19" width="19" height="2" rx=".6" />
    </Solid>
  );
}

/* ---------------- Directional arrows ---------------- */

/**
 * ArrowUp — used for "income" tiles and "owed to me" debts.
 * Solid triangle head + thick rectangular shaft.
 */
export function ArrowUp(props: IconProps) {
  return (
    <Solid {...props}>
      <path d="M11.3 3.3a1 1 0 0 1 1.4 0l7 7a1 1 0 1 1-1.4 1.4L13 6.4V20a1 1 0 1 1-2 0V6.4L5.7 11.7a1 1 0 1 1-1.4-1.4l7-7z" />
    </Solid>
  );
}

/** ArrowDown — used for "expense" tiles and "i owe" loan debts. */
export function ArrowDown(props: IconProps) {
  return (
    <Solid {...props}>
      <path d="M12.7 20.7a1 1 0 0 1-1.4 0l-7-7a1 1 0 1 1 1.4-1.4L11 17.6V4a1 1 0 1 1 2 0v13.6l5.3-5.3a1 1 0 1 1 1.4 1.4l-7 7z" />
    </Solid>
  );
}

/**
 * Warn — a triangular warning sign with an exclamation mark inside.
 * Used in danger / soft-danger banners (overdue categories, etc.).
 */
export function Warn(props: IconProps) {
  return (
    <Solid {...props}>
      <path d="M12 2.6a2 2 0 0 1 1.7 1L22.6 19A2 2 0 0 1 20.9 22H3.1a2 2 0 0 1-1.7-3l8.9-15.4a2 2 0 0 1 1.7-1zm0 6.4a1 1 0 0 0-1 1v4a1 1 0 1 0 2 0v-4a1 1 0 0 0-1-1zm0 8a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4z" />
    </Solid>
  );
}

/** User — a single person silhouette (head + shoulders). */
export function User(props: IconProps) {
  return (
    <Solid {...props}>
      <circle cx="12" cy="8" r="4.2" />
      <path d="M4 20.5a8 8 0 0 1 16 0 .5.5 0 0 1-.5.5h-15a.5.5 0 0 1-.5-.5z" />
    </Solid>
  );
}

/** ArrowLeftRight — used for "transfer" tiles. */
export function ArrowLeftRight(props: IconProps) {
  return (
    <Solid {...props}>
      <path d="M3 7.5a1 1 0 0 1 1-1h12.6l-2.3-2.3a1 1 0 1 1 1.4-1.4l4 4a1 1 0 0 1 0 1.4l-4 4a1 1 0 1 1-1.4-1.4l2.3-2.3H4a1 1 0 0 1-1-1zm18 9a1 1 0 0 1-1 1H7.4l2.3 2.3a1 1 0 1 1-1.4 1.4l-4-4a1 1 0 0 1 0-1.4l4-4a1 1 0 1 1 1.4 1.4L7.4 15.5H20a1 1 0 0 1 1 1z" />
    </Solid>
  );
}

/* ---------------- Category icons (small set used by Insights chips) ----------------
   The full set of category pictograms lives in `categoryGlyphs.tsx`.
   These few are the ones rendered inside the Insights chips. */

/** Food — fork + knife merged into a single soft shape. */
export function CatFood(props: IconProps) {
  return (
    <Solid {...props}>
      <path d="M7 2.5a1.2 1.2 0 0 1 2.4 0V8a1.2 1.2 0 0 0 2.4 0V2.5a1.2 1.2 0 0 1 2.4 0V8a3.6 3.6 0 0 1-2.4 3.4V21a1.2 1.2 0 1 1-2.4 0v-9.6A3.6 3.6 0 0 1 7 8V2.5z" />
      <path d="M16 3a2 2 0 0 1 4 0v5a3 3 0 0 1-2 2.8V21a1 1 0 1 1-2 0V3z" />
    </Solid>
  );
}

/** Transport — a car silhouette (rounded body + wheels). */
export function CatTransport(props: IconProps) {
  return (
    <Solid {...props}>
      <path d="M3 14.5l1.6-5.4A2.5 2.5 0 0 1 7 7.3h10a2.5 2.5 0 0 1 2.4 1.8l1.6 5.4a1 1 0 0 1 .1.4v3a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1V17H6.5v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 .1-.4z" />
      <circle cx="7" cy="18" r="1.6" fill="#fff" />
      <circle cx="17" cy="18" r="1.6" fill="#fff" />
    </Solid>
  );
}

/** Shopping — a shopping bag with two handles. */
export function CatShopping(props: IconProps) {
  return (
    <Solid {...props}>
      <path d="M5 7.5h14l-1.2 11.6a2.5 2.5 0 0 1-2.5 2.2H8.7a2.5 2.5 0 0 1-2.5-2.2L5 7.5zm4 0a3 3 0 1 1 6 0v.5h-1.5v-.5a1.5 1.5 0 0 0-3 0v.5H9v-.5z" />
    </Solid>
  );
}

/** Bills — a receipt with zigzag bottom. */
export function CatBills(props: IconProps) {
  return (
    <Solid {...props}>
      <path d="M5.5 2.5h13a1 1 0 0 1 1 1V22l-3-2-3 2-3-2-3 2-2-2V3.5a1 1 0 0 1 1-1zM8 7a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2H8zm0 4a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2H8z" />
    </Solid>
  );
}

/** Salary — a stack of three coins (ellipses). */
export function CatSalary(props: IconProps) {
  return (
    <Solid {...props}>
      <ellipse cx="12" cy="6" rx="7" ry="2.4" />
      <path d="M5 6v6c0 1.3 3.1 2.4 7 2.4s7-1.1 7-2.4V6c0 1.3-3.1 2.4-7 2.4S5 7.3 5 6z" />
      <path d="M5 12v6c0 1.3 3.1 2.4 7 2.4s7-1.1 7-2.4v-6c0 1.3-3.1 2.4-7 2.4S5 13.3 5 12z" />
    </Solid>
  );
}

/** CategoryFallback — a generic tag/label icon. */
export function CatFallback(props: IconProps) {
  return (
    <Solid {...props}>
      <path d="M3.4 11.2 11 3.5a1 1 0 0 1 .7-.3h6.5a1 1 0 0 1 1 1v6.5a1 1 0 0 1-.3.7l-7.6 7.6a1.5 1.5 0 0 1-2.1 0L3.4 13.3a1.5 1.5 0 0 1 0-2.1z" />
      <circle cx="8" cy="8" r="1.4" fill="#fff" />
    </Solid>
  );
}

/* ---------------- Tile wrapper ---------------- */

/**
 * The canonical icon tile — the 40×40 rounded square used everywhere
 * a UI / arrow / category icon needs a surface.
 *
 *   `w-10 h-10 rounded-input flex items-center justify-center shrink-0 bg-surface-2 text-muted`
 *
 * The wrapper itself is **uniformly neutral** (surface-2 bg, muted
 * text). When the *icon* needs a type-driven colour (cash → accent,
 * bank → primary, mobile_wallet → info, card → danger, income →
 * primary, expense → danger, transfer → info, etc.), wrap the icon
 * itself in the matching `text-*` class rather than tinting the
 * wrapper. This keeps the wrapper chrome consistent across the app.
 *
 * Two intentional exceptions: `InvestTile` (success-tinted) and
 * `LoanTile` (danger-tinted) in `components/InvestLoanTile.tsx` —
 * those are brand-identity markers for the investment/loan surfaces
 * and stay colored by design.
 */
export const ICON_TILE_CLASS =
  'w-10 h-10 rounded-input flex items-center justify-center shrink-0 bg-surface-2 text-muted';

/**
 * <IconTile /> — wraps an icon (or any children) in the standard
 * 40×40 surface tile. Use with any icon component from this file or
 * from `categoryGlyphs.tsx`.
 *
 * Example: `<IconTile><Plus /></IconTile>`
 */
export function IconTile({
  children,
  className = '',
  ...rest
}: { children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`${ICON_TILE_CLASS} ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
}
