---
status: final
name: Finora
description: Bangladesh-first personal finance web app. One currency (BDT ৳), one job: know where your money goes. Single-user, offline-capable, hash-routed.
sources:
  - DESIGN.md
  - UI-UX-FLOW.md
  - src/App.tsx
  - src/screens/*
  - src/components/*
  - src/domain/store.ts
  - src/domain/transactions.ts
  - src/lib/exportImport.ts
updated: 2026-08-27
---

# Finora — EXPERIENCE.md

> Behavior + IA + interaction spine. Visual specs live in `DESIGN.md`. Cross-references DESIGN.md tokens via `{path.to.token}` syntax where helpful. Spines win on conflict with any mock, wireframe, or import.

## Foundation

**Form factor:** single-surface responsive web, desktop-first. Minimum supported viewport: 1280×800. The app does not gracefully degrade below 1280px — sidebar + 1fr grid assumes desktop. Mobile / tablet are out-of-scope for v1.

**UI system:** Tailwind v4 + CSS custom properties (declared in `src/styles/theme.css`). No external component library. The shell, all form controls, the modal, the alert banner, and the type picker are authored in-house against `DESIGN.md.color`, `DESIGN.md.typography`, and `DESIGN.md.rounded`. No Material / shadcn / Chakra / Radix in the dependency tree.

**Routing:** React Router v7 in **hash mode** (`HashRouter`). Routes are URL-fragment anchored — no server-side routing needed, deployable as a static bundle. The host path is unreliable; everything lives after `#/`.

**State:** Zustand single store. State is fully synchronous — no async, no spinners, no loading states. Persistence is localStorage via `domain/persistence.ts`; the store hydrates at app boot, then `recomputeDerived` runs once in `App.tsx` `useEffect`.

**Determinism:** form state is *not* persisted. Closing the tab mid-typed-amount loses the amount. This is intentional — see the Data Loss row under State Patterns.

**Actor:** one named user, one device, one currency. There is no multi-user, no sync, no accounts/teams. The product assumes the operator owns the device.

**Scope creep note:** `UI-UX-FLOW.md` was authored for a mobile-first shell with a bottom nav bar and a centered floating `+` button. The implemented app is **web-desktop with a left sidebar**. Both spines anchor in the implemented surface; the original flow doc is preserved as a `sources:` reference but does not bind the IA.

## Information Architecture

The IA is a flat sidebar + content-area shell. There is no nested navigation, no breadcrumb, no in-page tabs. Every surface is reached directly from the sidebar or from a single primary action on the current surface.

### Surfaces

| Route | Screen | Purpose | Reached from |
|---|---|---|---|
| `/` | redirect → `/home` | — | — |
| `/home` | HomeScreen | Dashboard: balance, income/expense, accounts preview, goals preview, debts, investments, recent activity | Sidebar `Home` (default landing) |
| `/transactions` | TransactionsListScreen | Full transaction list, filter chips, sort by date desc | Sidebar `Transactions` |
| `/transactions/new` | AddTransactionPickerScreen | 3-up type picker (Income / Expense / Transfer) | Sidebar `+ Add Transaction` CTA, Home `Add` link, list-screen topbar `+ Add` |
| `/transactions/new/expense` | AddExpenseScreen | Per-type form: amount + preset chips + category grid + account/date + note + linked debt | Picker card `Expense` |
| `/transactions/new/income` | AddIncomeScreen | Per-type form: amount + category grid + account/date + note + linked investment | Picker card `Income` |
| `/transactions/new/transfer` | AddTransferScreen | Per-type form: from/to grid with ⇄ + live balances + amount | Picker card `Transfer` |
| `/transactions/:id/edit` | TransactionEditScreen | Edit existing transaction (pre-populated) + delete (left of action row) | Tx row (no current entry point — see Open question 1) |
| `/accounts` | AccountsListScreen | All accounts with balance, type, BDT-first avatar | Sidebar `Accounts` |
| `/accounts/add` | AccountAddScreen | New account form | Accounts list `+ Add` |
| `/accounts/:id/edit` | AccountEditScreen | Edit account form | Account row in list |
| `/goals` | GoalsListScreen | Savings goals with progress + required-per-month | Sidebar `Goals` |
| `/goals/add` | GoalAddScreen | New goal form | Goals list `+ Add` |
| `/debts` | DebtsListScreen | I-owe / Owed-to-me two-column list | Sidebar `Debts` |
| `/debts/add` | DebtAddScreen | New debt form | Debts list `+ Add` |
| `/investments` | InvestmentsListScreen | FD / DPS / savings with maturity tracking | Sidebar `Investments` |
| `/investments/add` | InvestmentAddScreen | New investment form | Investments list `+ Add` |
| `/settings` | SettingsScreen | Theme picker, backup (export / import), demo data, danger zone (wipe all) | Sidebar `Settings` |
| `/onboarding` | OnboardingScreen | Welcome screen with 3-step overview + Get started | First run, or via Home demo banner |
| `*` | Not found | Single-line label | Anything not matched |

### Shell behavior

- **Sidebar** is `240px` wide, sticky full-height (`Shell.tsx`). Brand row at top (logo SVG + `fin/ora` wordmark, `border-b` separator). Nav items below (7 entries: `Home` `Transactions` `Accounts` `Goals` `Investments` `Debts` `Settings`). Spacer fills the gap to the bottom. Bottom CTA `+ Add Transaction` is pinned to the bottom of the sidebar.
- **The bottom CTA hides on form/edit routes** to prevent duplicate primary actions. `onForm` regex covers:
  - any `…/add` path
  - `/transactions/new` (and its sub-types under `/transactions/new/{type}`)
  - `/transactions/:id/edit`, and any other `/:entity/:id/edit` pattern
- **Content area** is right of the sidebar, padding `24px 32px 64px`, `max-width: 1280px`, `overflow-x: auto` for resilience on narrow viewports.

### IA rules

- **One primary action per surface.** The sidebar CTA is the only other primary action on non-form screens; it disappears on form screens.
- **Reach the next screen in one click.** Every list-screen has a `+ Add` button. Every record row is one click away from its edit screen. There is no drill-down.
- **No tab bars in pages.** Filters exist on the Transactions list as static chips (All / Income / Expense / Transfer / This month / Cash) — visual only for v1, not yet wired to a query. See State Patterns.
- **No breadcrumb.** Surfacing is shallow enough that a breadcrumb would be visual noise.

### Format divergence from UI-UX-FLOW.md

The flow doc was written for a mobile-first shell with bottom nav and a centered `+` button. The implemented app is web-desktop with a sidebar. The IA table above reflects the implemented surface. The journey table under Key Flows reflects implemented behavior, not the original flow doc's journeys.

## Voice and Tone

Microcopy. Brand voice and aesthetic posture live in `DESIGN.md.Brand & Style`. The voice is **calm, trustworthy, plain-English** — closer to a personal money journal than a bank app.

### Voice rules

- **Plain English over accounting jargon.** "Income" / "Expense" / "Transfer" — never "Credit" / "Debit" / "Contra entry."
- **Numbers, not scores.** Show `৳ 20,000`, not "spending is 18% above average." The app is a ledger, not a coach.
- **One verb per action.** "Save." "Delete." "Wipe all data." — never "Let's get productive! 🚀" or "Are you sure?"
- **Failures name the cause, then the fix.** Every banner has three lines: `what` (the symptom), `why` (the cause), `fix` (what to do about it). Every line is one sentence.
- **User-imperative imperative.** "Add an account to start tracking again." — not "You should add an account."
- **No exclamation marks.** No emoji in body copy. The Add Transaction category picker is also emoji-free — chips are pure name tags. Emoji still appears in the Month Planner and Event Planner cards (it's content for those surfaces).
- **No "you" in feature names.** The app describes things, not the user. "Goal progress" not "Your progress."

### Microcopy register

| Surface | Tone | Example |
|---|---|---|
| Onboarding | Welcoming, brief, list-shaped | "Welcome. Three steps and you're tracking." |
| Demo banner | Neutral, opt-in | "You're viewing demo data. Start using Finora →" |
| Empty states | Single short sentence + CTA | "No transactions yet. Add one." |
| Validation errors | Direct, no apology | "Amount must be greater than zero. Zero or negative amounts produce empty transactions. Enter a positive number." |
| Confirm dialogs | Direct, no hedging | "Delete this entry? This permanently removes the transaction from your records. This cannot be undone." |
| Settings | Factual | "Theme: Dark / Light / Auto. Backup: Export / Import. Danger zone: Wipe all data." |
| Success alerts | Minimal | "All data wiped. Your local store is now empty. Add an account to start tracking again." |

### Voice don'ts

- "Let's get your finances in order!" — onboarding does not cheerlead.
- "Oops! Something went wrong." — naming the cause is the fix.
- "Just" / "simply" / "easy" — condescending; the work is the work.
- "Click here" — buttons say what they do.
- "We" / "our" — Finora is the user's app, not a service.

## Component Patterns

Behavioral. Visual specs live in `DESIGN.md.Components`.

### Transaction row

- **Click target:** the entire row is the click target. The current implementation has no row click → opens edit (no `onClick` on the row). See Open question 1.
- **Layout:** `flex` with direction icon (36×36, rounded 14px, `bg-{role}-soft text-{role}`) + title + subtitle + amount. No hover affordance in v1.
- **Glyph:** `↑` income (primary), `↓` expense (danger), `⇄` transfer (accent), `✓` paid-off (success).
- **Title fallback chain:** `tx.note` → `cat.name` → `tx.type`. Never blank.
- **Subtitle composition:** `fmtDate · account.name · cat.name` (with `debt payment` / `payout` tag if linked). For transfer: `Transfer · fromAccount → toAccount`.
- **Amount:** font-bold tabular, semantic color (primary / danger / ink). Sign-encoded via `fmtBDTSigned` (`+ ৳ 3,500` / `− ৳ 3,500` / `⇄ ৳ 3,500`).

### Form (per-type Add / Edit)

- **Auto-focus on amount input.** The amount is the first field; the user opens the form to type a number, so the keyboard appears immediately.
- **Preset chips** (expense only): `[50, 100, 250, 500, 1000]` BDT. Tap a chip to fill the amount. Tap the same chip again to clear it. (Implementation: select-set semantics — see State Patterns.)
- **Category picker** (income / expense only; transfer has no category): label `Category (optional)`. Field is **fully optional** — saving with no category is allowed at the domain layer and surfaces no error.
  - **Shape:** chips (`rounded-pill`, `px-3 py-1.5`, `text-[13px]`). No emoji, no icon button, no `+` placeholder.
  - **Hover** (unselected chip): background lifts to `primary-soft`, text and border tint to primary — a soft "ready to be picked" affordance using the same color family as the selected state, just lighter.
  - **Income (flat):** always renders the full list (income ships ~5 categories). No search, no collapse.
  - **Expense (grouped):** ships 31+ categories across Housing / Utilities & bills / Daily life / Family & health / Giving & saving / Fun & occasions. Default state shows just the first group (Housing) with a primary `Show all 31 categories` button beneath. Clicking expands all groups inline; `Hide list` collapses back.
  - **Selected state:** primary border + `primary-hi` bg + primary text. Selected pill above the chip cloud shows `Selected: <name>` with a `×` clear button.
  - **No search** in v1 — was explored and removed because the chip cloud with Show all / Hide list already keeps the modal compact.
  - **No emoji affordance** in Add Transaction. The `Category.emoji` data field exists for the Month / Event Planner cards but is not surfaced from this flow.
- **Account/date grid** (income/expense): 2-column, `Account` then `Date`. Default account = first account in list.
- **Transfer grid:** 1fr / auto / 1fr with `⇄` glyph centered. `To` select filters out the currently selected `From` account. Each side shows a live `Balance: ৳ X` line so the user knows what they're moving from.
- **Linked fields:** expense shows `Linked debt (optional)` only if there are active debts; income shows `Linked investment (optional)` only if there are non-closed investments. Transfer shows neither.
- **Note:** free-text textarea on income/expense, hidden on transfer.
- **Modal width:** `max-width: 720px` (was 560px). Wider column gives the chip cloud enough horizontal room to wrap efficiently without forcing tall stacks.
- **Action row:** right-aligned. `Cancel` (secondary) → back to picker (or `/transactions` for edit). `Save` (primary, type=submit).
- **Edit adds a left-side destructive action.** `🗑 Delete` (variant=danger) on the left of the action row → `ConfirmDialog` with `dangerText` callout.

### ConfirmDialog

- **Modal, 420px wide, centered, blurred backdrop.** (DESIGN.md.Components.modal.)
- **API:** `confirm({ title, body?, dangerText?, confirmLabel?, cancelLabel?, danger? }) → Promise<boolean>`. The caller awaits; Esc and backdrop click resolve `false`.
- **Autofocus cancel.** A misfire on a destructive action must be recoverable with one keystroke.
- **Danger styling:** primary button switches to `bg-danger` when `danger: true`.
- **Danger text:** a separate inline banner above the actions when `dangerText` is present — used today only on the TransactionEdit delete confirm. The body's soft text is for *why* the action is destructive; the `dangerText` is the *do not pass go* callout. (Other destructive confirms — Wipe all data, Replace existing data with demo, Import — use `body` only. See Open question 2.)

### Alert banner (RoleAlertBanner)

- **Global, mounted in Shell**, portaled to a fixed top-center slot.
- **Subscribes to `store.banner`.** Three lines: `what` (the symptom), `why` (the cause), `fix` (what to do). Each line is one sentence.
- **Auto-dismiss after 12s.** Manual ✕ dismisses instantly.
- **Triggered by:** form validation guards, caught domain errors, import/export errors, async failures.
- **Stacking:** at most one banner visible. New banner replaces the old (no queue).

### Empty states

- **List screens:** centered, `py-9`, single sentence in `text-muted`, sometimes with one CTA below.
- **Home screen:** each preview card has its own empty message inline ("Add your first expense" / "Add your first goal" / "Tap + to add").
- **No illustration, no "you haven't started yet!" copy.** Empty state copy is the same register as the rest of the app.

### Onboarding

- **Single screen, no fields.** Renders welcome copy, a 3-step ordered list, and one `Get started` button. Tapping it calls `completeOnboarding()` and navigates to `/home`.
- **The DemoBanner on Home** is the re-entry point after demo data is loaded: `Start using Finora →` calls `completeOnboarding()` to dismiss the banner (no navigation).
- **No fields to fill.** Per the original flow doc: "Onboarding is one screen, one number" — but the implemented onboarding is *zero* fields. The first-run user lands on an empty Home, and the Empty states carry the load.

### Settings

- **Theme picker:** 3-button inline toggle (`Dark` / `Light` / `Auto`). `Auto` listens to `prefers-color-scheme` via `matchMedia`. The current app shell does not animate the switch.
- **Backup:**
  - `Export` → downloads `finora-backup-YYYY-MM-DD.json` built via `lib/exportImport.downloadExport`.
  - `Import` → hidden file input → `parseImport` → if valid, `ConfirmDialog` (`Replace existing data with imported backup?`) → `importAndReplace` mutator. If `parseImport` throws `ImportError`, the banner shows the cause.
- **Demo data:** `Load demo seed` mutator. If state already has data, `ConfirmDialog` (`Replace existing data with demo?`) → mutate. If empty, no confirm.
- **Danger zone:** `Wipe all data` → `ConfirmDialog` (title `Wipe all data?`, body `This removes all accounts, transactions, goals, debts, and investments. Your onboarding state is kept.`, danger confirm) → reset (keep `onboardingComplete: true`).

## State Patterns

### Empty / loading / error

| State | Surface | Treatment |
|---|---|---|
| Empty list | Transactions / Accounts / Goals / Debts / Investments | `py-9` centered, single muted sentence. |
| Empty Home preview | Home (accounts / goals / debts / investments / recent) | Inline sentence + inline CTA. |
| No categories | AddExpense / AddIncome form | CategoryGrid hidden; form continues without it. |
| No active debts | AddExpense linked-debt field | Field hidden. |
| No non-closed investments | AddIncome linked-investment field | Field hidden. |
| Form validation | Any form | Show banner (what/why/fix); stay on form. |
| Domain error | Any form | Catch `TransactionError` / `DeleteError` → banner. |
| Parse error | Settings → Import | `ImportError` → banner with cause. |
| Loading | (none) | App is fully synchronous. No spinners. |
| Stale data | (none) | App is single-user, single-device. No remote sync. |

### Form state (per-type Add / Edit)

- **Source of truth for fields:** local `useState` strings inside the screen. The store is *not* touched until Save.
- **No field-level validation.** Submit-handler validates the assembled record, then either calls `transactions.add` / `update` or shows a banner.
- **No dirty flag.** Closing the tab mid-form loses unsaved input. Documented in Foundation.
- **Preset chips:** select-set semantics (tap to fill, tap again to clear). Custom amounts always allowed.
- **Category grid:** select-set semantics. Domain accepts `undefined` categoryId.
- **Transfer `To` select:** excludes the currently selected `From` account. Domain rejects equal `from === to` on submit (the form prevents it via filtering; the domain enforces it again on submit).

### Persistence

- **Storage:** `localStorage` via `domain/persistence.ts`. Key is implementation-defined; `load()` / `save(state)` / `clear()` are the public API.
- **Versioned:** `state.version = 1` after wipe reset. Future migrations would gate on this field; v1 has no migrations.
- **Trigger points:** every `update(mutator)` already runs `recomputeDerived` → `save(state)`. `setTheme` and `completeOnboarding` save explicitly. `reset` calls `clear()` and reseeds.
- **No SSR.** `loadInitial` runs synchronously at store init; no hydration race.

### Filter chips (Transactions list)

- **Visual only in v1.** Chips render: `All / Income / Expense / Transfer / This month / Cash`. The `All` chip is selected by default. Clicking another chip does not change the displayed list. (See Open question 3.)

### Demo banner

- **Mounted on Home only**, conditionally on `!settings.onboardingComplete`. Two ways to dismiss: `✕` close (local state) and `Start using Finora →` (calls `completeOnboarding()` which sets the flag and re-renders without the banner).

## Interaction Primitives

### Pointer

- **Click target ≥ 36×36.** Buttons are `px-4 py-2.5` minimum. Icon buttons are `w-9 h-9` (36×36).
- **Buttons get hover `opacity: 0.9`.** No transform, no color shift — restrained.
- **Sidebar nav items** get hover `bg-surface-2 text-ink`. Active is `bg-primary-soft text-primary`.
- **Modal backdrop click cancels.** Clicking outside the modal body resolves the `confirm` promise with `false`.

### Keyboard

- **Tab order** is the natural DOM order. Forms tab from amount → category → account → date → note → save.
- **Enter** in a single-line input submits the form (default browser behavior).
- **Cmd/Ctrl+Enter** is *not* bound. Future candidate.
- **Escape** in a ConfirmDialog cancels the dialog. Escape elsewhere does nothing.
- **No global keyboard shortcuts.** No `g h` / `g t` / `⌘K`. See Open question 4.

### Touch

- **Touch targets are the same as pointer.** The app is not tested on touch primary; v1 is desktop-first.

### Form conventions

- **Auto-focus amount input** on form mount (the user came to type a number).
- **Currency on focus:** the big amount input expects `৳` to be implicit — users type `250`, the form interprets as 250 BDT. No currency picker.
- **Date input** is the native `<input type="date">`. Empty / invalid date breaks the form; the domain rejects `NaN` dates on submit.
- **Submit** is `type="submit"` on the primary button; the form's `onSubmit` handler does validation, calls the mutator, then navigates.

## Accessibility Floor

Behavioral. Visual contrast lives in `DESIGN.md`.

- **Semantic HTML.** Form fields use `<label>` (via `Field` component). Buttons are `<button>`. Modal is `role="dialog"` with `aria-labelledby` pointing at the title; `aria-modal="true"`.
- **Focus:** `ConfirmDialog` autofocuses the cancel button. Tab cycles through dialog elements only (native `<dialog>` semantics via the manual backdrop-button trick). Esc cancels.
- **Keyboard support:** all interactive surfaces reachable via Tab. No keyboard traps.
- **Color independence:** sign encoding is dual-channel (color + glyph + sign). `amount > 0` and `fromAccountId !== toAccountId` failures are caught by the domain even if the form's UX guard is bypassed.
- **Reduced motion:** the app has no animation today. If motion is added later, it must respect `prefers-reduced-motion`.
- **Density:** at 1280px viewport, the home dashboard shows 3-up stat row + 2-col below + single-column cards. Nothing worse than 3-up grid is required at the minimum viewport.
- **Screen reader:** banner text is wrapped in `role="alert"` — current implementation uses a plain div; `aria-live="polite"` is the proper attribute. See Open question 5.
- **Touch target ≥ 36px.** Smaller targets (the `✕` close inside the demo banner is tighter) are desktop-only and have a generous hit area.

## Key Flows

Named-protagonist flows, each with a single climax beat. Format inspired by `UI-UX-FLOW.md` but anchored in the implemented web-desktop shell.

### Journey 1 — First run (Tahmid, 28, just installed)

**Climax:** Tahmid lands on an empty Home in under 10 seconds and sees exactly what to do next.

1. Open `index.html`. App boots, `localStorage` empty, `settings.onboardingComplete: false`.
2. App redirects `/` → `/home`. HomeScreen renders the demo banner (because `!onboardingComplete`) and the empty dashboard.
3. Tahmid clicks either `Start using Finora →` in the banner (dismisses + sets the flag) or the empty-state CTA in any preview card.
4. Empty state on the Accounts preview: `No accounts yet. Add one.` → click → `/accounts/add`.
5. Creates an account: name + initial balance + type. Save → `/accounts`. Balance now visible on Home.

> If the demo banner is accidentally dismissed (✕) without `Start using Finora →`, the banner is gone but `onboardingComplete` stays false. The next session brings the banner back. (Intentional: the user can re-read the offer.)

### Journey 2 — Daily expense (Tahmid, lunch break)

**Climax:** Tahmid records a ৳ 250 lunch expense in three taps.

1. Tahmid is on `/home`. Sidebar bottom CTA reads `+ Add Transaction`.
2. Tap the CTA → `/transactions/new` (picker). 3 TypePicker cards: Income / Expense / Transfer.
3. Tap `Expense` → `/transactions/new/expense`. AmountInput auto-focused; keyboard up.
4. Tap a preset chip `250` — amount fills. Tap the `Food` chip under `Housing` — selected. `Account` defaults to the first account in the list. (No emoji on the chip — it's a pure name tag.)
5. Tap `Save` → `transactions.add` → navigate `/transactions`. Home re-renders with the new totals.

> If the form is invalid (e.g. amount is empty), the banner appears and the form stays mounted. The user fixes the field and submits again.

### Journey 3 — Got paid (Tahmid, end of month)

**Climax:** Salary lands; all balances and Home stats update in under a second.

1. Tap `+ Add Transaction` → picker → `Income`.
2. Category chips: income shows the full flat list (~5 categories). No category is pre-selected — the field is fully optional, so the user picks one only if they want to tag the income. Tap `Salary` to select.
3. Amount: `60,000`. Account defaults to the first account (which is the salary account in the demo seed).
4. Tap `Save`. Toast-style feedback: today, the form silently navigates to `/transactions` (no toast). The Home dashboard re-renders off the same Zustand store; income stat updates, balance updates.

> A toast on save is a known UX gap (Open question 6).

### Journey 4 — Transfer between accounts (Tahmid, moving cash to savings)

**Climax:** Two balances update simultaneously; total net balance is unchanged.

1. Tap `+ Add Transaction` → picker → `Transfer`.
2. Form shows `From` (default first account) / `⇄` / `To` (defaults to the second account). Live balances shown under each.
3. Pick `City Bank` → `Savings`, type `10,000`.
4. Tap `Save`. Both accounts update. Home net balance is unchanged.

> If `From === To` is forced somehow (the form filters `To` to exclude `From`, but it could be re-selected via memo glitch), the domain rejects the submit with a banner: `From and to must be different accounts. / The form filters the To dropdown to exclude From. / Pick a different account.`

### Journey 5 — Wipe and replace (Tahmid, handing the device to a family member)

**Climax:** Two taps to clear everything; the app is ready for a new owner.

1. Tap Settings → Danger zone → `Wipe all data`.
2. ConfirmDialog: `Wipe all data? / This removes all accounts, transactions, goals, debts, and investments. Your onboarding state is kept.` Danger button.
3. Tap `Wipe all data` in the dialog. Store resets (all entity arrays empty, `onboardingComplete: true`).
4. Success alert: `All data wiped. Your local store is now empty. Add an account to start tracking again.`
5. Navigate to `/home` (or wherever the user was). Empty state everywhere.

### Journey 6 — Restore from backup (Tahmid, switching devices)

**Climax:** Imported state replaces the current state in one confirm-and-pick.

1. Settings → Backup → `Import`. Hidden file input opens.
2. Pick a previously-exported `finora-backup-YYYY-MM-DD.json`.
3. `parseImport` runs synchronously. On success: ConfirmDialog `Replace existing data with imported backup?`. On failure: banner with `ImportError.message`.
4. Tap `Replace` → `importAndReplace` mutator runs `recomputeDerived` → save. App re-renders with imported data.

---

## Open Questions

These are tracked here for the Reviewer Gate (or for a future spike). None are blockers — the app ships without resolving them.

1. **No entry point for transaction edit.** Transaction rows don't link to `/transactions/:id/edit`. Possible entry points: row click anywhere, kebab menu on hover, swipe on touch. Decision pending.
2. **ConfirmDialog `dangerText` is used only on transaction delete.** Other destructive confirms (Wipe all data, Replace existing data, Import) use `body` only. Should they all share `dangerText` for consistency? Decision pending.
3. **Transactions list filter chips are visual-only.** Tapping a chip does not change the filtered list. Wiring real filters is a v2 task.
4. **No global keyboard shortcuts.** Powers users might want `g h` / `g t` / `⌘K`. Not a v1 ask.
5. **RoleAlertBanner is a plain div, not `role="alert"`.** Adding `aria-live="polite"` and `role="alert"` is a small a11y fix.
6. **No toast on save.** Save actions navigate silently. The user gets a route change as feedback. Toast is a candidate v2.

## Source Trace

- `src/App.tsx` — route + theme effect + recompute on mount.
- `src/screens/*` — every surface named in the IA table.
- `src/components/Shell.tsx` — sidebar + `onForm` hiding logic.
- `src/components/ConfirmDialog.tsx` — modal API, backdrop-button trick, Escape cancel.
- `src/components/RoleAlertBanner.tsx` — banner subscription + auto-dismiss.
- `src/components/Field.tsx` — `Field` / `Input` / `Select` / `Textarea` / `AmountInput` labels.
- `src/components/TypePicker.tsx` — `TypePicker` (3-up) + `CategoryGrid` (chip cloud, grouped/flat) + `PresetChips`.
- `src/domain/store.ts` — Zustand store, `update()` lifecycle, `recomputeDerived`, `loadInitial`.
- `src/domain/transactions.ts` — `add` / `update` / `remove` / `list` / `get` and validation rules.
- `src/lib/exportImport.ts` — `downloadExport` filename + `parseImport` errors.
- `src/styles/theme.css` — DESIGN.md tokens rendered as CSS custom properties.
- `UI-UX-FLOW.md` — original mobile-first flow doc; preserved as `sources:` reference, not as a binding contract.
