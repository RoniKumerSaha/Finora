---
status: final
name: Finora — Insights surface
date: 2026-08-14
sources:
  - ../ux-finora-2026-08-13/DESIGN.md
  - ../ux-finora-2026-08-13/EXPERIENCE.md
  - src/styles/theme.css
  - src/styles/app.css
  - src/components/Shell.tsx
  - src/domain/math.ts
parent_run: ux-finora-2026-08-13
updated: 2026-08-14
---

# Finora — Insights surface (`/insights`)

A peer contract to the existing V2 Soft design system. **The Insights surface inherits every token, color, type role, radius, elevation, and component from the parent run** (`../ux-finora-2026-08-13/DESIGN.md`). This document captures only the **information architecture, behavior, states, and key flow** that are net-new for the analytics surface. Visual identity is not redefined here — visual tokens are referenced by name.

> Spine rule. On any conflict between this run and the parent run, the parent wins for visual identity (color, type, shape, elevation). This run wins for behavioral decisions specific to Insights (date range persistence, empty-state policy, chart hover behavior).

## Foundation

- **Form factor**: web-desktop (inherits from parent).
- **UI system**: Tailwind v4 + CSS custom properties (inherits from parent).
- **Visual identity**: DESIGN.md `../ux-finora-2026-08-13/DESIGN.md` is the source of truth. No new tokens are introduced in this run.
- **Privacy stance**: **Local-only.** All analytics are computed from the in-memory store at render time. No third-party SDKs, no outbound events, no telemetry of any kind. This matches Finora's local-first brand promise.
- **Audience**: A single user looking at their own data. There are no other users, no sharing surfaces, no export affordances in V1.

## Information Architecture

### Entry point

- A new left-rail nav item **`Insights`** is inserted between **Home** and **Transactions** in the Shell sidebar.
- Glyph: `◇` (open diamond, unicode `\u25C7`) — neutral, no direction, matches the "observe, not act" register of the page.
- Active state uses the same primary-soft background + 3px primary edge bar as every other nav item.
- Route: `/insights`.

### Surface inventory

| # | Surface | Route | Purpose |
|---|---|---|---|
| 1 | Insights dashboard | `/insights` | All widgets on one scrollable page, filtered by a chosen date range. |

The Insights dashboard is a **single screen**. There are no drill-downs, no per-widget detail pages, no modal expansion in V1. If the user wants detail, they click through the row to the underlying domain screen (`/transactions`, `/goals/:id`, etc.) — the Insights page never duplicates the per-row click target.

### Date range model

- A pill row at the top-right of the page header: **This month · Last 3 months · Last 6 months · Last 12 months · All time**.
- **Default**: Last 6 months.
- **Persistence**: the chosen range is stored in `localStorage` under `finora.insights.range` (string key). The page reads the persisted value on mount and writes back on every change. New devices (no persisted value) see Last 6 months.
- **No custom date picker in V1.** A "Custom…" pill is deliberately absent — preset ranges cover the four meaningful reading scales and keep the pill row from collapsing into a menu.
- The pill row is **single-select**; clicking the active pill is a no-op (matches the transactions filter chip pattern).
- A sub-line under the page title reports the actual calendar range, e.g. *"Nov 2025 – Apr 2026"*. For "This month" the sub-line is the current month name. For "All time" it's *"Since {earliest transaction date}"* or *"Since you started tracking"* if there is none.

### Widget inventory

The page is composed of six widgets in a fixed top-to-bottom order. Order is **deliberate**, not user-configurable.

| # | Widget | Type | Visual |
|---|---|---|---|
| 1 | Stat row (3-up) | KPI tiles | Tabular number, eyebrow label |
| 2 | Cash flow | Grouped bar chart | SVG, primary + danger |
| 3 | Spending by category | Horizontal bar list | Top 6 + "Other" bucket |
| 4 | Net worth trajectory | Line chart | SVG, single line, primary |
| 5 | Goals | Goal-card list | Progress bar + ETA |
| 6 | Debts | Debt-card list | Progress bar + ETA-to-zero |
| 7 | Investments | Investment-card list | Maturity countdown |

(Counted as six widgets but seven items on the page — the 3-up stat row is one logical unit.)

### Layout grid

- **Page max-width**: 1280px (inherits from parent).
- **Section spacing**: 24px (`gap-6` between every section).
- **Stat row**: `grid-cols-3 gap-4`.
- **Cash flow, Investments**: full-width (`grid-cols-1`).
- **Spending/Net worth, Goals/Debts**: `grid-cols-2 gap-4`.
- **Card padding**: 24px (the `.card` primitive from the parent run).
- All cards share the same `.card` styling: surface bg, 1px border, 12px radius, two-layer shadow + 1px top inset highlight.

## Voice and Tone

- **Stat row labels** are uppercase 11px caps in muted color, matching the existing card section labels.
- **Stat values** are tabular, bold, sized to 28px on the stat row and 24px on the secondary widget values.
- **Sub-line under the title** is plain sentence-case ("Nov 2025 – Apr 2026"), not a sentence — the page speaks in fragments.
- **Empty states** are one short sentence: *"No transactions in this period."* Followed by a single CTA that links to the underlying module ("Add a transaction"). No emoji, no illustration.

## Component Patterns

### Date-range pill row

- Inherits the filter chip pattern from `TransactionsListScreen`. Same size, same radius (pill, fully rounded), same active treatment (`bg-primary-soft text-primary` with an inset primary ring at 35% opacity).
- Five pills, left-aligned within the header row.
- Active state: the same `inset 0 0 0 1px color-mix(in srgb, var(--primary) 35%, transparent)` ring from the parent run.

### Stat tile (3-up row)

- A `.card` primitive holding:
  - Uppercase 11px eyebrow label in muted.
  - 28px bold tabular number in semantic color (Net flow = primary if positive, danger if negative; Avg monthly expense = ink; Saved toward goals = accent gold).
  - Below the number, a 12px muted caption comparing the period to the previous period of equal length (e.g. *"+ 12% vs previous 6 months"*) when the previous period has data. When the previous period is empty, no comparison is shown.
- No delta arrow, no color-only signal — the comparison is the full text, color-blind safe.

### Cash flow chart

- **Type**: SVG grouped vertical bars.
- **X axis**: months, oldest on the left. Number of bars = number of calendar months in the chosen range (1–12) or, for "All time", capped at 12 with a "showing last 12 of {N} months" hint under the chart.
- **Y axis**: amount in BDT. Zero baseline at the bottom of the chart. No upper bound is drawn — the chart's height is sized so the tallest bar fills ~75% of the SVG height.
- **Bars**: each month has two adjacent bars (income left, expense right), 8px gap between the two, 16px gap between months. Income bar uses `var(--primary)`, expense bar uses `var(--danger)`.
- **Hover**: a vertical guide line (1px, muted) snaps to the hovered month. A tooltip floats above showing the month label, income amount (with `+` sign, primary), expense amount (with `−` sign, danger), and net (in ink). Hover state applies to either bar in the pair.
- **No animation** in V1 — bars render in their final state on mount.
- **Tap / click on a bar** is a no-op (V1). Future-proofing only; documented here so the click target isn't accidentally captured by a parent row.

### Spending by category

- A list of horizontal bars inside a `.card`. Title row shows the eyebrow label and the total expense for the period on the right.
- Top 6 categories by total amount in the period, plus a 7th row labeled **"Other"** that aggregates categories 7..N into a single bar.
- Each row:
  - 14px category name (left, truncate if long).
  - The amount in tabular on the right.
  - A 6px-tall bar below the name, width = (category amount / max(amounts)) × 100%, fill = `var(--accent)` (gold). Empty space below the bar is `var(--surface-2)`.
  - The percentage of total expense in 11px muted on the right next to the amount.
- Categories without any transactions in the period do not appear at all (no zero rows).
- Empty state: *"No expenses in this period."* with a CTA *"Add a transaction"* linking to `/transactions/new`.

### Net worth trajectory

- A single line chart inside a `.card`. Title row shows the eyebrow label and the current total balance on the right (ink color, bold).
- **Type**: SVG polyline, primary color, 2px stroke.
- **Dotted gridlines**: 4 horizontal lines at 0%, 25%, 50%, 75%, 100% of the y-range. 1px stroke, `var(--border-2)`, `stroke-dasharray="2 4"`.
- **End-point label**: a small filled circle at the last data point with the date and balance floating to the right of it. Uses `var(--primary-on)` fill inside `var(--primary)` ring.
- **Y axis**: total balance in BDT. Zero baseline shown. No dollar amounts on the y-axis ticks (avoids clutter — the endpoint label carries the current value).
- **X axis**: months, oldest on the left. Up to 12 tick marks.
- **No hover tooltip in V1** — the chart is "see the trend at a glance". The endpoint label carries the most recent value.
- **Empty state**: *"No balance history in this period."* with a CTA *"Add an account"* linking to `/accounts/add`.

### Goals widget

- A list of **active** goals inside a `.card`. Title row shows the eyebrow label and the goal count on the right.
- Each row:
  - Goal name (left, bold, 14px).
  - Per-month requirement on the right (e.g. *"৳ 8,500/mo"*) in accent gold, tabular.
  - A 8px progress bar (track = surface-2, fill = `linear-gradient(90deg, primary, accent)` — the only gradient in the system, inherited).
  - Below the bar: *"{pct}% · {fmtBDT(saved)} / {fmtBDT(target)}"* in 11px muted. ETA line below that: *"by {fmtDate(targetDate)}"*.
- Completed goals (`isGoalCompleted`) do not appear here — they don't need progress tracking.
- **Sort order**: by target date ascending (closest deadline first).
- **Click target**: the row is a `<Link>` to `/goals/:id` (whole-row hover affordance, chevron on hover).
- **Empty state**: *"No active goals."* with a CTA *"Set a goal"* linking to `/goals/add`.

### Debts widget

- A list of **active** debts inside a `.card`. Title row shows the eyebrow label and the debt count on the right.
- Each row:
  - Direction icon (↓ for i_owe in danger-soft, ↑ for owed_to_me in primary-soft, 32×32, 10px radius).
  - Debt name (bold, 14px).
  - Remaining amount on the right (`total - paidSoFar`) in semantic color (danger for i_owe, primary for owed_to_me).
  - A 6px progress bar showing `paidSoFar / total` — danger fill for i_owe, primary fill for owed_to_me.
  - Below the bar: *"{pct}% paid · {fmtBDT(paidSoFar)} of {fmtBDT(total)}"* in 11px muted. ETA-to-zero line (computed from the last 90 days of linked transactions, extrapolated) when enough data exists, otherwise "no recent payments to project ETA".
- **Sort order**: by due date ascending (closest due first); nulls last.
- **Click target**: `<Link>` to `/debts/:id/edit` (whole-row hover).
- **Empty state**: *"No active debts."* No CTA — the user can decide whether to track a debt.

### Investments widget

- A list of **active** investments inside a `.card`. Title row shows the eyebrow label and the total maturity value on the right (in accent gold, tabular).
- Each row:
  - Type emoji + name (left, bold, 14px).
  - Maturity value on the right (accent gold, tabular).
  - A second line: `"{days} days · {payoutAccountName} · {principal} · {rate}% · {termMonths}mo"` in 11px muted.
- **Sort order**: by days-to-maturity ascending (closest first). Matured investments (days ≤ 0) sort to the top.
- **Click target**: `<Link>` to `/investments/:id`.
- **Empty state**: *"No active investments."* with a CTA *"Add an investment"* linking to `/investments/add`.

## State Patterns

### Loading

- There is no loading state in V1. All data is read synchronously from the in-memory store and the page renders fully on first paint.

### Empty data

- **Per-widget empty state** (V1 decision). Each widget renders its own empty state inline if its specific data set is empty in the chosen range.
- An empty-state widget still occupies the same grid slot — it does not collapse the grid. The widget title (eyebrow) remains, so the user can see what the widget would show with data.
- Empty-state pattern: centered, padded (`py-8`), 14px muted sentence + optional CTA linking to the underlying module.

### No data at all (cold start)

- If there are zero transactions, zero accounts, zero goals, zero debts, zero investments across the entire store (not just the chosen range), the page renders **all six widgets** in their empty states. The user gets a tour of "here's what you'll see once you start tracking." This is a deliberate empty-state-as-onboarding pattern.
- The page header still shows the date range pills and the sub-line.

### Date range with no matching data

- If the chosen range has zero transactions but other ranges do, the user sees the empty-state widgets but the pill row still shows the current selection. Switching to a different range is one click.

### Computation cost

- All aggregations are pure functions over the in-memory transactions, accounts, goals, debts, investments arrays. Even with thousands of transactions, the render cost is sub-millisecond on modern hardware. No memoization is required in V1, but the heavy functions (`monthlyCashFlow`, `categoryBreakdown`, `netWorthSeries`, `goalEtas`, `debtEtas`) live in `src/domain/insights.ts` and can be memoized per-(range, data-version) in a future run.

## Interaction Primitives

### Date-range change

- Click a pill → range updates → all widgets re-derive.
- Persisted to `localStorage.finora.insights.range` immediately.
- No animation, no skeleton — the page just re-renders.

### Chart hover (Cash flow)

- Pointer move over the SVG → snap to the nearest month → show a 1px vertical guide + a tooltip.
- Tooltip: 11px monospace-feel block, `bg-surface border border-border rounded-input px-2.5 py-2 shadow-card`, positioned above the bar pair. Three rows: month name, income (primary, `+ ৳ X`), expense (danger, `− ৳ X`). Clamped to the chart bounds so it never escapes the card.
- Pointer leave → guide and tooltip disappear.

### Row hover (Goals, Debts, Investments)

- Whole-row hover affordance via the `.row-hover` primitive from the parent run.
- A 3px translucent primary bar appears on the left edge on hover.
- Chevron `›` appears on the right on hover (matches transactions list pattern).

### Keyboard

- The pill row is keyboard-navigable: each pill is a `<button>`, Tab moves between them, Enter activates. The active pill is announced by the focus ring (the global `.focus-ring` / `focus-visible:ring-2 focus-visible:ring-primary/40` contract).
- All `<Link>` rows are normal anchors and inherit the link focus ring.
- SVG charts have no tab stops in V1 (decorative).

## Accessibility Floor

- **Keyboard**: full keyboard access via Tab + Enter. No keyboard trap on the date range pills. The `<Link>` rows are normal anchors.
- **Focus**: global focus contract — every interactive element shows the 3px primary ring on `:focus-visible`.
- **Color**: amount color rules are dual-channel (color + sign + label) — already a parent-run rule. The cash-flow chart's income/expense distinction uses **color + position** (income bar is always the left bar of the pair). The tooltip carries the text labels so a screen reader / color-blind user has full access.
- **Reduced motion**: no animation in V1, so `prefers-reduced-motion` is satisfied trivially. Charts render in their final state.
- **Screen reader**: each widget is a `<section>` with an `aria-label` (e.g. "Cash flow over the last 6 months"). The stat row's three tiles are each a `<div role="group">` with an `aria-label` (e.g. "Net flow: positive ৳ 12,400, +12% vs previous 6 months"). The bar chart's SVG has a `<title>` child describing the visible data, and an `aria-label` on the SVG container that names the range and the totals.

## Key Flows

### Flow 1 — "I just want to know if I'm spending less this month"

**Protagonist**: Rahim, 31, freelancer. He logs transactions a few times a week and now wonders whether he's actually spending less than last month.

1. Rahim opens Finora. The sidebar's first item is Home (default). He clicks **Insights** in the sidebar.
2. The Insights page renders with the default Last 6 months range. The page header reads "Insights" and the sub-line reads "Nov 2025 – Apr 2026".
3. His eyes go straight to the **stat row**. He reads:
   - Net flow: `৳ 12,400` (positive, primary color, +12% vs previous 6 months).
   - Avg monthly expense: `৳ 34,500` (ink color, no comparison shown because the previous-period comparison for averages would be misleading without context).
   - Saved toward goals: `৳ 9,800` (accent gold, +5% vs previous).
4. He scans the **cash flow chart** and sees the green bars (income) are roughly steady across the six months while the red bars (expense) are visibly shorter in the last two months. He hovers the rightmost month and the tooltip confirms: Income `+ ৳ 60,000`, Expense `− ৳ 28,000`.
5. **Climax beat**: He scrolls down to the **Spending by category** widget and sees Food has shrunk to 22% of expenses (from 31% the prior 6 months). He realizes: yes, he's spending less this month, and the difference is concentrated in Food.
6. He clicks back to **Home** to record today's lunch.

### Flow 2 — "I'm two months from a goal deadline — am I on track?"

**Protagonist**: Sumaiya, 26, designer. She set a savings goal of `৳ 100,000` by Aug 31 and has been contributing unevenly.

1. Sumaiya clicks **Insights** from the sidebar.
2. The page renders with Last 6 months. She clicks the **This month** pill.
3. The date range sub-line updates to "Aug 2026".
4. The **goals widget** at the bottom shows her goal "Emergency fund" at 64% complete. Below the bar she reads *"by 31 Aug 2026"* and *"৳ 8,500/mo"* on the right.
5. **Climax beat**: She realizes at the current pace she's on track — the per-month requirement matches what she's been putting in. She closes the tab reassured.

### Flow 3 — "I have no data yet"

**Protagonist**: Karim, fresh install, no data.

1. Karim opens `/insights`. The page renders all six widgets, each in its empty state.
2. He reads the empty-state copy and notices three different CTAs: *"Add a transaction"*, *"Add an account"*, *"Set a goal"*, *"Add an investment"*.
3. **Climax beat**: He clicks *"Add a transaction"* on the cash flow widget, lands on the add-transaction picker, and begins to populate the app. When he returns to `/insights`, the cash flow widget now shows real data.

## Out of scope for V1 (deliberate)

The following are explicitly **not** in this run. They are documented here so they don't accidentally creep in.

- Custom date ranges.
- CSV / PDF / shareable exports.
- Predictive analytics ("you'll run out by March").
- Per-widget customization or hide-this-widget toggles.
- Drill-down from a chart bar to the underlying transactions.
- Cross-device sync.
- Comparison overlays (year-over-year, period-over-period) beyond the simple "+/- %" in the stat row caption.
- Annotations on the line chart.
- Mobile-specific layout (the page is web-desktop; mobile is deferred).

## Acceptance criteria

A run is complete when all of the following are true:

1. `/insights` route renders without errors with an empty store, with a populated store, and with a store that has data only in some ranges.
2. The Insights nav item appears between Home and Transactions, uses the ◇ glyph, and inherits the parent run's active-state styling.
3. All five date range pills work and the selection persists across reloads.
4. The six widgets each render their per-widget empty state when their data set is empty.
5. The cash flow chart's hover state shows a guide + tooltip with both income and expense.
6. The page renders correctly in both dark and light themes with no token redefinitions.
7. Keyboard navigation reaches every pill and every row link.
8. No third-party network requests are made when rendering or interacting with the page.