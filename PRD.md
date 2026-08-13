# Personal Finance Assistant — Product Requirements Document (PRD)

| Field | Value |
|---|---|
| **Product** | Personal Finance Assistant |
| **Version** | 1.0 (MVP) |
| **Status** | Approved for Build |
| **Document Owner** | John (Product Manager) |
| **Market** | Bangladesh |
| **Primary Language** | English |
| **Currency** | BDT (৳) |
| **Storage Model** | Local-first (device/browser) |
| **Authentication** | None in V1 (optional local PIN lock) |
| **Last Updated** | 2026-08-12 |
| **Source** | `business.md` |

---

## 1. Executive Summary

The **Personal Finance Assistant** is a Bangladesh-first, English-language personal finance web application that helps individuals understand, track, and plan their finances.

The MVP combines:

- Income and expense tracking
- Multiple financial accounts
- Savings tracking
- Savings goals
- DPS and FDR planning/calculation
- Generic investment tracking
- Debt tracking
- Money-lent tracking
- Monthly financial planning
- Financial Health scoring
- Net Worth tracking
- Charts and financial insights
- Local-first storage
- Data export/import backup

The product is **not** a bank, brokerage, accounting-compliance system, or automated financial advisor. It provides transparent calculations and planning suggestions while keeping financial decisions under user control.

### Why Now

Bangladesh users lack a single, transparent tool that combines **DPS/FDR calculation**, **goal-driven monthly planning**, and **Net Worth + Financial Health** without requiring a bank account, cloud sync, or formal accounting knowledge. Existing tools either ignore Bangladesh-specific products or are tracking-only with no planning loop.

### One-sentence description

A local-first personal finance assistant for Bangladesh that helps users track money, calculate savings/investment products, understand financial health, and create realistic monthly plans to achieve financial goals.

---

## 2. Product Vision

> **Track your money. Understand your financial position. Plan what comes next.**

The product should help a user answer five questions quickly:

1. Where is my money?
2. Where did my money go?
3. How financially healthy am I?
4. What should I prioritize next?
5. Am I on track for my financial goals?

### Core Principles

1. **Actual financial records are the source of truth.**
2. **Plans and recommendations never silently change actual balances.**
3. **Users control priorities and allocations.**
4. **Calculations are transparent and testable.**
5. **The app is helpful rather than judgmental.**
6. **Financial data belongs to the user.**
7. **V1 remains simple enough for everyday manual use.**

### The Core Loop

```
Record → Understand → Plan → Act → Review → Improve
```

---

## 3. Goals & Success Metrics

### 3.1 Primary Goals (Must-Have)

| # | Goal | Success Metric |
|---|---|---|
| G1 | Users can record income manually | 95%+ of test users record income within first session |
| G2 | Users can record expenses manually | Quick-add expense completes in ≤3 taps |
| G3 | Users can transfer money between owned accounts | Source/dest balances update atomically; totals unchanged |
| G4 | Users can track actual savings | Surplus ≠ Savings distinction enforced in code |
| G5 | Users can manage multiple accounts | Add/list/edit/archive accounts supported |
| G6 | Users can track investments with manual current value | Gain/Loss = Current − Invested shown |
| G7 | Users can calculate/project DPS returns | Projection matches approved formula in unit tests |
| G8 | Users can calculate/project FDR returns | Projection matches approved formula in unit tests |
| G9 | Users can track debts and repayments | Outstanding balance recalculates on payment |
| G10 | Users can track money lent to others | Receivable ledger separate from expense |
| G11 | Users can create savings goals with deadlines | Required monthly savings auto-calculated |
| G12 | Users can create monthly financial allocation plans | Validation blocks over-allocation |
| G13 | Users receive personalized, explainable recommendations | Each recommendation shows its inputs |
| G14 | Users can view Net Worth | Net Worth = Assets − Liabilities, with history |
| G15 | Users can view Financial Health | 0–100 score, live, with positive/concerns |
| G16 | Users can view useful financial charts | 6 chart types renderable across 6+ time ranges |
| G17 | Users receive automatic in-app insights | In-app only, no notifications |
| G18 | Users can export all financial data | JSON full export + CSV transaction export |
| G19 | Users can import previously exported data | Versioned, validated, error-reported |
| G20 | Core financial data stays local to device/browser | No backend call carries financial record data |

### 3.2 Secondary Goals

- Make transaction entry very fast (quick-add path).
- Make financial terminology understandable (in-app glossary).
- Support long-term historical analysis.
- Keep the domain model suitable for future cloud synchronization.
- Make all important financial rules deterministic and testable.

---

## 4. Non-Goals (Out of Scope for V1)

| # | Non-Goal | Rationale |
|---|---|---|
| N1 | Bank account integration / Open Banking | Adds regulatory, security, and partner dependencies |
| N2 | Automatic transaction import | V1 is manual-first by design |
| N3 | Cloud synchronization / User accounts | V1 is local-first |
| N4 | Dedicated credit-card management | Credit-card debt still representable as a liability |
| N5 | Live stock/market prices | Investments use manual current value |
| N6 | Automated Bangladesh tax calculations | Out of MVP scope; deferred to V2 |
| N7 | FDR maturity / DPS payment notifications | No notification system in V1 |
| N8 | Push / email / SMS / reminder notifications | In-app only |
| N9 | Dedicated monthly Reports module | No detailed Plan-vs-Actual reporting in V1 |
| N10 | Complex accounting / audit functionality | Tool is not a bookkeeper |
| N11 | Investment trading / Brokerage / Product purchasing | Read-only investment tracking |
| N12 | Automatic financial transactions | The app never moves money |
| N13 | Guaranteed or authoritative investment advice | Recommendations are suggestions, not advice |

---

## 5. Target User

### Primary Persona

A **Bangladesh-based individual** who wants to understand and improve their personal finances.

**Typical financial circumstances may include:**

- Salary or freelance income
- Cash
- Multiple bank accounts
- Mobile wallets
- Savings accounts
- DPS (Deposit Pension Scheme)
- FDR (Fixed Deposit Receipt)
- Investments (stocks, mutual funds, gold, crypto, business)
- Loans
- Informal borrowing/lending
- Multiple financial goals

**Key assumption:** The product must **not assume formal accounting knowledge**. Terminology is plain-English; advanced fields are progressively disclosed.

### Anti-Persona (What the V1 User Is Not)

- An enterprise finance team
- A licensed financial advisor
- A user needing automated tax filing
- A user needing live brokerage trading

---

## 6. Product Scope — Module Inventory

| # | Module | V1 Scope |
|---|---|---|
| 1 | Dashboard | Single-glance financial overview |
| 2 | Transactions | Income / Expense / Transfer / Saving / Borrow / Repay / Lend / Loan-repayment-received |
| 3 | Accounts | Multi-type accounts with opening/current balance |
| 4 | Savings Goals | Target + deadline + required monthly saving |
| 5 | Investments | Manual current value, gain/loss |
| 6 | DPS | Projection calculator + actual value |
| 7 | FDR | Projection calculator + actual value |
| 8 | Debts | Liabilities with payments counted as expenses |
| 9 | Money Lent | Receivable ledger (non-expense) |
| 10 | Monthly Planning | Recommended → user-edited → validated → active |
| 11 | Financial Health | 0–100 score with explainable factors |
| 12 | Net Worth | Assets − Liabilities, with history |
| 13 | Charts & Insights | 6+ chart types; in-app insights |
| 14 | Settings | Categories, priorities, app lock, export, import, delete |
| 15 | Data Export/Import | JSON full backup + CSV transactions + version field |

---

## 7. Information Architecture

### Primary Navigation

- Dashboard
- Transactions
- Accounts
- Goals
- Investments
- Plans
- Financial Health
- Settings

> DPS/FDR, debt, and money-lent functionality may be surfaced from the relevant modules while retaining dedicated detail screens.

---

## 8. User Journeys

### 8.1 First Use (Onboarding)

1. Open application.
2. Enter monthly income.
3. Enter current available balance.
4. App creates initial financial context.
5. User reaches dashboard.
6. User adds accounts, records income/expenses, creates savings goals, adds existing investments/DPS/FDR/debts, configures priorities.
7. App begins generating relevant insights and planning recommendations.

**Onboarding principle:** Minimal and progressive. Only two fields required to enter the dashboard.

### 8.2 Record Expense

1. Open Transactions → Add Expense.
2. Enter amount, select category, save.
3. Account balance, monthly expenses, surplus, available-to-plan, Financial Health, and insights all recalculate.

**Quick-entry path:** Amount + Category + Save (3 fields).

### 8.3 Create Savings Goal

1. Open Goals → Create Goal.
2. Enter name, target amount, target date (optional: starting amount, destination account, notes).
3. App calculates remaining amount and required monthly savings.
4. Goal appears on dashboard.

### 8.4 Create Monthly Plan

1. Open Plans.
2. App calculates Available-to-Plan and evaluates priorities.
3. App generates a recommendation.
4. User reviews and edits allocations.
5. App validates (Total ≤ Available).
6. On invalid: save blocked; show "Allocation exceeds available amount by ৳X."
7. On valid: user accepts → plan becomes active → reservations reflected in UI.
8. Actual transactions remain the source of truth.

### 8.5 DPS

1. Select DPS → Create DPS.
2. Enter monthly contribution, rate, duration, start date.
3. App shows projected maturity value.
4. Actual payments recorded as separate transactions.
5. User may update actual/current value later.

### 8.6 FDR

1. Select FDR → Create FDR.
2. Enter principal, interest rate, duration/maturity date.
3. App shows projected maturity value.
4. User may update actual/current value later.
5. No maturity notification in V1.

### 8.7 Debt

1. Create debt with original amount, outstanding amount, interest rate, monthly payment.
2. Debt becomes a liability.
3. Record payments manually → counts as expense → outstanding balance updates.
4. Financial Health and Net Worth recalculate.

---

## 9. Functional Requirements

### 9.1 Dashboard

**Sections (in order):**

| Section | Content |
|---|---|
| Financial Health | Score 0–100, status, positives, concerns, link to detail |
| Current Month | Income, Expenses, Surplus, Actual Savings, Available Balance |
| Financial Position | Available Money, Total Savings, Investments, Total Debt, Net Worth |
| Current Monthly Plan | Plan status, Available-to-Plan, Allocations, Underfunded state, view/edit |
| Goals | Active goals, progress, required monthly saving, deadline |
| Spending | By category, Income vs Expense trend, Monthly spending trend |
| Insights | Relevant automatic insights |

### 9.2 Transaction System

**Supported transaction types (V1):**

1. Income
2. Expense
3. Transfer
4. Savings / investment contribution
5. Borrowed money
6. Debt repayment
7. Money lent
8. Loan repayment received

**Critical rule:** Transfers and balance-sheet movements must not be incorrectly counted as income or expenses.

#### 9.2.1 Income

- **Default categories:** Salary, Freelance, Business, Gift, Loan repayment, Other
- **Required fields:** Amount, Category, Date, Account
- **Optional:** Note
- **Rules:**
  - Income increases the destination account balance.
  - Income contributes to monthly income.
  - Transfers between owned accounts are not income.
  - Borrowed money is not income.
  - Loan repayment received is tracked separately.

#### 9.2.2 Expense

- **Default categories:** Food, Transport, Housing, Bills & Utilities, Shopping, Entertainment, Health, Education, Family, Other
- **Quick entry:** Amount + Category + Save
- **Detailed entry (optional):** Account, Date, Note, Recurring flag
- **Rules:**
  - Expense reduces account balance.
  - Expense contributes to monthly expenses and surplus.
  - Expense may affect insights and recommendations.

#### 9.2.3 Transfer

> Example: City Bank → Savings Account: ৳10,000

- Source balance decreases; destination balance increases.
- Total assets do not change.
- Not income. Not expense. Does not inflate surplus.

#### 9.2.4 Savings

> Example: Income ৳60,000 − Expenses ৳40,000 = Surplus ৳20,000; Actual savings transfer ৳10,000.

Result: Surplus = ৳20,000 | Actual Savings = ৳10,000 | Unallocated = ৳10,000.

Savings are based on **actual financial movements**, not automatic surplus treatment.

### 9.3 Accounts

**Default types:** Cash, Bank Account, Savings Account, Mobile Wallet, Credit Card Debt, DPS, FDR, Investment, Other.

**Account fields:**

- ID
- Name
- Type
- Opening balance
- Current balance (derived from opening + transactions)
- Currency
- Include in Net Worth (boolean)
- Created date
- Notes
- Active / inactive status

### 9.4 Credit Cards (Limited)

- Dedicated credit-card management: **out of scope**.
- Credit-card debt still representable as a liability.
- V1 does not need: credit limits, available credit, statement cycles, card-specific reconciliation.

### 9.5 Investments

**Supported types:** Stocks, Mutual funds, Bonds, Gold, Crypto, Business investments, Other.

**Fields:** Name, Investment type, Invested amount, Current value, Start date, Notes.

**Gain/Loss:** `Gain/Loss = Current Value − Invested Amount` (user manually updates current value).

### 9.6 DPS

**Inputs:** Name, Monthly contribution, Interest/profit rate, Duration, Start date, Payment frequency, Optional actual/current value.

**Outputs:**
- Projected maturity value (calculated via `calculateDPSProjection`).
- Actual / current value (separate, manually updated).

**Rules:**
- User-entered rate is authoritative for projection.
- DPS schedules are projections only.
- Actual payments recorded as real transactions; missed or changed contributions do not silently rewrite history.

### 9.7 FDR

**Inputs:** Name, Principal, Interest rate, Duration, Start date, Maturity date, Optional actual/current value.

**Outputs:**
- Projected maturity value (calculated via `calculateFDRProjection`).
- Actual / current value (separate, manually updated).

**Scope restrictions (V1):** Does **not** calculate Bangladesh taxes, withholding, bank-specific fees, or charges. UI must clearly state projected values are estimates and actual returns may differ.

### 9.8 Financial Product Calculation Architecture

| Function | Purpose |
|---|---|
| `calculateDPSProjection(inputs)` | DPS maturity projection |
| `calculateFDRProjection(inputs)` | FDR maturity projection |

Both must be product-specific, documented in the technical spec, and covered by unit tests.

### 9.9 Debt Management

**Supported liabilities:** Bank loans, Personal loans, Credit-card debt, Money borrowed from friends/family, Other debts.

**Fields:** Name, Type, Original amount, Outstanding balance, Interest rate, Monthly payment, Due date, Start date, Notes.

**V1 debt-payment rule:** The full monthly debt payment counts as an expense. V1 does not split principal and interest.

### 9.10 Borrowed Money

> Borrowed money is **not income**.

When borrowed money is received:
- Available balance increases.
- Liability increases.
- Income remains unchanged.

**Example:** Borrow ৳50,000 → Cash +৳50,000, Debt +৳50,000, Income unchanged.

### 9.11 Money Lent

**Lending (Example: Lend ৳20,000 to Friend):**
- Available account balance decreases by ৳20,000.
- Receivable increases by ৳20,000.
- Expense does **not** increase.

**Repayment (when returned):**
- Available balance increases.
- Receivable decreases.
- Repayment is **not** treated as new income.

### 9.12 Savings Goals

**Required fields:** Goal name, Target amount, Target date.

**Optional fields:** Starting amount, Account/destination, Notes.

**Calculations:**

```
Remaining Amount = Target Amount − Current Amount
Required Monthly Saving = Remaining Amount / Remaining Months
```

Basic goal calculation does not assume investment returns.

**States:** Active, Achieved Early, Completed, Expired / pending user decision.

**Completion logic:**
- Reached before deadline → **Achieved Early**.
- Reached at/around deadline → **Completed**.

**Missed deadline (deadline passed before target reached):** App must ask the user what to do — extend target date, mark completed manually, or close/cancel. The app **must not** automatically extend the deadline.

### 9.13 Monthly Financial Planning

**Available-to-Plan formula:**

```
Available to Plan =
  Opening Available Balance
  + Actual Income
  − Actual Expenses
```

Existing investments and debt affect recommendations but are **not** automatically treated as current planning cash.

**Plan lifecycle:** Recommended → User Reviews → User Edits → Validation → Accepted → Active → Month Closed.

**Recommendation behavior at month start:**
- Generate recommendation.
- Do not commit it.
- Show to user.
- Allow accept, edit, or dismiss.
- If ignored, it remains available until accepted or dismissed.

**Recommendations are never automatically committed.**

### 9.14 Planning Priorities

Users can rank financial priorities (e.g., Savings goal, Debt repayment, Investment, Available cash).

**Suggested priority options:**
- Reach a savings goal
- Reduce debt
- Build savings
- Invest
- Maintain available cash

Priorities can be changed at any time.

**Recommendations consider:** user priorities, income, expenses, available balance, savings, investments, debt, goals, Financial Health, and spending behavior.

### 9.15 Recommendation Engine

**Philosophy:** Recommendations are suggestions, not commands.

**Example:** Available ৳20,000 → Recommended: Goal ৳8,000, Debt ৳5,000, DPS ৳4,000, Cash ৳3,000.

**User modification:** User may change any allocation; app recalculates immediately.

**Validation rule:** A plan **cannot be saved** if Total Allocation > Available to Plan.

> Example error: Cannot save plan. Allocation exceeds available amount by ৳10,000.

The app **must never silently reduce user allocations**.

### 9.16 Plan Reservations

Accepted plans reserve planned amounts for planning purposes.

> Example: Actual available ৳20,000 − Reserved by plan ৳17,000 = Unallocated ৳3,000.

Reservation is a **planning concept** and does not physically move money.

**Unexpected spending:**

> Planned ৳17,000; Actual available ৳15,000 → Plan is underfunded by ৳2,000.

The app does **not** automatically rewrite the plan.

### 9.17 Monthly Plan Completion

- Monthly plan closes at month-end.
- Historical transactions can still be edited.
- V1 does not require detailed Plan-vs-Actual reporting.
- Unused plan allocations do **not** become debt.
- Unfinished objectives may influence future recommendations.

> Example: Planned goal contribution ৳10,000; Actual ৳7,000. September recognizes the remaining ৳3,000 requirement without treating it as an unpaid August bill.

### 9.18 Financial Health

- **Score range:** 0–100.
- **Factors:** Income vs Expenses, Savings, Debt, Investments, Goal progress, Available balance, Spending behavior.
- **Updates:** Dashboard shows live score; recalculates on relevant data change.
- **History:** Monthly score retained for historical analysis (e.g., Jul 71, Aug 75, Sep 78).
- **Explainability:** Each score surfaces positives and concerns.

> Example: 78/100 — Positives: Expenses below income, Savings increased, Debt decreased. Needs attention: Spending increased this month.

Exact scoring weights must be documented and unit-tested.

### 9.19 Net Worth

**Formula:** `Net Worth = Total Assets − Total Liabilities`

**Assets:** Cash, Bank accounts, Savings accounts, DPS, FDR, Investments, Money lent to others.
**Liabilities:** Bank loans, Personal loans, Credit-card debt, Money borrowed from friends/family, Other debts.

Support Net Worth trends over time using available historical data.

### 9.20 Insights Engine

Insights are **in-app only** in V1 (no notifications).

**Categories:** Spending trend, Savings trend, Income trend, Debt trend, Investment trend, Goal progress, Net Worth, Planning, Financial Health.

**Tone rules:** Neutral, helpful, data-based, non-judgmental. Avoid judgmental language.

**Examples:**
- "Your spending this month is 18% higher than your three-month average."
- "Your savings rate increased from 12% to 18%."
- "Transportation expenses increased for three consecutive months."
- "Your debt balance decreased this month."
- "Your Shopping spending increased by ৳4,000, which may reduce your planned contribution toward your laptop goal."

### 9.21 Charts

**Required chart types:**
- Income vs Expenses
- Monthly Spending Trend
- Spending by Category
- Net Worth Trend
- Goal Progress
- Savings vs Investment (where useful)

**Supported ranges:** This month, Last month, 3 months, 6 months, 1 year, All time, Custom date range.

### 9.22 Transaction History

- **Search:** Text search (notes, descriptions).
- **Filters:** Date range, Category, Account, Transaction type, Amount range.
- **Editing:** Allowed. All dependent calculations must recalculate.
- **Deletion:** Permanent after confirmation. Recalculates account balances, monthly cash flow, savings, goals, plans, Financial Health, and Net Worth.

### 9.23 Onboarding

- **Initial setup (minimum):** Monthly income, Current available balance.
- **Progressive setup:** Accounts, income/expenses, savings, investments, DPS, FDR, debts, goals, priorities.

### 9.24 Authentication & App Lock

- **V1 has no** email/password, Google login, or social login.
- Financial data remains local to the device/browser.
- **Optional local PIN / app lock** may be provided (enable/disable).
- Because there is no account/recovery system, forgotten-PIN recovery must be **explicitly designed** before implementation.
- The app **must not** claim server-grade security or encryption unless technically implemented.

### 9.25 Local Data Storage

- All financial data stored locally.
- The PRD intentionally does not mandate a specific storage technology; engineering may select the appropriate local persistence layer.
- The data/domain model should be designed so future cloud sync can be introduced **without rewriting core financial logic**.

### 9.26 Data Export

Users must be able to export complete application data.

**Export must include:** Profile/settings, Accounts, Transactions, Goals, Investments, DPS, FDR, Debts, Money lent, Monthly plans, Financial Health history, Relevant configuration.

**Format recommendations:**
- Structured backup (JSON recommended).
- CSV export for transaction analysis.

### 9.27 Data Import

Users must be able to restore exported backups.

**Requirements:** File validation, Schema/version validation, Required-field validation, Invalid-data handling, Clear errors, Protection against silent corruption.

Backup files must contain a version field. Example: `backupVersion: 1`.

### 9.28 Data Deletion

- Users can permanently delete all local financial data.
- Confirmation must clearly state the action is irreversible.
- The app must not require an export before deletion.

> Example: "Delete all financial data? This permanently deletes transactions, accounts, goals, investments, debts, and plans stored on this device. This action cannot be undone."

Actions: Cancel | Delete Everything.

---

## 10. Core Financial Rules (Authoritative)

| # | Rule | Formula / Statement |
|---|---|---|
| R1 | Surplus | `Surplus = Income − Expenses` |
| R2 | Available to Plan | `Available to Plan = Opening Available Balance + Actual Income − Actual Expenses` |
| R3 | Savings | Surplus ≠ Actual Savings. Actual savings require a recorded financial movement. |
| R4 | Transfer | Transfers between owned accounts do not affect income or expenses. |
| R5 | Borrowing | Borrowed money: increases cash, increases liabilities, does not increase income. |
| R6 | Lending | Money lent: decreases cash, increases receivable, does not increase expenses. |
| R7 | Net Worth | `Net Worth = Assets − Liabilities` |
| R8 | Goal Requirement | `Remaining = Target − Current`; `Required Monthly Saving = Remaining / Remaining Months` |
| R9 | Plan Validity | `Total Plan Allocation ≤ Available to Plan`; otherwise plan cannot be saved |
| R10 | Debt Payment | The full debt payment counts as an expense in V1. |
| R11 | Actual Transaction Authority | Actual transactions are the source of truth. Projections and plans must not silently change actual financial records. |

---

## 11. Error Handling Requirements

Provide clear errors for:

- Invalid amounts
- Missing required fields
- Invalid dates
- Invalid goal values
- Invalid plan allocations
- Invalid DPS/FDR parameters
- Corrupted imports
- Duplicate/import conflicts
- Invalid backup versions
- Invalid account operations
- Deletion confirmation

**Every error must explain:** What is wrong, why it matters, and how to fix it.

---

## 12. UX Principles

| Principle | Application |
|---|---|
| Fast | Common actions require minimal input (quick-add expense). |
| Clear | Simple financial language. |
| Transparent | Show important calculation inputs and results. |
| Reversible | Allow users to edit/delete records where appropriate. |
| Non-Judgmental | Never shame users for spending or missing goals. |
| User-Controlled | Recommendations can be modified. |
| Data-First | Actual financial records are more authoritative than projections. |
| Progressive Disclosure | Advanced fields should not clutter quick-entry workflows. |

---

## 13. Non-Functional Requirements

### 13.1 Performance

- Quick-add expense must complete in ≤3 taps.
- Dashboard must render the live Financial Health score without perceptible lag after data changes.
- Calculations must be cheap enough to recalculate on every relevant edit/delete.

### 13.2 Privacy & Security

- Do not expose financial data unnecessarily.
- Do not store secrets in plain text.
- Do not log financial records in production.
- Do not include financial data in analytics by default.
- Export files contain sensitive financial information — treat accordingly.
- Treat import files as untrusted input.
- Delete-all-data must remove application data from supported storage.

### 13.3 Accessibility

- All monetary values must be readable by screen readers.
- Color must not be the sole signal for status (e.g., underfunded, achieved).
- Keyboard navigation must be supported for all primary flows.

### 13.4 Internationalization

- Primary language: English.
- Future localization (V2): Bangla, additional currencies, country-specific financial products.

### 13.5 Reliability

- Calculations must be deterministic and testable.
- Edits and deletions to historical transactions must consistently recalculate dependents.
- Import must not silently corrupt existing data.

---

## 14. Testing Strategy

### 14.1 Unit Tests (Required)

Income calculations, expense calculations, surplus, available-to-plan, account balance, transfers, savings, goal calculations, goal completion, DPS calculation, FDR calculation, investment gain/loss, debt balance, Net Worth, plan validation, Financial Health scoring, date calculations.

### 14.2 Integration Tests

Income → dashboard update, expense → surplus update, transfer → two account balances update, savings transfer → savings/account updates, debt payment → expense + debt update, investment update → Net Worth update, goal contribution → goal progress, transaction edit → recalculation, transaction deletion → recalculation, import → complete state restoration.

### 14.3 End-to-End Scenarios (Minimum)

New user setup, monthly income/expense tracking, multiple account transfers, savings goal achievement, DPS projection, FDR projection, debt tracking, monthly plan creation, plan becomes underfunded after unexpected expense, Net Worth calculation, Financial Health update, export/import backup, delete all local data.

---

## 15. Edge Cases (Must Handle)

Zero income, zero expenses, negative monthly surplus, no savings, no accounts, multiple accounts, empty transaction history, goal reached exactly on deadline, goal reached before deadline, goal deadline passed, goal target changed, transfers, same-account transfer attempts, investment loss, investment break-even, debt reaches zero, payment greater than outstanding debt, lending and repayment, borrowing, month boundaries, leap years, old backup schema, corrupted backup, duplicate imported data, large transaction history, deleted historical transactions, edited historical transactions, plan allocation exceeding available amount, plan becoming underfunded, no active plan, no priorities, missing investment current value, invalid interest rate, invalid DPS/FDR duration.

---

## 16. Open Technical Decisions

These belong in the technical specification phase and **should not change product requirements** without a deliberate product decision:

- Exact local storage implementation
- Exact data schema
- Backup file schema / versioning
- DPS mathematical formula
- FDR mathematical formula
- Financial Health scoring weights
- Recommendation algorithm
- Date / month boundary behavior
- App PIN security implementation
- Charting library
- Frontend framework and architecture
- State management approach
- Automated migration strategy for future backup versions

---

## 17. Risks & Mitigations

| # | Risk | Mitigation |
|---|---|---|
| 1 | Incorrect financial calculations | Centralized calculation services, unit tests, known-value test cases, formula documentation, regression tests |
| 2 | Data loss | Export/import, backup versioning, import validation, clear local-storage behavior |
| 3 | Projected vs Actual confusion | UI clearly distinguishes Actual / Projected / Planned / Reserved |
| 4 | Recommendation overreach | User-controlled priorities, editable recommendations, no automatic transactions, no silent allocation changes, explainable recommendations |
| 5 | Overly complex UX | Quick transaction entry, progressive disclosure, fixed dashboard, simple categories, minimal onboarding |

---

## 18. Future Roadmap (V2+)

| Theme | V2 Features |
|---|---|
| Accounts & Sync | User accounts, Cloud backup, Cross-device sync, Encrypted cloud storage |
| Notifications | Goal reminders, Monthly plan reminders, DPS reminders, FDR maturity reminders |
| Advanced Investments | Market data, Portfolio tracking, Performance metrics |
| Banking | Bank integrations, Automatic transaction import, Account sync |
| Advanced Debt | Principal/interest split, Amortization schedules, Debt payoff strategies |
| Advanced Goals | Interest-aware goal planning, Investment-backed goals, Goal prioritization |
| Reports | Monthly reports, PDF export, Tax-oriented reports |
| Localization | Bangla, Additional currencies, Country-specific financial products |
| Advanced Planning | Scenario planning, Retirement planning, Emergency fund recommendations, Long-term wealth projections |

---

## 19. Terminology

| Term | Meaning |
|---|---|
| Income | External money received that does not create a liability |
| Expense | Money spent |
| Transfer | Money moved between owned accounts |
| Surplus | Income minus expenses |
| Actual Savings | Money actually transferred/set aside |
| Available Balance | Current spendable account money |
| Available to Plan | Money available for current monthly allocation |
| Planned | User-approved future allocation |
| Reserved | Amount committed within an active plan |
| Projected | System-calculated future estimate |
| Actual | User-recorded real value |
| Asset | Financial value owned by the user |
| Liability | Money the user owes |
| Net Worth | Assets minus liabilities |
| Goal | A target amount with a deadline |
| Financial Health | Overall financial condition score |
| Insight | Data-based observation about finances |

---

## 20. Definition of Done — MVP

The MVP is complete when **all** of the following are true:

- [ ] All core modules (Section 6) are implemented.
- [ ] Financial calculations pass defined unit tests.
- [ ] Core user journeys pass end-to-end tests.
- [ ] Local persistence works reliably.
- [ ] Export/import restores a complete dataset.
- [ ] Delete-all-data removes all local application data.
- [ ] No financial data requires a backend account.
- [ ] Dashboard correctly reflects current financial state.
- [ ] Goals calculate progress correctly.
- [ ] DPS/FDR projections pass approved test cases.
- [ ] Monthly planning validates allocations correctly.
- [ ] Underfunded plans are detected without silently changing allocations.
- [ ] Net Worth updates correctly.
- [ ] Financial Health updates correctly.
- [ ] Insights are based on stored data.
- [ ] Users can edit/delete historical transactions.
- [ ] UI distinguishes Actual, Projected, Planned, and Reserved amounts.
- [ ] No V1 notification system is present.

---

## 21. Suggested Screen List

| Module | Screens |
|---|---|
| Dashboard | Financial Health, Monthly cash flow, Financial position, Net Worth, Current plan, Goals, Charts, Insights |
| Transactions | List, Add, Edit, Search, Filters |
| Accounts | List, Details, Add, Edit, Balance |
| Goals | List, Create, Details, Progress, Required monthly savings |
| Investments | List, Add, Details, Current value update |
| DPS/FDR | Product list, Create DPS, Create FDR, Projection calculator, Actual value update |
| Debts | List, Add, Details, Repayment tracking |
| Plans | Current month recommendation, Allocation editor, Validation, Accept plan, Underfunded status |
| Financial Health | Current score, Score factors, Historical trend, Supporting metrics |
| Settings | Categories, Priorities, App lock, Export, Import, Delete all data |

---

## 22. Product Summary

### Strongest Differentiators

- Financial planning, not just expense tracking
- Goal-driven monthly allocation
- DPS/FDR calculation
- Debt-aware recommendations
- Net Worth + Financial Health
- Explainable financial insights
- Local-first privacy
- User-controlled recommendations
- Actual vs planned financial state
- Bangladesh-focused financial product support

### What This App Is Not

- Not a bank, broker, accountant, or licensed financial advisor
- Does not execute financial transactions
- Does not move money

### What This App Is

A trustworthy, transparent personal financial picture that helps the user make better-informed decisions.

---

*— End of PRD —*
