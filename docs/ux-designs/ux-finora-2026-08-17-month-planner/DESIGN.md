---
status: final
name: Finora — Plan sections
description: Visual spec for the /plan hub, Month Planner, Event Planner, and Card-total checker. Inherits tokens from ../../ux-finora-2026-08-13/DESIGN.md. Cross-referenced as `{plan.design.*}`.
sources:
  - ../ux-finora-2026-08-13/DESIGN.md
  - ../ux-finora-2026-08-13/EXPERIENCE.md
  - src/styles/theme.css
updated: 2026-08-17
colors:
  # Plan sections don't introduce new colour tokens — they reuse
  # the existing palette. Surface-tier colours are pinned here for
  # reference; full list lives in the parent DESIGN.md.
  primary: '#5DBFA0'        # dark ; bright teal
  primary-light: '#0D8275'  # light
  warn: '#F4B860'           # urgency chip on event list (≤7 days)
  success-title: '#82BFA0'  # saved-tile / saving figure
  danger-title: '#F08574'   # over-budget / deficit figure
  bg: '#1E2A26'             # dark ; grid panel surface
  bg-light: '#EFE5D0'       # light
  surface: '#253229'        # dark ; standard card
  surface-light: '#F8F2E3'  # light
  surface-2: '#2E3C34'      # dark ; chip / mini-row background
  surface-2-light: '#F0E5CC'
  text: '#F1E3EF'          # ink ; tile body, item name
  text-light: '#2A2620'
  muted: '#94A59C'          # micro-labels, footers, secondary copy
  muted-light: '#7A6F5E'
  border: '#324139'         # tile, chip, divider lines
  border-light: '#D8C9A6'
ring_palette:               # stable-random per item-id (6 tones)
  - var(--primary)
  - var(--accent)
  - var(--info)
  - var(--warn)
  - var(--cyan)
  - var(--orange)
typography:
  # Reuses parent roles; per-surface tweaks pinned below.
  hub-card-eyebrow: { font: 'system-sans', size: 11, weight: 600, lh: 1.0, tracking: 0.08, transform: 'uppercase' }
  hub-card-title:   { font: 'system-sans', size: 18, weight: 600, lh: 1.25, tracking: -0.005 }
  hub-card-chip:    { font: 'system-sans', size: 10, weight: 700, lh: 1.0, tracking: 0.04, transform: 'uppercase' }
  mini-row-name:    { font: 'system-sans', size: 13, weight: 600, lh: 1.3, tracking: 0 }
  mini-row-amount:  { font: 'system-sans', size: 12, weight: 700, lh: 1.0, tracking: -0.005, tabular: true }
  mini-row-pill:    { font: 'system-sans', size: 10, weight: 700, lh: 1.0, tracking: 0.04, transform: 'uppercase' }
  tile-title:       { font: 'system-sans', size: 14, weight: 600, lh: 1.3, tracking: 0 }
  tile-budget:      { font: 'system-sans', size: 15, weight: 700, lh: 1.0, tracking: 0, tabular: true }
  tile-microlabel:  { font: 'system-sans', size: 10, weight: 600, lh: 1.0, tracking: 0.08, transform: 'uppercase' }
  checker-heading:  { font: 'Fraunces',    size: 18, weight: 600, lh: 1.25, tracking: -0.005 }
  checker-eyebrow:  { font: 'system-sans', size: 11, weight: 600, lh: 1.0, tracking: 0.08, transform: 'uppercase' }
  checker-body:     { font: 'system-sans', size: 14, weight: 400, lh: 1.55, tracking: 0 }
  checker-figures:  { font: 'system-sans', size: 16, weight: 700, lh: 1.0, tracking: 0, tabular: true }
  checker-label:    { font: 'system-sans', size: 12.5, weight: 400, lh: 1.45, tracking: 0 }
  toolbar-status:   { font: 'system-sans', size: 12.5, weight: 400, lh: 1.45, tracking: 0 }
rounded:
  hub-card: 14
  tile: 14
  chip: 10
  mini-row: 10
  pill: 9999
spacing:
  hub-grid-gap: 16
  tile-grid-gap: 16
  mini-row-gap: 6
---

# Finora — Plan sections DESIGN.md

> Visual spec for the `/plan` hub, Month Planner, Event Planner, and Card-total checker. Behaviour lives in `EXPERIENCE.md` next to this file. Cross-references inherit `{DESIGN.md.*}` from `../ux-finora-2026-08-13/DESIGN.md`; only the surfaces that diverge are pinned in full below.

## Token inheritance

This file does not introduce new colour, type, or radius tokens. Every spec below maps onto the existing palette in `../ux-finora-2026-08-13/DESIGN.md`. Where a surface uses a non-obvious role (e.g. a card that lives on `--bg`), it's called out inline.

The only **plan-specific** constants are:
- `ring_palette` — the 6-tone array used by the deterministic ring colour picker (`randomToneColor` in `MonthPlanScreen.tsx`). Indexed by `Math.abs(charCodeSum(id)) % 6`.
- `tile-grid` — 2 cols on mobile, 3 cols at `md+`.
- `hub-grid` — 1 col on mobile, 2 cols at `md+`.

## Plan Hub (`/plan`)

### Grid shell

```
<grid grid-cols-1 md:grid-cols-2 gap-{hub-grid-gap}>
  <Link class="card …">
    …
  </Link>
  <Link class="card …">
    …
  </Link>
</grid>
```

### Card

Standard `.card` surface: `bg-surface`, `border-border`, `rounded-{hub-card}`, `padding 24px`. The whole card is the click target. Hover adds `border-primary` (transition).

#### Header row

```
┌───────────────────────────────────────────────┐
│ MONTH PLANNER                       ● AUG 2026│
│ Plan my month                                 │
└───────────────────────────────────────────────┘
```

- Eyebrow: `text-muted` / `text-{hub-card-eyebrow.size}` / uppercase / `tracking-[0.08em]` / `font-semibold`.
- Title: `text-ink` / `text-{hub-card-title.size}` / `font-semibold` / `tracking-tight`.
- Pill (right): `bg-surface-2 border-border rounded-pill px-2.5 py-1 text-{hub-card-chip.size} text-muted uppercase tracking-[0.04em] font-bold`. A 4×4 dot in `--primary` sits inside, then the label (`August 2026` / `7 events`).

#### Description

`text-sm text-muted leading-relaxed`. One short sentence — `Fill items by category. Save the plan, reset when you want a fresh start — no history kept.`

#### Mini-list (Month Planner)

Up to 5 rows. Each row:

```
┌───────────────────────────────────────────────┐
│ 🥦  Groceries                            ৳ 12,000 │
└───────────────────────────────────────────────┘
```

- Surface: `bg-surface-2 border border-border rounded-{mini-row} px-2.5 py-2`.
- Emoji: `text-[16px] shrink-0`.
- Name: `text-[13px] font-semibold text-ink truncate flex-1 min-w-0`.
- Amount (right): `text-[12px] font-bold tabular text-ink shrink-0`.
- Row gap: `gap-1.5` between rows. Outer wrapper: `flex flex-col gap-1.5 -mx-1` (negative margin to align with card padding).

Overflow: `text-[11px] text-muted text-center pt-1` `+N more`.

Empty state: `text-[11.5px] text-muted` — single muted line in place of the list.

#### Mini-list (Event Planner)

Up to 3 rows. Same surface + emoji + name rules, but the right pill uses `daysLabel`:

- Days < 0 (past): `text-muted`.
- Days 0–7 (urgent): `text-warn`.
- Days > 7 (future): `text-primary`.

Pill is the same `hub-card-chip` typography but reads as the urgency label (`today` / `in 1 day` / `in 12 days` / `1 day ago` / `5 days ago`).

#### Footer

`pt-3 border-t border-border text-[11.5px] text-muted tabular` — single short line. For Month: `N items`. For Event: `Next: <name> · N days away`.

When the planner is empty, the footer is omitted (the empty-state nudge carries the load).

#### Hub footer (below both cards)

`text-xs text-muted text-center mt-2` — single `ⓘ` line restating the scratch contract.

## Month Planner (`/plan/month`)

### Toolbar

`flex flex-wrap items-center gap-3 sm:gap-5`. No card chrome — the toolbar sits directly on the page background.

#### Status dot

A 8×8 filled circle:
- `Saved` → `bg-success`, soft halo via `box-shadow: 0 0 0 3px color-mix(in srgb, var(--success) 25%, transparent)`.
- `Unsaved changes` → `bg-warn`, same halo with `--warn`.

Status text: `text-{toolbar-status.size} text-muted` immediately to the right.

#### Divider

`hidden sm:block h-5 w-px bg-border` — vertical, only at `sm+`. At narrow widths the toolbar wraps cleanly.

#### Buttons

- `Reset` — `Button variant="ghost"`. `font-semibold` `text-[13px]`.
- `Save plan` — `Button variant="primary"`. `bg-primary text-primary-on`, the same shape as the other primary CTAs.

Both buttons are right-aligned via `ml-auto` on the buttons wrapper.

### Heading

`heading h1-screen` (Fraunces 22/600/tracking −0.01). Description underneath: `text-muted text-[13px] mt-1.5`. No pager — the active key is locked to the current month.

### Items grid

#### Grid shell

`grid grid-cols-2 md:grid-cols-3 gap-{tile-grid-gap}` inside `rounded-{tile} border border-border p-6` on `--bg`.

The grid panel sits on `--bg` (not `--surface`) so each item tile visually lifts off. The tile itself is `bg-surface-2 border-border rounded-{tile}`.

#### Item tile

```
┌──────────────────────┐
│   ⬤  Groceries      │   ← ring + name
│      BUDGET ৳ 12,000 │   ← micro-label + amount
└──────────────────────┘
```

- **Ring disc:** `w-[68px] h-[68px] rounded-full` with the deterministic palette colour (see `ring_palette`). Inner disc `bg-surface-2 w-[56px] h-[56px] rounded-full` so the donut band is 6px wide.
- **Emoji:** `text-[24px]` centred inside the inner disc.
- **Body:** `flex flex-col gap-1 min-w-0 flex-1`.
  - Title: `text-{tile-title.size} font-semibold text-ink leading-snug truncate`.
  - Budget row: `flex items-baseline gap-1`.
    - Micro-label: `text-{tile-microlabel.size} uppercase tracking-[0.08em] font-semibold text-muted shrink-0`.
    - Amount: `text-{tile-budget.size} font-bold tabular text-ink whitespace-nowrap truncate`. When `budget === 0`, the amount renders an em-dash `—` in the same `font-bold` weight, slightly muted via `text-muted`.

#### Add item tile

`min-h-[110px] rounded-{tile} border border-dashed border-border` with a `+` glyph + `+ New item` label. Hover: `border-primary text-primary`. `bg: color-mix(in srgb, var(--surface-2) 60%, transparent)`.

### Card-total checker

```
┌─────────────────────────────────────────────────────────┐
│ QUICK TOTAL                                            │
│ Check the cards you'll pay                            │
│ Tick items, set your income, see how much you'd save. │
│                                                        │
│ Income  ৳ [_____]                                      │
│                                                        │
│ [🥦 Groceries ৳12k] [🏠 Rent ৳18k] [🚗 Transport ৳6k] │
│ [💡 Bills ৳4k]  [🎮 Fun ৳3k]  …                       │
│                                                        │
│ 3 of 7 selected   ·   Total ৳ 24,000  ·   Saved ৳ 11,000│
└─────────────────────────────────────────────────────────┘
```

#### Wrapper

`card flex flex-col gap-4`. Standard surface. `aria-labelledby="card-checker-title"` on the section.

#### Header

- Eyebrow: `text-[11px] text-muted uppercase tracking-[0.08em] font-semibold` `Quick total`.
- Heading: `h2 id="card-checker-title"` Fraunces 18/600, `tracking-tight`, `mt-1.5`.
- Description: `text-sm text-muted mt-1.5 whitespace-nowrap` — single line, never wraps. Tight copy: `Tick items, set your income, see how much you'd save (or overspend). Nothing is saved.`
- `Clear selection` ghost link: `text-[12.5px] text-muted hover:text-ink font-semibold underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-primary/40`. Right-aligned in the header row.

#### Income row

- Label: `text-[11px] uppercase tracking-[0.08em] font-semibold text-muted`.
- Input shell: `inline-flex items-center gap-0.5 px-3 py-2 rounded-{chip} border border-border bg-surface-2`.
- `৳` prefix: `text-[13px] text-muted`.
- Number input: `bg-transparent border-0 border-b border-dashed tabular w-[100px] text-right font-semibold text-ink`. Underline colour: `color-mix(in srgb, var(--ink) 25%, transparent)`.
- Helper: `text-[11px] text-muted`.

#### Chips grid

`flex flex-wrap gap-2`. Each chip:

```
[ ☐  🥦 Groceries           ৳12,000 ]
```

- Selected: `bg-primary/10 border-primary text-ink`.
- Unselected: `bg-surface-2 border-border text-ink hover:border-ink-2`.
- Inner:
  - Check circle: `w-4 h-4 rounded-full shrink-0` — selected fills with `bg-primary text-white` and shows the SVG checkmark; unselected is `border border-border bg-surface`.
  - Emoji: `text-[15px] shrink-0`.
  - Name: `text-[13px] font-semibold truncate max-w-[160px]`.
  - Amount: `text-[12.5px] text-muted tabular shrink-0`.
- Chip is `<button role="checkbox" aria-checked={isSelected}>`.

#### Footer

`pt-3 border-t border-border flex flex-wrap items-baseline gap-x-5 gap-y-1`:
- `<b class="text-ink">N</b> of M selected` — `text-[12.5px] text-muted tabular`.
- `Total <b class="text-ink text-[16px] font-bold tabular">৳X,XXX</b>` — same.
- When `income > 0`:
  - Saving ≥ 0: `Saved <b style="color: var(--success-title); font-size: 16px" class="font-bold tabular">৳Y</b>`.
  - Saving < 0: `Over by <b style="color: var(--danger-title); font-size: 16px" class="font-bold tabular">৳Y</b>` — uses `Math.abs(saving)`.

Empty items case: `text-[12.5px] text-muted` `No items in this month's plan yet — open the planner to start.` — replaces the chips + footer.

## Event Planner

### List row

`flex items-center gap-2.5 px-2.5 py-2 rounded-{mini-row} bg-surface-2 border border-border`. Emoji + name (truncate) + days-to-go pill (right). Same urgency colour ramp as the hub mini-list.

### Detail header

`flex flex-wrap items-center gap-3 sm:gap-5` — status pill left, action buttons right. Same toolbar pattern as the Month Planner; no separate row above the heading.

### Category card

`card flex flex-col gap-3` — emoji + name (Fraunces 18/600) + status chips (`Paid in full` / `N days overdue` / `Due in N days`) + budget figure + optional due-date chip + delete button.

Status chip typography: `text-[10px] font-bold uppercase tracking-[0.04em]`. Same urgency palette.

### Line item row

`flex items-center gap-3 px-3 py-2 rounded-{chip} bg-surface-2 border border-border`:
- Done checkbox: `w-5 h-5 rounded` — checked = `bg-success text-white`, unchecked = `border-border bg-surface`.
- Label: `text-[13px]` — `line-through text-muted` when done.
- Amount (right): `text-[13px] font-bold tabular text-ink`.
- Delete: ghost icon button, only on hover.

## Modal specs

Both `NewItemModal` and `JarEditorModal` are centred, 480px wide, `bg-surface border-border rounded-card`, blurred backdrop. Standard `Field` / `Input` / `Button` components.

### NewItemModal

```
┌─────────────────────────────────────┐
│ New item                      ✕    │
├─────────────────────────────────────┤
│ Emoji    [🍜]                       │
│ Name     [_______________________]  │
│ Budget   ৳ [_____________________]  │
│                                     │
│              Cancel   Save item     │
└─────────────────────────────────────┘
```

- `Cancel` (ghost) + `Save item` (primary) right-aligned.
- Validation: name required (banner on empty submit).
- Emoji picker is a popup grid (`EmojiPicker`); 8 cols × 6 rows of common food / activity / object emoji.

### JarEditorModal

Same shell as NewItemModal + an extra `Clear budget` ghost pill in the action row, and a destructive `🗑 Delete` button on the left of the action row.

```
┌─────────────────────────────────────┐
│ Edit item                     ✕    │
├─────────────────────────────────────┤
│ Emoji    [🍜]                       │
│ Name     [_______________________]  │
│ Budget   ৳ [_____________________]  │
│                                     │
│ 🗑 Delete  Clear budget  Cancel  Save│
└─────────────────────────────────────┘
```

## Token map (quick lookup)

| Token | Value | Used by |
|---|---|---|
| `ring_palette[0]` | `var(--primary)` | Random ring colour (deterministic per id) |
| `ring_palette[3]` | `var(--warn)` | Random ring colour |
| `surface-2` | `bg-surface-2` | Chip / mini-row / item tile |
| `bg` | Items grid panel | Lifts tiles off the panel |
| `border` | All borders | Cards, chips, mini-rows |
| `text-muted` | Microcopy | Footer, eyebrow, helper text |
| `success-title` | Saving figure | Checker footer |
| `danger-title` | Over-budget figure | Checker footer |

## Source Trace

- `src/styles/theme.css` — every colour / radius / spacing token used above.
- `src/screens/PlanScreen.tsx` — hub layout, mini-list rendering.
- `src/screens/MonthPlanScreen.tsx` — toolbar, heading, item grid, ring colour picker.
- `src/screens/plan/CardTotalChecker.tsx` — checker chrome, chip styling, footer figures.
- `src/screens/EventPlanDetailScreen.tsx` — event detail header, category cards, line items.