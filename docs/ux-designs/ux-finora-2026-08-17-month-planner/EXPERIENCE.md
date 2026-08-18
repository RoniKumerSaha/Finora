---
status: final
name: Finora — Plan sections
description: Month Planner, Event Planner, and Card-total checker. Pure scratch — never touches state.transactions. Single calendar month is the only editable Month scope.
sources:
  - ../ux-finora-2026-08-13/EXPERIENCE.md
  - ../ux-finora-2026-08-13/DESIGN.md
  - src/screens/PlanScreen.tsx
  - src/screens/MonthPlanScreen.tsx
  - src/screens/EventPlanScreen.tsx
  - src/screens/EventPlanDetailScreen.tsx
  - src/screens/plan/CardTotalChecker.tsx
  - src/domain/plans.ts
  - src/domain/types.ts
  - src/domain/persistence.ts
updated: 2026-08-17
---

# Finora — Plan sections EXPERIENCE.md

> Behavior + IA + interaction spine for the `/plan` hub, the Month Planner, the Event Planner, and the Card-total checker. Visual specs live in `DESIGN.md` for this same folder.

## Foundation

**Scope:** a separate scratchpad area for "what I intend to spend" — a thinking surface, not a ledger. Plans never write to `state.transactions`, never affect balances, never appear in any chart or stat. The transactions ledger is the source of truth for what *did* happen; plans are for what *might*.

**Currency:** same BDT-only convention as the rest of the app. All budget values render through `fmtBDT`. No currency picker.

**Persistence:** plans live alongside the rest of `State` in `localStorage`. They are *not* transactional — the user can Save, abandon, and Reset freely without consequence.

**Form factor:** inherits the desktop-first IA from `../ux-finora-2026-08-13/EXPERIENCE.md`. Sidebar adds a `Plan` nav item; content area is the same 24/32/64 padding shell.

## Information Architecture

### Surfaces

| Route | Screen | Purpose | Reached from |
|---|---|---|---|
| `/plan` | PlanScreen | Hub. Two cards: Month Planner + Event Planner. Each surfaces a mini-list of what's planned. | Sidebar `Plan` (default landing for the section) |
| `/plan/month` | MonthPlanScreen | Editable grid of the current month. Toolbar (Saved status + Reset + Save plan) → heading → Card-total checker → items grid. | Hub card `Plan my month` |
| `/plan/event` | EventPlanScreen | Event list + create flow (Name / Emoji / Date / Budget) | Hub card `Plan an event` |
| `/plan/event/:id` | EventPlanDetailScreen | Per-event detail: editable header, categories with line items, due dates, paid/not-paid | Event list row |

> There is no nested nav under `/plan` other than the two hub links. The detail page is reached only by clicking into an event from the list.

### Sidebar

A `Plan` entry is added to the sidebar nav between `Goals` and `Debts`. Like the others, it gets hover `bg-surface-2 text-ink`, active `bg-primary-soft text-primary`.

### IA rules

- **Hub → detail.** `/plan` is a thin hub; the heavy UI lives on `/plan/month` and `/plan/event/:id`.
- **No tab bars inside the planner screens.** Filters, status, and chips are inline.
- **No breadcrumb.** The two-card hub is shallow enough.
- **The hub itself never hosts modals or edits** — it only links out.

## Plan Hub (`/plan`)

Two cards in a 1×2 (mobile) / 2-up (desktop) grid. Each is a `<Link>` to its detail screen.

**Layout (per card):**
- Header row: small uppercase section label (`MONTH PLANNER` / `EVENT PLANNER`) on the left, primary title (`Plan my month` / `Plan an event`) below it; on the right, a pill-shaped chip showing the month label or event count.
- One-line description in `text-muted`.
- Mini-list — up to 5 items for Month Planner (emoji + name + budget on the right), up to 3 events for Event Planner (emoji + name + days-to-go on the right, colour-coded `primary` / `warn` / `muted` based on urgency).
- Footer row: item count for Month; "Next: … N days away" for Event.
- Empty state line in place of the mini-list when the planner is empty.

**Hub footer (below both cards):**
A single muted line `ⓘ Plans are pure scratch — switch tabs, swap emoji, abandon mid-edit. Nothing here touches your real accounts or transactions.` — this is the only place the "scratch" contract is restated.

### Hub behaviors

- **Both cards are clickable as a whole.** Hover adds `border-primary`. Click navigates to the detail screen.
- **Mini-list is read-only.** It's a snapshot. Editing happens on the detail page.
- **Overflow:** `+N more` line under the list when there are more rows than the cap.

## Month Planner (`/plan/month`)

The Month Planner edits the **current calendar month only**. There is no month selector — the screen locks to `plans.monthKey()`.

### Layout

```
┌──────────────────────────────────────────────────────────┐
│ ● Saved  |  [spacer]  Reset   Save plan   ← toolbar row │
│                                                          │
│ Plan my month                                            │
│ Fill the items. Tap Save plan when it looks right — …    │
│                                                          │
│ ┌────────────────────────────────────────────────────┐   │
│ │ Check the cards you'll pay                        │   │
│ │ Tick items, set your income, see how much you'd … │   │
│ │                                                    │   │
│ │ Income  ৳ [_____]                                  │   │
│ │ [🥦 Groceries] [🏠 Rent] [🚗 Transport] [💡 Bills] …│   │
│ │                                                    │   │
│ │ N of M selected  ·  Total ৳X  ·  Saved ৳Y         │   │
│ └────────────────────────────────────────────────────┘   │
│                                                          │
│ ┌────────┐ ┌────────┐ ┌────────┐                        │
│ │ 🥦 …   │ │ 🏠 …   │ │ 🚗 …   │                        │
│ │ Groc.  │ │ Rent   │ │ Trans. │                        │
│ │ BUDGET │ │ BUDGET │ │ BUDGET │                        │
│ │ ৳ 12k  │ │ ৳ 18k  │ │ ৳ 6k   │                        │
│ └────────┘ └────────┘ └────────┘                        │
│ ┌────────┐ + New item                                   │
│ └────────┘                                              │
│                                                          │
│ ⓘ Tap an item to edit it in a pop-up. Changes are only … │
└──────────────────────────────────────────────────────────┘
```

### Toolbar row (top)

Single row, no card chrome. Left: status pill (`● Saved` / `● Unsaved changes`) with a coloured dot driven by `plan.dirty`. Centre: a vertical divider. Right: `Reset` (ghost) + `Save plan` (primary).

- **Reset** triggers a `ConfirmDialog` (`Reset month plan?` / body / danger text / danger) — never fires silently.
- **Save plan** marks the plan saved (`plans.saveMonthPlan`) — clears `dirty`, stamps `savedAt`.
- The toolbar sits *above* the heading so the save affordance is the first thing the user sees no matter how far they scroll.

### Items grid

- 2-col on mobile, 3-col on `md+`.
- Each item tile shows a coloured disc ring (deterministic colour per `id` from a 6-tone palette), the emoji inside, the category name, and the budget figure underneath a `Budget` micro-label.
- Ring fills 100% of the disc with a stable-random tonal colour — there is no progress fill (planned-vs-budget is not surfaced here).
- Tap an item → `JarEditorModal` opens.
- A dashed `+ New item` tile fills the last grid cell when items exist.

### New / Edit modals

- **NewItemModal** (`+ New item`): emoji picker + name + budget input. Save → mutator with a `tone` derived from `plans.PLAN_TONES[plan.categories.length % plans.PLAN_TONES.length]`.
- **JarEditorModal** (tap an item): emoji picker + name + budget input + delete button. Cancel discards the draft, Save commits. A "Clear budget" pill sets `budget: 0` without opening a separate dialog.
- Both modals use the standard `Field` / `Input` components. Amount input commits on Enter or blur; the input clears `0` placeholders.

### Card-total checker

Mounted above the items grid, on the same panel page.

- Reads the current month plan (`plans.monthKey()` + `plans.getMonthPlan`).
- Header: small `Quick total` label + heading `Check the cards you'll pay` + one-line description.
- **Income row:** small `Income` label, `৳ [number]` input. Commits on Enter or blur. Stored in local component state — never persisted.
- **Chips grid:** one chip per item in the current month. Chip is `emoji + name + budget`. Click toggles a `Set<string>` of selected ids in local state.
- **Footer:** `N of M selected  ·  Total ৳X` always shown. When income > 0, a third cell shows either `Saved ৳Y` (success-tone green) when `income − total ≥ 0`, or `Over by ৳Y` (danger-tone red) when negative.
- **Clear selection** ghost link appears in the header when N > 0.
- All state is ephemeral — refresh resets the selection and income. This is the *intended* contract: the checker is a scratchpad, not a long-lived ledger.

### Footer hint

Below the grid: `ⓘ Tap an item to edit it in a pop-up. Changes are only saved when you tap Save plan.` — single muted line, centred.

## Event Planner (`/plan/event`)

### List screen

- Card-per-event row: emoji + name + event date + days-to-go (colour-coded `primary` for >7 days, `warn` for ≤7 days, `muted` for past).
- A `+ New event` button opens the create flow.

### Create event

- Inline form: name + emoji + date + budget. Save → adds to `state.eventPlans`, navigates to `/plan/event/:id`.
- Each event gets its own id and starts with `dirty: true, planned: 0, categories: []`.

### Detail screen (`/plan/event/:id`)

- Header: emoji + name + event date pill + days-to-go + `Reset` + `Save plan` (same toolbar pattern as Month Planner, but inline with the header so it's reachable without scrolling).
- **Categories** list. Each category card shows: emoji, name, budget, due date (optional), status (`Paid in full` / `N days overdue` / `Due in N days`), and a list of line items below. Each line item is a row with `label` + `amount` + a `Done` toggle.
- **Add category** opens a modal: name + emoji + budget + due-date picker + optional initial line items.
- **Reset event** wipes budget / date / categories / items. The event shell (id, name, emoji) is kept. Today's date is used so the page no longer reads "5 days ago" right after reset.

### Event "scratch contract"

Each event carries a `savedSnapshot` (deep clone of the live plan at save time). Reset never restores the snapshot — it blanks the working draft. Snapshot is used only by `saveEventPlan` so subsequent Saves keep working.

## State Patterns

### Pure scratch

- Plans live in `state.monthPlans` and `state.eventPlans`. They never read or write `state.transactions`, `state.accounts`, or `state.investments`.
- No persistence happens for form drafts — Save is explicit.
- No sync, no export diff, no chart data. Plans are local to the user's brain.

### Dirty flag

- Every mutation (`addCategory`, `updateCategory`, `removeCategory`, etc.) flips `dirty: true` on the parent plan.
- `saveMonthPlan` / `saveEventPlan` flips `dirty: false` and stamps `savedAt` (ISO date).
- The toolbar status pill reads `dirty` — green dot = saved, amber dot = unsaved.

### Reset contract

- `resetMonthPlan` blanks the plan but keeps the prior `savedAt`. Re-Save after Reset re-stamps `savedAt`.
- `resetEventPlan` blanks the working draft (budget, date, planned, categories) but keeps the event shell (id, name, emoji) and the `savedSnapshot` (so subsequent Saves still work).

### Card-total checker — local state only

- `Set<string>` of selected category ids.
- `number` income.
- `useState` + `useEffect` draft pattern on the income input (mirror → commit on Enter / blur).
- No store writes, no persistence. Refresh resets.

### Persistence

- Plans are seeded with `buildDefaultMonthPlans()` and `buildDefaultEventPlans()` only when the field is *absent* from the persisted blob. An empty array is treated as a deliberate user choice.
- Existing users upgrading from a build that pre-dates the planners automatically receive the demo seed on first load.

## Interaction Primitives

### Pointer

- Hub card hover: `border-primary` transition.
- Item tile: cursor pointer, no hover state — the press affordance is the tile getting selected (`selectedCatId`).
- Chip in the checker: toggles selected/unselected via click.
- Modal: standard portal + backdrop click + Escape.

### Keyboard

- Tab order is the natural DOM order.
- **Enter** in the checker's income input commits and blurs.
- **Escape** in any modal cancels.

### Touch

- Touch targets are ≥ 36×36 (DESIGN.md.tokens).
- Hub cards are large clickable rectangles — no ambiguity on touch.

## Accessibility Floor

- **Semantic HTML.** The hub cards are `<Link>` (anchor) not `<div onClick>` — they navigate.
- **Card-total checker chips** carry `role="checkbox"` + `aria-checked` for screen readers.
- **Item delete** uses `ConfirmDialog` with autofocus on cancel.
- **Color independence:** urgency chips on the event list dual-channel colour + text (`in 5 days` / `today` / `1 day ago`); selection state on checker chips dual-channel colour + check glyph.
- **Touch target ≥ 36px** on all interactive surfaces.

## Key Flows

### Journey 1 — Plan a month from scratch (Tahmid, planning rent + food + transport)

**Climax:** Three items land in the current month, saved in under a minute.

1. Sidebar → `Plan`. Hub renders. Month card shows `Nothing planned yet — open the planner to start.`
2. Click `Plan my month`. `/plan/month`. Toolbar reads `Saved`.
3. Tap `+ New item`. Modal opens. Emoji picker (🍜) → name `Food` → budget `10000` → Save. Tile appears in grid.
4. Repeat for `Rent` (🏠, `18000`) and `Transport` (🚗, `6000`).
5. Status flips to `● Unsaved changes`. Tap `Save plan`. Status flips back to `● Saved`. Plan is now durable.

### Journey 2 — Check the cards you'll pay today (Tahmid, paying rent + food)

**Climax:** Running total updates live as Tahmid ticks items; saving read against his income.

1. On `/plan/month`, the Card-total checker sits above the items grid. Income field is empty.
2. Tap income field, type `50000`, press Enter. Income commits.
3. Tap `Rent` chip — toggled on. Footer: `1 of 3 selected  ·  Total ৳ 18,000  ·  Saved ৳ 32,000` (green).
4. Tap `Food` chip — `2 of 3 selected  ·  Total ৳ 28,000  ·  Saved ৳ 22,000` (still green).
5. Tap `Transport` chip — `3 of 3 selected  ·  Total ৳ 34,000  ·  Saved ৳ 16,000`.
6. Realise Transport is more than planned. Tap `Transport` again — deselects. Footer: `2 of 3 selected`.
7. Tap `Clear selection`. All chips reset.

> Refresh the page — selection is gone. The plan data, however, persists.

### Journey 3 — Plan a wedding (Tahmid, 90 days out)

**Climax:** Event with budget, categories, and due dates lands and starts ticking.

1. Hub → `Plan an event` card → `/plan/event`. Empty list.
2. Tap `+ New event`. Inline form: name `Wedding`, emoji `💍`, date 90 days out, budget `250000`. Save.
3. Lands on `/plan/event/:id`. Status `Unsaved changes`.
4. Add category `Venue` (🏛️, `80000`, due in 60 days). Add line items: `Hall booking 65000`, `Decoration 15000`.
5. Add category `Catering` (🍱, `70000`, due in 70 days). Add line items.
6. Tap `Save plan`. Status flips to `Saved`. Hub now shows this event under Event Planner.

### Journey 4 — Reset the month because plans changed (Tahmid, switching budgets)

**Climax:** Confirm once, the plan snaps back to last saved state.

1. On `/plan/month`, status reads `● Unsaved changes` (user added a tentative item).
2. Tap `Reset`. ConfirmDialog: `Reset month plan?` / body / danger text / `Reset` (danger).
3. Tap `Reset`. Plan snaps back to the saved state. The tentative item is gone.

> If the user has never tapped Save in this month, Reset wipes the entire plan back to empty (income = 0, no items). This is intentional — there is nothing to revert to.

## Open Questions

None blocking v1. Future candidates:

- **Event share / export** — events are local-only today; no way to send a plan to someone else.
- **Recurring month plans** — the planner is per-month; copying last month's items is manual.
- **Card-total checker persistence** — currently ephemeral. Could remember last selection per month.

## Source Trace

- `src/screens/PlanScreen.tsx` — hub layout, mini-list rendering, `sortByDate` helper.
- `src/screens/MonthPlanScreen.tsx` — toolbar, heading, Card-total checker mount, items grid, JarTile.
- `src/screens/EventPlanScreen.tsx` — event list + create.
- `src/screens/EventPlanDetailScreen.tsx` — per-event detail; category cards, line items, due dates.
- `src/screens/plan/CardTotalChecker.tsx` — multi-select checker with income + saving.
- `src/domain/plans.ts` — pure CRUD for `MonthPlan` and `EventPlan`; `summariseMonthPlan`, `summariseEventPlan`, `categorySpent`.
- `src/domain/types.ts` — `PlanCategory`, `PlanItem`, `MonthPlan`, `EventPlan` interfaces.
- `src/domain/persistence.ts` — `buildDefaultMonthPlans`, `buildDefaultEventPlans` (seed only when field is missing).
- `src/components/planner/EmojiPicker.tsx` — emoji picker used by NewItemModal and JarEditorModal.
- `src/components/ConfirmDialog.tsx` — used by Reset / Save flow guards.