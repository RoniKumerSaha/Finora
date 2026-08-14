---
status: final
name: Finora
description: Bangladesh-first personal finance web app. One currency (BDT ৳), one job: know where your money goes. Calm / trustworthy register, warm parchment palette, Fraunces-serif heading moments over a system-sans body.
form_factor: web-desktop
ui_system: Tailwind v4 + CSS custom properties (no external component library)
sources:
  - mockups/v1/index.html
  - mockups/v2/index.html
  - UI-UX-FLOW.md
  - ../UI-UX-FLOW.md
  - src/styles/theme.css
updated: 2026-08-13
colors:
  primary: '#5DBFA0'        # dark ; bright teal
  primary-light: '#0D8275'  # light ; deep teal
  primary-soft: 'rgba(93,191,160,0.18)'   # dark
  primary-soft-light: 'rgba(13,130,117,0.12)' # light
  primary-on: '#0F1419'         # dark mode ink on primary
  primary-on-light: '#FFFFFF'   # light mode ink on primary
  accent: '#D9B26B'         # dark ; warm gold
  accent-light: '#A47E2C'   # light ; darker gold
  danger: '#E06050'         # dark ; saturated warm-red (2026-08-14 override)
  danger-title: '#F08574'   # dark ; lighter red for callout title hierarchy
  danger-light: '#B8473A'   # light
  danger-callout-bg: '#2A1A18'    # dark ; real surface for destructive callouts
  danger-callout-bg-light: '#FFF5F1' # light ; purer white tint (2026-08-14)
  warn: '#F4B860'           # dark
  warn-light: '#B6842E'     # light
  success: '#6BAA8A'        # dark ; sage (NEW role, v1 finalization)
  success-title: '#82BFA0'  # dark ; lighter sage for alert title
  success-light: '#558C6C'  # light
  success-callout-bg: '#1A2620'    # dark ; real surface for success alerts
  success-callout-bg-light: '#F1F8F3' # light ; purer white tint (2026-08-14)
  bg: '#1E2A26'             # dark ; deep forest
  bg-light: '#F7F4EC'       # light ; warm cream / parchment
  surface: '#253229'        # dark
  surface-light: '#FFFFFF'
  surface-2: '#2E3C34'      # dark
  surface-2-light: '#F0EBDF'
  text: '#F1F3EF'           # dark
  text-light: '#2A2620'
  muted: '#94A59C'          # dark
  muted-light: '#7A6F5E'
  border: '#324139'         # dark
  border-light: '#E5DECB'
typography:
  heading: 'Fraunces'        # Google Fonts, variable opsz 9..144
  body: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif'
  numeric: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace'
  # Roles (px / weight / line-height / tracking)
  h1-display:  { font: 'Fraunces',       size: 28, weight: 600, lh: 1.2,   tracking: -0.01 }
  h1-screen:   { font: 'Fraunces',       size: 22, weight: 600, lh: 1.2,   tracking: -0.01 }
  h2-section:  { font: 'system-sans',    size: 13, weight: 600, lh: 1.2,   tracking: 0.06,   transform: 'uppercase' }
  h3-modal:    { font: 'Fraunces',       size: 18, weight: 600, lh: 1.25,  tracking: -0.005 }
  body:        { font: 'system-sans',    size: 14, weight: 400, lh: 1.55,  tracking: 0 }
  body-strong: { font: 'system-sans',    size: 14, weight: 600, lh: 1.5,   tracking: 0 }
  caption:     { font: 'system-sans',    size: 12, weight: 400, lh: 1.45,  tracking: 0 }
  money-stat:  { font: 'system-sans',    size: 26, weight: 700, lh: 1.1,   tracking: -0.02,  tabular: true }
  money-hero:  { font: 'system-sans',    size: 42, weight: 800, lh: 1.1,   tracking: -0.02,  tabular: true }
  amount-input: { font: 'system-sans',   size: 32, weight: 700, lh: 1.2,   tracking: -0.02,  tabular: true }
  tx-title:    { font: 'system-sans',    size: 14, weight: 600, lh: 1.3,   tracking: 0 }
  tx-sub:      { font: 'system-sans',    size: 12, weight: 400, lh: 1.4,   tracking: 0 }
  chip:        { font: 'system-sans',    size: 11, weight: 600, lh: 1.2,   tracking: 0.02 }
  wordmark:    { font: 'system-sans',    size: 17, weight: 700, lh: 1.0,   tracking: -0.01 }
  button:      { font: 'system-sans',    size: 13.5, weight: 700, lh: 1.0, tracking: 0 }
  nav:         { font: 'system-sans',    size: 13.5, weight: 500, lh: 1.0, tracking: 0 }
rounded:
  card: 18px     # middle ground: v1=24px, v2=12px
  btn: 12px
  input: 10px
  tile: 11px     # account / category tiles
  icon-btn: 8px
  logo: 12px
  pill: 999px    # chips, filters, goal-pct, toggle track
spacing:
  sidebar: '240px'
  main-padding: '24px 32px 64px'
  main-max: '1280px'
  card-padding: '24px'
  stat-padding: '22px'
  modal-padding: '28px'
  onb-padding: '40px'
  grid-gap: '16px'
  topbar-mb: '20px'
  row-gap-tight: '6px'
  form-field-gap: '14px'
elevation:
  card: '0 8px 28px rgba(0,0,0,0.35)'        # dark
  card-light: '0 8px 28px rgba(42,38,32,0.08)'
  modal: '0 10px 40px rgba(0,0,0,0.5)'
  modal-light: '0 10px 40px rgba(42,38,32,0.18)'
  overlay: 'rgba(15,20,25,0.6)'              # dark
  overlay-light: 'rgba(42,38,32,0.25)'
  blur: '6px'                                # backdrop-filter on modal scrim
components:
  button-primary:   { bg: '{colors.primary}',                 fg: '{colors.primary-on}',           radius: '{rounded.btn}',    weight: 700 }
  button-secondary: { bg: 'transparent',                       fg: '{colors.text}',                  border: '1px solid {colors.border}', radius: '{rounded.btn}' }
  button-danger:    { bg: '{colors.danger}',                   fg: '#FFFFFF',                       radius: '{rounded.btn}' }
  card:             { bg: '{colors.surface}',                  border: '1px solid {colors.border}',  radius: '{rounded.card}',  shadow: '{elevation.card}' }
  input:            { bg: '{colors.surface-2}',                border: '1px solid {colors.border}',  radius: '{rounded.input}', pad: '12px 14px' }
  amount-input:     { bg: '{colors.surface-2}',                border: '1px solid {colors.border}',  radius: '{rounded.btn}',    size: '{typography.amount-input}', fg: '{colors.primary}' }
  chip:             { bg: '{colors.surface-2}',                border: '1px solid {colors.border}',  radius: '{rounded.pill}',  size: '{typography.chip}' }
  chip-selected:    { bg: '{colors.primary-soft}',             fg: '{colors.primary}',              border: '1px solid {colors.primary}' }
  tx-icon:          { size: '36×36',                           radius: '14px',                       weight: 700 }
  account-tile:     { size: '36×36',                           radius: '11px',                       weight: 700 }
  category-tile:    { bg: '{colors.surface-2}',                radius: '{rounded.btn}',              selected: { bg: '{colors.primary-soft}', border: '{colors.primary}', fg: '{colors.primary}' } }
  modal:            { bg: '{colors.surface}',                  border: '1px solid {colors.border}',  radius: '{rounded.card}',  pad: '{elevation.modal}', shadow: '{elevation.modal}' }
  toggle:           { track: '{rounded.pill} 38×22', thumb: '18px circle', on: '{colors.primary}', off: '{colors.surface-3}' }
  # 2026-08-14 override: real-surface callouts, not transparent tints
  danger-callout:   { bg: '{colors.danger-callout-bg}',        fg-title: '{colors.danger-title}',    fg-body: '{colors.text}', border: '1px solid {colors.danger}', inner: 'inset 0 0 0 1px rgba(224,96,80,0.35)', radius: '8px' }
  success-alert:    { bg: '{colors.success-callout-bg}',       fg-title: '{colors.success-title}',   fg-body: '{colors.text}', border: '1px solid {colors.success}', inner: 'inset 0 0 0 1px rgba(107,170,138,0.35)', radius: '8px' }
  demo-banner:      { bg: '{colors.surface-2}',                border: '1px dashed {colors.border}', radius: '{rounded.card}' }
---

# Finora — DESIGN.md

> Visual identity per the [Google Labs DESIGN.md spec](https://github.com/google-labs-code/design.md). This is the single source of truth for *how it looks*. The behavioral spine lives in `EXPERIENCE.md`. Spines win on conflict with any mock, wireframe, or import.

## Brand & Style

Finora is a Bangladesh-first personal finance web app for one person and one currency (BDT ৳). Its job is small and disciplined: **know where your money goes.** The brand character is the expression of that job — *calm, trustworthy, personal*. The visual register follows:

- A **warm parchment palette** (dark forest / cream light) instead of the cool-techy slate that dominates fintech. Reads more like a money journal than a bank dashboard.
- A **single teal primary** plus a **single warm gold accent** — two colors of brand, never three. Colors mark meaning, not decoration.
- A **Fraunces moment** on screen titles and modal headings. The serif is a punctuation mark, not a default voice. Body, numbers, and nav remain system-sans — the serif earns its place by appearing only where it changes the room.
- **Middle-ground roundness** — pillowy enough to feel personal, tight enough to feel professional. Cards 18px, buttons 12px, inputs 10px, pills fully rounded.
- **Tabular numerals everywhere money appears.** Amount alignment matters in dense lists; the `tabular` class is mandatory on `.num`, `.tx-amount`, `.stat-num`, and the bdt amount input.
- **No gradients except the goal progress bar.** No glass, no glow, no avatar photography. Restraint is the brand.

## Colors

Two brand colors, six semantic roles, six surface tokens, two ink roles. Every color in the app is one of these.

### Brand

| Role | Dark | Light | Where it appears |
|---|---|---|---|
| **Primary** (teal) | `#5DBFA0` | `#0D8275` | Primary buttons, active nav, income amounts, selected category tile, on-state toggle, progress fill start. |
| **Accent** (gold) | `#D9B26B` | `#A47E2C` | Net balance values, transfer amount, hero treasury numbers, percentage chips, progress fill end. |

### Semantic

| Role | Dark | Light | Where it appears |
|---|---|---|---|
| **Danger** (button) | `#E06050` | `#B8473A` | Destructive action buttons (Delete, Wipe all data). |
| **Danger** (title / border) | `#F08574` / `#E06050` | `#B8473A` | Danger callout title, border, expense amounts, overdue debt warnings. |
| **Danger** (callout surface) | `#2A1A18` | `#FFF5F1` | Real surface bg of destructive callouts (2026-08-14 override). |
| **Warn** | `#F4B860` | `#B6842E` | Pending / overdue payments, matured-but-unclaimed investments, calls-to-action needing attention. |
| **Success** (border / title) | `#6BAA8A` / `#82BFA0` | `#558C6C` / `#3F7A5C` | In-page success/info alert border + title. |
| **Success** (callout surface) | `#1A2620` | `#F1F8F3` | Real surface bg of success alerts. |
| **Success** (state) | `#6BAA8A` | `#558C6C` | Paid-off debts, completed goals, matured-and-claimed investments, positive deltas where the primary teal would be confusing. |
| **Info** | = primary | = primary | No separate info color. |

Each role has a `-soft` companion at ~12–18% alpha for chip fills, selected-state backgrounds, and inline chips. No semantic role gets used decoratively — every appearance is a meaningful state. **Callouts (danger + success) use a real surface, not a `-soft` tint** — see Color rules.

### Surfaces & ink

| Role | Dark | Light |
|---|---|---|
| **bg** | `#1E2A26` (deep forest) | `#F7F4EC` (warm cream / parchment) |
| **surface** | `#253229` | `#FFFFFF` |
| **surface-2** | `#2E3C34` | `#F0EBDF` |
| **surface-3** | `#3A4A42` | `#E5DECB` |
| **ink** | `#F1F3EF` | `#2A2620` |
| **muted** | `#94A59C` | `#7A6F5E` |
| **muted-2** | `#647068` | `#B5A992` |
| **border** | `#324139` | `#E5DECB` |
| **border-2** | `#28332D` | `#D8CFB8` |
| **overlay** | `rgba(15,20,25,0.6)` | `rgba(42,38,32,0.25)` |

### Color rules

- **Two brand colors, no more.** Adding a third brand color is a redesign, not a tweak.
- **6 semantic roles** (primary, accent, danger, warn, success, info=primary). Adding a 7th is a redesign.
- **Sign encoding is dual-channel.** Money direction uses **color + sign glyph** (`+ ৳ 3,500` / `− ৳ 3,500`), never color alone. Color-blind users still get the sign.
- **Callouts use real surfaces, not transparent tints.** Danger callout = `bg-danger-callout-bg` (`#2A1A18` dark). Success alert = `bg-success-callout-bg` (`#1A2620` dark). A transparent `rgba(role, 0.15)` over the page bg has insufficient contrast — the user can't tell where one surface ends and another begins (2026-08-14 learning).
- **Danger hierarchy uses saturation.** Inside a danger callout, the title is the lighter `#F08574`, the button is the saturated `#E06050`. Three same-hue elements (border + title + button) collapse into one flat warm slab.
- **Each semantic role has a unique hue family.** Danger sits in warm-red; accent sits in warm-gold. They are *allowed* to be in the same family (parchment register) but never at the same hue and lightness. Hierarchy is carried by surface contrast and saturation, not by hue alone.
- **Primary text on primary surfaces** uses `--primary-on` (dark ink in dark mode, white in light mode), never raw text color.
- **Light mode is not "white mode."** The light bg is warm cream by design. Pure white is reserved for surfaces (cards, modals) layered on the cream.

## Typography

### Families

- **Headings** — **Fraunces** (Google Fonts). Variable font with optical sizing axis (9–144). Free, OFL-licensed. Modern warm serif with subtle slab-ish terminals — pairs naturally with the parchment palette.
- **Body** — system sans stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif`. Free, fast, native-fallback. No web font.
- **Numeric** — `ui-monospace, "SF Mono", Menlo, Consolas, monospace` declared on `--font-numeric`. Tabular numerals are the default; the family is a fallback for places where letter-spacing from tabular-nums isn't enough.

### Roles

| Role | Font | Size | Weight | LH | Tracking | Notes |
|---|---|---|---|---|---|---|
| **h1-display** | Fraunces | 28 | 600 | 1.2 | -0.01 | Onboarding hero, welcome card. |
| **h1-screen** | Fraunces | 22 | 600 | 1.2 | -0.01 | Page titles (Transactions, Accounts, Goals, etc.). |
| **h2-section** | sans | 13 | 600 | 1.2 | +0.06, uppercase | Card section labels. |
| **h3-modal** | Fraunces | 18 | 600 | 1.25 | -0.005 | Modal titles, confirm dialogs. |
| **body** | sans | 14 | 400 | 1.55 | 0 | Default paragraph. |
| **body-strong** | sans | 14 | 600 | 1.5 | 0 | Buttons, list titles. |
| **caption** | sans | 12 | 400 | 1.45 | 0 | Transaction subtitles, helper text. |
| **money-stat** | sans | 26 | 700 | 1.1 | -0.02 | Home / list stat numbers. `tabular` required. |
| **money-hero** | sans | 42 | 800 | 1.1 | -0.02 | Investment "treasury" hero. Accent color. `tabular` required. |
| **amount-input** | sans | 32 | 700 | 1.2 | -0.02 | Big amount input on add forms. Primary color. `tabular` required. |
| **tx-title** | sans | 14 | 600 | 1.3 | 0 | Transaction row title. |
| **tx-sub** | sans | 12 | 400 | 1.4 | 0 | Transaction row subtitle. |
| **chip** | sans | 11 | 600 | 1.2 | +0.02 | Filter chips, status pills. |
| **wordmark** | sans | 17 | 700 | 1.0 | -0.01 | Sidebar brand "fin<span style="color:primary">ora</span>". |
| **button** | sans | 13.5 | 700 | 1.0 | 0 | All buttons. |
| **nav** | sans | 13.5 | 500 | 1.0 | 0 | Sidebar nav items. |

### Type rules

- **Fraunces appears only in 3 roles**: h1-display, h1-screen, h3-modal. Anywhere else is a brand violation.
- **No italic in body copy.** Italic in Fraunces is permissible for emphasis in headings only.
- **All numeric roles use `font-variant-numeric: tabular-nums`.** The `.tabular` utility class is the contract.
- **Money is bold, never italic.** Even caption-sized amounts.
- **Money color is semantic** — income uses primary, expense uses danger, transfer uses accent, balance uses accent-ink (ink or accent depending on context).

## Layout & Spacing

### Shell

- Grid: `grid-cols-[240px_1fr]`, min-height: 100vh. Sidebar `sticky top-0 h-screen`.
- Sidebar padding: `24px 16px`. Brand row `border-b border-border` separator.
- Main: padding `24px 32px 64px`, `max-width: 1280px`. `overflow-x: auto` for resilience on narrow viewports.

### Content rhythm

- **Topbar** (page title + sub + actions row): 20px bottom margin.
- **Section spacing** between cards / lists: 18px.
- **Card padding**: 24px default. Stat cards: 22px. Modal: 28px. Onboarding: 40px.
- **Top stat row** on dashboards: 3 columns × 1fr, gap 16px.
- **Two-column grid** (e.g. dashboard charts): 2fr 1fr, gap 16px.
- **Category grid** (add expense / income): 5 columns × 1fr, gap 8px.
- **Nav items** in sidebar: gap 6px between items, padding 10×14 on each.
- **Row separators** use 1px bottom border with 14–16px vertical padding inside rows.

### Spacing utility rules

- **4px base scale** (Tailwind v4 default). No 5px, 7px, 9px in production.
- **Two gaps per surface.** Vertical rhythm within a card ≤ 18px; between cards ≥ 16px.
- **Form rhythm**: label 11px caps, 6px gap, input, 14–16px gap, next label. Never two same-role labels stacked without a gap.

## Elevation & Depth

| Level | Shadow | Usage |
|---|---|---|
| **flat** | none | Inline cards (live-calc, dropzone, export contents). |
| **card** | `0 8px 28px rgba(0,0,0,0.35)` dark / `0 8px 28px rgba(42,38,32,0.08)` light | Default card surface. |
| **modal** | `0 10px 40px rgba(0,0,0,0.5)` dark / `0 10px 40px rgba(42,38,32,0.18)` light | Modal, onboarding hero card. |
| **overlay** | `rgba(15,20,25,0.6)` + `backdrop-filter: blur(6px)` dark / `rgba(42,38,32,0.25)` + blur light | Modal scrim. |

### Elevation rules

- **Two shadow strengths, no more.** card and modal.
- **No color-tinted shadows.** Pure black-based dark-mode shadows, brown-based light-mode shadows.
- **No glow, no rim-light, no inner shadow.** Only drop shadow.
- **Modal scrim always blurs.** `backdrop-filter: blur(6px)` is part of the modal contract.

## Shapes

| Token | Radius | Usage |
|---|---|---|
| `--r-card` | 18px | Cards, modal, onboarding hero card. |
| `--r-btn` | 12px | Buttons, amount input, modal inputs. |
| `--r-input` | 10px | Form inputs, selects. |
| `--r-tile` | 11px | Account tiles, category tiles (smaller than card). |
| `--r-icon-btn` | 8px | Icon-only buttons (36×36). |
| `--r-logo` | 12px | Brand logo marker. |
| `--r-pill` | 999px | Chips, filters, goal percentage, theme picker pill, toggle track. |

Shape rules:

- **Six radii, no more.** Each radius has a defined usage; do not introduce a 7th.
- **Pills are always fully rounded.** Never half-rounded.
- **Modal corner = card corner.** Always 18px.
- **Brand logo uses 12px.** Distinct from card radius so the logo reads as a "chip" not a "card."

## Components

### Button

- Default: `bg-primary text-primary-on rounded-btn px-4 py-2.5 font-bold text-[13.5px]`.
- Secondary: `bg-transparent text-ink border border-border rounded-btn`.
- Danger: `bg-danger text-white rounded-btn`.
- Hover: `opacity: 0.9`. No transform, no color shift.
- Icon-only: 36×36 square, `rounded-[8px]`, `bg-surface border border-border`.

### Card

- `bg-surface border border-border rounded-card shadow-card p-6`.
- Inline (flat) variant: drop shadow + border retained, no extra padding.
- Hover: no change. Cards are not interactive.

### Form

- Input: `bg-surface-2 border border-border rounded-[10px] px-[14px] py-3`.
- Select: inherits input styles.
- Textarea: same as input, `min-h` 80px.
- Label: `text-[11px] uppercase tracking-[0.06em] font-semibold text-muted`, 6px below input.
- Amount input: special — `bg-surface-2 border border-border rounded-btn px-[14px] py-3.5 text-[32px] font-bold tabular text-primary`. Focus ring: `ring-2 ring-primary/40`.

### Chip

- Default: `bg-surface-2 border border-border text-muted rounded-pill px-3 py-1.5 text-[12.5px]`.
- Selected: `bg-primary-soft text-primary border-primary/40 font-semibold`.

### Transaction row

- Container: full-width, `border-b border-border last:border-0`, `py-3` (compact) or `py-4` (dashboard).
- Direction icon: 36×36, `rounded-[14px]`, `bg-{role}-soft text-{role}`. Glyph: `↑` income / `↓` expense / `⇄` transfer.
- Title: tx-title role. Falls back to `cat?.name || tx.type` if no note.
- Sub: tx-sub role. `12 Aug · Cash · Food` or `Transfer · Cash → bKash`.
- Amount: `font-bold tabular`, color semantic (primary for income, danger for expense, ink for transfer).

### Modal / ConfirmDialog

- Backdrop: `fixed inset-0 bg-overlay backdrop-blur-[6px]`.
- Body: `bg-surface border border-border rounded-card p-7 w-[420px] max-w-[90vw] shadow-modal`.
- Title: h3-modal (Fraunces).
- Body text: caption.
- Danger callout (when `dangerText` present): **real surface** (2026-08-14 override) — `bg-danger-callout-bg text-danger-title border border-danger rounded-lg px-3 py-2.5` with `inset 0 0 0 1px rgba(224,96,80,0.35)` for a triple-line emphasis. Title uses lighter `#F08574` for hierarchy; button uses saturated `#E06050`. Never an opaque tint over `bg` — the callout must read as a distinct surface.
- Success / info alert (in-page, not modal): `bg-success-callout-bg text-success-title border border-success rounded-lg px-3 py-2.5` with `inset 0 0 0 1px rgba(107,170,138,0.35)`. Never borrows danger-soft.
- Actions: Cancel (secondary) + Confirm (primary or danger), right-aligned. Stack horizontally on ≥420px, vertically below 420px.

### Sidebar nav item

- `flex items-center gap-3 px-[14px] py-[10px] rounded-btn text-[13.5px] font-medium`.
- Active: `bg-primary-soft text-primary`.
- Hover: `bg-surface-2 text-ink`.
- Icon: 18px slot, glyph centered.

### Toggle

- Track: 38×22 pill (`rounded-pill`).
- Thumb: 18px circle, `bg-surface` (off) or `bg-primary-on` (on). 2px inset.
- Track fill: `bg-surface-3` (off) / `bg-primary` (on).
- Focus ring: `ring-2 ring-primary/40`.

### Goal progress bar

- Track: pill, `bg-surface-2`, height 10px.
- Fill: `linear-gradient(90deg, primary, accent)`. The only gradient in the system.
- Percentage chip: `bg-accent-soft text-accent rounded-pill px-2.5 py-[3px] text-[11px] font-bold`.

### Empty state

- Centered, `py-9` minimum height.
- One short sentence (caption).
- Optionally: 1 primary action button.

### Demo banner

- `bg-surface-2 border border-dashed border-border rounded-card px-4 py-2.5 text-[13px] text-muted`.
- Accent dot (8px circle, `bg-accent`) at the start.
- Inline "Start using Finora →" link in primary color.
- Optional close (×) on the right.

## Iconography

- **No SVG icon library.** All icons are Unicode glyphs.
- **Nav**: `⌂` Home, `⇄` Transactions, `◎` Accounts, `★` Goals, `🏦` Investments, `◐` Debts, `⚙` Settings.
- **Transaction direction**: `↑` income (primary), `↓` expense (danger), `⇄` transfer (accent), `✓` paid-off.
- **Category**: emoji tiles (🍔🛍🚗🏠💡💊🎓👨‍👩‍👧🎬💼💻🏪🎁`). Looked up via `src/lib/categoryEmoji.ts`.
- **Actions**: `+` add, `✕` close, `⚠` warn, `⬇` download, `⬆` upload, `⌕` search, `🗑` delete.
- **Theme**: `🌙☀📱` for the dark/light/auto picker.
- **Brand mark**: the real `finora-logo.svg` (three bars — gray, purple, teal — in a black rounded rect). Not a glyph.

Iconography rules:

- **One iconography style per surface.** Mixing SVG and glyphs on the same surface is a brand violation.
- **Glyphs are decoration, not communication.** Color + sign + label carry the meaning; the glyph is mnemonic.
- **Brand mark is the only SVG.** Adding per-feature icons is a future-direction ask, not a current rule.

## Do's and Don'ts

| Do | Don't |
|---|---|
| Use tabular numerals on every monetary value. | Let amounts visually drift in a list. |
| Pair sign glyph + color on money. | Encode direction by color alone. |
| Use Fraunces only on h1-display, h1-screen, h3-modal. | Italicize body copy. Use Fraunces in chips or stat labels. |
| Use the `success` sage for paid-off / completed states. | Use primary teal for success — that's the income role. |
| Show `dangerText` in a danger callout inside the modal, with a real surface. | Use a transparent tint over the page bg — the callout loses contrast. |
| Use a saturated danger button + lighter danger title for hierarchy. | Paint the title, border, and button all the same red — they collapse. |
| Use sage for in-page success/info alerts. | Reuse danger-soft for success — the two surfaces become indistinguishable. |
| Round the goal progress bar fill with `linear-gradient(90deg, primary, accent)`. | Add gradients elsewhere. |
| Use `bg-surface-2` for inputs, `bg-surface` for cards. | Use the same surface for both — inputs lose their recessed feel. |
| Pin the goal percentage chip to the right edge of the bar. | Center the percentage chip on the bar. |
| Show the modal scrim with `backdrop-filter: blur(6px)`. | Use a flat dim scrim. |
| Use `fmtBDT` formatting (`৳ 3,500`, en-IN grouping, space after symbol). | Use a different currency formatter per surface. |
| Keep the dark bg deep forest (`#1E2A26`), not pure black. | "Improve contrast" by switching to `#000` — kills the warm-register brand. |
| Keep the light bg warm cream (`#F7F4EC`), not pure white. | Move to pure white — loses the editorial warmth. |
| Tabular numerals on amounts. | (Repeated by design — money alignment is the brand.) |
