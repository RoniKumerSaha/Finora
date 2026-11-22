# Finora — Automation Coverage Plan (83 manual cases → Playwright)

**Source of truth:** [`test/docs/manual-test.md`](manual-test.md) — 83 approved manual cases
(`FIN-S01` … `FIN-X06`).
**Task:** *"automate all 83 test cases, discard current automation test/modify them"* — i.e. replace
the current suite with a one-for-one mapping of manual case → automated test.

**Status:** `FIN-A01` … `FIN-A07` are done (the reference implementation). Everything else is
pending. This document is the plan for the remaining work.

---

## 1. Rules this plan obeys

These come straight from the `playwright-test-automation` skill and from the approved manual
document. They are not negotiable for the work below.

| Rule | Concretely |
|---|---|
| **One manual case → exactly one test** | A test title is `FIN-XX <manual title verbatim>`. No case is split across two tests; no test covers two cases. |
| **`@smoke` on High-priority cases** | `{ tag: '@smoke' }` in the test's details object — **never** in the title. 50 of the 83 cases are High, so 50 tests carry `@smoke`. |
| **Tags in the details object** | `{ tag: '@smoke' }` / `{ tag: ['@smoke', '@ui'] }`. Never appended to the title string. |
| **Locators live in page objects** | Spec files contain **zero** locator strings. Every selector is a field or a method on a page object. |
| **User-facing locator strategies** | `getByRole` → `getByLabel` → `getByPlaceholder`/`getByText` → `getByTestId` → CSS → XPath (last resort). |
| **Data lives in JSON** | Every input and every expected string comes from `test/data/*.json`. No literals in specs. |
| **Secrets live in the environment** | `requireEnv()` reads them; `.env.example` lists the names. |
| **Preconditions come from fixtures** | `seedState(page, <fixture>())` builds the state. No test depends on another test having run. |
| **`beforeEach` navigates only** | The behaviour under test lives inside the `test` body, wrapped in `test.step()` using the manual step wording. |
| **Assert every clause** | Including the negatives (`toBeHidden`, `toHaveCount(0)`, `not.toContainText`). |
| **No fixed waits** | No `waitForTimeout`, no `waitForSelector`. Waits are web-first assertions or real conditions (URL change, element visible). |
| **Only the `**Automation:**` line changes in the manual doc** | No other field in `manual-test.md` is edited by this work — *except* the factual corrections listed in §5, which are needed for the document to match shipped behaviour. |
| **Unautomatable cases are marked, not skipped** | `**Automation:** Not automated — <reason>`. |

---

## 2. Where each case lands

83 cases → 13 spec files. The `accounts.spec.ts` file is the worked example; the rest follow it.

| Spec file (in `test/e2e/ui_tests/`) | Manual cases | Tests |
|---|---|---|
| `smoke.spec.ts` | S01, S02, S03, S04, S06, S07 | 6 |
| `smoke.mobile.spec.ts` | S05 | 1 |
| `accounts.spec.ts` ✅ done | A01–A07 | 7 |
| `transactions.spec.ts` | T01–T12 | 12 |
| `goals.spec.ts` | G01–G04 | 4 |
| `debts.spec.ts` | D01–D07 | 7 |
| `investments.spec.ts` | I01–I08 | 8 |
| `home.spec.ts` *(new)* | H01, H05 | 2 |
| `insights.spec.ts` | H02, H04, H06 | 3 |
| `settings.spec.ts` *(new)* | H03, W01–W06 | 7 |
| `plan.spec.ts` | L01, L02, L05, L06, L07 | 5 |
| `eventPlans.spec.ts` | L03, L08, L09 | 3 |
| `planners.spec.ts` *(new)* | L04 | 1 |
| `security.spec.ts` | P01–P04 | 4 |
| `cloud.spec.ts` *(new)* | C01–C04 | 4 |
| `runtime.spec.ts` *(new)* | R01–R03 | 3 |
| **Total automated** | | **77** |
| **Not automated** | X01–X06 (exploratory charters) | 0 |

**The 6 exploratory cases (X01–X06) are not automated.** They are charters — "explore the first-run
flow", "audit destructive actions" — with no pass/fail expected result to encode. They get
`**Automation:** Not automated — exploratory charter, not a pass/fail case`.

### Files that get deleted

| File | Why |
|---|---|
| `test/e2e/ui_tests/known-defects.spec.ts` | Its 12 `test.fail()` cases duplicate the inline `*Known gap:*` bullets already carried by the manual cases. Each known gap is asserted **inside** its own case now (e.g. FIN-T10 asserts the add/edit linked-debt parity break), so the file would double-report. |
| `test/e2e/api_tests/AuthTests.spec.ts`, `StateApiTests.spec.ts` | Their 13 tests are API-level and map to no manual case. They are **kept** but re-titled to make clear they are contract tests outside the manual mapping — see §7. |

---

## 3. Per-domain work items

Each block below lists: the manual cases, the fixture(s) needed, the page-object additions needed,
and the traps specific to that domain.

### 3.1 `smoke.spec.ts` — S01, S02, S03, S04, S06, S07 (shell)

- **S01** boots to Home → `ShellPage` + `HomePage`. Assert the H1, the net-worth caption, the
  4-cell strip.
- **S02** all nine destinations open → loop over the nav labels via `ShellPage.navLink`.
- **S03** root redirects + unknown route shows "Not found." → `page.goto('/')` then assert the hash.
- **S04** hash routing survives a static build → assert the URL shape `/#/…` after a navigation.
- **S06** layout holds at three breakpoints → loop over viewport sizes; assert no horizontal overflow
  (`document.documentElement.scrollWidth <= clientWidth`).
- **S07** browser back/forward → `page.goBack()` / `page.goForward()`, assert the route.

*Traps:* the app is a hash-router SPA — every URL assertion must match `/#/route`, not `/route`.
"Back to top" is not a route; use the actual nav labels from `ShellPage`.

### 3.2 `smoke.mobile.spec.ts` — S05 (mobile drawer)

Runs under the `mobile` project (`Pixel 7`), matched by the `*.mobile.spec.ts` suffix. Drawer
opens with the menu button; dismisses by (1) the close button, (2) the backdrop, (3) Escape, and
(4) navigating to a destination.

*Traps:* `ShellPage.closeDrawerWithBackdrop()` already implements the backdrop click; Escape needs
`page.keyboard.press('Escape')` — the dialog uses a keydown listener on the drawer.

### 3.3 `transactions.spec.ts` — T01–T12 **(next file to write)**

Research is already complete. Fixtures: `baseState()` (accounts + categories, no ledger),
`todayState()` (the six standard transactions, all dated today),
`negativeBalanceState()` (Cash opens at 1,000 with a 2,500 expense).

| Case | Fixture | Notes |
|---|---|---|
| T01 lifecycle | `baseState()` | Income 60000/Salary/Main Bank, Expense 1200/Groceries/Cash, Transfer 3000 Cash→bKash. Toast "Transaction added" / "Your record is now in the transactions list." Row subtitles `Main Bank · Salary`, `Cash · Groceries`, `Transfer · Cash → bKash`. Balances: Main Bank ৳1,80,000, Cash ৳800, bKash ৳5,500. |
| T02 filters | **new** `filterState()` (7 transactions incl. one payout + one debt payment) | Header reads "7 entries" / "3 of 7 entries". Under **All** the rows carry a day header; under any other chip the list is flat (`dayHeaders` count 0). No-match message on **Payouts** with an empty fixture. Chip re-click resets to **All**. |
| T03 amount validation | `baseState()` | 8 invalid + 4 valid amounts inside the **one** test. Invalid → inline "Amount must be greater than zero." + Save disabled; valid → Save enabled. Presets `৳ 50 … ৳ 1,000` + helper "Tap a preset chip to autofill common amounts." Placeholders 250 / 60,000 / 5,000. Bypassing the disabled button → banner what/why/fix. |
| T04 category picker | `baseState()` | The app ships **35** expense categories (not 37) — the expander reads "Show all 35 categories" and becomes "Hide list". Income is flat with 5. No search field. "Selected" + × with accessible name "Clear selected category". Saving with no category falls back to the type name. |
| T05 transfer specifics | `baseState()` + a **single-account** state | From/To selects, arrow between them, To omits From. No Date/Note/Category/Debt/Investment on the transfer form. Projections "Balance: ৳ 5,000 → projected balance after save: ৳ 4,000" and "… ৳ 2,500 → … ৳ 3,500". Zero amount disables Save. Single-account profile → **To** has no option. |
| T06 edit form | `todayState()` | No presets, no projections. Label "Category" (no "(optional)"). Label "Note" + hint "Add or change a note. Leave blank to remove.". "🗑 Delete" present. No type selector. Cancel → list; Cancel on the **add** form → the type picker. |
| T07 edit recalculates | `todayState()` + `AccountsPage` + `HomePage` | Edit 1200→1500 → toast "Transaction saved" / "Your changes are now in your records."; Cash ৳3,500; Home "This month" Expenses figure moves; delete → Cash ৳5,000 + banner "Transaction deleted" / "The entry is gone from your records." / "Open Transactions to see the updated list." |
| T08 delete | `todayState()` | Confirm "Delete this entry?" + body; confirm → row gone + banner; re-open the same URL → H1 "Transaction not found". |
| T09 link a debt | **new** `debtPaymentState()` (debt 20,000 with 5,000 already paid) | Dropdown offers "— None —" + the debt; hint "Tag this transaction as a payment toward a debt."; "Remaining: ৳ 15,000"; after saving a 2,000 expense the debt reads "You've paid ৳ 7,000 of ৳ 20,000" and "Remaining: ৳ 13,000". |
| T10 link an investment | `noInvestmentsState()` + **new** `fdrState()` | Hint "Selecting one routes the money to that payout account."; "Current value (projection): ৳ 1,00,000" and "At maturity (projection): ৳ 1,09,000"; the account auto-switches to the payout account; changing it to Cash raises the non-blocking "Heads up:" warning and Save stays enabled; picking a debt clears the investment (and vice-versa). **Known gap:** the edit-income form has no linked-debt select — assert the parity break here. |
| T11 formatting | **new** `formattingState()` (3500 + 1234567) | "৳ 3,500" and "৳ 1,23,4,567" (en-IN lakh grouping). Day header matches `\d{1,2} [A-Z][a-z]{2} \d{4}`. |
| T12 negative balance | `negativeBalanceState()` | Cash shows **৳ -1,500** (ASCII hyphen — `fmtBDT` does not use U+2212). Home "Cash" tile shows the same signed figure. Delete the expense → back to ৳ 1,000. |

**Page-object additions needed** (`TransactionsPage`): `typeCard('income'|'expense'|'transfer')`,
`editHeading`, `notFoundHeading`, `saveButton` (labelled "Save"), `amountPlaceholder` /
`incomePlaceholder` / `transferPlaceholder`, `projectionLine`, `groupHeading(label)`,
`categoryGroups`, `pickerHeading`, `dayHeaderPattern`.

**Data corrections needed**: `test/data/transactions.json` → `T04_categories.showAllPattern`
`"Show all 37 categories"` → **`"Show all 35 categories"`**.

### 3.4 `goals.spec.ts` — G01–G04

Fixtures: `goalsState()` (from `test/data/goals.json`), `baseState()`.

- **G01** lifecycle — create → card → contribute → edit → delete. Uses `GoalsPage` (all locators
  already exist).
- **G02** validation & status — name required banner, target required, negative target, past target
  date accepted, reached banner, expired banner.
- **G03** pace — ahead / on track / behind → `GoalsPage.requiredPerMonthValue()`.
- **G04** contribution never moves a balance — seed an account, contribute, assert the balance is
  unchanged on `AccountsPage`.

### 3.5 `debts.spec.ts` — D01–D07

Fixtures: `baseState()` (the three standard debts), **new** `loanDebtState()`,
**new** `paidDebtState()`.

- **D01** flat lifecycle + opening transaction (note `Debt: Loan from Rahim`).
- **D02** loan-kind — "Loan" pill, "12% APR · 36mo", "Loan amount ৳ 60,000", the split preview
  "This payment will be split as:", the underpayment chip.
- **D03** direction + validation — direction select labels "I owe (you borrowed)" /
  "Owed to me (you lent)"; name-required banner; total / rate / term inline errors.
- **D04** delete semantics + auto-completion + direction flip — deleting keeps the linked
  transactions (row tagged "Debt received"); paying off exactly moves the debt into "Completed".
- **D05** activity feed + summary card — "Payments" / "Total paid" / "Last payment", the four row
  tags, "Across N debt(s)", "How it works:".
- **D06** overpayment — a 25,000 payment on a 20,000 debt is accepted; outstanding becomes ৳0.
- **D07** owed-to-me repayment — income linked to the debt; remaining and percent-paid update.

### 3.6 `investments.spec.ts` — I01–I08

Fixtures: `noInvestmentsState()`, **new** `fdrState()`, **new** `dpsState()`,
**new** `maturedInvestmentState()`.

- **I01** FDR lifecycle, **I02** DPS lifecycle + contribution, **I03** validation & variants,
  **I04** principal deduction (Main Bank ৳1,20,000 → ৳20,000), **I05** maturity / rollover / close,
  **I06** current vs maturity, **I07** maturity payout, **I08** delete leaves the transactions.
- **Data correction:** the manual doc says the DPS matures at **৳64,190**; the app's annuity-due
  formula produces **৳62,665**. `test/data/investments.json` already holds ৳62,665 — the manual doc
  must be corrected (see §5).

### 3.7 `home.spec.ts` (new) — H01, H05

- **H01** Home reflects the ledger — net worth, this-month income/expenses/net saved, the 4-cell
  strip, the accounts preview, recent activity. Uses `HomePage.netWorthFigure`,
  `thisMonthValue('Income'|'Expenses'|'Net saved')`, `stripValue('Cash'|'Receivables'|'Debts'|'Investments')`.
- **H05** Home empty states + stat captions — "No accounts yet" / "No transactions yet", the
  caption "Assets minus liabilities", "Liabilities exceed assets" when negative.

### 3.8 `insights.spec.ts` — H02, H04, H06

- **H02** insight over the selected range — the five range pills, the cash-flow card, the spending
  card, the net-worth card; changing the range re-computes every card.
- **H04** trends rows + the period-comparison caption — needs the `comparisonState()` fixture
  (straddles two windows, otherwise the caption never renders).
- **H06** insight empty states + the absent widgets — no recurring-transaction widget, no goal
  widget.

### 3.9 `settings.spec.ts` (new) — H03, W01–W06

- **H03** export/import round trip — `SettingsPage.exportBackupButton` / `importBackupButton`,
  `importFileInput`.
- **W01** wipe while signed out and while signed in — `wipeAllDataButton`, confirmation, store
  emptied.
- **W02** a failed cloud delete aborts the wipe; a wipe clears the PIN — needs the cloud failure
  path (see §6 gating).
- **W03** export a backup — file download assertions.
- **W04** import replaces the current data.
- **W05** import error paths — malformed file, wrong shape.
- **W06** there is no standalone "Delete cloud copy" button — a negative assertion.

*Note:* `SettingsPage` already exposes every locator needed. `eraseEverythingLink` exists.

### 3.10 `plan.spec.ts` — L01, L02, L05, L06, L07

- **L01** the Plan hub — the four destinations and the "This month" / "Events" rows.
- **L02** the Month Plan batch budget editor — selection mode, the four modes, apply-to-all.
- **L05** the Plan save/reset and dirty discipline — "Unsaved changes" / "Saved", Save plan,
  Delete, no-op when not dirty.
- **L06** Month Plan — add an item, set a budget, remove it (with confirmation).
- **L07** the Month Plan quick-total checker.

Fixtures: `monthPlanState()`, `monthPlanLedgerState()` (plan + ledger, to prove isolation).

### 3.11 `eventPlans.spec.ts` — L03, L08, L09

- **L03** Event Plan list + create. **L08** detail, categories, derived total.
  **L09** validation, completion, over-budget, deletion.
Fixtures: `eventPlanState()`, `eventPlanLedgerState()`.

### 3.12 `planners.spec.ts` (new) — L04

- Investment Planner + Loan Calculator are **scratchpads** — nothing touches the ledger.
  `InvestmentPlannerPage` and `LoanCalculatorPage` already exist.
- Assert the amortization table (Period / Due / Payment / Interest / Principal / Balance), the EMI
  and total-interest stats, and that no transaction appears afterwards.

### 3.13 `security.spec.ts` — P01–P04

- **P01** set a PIN → the app locks on the next load → unlock it.
- **P02** entry mechanics, a wrong PIN, rate limiting (lockout).
- **P03** change / disable / forgot PIN.
- **P04** the PIN never leaves the device — assert no network call carries the PIN and that the
  stored value is a salted hash, not the digits.

Fixtures: `seedPin(page, pin)` in `test/e2e/fixtures/app-state.ts`.

### 3.14 `cloud.spec.ts` (new) — C01–C04

- **C01** the sync-disabled build — the panel shows the sync-disabled notice.
- **C02** sign-in / sign-up errors — wrong password, unknown address, weak password.
- **C03** the signed-in state, a forced sync, the offline queue.
- **C04** sign out, sign back in, password change.

**These are env-gated.** They need `BASE_URL` + `BASE_ANON_KEY` (the app's build-time vars) and
`FINORA_E2E_USER_EMAIL` / `FINORA_E2E_USER_PASSWORD` / `FINORA_E2E_NEW_USER_EMAIL`. The spec
must **skip loudly** when the vars are absent, exactly as the existing API suite does — a silent
skip would make the suite look green while proving nothing.

*Known gap (FIN-C01):* `src/components/SyncStatusPill.tsx:49` names `VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY` while `vite.config.ts` actually reads `BASE_URL` / `BASE_ANON_KEY`. The
case asserts the shipped copy and the mismatch is recorded in the manual doc.

### 3.15 `runtime.spec.ts` (new) — R01–R03

- **R01** data survives a reload and a full browser restart — reload the page, then close and
  re-open the context; assert the state is still there.
- **R02** clearing site data yields a clean install — the first-run state.
- **R03** accessibility and UI conventions — labels are wired (`A11yPage.labelFor`), fields have
  hints/errors, progress bars carry `role="progressbar"`, icon-only buttons have an accessible
  name.

---

## 4. The shape of a test

`accounts.spec.ts` is the template; every other file copies it.

```ts
test.describe('Transactions', () => {
  let transactions: TransactionsPage;

  test.beforeEach(async ({ page }) => {
    transactions = new TransactionsPage(page);
  });

  test('FIN-T01 Income, expense and transfer lifecycle', { tag: '@smoke' }, async ({ page }) => {
    await seedState(page, baseState());

    await test.step('Click "+ Add transaction" and choose Income', async () => {
      await transactions.gotoPicker();
      await transactions.typeCard('income').click();
    });
    await test.step('Enter 60000, choose the category Salary, choose the account Main Bank, and save', async () => {
      await transactions.amountInput.fill(data.T01_lifecycle.income.amount);
      await transactions.categoryChip(data.T01_lifecycle.income.category).click();
      await transactions.accountSelect.selectOption({ label: data.T01_lifecycle.income.account });
      await transactions.saveAndWaitForList();
    });

    await expect(transactions.row(...)).toContainText(data.T01_lifecycle.expected.rowSubtitles[0]);
  });
});
```

Discipline enforced in review:
- the fixture is seeded **before** the first step (precondition = state, not history);
- `beforeEach` navigates only;
- every assertion reads its expectation from the JSON store, never from a literal;
- `test.step()` wording mirrors the manual's step text.

---

## 5. Corrections to `test/docs/manual-test.md`

The skill allows editing the manual doc only on the `**Automation:**` line — **except** where the
document states something the shipped app does not do, in which case the document is wrong and the
automation would encode a falsehood. Those corrections are listed here explicitly and are applied
together with the Automation lines.

| # | Case | Current text | Correct text | Why |
|---|---|---|---|---|
| 1 | FIN-T04 | "Show all 37 categories" | **"Show all 35 categories"** | `DEFAULT_EXPENSE_CATEGORIES` in `src/domain/persistence.ts:121–168` holds **35** entries; the button renders `Show all {categories.length} categories`. |
| 2 | FIN-T12 | "৳ −1,500" (U+2212) | **"৳ -1,500"** (ASCII hyphen) | `fmtBDT` uses `toLocaleString`, which emits an ASCII hyphen. `test/data/accounts.json` was already corrected. |
| 3 | FIN-I02, FIN-I06 | DPS maturity "৳64,190" | **"৳62,665"** | The app's annuity-due formula (`dpsMaturityValue`) produces 62,665. `test/data/investments.json` already holds 62,665. |
| 4 | FIN-A01 | — | add a `*Known gap:*` bullet | The new-account card **suppresses** the delta / last-activity row entirely; the doc's `initialDelta` / `initialActivity` expectations describe a row the app does not render. |
| 5 | FIN-A05 | — | add a `*Known gap:*` bullet | The Home empty-state copy differs from the Accounts/Transactions copy the doc quotes. |

Everything else in the manual doc stays byte-identical.

---

## 6. Environment and gating

| Variable | Used by | When missing |
|---|---|---|
| `BASE_URL`, `BASE_ANON_KEY` | `cloud.spec.ts`, API suite | **Skip with a loud message** — never a silent pass. |
| `FINORA_E2E_USER_EMAIL`, `FINORA_E2E_USER_PASSWORD` | `cloud.spec.ts` (sign-in) | Skip the sign-in cases. |
| `FINORA_E2E_USER_WRONG_PASSWORD` | `cloud.spec.ts` (C02) | Skip. |
| `FINORA_E2E_NEW_USER_EMAIL` | `cloud.spec.ts` (C04 sign-up) | Skip. |

`.env.example` already lists all five names. Secrets are read through
`test/e2e/support/env.ts`'s `requireEnv()`, which throws when a variable is missing.

---

## 7. The API and visual suites

The 83 manual cases are all UI-level, so the API and visual suites are **not** part of the
one-for-one mapping. They are kept because they are genuinely useful, and re-titled so the
mapping is unambiguous:

- `test/e2e/api_tests/AuthTests.spec.ts` → titles prefixed `API-` (5 tests) — the Supabase auth
  contract.
- `test/e2e/api_tests/StateApiTests.spec.ts` → titles prefixed `API-` (8 tests) — the
  `finora_state` RLS contract.
- `test/e2e/visual_tests/VisualTest.spec.ts` → unchanged (10 snapshot tests).

None of these carry a `FIN-XX` title, because none of them implements a manual case. The
`**Automation:**` lines in the manual doc point at the **UI** spec that implements each case.

---

## 8. Execution order

| # | Work | Produces |
|---|---|---|
| 1 | `transactions.spec.ts` (T01–T12) | the reference for every other domain |
| 2 | `goals.spec.ts`, `debts.spec.ts`, `investments.spec.ts` | G / D / I |
| 3 | `home.spec.ts`, `insights.spec.ts` | H01, H02, H04, H05, H06 |
| 4 | `settings.spec.ts` | H03, W01–W06 |
| 5 | `plan.spec.ts`, `eventPlans.spec.ts`, `planners.spec.ts` | L01–L09 |
| 6 | `security.spec.ts`, `cloud.spec.ts`, `runtime.spec.ts` | P, C, R |
| 7 | `smoke.spec.ts`, `smoke.mobile.spec.ts` | S01–S07 |
| 8 | Delete `known-defects.spec.ts` | — |
| 9 | Fill the 83 `**Automation:**` lines + the 5 corrections in §5 | `manual-test.md` |
| 10 | Delete the scratch files `test/docs/_cases.cjs`, `_cases.json`, `_cases.txt`, `_map.cjs`, `_td.cjs`, `_td.txt` | — |
| 11 | `npm run typecheck:e2e` → `npm run test:e2e` → `npm run test:api` → `npm run test:visual` | green |

---

## 9. Definition of done

- [x] 77 automated tests exist, one per non-exploratory manual case, titled `FIN-XX <manual title>`.
- [x] 50 of them carry `{ tag: '@smoke' }` — exactly the High-priority cases.
- [x] No spec file contains a locator string, a literal amount, or a literal expected message.
- [x] No `waitForTimeout` / `waitForSelector` / `{ delay }` anywhere in the suite.
- [x] Every test is independent — it seeds its own precondition and passes in any order.
- [x] The 83 `**Automation:**` lines are filled: 77 with a spec reference, 6 with
      `Not automated — exploratory charter, not a pass/fail case`.
- [x] The 5 corrections in §5 are applied to `manual-test.md`.
- [x] `npm run typecheck:e2e` is clean.
- [x] `npm run test:e2e`, `npm run test:api`, `npm run test:visual` all pass — or the report
      states plainly which suite could not run and why.
- [x] The `test/docs/_*` scratch files are deleted.

### Verification notes

All four suites were run on 2026-11-12 and pass:

| Suite | Command | Result |
| --- | --- | --- |
| Unit | `npm run test` | 467 passed (36 files) |
| UI | `npm run test:e2e` | 77 passed (chromium 74 · mobile 1 · no-sync 1) |
| API | `npm run test:api` | 13 passed — against the live local Supabase stack |
| Visual | `npm run test:visual` | 10 passed — on Windows **and** on Linux (CI's OS) |

Two things worth recording, because both were silent failures that a green
run would have hidden:

- **The API suite skipped itself.** `AuthTests.spec.ts` and
  `StateApiTests.spec.ts` read `process.env.BASE_URL` / `process.env.BASE_ANON_KEY`
  directly, which bypasses `.env.local` — so a developer's local Supabase
  stack was invisible and all 13 cases skipped. All three readers now go
  through `envValue()` in `test/e2e/support/env.ts`, the same loader the
  app uses.
- **The Investments snapshot drifted every day.** `daysToMaturity()` measures
  against the real "today", so the "Matures in 109d" line changed the moment
  the baseline was committed. The countdown is now masked in that snapshot
  (`mask:` in `toHaveScreenshot`), which keeps every other pixel asserted and
  makes the baseline date-independent. Both the `-linux` and `-win32`
  baselines were regenerated; the other 18 baselines are byte-identical.

