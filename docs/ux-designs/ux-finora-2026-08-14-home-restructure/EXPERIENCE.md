---
status: final
name: Finora — Home restructure (thin snapshot, analytics on Insights)
date: 2026-08-14
sources:
  - ../ux-finora-2026-08-13/DESIGN.md
  - ../ux-finora-2026-08-13/EXPERIENCE.md
  - ../ux-finora-2026-08-14-analytics/EXPERIENCE.md
  - ../ux-finora-2026-08-14-analytics/DESIGN.md
  - src/screens/HomeScreen.tsx (before)
  - src/screens/InsightsScreen.tsx
parent_run: ux-finora-2026-08-13
sister_run: ux-finora-2026-08-14-analytics
updated: 2026-08-14
---

# Finora — Home restructure

A peer contract to the existing V2 Soft design system and to the
analytics spine. **No new visual tokens, colors, type roles, radii, or
component primitives.** The only thing this run changes is *what
content lives where* on Home, and what disappears from Home that was
already duplicated on Insights.

> Spine rule. On any conflict between this run and the parent run or
> the analytics sister-run, those runs win. This file is an IA
> rebalance, not a visual redesign.

## Foundation

- **Form factor**: web-desktop (inherits from parent).
- **UI system**: Tailwind v4 + CSS custom properties (inherits from
  parent).
- **Visual identity**: `../ux-finora-2026-08-13/DESIGN.md` is the
  source of truth. No new tokens introduced.
- **Privacy stance**: local-only (inherits from parent + analytics
  spine).
- **Audience**: the single user, looking at their own data.

This run does not produce a `DESIGN.md`. The parent run's DESIGN.md
is the only one that owns tokens. The analytics spine's DESIGN.md
already captures the by-name resolution for the Insights surface; no
new visual novelty is added here.

## Information Architecture

### The split

The product has two pages that both answer "where is my money?" but at
different cadences. The restructure separates them by **cadence**,
not by content domain.

| Page | Cadence | Job to be done | Date control |
|---|---|---|---|
| Home (`/home`) | Point-in-time | "What do I have right now?" | None (always this month) |
| Insights (`/insights`) | Period-bounded | "What's the trend?" | Pills, persisted |

**Cadence is the discriminator**, not the content type. The user
should never wonder "do I look at Home or Insights for X?" — Home is
for *now*, Insights is for *history*.

### Home — the slim snapshot

The Home page becomes a thin, dense, point-in-time dashboard. Five
sections, in order:

| # | Section | Visual |
|---|---|---|
| 1 | Onboarding callout | Conditional. Hidden when `state.settings.onboardingComplete` is true. |
| 2 | Header + meta | "Where is my money?" + "Total across N accounts · updated just now". No date pills. |
| 3 | Stat row (3-up) | Total balance · Income (this month) · Expense (this month). The money color rule is unchanged: income → primary, expense → danger, balance → ink. |
| 4 | Two cards in a `2fr / 1fr` grid | Accounts preview (top 4) on the left; Recent activity (top 4 transactions) on the right. |
| 5 | "See full Insights →" affordance | A right-aligned single-line link at the bottom of the page content. Inherits the `Manage →` link styling. |

The stat row is **not the Insights stat row.** Home's stat row is
*point-in-time* — the current balance, this month's income, this
month's expense. It is always implicitly filtered to "this month and
now." Insights' stat row is *period-bounded* — net flow over the
range, avg monthly expense, saved toward goals. They share a visual
contract (3-up card grid, eyebrow label, 28px tabular number, trend
caption) but not the same metrics.

### Insights — unchanged

The Insights page is the analytical surface and is **not modified
by this run**. Its six widgets, date range pills, and per-widget empty
states remain exactly as captured in
`../ux-finora-2026-08-14-analytics/EXPERIENCE.md`.

The single change to the Insights route is that it now hosts *all* of
the list cards (goals/debts/investments) that were previously also on
Home.

### Surface inventory

| # | Surface | Route | Changed by this run? |
|---|---|---|---|
| 1 | Home dashboard (thin snapshot) | `/home` | **Yes — content reduced** |
| 2 | Insights dashboard | `/insights` | No — content unchanged, gains the list cards that left Home |

## Voice and Tone

- **Home header**: "Where is my money?" — unchanged. The header stays
  in question form because the user is asking, not asserting.
- **Home meta**: "Total across N accounts · updated just now" —
  unchanged.
- **"See full Insights →"** link copy. Inherits the same vocabulary as
  the existing `Manage →` link. Two words, an arrow, no period.
- **Empty state on Home** (cold start): one short sentence ("Welcome.
  Add your first account to start tracking.") followed by three CTAs:
  "Add an account", "Add a transaction", "Set a goal". No emoji, no
  illustration, no "tour of empty widgets."

## Component Patterns

### Stat row on Home

The Home stat row uses the same `.card` primitive as Insights but the
content is point-in-time. Three tiles:

- **Total balance**: `fmtBDT(totalBalance)`. Caption: "across N
  accounts" or "no accounts yet" when zero. Tone: ink.
- **Income (this month)**: `fmtBDT(income)`. Caption: "N entries".
  Tone: primary.
- **Expense (this month)**: `fmtBDT(expenses)`. Caption: "N entries".
  Tone: danger.

This is the **Home stat row**, distinct from the **Insights stat
row**. They share the visual primitive but not the metrics or the
caption grammar.

### Accounts preview card

A `.card` titled "Accounts" with a `Manage →` link. Lists the top 4
accounts by alphabetical order (existing behavior). Each row is an
`AcctRow` showing the account icon (first letter uppercase), name,
type label, and balance. Empty state: "No accounts yet." + CTA "Add
an account" (existing behavior, unchanged).

### Recent activity card

A `.card` titled "Recent activity" with a `View all →` link to
`/transactions`. Lists the top 4 transactions sorted by date desc.
Each row uses the existing `TxRow` shape (icon, label, sub, signed
amount). Empty state: "No transactions yet." + CTA "Add a
transaction".

### "See full Insights →" affordance

A single-line link, right-aligned, at the bottom of the Home content.
Visual: inherits the `ManageLink` primitive (`text-primary
text-[12.5px] font-semibold hover:underline underline-offset-2`).
Behavior: navigates to `/insights`. No icon, no chevron-only
treatment — the text is the affordance.

```tsx
<Link
  to="/insights"
  className="self-end text-primary text-[12.5px] font-semibold hover:underline underline-offset-2"
>
  See full Insights \u2192
</Link>
```

The link sits below the cards section, in its own row, separated by
24px (`mt-6`) from the previous section. It does not appear inside any
card.

### Onboarding callout

The existing `DemoBanner` component carries over verbatim. It is the
**only** empty-state surface on Home. The current behavior — banner
shows when `state.settings.onboardingComplete` is false, "Start using
Finora →" button completes onboarding, X dismisses — is unchanged.

## State Patterns

### Cold start (zero data)

When the user has zero accounts AND zero transactions AND zero goals
AND zero debts AND zero investments:

- The onboarding callout shows (if not yet dismissed).
- The stat row renders with all zeros and "no accounts yet" caption.
- The accounts preview shows "No accounts yet." + CTA.
- The recent activity card shows "No transactions yet." + CTA.
- The Debts/Investments/Goals preview cards do **not** exist on Home
  anymore. There is nothing to render and nothing to point to.
- The "See full Insights →" link still appears. If they click it on
  cold start, Insights shows its per-widget empty tour (existing
  behavior — this is the analytics spine's contract).

### Light data (1+ accounts, no transactions)

- The onboarding callout may still show (it has its own dismissed
  flag).
- Stat row renders with balance > 0, income/expense = 0.
- Accounts preview renders. Recent activity shows "No transactions
  yet." + CTA.

### Populated state

The expected steady state. Three stat tiles populated, accounts
preview filled, recent activity filled, "See full Insights →" link at
the bottom.

### Date range handling

There is no date range on Home. The metrics are always "this month"
for income and expense, and "right now" for balance. The "updated
just now" caption is the only time cue. (Future: replace "just now"
with the actual last-write timestamp; deferred per the analytics
spine's out-of-scope list.)

## Interaction Primitives

### Navigating to Insights

Two ways:
1. The `◇` Insights nav item in the Shell sidebar (existing).
2. The "See full Insights →" link at the bottom of Home (new).

The sidebar nav is the primary affordance; the in-content link is the
secondary, contextual affordance for users who scroll to the bottom of
Home and want to keep going.

### Click targets

Every row in the accounts preview is a row container (not a `<Link>`)
in the existing implementation. **This run does not change the
accounts preview's click behavior.** Accounts can be drilled into via
the "Manage →" link to `/accounts`, which is the existing pattern.
The recent activity card rows are also non-link (existing behavior);
"View all →" goes to `/transactions`.

The "See full Insights →" link is the only new click target on Home.

## Accessibility Floor

- All interactive elements (the nav, the link, the onboarding button)
  inherit the global focus contract: `focus-visible:ring-2
  focus-visible:ring-primary/40`.
- The stat row tiles are non-interactive divs. Screen readers announce
  each tile's label and value via its visible text.
- The onboarding callout uses `aria-label="Dismiss banner"` on the X
  button (existing).
- The "See full Insights →" link is a normal anchor — keyboard
  navigable, screen-reader friendly, inherits the parent run's link
  focus contract.

## Key Flows

### Flow 1 — "What do I have right now?"

**Protagonist**: Rahim, 31, freelancer. He opens Finora at the start of
the day.

1. Rahim opens the app. The default route is `/home`.
2. He sees the header "Where is my money?" and the meta line "Total
   across 3 accounts · updated just now".
3. His eyes go to the **stat row**. He reads: Total balance `৳ 1,24,500`,
   Income (this month) `৳ 60,000`, Expense (this month) `৳ 22,300`.
4. He glances at the **accounts preview** — Cash, bKash, DBBL — and
   sees the balances are roughly what he expected.
5. He checks the **recent activity** — yesterday's lunch, a transfer,
   an Uber ride. Nothing surprising.
6. **Climax beat**: He scrolls past the cards. The bottom of the page
   has a single "See full Insights →" link. He notices it but doesn't
   click — he doesn't need analytics today. He closes the app.

### Flow 2 — "Am I spending less this month?"

**Protagonist**: Sumaiya, 26, designer. Two weeks into the month, she's
wondering whether her spending is on track.

1. Sumaiya opens Finora. She lands on Home.
2. The Home stat row tells her: Income `৳ 60,000`, Expense `৳ 14,200`
   so far this month. That alone is reassuring.
3. **Climax beat**: She scrolls to the bottom and clicks "See full
   Insights →". She's explicitly choosing to look at history.
4. On Insights, she picks the "This month" pill (already the default
   for her last session). The cash-flow chart shows one bar pair for
   August — early-month income, early-month expense. The spending-by-
   category widget shows Food at 41% so far. She clicks back to Home.

### Flow 3 — "Fresh install"

**Protagonist**: Karim, first session, zero data.

1. Karim opens Finora. He lands on Home.
2. He sees the demo banner: "You're viewing demo data." with a "Start
   using Finora →" button. He clicks it. The banner disappears.
3. The Home snapshot renders with zeros. No chart skeletons, no list
   widgets.
4. **Climax beat**: He scrolls to the bottom. No "See full Insights →"
   link is hidden — it's there. He clicks it.
5. On Insights, every widget shows its per-widget empty state with the
   appropriate CTA. He clicks "Add an account" and begins to populate.

### Flow 4 — "I want to see a goal's progress"

**Protagonist**: Sumaiya again. She has a savings goal and wants to
check progress.

1. She opens Finora. Lands on Home. The Home snapshot doesn't list
   goals anymore.
2. **Climax beat**: She clicks "See full Insights →" at the bottom of
   Home. She scrolls past the charts to the goals widget at the
   bottom. She sees her goal at 64%. Done.

## Out of scope for V1 (deliberate)

- Per-account balance drill-downs on Home.
- Quick-add buttons inside the Home stat tiles.
- Replacing "updated just now" with the actual last-write timestamp.
- A "What's new" surface on Home.
- A persistent Home widget config (toggle which widgets appear).

## Acceptance criteria

A run is complete when all of the following are true:

1. Home renders the header, the stat row (balance/income/expense),
   the accounts preview, the recent activity card, and the "See full
   Insights →" link.
2. Home does **not** render the goals preview card, the debts card,
   the investments card, or any of the Insights chart widgets.
3. Home has no date range control — no pills, no custom picker, no
   range sub-line.
4. The Insights page is unchanged from the analytics spine.
5. The "See full Insights →" link navigates to `/insights` and
   inherits the `ManageLink` visual treatment.
6. The cold-start Home renders the onboarding callout when applicable
   and an all-zeros snapshot otherwise — no chart skeletons, no
   per-widget empty tour.
7. Stat row tile colors match the parent run's money color rule:
   income → primary, expense → danger, balance → ink.
8. No regression to existing form flows, navigation after save, or
   banner system.
9. No new tokens introduced.
10. Build + test suite pass; the Insights test suite is unaffected.