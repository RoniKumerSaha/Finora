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
| **Last Updated** | 2026-08-17 (help text sweep) |

---

## 1. Executive Summary

**Finora** is a simple personal bookkeeping app for everyday people. It helps a user answer four questions and only four:

1. **Where did my money come from?** (Income)
2. **Where did my money go?** (Expenses)
3. **What's still owed, in either direction?** (Debts — money I owe, money others owe me)
4. **What is my money earning while I wait?** (Investments — interest-bearing deposits like DPS, FDR, savings certificates)

That's it. Everything else in the app exists to support those four questions.

The user records money in and money out, organized into simple **accounts** (Cash, Bank, Mobile Wallet, etc.) and **categories** (Food, Rent, Salary, etc.). The app shows running totals, monthly summaries, a list of savings goals, a list of debts, and a list of investments with their expected maturity payouts. All data lives on the user's device — no account, no cloud, no signup.

### One-sentence description

A local-first bookkeeping app that lets anyone track income, expenses, debts, and interest-bearing deposits without learning accounting.

### What this app is NOT

- Not a budget planner with recommendations
- Not a stock / mutual fund / crypto tracker
- Not a financial-health scoring tool
- Not a charting or analytics dashboard
- Not a bank, broker, or accountant
- Does not move money or connect to a bank

> **In scope for V1:** Basic debt tracking — record a debt, mark payments toward it, see total owed / owed to you. No interest, no amortization, no payoff schedules. Basic interest-bearing deposit tracking (DPS, FDR, savings certificates, term deposits) — record principal, rate, and term; app shows the calculated maturity value; user records the real payout as Income at maturity. No daily interest accrual; no price tracking.
>
> **Out of scope for V1:** Financial Health score, Charts, stocks/mutual funds/crypto, **advanced debt (interest rates, amortization, payoff schedules)**, Monthly Planning recommendations, Insights engine. Savings Goals, basic Debts, and basic Investments (interest-bearing deposits only) ARE in scope (kept simple).

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
| N3 | Stocks, mutual funds, crypto, market-price investments | Out of scope for V1 — needs price tracking, gain/loss math, and a different mental model. Deferred to V2 |
| N4 | Daily live interest accrual | Banks compound quarterly or at maturity, not daily — a daily display lies to the user. V1 shows the calculated maturity value, not a ticking balance |
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
| 1 | Dashboard | This month's totals + recent activity + debts summary + investments summary |
| 2 | Transactions | Income, Expense, Transfer (with optional debt-link or investment-link tag) |
| 3 | Accounts | Add, edit, list, see balance |
| 4 | Categories | Pre-defined set; user can add/edit/disable |
| 5 | Savings Goals | Target amount, target date, progress bar |
| 6 | Debts | Record-only: total owed / owed to you, payments, auto-complete at 0. No interest math. |
| 7 | Investments | Interest-bearing deposits (DPS, FDR, savings certificates, term deposits). Record principal, rate, term; app shows calculated maturity value; auto-mature on date; user records payout as Income. Rollover supported. **2026-08-17:** every investment card and the dashboard net-worth tile now surface two values — **current value** (money tied up right now) and **at maturity** (projection if every installment is paid). This stops a DPS with one paid installment from inflating the headline net worth. |
| 8 | Settings | Currency (locked to BDT in V1), theme (Dark/Light/Auto), app PIN (optional), export, import, delete all data |

**Removed from V1 (compared to earlier draft):** advanced Debt (interest/amortization), Monthly Planning, Financial Health, Net Worth history, Charts, Insights, stocks/mutual funds/crypto.

---

## 7. Information Architecture

### Primary Navigation (Bottom Bar / Sidebar)

- **Home** (Dashboard)
- **Transactions** (list of all entries)
- **Add Transaction** (big button, center) — quick add Income or Expense
- **Goals**
- **Investments**
- **Debts**
- **Settings**

### Screens

- **Dashboard:** Monthly totals, account balances, recent transactions, debts summary, investments summary.
- **Transactions list:** All entries, sortable by date, filterable by chip (single-select, click-again-to-reset to All). Filter chips: **All**, **Income**, **Expense**, **Transfer**, **Payouts** (transactions tagged with `linked_investment_id`), **Debt payments** (transactions tagged with `linked_debt_id`), **This month**, **Cash**. Transaction amount colors: green for income, red for expense, neutral (ink) for transfer — visible in both light and dark themes.
- **Add transaction:** Amount → Type (Income/Expense) → Category → Account → Save.
- **Accounts list:** Each account with its current balance.
- **Account detail:** Balance + transaction history for that account.
- **Goals list:** All goals with progress.
- **Goal detail / create:** Name, target, deadline, current saved.
- **Investments list:** Each active investment with name, calculated maturity value, and "matures in X days / matured N days ago". Sorted by soonest-to-mature first.
- **Investment detail:** Full breakdown — name, institution, status badge, big maturity value, start/maturity dates, principal, rate, term, payout account, linked transactions. Actions: Edit, Roll over, Close.
- **Add investment (3-step wizard):** Step 1 — Pick type (DPS / FDR / Other). Step 2 — Fill the fields (name, principal, rate, start date, term, payout account). Step 3 — Review calculated maturity value + Save.
- **Maturity prompt:** Banner on an investment's detail screen when its maturity date is reached. Pre-fills an Income transaction on the linked account for the full payout amount.
- **Roll-over:** Creates a new investment with same terms + 1 day after maturity date; old investment status becomes "rolled into X".
- **Debts list:** Two sections — *I owe* (active) and *Owed to me* (active). Each entry shows total, paid so far, progress bar. A separate **Completed (N)** section appears below the active lists once any debt is fully paid; rows show a green check, the total paid off, the person, and the name of the most-recently-used account. The header count shows "N active · M completed". Completely paid debts are hidden from the active lists so the active list stays focused on what's still owed.
- **Debt detail / create:** Name, direction (I owe / Owed to me), total, paid so far (defaults to 0), optional due date, optional person/entity. Shows linked transactions. When the debt is fully paid, a green callout appears under the heading: *"Fully paid. Last transaction used {AccountName} — current balance: ৳X."* (the account is the most-recently-used account from the linked transactions; the balance is its live balance).
- **Settings:** Theme (Dark / Light / Auto), App PIN, Export data, Import data, Delete all data, About.

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
2. Enter amount, choose category, choose the receiving account.
3. Below the account picker, a **Linked debt (optional)** dropdown appears, filtered to debts with `direction = 'owed_to_me'`. Pick the debt Rina is being repaid for.
4. Save.

→ Income transaction created with `linked_debt_id`. Account balance rises. Debt's `paid_so_far` rises. When `paid_so_far >= total`, the debt auto-completes. Dashboard *Owed to Me* drops.

### 8.14 Edit or Delete a Debt

- **Edit a debt:** Open debt → tap **Edit** → change name, total, due date, or person. The `paid_so_far` field is locked when there are linked transactions (it follows the sum of those transactions).
- **Delete a debt:** Open debt → tap **Delete**. App warns: *"This debt has N payment records. They'll stay in your transaction list."* Tap **Delete debt** to confirm. The debt is soft-archived. Its linked transactions keep their link but display a small "Archived debt" tag.

### 8.15 Debt Auto-Completes

When the sum of linked transactions equals or exceeds the debt's total:

- The debt's status becomes `completed`.
- It is **removed** from the active *I owe* / *Owed to me* lists and surfaces in a separate **Completed (N)** section at the bottom of the Debts list. Each completed row shows a green check glyph, the total paid off, the person, and the most-recently-used account.
- A toast: *"City Bank loan paid off. Nice."*
- The dashboard *Total I owe* (or *Owed to Me*) drops to 0.

### 8.16 Create an Investment (DPS / FDR / Other)

1. Tap **Investments** in the sidebar → Investments list.
2. Tap **+ New investment**.
3. **Step 1:** Pick type — **DPS** (monthly deposit scheme) / **FDR** (fixed deposit receipt) / **Other** (savings certificates, term deposits, etc.).
4. **Step 2:** Fill the fields — **name** (e.g. "DBBL 1-year FDR"), **principal** (৳100,000), **rate** (% per year, e.g. 9.0), **start date**, **term** (months, e.g. 12), **payout account** (where the maturity money will land). Optional: institution name, notes.
5. **Step 3:** Review. App shows the calculated **maturity value** (e.g., ৳109,000 for 12 months at 9% simple interest). Tap **Save**.

→ App creates the investment AND an **Expense** transaction on the payout account for the principal (account balance drops). The investment appears on the Investments list and on the Home Investments card.

### 8.17 View an Investment and Its Maturity Countdown

1. Open the **Investments** list.
2. Each row shows: name, calculated maturity value, "Matures in X days" (or "Matured today" / "Matured N days ago" if past).
3. Tap a row → investment detail. Big maturity value at the top, full breakdown below, linked transactions listed.

→ The countdown is read directly from today's date vs. the maturity date (start date + term). No daily accrual.

### 8.18 Maturity: Record the Payout

When the maturity date arrives (or passes):

1. The investment auto-flips to status **matured**.
2. On the detail screen, the **When it matures** panel renders with **Record maturity payout**, **Roll over to a new term**, and (for FDR/savings) **Close this investment** buttons. The header copy switches to "Matured" once status = matured.
3. Tap **Record maturity payout** → app pre-fills an **Income** transaction on the payout account for the remaining amount (maturity value minus any payouts already recorded). For DPS this is the current value (compounded to today); for FDR/savings this is the simple-interest maturity value. User confirms or edits the amount (banks sometimes round or add a bonus).
4. Tap **Save**.

→ Account balance rises by the payout. For DPS, the investment auto-closes (status → `closed`). For FDR/savings, the user must tap **Close this investment** to retire the record. Dashboard *Total invested* drops by the maturity value.

### 8.19 Roll Over an Investment at Maturity

1. On the detail screen of a **matured** investment, tap **Roll over**.
2. App creates a new investment with: same name (with "(rolled over)" suffix if user wants), same principal, same rate, same term, same payout account, **start date = maturity date + 1 day**, **end date = new start + same term**.
3. Old investment's status becomes **rolled-over** with a link "Rolled into <new investment name>". New investment appears at top of list.

→ No money movement. The roll-over is a record-keeping step; the user is expected to either let the money stay at the bank or transfer it via a real Income transaction.

### 8.20 Close an Investment Without Re-Opening

1. On the detail screen, tap **Close**.
2. App asks: *"Close this investment without recording a payout?"* (Use this if you cancelled or withdrew the money already.)
3. Two buttons: **Cancel** | **Close investment**.

→ Investment status becomes **closed**. It is hidden from the Home Investments card but stays in the Investments list under a "Closed" section.

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

**Display colors for transaction amounts in lists and detail rows:**

- **Income** → green (`text-primary` theme token)
- **Expense** → red (`text-danger` theme token)
- **Transfer** → neutral (`text-ink` theme token)

These colors automatically adapt to the chosen theme (dark or light) since they reference the theme tokens. The same rule applies on the Home screen recent activity list and the Transactions list.

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
- A single account is always set: the `Account` for income/expense, or both `From` and `To` for transfer. The account dropdown shows the current balance beneath it, and when an amount is entered, a live `→ after: ৳X` preview shows what the account balance will look like after the transaction is recorded (income adds, expense subtracts, transfer subtracts from From and adds to To).
- For Transfer, the From and To accounts are picked from the same accounts list. The To dropdown excludes the currently selected From account. If the user picks a From that matches the current To (or vice versa), the other side auto-repicks so the form never holds a "from X to X" state.
- **Linked debt (optional):** For Expense, an optional dropdown shows the user's active debts. For Income, the same dropdown shows only debts with `direction = 'owed_to_me'` (since receiving income from a debt is the only direction that makes sense). Selecting a debt shows the remaining amount below the dropdown.
- **Linked investment (optional):** For Income, an optional dropdown shows the user's active investments (not yet closed). Selecting an investment shows the current value (DPS) or maturity value (FDR/savings) below the dropdown.
- **Linked debt and Linked investment are mutually exclusive**: picking one clears the other. A transaction may only be tagged as one or the other (or neither), never both.

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

- When `paid_so_far >= total`, debt auto-completes (status becomes `completed`).
- The debt is removed from the active *I owe* / *Owed to me* lists and surfaced in a separate **Completed (N)** section at the bottom of the Debts list. Each completed row shows a green check, the total paid off, the person, and the most-recently-used account.
- On the debt detail screen, a green callout appears under the heading: *"Fully paid. Last transaction used {AccountName} — current balance: ৳X."* (the account is the most-recently-used account from the linked transactions; the balance is its live balance).
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

### 9.8 Investments

An **investment** is a record of money locked into an interest-bearing deposit. The app shows the calculated maturity value; it does **not** accrue interest daily or live, and it does **not** track market-price instruments (stocks, funds, crypto).

**Type:**
- `DPS` — Monthly Deposit Scheme. User enters monthly installment + months; app derives total principal = installment × months.
- `FDR` — Fixed Deposit Receipt. User enters total principal; app does not assume installments.
- `other` — Savings certificates, term deposits, or anything else interest-bearing. Same fields as FDR.

**Fields (per investment):**

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes | Free text, e.g. "DBBL 1-year FDR" |
| `type` | enum | yes | `dps` / `fdr` / `other` |
| `principal` | number | yes | > 0, total amount locked |
| `rate` | number | yes | Annual rate, % (e.g. 9.0). Simple, non-compounding display model |
| `start_date` | date | yes | When the money was deposited |
| `term_months` | integer | yes | > 0, in months |
| `payout_account_id` | string | yes | The account the maturity money will land in |
| `institution` | string | no | Bank / company name (e.g. "DBBL") |
| `notes` | string | no | One line |
| `status` | enum | yes | `active` / `matured` / `closed` / `rolled_over` |
| `rolled_into_id` | string | no | Set when status = `rolled_over`, points to the new investment |
| `created_at` | date | yes | Auto |

**Calculations (display only, NOT live):**

```
Maturity date = start_date + term_months
Maturity value = principal × (1 + rate/100 × term_months/12)
```

- The maturity value is **recalculated** whenever the user edits principal, rate, or term. It is **not** a balance that grows daily.
- For DPS, `principal` is derived from `monthly_installment × term_months` and shown read-only after creation. User can change the installment or term to update.

**Linked transactions (one-way link, account owns them):**

- At creation, the app auto-creates an **Expense** transaction on the payout account for the principal amount. This is what makes the account balance drop.
- At maturity (status = `matured`), the user records the real payout as an **Income** transaction on the payout account for the maturity value. This is what brings the money back.
- Looking at an investment → Rina sees its linked transactions (the opening deposit expense + the closing payout income).
- Looking at a transaction → a small "Investment: <name>" tag is shown if `linked_investment_id` is set.

**Money does auto-move at creation.** The opening Expense transaction is what makes the balance reflect the locked-up money. At maturity, the user has to explicitly record the payout — the app does NOT auto-create the income transaction (banks may not have paid yet, or may pay a slightly different amount).

**Status transitions:**

| From | Event | To |
|---|---|---|
| `active` | Today >= maturity date | `matured` (auto) |
| `matured` | User records payout Income | `closed` (auto, **DPS only** — for FDR/savings the user must tap Close manually after recording the payout) |
| `matured` | User taps Roll over | `rolled_over` (old) + new `active` (new) |
| `active` or `matured` | User taps Close + confirms | `closed` (manual) |

**Maturity payout (DPS, FDR, savings):** Available for all three types once the investment has matured. The button on the detail screen is labeled **Record maturity payout** and pre-fills an Income transaction on the payout account for the remaining amount (maturity value minus any payouts already recorded). For DPS this is the current value (compounded to today); for FDR/savings this is the simple-interest maturity value. Disabled when the remaining amount is zero or no payout account is set.

**Paid out stat:** A "Paid out" figure is shown in the Money card for any investment where `paid_out > 0`, with the hint *"Linked income transactions"*. This applies to DPS, FDR, and savings alike.

**Close button:** Available for FDR/savings in any state (active or matured). For DPS, the Close button is hidden once any payout has been recorded (DPS Close is the rare "no-payout" path).

**Dashboard role:**

- An **Investments card** sits below the Debts card on Home.
- One headline number: **Total invested:** ৳150,000 (rendered in accent/gold color).
- Below: a horizontal strip of up to 2 investments closest to maturity, with name + "Matures in X days" / "Matured today" / "Matured N days ago".
- Tap the card title → full Investments list. Tap any investment → investment detail.

**V1 does NOT support:**
- Daily interest accrual (the balance does not tick).
- Compounding frequency other than simple (display only).
- Pre-closure with adjusted interest.
- Tax (TDS) tracking on interest income.
- Stocks, mutual funds, crypto, or any market-price instrument.
- Linking an investment to a specific *category* (the link is at the transaction level, not the investment level).

#### 9.8.1 Dual-value display (added 2026-08-17)

User feedback flagged that **net worth looked much bigger than the cash on hand** for users with a DPS that had only one or two installments paid. Root cause: the DPS row was showing the full mature amount (annuity-due across 12–60 months) as if it were money in hand.

**Resolution:** Every investment card and the dashboard net-worth tile surface **two numbers**, never one:

| Number | Definition | Where it appears |
|---|---|---|
| **Current value** | Real money tied up *right now*. For DPS: contributions made so far, each compounded to today. For FDR/savings: the lump-sum principal. | Home tile headline, Investments list row headline, Insights widget headline |
| **At maturity** | Projection if the user completes the term. For DPS: annuity-due across the full term. For FDR/savings: principal + simple interest to maturity. | Smaller, muted secondary line, always labelled "(projection)" or "If every installment is paid" |

Rules:

- **The headline number is always "current value".** Projected value never stands alone; it's always paired with a clearly-labelled current value next to or beneath it.
- For investments past their maturity date, current collapses to projected (the bank would pay out in full).
- For FDR/savings where principal = current + interest = projected (no installments pending), the dual line collapses to one number ("Maturity ৳X") to keep the row compact.
- The net-worth tile on Home shows both: ৳X (current, headline) and "৳Y at maturity (projection)" beneath.

**Acceptance criteria:**

- A DPS with one installment of ৳5,000 paid today, term 12mo @ 8%, must show current ≈ ৳5,000 and projected ≈ ৳62,000 on the Investments list row and detail screen. The headline MUST be the current value.
- The dashboard "Net worth" tile must show the same current-vs-projected split.
- A pure-cash user (no investments) must see identical current and projected (both equal cash + receivables − debts owed).
- A user with only FDR (no installments pending) must still see the maturity value as the row headline; the dual-value line is hidden.

### 9.9 Local Data Storage

- All data is stored on the user's device.
- The PRD does not mandate a specific storage technology; engineering may pick the appropriate local persistence layer.
- The data model is designed so cloud sync can be added later without rewriting the bookkeeping logic.

### 9.10 Data Export

**Export format:** Single `.json` file containing:

- All accounts
- All categories (including user-added ones)
- All transactions
- All savings goals
- All debts
- All investments
- App settings (PIN is **not** exported)
- A version field (e.g., `"version": 1`)

CSV export is **not required** for V1. JSON is sufficient and lossless.

### 9.11 Data Import

- User selects a `.json` file.
- App validates the file: schema, version, required fields.
- On validation failure, app shows: *"This file isn't a valid backup. It may be from a different version or corrupted."*
- On success, app asks for confirmation: *"This will replace all your current data. Continue?"*
- On confirm, app wipes current data and loads the file.

### 9.12 Data Deletion

- Single button in Settings: **Delete all data**.
- Confirmation: *"This permanently deletes all your transactions, accounts, goals, debts, and investments on this device. This cannot be undone."*
- Buttons: **Cancel** | **Delete everything**.
- The app does **not** require an export before deletion.

### 9.13 Inline Help Text (added 2026-08-17)

A first-time user should not need external documentation to understand the form fields they fill in, the metrics they see, or the jargon the app uses. Help text is the answer: short, in-place, never obstructing.

**Where help lives:**

| Location | Form | When shown |
|---|---|---|
| Form fields | Small muted line below the input (`Field.hint`) | Always, unless a validation error is showing |
| KPI tiles & cards | Tooltip on the label + sentence in the trend / caption area | Always; tooltip on hover/focus |
| Derived figures (e.g. "৳X at maturity") | Inline label "Projection:" + "(projection)" suffix on amount lines | Always when the figure is not real money in hand |
| Empty states | One short sentence + CTA | When the list is empty |
| Settings helpers | Sentence under the section heading | Always |

**Copy conventions:**

- **Tone:** second person, present tense, never condescending. One sentence, ≤ 14 words.
- **Clarity over jargon.** Prefer ordinary words. When a term must appear (DPS, FDR, payout, rollover, maturity), pair it with a one-phrase explanation the first time.
- **No marketing language.** Never begin with "Pro tip" / "Did you know?" / "Just". Never apologise.
- **All money labels say whether they are real now or projected.** Real = nothing extra. Projected = "(projection)" suffix or a leading "If you complete every installment…" sentence.
- **No abbreviations in help copy:** write "per month" not "/mo", "annual" not "/yr", "estimated" not "est.".

**Glossary (used inline, never the only explanation):**

| Term | Plain-English pairing |
|---|---|
| DPS | monthly savings plan |
| FDR | one-time fixed-term deposit |
| Payout | the bank paying the matured value back into an account |
| Maturity | the date the bank pays out the investment |
| Rollover | renewing the investment for another term, the day after it matures |
| Net worth | what you own minus what you owe |

**Form-field copy table (Tier 1 — high impact):**

| Screen | Field | Current | Replacement hint |
|---|---|---|---|
| AccountAdd / Edit | Type | — | "Cash, bank account, or mobile wallet." |
| AccountEdit | Opening balance | — | "Changing this adjusts the account's starting balance only." |
| DebtAdd | Direction | — | "Pick 'I owe' for loans you took. 'Owed to me' for money you lent." |
| DebtAdd | Total amount | — | "Total amount — principal, not total repayments expected." |
| DebtEdit | Direction | — | "Changing direction flips how linked payments are interpreted." |
| DebtEdit | Total amount | — | "Repayments are tracked via linked transactions, not here." |
| GoalAdd | Target amount | — | "Total amount you want to reach by the deadline." |
| GoalAdd | Target date | — | "Drives the 'save ৳X / month' suggestion on the goal." |
| InvestmentAdd / Edit | Rate | "Annual interest rate, e.g. 8 for 8%." | "Annual rate. Simple interest for FDR/savings (compounded monthly for DPS)." |
| InvestmentAdd | Term (months) | — | "Use the same number of months as your bank contract." |
| InvestmentAdd | Use days | "Use days instead of months…" | "Use days for terms like 30, 60, or 90 days (shorter than a month)." |
| InvestmentAdd | Maturity preview | "Review: You'll receive ৳X at maturity." | "Review: You'll receive about ৳X at maturity (projection — actual payout may differ)." |
| InvestmentAdd | Institution | — | "Bank or NBFI holding this investment." |
| InvestmentEdit | Term (months) | — | "Changing this shifts the maturity date forward." |
| AddTransactionForm | Linked investment | "Payout from an investment" | "Selecting one routes the money to that investment's payout account." |
| AddTransactionForm | Balance preview | (unlabeled) | (small caps label) "Projected balance after save" |
| TransactionEdit | Note | — | "Add or change a note. Leave blank to remove." |
| TransactionEdit | Linked debt / investment | — | "Link if this entry is a payment toward that debt / payout from that investment." |

**Read-only-screen copy table (Tier 2 — captions + tooltips):**

| Screen | Element | Current | Replacement |
|---|---|---|---|
| Home | Total balance caption | "across N accounts" | "Sum of money in all your accounts right now." |
| Home | Total investments caption | "across N investments" | "Money locked in active DPS, FDR & savings schemes." |
| Home | Empty state | "No transactions yet." | "Add income, expenses, or transfers to start tracking." |
| InvestmentsList | "How it works" callout | already strong | (no change — this is the model) |
| InvestmentDetail | Current-value hint | "Compounded to today" | "What the bank would pay you if you cashed out today." |
| InvestmentDetail | At-maturity label | "Projected at maturity" | "Estimated payout when the term ends." |
| InvestmentDetail | "Record maturity payout" button | — | "Record bank payout" |
| InvestmentDetail | "Roll over" button | — | "Renew for another term" |
| DebtsList | Row subtitle "৳X / ৳Y" | — | "Paid ৳X of ৳Y total" |
| DebtsList | Progress bar | unlabelled | "X% paid" caption |
| DebtsList | Empty state | "No debts yet." | "Add a debt to track who owes whom." |
| TransactionsList | Filtered empty state | "No transactions match this filter." | "Try a different filter or add a new transaction." |
| Settings | Backup helper | — | "Save a JSON file to your device. Use Import to restore." |
| Settings | About "Storage" value | "empty" | "Saved on this device only" |
| Settings | Danger zone copy | "Wipe all data" | "This permanently deletes everything. Export first if unsure." |

**Acceptance criteria:**

- Every screen listed in the copy tables shows its replacement copy in a build of the app.
- `Field.hint` is used; no hand-rolled `<div className="text-xs text-muted">` blocks under fields.
- Every projected amount (current-vs-mature DPS rows, net worth projection, AddTransactionForm balance preview, Investment maturity "Review" block) carries a visible "projection" suffix or label.
- Jargon (DPS / FDR / payout / rollover / maturity) either is spelled out on first appearance in the user flow or is paired with a one-line glossary hint at that spot.
- No help text begins with the words "Pro tip", "Just", "Try to", "Did you know", or "Make sure".
- All existing 113 tests pass; no test that asserts DOM text is updated unless the change is acknowledged in the test.
- Quick visual sweep (manual or automated) confirms every form screen still fits its default mobile width (≤ 360 CSS px) with the new copy — i.e. no hint wraps to more than 2 lines.

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
| R9 | Investment maturity value | `maturity_value = principal × (1 + rate/100 × term_months/12)` — simple-interest display, recalculated on edit, not a live ticking balance |
| R10 | Investment status | Auto-flips to `matured` when today >= maturity date; record-payout flips to `closed`; roll-over flips old to `rolled_over` and creates a new `active` |

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
| User creates an investment with no name | *"Give this investment a name."* |
| User creates an investment with 0 or negative principal | *"Enter a principal greater than 0."* |
| User creates an investment with a term of 0 months | *"Enter a term of at least 1 month."* |
| User rolls over an investment that isn't matured yet | *"This investment hasn't matured yet. You can roll it over once it matures."* |
| User records the payout on a closed or rolled-over investment | *"This investment is already closed. You can't record a payout."* |
| User has no accounts when starting the Add Investment wizard | *"Add an account first — investments need a payout account."* |

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
| **Investments record, never guess** | Finora shows the calculated maturity value but does not accrue interest daily. The maturity value is honest math; the payout is real money and only happens when the bank pays it. |
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
- Investment maturity value: `principal × (1 + rate/100 × term_months/12)`
- Investment maturity date: `start_date + term_months`
- Investment auto-status flip to `matured` when today >= maturity date
- Investment roll-over creates new active investment with same terms + 1 day after maturity date
- Investment close: status becomes `closed`, hidden from Home Investments card
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
- Create investment → linked Expense reduces payout account balance, Home Investments card updates
- Edit investment principal/rate/term → maturity value recalculates
- Investment crosses maturity date → status flips to `matured`, banner appears
- Record payout on matured investment → linked Income increases payout account balance, status flips to `closed`, Home total drops
- Roll-over matured investment → old becomes `rolled_over`, new active investment created with start_date = old.maturity_date + 1
- Close investment without payout → status becomes `closed`, hidden from Home
- Import → full state restored

### 14.3 End-to-End Scenarios (Minimum)

- First-run onboarding
- Record a week of mixed income and expenses
- Set up a goal and contribute to it
- Record a debt (City Bank loan) and make 2 payments toward it; verify `paid_so_far` updates
- Lend money to a friend (Sumi) and receive one partial repayment
- Create an FDR (DBBL, 1-year, 9%), see the calculated maturity value on Home, wait for the maturity date, record the payout, see Home drop
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
- Creating an investment with no accounts (block with clear error directing user to add one)
- Investment start_date in the future (allowed — some people pre-plan)
- Investment start_date equal to today (allowed)
- Investment crosses maturity date while app is closed (status flips on next open, banner shows)
- Recording a payout with an amount different from the calculated maturity value (allowed — bank may differ; show "Bank paid ৳X, expected ৳Y" for transparency)
- Closing a matured investment without recording payout (allowed, with explicit confirmation)
- Rolling over a non-matured investment (block with helpful error)
- Investment with 0% rate (allowed — DPS schemes sometimes have 0% headline rate but include bonuses)

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
| 8 | User commits the calculated maturity value as the actual payout, then complains the bank paid a different amount | The "Record payout" flow always lets the user edit the amount before saving; the banner shows "Bank paid ৳X, expected ৳Y" when they differ |

---

## 18. Future Roadmap (V2+)

| Theme | V2 Features |
|---|---|
| Insights | Spending by category breakdown, monthly comparison |
| Planning | Budget recommendations, savings rate |
| Investments | Stocks, mutual funds, crypto, portfolio tracking with market prices |
| Financial products | Compounding-frequency support, pre-closure interest, tax (TDS) tracking on interest income |
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
| Investment | A record of interest-bearing money locked away: DPS, FDR, savings certificate, term deposit |
| Maturity | The date on which an investment's principal + interest is paid out by the bank |
| Payout | The income transaction recorded when the bank pays out a matured investment |
| Rollover | Re-starting an investment with the same terms the day after it matures, to keep the money earning |
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
- [ ] User can create an investment (DPS / FDR / Other) with name, principal, rate, start date, term, and payout account.
- [ ] App shows the calculated maturity value on the Investments list and detail screen.
- [ ] Account balance drops by the principal when an investment is created (linked Expense).
- [ ] When the maturity date arrives, the investment auto-flips to "matured" with a banner prompting to record the payout.
- [ ] User can record the payout as an Income on the payout account; investment status flips to "closed".
- [ ] User can roll over a matured investment, creating a new active investment with same terms + 1 day.
- [ ] User can close an investment without recording payout (with confirmation).
- [ ] Dashboard shows Total invested, plus a strip of upcoming maturities.
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
