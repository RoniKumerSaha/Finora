/**
 * categoryGlyphs — solid pictograms for the ~70 categories Finora
 * ships (rent, groceries, LPG, transport, puja, EMI, …). One
 * component per category so the picker, the preset budget cards, the
 * event planner kits, and the Add Transaction category tiles all
 * render the same SVG glyph.
 *
 * Why bespoke SVG, not Unicode/emoji:
 *   - Identical on macOS / Windows / Linux / Android.
 *   - Single fill via currentColor — theme-aware everywhere; the
 *     sage / gold / danger palette stays consistent.
 *   - Reads at every size from 14 px to 36 px.
 *   - Each glyph can be tuned to mean *exactly* the Bangladesh-first
 *     concept (rickshaw ≠ car, LPG ≠ gas stove, mishti ≠ donut, …).
 *
 * Design system (Direction C — solid pictograms):
 *   - 24×24 viewBox containing a single-color filled shape (soft, friendly
 *     silhouettes). No strokes, no duotone background. Single visual
 *     vocabulary across the app.
 *
 * Naming convention: each glyph is keyed by its primary label
 * (lowercase, kebab-case). Consumers call `<CategoryGlyph name="rent" />`
 * and the component looks up the right SVG.
 *
 * Unicode emoji passthrough: as of the 2026-09 revert, the data field
 * `PlanCategory.emoji` (and `Category.emoji`) stores a literal unicode
 * grapheme cluster (e.g. `'🏠'`), not a glyph key. When passed such a
 * string, `<CategoryGlyph>` renders the emoji as text instead of
 * forcing a SVG lookup — same call-site, just smarter rendering.
 * Unknown kebab-case strings still fall back to the generic tag.
 */
import type { SVGProps } from 'react';

/* ---------------- Shared solid helpers -------- */

function Solid({ children, ...props }: { children: React.ReactNode } & SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      {children}
    </svg>
  );
}

type GlyphProps = SVGProps<SVGSVGElement>;
type GlyphComponent = (props: GlyphProps) => JSX.Element;

/* ── Essentials ──────────────────────────────────────────────── */

function Rent(_p: GlyphProps) {
  return (
    <Solid>
      {/* House silhouette */}
      <path d="M3 11 12 4l9 7v10H3zM10 20v-6h4v6z" />
    </Solid>
  );
}
function ServiceCharge(_p: GlyphProps) {
  return (
    <Solid>
      {/* Office building with grid windows */}
      <path d="M5 3h14v18h-4v-4h-6v4H5zM7 7h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2zM7 11h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2zM7 15h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2z" />
    </Solid>
  );
}
function Groceries(_p: GlyphProps) {
  return (
    <Solid>
      {/* Shopping bag */}
      <path d="M5 8h14l-1.2 11a2 2 0 0 1-2 1.7H8.2a2 2 0 0 1-2-1.7zM9 8V6a3 3 0 0 1 6 0v2z" />
    </Solid>
  );
}
function Utilities(_p: GlyphProps) {
  return (
    <Solid>
      {/* Plug with two prongs */}
      <path d="M9 4h6v4a3 3 0 0 1-6 0zM9 8H5v3a4 4 0 0 0 3 3.9V21h2v-6.1A4 4 0 0 0 13 11V8zM15 8h4v3a4 4 0 0 1-3 3.9V21h-2v-6.1A4 4 0 0 0 17 11z" />
    </Solid>
  );
}
function Lpg(_p: GlyphProps) {
  return (
    <Solid>
      {/* Gas cylinder */}
      <path d="M6 5h12v14H6zM10 5V3h4v2zM9 10v4h2v-4zM13 10v4h2v-4z" />
    </Solid>
  );
}
function Wifi(_p: GlyphProps) {
  return (
    <Solid>
      {/* Wifi arcs + dot */}
      <path d="M12 5C7.5 5 3.5 6.8.7 9.7l2 2A11 11 0 0 1 12 8.4c3.6 0 6.8 1.4 9.3 3.3l2-2C20.5 6.8 16.5 5 12 5zM12 11c-3 0-5.7 1.2-7.7 3.1l2 2A7.7 7.7 0 0 1 12 14.4c2.5 0 4.7.9 6.4 2.4l2-2A11.4 11.4 0 0 0 12 11z" />
      <circle cx="12" cy="18.5" r="2" />
    </Solid>
  );
}

/* ── Food & dining ───────────────────────────────────────────── */

function Food(_p: GlyphProps) {
  return (
    <Solid>
      {/* Fork + spoon */}
      <path d="M7 3v8a2 2 0 0 0 2 2v8H7v-8a2 2 0 0 0 2-2V3H7zm2 0v6h2V3H9zm2 0v6h2V3h-2zm5 0c-1.5 1.5-2 3.5-2 5.5s.5 4 2 5.5V21h2V3h-2z" />
    </Solid>
  );
}
function Cafe(_p: GlyphProps) {
  return (
    <Solid>
      {/* Coffee mug with steam */}
      <path d="M4 5h12v10a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zM16 7h2a3 3 0 0 1 0 6h-2zM7 1c-.5 1 .3 1.5.3 2.5S6.5 5 7 6M11 1c-.5 1 .3 1.5.3 2.5S10.5 5 11 6" />
    </Solid>
  );
}
function Vegetables(_p: GlyphProps) {
  return (
    <Solid>
      {/* Leafy veggie */}
      <path d="M5 19c0-6 4-11 11-12-1 7-5 11-11 12zM19 7c-2 0-3.5.5-5 1.5 1-3 4-5 7-5.5-1 3-2 5-2 4zM5 19h12v2H5z" />
    </Solid>
  );
}
function Bakery(_p: GlyphProps) {
  return (
    <Solid>
      {/* Loaf of bread */}
      <path d="M4 13c0-4 3-7 8-7s8 3 8 7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM5 16h14v3a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z" />
    </Solid>
  );
}
function MeatFish(_p: GlyphProps) {
  return (
    <Solid>
      {/* Fish silhouette with eye */}
      <path d="M3 12c3-5 8-7 13-5l5-3-3 5c2 5 0 10-5 13l-3 5-2-5c-5-1-7-5-5-10z" />
      <circle cx="8" cy="13" r="1.5" />
    </Solid>
  );
}
function Fruits(_p: GlyphProps) {
  return (
    <Solid>
      {/* Two cherries with stems */}
      <circle cx="9" cy="14" r="4" />
      <circle cx="15" cy="14" r="4" />
      <path d="M9 4c1 0 2 .5 2 2 0 1-.5 2-1 2v3h-1V8c-.5 0-1-1-1-2 0-1.5 1-2 1-2zM15 4c1 0 2 .5 2 2 0 1-.5 2-1 2v3h-1V8c-.5 0-1-1-1-2 0-1.5 1-2 1-2z" />
    </Solid>
  );
}
function Dairy(_p: GlyphProps) {
  return (
    <Solid>
      {/* Milk carton */}
      <path d="M9 2h6v3l1 1v15a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V6l1-1zM10 7h4v2h-4z" />
    </Solid>
  );
}
function Lunch(_p: GlyphProps) {
  return (
    <Solid>
      {/* Lunchbox */}
      <path d="M3 8h18v12H3zM5 3h14v2H5zM10 12v6h2v-6z" />
    </Solid>
  );
}
function Healthy(_p: GlyphProps) {
  return (
    <Solid>
      {/* Heart-leaf */}
      <path d="M12 4c-1-1.5-3-2-5-2 0 3 1 5 3 6-2 1-4 4-4 7 0 4 3 7 6 7 1.5 0 3-.7 4-2 1 1.3 2.5 2 4 2 3 0 6-3 6-7 0-3-2-6-4-7 2-1 3-3 3-6-2 0-4 .5-5 2-1-1.5-3-2-5-2 0 3 1 5 3 6-1 .5-1 1-1 1z" />
    </Solid>
  );
}
function DiningOut(_p: GlyphProps) {
  return (
    <Solid>
      {/* Plate with utensils */}
      <path d="M12 3a8 8 0 0 0-8 8h6V3zM12 3v8h6a8 8 0 0 0-6-8zM3 13h18v2H3z" />
      <circle cx="7" cy="17" r="2" />
      <circle cx="17" cy="17" r="2" />
    </Solid>
  );
}

/* ── Transport ──────────────────────────────────────────────── */

function Transport(_p: GlyphProps) {
  return (
    <Solid>
      {/* Car */}
      <path d="M3 16v-3l2-6h14l2 6v3H3zM3 16h18z" />
      <circle cx="7" cy="18" r="1.5" />
      <circle cx="17" cy="18" r="1.5" />
    </Solid>
  );
}
function Bus(_p: GlyphProps) {
  return (
    <Solid>
      {/* Bus */}
      <path d="M5 4h14v16H5zM5 9v4h14V9z" />
      <circle cx="8" cy="15" r="1.4" />
      <circle cx="16" cy="15" r="1.4" />
    </Solid>
  );
}
function Fuel(_p: GlyphProps) {
  return (
    <Solid>
      {/* Fuel pump */}
      <path d="M5 3h7a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM5 7v8h7V7zM15 7c0-1 .8-2 2-2v-1h-1V2h3v2h-1v1c1 0 2 1 2 2v6c0 1.5-1.5 3-3 3v5h-2v-5c-1.5 0-3-1.5-3-3z" />
    </Solid>
  );
}
function Taxi(_p: GlyphProps) {
  return (
    <Solid>
      {/* Taxi */}
      <path d="M9 3h6v2h2l1 3h2v9H4V8h2l1-3h2zM10 9h4v1h-4z" />
      <circle cx="6" cy="14.5" r="1.5" />
      <circle cx="18" cy="14.5" r="1.5" />
    </Solid>
  );
}
function Bike(_p: GlyphProps) {
  return (
    <Solid>
      {/* Bicycle with frame */}
      <circle cx="7" cy="16" r="4" />
      <circle cx="17" cy="16" r="4" />
      <path d="M7 16l3-6h-2V8h3l1 3 3-1 1 2-4 1z" />
    </Solid>
  );
}
function Travel(_p: GlyphProps) {
  return (
    <Solid>
      {/* Airplane */}
      <path d="M21 14 14 11V6a2 2 0 1 0-4 0v5L3 14v2l7-1v4l-2 1v2l4-1 4 1v-2l-2-1v-4l7 1z" />
    </Solid>
  );
}

/* ── Lifestyle ──────────────────────────────────────────────── */

function Shopping(_p: GlyphProps) {
  return (
    <Solid>
      {/* Shopping bag */}
      <path d="M5 8h14l-1.2 11a2 2 0 0 1-2 1.7H8.2a2 2 0 0 1-2-1.7zM9 8V6a3 3 0 0 1 6 0v2z" />
    </Solid>
  );
}
function Personal(_p: GlyphProps) {
  return (
    <Solid>
      {/* Person silhouette */}
      <path d="M9 2h6l-1 7h-4zM8 10h8v3h-2v8h-4v-8H8z" />
    </Solid>
  );
}
function Maid(_p: GlyphProps) {
  return (
    <Solid>
      {/* Broom / cleaning */}
      <path d="m16 3 4 4-9 9-4-4zM7 13l4 4-4 4-4-4zM12 18l1.5-1.5 4 4-1.5 1.5z" />
    </Solid>
  );
}
function Gym(_p: GlyphProps) {
  return (
    <Solid>
      {/* Dumbbell */}
      <path d="M2 9h2v6H2zM20 9h2v6h-2zM6 7h3v10H6zM15 7h3v10h-3zM11 11h2v2h-2zM4 10h1v4H4zM19 10h1v4h-1z" />
    </Solid>
  );
}
function Entertainment(_p: GlyphProps) {
  return (
    <Solid>
      {/* TV with antennas */}
      <path d="M3 8h18a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zM4 4l2-2 2 2 2-2 2 2 2-2 2 2 2-2 2 2v3H4z" />
    </Solid>
  );
}
function Gaming(_p: GlyphProps) {
  return (
    <Solid>
      {/* Gamepad */}
      <path d="M6 7h12a4 4 0 0 1 4 4v3a3 3 0 0 1-5.7 1.5L15 14H9l-1.3 1.5A3 3 0 0 1 2 14v-3a4 4 0 0 1 4-4z" />
      <circle cx="9" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <path d="M15 11h2v1h-2zM14 12h2v1h-2zM15 13h2v1h-2z" />
    </Solid>
  );
}
function Music(_p: GlyphProps) {
  return (
    <Solid>
      {/* Music note pair */}
      <path d="M9 3v11.5a3.5 3.5 0 1 0 2 3.2V8h6v6.5a3.5 3.5 0 1 0 2 3.2V3z" />
    </Solid>
  );
}
function Phone(_p: GlyphProps) {
  return (
    <Solid>
      {/* Smartphone */}
      <path d="M7 2.5a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h8.5a2 2 0 0 0 2-2v-15a2 2 0 0 0-2-2zM9 5h4z" />
      <circle cx="11.5" cy="18" r="1" />
    </Solid>
  );
}
function Stay(_p: GlyphProps) {
  return (
    <Solid>
      {/* Hotel building */}
      <path d="M3 6h2v8h14V8a2 2 0 0 0-2-2h-6V4h6a4 4 0 0 1 4 4v10h-2v-2H5v2H3zM9 10h6v2H9z" />
    </Solid>
  );
}

/* ── Family & health ─────────────────────────────────────────── */

function Health(_p: GlyphProps) {
  return (
    <Solid>
      {/* Cross + rounded square medical badge */}
      <path d="M8 4h8v1h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2zm3 8v3H8v2h3v3h2v-3h3v-2h-3v-3h-2z" />
    </Solid>
  );
}
function Hospital(_p: GlyphProps) {
  return (
    <Solid>
      {/* Hospital building with cross */}
      <path d="M9 2h6v6h4a2 2 0 0 1 2 2v11H3V10a2 2 0 0 1 2-2h4zM11 11h2v3h3v2h-3v3h-2v-3H8v-2h3z" />
    </Solid>
  );
}
function Emi(_p: GlyphProps) {
  return (
    <Solid>
      {/* Wallet with arrow */}
      <path d="M3 6a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 14h6v2H3zM11 14l4-4v3h6v2h-6v3z" />
    </Solid>
  );
}
function Education(_p: GlyphProps) {
  return (
    <Solid>
      {/* Graduation cap + opening */}
      <path d="m12 3 11 6-4 2.2V16a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4v-4.8L1 9zM9 12.6V16a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-3.4l-3 1.6z" />
    </Solid>
  );
}
function Coaching(_p: GlyphProps) {
  return (
    <Solid>
      {/* Person + speech bubble */}
      <circle cx="9" cy="6" r="3" />
      <path d="M3 20c0-3 2.7-5 6-5s6 2 6 5zM15 5h7v10h-2v2l-3-2h-2z" />
    </Solid>
  );
}
function Books(_p: GlyphProps) {
  return (
    <Solid>
      {/* Open book */}
      <path d="M3 4h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2-2H3zM12 4h9v14h-7a2 2 0 0 1-2-2z" />
      <path d="M14 7v2h5V7zM14 11v2h5v-2z" />
    </Solid>
  );
}
function Kids(_p: GlyphProps) {
  return (
    <Solid>
      {/* Two children silhouettes */}
      <circle cx="8" cy="6" r="3" />
      <path d="M3 20c0-3 2.2-5 5-5s5 2 5 5zM16 9c1.4 0 2.5 1.1 2.5 2.5S17.4 14 16 14s-2.5-1.1-2.5-2.5S14.6 9 16 9zM14 17c0-2 1-3.5 4-3.5s4 1.5 4 3.5z" />
    </Solid>
  );
}
function Pets(_p: GlyphProps) {
  return (
    <Solid>
      {/* Paw print */}
      <ellipse cx="7" cy="9" rx="2" ry="2.5" />
      <ellipse cx="17" cy="9" rx="2" ry="2.5" />
      <ellipse cx="5" cy="14" rx="2" ry="2.5" />
      <ellipse cx="19" cy="14" rx="2" ry="2.5" />
      <circle cx="12" cy="13" r="2.5" />
      <path d="M8 18c1 1.5 2.5 2.5 4 2.5s3-1 4-2.5z" />
    </Solid>
  );
}

/* ── Giving & saving ─────────────────────────────────────────── */

function Gifts(_p: GlyphProps) {
  return (
    <Solid>
      {/* Gift box with ribbon */}
      <path d="M3 9h18v11H3zM5 7a3 3 0 0 1 3-3h2a3 3 0 0 1 3 3v1H5zM14 7a3 3 0 0 1 3-3h2a3 3 0 0 1 3 3v1h-8zM11 11v8h2v-8z" />
    </Solid>
  );
}
function Family(_p: GlyphProps) {
  return (
    <Solid>
      {/* Family group */}
      <circle cx="8" cy="6" r="3" />
      <circle cx="16" cy="6" r="3" />
      <path d="M3 20c0-3 2.2-5 5-5s5 2 5 5zM13 20c0-3 2.2-5 5-5s5 2 5 5z" />
      <circle cx="12" cy="13" r="2.5" />
      <path d="M9 20c0-1.5 1.5-3 3-3s3 1.5 3 3z" />
    </Solid>
  );
}
function Charity(_p: GlyphProps) {
  return (
    <Solid>
      {/* Open hands heart */}
      <path d="M12 4c-1-1.5-3-2-5-2 0 3 1 5 3 6-2 1-4 4-4 7 0 4 3 7 6 7 1.5 0 3-.7 4-2 1 1.3 2.5 2 4 2 3 0 6-3 6-7 0-3-2-6-4-7 2-1 3-3 3-6-2 0-4 .5-5 2-1-1.5-3-2-5-2 0 3 1 5 3 6-1 .5-1 1-1 1z" />
    </Solid>
  );
}
function Puja(_p: GlyphProps) {
  return (
    <Solid>
      {/* Diya / oil lamp */}
      <path d="M12 2c.5 1.5.5 3 0 4.5C11.5 8 11 8 11 7c0-2 1-4 1-5zM8 13h8l-1 8H9z" />
    </Solid>
  );
}
function Savings(_p: GlyphProps) {
  return (
    <Solid>
      {/* Piggy bank */}
      <path d="M5 11a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v1h2v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-9h2z" />
      <circle cx="16" cy="14.5" r="0.8" />
      <path d="M9 7a3 3 0 0 1 6 0z" />
    </Solid>
  );
}
function Dps(_p: GlyphProps) {
  // Calendar with recurring arrow — "monthly deposit scheme".
  return (
    <Solid>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18" stroke="#fff" strokeWidth="1.4" fill="none" />
      <path d="M8 3v3M16 3v3" stroke="#fff" strokeWidth="1.4" fill="none" />
      <path d="M11 14l-2 2 2 2M9 16h6a3 3 0 0 1 0 6h-3" stroke="#fff" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Solid>
  );
}
function Fdr(_p: GlyphProps) {
  // Bank columns + a "fixed lock" badge — "fixed deposit receipt".
  return (
    <Solid>
      <path d="M12 2 3 6l9 4 9-4z" />
      <path d="M5 8v8M9 8v8M15 8v8M19 8v8" stroke="#fff" strokeWidth="1.4" fill="none" />
      <path d="M3 19h18v2H3z" />
      <rect x="9" y="11" width="6" height="5" rx="1" stroke="#fff" strokeWidth="1.4" fill="none" />
    </Solid>
  );
}
function Investment(_p: GlyphProps) {
  return (
    <Solid>
      {/* Coin with up-arrow */}
      <circle cx="12" cy="12" r="9" />
      <path d="M11 6l5 5h-3v4h-4v-4H6z" />
    </Solid>
  );
}
function Goals(_p: GlyphProps) {
  return (
    <Solid>
      {/* Target / bullseye */}
      <path d="M12 3a9 9 0 0 1 9 9 9 9 0 0 1-9 9 9 9 0 0 1-9-9 9 9 0 0 1 9-9zm0 4a5 5 0 0 0-5 5 5 5 0 0 0 5 5 5 5 0 0 0 5-5 5 5 0 0 0-5-5zm0 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4z" />
    </Solid>
  );
}

/* ── Tech & bills ─────────────────────────────────────────────── */

function Subscriptions(_p: GlyphProps) {
  return (
    <Solid>
      {/* Computer monitor with stand */}
      <path d="M3 4h18v13H3zM9 20h6v2H9z" />
    </Solid>
  );
}
function Insurance(_p: GlyphProps) {
  return (
    <Solid>
      {/* Shield with checkmark */}
      <path d="M12 2 3 5v8c0 5 4 8 9 9 5-1 9-4 9-9V5z" />
      <path d="m10 12-3-3 1.4-1.4 1.6 1.6 5.1-5.1 1.4 1.4z" />
    </Solid>
  );
}

/* ── Fun & occasions ──────────────────────────────────────────── */

function Party(_p: GlyphProps) {
  return (
    <Solid>
      {/* Confetti + party popper */}
      <path d="M4 4h2v2H4zM9 3h2v3H9zM14 4h2v2h-2zM19 2h2v3h-2zM4 11l9-3 3 9-9 3z" />
      <circle cx="17" cy="12" r="2" />
    </Solid>
  );
}
function Birthday(_p: GlyphProps) {
  return (
    <Solid>
      {/* Cake with candle */}
      <path d="M11 2a1.5 1.5 0 1 1 2 0V4h-2zM10 4h4v3h-4zM3 11h18v3H3zM5 15h14v5H5zM12 8v3z" />
    </Solid>
  );
}
function Vacation(_p: GlyphProps) {
  return (
    <Solid>
      {/* Palm tree + ground */}
      <path d="M12 3c-2 0-4 1-5 3-2 0-3 1-3 3 2 0 3-1 4-2 1 2 2 3 4 3-1-2-2-3-3-4 2 0 3-1 4-3zM11 9c-1 1-2 4-2 7h2c0-3 1-6 2-7zM4 18h16v2H4z" />
    </Solid>
  );
}
function Hobbies(_p: GlyphProps) {
  return (
    <Solid>
      {/* Camera with lens */}
      <path d="M9 4h6l1 2h4a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4z" />
      <circle cx="12" cy="12" r="4" />
    </Solid>
  );
}
function Furniture(_p: GlyphProps) {
  return (
    <Solid>
      {/* Bed / couch */}
      <path d="M3 11a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6H3zM5 17v3zM19 17v3zM7 17v3zM17 17v3z" />
    </Solid>
  );
}
function Outing(_p: GlyphProps) {
  return (
    <Solid>
      {/* Palm tree simplified */}
      <path d="M12 3c-2 0-4 1-5 3-2 0-3 1-3 3 2 0 3-1 4-2 1 2 2 3 4 3-1-2-2-3-3-4 2 0 3-1 4-3zM4 18h16v2H4z" />
    </Solid>
  );
}
function Dining(_p: GlyphProps) {
  return (
    <Solid>
      {/* Picnic basket */}
      <path d="M3 5h18v2H3zM4 8h16a1 1 0 0 1 1 1v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a1 1 0 0 1 1-1z" />
      <path d="M7 12v6zM11 12v6zM15 12v6z" />
    </Solid>
  );
}

/* ── Income sources ───────────────────────────────────────────── */

function Salary(_p: GlyphProps) {
  return (
    <Solid>
      {/* Briefcase */}
      <path d="M8 4V3a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v1h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
      <path d="M10 4h4zM4 12v6h16v-6z" />
    </Solid>
  );
}
function Freelance(_p: GlyphProps) {
  return (
    <Solid>
      {/* Laptop */}
      <path d="M5 5h14a1 1 0 0 1 1 1v9H4V6a1 1 0 0 1 1-1zM2 18h20v2H2z" />
    </Solid>
  );
}
function Business(_p: GlyphProps) {
  return (
    <Solid>
      {/* Bank / government building */}
      <path d="M3 9 5 4h14l2 5zM3 11h18v10H3zM9 13v6zM15 13v6z" />
    </Solid>
  );
}
function Interest(_p: GlyphProps) {
  return (
    <Solid>
      {/* Ascending bar chart */}
      <path d="M5 15h3v3H5zM9 12h3v6H9zM13 7h3v11h-3zM17 4h3v14h-3zM3 20h18v2H3z" />
    </Solid>
  );
}
function Wedding(_p: GlyphProps) {
  return (
    <Solid>
      {/* Two intertwined rings */}
      <path d="M9 4a5 5 0 0 1 5 5 5 5 0 0 1-5 5 5 5 0 0 1-5-5 5 5 0 0 1 5-5zm0 2a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3zM15 4a5 5 0 0 1 5 5 5 5 0 0 1-5 5 5 5 0 0 1-5-5 5 5 0 0 1 5-5zm0 2a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3z" />
    </Solid>
  );
}

/* ── Event planner ────────────────────────────────────────────── */

function Venue(_p: GlyphProps) {
  return (
    <Solid>
      {/* Columns / museum */}
      <path d="M2 6 12 2l10 4v2H2zM4 10v9zM8 10v9zM12 10v9zM16 10v9zM20 10v9zM2 20h20v2H2z" />
    </Solid>
  );
}
function Catering(_p: GlyphProps) {
  return (
    <Solid>
      {/* Cloche dome with utensils */}
      <path d="M12 3a8 8 0 0 0-8 8h6V3zM12 3v8h6a8 8 0 0 0-6-8zM3 13h18v2H3z" />
      <circle cx="7" cy="17" r="2" />
      <circle cx="17" cy="17" r="2" />
    </Solid>
  );
}
function Photography(_p: GlyphProps) {
  return (
    <Solid>
      {/* Camera */}
      <path d="M9 4h6l1 2h4a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4z" />
      <circle cx="12" cy="12" r="4" />
    </Solid>
  );
}
function Decor(_p: GlyphProps) {
  return (
    <Solid>
      {/* Decorative leaf cluster */}
      <path d="M12 2a4 4 0 0 0-3.5 2 4 4 0 0 0-3 6.5 4 4 0 0 0 2 6.5v3a1 1 0 1 0 2 0v-3a4 4 0 0 0 2-3 4 4 0 0 0 3-3.5A4 4 0 0 0 12 2z" />
      <circle cx="9" cy="9.5" r="1" />
      <circle cx="15" cy="9.5" r="1" />
      <circle cx="12" cy="13.5" r="1" />
    </Solid>
  );
}
function Invitations(_p: GlyphProps) {
  return (
    <Solid>
      {/* Envelope */}
      <path d="M3 5h18v14H3zM3 7l9 6 9-6z" />
    </Solid>
  );
}
function Outfit(_p: GlyphProps) {
  return (
    <Solid>
      {/* Dress */}
      <path d="M12 3a2 2 0 1 1-2 2c0-1 .5-1.5 1-2-1.5 0-3-1.5 0-2zM11 7l11 8H2z" />
    </Solid>
  );
}
function HoludOutfit(_p: GlyphProps) {
  return (
    <Solid>
      {/* Yellow dress with band */}
      <path d="M12 3a2 2 0 1 1-2 2c0-1 .5-1.5 1-2-1.5 0-3-1.5 0-2zM11 7l11 8H2z" />
      <path d="M8 12h8z" />
    </Solid>
  );
}
function Rings(_p: GlyphProps) {
  return (
    <Solid>
      {/* Two rings */}
      <circle cx="9" cy="9" r="5" />
      <circle cx="15" cy="9" r="5" />
    </Solid>
  );
}
function MusicDj(_p: GlyphProps) {
  return (
    <Solid>
      {/* DJ music note pair */}
      <path d="M9 3v11.5a3.5 3.5 0 1 0 2 3.2V8h6v6.5a3.5 3.5 0 1 0 2 3.2V3z" />
    </Solid>
  );
}
function Mishti(_p: GlyphProps) {
  return (
    <Solid>
      {/* Sweet / mithai wedge */}
      <path d="M12 2a10 10 0 0 0-9 6 10 10 0 0 0 9 6 10 10 0 0 1 0-12z" />
    </Solid>
  );
}
function Pan(_p: GlyphProps) {
  return (
    <Solid>
      {/* Paan leaf */}
      <path d="M4 19c0-9 7-15 17-17-1 10-7 16-17 17zM6 17c1-1 3-1 4 0s2 1 3 0z" />
    </Solid>
  );
}
function Mehndi(_p: GlyphProps) {
  return (
    <Solid>
      {/* Mehndi cone */}
      <path d="M5 11a3 3 0 0 1 3-3h7a3 3 0 0 1 3 3v3l3 1-2 7H5l-2-7 2-1zM10 12v3zM14 12v3z" />
    </Solid>
  );
}
function Reception(_p: GlyphProps) {
  return (
    <Solid>
      {/* Champagne tower */}
      <path d="M11 2a1.5 1.5 0 1 1 2 0V3h-2zM10 3h4l1 8h-6zM11 11h2v9h-2z" />
    </Solid>
  );
}
function ReturnGifts(_p: GlyphProps) {
  return (
    <Solid>
      {/* Gift box */}
      <path d="M3 9h18v11H3zM5 7a3 3 0 0 1 3-3h2a3 3 0 0 1 3 3v1H5zM14 7a3 3 0 0 1 3-3h2a3 3 0 0 1 3 3v1h-8zM11 11v8h2v-8z" />
    </Solid>
  );
}
function Honeymoon(_p: GlyphProps) {
  return (
    <Solid>
      {/* Tropical scene */}
      <path d="M12 3c-2 0-4 1-5 3-2 0-3 1-3 3 2 0 3-1 4-2 1 2 2 3 4 3-1-2-2-3-3-4 2 0 3-1 4-3zM4 18h16v2H4z" />
    </Solid>
  );
}
function Activities(_p: GlyphProps) {
  return (
    <Solid>
      {/* Tickets */}
      <path d="M3 6h18a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-7v3h-2v-3H4v2a1 1 0 0 0 1 1h7v2H5a3 3 0 0 1-3-3V7a1 1 0 0 1 1-1z" />
      <path d="M4 8v1h6V8zM14 8v1h6V8z" />
    </Solid>
  );
}
function SimData(_p: GlyphProps) {
  return (
    <Solid>
      {/* SIM card */}
      <path d="M7 2h7l5 5v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
      <path d="M7 10v8h2v-8zM11 10v8h2v-8zM15 10v8h2v-8z" />
    </Solid>
  );
}
function Gear(_p: GlyphProps) {
  return (
    <Solid>
      {/* Gear / settings */}
      <path d="M8 4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2h2a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-1v3a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-3H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2z" />
      <path d="M9 9h6v6H9z" />
    </Solid>
  );
}
function Visa(_p: GlyphProps) {
  return (
    <Solid>
      {/* Passport / visa booklet */}
      <path d="M4 3h16v18H4z" />
      <circle cx="12" cy="11" r="4" />
      <path d="M9 17h6z" />
    </Solid>
  );
}
function Flowers(_p: GlyphProps) {
  return (
    <Solid>
      {/* Flower silhouette */}
      <path d="M12 2a4 4 0 0 0-3.5 2 4 4 0 0 0-3 6.5 4 4 0 0 0 2 6.5v3a1 1 0 1 0 2 0v-3a4 4 0 0 0 2-3 4 4 0 0 0 3-3.5A4 4 0 0 0 12 2z" />
    </Solid>
  );
}
function Prasad(_p: GlyphProps) {
  return (
    <Solid>
      {/* Offering bowl */}
      <path d="M12 3a9 9 0 0 0-9 9h18a9 9 0 0 0-9-9zM3 14a9 9 0 0 0 18 0z" />
    </Solid>
  );
}
function SpecialFood(_p: GlyphProps) {
  return (
    <Solid>
      {/* Cutlery crossed */}
      <path d="M7 3v8a3 3 0 0 0 2 2.8V21h2v-7.2A3 3 0 0 0 13 11V3zM15 3v8c0 2 .5 4 2 5.5V21h2v-4.5c-1.5-1.5-2-3.5-2-5.5V3z" />
    </Solid>
  );
}
function RitualSupplies(_p: GlyphProps) {
  return (
    <Solid>
      {/* Incense sticks */}
      <path d="M9 2c0 2-1 4-2 5l1 1c1-1 2-3 2-5zM13 2c0 2-1 4-2 5l1 1c1-1 2-3 2-5z" />
      <path d="M5 9h14v2H5zM7 13h10v9H7z" />
    </Solid>
  );
}
function CharityReligious(_p: GlyphProps) {
  return (
    <Solid>
      {/* Religious offering heart */}
      <path d="M12 4c-1-1.5-3-2-5-2 0 3 1 5 3 6-2 1-4 4-4 7 0 4 3 7 6 7 1.5 0 3-.7 4-2 1 1.3 2.5 2 4 2 3 0 6-3 6-7 0-3-2-6-4-7 2-1 3-3 3-6-2 0-4 .5-5 2-1-1.5-3-2-5-2 0 3 1 5 3 6-1 .5-1 1-1 1z" />
    </Solid>
  );
}
function Eidi(_p: GlyphProps) {
  return (
    <Solid>
      {/* Eidi envelope gift */}
      <path d="M3 9h18v11H3z" />
      <path d="M5 7a3 3 0 0 1 3-3h2a3 3 0 0 1 3 3v1H5zM14 7a3 3 0 0 1 3-3h2a3 3 0 0 1 3 3v1h-8z" />
      <path d="M11 11v8h2v-8z" />
    </Solid>
  );
}
function DecorLights(_p: GlyphProps) {
  return (
    <Solid>
      {/* String lights */}
      <path d="M2 4c4 1 8 3 12 4s6 1 8 0z" />
      <circle cx="5" cy="7" r="1.5" />
      <circle cx="10" cy="9" r="1.5" />
      <circle cx="15" cy="11" r="1.5" />
      <circle cx="20" cy="13" r="1.5" />
    </Solid>
  );
}
function Tipping(_p: GlyphProps) {
  return (
    <Solid>
      {/* Coin in hand */}
      <circle cx="12" cy="9" r="7" />
      <path d="M9 14h6l1 4a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1z" />
    </Solid>
  );
}
function CleaningFee(_p: GlyphProps) {
  return (
    <Solid>
      {/* Broom cleaning */}
      <path d="m16 3 4 4-9 9-4-4zM7 13l4 4-4 4-4-4zM12 18l1.5-1.5 4 4-1.5 1.5z" />
    </Solid>
  );
}
function Cake(_p: GlyphProps) {
  return (
    <Solid>
      {/* Birthday cake */}
      <path d="M11 2a1.5 1.5 0 1 1 2 0V4h-2z" />
      <path d="M10 4h4v3h-4z" />
      <path d="M3 11h18v3H3z" />
      <path d="M5 15h14v5H5z" />
      <path d="M12 8v3z" />
    </Solid>
  );
}
function Fallback(_p: GlyphProps) {
  return (
    <Solid>
      {/* Tag / price tag fallback */}
      <path d="M4 12V5a1 1 0 0 1 1-1h7l8 8-8 8-8-8z" />
      <circle cx="8.5" cy="8.5" r="1.2" />
    </Solid>
  );
}
function Other(_p: GlyphProps) {
  return (
    <Solid>
      {/* Plus mark */}
      <path d="M11 4v6H5v2h6v6h2v-6h6v-2h-6V4z" />
    </Solid>
  );
}
function Event(_p: GlyphProps) {
  // Generic event marker — used when plan.emoji is missing.
  return (
    <Solid>
      {/* Calendar */}
      <path d="M3 5h18v16H3z" />
      <path d="M3 9h18z" />
      <path d="M8 3v3zM16 3v3z" />
    </Solid>
  );
}

/* ── Lookup table ─────────────────────────────────────────────── */

const GLYPHS: Record<string, GlyphComponent> = {
  'rent':              Rent,
  'service-charge':    ServiceCharge,
  'groceries':         Groceries,
  'utilities':         Utilities,
  'lpg':               Lpg,
  'wifi':              Wifi,
  'food':              Food,
  'cafe':              Cafe,
  'vegetables':        Vegetables,
  'bakery':            Bakery,
  'meat-fish':         MeatFish,
  'fruits':            Fruits,
  'dairy':             Dairy,
  'lunch':             Lunch,
  'healthy':           Healthy,
  'dining-out':        DiningOut,
  'transport':         Transport,
  'bus':               Bus,
  'fuel':              Fuel,
  'taxi':              Taxi,
  'bike':              Bike,
  'travel':            Travel,
  'shopping':          Shopping,
  'personal':          Personal,
  'maid':              Maid,
  'gym':               Gym,
  'entertainment':     Entertainment,
  'gaming':            Gaming,
  'music':             Music,
  'phone':             Phone,
  'stay':              Stay,
  'health':            Health,
  'hospital':          Hospital,
  'emi':               Emi,
  'education':         Education,
  'coaching':          Coaching,
  'books':             Books,
  'kids':              Kids,
  'pets':              Pets,
  'gifts':             Gifts,
  'family':            Family,
  'charity':           Charity,
  'puja':              Puja,
  'savings':           Savings,
  'dps':               Dps,
  'fdr':               Fdr,
  'investment':        Investment,
  'goals':             Goals,
  'subscriptions':     Subscriptions,
  'insurance':         Insurance,
  'party':             Party,
  'birthday':          Birthday,
  'vacation':          Vacation,
  'hobbies':           Hobbies,
  'home':              Rent, // home glyph reuses Rent silhouette
  'furniture':         Furniture,
  'outing':            Outing,
  'dining':            Dining,
  'salary':            Salary,
  'freelance':         Freelance,
  'business':          Business,
  'interest':          Interest,
  'wedding':           Wedding,
  'venue':             Venue,
  'catering':          Catering,
  'photography':       Photography,
  'decor':             Decor,
  'invitations':       Invitations,
  'outfit':            Outfit,
  'holud-outfit':      HoludOutfit,
  'rings':             Rings,
  'music-dj':          MusicDj,
  'mishti':            Mishti,
  'pan':               Pan,
  'mehndi':            Mehndi,
  'reception':         Reception,
  'return-gifts':      ReturnGifts,
  'honeymoon':         Honeymoon,
  'activities':        Activities,
  'sim-data':          SimData,
  'gear':              Gear,
  'visa':              Visa,
  'flowers':           Flowers,
  'prasad':            Prasad,
  'special-food':      SpecialFood,
  'ritual':            RitualSupplies,
  'charity-religious': CharityReligious,
  'eidi':              Eidi,
  'decor-lights':      DecorLights,
  'tipping':           Tipping,
  'cleaning':          CleaningFee,
  'cake':              Cake,
  'fallback':          Fallback,
  'other':             Other,
  'event':             Event,
};

/**
 * Resolve a glyph key to its component. Falls back to `fallback` if the
 * key isn't recognised.
 */
export function resolveGlyph(key: string | null | undefined): GlyphComponent {
  if (!key) return Fallback;
  const k = key.trim().toLowerCase();
  return GLYPHS[k] ?? Fallback;
}

/**
 * List every glyph key + its label. Used by the CategoryGlyphPicker
 * to render the full grid.
 */
export const CATEGORY_GLYPH_LIST: ReadonlyArray<{ key: string; label: string }> =
  Object.keys(GLYPHS)
    .filter((key) => key !== 'fallback' && key !== 'event' && key !== 'home')
    .sort()
    .map((key) => {
      const labels: Record<string, string> = {
        'rent': 'Rent', 'service-charge': 'Service Charge', 'groceries': 'Groceries',
        'utilities': 'Utilities', 'lpg': 'LPG', 'wifi': 'WiFi',
        'food': 'Food', 'cafe': 'Café', 'vegetables': 'Vegetables',
        'bakery': 'Bakery', 'meat-fish': 'Meat & fish', 'fruits': 'Fruits',
        'dairy': 'Dairy', 'lunch': 'Lunch', 'healthy': 'Healthy',
        'dining-out': 'Dining out',
        'transport': 'Transport', 'bus': 'Bus', 'fuel': 'Fuel',
        'taxi': 'Taxi', 'bike': 'Bike', 'travel': 'Travel',
        'shopping': 'Shopping', 'personal': 'Personal', 'maid': 'Maid',
        'gym': 'Gym', 'entertainment': 'Entertainment', 'gaming': 'Gaming',
        'music': 'Music', 'phone': 'Phone', 'stay': 'Stay',
        'health': 'Health', 'hospital': 'Hospital', 'emi': 'EMI',
        'education': 'Education', 'coaching': 'Coaching', 'books': 'Books',
        'kids': 'Kids', 'pets': 'Pets',
        'gifts': 'Gifts', 'family': 'Family', 'charity': 'Charity',
        'puja': 'Puja', 'savings': 'Savings', 'dps': 'DPS', 'fdr': 'FDR', 'investment': 'Investment',
        'goals': 'Goals',
        'subscriptions': 'Subscriptions', 'insurance': 'Insurance',
        'party': 'Party', 'birthday': 'Birthday', 'vacation': 'Vacation',
        'hobbies': 'Hobbies', 'furniture': 'Home', 'outing': 'Outing',
        'dining': 'Dining',
        'salary': 'Salary', 'freelance': 'Freelance', 'business': 'Business',
        'interest': 'Interest', 'wedding': 'Wedding',
        'venue': 'Venue', 'catering': 'Catering', 'photography': 'Photography',
        'decor': 'Decor', 'invitations': 'Invitations', 'outfit': 'Outfit',
        'holud-outfit': 'Holud Outfit', 'rings': 'Rings', 'music-dj': 'Music & DJ',
        'mishti': 'Mishti / Sweets', 'pan': 'Pan / Paan',
        'mehndi': 'Mehndi / Haldi', 'reception': 'Reception',
        'return-gifts': 'Return Gifts', 'honeymoon': 'Honeymoon',
        'activities': 'Activities', 'sim-data': 'SIM / Data',
        'gear': 'Gear', 'visa': 'Visa',
        'flowers': 'Flowers', 'prasad': 'Prasad / Offering',
        'special-food': 'Special Food', 'ritual': 'Ritual Supplies',
        'charity-religious': 'Charity', 'eidi': 'Gifts / Eidi',
        'decor-lights': 'Décor & Lights',
        'tipping': 'Tipping', 'cleaning': 'Cleaning Fee',
        'cake': 'Cake', 'other': 'Other',
      };
      return { key, label: labels[key] ?? key };
    });

/* ── <CategoryGlyph /> component ───────────────────────────────── */

/**
 * <CategoryGlyph /> — solid pictogram for a category. Inherits color
 * via currentColor. Pass a glyph key (e.g. `'rent'`, `'emi'`, `'puja'`).
 * Unknown / legacy values render as the generic tag fallback.
 *
 * Renders at 24×24 by default. The standard tile wrapper (40×40, rounded,
 * surface-2 bg, primary text) lives in `ICON_TILE_CLASS` — use it via
 * `<IconTile><CategoryGlyph ... /></IconTile>` or apply directly.
 */
export interface CategoryGlyphProps extends Omit<SVGProps<SVGSVGElement>, 'viewBox' | 'fill' | 'stroke' | 'aria-hidden' | 'name'> {
  /** Glyph key — see `CATEGORY_GLYPH_LIST` for the full vocabulary.
   *  Unicode emoji strings (e.g. `'🏠'`) are rendered as text so the
   *  same component works whether callers store a glyph key or a
   *  literal emoji. */
  name?: string | null;
}

/**
 * Detect a string that holds *only* one or more unicode grapheme
 * clusters (anything outside the ASCII printables). Plan-category
 * emojis are a single emoji grapheme, but be permissive — `'🌺🌿'`,
 * `'🧑‍🏫'` (ZWJ sequence), and `'🛢️'` (VS-16) all read as a single
 * "emoji" by users.
 */
function isLikelyUnicodeEmoji(value: string): boolean {
  if (!value) return false;
  // Anything outside 7-bit printable ASCII means it's a unicode glyph
  // — which is exactly what a stored emoji is. ASCII-only strings are
  // treated as kebab-case glyph keys (e.g. "rent", "service-charge").
  for (let i = 0; i < value.length; i++) {
    if (value.charCodeAt(i) > 126) return true;
  }
  return false;
}

/**
 * Translate common Tailwind size classes (used by callers on
 * `<CategoryGlyph>`) into a matching font-size for the emoji text
 * path. Without this, an emoji inside `w-6 h-6` would render at the
 * parent element's font-size and not fill its box. Anything we don't
 * recognise falls back to a sensible 1.5em.
 */
function sizeClassToFontSize(className?: string): string {
  if (!className) return '1.5em';
  // Order matters: longer / explicit sizes must come before shorter
  // matches (e.g. `w-[24px]` before `w-2`).
  if (/w-\[(\d+)px\]/.test(className)) {
    const m = className.match(/w-\[(\d+)px\]/);
    if (m) return `${m[1]}px`;
  }
  if (/h-\[(\d+)px\]/.test(className)) {
    const m = className.match(/h-\[(\d+)px\]/);
    if (m) return `${m[1]}px`;
  }
  const map: Record<string, string> = {
    'w-3': '0.75rem', 'h-3': '0.75rem',
    'w-4': '1rem',    'h-4': '1rem',
    'w-5': '1.25rem', 'h-5': '1.25rem',
    'w-6': '1.5rem',  'h-6': '1.5rem',
    'w-7': '1.75rem', 'h-7': '1.75rem',
    'w-8': '2rem',    'h-8': '2rem',
    'w-9': '2.25rem', 'h-9': '2.25rem',
    'w-10': '2.5rem', 'h-10': '2.5rem',
  };
  for (const key of Object.keys(map)) {
    if (className.includes(key)) return map[key];
  }
  return '1.5em';
}

export function CategoryGlyph({ name, className, ...rest }: CategoryGlyphProps) {
  // Unicode emoji passthrough: the 2026-09 revert stores literal
  // emoji strings in `category.emoji` and consumers render them
  // directly. Detect that case (non-ASCII characters) and render as
  // a sized span instead of forcing a glyph-key lookup that would
  // otherwise fall back to the generic tag.
  if (isLikelyUnicodeEmoji(name ?? '')) {
    return (
      <span
        role="img"
        aria-hidden
        className={['inline-flex items-center justify-center leading-none', className].filter(Boolean).join(' ')}
        style={{ fontSize: sizeClassToFontSize(className) }}
      >
        {name}
      </span>
    );
  }
  const Comp = resolveGlyph(name);
  return <Comp className={className} {...rest} />;
}