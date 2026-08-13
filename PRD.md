# Finora — Product Requirements Document (PRD)

| Field | Value |
|---|---|
| **Product** | Finora — Personal Bookkeeping |
| **Version** | 1.0 (MVP) |
| **Status** | Approved for Build |
| **Document Owner** | John (Product Manager) |
| **Target User** | Everyday people who want to know where their money goes |
| **Primary Language** | English |
| **Currency** | BDT (৳) |
| **Storage Model** | Local-first (device/browser) |
| **Authentication** | None in V1 (optional local PIN lock) |
| **Last Updated** | 2026-08-13 |

---

## 1. Executive Summary

**Finora** is a simple personal bookkeeping app for everyday people. It helps a user answer three questions and only three:

1. **Where did my money come from?** (Income)
2. **Where did my money go?** (Expenses)
3. **What's still owed, in either direction?** (Debts — money I owe, money others owe me)

That's it. Everything else in the app exists to support those three questions.

The user records money in and money out, organized into simple **accounts** (Cash, Bank, Mobile Wallet, etc.) and **categories** (Food, Rent, Salary, etc.). The app shows running totals, monthly summaries, a list of savings goals, and a list of debts. All data lives on the user's device — no account, no cloud, no signup.

### One-sentence description

A local-first bookkeeping app that lets anyone track income, expenses, and debts without learning accounting.

### What this app is NOT

- Not a budget planner with recommendations
- Not an investment tracker
- Not a financial-health scoring tool
- Not a charting or analytics dashboard
- Not a bank, broker, or accountant
- Does not move money or connect to a bank

> **In scope for V1:** Basic debt tracking — record a debt, mark payments toward it, see total owed / owed to you. No interest, no amortization, no payoff schedules.
>
> **Out of scope for V1:** Financial Health score, Charts, DPS/FDR projections, Investments, **advanced debt (interest rates, amortization, payoff schedules)**, Monthly Planning recommendations, Insights engine. Savings Goals and basic Debts ARE in scope (kept simple).

---

## 2. Product Vision

> **Know where your money goes. That's the whole job.**

A user should be able to:

- Add money received → it shows in totals and account balance.
- Add money spent → it shows in totals and category breakdown.
- Glance at the dashboard → see this month's income, expenses, and balance.
- Add a savings goal → see how much more per month is needed, and track progress.
- Back up or restore their data → without any technical knowledge.

---

## 3. Target User

### Primary Persona

**"Rina" — a non-technical adult who wants to keep tabs on personal spending.**

- Has a job and a bank account, maybe a mobile wallet (bKash/Nagad).
- Knows what "income" and "expense" mean. Does not know what "amortization" means.
- Wants to answer: *"Did I spend too much this month?"*
- Has never used accounting software. May have tried a notes app or spreadsheet.
- Will abandon the app if the first screen asks three setup questions.

### Anti-Persona

- A small-business owner who needs invoicing, GST, or tax filing.
- A user wanting automated bank feeds.
- A power user wanting investment tracking, amortization schedules, or interest-bearing debt payoff modeling. (V1 tracks debts as records only — no interest math.)

---

## 4. Goals & Success Metrics

### Primary Goals (Must-Have)

| # | Goal | Success Metric |
|---|---|---|
| G1 | A novice can record income in under 30 seconds | First-time user completes a test income entry unaided |
| G2 | A novice can record an expense in under 15 seconds (3 taps) | Quick-add: Amount → Category → Save |
| G3 | Account balances update automatically and match what the user expects | User-verified balance = app balance after 5 manual entries |
| G4 | Monthly income and expense totals are visible at a glance | Dashboard shows current-month totals without any click |
| G5 | Categories are customizable but work out-of-the-box | Default categories cover ≥90% of common entries |
| G6 | Savings goals are easy to set and track | User can create a goal with target amount and date in one screen |
| G7 | All data is stored locally | App works fully offline; no signup or login required |
| G8 | Data can be backed up and restored | User can export and re-import their data successfully |
| G9 | The app never silently changes data | Every change is the result of an explicit user action |
| G10 | A novice can record a debt and a payment toward it in under 30 seconds | First-time user creates a debt and tags a payment unaided |

### Secondary Goals

- The app feels fast — no loading spinner for any primary action.
- The wording is in plain English; financial jargon is either avoided or explained in one line.
- The UI works well on a phone screen.

---

## 5. Non-Goals (Explicitly Out of Scope for V1)

| # | Non-Goal | Why |
|---|---|---|
| N1 | Financial Health score | Too abstract for novices; deferred to V2 |
| N2 | Charts and graphs | Adds complexity; totals in numbers are sufficient for V1 |
| N3 | DPS / FDR / investment product calculations | Not bookkeeping; deferred to V2 |
| N4 | Investment tracking | Not bookkeeping; deferred to V2 |
| N5 | Debt tracking with **interest and amortization** | Confusing for novices; basic record-only debt tracking is in V1, advanced math is deferred to V2 |
| N6 | Monthly budget recommendations | Power-user feature; deferred to V2 |
| N7 | Insights / trend analysis | Too analytical; deferred to V2 |
| N8 | Bank integration / automatic import | Privacy and complexity concerns |
| N9 | Cloud sync / user accounts | V1 is local-first by design |
| N10 | Tax calculations | Out of scope entirely |
| N11 | Multi-currency | V1 is BDT only |
| N12 | Notifications / reminders | In-app only; no push/email/SMS |

---

## 6. Product Scope — Module Inventory

| # | Module | V1 Scope |
|---|---|---|
| 1 | Dashboard | This month's totals + recent activity + debts summary |
| 2 | Transactions | Income, Expense, Transfer (with optional debt-link tag) |
| 3 | Accounts | Add, edit, list, see balance |
| 4 | Categories | Pre-defined set; user can add/edit/disable |
| 5 | Savings Goals | Target amount, target date, progress bar |
| 6 | Debts | Record-only: total owed / owed to you, payments, auto-complete at 0. No interest math. |
| 7 | Settings | Currency (locked to BDT in V1), app PIN (optional), export, import, delete all data |

**Removed from V1 (compared to earlier draft):** DPS, FDR, Investments, advanced Debt (interest/amortization), Monthly Planning, Financial Health, Net Worth history, Charts, Insights.

---

## 7. Information Architecture

### Primary Navigation (Bottom Bar)

- **Home** (Dashboard)
- **Transactions** (list of all entries)
- **Add** (big button, center) — quick add Income or Expense
- **Goals**
- **Debts**
- **Settings**

### Screens

- **Dashboard:** Monthly totals, account balances, recent transactions.
- **Transactions list:** All entries, sortable by date, filterable by type/account/category.
- **Add transaction:** Amount → Type (Income/Expense) → Category → Account → Save.
- **Accounts list:** Each account with its current balance.
- **Account detail:** Balance + transaction history for that account.
- **Goals list:** All goals with progress.
- **Goal detail / create:** Name, target, deadline, current saved.
- **Debts list:** Two sections — *I owe* and *Owed to me*. Each entry shows total, paid so far, progress bar.
- **Debt detail / create:** Name, direction (I owe / Owed to me), total, paid so far (defaults to 0), optional due date, optional person/entity. Shows linked transactions.
- **Settings:** App PIN, Export data, Import data, Delete all data, About.

---

## 8. User Journeys

### 8.1 First Use (Onboarding)

1. User opens the app for the first time.
2. **One question:** *"How much money do you have available right now across all your accounts?"* — single number field.
3. App creates one default account ("Cash") seeded with that amount.
4. User lands on the Dashboard. The "Add" button is the most prominent thing on screen.

**Onboarding principle:** Two screens, one number. Then the app.

### 8.2 Record Income

1. Tap **Add**.
2. Choose **Income**.
3. Enter amount.
4. Choose category (Salary, Freelance, Gift, Other — predefined, pickable).
5. Choose account (or default = Cash).
6. Tap **Save**.

→ Balance updates. Dashboard reflects new monthly income.

### 8.3 Record Expense (Quick Path)

1. Tap **Add**.
2. Choose **Expense**.
3. Enter amount.
4. Pick a category from the visible grid.
5. Tap **Save**.

→ Three taps total. Balance updates. Dashboard reflects new monthly expense.

### 8.4 Transfer Between Accounts

1. Tap **Add**.
2. Choose **Transfer**.
3. Pick "From" account, "To" account, enter amount.
4. Tap **Save**.

→ Both account balances update. Total money across all accounts stays the same.

### 8.5 Create a Savings Goal

1. Tap **Goals** → **New Goal**.
2. Enter name (e.g., "New phone").
3. Enter target amount.
4. Pick a target date.
5. Tap **Save**.

→ App shows: *"You need to save ৳X per month to reach this goal by [date]."*
→ Goal appears on dashboard with a progress bar (0% until first contribution).

### 8.6 Mark a Goal Contribution

1. Open the goal.
2. Tap **Add to goal**.
3. Enter amount.
4. Pick source account.
5. Tap **Save**.

→ Account balance decreases. Goal progress updates.

### 8.7 Back Up Data

1. Tap **Settings** → **Export data**.
2. App downloads a single `.json` file.
3. User saves it anywhere (email to self, drive, USB).

### 8.8 Restore Data

1. Tap **Settings** → **Import data**.
2. User picks the previously exported `.json` file.
3. App replaces all current data with the imported data. (Asks for confirmation first.)

### 8.9 Delete All Data

1. Tap **Settings** → **Delete all data**.
2. App shows confirmation: *"This deletes all your transactions, accounts, and goals on this device. This cannot be undone."*
3. Two buttons: **Cancel** | **Delete everything**.

### 8.10 Create a Debt (Money I Owe)

1. Tap **Debts** in the bottom bar → Debts list.
2. Tap **+ New debt**.
3. Direction defaults to *I owe*. Rina can tap to switch to *Owed to me*.
4. Enter **name** (e.g., "City Bank loan"), **total** amount.
5. Optionally: starting **paid so far**, **due date**, **person / institution** name.
6. Tap **Save**.

→ Debt appears under *I owe* with progress bar at paid-so-far / total. A summary card on Home updates.

### 8.11 Record a Debt Payment (Money I Owe)

1. Two paths to start a payment:

   - **From Debts screen:** Open the debt → tap **+ Payment** → enter amount → pick account → save.
   - **From Add Expense:** Choose category → a toggle **"Tag as debt payment →"** appears. Toggle on → pick which debt → fill the rest of the expense form → save.

2. App creates an **Expense** transaction with `linked_debt_id` set. Account balance drops. Debt's paid-so-far rises.
3. Home updates: *Total I owe* decreases by the payment.

### 8.12 Lend Money (Money Owed to Me)

1. Rina records an **Expense** with a category, picks the account (Cash, etc.), enters amount ৳5,000, note: "Loan to Sumi".
2. After category selection, toggle **"Tag as debt payment →"** is visible.
3. Toggle on → **New debt** option appears → choose **Owed to me**.
4. Enter name (e.g., "Sumi loan"), total = 5,000, paid so far = 0, person = "Sumi", save.

→ A debt appears under *Owed to me*. Dashboard *Owed to Me* shows ৳ 5,000.

### 8.13 Receive a Debt Repayment (Money Owed to Me)

1. Tap **Add** → **Income**.
2. Enter amount, choose category.
3. Toggle **"Tag as debt payment →"** on → pick the debt Rina is being repaid for.
4. Save.

→ Income transaction created with `linked_debt_id`. Account balance rises. Debt's paid-so-far rises. Dashboard *Owed to Me* drops.

### 8.14 Edit or Delete a Debt

- **Edit a debt:** Open debt → tap **Edit** → change name, total, due date, or person. The `paid_so_far` field is locked when there are linked transactions (it follows the sum of those transactions).
- **Delete a debt:** Open debt → tap **Delete**. App warns: *"This debt has N payment records. They'll stay in your transaction list."* Tap **Delete debt** to confirm. The debt is soft-archived. Its linked transactions keep their link but display a small "Archived debt" tag.

### 8.15 Debt Auto-Completes

When the sum of linked transactions equals or exceeds the debt's total:

- The debt shows a green **Paid off** badge on its card.
- It moves to the bottom of its section (I owe / Owed to me), visually muted.
- A toast: *"City Bank loan paid off. Nice."*
- The dashboard *Total I owe* (or *Owed to Me*) drops to 0.

---

## 9. Functional Requirements

### 9.1 Dashboard

**Shown on Home:**

- **This month:** Income ৳X · Expenses ৳Y · Balance (Income − Expenses) ৳Z.
- **Accounts:** Each account with its current balance. Total balance at the top.
- **Active goals:** Up to 3 goals with progress bars. Tap to see all.
- **Recent activity:** Last 5 transactions (date, description, amount).

**Hidden from dashboard (deferred to V2):** Charts, financial health, spending breakdowns.

### 9.2 Transaction System

**Supported types (V1):**

1. **Income** — money received.
2. **Expense** — money spent.
3. **Transfer** — money moved between the user's own accounts.

**Common fields for every transaction:**

- Amount (required, must be > 0)
- Date (defaults to today)
- Note (optional, one line)

**Type-specific:**

| Type | Required fields | Effect on account |
|---|---|---|
| Income | Amount, Category, Account | Destination account balance increases |
| Expense | Amount, Category, Account | Source account balance decreases |
| Transfer | Amount, From account, To account | From decreases, To increases, total unchanged |

**Rules:**

- A Transfer is **not** income or expense.
- Editing a transaction re-computes account balances and monthly totals.
- Deleting a transaction is permanent after confirmation.

### 9.3 Accounts

**Predefined account types (V1):**

- Cash
- Bank Account
- Mobile Wallet (bKash, Nagad, Rocket, etc. — generic label)
- Savings Account
- Other

**Each account has:**

- Name (user-defined, e.g., "City Bank Salary")
- Type (chosen from list above)
- Opening balance (entered once)
- Current balance (derived = opening balance + sum of all transactions)
- Created date (auto)

**V1 does NOT support:** "Include in Net Worth" toggle, currency per account, archived/hidden accounts beyond delete.

### 9.4 Categories

**Two category sets:**

- **Income categories:** Salary, Freelance, Business, Gift, Other.
- **Expense categories:** Food, Transport, Housing, Bills, Shopping, Health, Education, Family, Entertainment, Other.

**User can:**

- Add a new category (one text field).
- Rename an existing category.
- Delete a category only if no transactions use it (otherwise show error).

**User cannot:**

- Create nested categories. (One flat list per type. No folder structure.)
- Change the type of an existing category. (Delete and recreate.)

### 9.5 Savings Goals

**Fields:**

- Name (required)
- Target amount (required, > 0)
- Target date (required, must be in the future)
- Starting amount (optional, defaults to 0)
- Notes (optional, one line)

**Calculations:**

```
Remaining = Target amount − Current saved
Months left = Number of months between today and target date (rounded down)
Required per month = Remaining ÷ Months left   (if Months left > 0)
```

**States:**

- **Active** — still being saved toward.
- **Completed** — current saved ≥ target. (User can choose to keep it visible or hide it.)
- **Expired** — target date passed without completion. App shows: *"This goal's date has passed. Extend the date or mark it complete?"* with two buttons.

**V1 does NOT support:** Goal investment returns, goal linking to a specific account, automatic monthly transfers to goals.

### 9.6 Settings

| Setting | Behavior |
|---|---|
| App PIN (optional) | 4-digit PIN. If set, asked at app open. V1 has no recovery — if forgotten, user must delete all data. |
| Export data | Downloads a `.json` file containing everything. |
| Import data | Replaces current data with file contents. Asks for confirmation. |
| Delete all data | Permanently wipes local data. Confirmation required. |
| About | App name, version, link to docs/feedback. |

**Currency is fixed to BDT in V1. No selector shown.**

### 9.7 Debts

A **debt** is a record with a total, a paid-so-far number, and a direction. The app shows progress; it does **not** calculate interest, payoff schedules, or amortization.

**Direction:**
- `i_owe` — Money I owe (loans, credit cards, mobile-wallet credit, borrowed from family).
- `owed_to_me` — Money others owe me (lent to friends, family, etc.).

**Fields (per debt):**

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes | Free text, e.g. "City Bank loan" or "Sumi loan" |
| `direction` | enum | yes | `i_owe` or `owed_to_me` |
| `total` | number | yes | > 0, set at create, can be edited |
| `paid_so_far` | number | no | ≥ 0, defaults to 0. **Auto-derived** when there are linked transactions |
| `due_date` | date | no | Optional; not blocking |
| `person` | string | no | Optional; institution or person name |
| `created_at` | date | yes | Auto |

**Linked transactions (one-way link):**

- A debt payment is a regular transaction (Expense for `i_owe`, Income for `owed_to_me`) with a `linked_debt_id` field set.
- Looking at a debt → Rina sees its payment history (a list of linked transactions).
- Looking at a transaction → a small "Debt: <name>" tag is shown.
- The debt's `paid_so_far` is the **sum of its linked transactions**. Rina cannot enter `paid_so_far` directly once a transaction is linked.
- Editing a linked transaction's amount re-derives `paid_so_far`.
- Deleting a linked transaction subtracts its amount from `paid_so_far`.

**Money does NOT auto-move.** Creating a debt does not affect account balances. To record the actual cash transfer (e.g., Rina paid ৳5,000 to the bank), Rina creates an Expense tagged to the debt — that single transaction moves cash AND updates the debt.

**Dashboard role:**

- A **Debts card** sits below the Goals card on Home.
- Two headline numbers:
  - **Total I owe:** ৳25,000 (rendered in danger color).
  - **Owed to me:** ৳8,000 (rendered in primary/mint color).
- Below: a horizontal strip of up to 3 active debts with progress bars (similar to Goals).
- Tap the card title → full Debts list. Tap any debt card → debt detail.

**Auto-complete rule:**

- When `paid_so_far >= total`, debt auto-completes.
- Card shows a "Paid off" badge and moves to the bottom of its section, visually muted.
- Dashboard total drops by the debt's total.

**Soft-archive:**

- A deleted debt is soft-archived (not erased).
- Its linked transactions keep their `linked_debt_id` reference but display an "Archived debt" tag.
- Debt can be manually archived by Rina before fully paid.

**V1 does NOT support:**
- Interest rates (informational only, not in V1).
- EMI schedules.
- Amortization tables.
- Payoff date calculation based on monthly payment.
- Linking a debt to a specific account (the link is at the transaction level, not the debt level).
- Automatic monthly payment reminders.

### 9.7 Local Data Storage

- All data is stored on the user's device.
- The PRD does not mandate a specific storage technology; engineering may pick the appropriate local persistence layer.
- The data model is designed so cloud sync can be added later without rewriting the bookkeeping logic.

### 9.8 Data Export

**Export format:** Single `.json` file containing:

- All accounts
- All categories (including user-added ones)
- All transactions
- All savings goals
- App settings (PIN is **not** exported)
- A version field (e.g., `"version": 1`)

CSV export is **not required** for V1. JSON is sufficient and lossless.

### 9.9 Data Import

- User selects a `.json` file.
- App validates the file: schema, version, required fields.
- On validation failure, app shows: *"This file isn't a valid backup. It may be from a different version or corrupted."*
- On success, app asks for confirmation: *"This will replace all your current data. Continue?"*
- On confirm, app wipes current data and loads the file.

### 9.10 Data Deletion

- Single button in Settings: **Delete all data**.
- Confirmation: *"This permanently deletes all your transactions, accounts, and goals on this device. This cannot be undone."*
- Buttons: **Cancel** | **Delete everything**.
- The app does **not** require an export before deletion.

---

## 10. Core Financial Rules (Authoritative)

| # | Rule | Formula |
|---|---|---|
| R1 | Monthly income | Sum of all income transactions dated in the current month |
| R2 | Monthly expenses | Sum of all expense transactions dated in the current month |
| R3 | Account balance | Opening balance + sum of all transactions on that account |
| R4 | Transfer rule | Transfers move money between accounts; they are not income or expense |
| R5 | Goal requirement | Remaining = Target − Current; Required per month = Remaining ÷ Months left |
| R6 | Source of truth | The user's recorded transactions are the only thing that changes account balances |
| R7 | Debt paid_so_far | `paid_so_far` = sum of linked transactions' amounts (Expense for `i_owe`, Income for `owed_to_me`) |
| R8 | Debt completion | When `paid_so_far >= total`, debt is auto-completed and dashboard totals drop |

---

## 11. Error Handling Requirements

Every error message must:

1. Say **what** went wrong (in plain English).
2. Say **why** it matters.
3. Say **how to fix it**.

**Examples:**

| Situation | Error message |
|---|---|
| User enters 0 or negative amount | *"Enter an amount greater than 0."* |
| User enters a past goal date | *"Pick a date in the future."* |
| User deletes a category in use | *"This category is used in 4 transactions. Reassign or delete those first."* |
| User imports an invalid file | *"This file isn't a valid backup. It may be from a different version."* |
| User tries to delete all data | *"This deletes all your data on this device. This cannot be undone."* (confirmation, not error) |
| User creates a debt with no name | *"Give this debt a name."* |
| User creates a debt with `paid_so_far > total` | *"Paid so far can't be more than total."* |
| User records a payment that exceeds remaining | *"This is more than what's left (৳ X). Reduce the amount."* |
| User edits a debt's total below `paid_so_far` | *"Total (৳ X) is less than already paid (৳ Y). Reduce paid first or raise total."* |
| User adds a payment to a fully paid debt | *"This debt is fully paid. Unarchive it first if this is a mistake."* |
| User deletes a debt with linked transactions | *"This debt has N payment records. They'll stay in your transaction list."* |

---

## 12. UX Principles

| Principle | What it means in practice |
|---|---|
| **One primary action per screen** | The Add button is always one tap away. |
| **Plain English** | "Income" and "Expense", not "Credits" and "Debits". |
| **Numbers, not scores** | Show ৳20,000 expenses, not "spending is 18% above average". |
| **Defaults that work** | New account = Cash. New expense = most recent category. |
| **Reversible** | Edit or delete any transaction. |
| **Debts connect, never couple** | A debt and its transactions are linked, but each can be edited independently. Deleting a debt doesn't erase its history. |
| **No setup walls** | Onboarding asks one question. Everything else is progressive. |
| **Offline always** | No feature requires internet. |

---

## 13. Non-Functional Requirements

### 13.1 Performance

- Adding an expense (quick path) takes ≤ 3 taps and finishes in under 1 second.
- Dashboard loads in under 1 second for up to 10,000 transactions.
- All calculations (totals, balances) recompute instantly on data change.

### 13.2 Privacy & Security

- No financial data is sent off-device.
- No analytics by default.
- Export files contain sensitive data — treat accordingly.
- Import files are treated as untrusted input and validated.
- App PIN (if set) is stored locally and never exported.

### 13.3 Accessibility

- All monetary values are screen-reader friendly (e.g., "Twenty thousand taka", not just "20000").
- Color is not the sole signal (use icons + text).
- Keyboard navigation works for all primary flows.

### 13.4 Internationalization

- Primary language: English.
- Bangla localization is a V2 candidate.

### 13.5 Reliability

- Calculations are deterministic and unit-tested.
- Edit and delete operations recalculate all dependents reliably.
- Import does not silently corrupt data.

---

## 14. Testing Strategy

### 14.1 Unit Tests (Required)

- Income / expense / transfer math
- Account balance recalculation on edit and delete
- Monthly totals (including month boundaries)
- Goal calculations (remaining, required per month)
- Debt `paid_so_far` derivation from linked transactions
- Debt auto-completion at `paid_so_far >= total`
- Import validation (good file, bad file, wrong version)

### 14.2 Integration Tests

- Add expense → account balance and dashboard update
- Add income → account balance and dashboard update
- Transfer → both accounts update, totals unchanged
- Edit transaction → balances and totals recalculate
- Delete transaction → balances and totals recalculate
- Goal contribution → goal progress and account balance update
- Debt payment → debt `paid_so_far` and account balance update
- Edit a debt-linked transaction → debt `paid_so_far` re-derives
- Delete a debt-linked transaction → debt `paid_so_far` decreases
- Debt auto-completion → dashboard total drops
- Import → full state restored

### 14.3 End-to-End Scenarios (Minimum)

- First-run onboarding
- Record a week of mixed income and expenses
- Set up a goal and contribute to it
- Record a debt (City Bank loan) and make 2 payments toward it; verify `paid_so_far` updates
- Lend money to a friend (Sumi) and receive one partial repayment
- Back up, delete all data, restore from backup

---

## 15. Edge Cases (Must Handle)

- Zero income this month
- Zero expenses this month
- Negative balance in an account (spend more than you have)
- Same-account transfer attempt (show error)
- Goal target date today
- Goal target date in the past (block on create)
- Goal completed before deadline
- Goal deadline passed without completion
- Deleting an account with transactions (block with clear error)
- Deleting a category with transactions (block with clear error)
- Empty transaction list
- Import file from a newer version (block with explanation)
- Debt with `paid_so_far == 0` at create (allowed, progress bar at 0%)
- Debt payment that exactly hits `total` (auto-completes)
- Debt payment that exceeds remaining (block with helpful error)
- Editing a debt-linked transaction downward, so that `paid_so_far` < sum of remaining transactions (allowed; `paid_so_far` re-derives)
- Editing a debt's direction (e.g., I Owe → Owed to me): linked transactions flip from Expense → Income or vice-versa with explicit confirmation
- Deleting a debt with linked transactions (soft-archive only; transactions stay)
- Adding a payment to a soft-archived or paid-off debt (block unless explicitly unarchived)

---

## 16. Open Technical Decisions

These belong in the technical specification phase and should not change product requirements:

- Exact local storage implementation
- Exact data schema
- Backup file schema / versioning
- App PIN hashing approach
- Frontend framework
- State management

---

## 17. Risks & Mitigations

| # | Risk | Mitigation |
|---|---|---|
| 1 | User enters wrong amount and doesn't notice | Recent transactions list on dashboard makes entries easy to spot and edit |
| 2 | User loses device and loses data | Export-to-file is one tap; user is reminded once at setup to back up |
| 3 | User forgets PIN | V1 has no recovery; user must delete all data and restore from backup |
| 4 | User opens app, sees empty state, leaves | Dashboard has prominent "Add" button; recent activity is shown even with one entry |
| 5 | User is confused by accounting terms | All labels are plain English; no jargon without a one-line explanation |
| 6 | User pays a debt but forgets to tag it | The "Tag as debt payment →" toggle is shown on every Expense and Income flow; debt completion status is visible on Home and the debt's own screen |
| 7 | User records a debt twice (once as a debt, once as a normal expense) without linking | App surfaces "Linked to debt: <name>" tag on linked transactions so Rina can spot and fix mismatches |

---

## 18. Future Roadmap (V2+)

| Theme | V2 Features |
|---|---|
| Insights | Spending by category breakdown, monthly comparison |
| Planning | Budget recommendations, savings rate |
| Investments | Simple investment tracking |
| Financial products | DPS / FDR calculators |
| Debt (advanced) | Interest rates, EMI schedules, amortization tables, payoff-date calculation |
| Net Worth | Aggregated asset/liability view |
| Charts | Income vs expense trend, category charts |
| Sync | Optional cloud backup with user account |
| Localization | Bangla |
| Multi-currency | USD, INR, EUR support |

---

## 19. Terminology

| Term | What it means in this app |
|---|---|
| Income | Money received (salary, gift, freelance payment) |
| Expense | Money spent (food, rent, transport) |
| Transfer | Money moved between your own accounts (e.g., Cash → Bank) |
| Account | Where your money lives (Cash, Bank, bKash, etc.) |
| Category | What the money was for (Food, Salary, etc.) |
| Goal | A target amount of money you want to save by a certain date |
| Debt | A record of money owed in either direction: I owe someone, or someone owes me |
| Direction | Whether a debt is *I owe* (money out, eventually to be paid) or *Owed to me* (money lent, eventually to be returned) |
| Balance | How much money is in an account right now |

We deliberately do **not** use: credit, debit, ledger, amortization, allocation, surplus, net worth, asset, liability. If a V2 feature needs one, it will be introduced with a one-line explanation.

---

## 20. Definition of Done — MVP

The MVP is complete when **all** of the following are true:

- [ ] Onboarding asks one question and lands the user on the dashboard.
- [ ] User can add income, expense, and transfer in ≤ 3 taps.
- [ ] Account balances update correctly and stay correct after edit and delete.
- [ ] Monthly income and expense totals appear on the dashboard.
- [ ] Categories are predefined and editable.
- [ ] User can create a savings goal and see required monthly amount.
- [ ] User can mark a goal contribution and see progress update.
- [ ] User can create a debt (I owe or Owed to me) with name, total, and optional due date.
- [ ] User can record a payment toward a debt, and the debt's `paid_so_far` updates.
- [ ] Debt auto-completes when `paid_so_far >= total`.
- [ ] Dashboard shows Total I owe and Owed to Me, plus a strip of active debts.
- [ ] User can export data to a `.json` file.
- [ ] User can import data from a previously exported file.
- [ ] User can delete all data with confirmation.
- [ ] All data is local; no backend or account is required.
- [ ] All V1 features work fully offline.
- [ ] Unit tests for all financial rules pass.
- [ ] End-to-end tests for the four core journeys pass.
- [ ] No feature from the "Non-Goals" list is implemented.

---

## 21. Product Summary

### What this app is

A simple, fast, local-first bookkeeping app. The user adds income and expenses. The app keeps totals and balances correct. The user can back up their data with one tap.

### What this app is not

It is not a financial advisor, a budget planner, an investment tracker, or a bank. It does not score the user's financial health. It does not generate charts. It does one job and does it well: **track where money came in and where it went out.**

### The one-line pitch

*"Finora knows where your money goes."*

---

*— End of PRD (V1, simplified for novice users) —*
