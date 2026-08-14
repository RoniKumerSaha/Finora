---
status: final
name: Finora — Insights Investments card (Active / To mature split)
date: 2026-08-14
sources:
  - ../ux-finora-2026-08-13/DESIGN.md
  - ../ux-finora-2026-08-14-analytics/EXPERIENCE.md
  - src/screens/InsightsScreen.tsx
  - src/screens/InvestmentsListScreen.tsx
  - src/domain/insights.ts
  - src/domain/math.ts
updated: 2026-08-14
---

# Finora — Insights Investments card (Active / To mature split)

A peer contract to the existing V2 Soft design system. **No new
visual tokens, colors, type roles, radii, or component primitives.**
The only change is the `InvestmentsCard` widget on `/insights`
grows a second stat tile — `To mature` — alongside its existing
maturity-value total, which is renamed to `Active`.

> Spine rule. On any conflict between this run and the parent run
> or the analytics sister-run, those runs win. This file is a
> card-header tweak, not a redesign.

## Foundation

- **Form factor**: web-desktop (inherits from parent).
- **UI system**: Tailwind v4 + CSS custom properties (inherits
  from parent).
- **Visual identity**: `../ux-finora-2026-08-13/DESIGN.md` is the
  source of truth. No new tokens introduced.

This run does not produce a `DESIGN.md`.

## Information Architecture

### Before / after

| Surface | Before | After |
|---|---|---|
| Insights Investments card header (right) | Single tile: maturity value total, accent | Two tiles: **Active** (accent) + **To mature** (primary), grid-cols-2 |
| Insights Investments card header (left) | "Investments" h3-modal | "Investments" h3-modal (unchanged) |
| Per-row maturity display | Right-aligned `৳ {maturityValue}` per row | Unchanged |
| Per-row principal sub-line | `… · ৳ {principal} · …` | Unchanged |
| Investments list page header (`/investments`) | Title + count + CTA | **Not modified by this run** |

### What stays on the Investments card

- The "Investments" title.
- The list of up to 5 active investments (closest-to-maturity first,
  then matured ones pinned to the top).
- The "+ Add an investment" CTA in the empty state.
- The per-row maturity and principal figures.

### What changes

The header right side becomes a two-tile stat grid. Both tiles are
peer values — neither subordinate. Their visual treatment
differentiates by hue (accent vs primary), not by size or
weight.

## Voice and Tone

- **Active** — eyebrow label, eyebrow + tabular accent value.
- **To mature** — eyebrow label, eyebrow + tabular primary value.

No "Total" prefix on either. The label "Active" alone implies
"total of active principals" given the surrounding context (it's
inside an "Investments" card). Adding "Total active" would be
redundant given the visual frame.

## Component Patterns

### Two-tile stat grid

The card header row becomes:

```html
<div class="flex justify-between items-end mb-3">
  <h2 class="heading h3-modal">Investments</h2>
  <div class="grid grid-cols-2 gap-x-6 text-right">
    <div>
      <div class="text-[11px] text-muted uppercase tracking-wider font-semibold">Active</div>
      <div class="text-[20px] font-bold tabular text-accent mt-1 leading-none tracking-[-0.02em]">৳ {fmtBDT(totalActive)}</div>
    </div>
    <div>
      <div class="text-[11px] text-muted uppercase tracking-wider font-semibold">To mature</div>
      <div class="text-[20px] font-bold tabular text-primary mt-1 leading-none tracking-[-0.02em]">৳ {fmtBDT(totalMaturity)}</div>
    </div>
  </div>
</div>
```

Each tile is ~120px wide on a 4-column grid (`Active` is the
inner left, `To mature` the inner right). The `gap-x-6` puts 24px
between them. The grid sits at the right end of the existing
`justify-between` header row.

### Math

```ts
const totalActive = investments.reduce((s, i) =>
  s + (activePrincipalOf(i)), 0);
const totalMaturity = investments.reduce((s, i) =>
  s + i.maturityValue, 0);

function activePrincipalOf(inv: InvestmentRow): number {
  // For DPS rows: sum of contributions paid in so far.
  // For FDR/savings rows: principal.
  // investmentsForInsights does not currently distinguish, so we
  // re-derive DPS contribution here.
  if (inv.type === 'dps') {
    return dpsContributedSoFar(inv, state.transactions);
  }
  return Number(inv.principal) || 0;
}
```

Note: the existing `InvestmentRow` shape doesn't carry the DPS
contributed-so-far. The component either extends the row shape
(lowest-cost: add `contributedSoFar: number` to `InvestmentRow`),
or inlines a one-line re-derivation against the store. The
inline path is preferred because:

- The shape change is additive but the function is `state`-aware
  already — calling it inline keeps the row type single-purpose.
- One-line change, zero test churn.

### Tile sizing

`text-[20px]` is smaller than the page-level stat-row tiles
(`text-[28px]`), matching the chart caption family used by the
`SpendingCard`'s "Total ৳ X" line. Same tabular treatment.

## State Patterns

### Empty state (zero active investments)

- **Active** tile: `৳ 0`
- **To mature** tile: `—` (em-dash, matching the existing
  card's empty-money convention)
- The card body renders the existing "No active investments."
  empty state with the "Add an investment" CTA.

### Populated state

- Both tiles populated with their sums.
- Per-row list below the header.

### Mixed (some matured, some active)

- Both tiles populated from active rows only (the selector
  `investmentsForInsights` already excludes
  `status === 'closed' || status === 'rolled_over'`, so the sums
  are by definition from "still in flight" investments, including
  the matured-but-not-claimed ones which have `daysToMaturity ≤ 0`).
- The matured-but-not-claimed rows still appear at the top of the
  list with a "Matured" badge. They contribute to both Active
  and To mature sums (their principal is real and locked, their
  maturity value is real and earned).

## Interaction Primitives

### Reading the tiles

Both tiles are read-only. No click targets, no tooltips, no
popovers.

### Row links

The list rows beneath remain `<Link>` elements routing to
`/investments/{id}` — unchanged.

## Accessibility Floor

- The two tiles are non-interactive. Screen readers announce the
  card header as "Investments. Active. Two lakh nineteen thousand
  taka. To mature. Three lakh forty thousand one hundred fifty
  taka." (the eyebrows act as labels).
- The card structure remains a single `<div class="card">` with an
  `h3-modal` title. No landmark role change.

## Key Flows

### Flow 1 — "What's locked vs what I'll get back?"

**Protagonist**: Rahim, 31, freelancer. He glances at the Insights
page once a week.

1. He opens `/insights`, scrolls past the stat row, charts, and
   reaches the Investments card.
2. He sees **Active ৳ 2,19,000** and **To mature ৳ 3,40,150**
   side by side.
3. **Climax beat**: He sees at a glance that his future money
   (3,40,150) is meaningfully larger than his locked principal
   (2,19,000). The gap is the future interest.
4. He doesn't click into any specific investment today.

### Flow 2 — "Did the FDR payout change my totals?"

**Protagonist**: Sumaiya, 26, designer. She records an FDR payout
as Income and returns to Insights.

1. She opens `/insights`. The Investments card reads:
   **Active ৳ 0** | **To mature ৳ 0**. (The FDR that paid out
   flipped to `closed`, removed from `investmentsForInsights`.)
2. **Climax beat**: Both tiles read zero. She sees that the
   card now reflects the new state and the closed FDR no longer
   contributes. She navigates to the Investments list to see the
   closed row.

### Out of scope (deliberate)

- A "Closed total" tile.
- Per-type breakdown.
- A popover with month-by-month projection.
- Renaming any other tile on the Insights screen.
- Modifying `InvestmentsListScreen`.

## Acceptance criteria

A run is complete when all of the following are true:

1. The Insights Investments card header right side renders two
   tiles: `Active ৳ X` and `To mature ৳ Y`.
2. `Active` sums to the DPS-aware active principal total across
   rows returned by `investmentsForInsights(state)`:
   - DPS rows: `dpsContributedSoFar(inv, transactions)`
   - FDR / savings rows: `Number(inv.principal)`
3. `To mature` sums to the existing `inv.maturityValue` total
   across the same rows.
4. When there are zero active investments, `Active` renders
   `৳ 0` and `To mature` renders `—`.
5. The card body (list of up to 5 rows + empty state) is
   unchanged in behavior.
6. The Investments list page header is **not** modified.
7. No new tokens, colors, type roles, or component primitives
   are introduced. The two tiles reuse the eyebrow + tabular
   value pattern from the Insights stat row.
8. The build is clean and the test suite passes (93 tests).