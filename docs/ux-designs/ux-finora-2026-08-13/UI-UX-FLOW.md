# Finora — UI/UX User Flow

> Minimal. Elegant. One job: **know where your money goes.**

This document describes the complete user experience for Finora V1 in Markdown. No jargon. No clutter. Every screen exists because a real user journey needs it.

---

## 0. Design North Star

| Principle | What it means in practice |
|---|---|
| **One primary action per screen** | The **+ Add** button is always one tap away. |
| **Numbers, not scores** | Show ৳ 20,000 — not "spending is 18% above average". |
| **Plain English** | "Income" / "Expense", never "Credit" / "Debit". |
| **Defaults that work** | New account = Cash. New expense = most recent category. |
| **Reversible** | Every entry can be edited or deleted. |
| **No setup wall** | Onboarding is one screen, one number. |
| **Offline always** | No feature needs internet. |

**Visual system:** Midnight palette (slate `#0F1419` base, teal `#2DD4BF` primary, indigo `#A78BFA` accent). Single font (system sans). Generous whitespace. 12–16 px corner radius. Soft elevation. See `mockups/theme-4-midnight.html` and the four `mockups/dash-*.html` variants for the chosen direction.

---

## 1. Navigation Map

A mobile-first app. Bottom bar has five destinations; one is the **+ Add** action, always centered, always visible.

```
┌─────────────────────────────────────────────┐
│                                             │
│              [ Active Screen ]              │
│                                             │
├─────────────────────────────────────────────┤
│   Home    Txns     [+]    Goals    Settings │
└─────────────────────────────────────────────┘
```

| Tab | Purpose |
|---|---|
| **Home** | This month's totals, account balances, active goals, recent activity. |
| **Txns** | Full searchable / filterable list of all transactions. |
| **+ (Add)** | Centered floating button → quick-add menu (Income / Expense / Transfer). |
| **Goals** | Savings goals list + create. |
| **Settings** | App PIN, Export, Import, Delete all data, About. |

> The **+** is the most prominent thing on screen at all times. It is the only button that is allowed to be loud.

---

## 2. End-to-End User Journeys

Each journey is a real session with a named protagonist and a single climax moment — the point where Finora delivers value.

### Journey 1 — First run (Rina, 28, just installed)

**Climax:** Rina finishes setup in under 60 seconds and sees a clean dashboard waiting for her.

1. **Open app.** Cold start. Single full-screen card.
2. **Type one number.** *"How much money do you have available right now across all your accounts?"* One input, no label clutter.
3. **Tap "Get started".** App seeds one default account ("Cash", balance = entered number) and lands on **Home**.
4. **Home shows:** This month's income (৳ 0), expenses (৳ 0), balance (entered number), three empty state rows ("Add your first expense" / "Add your first goal" / "Tap + to add").
5. **The + button pulses gently** for the first 3 sessions only, then stops.

> If onboarding is broken here, nothing else matters. This is the most-tested journey in the app.

---

### Journey 2 — Daily expense (Rina, lunch break)

**Climax:** Rina records a lunch expense in three taps.

1. Rina is already on Home (most likely surface after open).
2. **Tap +** in the bottom bar. → A bottom sheet rises with three large buttons: **Income** · **Expense** · **Transfer**.
3. **Tap "Expense".** → A full-screen form with **Amount** focused and the keyboard open. Categories appear as a 3×4 grid below the input (Food, Transport, Housing, Bills, Shopping, Health, Education, Family, Entertainment, Other). The last-used category is pre-selected.
4. **Type "250".** Tap **Food**. → Account picker appears as a one-line dropdown (defaults to Cash).
5. **Tap "Save".** Form dismisses. Toast slides in: *"৳ 250 added to Food."* Home re-renders with the new totals.

> Three taps total. Keyboard never closes mid-flow. If user backs out without saving, no record exists.

---

### Journey 3 — Got paid (Rina, end of month)

**Climax:** Salary lands, balances all update, Rina sees the new state in under 5 seconds.

1. Rina taps **+**.
2. **Tap "Income".** Categories grid: Salary, Freelance, Business, Gift, Other. **Salary** is pre-selected.
3. **Type "60,000".** Account picker defaults to City Bank (her salary account).
4. **Tap "Save".** Toast: *"৳ 60,000 added to Salary."*
5. Home re-renders: income ৳ 60K, expenses unchanged, balance ৳ 60K higher. **First goal card** appears with required-per-month calculation auto-updated.

---

### Journey 4 — Transfer between accounts (Rina, moving cash to savings)

**Climax:** Two balances update simultaneously. Totals stay the same.

1. Rina taps **+**. → **Tap "Transfer"**.
2. Form shows: **From** (account picker, default Cash) · **To** (account picker) · **Amount**.
3. Rina picks City Bank → Savings, types "10,000".
4. **Tap "Save".** Both accounts update on Home. Total balance is unchanged. Toast: *"৳ 10,000 moved from City Bank to Savings."*

> Form must visually warn if "From" and "To" are the same account before save (button shows error inline).

---

### Journey 5 — Create a savings goal (Rina, planning a phone)

**Climax:** Rina sees exactly how much she needs per month.

1. Rina taps **Goals** in bottom bar. → Goals list, currently empty, with one big **+ New Goal** button.
2. **Tap "New Goal".** → Full-screen form: Name · Target amount · Target date (date picker, future only) · (collapsed) Starting amount, Notes.
3. Rina types: "New phone" / "35,000" / picks 6 months out.
4. **Tap "Save".** → Goal appears at top of Goals list **and** on Home.
5. Goal card on Home shows: *"You need ৳ 5,833 / month to reach this by March 14, 2027."* Progress bar at 0%.

> If target date is in the past, the date picker blocks it with inline message: *"Pick a date in the future."*

---

### Journey 6 — Mark a goal contribution (Rina, end of month)

**Climax:** Goal progress jumps. Account balance drops.

1. Rina opens **Goals** → taps a goal → goal detail screen.
2. **Tap "+ Add to goal".** Bottom sheet: Amount · Source account.
3. Rina types "2,000", picks Cash, **Tap "Add"**.
4. Goal progress bar animates to its new percentage. Account balance on Home drops. Toast: *"৳ 2,000 added to New phone."*

---

### Journey 7 — Edit a transaction (Rina, fixing a typo)

**Climax:** Edits propagate to totals without making the user re-enter anything.

1. Rina opens **Txns** (full transaction list).
2. She taps the wrong entry → transaction detail screen.
3. **Tap pencil icon** → inline editing for amount, category, account, date, note. Type picker pre-selected matches the original type.
4. Change amount from "250" to "260", **Tap "Save"**.
5. Toast: *"Transaction updated."* Home, Txns list, monthly totals all reflect the new amount.

> Delete button sits behind a **Trash** icon → confirmation modal: *"Delete this ৳ 250 Food expense? This cannot be undone."* Buttons: **Cancel** | **Delete**.

---

### Journey 8 — Back up data (Rina, before a phone reset)

**Climax:** One tap produces a portable file Rina can email to herself.

1. Rina taps **Settings** in bottom bar.
2. **Tap "Export data".** → Modal: *"This creates a backup file you can save anywhere."* Button: **Export**.
3. Browser downloads `finora-backup-2026-08-13.json`.
4. Toast: *"Backup saved."* Settings screen returns to default.

> The exported JSON must be human-readable (no minified blobs) so the user can verify it.

---

### Journey 9 — Restore data (Rina, new phone)

**Climax:** Imported file replaces everything; nothing else to do.

1. Rina taps **Settings** → **Import data** → file picker.
2. She picks her saved JSON.
3. App validates the file. On success, a confirmation modal appears: *"This will replace all your current data. Continue?"* Buttons: **Cancel** | **Replace**.
4. **Tap "Replace".** App wipes current data and loads the file. Toast: *"Data restored."* Lands on Home with everything intact.

> On invalid file: *"This file isn't a valid backup. It may be from a different version."* — no data is changed.

---

### Journey 10 — Wipe everything (Rina, gifting the phone)

**Climax:** One irreversible action, fully confirmed, no surprises.

1. Rina taps **Settings** → **Delete all data**.
2. Red-bordered modal: *"This permanently deletes all your transactions, accounts, and goals on this device. This cannot be undone."* Buttons: **Cancel** | **Delete everything** (red).
3. **Tap "Delete everything".** App clears local storage, lands on onboarding. Toast: *"All data deleted."*

> App never silently deletes. App never requires export before delete.

---

## 3. Screen Inventory & Visual Skeletons

Every screen below is reachable from a journey above. ASCII sketches show layout intent only.

### 3.1 Onboarding

```
┌──────────────────────────┐
│                          │
│        [ Finora ]        │
│                          │
│   How much money do you  │
│   have available right    │
│   now across all your     │
│   accounts?               │
│                          │
│   ┌────────────────────┐ │
│   │  ৳                 │ │
│   └────────────────────┘ │
│                          │
│   [ Get started ]        │
│                          │
└──────────────────────────┘
```

### 3.2 Home (Dashboard)

```
┌──────────────────────────┐
│  Hi, Rina         Aug    │
│                          │
│  This month              │
│  ৳ 38,500                │
│  balance                 │
│  ─────────────────────── │
│  Income   Expenses  Goals│
│  ৳60K     ৳21.5K    3    │
│                          │
│  Accounts                │
│  Cash         ৳ 12,000   │
│  City Bank    ৳ 18,500   │
│  bKash        ৳ 8,000    │
│                          │
│  Goals                   │
│  New phone    45%  ▰▰▰░  │
│  Emergency    80%  ▰▰▰▰  │
│                          │
│  Recent                  │
│  Lunch · Food   -৳ 250   │
│  Salary         +৳ 60K   │
│                          │
├──────────────────────────┤
│ Home Txns [+] Goals  ⚙   │
└──────────────────────────┘
```

### 3.3 Quick-Add Bottom Sheet (the moment of choice)

```
┌──────────────────────────┐
│                          │
│  What happened?          │
│                          │
│  ┌──────────┐ ┌────────┐ │
│  │  Income  │ │Expense │ │
│  │    ↑     │ │   ↓    │ │
│  └──────────┘ └────────┘ │
│  ┌──────────────────────┐│
│  │      Transfer        ││
│  │       ⇄              ││
│  └──────────────────────┘│
│                          │
│  [ Cancel ]              │
└──────────────────────────┘
```

### 3.4 Add Expense (the 3-tap path)

```
┌──────────────────────────┐
│  ←  Add expense          │
│                          │
│  Amount                  │
│  ┌──────────────────────┐│
│  │ ৳ 250                ││
│  └──────────────────────┘│
│                          │
│  Category                │
│  ┌────┐┌────┐┌────┐     │
│  │Food││Trns││Hous│     │
│  └────┘└────┘└────┘     │
│  ┌────┐┌────┐┌────┐     │
│  │Bils││Shop││Heal│     │
│  └────┘└────┘└────┘     │
│                          │
│  Account                 │
│  [ Cash             ▾ ]  │
│                          │
│  [      Save       ]     │
└──────────────────────────┘
```

### 3.5 Goals List

```
┌──────────────────────────┐
│  Goals           [+ New] │
│                          │
│  New phone        45%    │
│  ৳ 35,000 by Mar 14      │
│  ▰▰▰▱▱▱▱▱▱▱▱▱  ৳ 15,750 │
│                          │
│  Emergency        80%    │
│  ৳ 50,000 by Dec 31      │
│  ▰▰▰▰▰▰▰▰▱▱▱▱  ৳ 40,000 │
│                          │
│  Travel           10%    │
│  ৳ 100,000 by Aug 28     │
│  ▰▱▱▱▱▱▱▱▱▱▱▱  ৳ 10,000  │
└──────────────────────────┘
```

### 3.6 Settings

```
┌──────────────────────────┐
│  ← Settings              │
│                          │
│  Security                │
│  App PIN                 off ›
│                          │
│  Data                    │
│  Export data             › │
│  Import data             › │
│  Delete all data         › │
│                          │
│  About                   │
│  Version 1.0             │
│  Privacy                 › │
│                          │
└──────────────────────────┘
```

---

## 4. Interaction Patterns (the small repeated gestures)

| Gesture | Where it appears | What happens |
|---|---|---|
| **Tap to focus + open keyboard** | Amount input | Cursor jumps in, number pad rises. |
| **Tap a category tile** | Add Expense / Income | Tile highlights (teal border). Tap again to deselect. |
| **Swipe left on a row** | Txns list | Reveals Edit (blue) + Delete (red) buttons. |
| **Pull-to-refresh** | Txns list | No-op (data is local) but the gesture is honored with a 200 ms settle, no spinner. |
| **Long-press a goal card** | Goals list / Home | Quick menu: Edit, Mark contribution, Delete. |
| **Bottom sheet drag-down** | Quick-add sheet | Dismisses without action. |
| **Inline save** | Edit forms | Save button stays disabled until valid. No "Save anyway" buttons. |

---

## 5. Empty States (what users see when there's nothing to see)

| Surface | Empty state |
|---|---|
| **Home (no transactions)** | A single inviting card: *"No transactions yet. Tap + to add your first."* |
| **Txns (no transactions)** | Same text. Below it: a ghost row of the most common categories as one-tap shortcuts. |
| **Goals (no goals)** | *"Save toward something. Tap + New Goal."* |
| **Accounts (only Cash)** | No empty state shown — one default account is always present. |
| **Settings** | Never empty. |

> Empty states are not blank screens. Every empty state has **one** action that moves the user forward.

---

## 6. Error & Validation Language

Every error tells the user **what** is wrong, **why** it matters, and **how to fix it** — in one short sentence.

| Situation | Message |
|---|---|
| Amount ≤ 0 | *"Enter an amount greater than 0."* |
| Goal date in the past | *"Pick a date in the future."* |
| Delete category in use | *"This category is used in 4 entries. Reassign or delete those first."* |
| Same-account transfer | *"Pick a different account to transfer to."* |
| Import invalid file | *"This file isn't a valid backup. It may be from a different version or corrupted."* |
| Import from newer version | *"This backup is from a newer version of Finora. Update the app to import it."* |
| Delete account with entries | *"This account has 12 entries. Move or delete them first."* |
| Delete all data (confirm) | *"This permanently deletes all your data on this device. This cannot be undone."* |

> Errors appear **inline**, next to the offending field. They never appear as modal dialogs during data entry. The only modal confirms are: **delete transaction**, **delete all data**, and **import replace**.

---

## 7. Accessibility Floor

| Need | How Finora answers |
|---|---|
| Screen readers | All monetary values are read as "thirty-eight thousand five hundred taka", not raw digits. |
| Color is not the only signal | Income/Expense use **arrow icons** (↑ / ↓) and **text labels** alongside color. |
| Keyboard navigation | All primary flows reachable by keyboard. Tab order follows visual order. |
| Touch targets | Every tap target is ≥ 44 × 44 px. Categories grid cells are 64 × 64 px. |
| Focus rings | Visible 2 px teal ring on every focused element. Never removed. |
| Motion | Animations are 200 ms or less. A "Reduce motion" setting respected from OS. |

---

## 8. Visual Tokens (locked from Mockup v1)

| Token | Value | Used for |
|---|---|---|
| `color.bg` | `#0F1419` | App background |
| `color.surface` | `#1A2028` | Cards, bottom sheet, modals |
| `color.surface.2` | `#232B36` | List rows, nested surfaces |
| `color.ink` | `#E6EDF3` | Primary text |
| `color.muted` | `#8B949E` | Secondary text, labels |
| `color.primary` | `#2DD4BF` | Income, primary buttons, focus rings |
| `color.accent` | `#A78BFA` | Goals, tertiary highlights |
| `color.danger` | `#F87171` | Expense, delete, errors |
| `radius.card` | `14px` | Cards, bottom sheet |
| `radius.button` | `12px` | Buttons, inputs |
| `radius.pill` | `999px` | Category pills, status badges |
| `space.gutter` | `14px` | Phone padding |
| `space.row` | `8px` | Vertical rhythm inside cards |
| `font.size.hero` | `38px` | Dashboard balance |
| `font.size.body` | `15px` | Default body text |
| `font.size.label` | `11px` | Section labels, uppercase |
| `shadow.card` | `0 4px 20px rgba(0,0,0,.4)` | Default card elevation |

> See `mockups/theme-4-midnight.html` and the four `mockups/dash-*.html` variants. Visuals win on conflict with prose; tokens above are the single source of truth for any future mockup.

---

## 9. Out of UX Scope (V1)

These are deliberate non-features — their absence is the design:

- ❌ Charts and graphs (totals in numbers are enough).
- ❌ Financial Health score.
- ❌ Notifications / reminders.
- ❌ Onboarding animations longer than 200 ms.
- ❌ Carousels, hero banners, splash videos.
- ❌ Tooltips on first use beyond a single pulsing + button.

Each "out of scope" item is a promise that the app will stay quiet, fast, and focused on **knowing where the money went**.

---

## 10. Definition of UX Done

The V1 UX is complete when:

- [ ] A first-time user can complete **Journey 1 (First run)** in under 60 seconds unaided.
- [ ] A first-time user can complete **Journey 2 (Quick expense)** in three taps, ≤ 15 seconds.
- [ ] All ten journeys pass on a mid-range Android phone with no perceptible lag.
- [ ] Every screen has at most one primary action.
- [ ] Every error message passes the what / why / how test.
- [ ] Every state (empty, loading, error, success) has explicit copy.
- [ ] All monetary values read correctly via TalkBack / VoiceOver.
- [ ] Tap targets are ≥ 44 px.
- [ ] No screen requires horizontal scroll on a 360 px wide viewport.
- [ ] Every feature works offline.

---

*— End of UI/UX User Flow · Finora V1 —*
