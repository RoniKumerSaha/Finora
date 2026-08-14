---
status: final
name: Finora — Insights visual delta
date: 2026-08-14
sources:
  - ../ux-finora-2026-08-13/DESIGN.md
  - ../ux-finora-2026-08-14-analytics/EXPERIENCE.md
parent_run: ux-finora-2026-08-13
updated: 2026-08-14
---

# Finora — Insights visual delta

This file is a **visual-only delta** against the parent design run (`../ux-finora-2026-08-13/DESIGN.md`). It introduces no new tokens, colors, radii, type roles, or component primitives. Every visual decision on the Insights surface inherits from the parent run. This delta documents **only**:

1. The one new nav glyph.
2. The stat-row number size inherited for use on the Insights stat tiles.
3. The chart palette assignment (which role-color each chart uses).

> Spine rule. On any visual conflict, the parent run wins. This file captures the by-name resolution only.

## Nav glyph (new)

The Insights nav item in `Shell.tsx` uses glyph **`◇`** (unicode `U+25C7`, "white diamond"). Encoding: `'\u25C7'`. Inherits the parent shell's nav rule: 18px slot, primary color when active (via the parent's `bg-primary-soft text-primary` + 3px edge bar).

## Stat row sizing (carried from parent)

The Insights stat row uses the parent's **`money-stat`** role verbatim: sans, 28px, weight 700, line-height 1.0, tracking −0.02em, tabular. No overrides.

The secondary widget value (e.g. "Total expense" in the Spending widget title row) uses **22px bold tabular** — one step under `money-stat`, one step above `caption`. This size is **only used on the Insights surface**; the parent doesn't define a name for it. If the team wants to formalize it across the app, that's a parent-run change, not this run.

## Chart palette assignment

| Chart | Element | Token |
|---|---|---|
| Cash flow | Income bar | `var(--primary)` |
| Cash flow | Expense bar | `var(--danger)` |
| Cash flow | Y-axis / gridlines / tooltip border | `var(--border)` / `var(--border-2)` |
| Cash flow | Tooltip background | `var(--surface)` |
| Net worth | Line stroke | `var(--primary)` |
| Net worth | End-point dot fill | `var(--primary-on)` (inside a `var(--primary)` ring) |
| Net worth | Gridlines | `var(--border-2)` (dotted, `stroke-dasharray="2 4"`) |
| Spending | Bar fill | `var(--accent)` |
| Spending | Bar track | `var(--surface-2)` |

No gradients, no glow, no glass — the parent's "no decoration" rule holds.

## Date-range pill row

Inherits the parent run's chip pattern verbatim. Pill, fully rounded, surface bg, border, 12px caps, font-weight 600. Active state: `bg-primary-soft text-primary` with `inset 0 0 0 1px color-mix(in srgb, var(--primary) 35%, transparent)`.

## Card primitive

Every widget is wrapped in the parent's `.card` primitive (surface bg, 1px border, 12px radius, two-layer shadow, 1px top inset highlight, 24px padding). No new card style.

## What this delta deliberately does NOT do

- Does not introduce new color tokens.
- Does not introduce new radii.
- Does not introduce new type roles.
- Does not introduce new shadows.
- Does not introduce new chip styles.
- Does not override any parent's `Do's and Don'ts`.

All visual novelty on the Insights surface comes from **composition** (a chart made of parent tokens) and **sequence** (what order widgets appear in), not from new tokens. This is by design: keeping token churn to zero means theming and dark/light parity stay free.