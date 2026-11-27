# Finora V1 — Manual Test Cases

## Scope

**Feature under test:** Finora V1 — a Bangladesh-first, local-first personal-finance SPA (React 18 · TypeScript · Vite · Tailwind v4 · Zustand · Dexie/IndexedDB · React Router v7 in hash mode · optional Supabase cloud sync). Version `1.0.0`.

**Requirement sources used, in the priority order the skill requires:**

1. `PRD.md` — the business requirement source. Sections §8 (user journeys 8.1–8.20), §9 (functional requirements 9.1–9.19.10), §10 (core financial rules R1–R21), §11 (error-handling contract), §12 (UX principles), §13 (NFRs), §15 (edge cases).
2. `test/docs/manual-test-detailed.md` — the pre-existing 282-case reference spec, used for the detailed per-field expectations and the verified on-screen copy. Its `FIN-NAV` / `FIN-ACC` / `FIN-TXN` / `FIN-HOM` / `FIN-INS` / `FIN-GOA` / `FIN-DBT` / `FIN-INV` / `FIN-PLN` / `FIN-SEC` / `FIN-SYN` / `FIN-SET` / `FIN-PER` / `FIN-A11Y` identifiers are **retained unchanged** as the retained-detail appendix.
3. `test/docs/playwright-automation-plan.md` — used only to keep the case IDs stable against the existing 232-test e2e suite and the `known-defects.spec.ts` `test.fail()` assertions.
4. Application behaviour — where the PRD is silent, the shipped copy and behaviour were read from `src/screens/*`, `src/components/*`, `src/domain/*` to write verifiable expected results.

**What this document is:** the canonical, executable manual test case set. It supersedes the previous 50-case "compact" plan and absorbs the detail that previously lived only in the 282-case appendix. The appendix remains at `test/docs/manual-test-detailed.md` as the retained-detail reference.

**Case-ID stability.** The stable IDs are the compact scheme — `FIN-S`, `FIN-A`, `FIN-T`, `FIN-G`, `FIN-D`, `FIN-I`, `FIN-H`, `FIN-L`, `FIN-P`, `FIN-C`, `FIN-W`, `FIN-R`, `FIN-X` — because `test/docs/playwright-automation-plan.md` §7 and every file under `test/e2e/ui_tests/` already reference them. No pre-existing ID has been renumbered, reordered or reused. Where a pre-existing case has been split or narrowed, the original ID keeps its dominant meaning and the new behaviour takes a **new** ID; the mapping is recorded in the table below. The appendix's `FIN-NAV`… IDs are also retained unchanged.

| Previous compact ID | Now |
|---|---|
| FIN-S01…FIN-S06 | FIN-S01…FIN-S06 (unchanged) + **FIN-S07** (new) |
| FIN-A01…FIN-A05 | FIN-A01…FIN-A05 (unchanged) + **FIN-A06**, **FIN-A07** (new) |
| FIN-T01…FIN-T06 | FIN-T01…FIN-T05 (unchanged) · **FIN-T06** narrowed to the edit-form contract · **FIN-T07**…**FIN-T12** (new) |
| FIN-G01, FIN-G02 | FIN-G01, FIN-G02 (unchanged) + **FIN-G03**, **FIN-G04** (new) |
| FIN-D01…FIN-D04 | FIN-D01…FIN-D04 (unchanged) + **FIN-D05**, **FIN-D06**, **FIN-D07** (new) |
| FIN-I01…FIN-I03 | FIN-I01…FIN-I03 (unchanged) + **FIN-I04**…**FIN-I08** (new) |
| FIN-H01…FIN-H04 | FIN-H01…FIN-H04 (unchanged) + **FIN-H05**, **FIN-H06** (new) |
| FIN-L01…FIN-L05 | FIN-L01…FIN-L05 (unchanged) + **FIN-L06**…**FIN-L09** (new) |
| FIN-P01…FIN-P03 | FIN-P01…FIN-P03 (unchanged) + **FIN-P04** (new) |
| FIN-C01…FIN-C04 | FIN-C01…FIN-C04 (unchanged) |
| FIN-W01, FIN-W02 | FIN-W01, FIN-W02 (unchanged) + **FIN-W03**…**FIN-W06** (new) |
| FIN-X01…FIN-X06 | FIN-X01…FIN-X06 (unchanged, exploratory charters) |
| — | **FIN-R01**…**FIN-R03** (new prefix — runtime persistence & accessibility) |

**Assumptions** (each is a gap or an ambiguity in the sources, resolved by reading the shipped build; marked code-derived):

- *Code-derived.* Where the PRD and the build disagree, this document asserts the **shipped** behaviour as the observable truth and records the PRD divergence as a **known gap** inside the affected case's expected result. It never silently promotes shipped behaviour to "correct". The 45 previously catalogued divergences are preserved this way.
- *Code-derived.* The account type list is Cash · Bank Account · Mobile Wallet · **Card** · Other. PRD §9.3 specifies **Savings Account** instead of Card; the build ships Card. Asserted as shipped; the divergence is recorded in FIN-A02.
- *Code-derived.* The theme is **dark only**. PRD §9.6 specifies Dark / Light / Auto and §9.14 specifies a sidebar Dark/Light segmented toggle; neither exists in the build (`src/App.tsx` forces `data-theme="dark"` at boot). Asserted as shipped; recorded in FIN-S01.
- *Code-derived.* The signed-out wipe confirmation body and the signed-in wipe confirmation body are rendered from `SettingsScreen.tsx`; their exact wording differs slightly from PRD §9.12. The shipped wording is asserted verbatim.
- *Code-derived.* The `Insight` screen H1 is singular while Home's link reads "See full Insights →". Recorded in FIN-H02.
- The cloud cases **FIN-C01**–**FIN-C04** and the signed-in half of **FIN-W01**/**FIN-W02** require a build with Supabase credentials. Without them they are **Blocked**, not failed — record the blocker in the run log.
- The seeded data referenced by "Precondition: seeded data" is the §1 seed table of the appendix (`test/docs/manual-test-detailed.md` §2.3). Preconditions state *state*, never history, so each case provisions its own data.

**Requirement gaps — behaviours the PRD specifies that do not exist in the build.** No case asserts them as working behaviour; each is asserted as *absent* in the owning case so the divergence stays visible:

| PRD requirement | Gap | Asserted in |
|---|---|---|
| §9.6 / §9.14 Theme Dark/Light/Auto + sidebar toggle | Dark is forced at boot; no light theme, no toggle | FIN-S01 |
| §9.4 Category create / rename / delete | No category CRUD UI; only the additive "Restore default categories" | FIN-T04 |
| §9.7 Debt soft-archive on delete + "Archived debt" tag | Debt delete is a hard delete; no archived tag | FIN-D04 |
| §8.15 "paid off. Nice." toast on debt auto-completion | Completion happens in the derived layer, which renders nothing | FIN-D04 |
| §15 Direction flip requires explicit confirmation | No confirmation on a direction flip | FIN-D04 |
| §9.12 Standalone "Delete cloud copy" button | Only reachable as the first step of "Wipe everything" | FIN-W06 |
| §9.16.2 Three-up Insights stat row (Net flow · Avg monthly expense · **Saved toward goals**) | Four rows ship instead; "Saved toward goals" is unreachable in the UI | FIN-H04 |
| §9.15.1 / R12 Plan Save+Reset toolbar on every planner | Month Plan and Event Plan auto-save; Reset is unimplemented everywhere | FIN-L05 |
| §8.1 Onboarding asks one number and creates a Cash account | A 3-step explainer creates no account | FIN-X01 |
| §9.2 Transaction list totals / search / sort | Only 8 mutually-exclusive filter chips exist | FIN-T02 |

**Test environment.** `npm install && npm run dev` → `http://localhost:5173`. Viewports: 1440×900 (sidebar), 768×1024 (drawer), 375×812 (topbar). Data lives in IndexedDB (`finora` → `state`); **Clear site data** is the reset between runs.

### Coverage

| Business rule | Source | Cases |
|---|---|---|
| R1 Monthly income = Σ income transactions dated in the current month | PRD §10 R1 | FIN-H01 (UI); maths unit-tested |
| R2 Monthly expenses = Σ expense transactions dated in the current month | PRD §10 R2 | FIN-H01 (UI); maths unit-tested |
| R3 Account balance = opening + Σ transactions on the account | PRD §10 R3 | FIN-A01, FIN-A06, FIN-T01 |
| R4 A transfer moves money between accounts; it is neither income nor expense | PRD §10 R4 | FIN-T01, FIN-T05 |
| R5 Goal requirement = (target − saved) ÷ months left | PRD §10 R5 | FIN-G01, FIN-G03 |
| R6 Only recorded transactions change account balances | PRD §10 R6 | FIN-T01, FIN-G04, FIN-L04 |
| R7 Debt `paid_so_far` = Σ of its linked transactions' amounts | PRD §10 R7, §9.7 | FIN-D01, FIN-D02, FIN-D04 |
| R8 Debt auto-completes when `paid_so_far` ≥ total, and dashboard totals drop | PRD §10 R8, §8.15 | FIN-D04 |
| The debt list shows a direction tag, a progress bar and a "X% paid" caption per card | PRD §7, §9.7 | FIN-D05 |
| Receiving a repayment on an "owed to me" debt raises `paid_so_far` and creates a linked Income | PRD §8.13, §9.7 | FIN-D07 |
| R9 Investment maturity value = principal × (1 + rate/100 × term/12), recalculated on edit | PRD §10 R9, §9.8 | FIN-I01, FIN-I04 |
| R10 Investment status: auto `matured`, payout → `closed`, rollover → `rolled_over`; closed/rolled_over are sticky | PRD §10 R10, §9.8 | FIN-I05 |
| Recording the maturity payout creates a linked Income on the payout account and closes the investment | PRD §8.18, §9.8 | FIN-I07 |
| R11 Plan state never affects accounts, transactions, totals or Insights | PRD §10 R11, §9.15.3 | FIN-L04, FIN-G04, FIN-L09 |
| R12 Plan dirty/save model: dirty flag, `savePlan`, `resetPlan`, **no auto-save**, no guard rail | PRD §10 R12, §9.15.1 | FIN-L05 |
| R13 DPS maturity uses the annuity-due formula | PRD §10 R13, §9.8 | FIN-I02, FIN-I06 |
| R14 DPS current value compounds each contributed installment to today | PRD §10 R14, §9.8.1 | FIN-I06 |
| Deleting an investment does not delete the transactions that were linked to it | PRD §9.8 | FIN-I08 |
| R15 Dual-value net worth: current vs projected | PRD §10 R15, §9.8.1 | FIN-H01, FIN-I06 |
| R16 Exactly one of term-months / term-days; rate capped 0–100 | PRD §10 R16, §15 | FIN-I03 |
| R17 Insights range persists to `localStorage` under `finora.insights.range`, defaults to `last6` | PRD §10 R17, §9.16.1 | FIN-H02 |
| R18 Mock investment maturity uses the same formula and is always labelled "(projection)" | PRD §10 R18, §9.17.1 | FIN-L04 |
| R19 Loan EMI formula and per-period interest/principal split | PRD §10 R19, §9.17.2 | FIN-L04 |
| R20 Loan-kind debt outstanding is derived, never stored | PRD §10 R20, §9.18 | FIN-D02 |
| R21 Loan-kind debt requires rate > 0; downgrading to flat clears the rate | PRD §10 R21, §9.18 | FIN-D03 |
| Nine primary destinations, each with its own screen, H1 and matching URL hash | PRD §7 | FIN-S02 |
| The app boots with no console errors and lands on Home; the theme is dark-only | PRD §9.6, §9.14 | FIN-S01 |
| The root route redirects to Home; an unknown route renders "Not found." | PRD §7, §9.6 | FIN-S03 |
| The router is in hash mode, so a static build works from `file://` with no server | PRD §7, §9.9 | FIN-S04 |
| The mobile drawer opens over a blurred backdrop and dismisses by nav, backdrop, × and Escape | PRD §7, §9.14 | FIN-S05 |
| The layout holds at 1440 / 768 / 375 with no clipping or horizontal scrollbar | PRD §9.14 | FIN-S06, FIN-X05 |
| Browser Back and Forward move between screens without losing state | PRD §7 | FIN-S07 |
| Dashboard layout: two stat rows, accounts preview, recent activity, "See full Insights →" | PRD §9.1 | FIN-H01, FIN-H05 |
| Net worth on Home is net (i_owe − owed_to_me) and includes receivables | PRD §9.1 | FIN-H01 |
| Transaction types: income, expense, transfer; type-specific fields | PRD §9.2, §8.2–8.4 | FIN-T01, FIN-T05 |
| The list offers single-select filter chips (click again to reset to All) and groups by date | PRD §7, §9.2 | FIN-T02 |
| The edit form is prefilled and the transaction type is locked | PRD §9.2 | FIN-T06 |
| Amount is required and must be > 0 | PRD §9.2, §11 | FIN-T03 |
| Transfer From/To pick from the same list; To excludes From; live balance projections | PRD §9.2 | FIN-T05 |
| Linked debt on an expense; on an income only `owed_to_me` debts are offered | PRD §9.2, §8.13 | FIN-T09 |
| Linked investment on an income routes the money to the payout account; debt and investment are mutually exclusive | PRD §9.2, §9.8 | FIN-T10 |
| Editing a transaction recalculates balances and monthly totals | PRD §9.2 | FIN-T07 |
| Amounts render with the ৳ symbol and Indian lakh grouping (৳ 1,23,456) | PRD §9.2, §13.3 | FIN-T11 |
| Deleting a transaction is permanent after confirmation | PRD §9.2, §8 | FIN-T08 |
| Account types are Cash · Bank Account · Mobile Wallet · Card · Other | PRD §9.3 | FIN-A02 |
| Account name is required; opening balance must be ≥ 0 | PRD §9.3, §11 | FIN-A03 |
| An account referenced by transactions cannot be deleted | PRD §9.3, §15 | FIN-A04 |
| An account may hold a negative balance when spending exceeds what it holds | PRD §15 | FIN-T12 |
| Cancelling a destructive confirmation leaves the record untouched | PRD §11, §12 | FIN-A07 |
| Expense categories are grouped in the picker; income categories are flat | PRD §9.4 | FIN-T04 |
| Category create / rename / delete | PRD §9.4 | Excluded — no category CRUD UI exists; asserted absent in FIN-T04 |
| Goal fields: name, target > 0, target date, optional starting amount | PRD §9.5 | FIN-G01, FIN-G02 |
| A goal's target date must be in the future | PRD §9.5, §11, §15 | FIN-G02 (asserted as **not enforced** — known gap) |
| A goal contribution is a plan entry and never changes an account balance | PRD §9.5, §10 R11 | FIN-G04 |
| Goal states: complete, expired, ahead/behind pace | PRD §9.5 | FIN-G03 |
| Export backup downloads one JSON file named `finora-backup-YYYY-MM-DD.json` | PRD §9.6, §9.10 | FIN-W03, FIN-H03 |
| The backup contains every entity plus a version field | PRD §9.10 | FIN-W03 |
| Import validates schema + version, confirms, then replaces all data | PRD §9.6, §9.11 | FIN-W04, FIN-H03 |
| Import rejects a non-JSON file, a wrong-shape file and an unreadable file | PRD §9.11, §15 | FIN-W05 |
| "Wipe all data" requires confirmation and clears local + plan state | PRD §9.6, §9.12 | FIN-W01 |
| Wipe behaviour and copy differ signed in vs signed out | PRD §9.12, §9.19.9 | FIN-W01 |
| "Delete cloud copy" deletes only the cloud row and preserves local | PRD §9.12 | FIN-W06 (asserted as **absent** — known gap) |
| The About panel shows app name, version, privacy statement and an erase affordance | PRD §9.6 | FIN-W01 |
| Inline help text sits below fields and on KPI tiles | PRD §9.13 | FIN-A05, FIN-X04 |
| First-run empty states show an illustration, CTA and learn-more overlay | PRD §9.14 | FIN-A05 |
| A successful save shows a toast | PRD §9.14 | FIN-T01 |
| Every error message states what, why and how to fix | PRD §11 | FIN-A03, FIN-G02, FIN-T03, FIN-I03, FIN-W05 |
| Month Plan: scratchpad items, budgets, batch editor, quick-total checker | PRD §9.15.1 | FIN-L01, FIN-L02, FIN-L06, FIN-L07 |
| Month Plan has a month selector and rollover | PRD §9.15.1 | Excluded — no month selector and no rollover exist; asserted absent in FIN-L01 |
| Event Plan: categories, line items, timeline, completion and over-budget states | PRD §9.15.2 | FIN-L03, FIN-L08, FIN-L09 |
| Event Plan total budget is the sum of category budgets | PRD §9.15.2 | FIN-L03, FIN-L08 |
| Plan → Ledger boundary: no transactions, no balance change, no Insights effect | PRD §9.15.3, §9.17.3 | FIN-L04 (step 7), FIN-L09 |
| Insights range picker and persistence | PRD §9.16.1 | FIN-H02 |
| Insights stat row with a period-comparison caption | PRD §9.16.2 | FIN-H04 (asserts the **shipped** four rows — known gap) |
| Cash-flow chart, spending-by-category and net-worth cards | PRD §9.16.3–9.16.5 | FIN-H04 |
| Goals / Debts / Investments cards on the Insight screen | PRD §9.16.6 | Excluded — not rendered; asserted absent in FIN-H06 |
| Insights does NOT support custom date ranges, PNG/CSV export, single-month comparison or forecasting | PRD §9.16.7 | Excluded — an explicit non-requirement; asserted absent in FIN-H02 |
| Investment Planner: starter kits, projection, summary | PRD §9.17.1 | FIN-L04 |
| Loan Calculator: EMI, totals, amortization table | PRD §9.17.2 | FIN-L04 |
| The mock planners link to no Account and no Debt, accrue daily, compound off-cycle or support prepayment or floating rates | PRD §9.17.4 | Excluded — an explicit non-requirement; asserted absent in FIN-L04 |
| Cloud sync: email + password auth, one cloud copy, RLS-scoped | PRD §9.19.3–9.19.4 | FIN-C02, FIN-C03 |
| Sync reconciles last-write-wins with a server-clock tiebreaker; no realtime | PRD §9.19.5 | FIN-C03 |
| Sign out preserves the cloud copy; signing back in restores the snapshot | PRD §9.19 | FIN-C04 |
| Password change and the emailed recovery link, with cross-tab dedupe | PRD §9.19.3 | FIN-C04 |
| No financial data is sent off-device without opt-in; the PIN never enters an export | PRD §13.2 | FIN-P04, FIN-W03 |
| The PIN lock accepts a correct PIN, rejects a wrong one, and escalates its delay after repeated failures | PRD §9.19.6 | FIN-P02 |
| A PIN can be set, the app locks on reload, and the correct PIN unlocks it | PRD §9.19.6 | FIN-P01 |
| A PIN can be changed, disabled, and forgotten; forgetting wipes the local data | PRD §9.6, §9.19.6 | FIN-P03 |
| A sync-disabled build states that sync is off and why, without erroring | PRD §9.19.8 | FIN-C01 |
| A failed cloud delete aborts the wipe; a successful wipe clears the PIN | PRD §9.6, §9.12 | FIN-W02 |
| First-run onboarding completes and the user reaches a working app | PRD §8.1, §14.3 | FIN-X01 |
| Unusual but legal values are accepted or rejected with a clear message | PRD §11, §15 | FIN-X06 |
| Monetary values and controls are screen-reader friendly; colour is not the sole signal | PRD §13.3 | FIN-R03, FIN-T11 |
| Keyboard navigation works for every primary flow | PRD §13.3 | FIN-R03 |
| The primary language is English; Bangla localization is a V2 candidate | PRD §13.4 | Excluded — V1 ships English only; asserted absent in FIN-R03 |
| Edit and delete recalculate all dependents; import does not silently corrupt data | PRD §13.5 | FIN-T07, FIN-T08, FIN-W05 |
| Adding an expense takes ≤ 3 taps; totals and balances recompute instantly | PRD §13.1 | Excluded — a timing measurement, not an observable business outcome; the 3-tap path is verified in FIN-T01 |
| Data persists across reload and tab close; a site-data clear yields a clean install | PRD §9.9, §15 | FIN-R01, FIN-R02 |
| Edge cases: goal date today / past, debt payment exactly at total / above it, future-dated investment start, 0% rate, event plan with a past date | PRD §15 | FIN-G02, FIN-D06, FIN-I03, FIN-I05, FIN-L09 |
| Every screen reports the same balance, outstanding and net worth for the same data | PRD §13.5, §14.2 | FIN-X02 |
| Every destructive action is confirmed and its copy names what is lost, what is preserved, and local vs cloud | PRD §11, §12 | FIN-X03 |
| No clipped, overlapping or unreadable content at any supported width | PRD §9.14 | FIN-X05 |
| Zero income this month and zero expenses this month | PRD §15 | FIN-H05, FIN-H06 |
| Deleting a category that has transactions | PRD §15 | Excluded — no category CRUD UI exists; asserted absent in FIN-T04 |
| Automated unit and integration coverage of the maths | PRD §14.1, §14.2 | Excluded — covered by `npm test` (466 unit specs); manual verifies the UI only |
| Visual-regression pixel baselines | — | Excluded — a Playwright visual suite owns this |

---

## Test Cases

### Shell, navigation and layout

### FIN-S01: App boots cleanly to Home

**Type:** Positive · **Priority:** High

**Precondition:** A fresh browser profile with no `finora` IndexedDB database; the dev server is running.

**Steps:**
1. Open the app URL.
2. Open the browser devtools console.
3. Wait for the Home screen to finish rendering.

**Test Data:** None.

**Expected Result:**
- The Home screen renders with H1 **"Where is my money?"**.
- The meta line reads **"Net worth · across N accounts · updated just now"**.
- The console shows no errors and no React warnings.
- The document is dark-themed on first paint, with no flash of a light theme.
- *Known gap:* the PRD §9.6 and §9.14 specify a Dark / Light / Auto theme setting and a sidebar Dark/Light segmented toggle. Neither exists — the build forces `data-theme="dark"` at boot. The theme is dark-only; no theme control is offered anywhere.

**Automation:** `test/e2e/ui_tests/smoke.spec.ts` → "FIN-S01 App boots cleanly to Home"

### FIN-S02: All nine destinations open

**Type:** Positive · **Priority:** High

**Precondition:** The app is running; signed in or signed out is acceptable.

**Steps:**
1. In the sidebar, click **Home**.
2. Click **Plan**.
3. Click **Insight**.
4. Click **Transactions**.
5. Click **Accounts**.
6. Click **Goals**.
7. Click **Investments**.
8. Click **Debts**.
9. Click **Settings**.

**Test Data:** None.

**Expected Result:**
- Each destination renders its own screen with its own H1 — **Where is my money?**, **Plan**, **Insight**, **Transactions**, **Accounts**, **Goals**, **Investments**, **Debts**, **Settings**.
- The URL hash matches the destination after each click.
- No dead links and no console errors.
- The active nav item is highlighted, and exactly one item is highlighted at a time.

**Automation:** `test/e2e/ui_tests/smoke.spec.ts` → "FIN-S02 All nine destinations open"

### FIN-S03: Root redirects to Home and an unknown route shows "Not found."

**Type:** Positive · **Priority:** Medium

**Precondition:** The app is running.

**Steps:**
1. Navigate to `#/`.
2. Navigate to `#/nope-not-a-route`.

**Test Data:** None.

**Expected Result:**
- `#/` redirects to `#/home` and the Home screen renders.
- The unknown route renders the text **"Not found."**.
- The sidebar stays visible and navigable in the not-found state.

**Automation:** `test/e2e/ui_tests/smoke.spec.ts` → "FIN-S03 Root redirects to Home and an unknown route shows "Not found.""

### FIN-S04: Hash routing survives a static build

**Type:** Positive · **Priority:** Medium

**Precondition:** A shell with Node and npm; `dist/` has not been built for this run.

**Steps:**
1. Run `npm run build`.
2. Open `dist/index.html` from disk using a `file://` URL.
3. Navigate between Home, Transactions and Accounts.

**Test Data:** None.

**Expected Result:**
- The app boots from `file://` with no web server running.
- In-app navigation between screens works.
- The router is in hash mode, so no SPA rewrite rule is needed.

**Automation:** `test/e2e/ui_tests/smoke.spec.ts` → "FIN-S04 Hash routing survives a static build"

### FIN-S05: Mobile drawer opens and dismisses four ways

**Type:** Positive · **Priority:** High

**Precondition:** The viewport is 375×812.

**Steps:**
1. Tap the hamburger in the topbar.
2. Tap a nav item.
3. Open the drawer again and tap the backdrop.
4. Open the drawer again and tap the close **×**.
5. Open the drawer again and press **Escape**.
6. Open the drawer and attempt to scroll the page behind it.

**Test Data:** None.

**Expected Result:**
- The drawer slides in over a blurred backdrop, listing all nine nav items plus the **"+ Add transaction"** CTA.
- All four dismissal paths close it and remove the backdrop.
- The page behind does not scroll while the drawer is open.
- The topbar shows the wordmark centred with the hamburger on the left.

**Automation:** `test/e2e/ui_tests/smoke.mobile.spec.ts` → "FIN-S05 Mobile drawer opens and dismisses four ways"

### FIN-S06: Layout holds at three breakpoints

**Type:** Positive · **Priority:** Medium

**Precondition:** Seeded data is present.

**Steps:**
1. Resize the viewport to 1440×900 and open **Settings**.
2. Resize to 768×1024 and re-read **Settings**.
3. Resize to 375×812 and re-read **Settings**.

**Test Data:** None.

**Expected Result:**
- At 1440×900 the sidebar is a sticky 248px left column with a **"+ Add transaction"** CTA pinned at the bottom.
- At 768×1024 the sidebar becomes a fixed off-canvas drawer with a topbar.
- At 375×812 the topbar shows the hamburger left and the wordmark centred.
- At 768px and above **Settings** renders two columns with a 320px About panel; below 768px it renders one column with **About** after the **Danger zone**.
- No content is clipped and there is no horizontal scrollbar at any of the three widths.

**Automation:** `test/e2e/ui_tests/smoke.spec.ts` → "FIN-S06 Layout holds at three breakpoints"

### FIN-S07: Browser back and forward move between screens

**Type:** Positive · **Priority:** Low

**Precondition:** The app is running with at least one account, so no onboarding or empty-state overlay interferes.

**Steps:**
1. Navigate to Home.
2. Navigate to Transactions.
3. Navigate to Accounts.
4. Press the browser Back button twice.
5. Press the browser Forward button twice.

**Test Data:** None.

**Expected Result:**
- Each transition renders the expected screen, and the hash follows.
- The active nav item follows the screen.
- No state is lost and no screen renders blank.

**Automation:** `test/e2e/ui_tests/smoke.spec.ts` → "FIN-S07 Browser back and forward move between screens"

### Accounts

### FIN-A01: Account lifecycle

**Type:** Positive · **Priority:** High

**Precondition:** No accounts exist.

**Steps:**
1. Open **Accounts**.
2. Click **"+ Add"**.
3. Enter the name `Cash`.
4. Leave the type as `cash`.
5. Enter `5000` as the opening balance.
6. Click **"Save account"**.
7. Read the new account card.
8. Click the card.
9. Change the name to `Pocket Cash` and the opening balance to `6000`.
10. Click **"Save changes"**.
11. Open the card's **⋯** menu and choose **"Delete"**.
12. Click **"Delete"** in the confirmation.

**Test Data:** Name `Cash` → `Pocket Cash`; opening balance `5000` → `6000`.

**Expected Result:**
- Step 6 returns to the Accounts list. No toast is shown — the save is a silent redirect.
- The card shows the name `Cash`, the type label **Cash**, a wallet icon and **"Balance ৳ 5,000"**. It renders **no secondary row at all** — see the known gap below.
- Step 10 returns to the list. The card now reads **"Balance ৳ 6,000"**, and the edit screen's sub-line reads **"Changes apply to this account only."**
- Step 12 removes the card, the count line updates, and no error banner appears.
- *Known gap:* PRD §9.14 and the previous plan expected a toast on account add/edit. The build produces no toast on either — only a silent redirect.
- *Known gap:* a **brand-new** account card renders **no delta line and no last-activity line at all** — the card guards the whole secondary row with `(delta !== 0 || last)`, and a new account has neither. The **"— no change"** / **"no activity yet"** pair is therefore never visible on a brand-new account.
- *Known gap:* **editing the opening balance never produces a "↑ ৳ 1,000 vs opening" delta.** The delta is `balance − openingBalance`, and the edit changes the opening balance *and* the balance by the same amount, so the delta stays **0** — and with no transactions the secondary row is not rendered at all. A "vs opening" delta can only appear once a transaction moves money.

**Automation:** `test/e2e/ui_tests/accounts.spec.ts` → "FIN-A01 Account lifecycle"

### FIN-A02: Account types table sweep

**Type:** Positive · **Priority:** Medium

**Precondition:** No accounts exist.

**Steps:**
1. Open the account add form.
2. Open the **Type** dropdown and read every option.
3. Create one account of each type from the list in Test Data.
4. Compare the five resulting cards.

**Test Data:** One account per type, all named `Cash`, `Main Bank`, `bKash`, `Visa Card`, `Other Account`.

**Expected Result:**
- The dropdown offers exactly five options, rendered lowercase: `cash`, `bank`, `mobile wallet`, `card`, `other`.
- The list cards render Title Case labels: **Cash**, **Bank Account**, **Mobile Wallet**, **Card**, **Other** — the dropdown/card casing difference is by design.
- Each type carries a distinct icon — wallet, classical bank with columns, phone-with-card, credit card, 3×3 dot grid — and a distinct tone: gold, sage, blue, red, neutral.
- There is no colour picker; the tone follows the type automatically.
- *Known gap:* PRD §9.3 specifies the fifth type as **Savings Account**. The build ships **Card** instead. The **Savings Account** option does not exist.

**Automation:** `test/e2e/ui_tests/accounts.spec.ts` → "FIN-A02 Account types table sweep"

### FIN-A03: Account validation table sweep

**Type:** Negative · **Priority:** High

**Precondition:** The app is running; for row 4, at least one account already exists.

**Steps:**
1. Open **"+ Add"** and leave **Name** empty; enter an opening balance; observe **"Save account"**.
2. In the same form, set **Opening balance** to `-500`.
3. Clear **Name** and clear **Opening balance**; click **"Save account"**.
4. Open an existing account for editing, clear its **Opening balance** field.
5. In the add form, leave **Name** empty and use the browser devtools to enable the disabled **"Save account"** button; click it.

**Test Data:** Opening balance `-500`; empty name.

**Expected Result:**
- Row 1 — **"Save account"** is disabled. Row 5 (bypassing the disabled button) raises a banner with what **"Account name is required"**, why **"Accounts without a name cannot be identified in lists or transactions."**, and fix `Enter a name (e.g. "Cash", "Main Bank").`
- Row 2 — the inline error **"Amount must be zero or greater."** appears under the field, the field carries a danger border, and **"Save account"** is disabled.
- Row 3 — the account is created with a balance of **৳ 0**.
- Row 4 — the inline error **"Amount must be zero or greater."** appears; an empty opening balance is rejected on edit but allowed on add.
- Every banner states what went wrong, why it matters and how to fix it.

**Automation:** `test/e2e/ui_tests/accounts.spec.ts` → "FIN-A03 Account validation table sweep"

### FIN-A04: An account with linked transactions cannot be deleted

**Type:** Negative · **Priority:** High

**Precondition:** An account named `Cash` has at least three transactions referencing it.

**Steps:**
1. Open **Accounts**.
2. Open the **⋯** menu on the `Cash` card and choose **"Delete"**.
3. Click **"Delete"** in the confirmation.

**Test Data:** Account `Cash` with 3 linked transactions.

**Expected Result:**
- The account is **not** deleted and its card is still on screen.
- A banner appears with what `Can't delete "Cash"`, why **"3 transaction(s) still reference this account."**, and fix **"Delete the linked transactions first, or archive them."**
- *Known gap:* no archive feature exists, so the suggested fix is not actionable. The banner also renders with *info* styling rather than a danger tone, so a blocked destructive action reads as non-blocking.

**Automation:** `test/e2e/ui_tests/accounts.spec.ts` → "FIN-A04 An account with linked transactions cannot be deleted"

### FIN-A05: First-run empty states and the learn-more overlay

**Type:** Positive · **Priority:** Medium

**Precondition:** A fresh install with no accounts, transactions or goals.

**Steps:**
1. Open **Accounts** and read the empty state.
2. Click **"How accounts work →"**; read the modal; close it with the **×**.
3. Open the overlay again and close it with **"Got it"**.
4. Open it a third time and press **Escape**.
5. Open it a fourth time and click the backdrop.
6. Open **Transactions** and click **"How transactions work →"**.
7. Open **Goals** and click **"How goals work →"**.
8. On Home, open the empty **Accounts** card and the empty **Transactions** card and check their learn-more links.

**Test Data:** None.

**Expected Result:**
- Accounts shows a 96×96 muted SVG illustration (60% opacity, no emoji), the title **"No accounts yet"**, the description *"Open an account for cash, a bank, a wallet, or a card. Each account tracks what's there now."*, a primary CTA **"+ Add your first account"** and a **"How accounts work →"** link.
- Transactions shows **"No transactions yet"** / *"Record income, expenses, or transfers. Each one updates the account it touches."* with the CTA **"+ Add transaction"** and a **"How transactions work →"** link.
- Goals shows **"Save toward something"** / *"Set a target amount and a date. We'll tell you how much to save each month."* with the CTA **"+ New goal"** and a **"How goals work →"** link.
- Home reuses the same empty state for its Accounts and Transactions cards, including the learn-more links.
- The overlay opens as a 480px modal with a blurred backdrop, titled **"How accounts work"**, **"How transactions work"** or **"How goals work"**, and carries the matching explainer copy.
- All four dismissal paths work: **×**, **"Got it"**, **Escape** and the backdrop. The backdrop is a full-bleed button labelled *"Close dialog"*.
- *Known gap:* the Debts and Investments empty states do **not** use the shared component — they are plain **"No debts yet."** / **"No investments yet."** text with no illustration, no CTA and no learn-more link. The asymmetry is deliberate in the code but inconsistent in the UI.
- *Known gap:* Home does **not** reuse the Accounts/Transactions copy. Its empty Accounts card reads **"Add an account to track balances, transactions, and net worth."** with the CTA **"+ Add an account"**, and its empty Transactions card reads **"+ Add a transaction"** — both differ from the list screens' descriptions and CTAs quoted above. Only the titles and the learn-more links match.

**Automation:** `test/e2e/ui_tests/accounts.spec.ts` → "FIN-A05 First-run empty states and the learn-more overlay"

### FIN-A06: Account balance, delta line and last-activity metadata

**Type:** Positive · **Priority:** High

**Precondition:** `Main Bank` has an opening balance of 120000; it has received an income of 60000 and an expense of 18000, and 3000 was transferred out of it.

**Steps:**
1. Open **Accounts**.
2. Read the `Main Bank` card's balance.
3. Read the card's secondary line.
4. Read the balance on a second account that has no transactions.

**Test Data:** `Main Bank` opening 120000, +60000 income, −18000 expense, −3000 transfer out.

**Expected Result:**
- The balance reads **৳ 1,59,000** — 120000 + 60000 − 18000 − 3000.
- The secondary line shows **"↑ ৳ 39,000"** followed by **" vs opening"**, plus the last-activity date (**"Today"** / **"Yesterday"** / **"3d ago"** / **"25 Aug 2026"**) and, where applicable, the note or category name.
- The account with no activity shows **"no activity yet"** and **"— no change"**.
- *Known gap:* the **"no activity yet"** / **"— no change"** pair is **unreachable**. The secondary row renders only when `(delta !== 0 || last)`, and a non-zero delta requires a transaction, which always yields a `last` date — so the branch that prints *"no activity yet"* can never be reached. An account with **no** transactions renders **no secondary row at all**; the pair appears only on an account whose movements **offset each other** (net delta 0, but with activity), where it reads **"— no change"** next to the activity date.
- *Known gap:* the delta is **৳ 39,000**, not ৳ 42,000 — the 3000 transferred out of the account counts against the balance, and the previous figure omitted it.
- Amounts use the BDT sign, a space, and en-IN grouping — **৳ 1,59,000**, never **৳ 1,590,000**.

**Automation:** `test/e2e/ui_tests/accounts.spec.ts` → "FIN-A06 Account balance, delta line and last-activity metadata"

### FIN-A07: Cancelling a destructive confirmation changes nothing

**Type:** Negative · **Priority:** Medium

**Precondition:** An account named `Cash` exists with no linked transactions.

**Steps:**
1. Open **Accounts**, open the **⋯** menu on the `Cash` card and choose **"Delete"**.
2. Press **Escape**.
3. Repeat: open **"Delete"**, then click **"Cancel"**.
4. Repeat: open **"Delete"**, then click the backdrop.

**Test Data:** None.

**Expected Result:**
- Each of the three exits closes the dialog and leaves the account on screen.
- The account count is unchanged.
- No banner or toast is raised by a cancelled confirmation.

**Automation:** `test/e2e/ui_tests/accounts.spec.ts` → "FIN-A07 Cancelling a destructive confirmation changes nothing"

### Transactions

### FIN-T01: Income, expense and transfer lifecycle

**Type:** Positive · **Priority:** High

**Precondition:** Accounts `Cash`, `Main Bank` and `bKash` exist.

**Steps:**
1. Click **"+ Add transaction"** and choose **Income**.
2. Enter `60000`, choose the category `Salary`, choose the account `Main Bank`, and save.
3. Click **"+ Add transaction"** and choose **Expense**.
4. Enter `1200`, choose the category `Groceries`, choose the account `Cash`, and save.
5. Click **"+ Add transaction"** and choose **Transfer**.
6. Enter `3000`, set **From** to `Cash` and **To** to `bKash`, and save.
7. Read the three rows in the Transactions list.
8. Read the balance of `Main Bank`, `Cash` and `bKash` on **Accounts**.

**Test Data:** Income 60000 / Salary / Main Bank · Expense 1200 / Groceries / Cash · Transfer 3000 Cash → bKash.

**Expected Result:**
- `Main Bank` gains ৳60,000; `Cash` loses ৳1,200 and ৳3,000; `bKash` gains ৳3,000.
- The row subtitles read `Main Bank · Salary`, `Cash · Groceries` and `Transfer · Cash → bKash`.
- Each save raises a toast — **"Transaction added"** / *"Your record is now in the transactions list."* — and the app returns to the Transactions list.
- Amounts render as **"৳ 3,500"** — BDT sign, a space, en-IN grouping — with **no** `+`/`−` sign; direction is conveyed by colour and an arrow.

**Automation:** `test/e2e/ui_tests/transactions.spec.ts` → "FIN-T01 Income, expense and transfer lifecycle"

### FIN-T02: List filters, grouping and ordering

**Type:** Positive · **Priority:** High

**Precondition:** Seed data is present, including at least one transfer, one investment payout and one debt payment.

**Steps:**
1. Open **Transactions** and read the header count.
2. Click each filter chip in turn: **All**, **Income**, **Expense**, **Transfer**, **Payouts**, **Debt payments**, **This month**, **Cash**.
3. Click the active chip again.
4. Apply a filter that matches nothing.
5. Read the list under **All** and then under a non-**All** filter.

**Test Data:** None.

**Expected Result:**
- **All** matches everything and groups rows under sticky day headers (for example **"25 Aug 2026"**); **Income** / **Expense** / **Transfer** match on the transaction type; **Payouts** matches a transaction linked to an investment; **Debt payments** matches a transaction linked to a debt; **This month** matches the current calendar month; **Cash** matches transactions touching an account **named exactly** `Cash` — a name match, not a type match.
- Exactly one chip is active at a time; clicking the active chip resets to **All**.
- Any filter other than **All** renders a flat list with no date subheaders.
- A filter with no matches shows **"No transactions match this filter. Try a different filter, or add a new transaction."**
- Ordering is date-descending and is not user-controllable.
- The header shows only a count — **"7 entries"** or **"3 of 7 entries"** — with no income/expense/net totals.
- *Known gap:* PRD §9.2 does not promise a totals row, but the previous plan expected one; there is no totals summary, no search, and no category / account / date filter or sort control. Only the eight chips exist.

**Automation:** `test/e2e/ui_tests/transactions.spec.ts` → "FIN-T02 List filters, grouping and ordering"

### FIN-T03: Amount validation and presets

**Type:** Negative · **Priority:** High

**Precondition:** The Add transaction form is open on the Expense type.

**Steps:**
1. Enter each of the invalid amounts in turn and observe the field and the **Save** button.
2. Enter each of the valid amounts in turn.
3. Read the helper line and the preset chips.
4. Read the placeholder.
5. Bypass the disabled **Save** button with an invalid amount and submit.

**Test Data:** Invalid — `""`, `0`, `0.0`, `-250`, `abc`, `NaN`, `Infinity`, a single space. Valid — `250`, `12.50`, `2.5e2`, `0250`.

**Expected Result:**
- Every invalid amount raises the inline error **"Amount must be greater than zero."** and disables **Save**. Bypassing the disabled button raises a banner with what **"Amount must be greater than zero"**, why *"Zero or negative amounts produce empty transactions."*, and fix **"Enter a positive number, e.g. 1500."**
- Every valid amount is accepted, including the decimal, the exponent and the leading-zero forms.
- The helper reads **"Tap a preset chip to autofill common amounts."** and the chips are **৳ 50**, **৳ 100**, **৳ 250**, **৳ 500**, **৳ 1,000** — on the expense form only.
- The placeholder is `250` for expense, `60,000` for income and `5,000` for transfer.
- The input carries no **৳** prefix.

**Automation:** `test/e2e/ui_tests/transactions.spec.ts` → "FIN-T03 Amount validation and presets"

### FIN-T04: Category picker

**Type:** Positive · **Priority:** Medium

**Precondition:** The Add transaction form is open on the Expense type.

**Steps:**
1. Expand the category list and read the group headings.
2. Expand it a second time and read the toggle button.
3. Select a category.
4. Clear the selected category.
5. Switch the type to Income and read the category list.
6. Look for a search field.
7. Save the form with no category selected and read the resulting row title.

**Test Data:** None.

**Expected Result:**
- The expense picker is a grouped chip cloud whose first group is **"Housing"** only, with a button **"Show all 35 categories"** that expands every group inline and becomes **"Hide list"**.
- The groups are **Housing**, **Utilities & bills**, **Daily life**, **Family & health**, **Giving & saving**, **Fun & occasions**.
- The income picker is flat with all five visible — **Salary**, **Freelance**, **Business**, **Gift**, **Other Income**.
- The picker is **not searchable**.
- A selected category shows **"Selected"** plus a pill with a **×** whose accessible name is **"Clear selected category"**. Clicking the chip again does **not** deselect it.
- Saving with no category is allowed and the row title falls back to the type name.
- *Known gap:* PRD §9.4 promises category create, rename and delete. No such UI exists; the only category mutation is the additive **"Restore default categories"** recovery button on the form.

**Automation:** `test/e2e/ui_tests/transactions.spec.ts` → "FIN-T04 Category picker"

### FIN-T05: Transfer specifics

**Type:** Positive · **Priority:** High

**Precondition:** At least two accounts exist (`Cash`, `bKash`). For the last step, use a separate profile that contains exactly one account.

**Steps:**
1. Open **"+ Add transaction"** and choose **Transfer**.
2. Read the fields on the form.
3. Open the **To** dropdown with **From** set to `Cash`.
4. Enter `1000` and read the balance projections.
5. Enter a zero or negative amount and observe **Save**.
6. On the single-account profile, open the transfer form and read the **To** dropdown.

**Test Data:** From `Cash`, To `bKash`, amount `1000`; then amount `0`.

**Expected Result:**
- The form has two selects, **From** and **To**, with a large left-right arrow between them, and a positive-amount **Amount** field.
- The **From** account is removed from the **To** options, so the form can never hold a "from X to X" state.
- There is **no Date, no Note, no Category, no Debt and no Investment** field on the transfer form.
- The projections read **"Balance: ৳ 5,000 → projected balance after save: ৳ 4,000"** for `Cash` and **"Balance: ৳ 2,500 → projected balance after save: ৳ 3,500"** for `bKash`.
- A zero or negative amount disables **Save**.
- On the single-account profile the **To** dropdown offers no option and no identical-source transfer can be saved — the domain layer rejects it with *"Transfer source and destination must differ."*
- *Known gap:* PRD §9.2 lists Amount, Date and Note as common fields for every transaction. The transfer form omits Date and Note entirely, so a transfer cannot be dated or annotated.

**Automation:** `test/e2e/ui_tests/transactions.spec.ts` → "FIN-T05 Transfer specifics"

### FIN-T06: The edit form differs from the add form and the type is locked

**Type:** Positive · **Priority:** Medium

**Precondition:** At least one transaction of each type exists.

**Steps:**
1. Open a transaction's edit form.
2. Compare it field by field with the corresponding add form.
3. Try to change the transaction type.
4. Read the note field's label and hint.
5. Read the delete control and the cancel control.
6. Click **"Cancel"** and read where you land.

**Test Data:** None.

**Expected Result:**
- The edit form has **no** preset chips and **no** balance or projection lines.
- The category label reads **"Category"** with no "(optional)" suffix.
- The note label reads **"Note"** with the hint *"Add or change a note. Leave blank to remove."*
- A **"🗑 Delete"** button is present.
- There is **no type selector** — the type is locked and cannot be changed.
- **"Cancel"** returns to the Transactions list; **"Cancel"** on the *add* form returns to the type picker instead.

**Automation:** `test/e2e/ui_tests/transactions.spec.ts` → "FIN-T06 The edit form differs from the add form and the type is locked"

### FIN-T07: Editing a transaction recalculates balances and totals

**Type:** Positive · **Priority:** High

**Precondition:** An expense of ৳1,200 exists against `Cash`, whose opening balance is ৳5,000.

**Steps:**
1. Open the expense for editing and change the amount to `1500`.
2. Click **"Save changes"**.
3. Read the balance of `Cash` on **Accounts**.
4. Read the **This month** card on Home.
5. Reopen the transaction and delete it.
6. Read the balance of `Cash` again.

**Test Data:** Expense amount 1200 → 1500.

**Expected Result:**
- Step 2 raises a toast **"Transaction saved"** / *"Your changes are now in your records."*
- `Cash` reads **৳ 3,500** after the edit — 5000 − 1500 — so the balance is recalculated, not appended to.
- The Home **"This month"** card reflects the new expense figure.
- After the delete the balance is restored to **৳ 5,000**.
- The delete raises a banner **"Transaction deleted"** / *"The entry is gone from your records."* / *"Open Transactions to see the updated list."*

**Automation:** `test/e2e/ui_tests/transactions.spec.ts` → "FIN-T07 Editing a transaction recalculates balances and totals"

### FIN-T08: Deleting a transaction is confirmed and permanent

**Type:** Positive · **Priority:** Medium

**Precondition:** At least one transaction exists.

**Steps:**
1. Open the transaction and click **"🗑 Delete"**.
2. Read the confirmation.
3. Click **"Delete"**.
4. Reopen the same transaction's URL.

**Test Data:** None.

**Expected Result:**
- The confirmation reads **"Delete this entry?"** with the body *"This permanently removes this transaction from your records. This cannot be undone."*
- Confirming removes the row from the Transactions list and raises the **"Transaction deleted"** banner.
- The transaction's URL now renders the not-found state — the entry is gone, not merely hidden.

**Automation:** `test/e2e/ui_tests/transactions.spec.ts` → "FIN-T08 Deleting a transaction is confirmed and permanent"

### FIN-T09: Linking an expense to a debt

**Type:** Positive · **Priority:** High

**Precondition:** An active debt `Loan from Rahim` of ৳20,000 with ৳5,000 already paid exists.

**Steps:**
1. Open **"+ Add transaction"** and choose **Expense**.
2. Open the **Linked debt (optional)** dropdown.
3. Select `Loan from Rahim`.
4. Read the line beneath the dropdown.
5. Enter `2000`, pick an account, and save.
6. Open the debt and read its paid figure.

**Test Data:** Expense 2000 linked to `Loan from Rahim`.

**Expected Result:**
- The dropdown offers **"— None —"** alongside the active debts, with the hint *"Tag this transaction as a payment toward a debt."*
- Selecting the debt shows a **"Remaining: ৳ 15,000"** line.
- Saving creates an Expense transaction tagged to the debt; the account balance drops by ৳2,000.
- The debt's paid figure rises to ৳7,000 and its remaining amount falls to ৳13,000 — the paid total is derived from the linked transactions, never typed by the user.

**Automation:** `test/e2e/ui_tests/transactions.spec.ts` → "FIN-T09 Linking an expense to a debt"

### FIN-T10: Linking an income to an investment, and the payout-account mismatch warning

**Type:** Positive · **Priority:** High

**Precondition:** An active FDR `DBBL 1-year FDR` of ৳100,000 at 9% for 12 months exists, with its payout account set to `Main Bank`.

**Steps:**
1. Open **"+ Add transaction"** and choose **Income**.
2. Open the **Linked investment (optional)** dropdown and select `DBBL 1-year FDR`.
3. Read the account field and the projection line.
4. Change the account to `Cash`.
5. Save.
6. Open the Add transaction form again, select a linked debt, and check the investment dropdown.

**Test Data:** None.

**Expected Result:**
- Step 2 shows the hint *"Selecting one routes the money to that payout account."* and a **"Current value (projection): ৳ 1,00,000"** line (for DPS, *"Current value (projection): ৳ N"*; for FDR/savings, *"At maturity (projection): ৳ 1,09,000"*).
- Step 3 shows the account field auto-switched to the payout account `Main Bank`.
- Step 4 raises a non-blocking amber warning headed **"Heads up:"** — *"payout account for DBBL 1-year FDR is Main Bank. You're sending this income to Cash. Saving will record the payout as Income to Cash, not Main Bank."* — and the save is still permitted.
- Step 6 confirms the two links are mutually exclusive: choosing a debt clears the investment and choosing an investment clears the debt.
- *Known gap:* the linked-debt dropdown exists on the **add income** form but is **missing on the edit income** form — an add/edit parity break.

**Automation:** `test/e2e/ui_tests/transactions.spec.ts` → "FIN-T10 Linking an income to an investment, and the payout-account mismatch warning"

### FIN-T11: Amount formatting and row anatomy

**Type:** Positive · **Priority:** Medium

**Precondition:** Transactions with amounts of 3500 and 1234567 exist.

**Steps:**
1. Open **Transactions** and read the two rows.
2. Read the day header above the rows.
3. Read the date and category of each row.

**Test Data:** Amounts 3500 and 1234567.

**Expected Result:**
- The amounts render as **৳ 3,500** and **৳ 12,34,567** — en-IN grouping, so the lakh grouping is used, not the western `1,234,567`.
- Rows are grouped under a day header formatted as **"25 Aug 2026"**.
- Each row shows its category (or the type name when no category is set) and the account it touches.

**Automation:** `test/e2e/ui_tests/transactions.spec.ts` → "FIN-T11 Amount formatting and row anatomy"

### FIN-T12: An account may hold a negative balance

**Type:** Edge · **Priority:** Medium

**Precondition:** `Cash` has an opening balance of ৳1,000.

**Steps:**
1. Record an expense of ৳2,500 against `Cash`.
2. Read the balance of `Cash` on **Accounts**.
3. Read the balance on the Home **"Cash"** tile.
4. Delete the expense.

**Test Data:** Expense 2500 against an account with a 1000 opening balance.

**Expected Result:**
- `Cash` shows **৳ -1,500** — a negative balance is permitted and displayed, not clamped to zero and not blocked at entry.
- The Home **"Cash"** tile reports the same signed figure.
- Deleting the expense restores the balance to ৳ 1,000.
- The net-worth figure on Home is correspondingly lower while the balance is negative.

**Automation:** `test/e2e/ui_tests/transactions.spec.ts` → "FIN-T12 An account may hold a negative balance"

### Goals

### FIN-G01: Goal lifecycle

**Type:** Positive · **Priority:** High

**Precondition:** No goals exist.

**Steps:**
1. Open **Goals** and click **"+ New goal"**.
2. Enter the name `Emergency fund`, **Already saved** `10000`, **Target** `50000`, **Target date** `2027-06-30`, and save.
3. Read the goal card.
4. Open the goal and click **"+ Add a contribution"**.
5. Enter `5000` with the note `December saving` and save.
6. Open the goal, change the target to `60000`, and save.
7. Remove the contribution.
8. Delete the goal.

**Test Data:** Name `Emergency fund`; already saved 10000; target 50000 → 60000; date 2027-06-30; contribution 5000, note `December saving`.

**Expected Result:**
- The card reads **"৳ 10,000 / ৳ 50,000"**, **"by 30 Jun 2027"**, a 20% bar, **"Need ৳ 40,000 more"** and **"৳ 10,000/mo"**.
- The contribution modal is titled **"Add a contribution"** with the sub-line *"Records the amount you've set aside toward this goal. Your account balance is not changed."* and the fields **Amount**, **Date** and **Note (optional)**. Escape and a backdrop click both close it **without** recording.
- Step 5 raises the banner **"৳ 5,000 toward Emergency fund"** / *"Saved as a plan entry — your account balance is unchanged."* / *"Saved is now ৳ 15,000 of ৳ 50,000."*
- Step 6 raises **"Goal updated"** and shows the amber **"Heads up:"** note *"the 'saved so far' figure above is the sum of your contributions. Editing this goal doesn't change that — add or remove a contribution instead."*
- Step 7 asks **"Remove this contribution?"** and then raises **"Contribution removed"**.
- Step 8 asks **"Delete this goal?"** and raises **"Goal deleted"** / *"Your accounts and transactions were not touched."*

**Automation:** `test/e2e/ui_tests/goals.spec.ts` → "FIN-G01 Goal lifecycle"

### FIN-G02: Goal validation and status states

**Type:** Negative · **Priority:** High

**Precondition:** The Add goal form is open.

**Steps:**
1. Leave **Name** empty and try to save.
2. Enter `0` as the **Target**, then `-1`.
3. Leave **Already saved** empty.
4. Leave **Target date** empty and try to save.
5. Enter a target date in the past and save.
6. Create a goal, then contribute until the saved amount reaches the target.
7. Create a second goal whose target date has passed, and save it.

**Test Data:** Target `0`, then `-1`; target date `2020-01-01` for the past-date case.

**Expected Result:**
- Row 1 — the save is disabled; bypassing it raises **"Goal name is required"** / *"Goals without a name cannot be tracked."* / `Enter a name (e.g. "Emergency fund").`
- Row 2 — the inline error **"Amount must be greater than zero."** appears.
- Row 3 — the inline error **"Amount must be zero or greater."** appears; an empty "Already saved" is invalid, so the field is effectively required.
- Row 4 — the save is disabled; bypassing it raises **"Target date is required"** / *"Goals without dates cannot compute the per-month requirement (R5)."* / *"Pick a date in the future."*
- Row 5 — the goal is **accepted**. No future-date validation exists even though the fix text says "Pick a date in the future."
- Row 6 — the card reads **"Goal reached. Nice."**, the detail screen shows **"Goal reached. ৳ 50,000 saved · target ৳ 50,000"**, **"+ Add a contribution"** is hidden and **"Required per month"** reads **"— done —"**.
- Row 7 — the pace reads **"Overdue"**, the detail screen shows **"Target date passed. Either extend it or close the goal."** and **"Required per month"** reads **"— past due —"**.
- *Known gap:* PRD §9.5 and §15 require the target date to be in the future and the error copy promises "Pick a date in the future" — but no date field anywhere in the app rejects future or past dates.

**Automation:** `test/e2e/ui_tests/goals.spec.ts` → "FIN-G02 Goal validation and status states"

### FIN-G03: Goal pace — ahead, on track and behind

**Type:** Positive · **Priority:** Medium

**Precondition:** Two goals exist with the same target amount and target date; one is saved ahead of the required pace and one behind it.

**Steps:**
1. Open **Goals** and read both cards.
2. Read the percentage chip on each card.
3. Open a goal that is neither complete nor expired and read its pace chip.

**Test Data:** Two goals, target 50000 by 2027-06-30; one with 40000 saved, one with 5000 saved.

**Expected Result:**
- The ahead goal's card reads **"Pace: Ahead"**; the behind goal's reads **"Pace: Behind"**.
- The ahead goal's percentage chip title reads *"62% saved vs target pace"* and the behind goal's reads *"12% saved vs target pace"*.
- On-track, completed and expired goals hide the word "Pace" and show only the percentage chip.

**Automation:** `test/e2e/ui_tests/goals.spec.ts` → "FIN-G03 Goal pace — ahead, on track and behind"

### FIN-G04: A goal contribution never moves an account balance

**Type:** Positive · **Priority:** High

**Precondition:** `Cash` has an opening balance of ৳5,000 and no transactions.

**Steps:**
1. Read the balance of `Cash` on **Accounts**.
2. Create a goal with target 50000 and contribute 5000 to it.
3. Read the balance of `Cash` on **Accounts**.
4. Read the **Transactions** list.
5. Read the Home **"This month"** card.

**Test Data:** Contribution 5000.

**Expected Result:**
- `Cash` still reads **৳ 5,000** before and after the contribution.
- The **Transactions** list is empty — a contribution creates no transaction.
- The Home **"This month"** card shows no expense from the contribution.
- The goal's own saved figure does rise to ৳5,000, so the contribution is recorded — as plan data only.
- This is the load-bearing assertion for R11: a contribution is a plan entry, never a ledger entry.

**Automation:** `test/e2e/ui_tests/goals.spec.ts` → "FIN-G04 A goal contribution never moves an account balance"

### Debts

### FIN-D01: Flat debt lifecycle and its opening transaction

**Type:** Positive · **Priority:** High

**Precondition:** Accounts `Cash` and `Main Bank` exist; no debts exist.

**Steps:**
1. Open **Debts** and click **"+ New debt"**.
2. Enter the name `Loan from Rahim`, the direction **"I owe (you borrowed)"**, the total `20000`, the account `Main Bank`, and the person `Rahim`.
3. Save and read the new card.
4. Open **Transactions** and read the rows.
5. Tap **"Pay now"** on the card, enter `5000`, choose `Main Bank`, add the note `Part payment`, and save.
6. Read the card again and the `Main Bank` balance.

**Test Data:** Name `Loan from Rahim`; total 20000; account `Main Bank`; person `Rahim`; payment 5000, note `Part payment`.

**Expected Result:**
- The card shows the tag **"I owe"**, **"You've paid ৳ 0 of ৳ 20,000"**, **"Owed to Rahim"**, **Remaining** ৳20,000, **"of ৳ 20,000 total"**, a 0% bar and a **"Pay now"** chip.
- Creating the debt auto-creates an **Income** transaction of ৳20,000 noted **"Debt: Loan from Rahim"**, so `Main Bank` gains ৳20,000 and the row appears under the **"Debt payments"** chip.
- The payment modal is titled **"Pay toward "Loan from Rahim""** with **"Outstanding: ৳ 20,000"** and the fields **Amount** (empty, hint *"Enter whatever you paid."*), **Date**, **Paid from** and **Note (optional)**.
- Step 5 raises a toast **"Payment paid — ৳ 5,000"**; `Main Bank` loses ৳5,000 (the gross amount) and the card reads **"You've paid ৳ 5,000 of ৳ 20,000"**, Remaining ৳15,000, 25%.
- *Known gap:* PRD §9.7 states *"Money does NOT auto-move. Creating a debt does not affect account balances."* The build **does** create an opening transaction, so creating a debt moves ৳20,000 into the chosen account. This is the highest-value assertion in the debts area and it contradicts the PRD.

**Automation:** `test/e2e/ui_tests/debts.spec.ts` → "FIN-D01 Flat debt lifecycle and its opening transaction"

### FIN-D02: Loan-kind debt and the interest/principal split

**Type:** Positive · **Priority:** High

**Precondition:** Accounts exist; no debts exist.

**Steps:**
1. Open **"+ New debt"**.
2. Set the direction **"I owe"**, the total `60000`, tick **"Is this a loan with interest?"**, set the rate `12` and the term `36`, pick `Main Bank`, and save.
3. Read the card.
4. Tap **"Pay now"** and read the pre-filled amount and the split preview.
5. Save the payment and read the toast and the card.
6. Pay a second time with an amount smaller than one month's interest.
7. Read the outstanding on the card.

**Test Data:** Total 60000, rate 12%, term 36 months; first payment at the standard EMI; second payment `500`.

**Expected Result:**
- The card shows a **"Loan"** pill, **"12% APR · 36mo"**, **"Loan amount ৳ 60,000"**, **"Paid ৳ 0 interest and ৳ 0 principal"** and **"Monthly EMI"**.
- The payment modal pre-fills the standard EMI, with the hint *"Pre-filled with the standard EMI for 36-month term. Adjust if you paid a different amount."*, and shows **"This payment will be split as:"** followed by *"৳ N interest · ৳ N principal"*.
- The toast reads **"Payment paid — ৳ {interest} interest, ৳ {principal} principal"** / *"Outstanding reduced from ৳ X to ৳ Y."*
- The account balance moves by the **gross** amount; the outstanding drops by the **principal** portion only. Only the gross transaction is stored — the split is derived.
- Step 6 shows the chip **"Underpayment — this didn't cover the month's interest."**, the toast appends *" — underpayment: this didn't cover the month's interest."*, and the outstanding does not reduce.

**Automation:** `test/e2e/ui_tests/debts.spec.ts` → "FIN-D02 Loan-kind debt and the interest/principal split"

### FIN-D03: Debt direction, validation and the detail screen

**Type:** Negative · **Priority:** High

**Precondition:** The Add debt form is open; accounts exist.

**Steps:**
1. Switch the direction to **"Owed to me (you lent)"** and read the form.
2. Leave the name empty and try to save.
3. Enter a total of `0`.
4. Tick the loan toggle, then clear the rate; clear the term.
5. Leave the account unselected.
6. Save an **"Owed to me"** debt of `15000` against `Cash`, with the person `Karim`.
7. Read the Transactions list and the `Cash` balance.
8. Open a saved debt and read the screen.

**Test Data:** Direction **Owed to me**; total 0; total 15000; person `Karim`.

**Expected Result:**
- Step 1 — the loan toggle **disappears entirely** and the rate and term are cleared; the toggle is offered only for **"I owe"**.
- Step 2 — the save is disabled; bypassing it raises **"Debt name is required"** / *"Debts without a name cannot be tracked."* / `Enter a name (e.g. "Loan from a friend").`
- Step 3 — the inline error **"Amount must be greater than zero."** appears.
- Step 4 — the inline errors **"Enter a rate greater than zero."** and **"Enter a term greater than zero."** appear.
- Step 5 — the save is disabled and the field reads **"Pick an account."**
- Step 6 — the card shows **"They've paid ৳ 0 of ৳ 15,000"**, **"Owed by Karim"** and a **"Receive now"** chip.
- Step 7 — an **Expense** opening transaction of ৳15,000 is created, noted **"Debt: Lent to Karim"**, and `Cash` is debited by ৳15,000.
- Step 8 — the card opens the **slip** at `#/debts/:id` — a read-only view with H1 **the debt's name**, the certificate and the activity ledger. Clicking **"Edit"** opens `#/debts/:id/edit` with H1 **"Edit debt"**. There is **no account picker** on the edit screen, and saving raises a **toast** (not a banner) **"Debt updated"** / *"Changes are saved."* The save returns to the slip.

**Automation:** `test/e2e/ui_tests/debts.spec.ts` → "FIN-D03 Debt direction, validation and the detail screen"

### FIN-D04: Debt delete semantics, auto-completion and direction flip

**Type:** Negative · **Priority:** High

**Precondition:** A flat debt `Loan from Rahim` (**I owe**, ৳20,000) with one linked payment of ৳5,000 exists; a second debt with no payments exists.

**Steps:**
1. Open the debt with the linked payment, click **"Delete debt"**, and confirm.
2. Inspect the surviving linked transaction in **Transactions** and read its tag.
3. Open the payment-free debt, change the direction from **"I owe"** to **"Owed to me"**, and save.
4. Record a payment equal to the remaining total of a third debt.
5. Look for any way to record a further payment against the now-completed debt.

**Test Data:** Payment equal to the exact remaining total in step 4.

**Expected Result:**
- Step 1 — the debt record is **removed outright** and the linked transaction **stays in the ledger**, still carrying its debt link.
- Step 2 — the orphaned repayment row falls back to the generic **"Debt received"** tag, so an *I owe* **payment** is labelled "Debt received".
- Step 3 — the save is **not** gated behind any confirmation, and `paid_so_far` re-derives against the new polarity; the before/after **"X% paid"** and **Remaining** figures change accordingly.
- Step 4 — the debt auto-completes: it leaves the active grid and appears under **"Completed (n)"** as *"{total} paid off"* with the person and the most-recently-used account.
- Step 5 — the **"Pay now"** chip renders only for an active debt, so no payment path is offered; there is no message explaining why.
- *Known gaps:* PRD §8.14 and §15 require a **soft-archive** — the debt must survive with `status = 'archived'` — and an **"Archived debt"** tag on its surviving transactions. The build performs a hard delete with no archived tag. PRD §15 requires *"linked transactions flip from Expense → Income or vice-versa with explicit confirmation"*; there is no confirmation. PRD §11 expects *"This debt is fully paid. Unarchive it first if this is a mistake."* and §8.15 expects a *"City Bank loan paid off. Nice."* toast — neither string exists.

**Automation:** `test/e2e/ui_tests/debts.spec.ts` → "FIN-D04 Debt delete semantics, auto-completion and direction flip"

### FIN-D05: Debt activity feed and summary card

**Type:** Positive · **Priority:** Medium

**Precondition:** A debt has at least three payments, one of which was recorded on a loan-kind debt.

**Steps:**
1. Open the debt and read the **Activity** card.
2. Read the **Summary** card.
3. Open a debt with no payments.

**Test Data:** Three payments on one debt.

**Expected Result:**
- The **Activity** card shows the stats **"Payments"**, **"Total paid"** and **"Last payment"**, with rows newest first tagged **"Payment"**, **"Received"**, **"Reversal"** or **"Adjust"**; each row reads `{TAG} · {date}` on the left with the amount on the right and the account plus note on the second line.
- A loan-kind row adds *"৳ N int · ৳ N princ"*.
- The footer reads **"Payments you make toward this debt. Recorded as expenses tagged with this debt — usually via Add transaction → Expense."**
- The **Summary** card shows **"You owe"** in the danger tone and **"Owed to you"** in the primary tone, each with **"Across N debt(s)"**, plus a **"How it works:"** footer.
- The **Summary** card is hidden when nothing is outstanding.
- The **Activity** card is shown only when payments exist.

**Automation:** `test/e2e/ui_tests/debts.spec.ts` → "FIN-D05 Debt activity feed and summary card"

### FIN-D06: A payment larger than the outstanding is not blocked

**Type:** Negative · **Priority:** Medium

**Precondition:** A flat debt of ৳20,000 exists with ৳0 paid.

**Steps:**
1. Tap **"Pay now"**.
2. Enter `25000` — more than the ৳20,000 outstanding — and save.
3. Read the card and the debt's paid figure.

**Test Data:** Payment 25000 against a 20000 outstanding.

**Expected Result:**
- The payment is accepted and the toast confirms it.
- The debt's paid figure reads ৳25,000 and the outstanding reads ৳0; the debt auto-completes.
- *Known gap:* PRD §11 specifies the error *"This is more than what's left (৳ X). Reduce the amount."* and PRD §15 lists "Debt payment that exceeds remaining (block with helpful error)" as a must-handle edge case. No such validation exists — the overpayment is silently accepted.

**Automation:** `test/e2e/ui_tests/debts.spec.ts` → "FIN-D06 A payment larger than the outstanding is not blocked"

### FIN-D07: Receiving a repayment on an owed-to-me debt

**Type:** Positive · **Priority:** High

**Precondition:** A debt `Lent to Karim` (**Owed to me**, ৳15,000) exists.

**Steps:**
1. Open **"+ Add transaction"** and choose **Income**.
2. Open the **Linked debt (optional)** dropdown.
3. Select `Lent to Karim`.
4. Enter `5000`, choose the account `Cash`, and save.
5. Read the debt card and the `Cash` balance.

**Test Data:** Income 5000 linked to `Lent to Karim`.

**Expected Result:**
- The dropdown offers only debts with the **"Owed to me"** direction.
- The linked line reads **"Remaining: ৳ 10,000"** after the payment is applied — the remaining figure falls by the linked amount.
- The card reads **"They've paid ৳ 5,000 of ৳ 15,000"** with the progress bar at 33%.
- `Cash` gains ৳5,000 — a repayment is income, so the receiving account is credited.

**Automation:** `test/e2e/ui_tests/debts.spec.ts` → "FIN-D07 Receiving a repayment on an owed-to-me debt"

### Investments

### FIN-I01: FDR lifecycle

**Type:** Positive · **Priority:** High

**Precondition:** The account `Main Bank` exists; no investments exist.

**Steps:**
1. Open **"+ New investment"**.
2. Enter the name `DBBL 1-year FDR`, choose the type **"FDR (lump-sum, fixed term)"**, the principal `100000`, the rate `9`, today's date, the term `12`, the account `Main Bank`, the institution `DBBL`, and save.
3. Read the card.
4. Open the investment and read the money card.
5. Tap **"Record bank payout"**.
6. Delete the investment and confirm.

**Test Data:** Name `DBBL 1-year FDR`; type FDR; principal 100000; rate 9; term 12 months; institution `DBBL`.

**Expected Result:**
- The card shows the **"FDR"** pill, **"9% · 12mo · DBBL"**, **"Principal ৳ 1,00,000"**, **"Matures in ~1.0y"**, **"Now"** ৳1,00,000 and **"At maturity"** ৳1,09,000.
- The add form shows the **"Review:"** block: *"You'll receive about"* ৳1,09,000 *"at maturity"* *"(projection — actual payout may differ)"*, plus **"Formula: principal × (1 + rate/100 × termMonths/12). Simple interest, no compounding."**
- The detail screen shows **"Matures on"** and a money card with **"Maturity"**, **"Principal"**, **"Maturity value"**, **"Expected interest"** and **"Rate"**.
- **"Record bank payout"** opens the add-income form with the amount, account and linked investment pre-filled and the note *"maturity payout — DBBL 1-year FDR"*; it is disabled when there is no payout account or the remaining amount is ≤ 0.
- The delete asks **"Delete this investment?"** and raises **"Investment deleted"** / *"Linked contributions remain in your transactions."*

**Automation:** `test/e2e/ui_tests/investments.spec.ts` → "FIN-I01 FDR lifecycle"

### FIN-I02: DPS lifecycle and contribution

**Type:** Positive · **Priority:** High

**Precondition:** The account `Main Bank` exists; no investments exist.

**Steps:**
1. Open **"+ New investment"** and read the form fields.
2. Choose the type **"DPS (monthly installment)"**.
3. Enter the name `Monthly DPS`, the monthly contribution `5000`, the rate `8`, the term `12` and the account `Main Bank`, and save.
4. Read the card.
5. Open the investment and click **"+ Add a contribution"**.
6. Enter `5000` and click **"Record contribution"**.
7. Read the `Main Bank` balance.

**Test Data:** Name `Monthly DPS`; contribution 5000; rate 8; term 12 months.

**Expected Result:**
- For a DPS the **Principal** field is hidden and **Monthly contribution** is shown instead.
- **No money is deducted at creation** — the principal is derived from installment × term and the balance is untouched.
- The card shows the **"DPS"** pill, **"8% · 12mo"**, **"৳ 5,000/mo"**, **"Now"** ৳0 and **"At maturity"** ৳62,665.
- The detail screen explains the split: **"What you have now:"** … *"(compounded to today)"* and **"At maturity:"** … *"(projection if every installment is paid)"*, with **"Maturity uses annuity-due: M × ((1 + r)^T − 1) / r × (1 + r) where r = 8%/12 and T = 12 months."**
- The contribution modal is titled **"Add a contribution"** / *"Records an expense from the chosen account and links it to this DPS."* with the amount placeholder set to the plan amount, a **"From account"** field and **"Note (optional)"**.
- Step 6 raises **"৳ 5,000 toward Monthly DPS"** / *"Recorded as an expense transaction linked to this investment."* and `Main Bank` loses ৳5,000.
- *Known gap:* the detail callout's formula line renders `r = 8%/12` — it substitutes the rate directly into a percent-with-a-percent-sign slot, so the stated formula does not read as a usable formula.

**Automation:** `test/e2e/ui_tests/investments.spec.ts` → "FIN-I02 DPS lifecycle and contribution"

### FIN-I03: Investment validation and variants

**Type:** Negative · **Priority:** High

**Precondition:** The Add investment form is open; accounts exist.

**Steps:**
1. Leave **Name** empty and try to save.
2. Set the principal to `0` on an FDR.
3. Set the monthly contribution to `0` on a DPS.
4. Set the rate to `-1`.
5. Set the rate to `0`.
6. Set the rate to `150`.
7. Set the term to `0`.
8. Tick **"Use days instead of months"**.
9. Switch the type to DPS.
10. Clear the account on an FDR and try to save.
11. Bypass the disabled save on an FDR with no account.

**Test Data:** Principal 0; contribution 0; rate -1, 0, 150; term 0.

**Expected Result:**
- Step 1 — the save is disabled; bypassing it raises **"Investment name is required"** / *"Investments without a name cannot be tracked."* / `Enter a name (e.g. "DPS #1").`
- Steps 2 and 3 — the inline error **"Amount must be greater than zero."** appears and the save is disabled.
- Step 4 — the inline error **"Rate must be a non-negative number."** appears.
- Step 5 — a rate of `0` is **accepted** and the maturity value equals the principal.
- Step 6 — a rate of `150` is **accepted**.
- Step 7 — an inline error appears and the save is disabled.
- Step 8 — **"Term (days)"** replaces **"Term (months)"** and the formula becomes **"Formula: principal × (1 + rate/100 × termDays/365). Simple interest, no compounding."** The checkbox is hidden for a DPS.
- Step 9 — the **Principal** field is hidden.
- Steps 10–11 — the save is disabled; bypassing it raises **"Account is required for FDR and savings"** / *"The principal is deducted from this account on creation — without one, the money would silently appear in both the account and the investment."*
- *Known gaps:* PRD §15 requires the rate to be blocked above 100 with *"Enter a rate between 0 and 100."* — the cap exists only in an unused zod schema and the UI accepts 150. PRD §10 R16 likewise requires exactly one of term-months / term-days; the UI satisfies it only by swapping the field rather than by validating.

**Automation:** `test/e2e/ui_tests/investments.spec.ts` → "FIN-I03 Investment validation and variants"

### FIN-I04: Creating an FDR deducts the principal immediately

**Type:** Positive · **Priority:** High

**Precondition:** `Main Bank` has an opening balance of ৳120,000.

**Steps:**
1. Read the `Main Bank` balance.
2. Create the FDR from FIN-I01 — principal 100000 against `Main Bank`.
3. Read the `Main Bank` balance.
4. Open **Transactions** and read the newest row.

**Test Data:** Principal 100000.

**Expected Result:**
- `Main Bank` drops from ৳1,20,000 to ৳20,000 — the principal leaves the account at creation.
- A linked **Expense** transaction of ৳1,00,000 exists, dated at the start date, noted **"Principal parked in DBBL 1-year FDR"** and categorised **Investment**.
- The transaction appears under the **"Payouts"** filter chip.
- This is the intended behaviour: unlike a debt, an investment's money **does** move on creation, and the opening expense is what makes the balance reflect the locked-up money.

**Automation:** `test/e2e/ui_tests/investments.spec.ts` → "FIN-I04 Creating an FDR deducts the principal immediately"

### FIN-I05: Maturity status, rollover and close

**Type:** Positive · **Priority:** High

**Precondition:** An FDR exists with a maturity date in the past; a DPS exists that has never been paid out.

**Steps:**
1. Open the matured FDR and read its header and status chip.
2. Tap **"Renew for another term"** and confirm.
3. Read the old investment and the new one.
4. Open the DPS and tap **"Mark as done (no payout)"**, then confirm.
5. Read the DPS's status and its list grouping.

**Test Data:** An FDR whose start date plus 12 months is in the past.

**Expected Result:**
- Step 1 — the header shows **"Matured on"** and the chip **"MATURED"**.
- Step 2 — a confirmation **"Roll over into a new term?"** is shown, and after confirming the banner reads **"{name} rolled over"**.
- Step 3 — the old investment's status becomes `rolled_over` (chip **"ROLLED_OVER"**, grouped under **"Closed"**) and the new investment starts **the day after** the old maturity date, with the same principal, rate and term.
- Step 4 — a confirmation **"Close this investment?"** is shown and the banner reads **"{name} closed"**.
- Step 5 — the closed investment sits in the **"Closed"** group; the list count **"{n} total"** includes closed investments, unlike the Debts list.
- The **"Mark as done (no payout)"** button renders only when no payout exists for a DPS, and always for an FDR or savings account.
- *Known gap:* PRD §9.8 requires the rollover confirmation to be **"Roll over"** and the close confirmation to be *"Close this investment without recording a payout?"* — the shipped wording differs from the PRD.

**Automation:** `test/e2e/ui_tests/investments.spec.ts` → "FIN-I05 Maturity status, rollover and close"

### FIN-I06: Current value versus at maturity

**Type:** Positive · **Priority:** Medium

**Precondition:** A DPS with one ৳5,000 installment paid, a 12-month term at 8%, exists alongside an FDR with a ৳100,000 principal at 9% for 12 months.

**Steps:**
1. Open **Investments** and read both rows.
2. Open the DPS and read its money card.
3. Read the Home net-worth tile.
4. Read the **Summary** card on the Investments screen.

**Test Data:** DPS: 5000 contributed, 8%, 12 months. FDR: principal 100000, 9%, 12 months.

**Expected Result:**
- The DPS headline is the **current** value — approximately ৳5,000 — with the projection ৳62,665 shown beneath it and labelled as a projection. The projected value never stands alone.
- The FDR row shows ৳1,00,000 as its headline with **"At maturity"** ৳1,09,000 beneath it; for an FDR with no installments pending the dual line collapses to the single maturity figure.
- The Home net-worth tile shows the same current-vs-projected split.
- The **Summary** card separates the two figures.
- For an investment past its maturity date the current value collapses to the projected value.

**Automation:** `test/e2e/ui_tests/investments.spec.ts` → "FIN-I06 Current value versus at maturity"

### FIN-I07: Recording a maturity payout

**Type:** Positive · **Priority:** High

**Precondition:** A matured FDR of ৳100,000 at 9% for 12 months exists with `Main Bank` as its payout account.

**Steps:**
1. Open the investment and click **"Record bank payout"**.
2. Read the amount, account and note pre-filled on the income form.
3. Change the amount to `108000` — a different figure from the calculated maturity value.
4. Save.
5. Read the account balance and the investment's status.
6. Open the "Mark as done" path for an FDR with the payout recorded.

**Test Data:** Payout amount 108000 against a calculated maturity value of 109000.

**Expected Result:**
- Step 2 — the amount, the account and the linked investment are pre-filled, and the note reads *"maturity payout — DBBL 1-year FDR"*.
- Step 3 — the app accepts a payout that differs from the calculated maturity value, because the bank may pay a different amount.
- Step 4 — the account balance rises by the payout amount, ৳1,08,000.
- Step 5 — for a DPS the status flips to `closed` automatically; for an FDR or savings account the user must tap **"Mark as done (no payout)"** to retire the record, so the investment is still open at this point.
- Step 6 — after closing, the investment leaves the Home **Investments** card but stays in the Investments list under **"Closed"**.

**Automation:** `test/e2e/ui_tests/investments.spec.ts` → "FIN-I07 Recording a maturity payout"

### FIN-I08: Deleting an investment leaves its linked transactions behind

**Type:** Positive · **Priority:** Medium

**Precondition:** An FDR exists with its opening principal expense linked.

**Steps:**
1. Record the `Main Bank` balance.
2. Open the investment, click **"Delete investment"**, and confirm.
3. Read the banner.
4. Read the `Main Bank` balance.
5. Open **Transactions** and look for the principal expense.

**Test Data:** None.

**Expected Result:**
- The confirmation reads **"Delete this investment?"** with the body *"1 linked contribution transactions stay in your records. Only the investment record is removed."*
- The banner reads **"Investment deleted"** / *"Linked contributions remain in your transactions."* / *"Open Home or Transactions to see them."*
- `Main Bank` keeps the reduced balance — the principal expense survives the deletion of the investment, so its balance impact persists.
- The principal expense is still listed in **Transactions**.

**Automation:** `test/e2e/ui_tests/investments.spec.ts` → "FIN-I08 Deleting an investment leaves its linked transactions behind"

### Home and Insights

### FIN-H01: Home reflects the ledger

**Type:** Positive · **Priority:** High

**Precondition:** Seed data is present — 4 accounts, 3+ transactions, one goal, debts and investments.

**Steps:**
1. Open **Home**.
2. Read the H1 and the meta line.
3. Read the net-worth hero and its caption.
4. Read the **"This month"** card.
5. Read the stat strip.
6. Read the **Accounts** and **Recent activity** previews.

**Test Data:** None.

**Expected Result:**
- The H1 reads **"Where is my money?"** and the meta reads **"Net worth · across 4 accounts · updated just now"**.
- The hero shows the net worth with the caption **"vs last month"** and **"Assets minus liabilities"** — or **"Liabilities exceed assets"** when liabilities dominate.
- The **"This month"** card shows **"Income"**, **"Expenses"** and **"Net saved"**.
- The stat strip shows **"Cash"**, **"Receivables"**, **"Debts"** and **"Investments"**, with the empty captions **"No accounts yet"**, **"no money owed to you"**, **"no active debts"** and **"none yet"** when there is nothing to show.
- The **Accounts** preview shows at most 4 accounts with a **"Manage →"** link; **Recent activity** shows at most 4 rows, newest first, with a **"View all"** link; a **"See full Insights →"** affordance closes the screen.
- Net worth is **net**: money I owe is subtracted, money owed to me is added, and the investment figure is the current value — not the projected one.
- *Known gap:* **"updated just now"** is a hard-coded string, not a live timestamp — it never changes as time passes.

**Automation:** `test/e2e/ui_tests/home.spec.ts` → "FIN-H01 Home reflects the ledger"

### FIN-H02: Insight over the selected range

**Type:** Positive · **Priority:** High

**Precondition:** Seed data spans several months.

**Steps:**
1. Open **Insight** and read the H1 and the range pills.
2. Click each range in turn: **This month**, **Last 3 months**, **Last 6 months**, **Last 12 months**, **All time**.
3. Reload the page.
4. Read the four cards.
5. Hover a cash-flow point and a net-worth bar.

**Test Data:** None.

**Expected Result:**
- The H1 reads **"Insight"** — singular.
- Five range pills are offered and the default selection is **"Last 6 months"**.
- The selection persists across a reload.
- The cards are **"Cash flow"** (sub *"Income & expense by month"*, legend **"Income"** / **"Expense"**, a net line **"Net cash flow +৳X"**, and **"Showing last 12 of N months"** when truncated), **"Spending by category"** (**"Total ৳X"**, the top 6 plus **"Other"**, uncategorised spend under **"Unknown"**), **"Net worth"** (ending **"Now"**, hint *"Hover any bar for that month's figure."*) and **"Trends"**.
- Hovering a cash-flow point and a net-worth bar reveals that month's figure.
- The footnote reads **"Goal / Debt / Investment lists live on their own screens"** with links to **Goals**, **Debts** and **Investments**.
- *Known gaps:* the H1 is singular while Home's link reads **"See full Insights →"**. The range is persisted to `localStorage` under `finora.insights.range` (PRD §10 R17), so a stale key left by another version could leave the selection on a range with no matching pill.

**Automation:** `test/e2e/ui_tests/home.spec.ts` → "FIN-H02 Insight over the selected range"

### FIN-H03: Export and import round trip

**Type:** Positive · **Priority:** High

**Precondition:** Seed data is present.

**Steps:**
1. Open **Settings** and click **"Export backup"**.
2. Inspect the downloaded file's name and contents.
3. Change some data — add a transaction and edit an account.
4. Open **Settings**, click **"Import backup"**, select the downloaded file.
5. Read the confirmation and click **"Replace"**.
6. Read the banner and check whether the step-3 changes survived.

**Test Data:** None.

**Expected Result:**
- The download is named **"finora-backup-{yyyy}-{mm}-{dd}.json"** and a banner reads **"Downloaded finora-backup-2026-11-02.json"** / *"This file contains every account, transaction, goal, debt, and investment from your local store."* / *"Keep it somewhere safe — it's the only way to restore from a wipe."*
- The envelope is `{ version, exportedAt, data }` with `version: 1`, and `data` holds `accounts`, `transactions`, `goals`, `debts`, `investments`, `categories`, `settings { theme, onboardingComplete }`, `monthPlans`, `eventPlans`, `investmentPlans` and `loanPlans`, indented with two spaces.
- The confirmation reads **"Replace current data with backup?"** / *"This will overwrite every account, transaction, goal, debt, and investment currently in the app."* with the confirm button **"Replace"**.
- After replacing, the banner reads **"Backup restored"** / *"Your data is now identical to the backup file."* / *"Open Home to see the totals."* and the step-3 changes are gone.

**Automation:** `test/e2e/ui_tests/settings.spec.ts` → "FIN-H03 Export and import round trip"

### FIN-H04: The Insights trends rows and the period-comparison caption

**Type:** Positive · **Priority:** High

**Precondition:** Data exists in two consecutive ranges — income and expenses in the current month *and* in the previous 6 months.

**Steps:**
1. Open **Insight** and read the **"Trends over …"** card.
2. Switch to **Last 3 months**, then **Last 6 months**, then **Last 12 months**.
3. Switch to **This month** and **All time**.
4. Delete the previous-period data and re-read the caption.
5. Read the **"Savings rate"**, **"Days of runway"** and **"Investment growth"** rows.

**Test Data:** None.

**Expected Result:**
- The card header reads **"Trends over {range}"** with the sub-line *"Aggregates over the chosen range"*, and carries **four** stacked rows: **"Average monthly expense"** (hint *"Total out across months with activity"*), **"Savings rate"** (hint *"(income − expense) ÷ income · 0 if no income"*), **"Days of runway"** (hint *"Cash ÷ daily avg expense · at current burn"*) and **"Investment growth"** (hint *"Active schemes · maturity − contributed"*).
- Only the **"Average monthly expense"** row carries a comparison caption. On **Last 3 / 6 / 12 months** it reads **"↑ X% vs previous 3 months"** (or **"6 months"** / **"12 months"**) / **"↓ X% vs previous …"**, primary-coloured for up and danger for down, as a small muted sub-line under the value.
- On **This month** and **All time** the caption is suppressed, and it is also suppressed when the previous window has no data — it is never shown as `0%` and never as `NaN%`.
- **"Savings rate"** shows **"—"** when income is 0 and a signed percentage otherwise.
- **"Days of runway"** shows **"—"** when there is no spend data to derive a daily burn from, and otherwise **"N d"** — primary at 30 days or more, accent at 7 or more, danger below 7.
- **"Investment growth"** shows **"—"** and the hint switches to **"No active investments yet"** when there are no active investments.
- *Known gaps:* PRD §9.16.2 specifies a **3-up** row of **Net flow · Avg monthly expense · Saved toward goals**, each with a period-comparison caption. The build ships **four** rows with a different set and only **one** caption; there is **no "Net flow" tile** and **no "Saved toward goals" tile**, even though `savedTowardGoals` is computed in the domain layer — so R11's "goal contributions sum into the Insights stat" is unreachable in the UI. The caption format uses an **arrow** rather than the PRD's **"+X% / −X%"** sign prefix. The **"Savings rate"** hint says *"0 if no income"* but the row renders **"—"** — hint and behaviour disagree.

**Automation:** `test/e2e/ui_tests/home.spec.ts` → "FIN-H04 The Insights trends rows and the period-comparison caption"

### FIN-H05: Home empty states and stat captions

**Type:** Positive · **Priority:** Medium

**Precondition:** A fresh install with no accounts, transactions, goals, debts or investments.

**Steps:**
1. Open **Home**.
2. Read the stat strip.
3. Read the empty **Accounts** card.
4. Read the empty **Transactions** card.
5. Read the net-worth caption.

**Test Data:** None.

**Expected Result:**
- Each empty Home card reuses the shared empty state — illustration, title, description, CTA and a learn-more link.
- The stat strip shows the captions **"No accounts yet"**, **"no money owed to you"**, **"no active debts"** and **"none yet"**.
- The net-worth caption reads **"Liabilities exceed assets"** when there are no assets but liabilities exist, or **"Assets minus liabilities"** otherwise.
- No zero-division artefact appears anywhere — no `NaN`, `Infinity` or `undefined`.

**Automation:** `test/e2e/ui_tests/home.spec.ts` → "FIN-H05 Home empty states and stat captions"

### FIN-H06: Insight empty states and the widgets that are absent

**Type:** Negative · **Priority:** Medium

**Precondition:** A profile with no transactions, and a second profile with no investments.

**Steps:**
1. Open **Insight** on the profile with no transactions.
2. Read the cash-flow, spending and net-worth cards.
3. On the profile with no investments, read the **"Investment growth"** row.
4. Look for goals, debts and investments widgets on the Insight screen.
5. Look for a recurring-transaction insight.

**Test Data:** None.

**Expected Result:**
- The cards render their empty states: **"No transactions in this period."**, **"No expenses in this period."** and **"No balance history in this period."**
- The **"Investment growth"** row shows **"—"** with the hint **"No active investments yet"**.
- The footnote **"Goal / Debt / Investment lists live on their own screens"** is present with links to **Goals**, **Debts** and **Investments**.
- **No** Goals / Debts / Investments widget cards are rendered on the Insight screen.
- **No** recurring-transaction insight is rendered.
- *Known gap:* PRD §9.16.6 requires Goals / Debts / Investments cards on the Insight screen. The domain helpers exist but are not rendered. The same gap applies to the "Saved toward goals" stat recorded in FIN-H04.

**Automation:** `test/e2e/ui_tests/home.spec.ts` → "FIN-H06 Insight empty states and the widgets that are absent"

### Plan scratchpads

### FIN-L01: The Plan hub

**Type:** Positive · **Priority:** Medium

**Precondition:** The app is running; a month plan with at least one item and one event exist.

**Steps:**
1. Open **Plan**.
2. Read the H1, the sub-line and the four rows.
3. Read the footer note.
4. Click each row in turn and read the destination screen's H1.
5. Return to **Plan** and read the **"This month"** and **"Events"** rows again.

**Test Data:** One month-plan item and one event.

**Expected Result:**
- The H1 reads **"Plan"** and the sub-line reads *"Scratchpads for what you intend to spend. Nothing here is recorded in your ledger — it's a way to think ahead."*
- Four rows are listed — **Investments**, **Loans**, **This month**, **Events** — each with a count, a figure and a suffix.
- The footer reads **"ⓘ Plans are pure scratch — switch tabs, swap emoji, abandon mid-edit. Nothing here touches your real accounts or transactions."**
- The row states read **"at maturity"** for Investments, **"/mo EMI"** for Loans, **"budgeted · N item(s)"** or **"nothing planned"** for **This month**, and **"N days away · {name}"** / **"N days ago · {name}"** / **"no events yet"** for **Events**.
- Each row opens its own screen — **Investment Planner**, **Loan Calculator**, **Plan my month** and **Plan an event**.
- *Known gaps:* PRD §9.15.1 specifies a month selector and rollover between months. Neither exists — only the current calendar month is editable, and `plannedIncome` has no persisted UI surface at all; income exists only in the ephemeral Quick-total checker (see FIN-L07).

**Automation:** `test/e2e/ui_tests/plan.spec.ts` → "FIN-L01 The Plan hub"

### FIN-L02: The Month Plan batch budget editor

**Type:** Positive · **Priority:** Medium

**Precondition:** The Month Plan holds at least three items.

**Steps:**
1. Enter selection mode and select three cards.
2. Read the floating bar.
3. Open **"Edit budgets"**.
4. Read the four mode tabs.
5. Choose **"Same amount"**, enter `5000`, and apply.
6. Choose **"Adjust %"**, apply `+10%`, and apply.
7. Choose **"Custom amounts"**, leave one card blank, and apply.
8. Choose **"Clear"** and apply.
9. Exit selection mode and reopen the editor with nothing selected.

**Test Data:** Three items; same amount 5000; +10%.

**Expected Result:**
- The floating bar reads **"Tap cards to select"**, **"{n} of {total} selected"**, and offers **"Select all"** / **"All selected"**, **"Clear"**, **"Edit budgets"** and an exit control.
- The sheet is titled **"Batch update budget"** and has four tabs — **"Custom amounts"**, **"Same amount"**, **"Adjust %"**, **"Clear"** — plus an apply button reading **"Apply to {n} card(s)"**.
- The custom mode shows the helper *"Type a new budget for each card. Leave blank to skip that card."* with **"Clear all"** and **"Fill all with…"**.
- Each apply raises a banner — **"{n} card(s) updated"** or **"{n} card(s) cleared"** — whose fix line reads **"Tap Save plan to keep the change."**
- Step 9 shows **"Nothing is selected. Pick a few cards first, then come back here."**
- *Known gap:* the banner's fix text points at a **"Save plan"** control that the Month Plan does not have — see FIN-L05.

**Automation:** `test/e2e/ui_tests/plan.spec.ts` → "FIN-L02 The Month Plan batch budget editor"

### FIN-L03: Event Plan — list and create

**Type:** Positive · **Priority:** High

**Precondition:** No events exist.

**Steps:**
1. Open **Plan → Events**.
2. Read the H1, the sub-line and the empty state.
3. Click **"+ New event"**.
4. Enter the name `Cox's Bazar trip`, the date `2030-06-15`, the unallocated amount `80000`, and click **"Create event"**.
5. Read the event detail screen.
6. Read the event card on the list.

**Test Data:** Name `Cox's Bazar trip`; date 2030-06-15; unallocated 80000.

**Expected Result:**
- The list H1 reads **"Plan an event"** and the sub-line reads *"Weddings, trips, Eid, anything with a date and a budget. Each event is its own scratchpad."*
- The empty state reads **"Plan your first event"** / *"Set a date. Add categories with their own budgets — the event's total is the sum of category budgets."*
- Step 5 shows the event name as the H1, the header line **"৳ 80,000 total (sum of categories)"**, and a summary strip with the **"Allocated"**, **"Paid"** and **"Days to go"** pills.
- The unallocated amount seeds a single **"🪙 Unallocated"** category — it does **not** set an event-level budget, so the total is still the sum of the category budgets.
- Step 6 — the card shows the emoji, the name, the date with **"N days to go"** (or **"N days ago"** for a past date), a progress bar, an **Allocated / Budget** pill, a percentage pill and the category count.

**Automation:** `test/e2e/ui_tests/eventPlans.spec.ts` → "FIN-L03 Event Plan — list and create"

### FIN-L04: Investment Planner and Loan Calculator

**Type:** Positive · **Priority:** Medium

**Precondition:** A clean-ish state; record the account balances and the transaction count before starting.

**Steps:**
1. Open **Plan → Loans** and read the empty state.
2. Open **"+ New projection"** and read the form fields and the blocked-save reasons.
3. Enter a principal of `100000`, a rate of `9`, a term of `12` and a first payment date of `2030-01-01`, name it `Car loan`, and save.
4. Read the summary and the amortization table.
5. Open **Plan → Investments** and read the empty state and the starter kits.
6. Create a plan from the FDR starter kit and read the detail screen.
7. Return to **Transactions** and compare the account balances and the transaction count with what you recorded in step 1.

**Test Data:** Projection `Car loan`, principal 100000, rate 9%, term 12 months. Plan: DPS 5000/mo 8% 12mo; FDR 100000 9% 12mo; Savings 50000 7% 36mo.

**Expected Result:**
- The Loan Calculator H1 reads **"Loan Calculator"** with the sub-line *"Project what a loan will cost. Enter principal, rate, and term — the app fills the amortization table for you."* and the CTA **"+ New projection"**.
- The empty state reads **"No projections yet"** / *"Try a sample — 100,000 BDT at 9% for 12 months — and see the EMI + total interest computed live."* / **"Start a projection"**.
- The form holds **Name**, **Principal**, **Annual rate (%)**, **Term** and **First payment date**; the blocked-save reasons read **"Add a name and a principal to save."**, **"Add a name to save."** and **"Enter a positive principal to save."**
- **Term** carries a **Months / Years** toggle. The stored term is always a month count — the toggle only changes how it is entered. A whole-year term opens in Years (a 12-month term reads **"1"**); switching the unit re-expresses the same value (**36 months** ⇄ **3 years**) without losing it.
- The detail shows a **"Summary (projection)"** card with **"EMI"**, **"Total you pay"** and **"Total interest"**, the warning **"ⓘ Projection only. Actual loan terms may include fees, insurance, or rounding that change the numbers slightly."**, and an **"Amortization table"** with the columns **Period**, **Due**, **Payment**, **Interest**, **Principal**, **Balance**. The table is captioned **"N monthly payments over X"** in the natural unit (**"36 monthly payments over 3 years"**).
- The Investment Planner H1 reads **"Investment Planner"** with the sub-line *"Sketch a DPS, FDR, or savings certificate. Nothing here moves real money — it's a sandbox for 'what if I opened a 1-year FDR at 9%?'."* and the CTA **"+ New plan"**.
- The starter kits are **"Monthly deposit scheme (DPS)"** (৳5,000/mo, 8%, 12mo), **"Fixed deposit receipt (FDR)"** (৳100,000, 9%, 12mo), **"Savings certificate / term deposit"** (৳50,000, 7%, 36mo), plus a blank-form option.
- The detail shows **"Projection"**, **"At maturity (projection)"**, the legend **"Your money"** / **"Interest earned"**, **"Composition at maturity, over X"** (in the natural unit — **"over 1 year"**), the chips **"You put in"** / **"You earn"** / **"Matures"**, the warning **"ⓘ This is a projection. Actual bank payouts may differ."** and the footer **"Plans never touch your ledger."**
- Step 7 — **the Transactions list is still empty and no account balance has changed.** Both planners are scratch only.

**Automation:** `test/e2e/ui_tests/planners.spec.ts` → "FIN-L04 Investment Planner and Loan Calculator"

### FIN-L05: The Plan save/reset and dirty discipline

**Type:** Negative · **Priority:** High

**Precondition:** A **saved** Investment Plan and a **saved** Loan Projection exist; a Month Plan holds at least one item.

**Steps:**
1. Open the Investment Plan detail and change the rate, without saving.
2. Read the toolbar's status line.
3. Look for a **"Reset"** control.
4. Tap **"Save plan"**.
5. Reopen the plan and confirm the value persisted.
6. Edit it again and navigate back via **"← Investment Planner"**.
7. Open a plan that has never been saved and navigate back via **"← Investment Planner"**.
8. Repeat the dirty-then-leave sequence on the Loan Calculator.
9. On the Month Plan, change a budget and look for a **"Save plan"** control.

**Test Data:** A never-saved plan, created and abandoned without pressing **"Save plan"**.

**Expected Result:**
- Step 2 — the toolbar shows a warn dot and the status line **"Unsaved changes — your edits haven't been saved yet."**; once persisted it reads **"Saved"** with a success dot.
- Step 3 — **there is no Reset control.** The toolbar offers exactly **"Save plan"** (outlined primary) and **"Delete"** (outlined danger).
- Step 4 — **"Save plan"** clears the dirty flag, stamps `savedAt` and navigates back to the plan list; the changed value survives a reload.
- Step 6 — navigating back shows **no guard-rail dialog**; the dirty dot is the only indicator.
- Step 7 — the never-saved plan is **silently deleted**, with no confirmation and no warning; it is gone from the list.
- Step 8 — the Loan Calculator behaves identically.
- Step 9 — the Month Plan has **no Save/Reset toolbar at all**; its footer reads **"ⓘ Tap an item to edit it in a pop-up. Changes save automatically."**
- *Known gaps:* PRD §10 R12 and §9.15.1 require a **Reset** that restores the last `savedSnapshot`, and state that there is **no auto-save**. The build has no `savedSnapshot` field and no `resetPlan` function — Reset is unimplemented rather than merely hidden. Month Plan and Event Plan auto-save every edit while Investment Planner and Loan Calculator require an explicit **"Save plan"**: two contradictory save models coexist under one rule. The Month Plan's batch-edit banner fix text reads **"Tap Save plan to keep the change."** — pointing at a button that does not exist on that screen.

**Automation:** `test/e2e/ui_tests/plan.spec.ts` → "FIN-L05 The Plan save/reset and dirty discipline"

### FIN-L06: Month Plan — add an item, set a budget, remove it

**Type:** Positive · **Priority:** High

**Precondition:** The Month Plan is empty.

**Steps:**
1. Open **Plan → This month**.
2. Read the H1, the sub-line and the count chip.
3. Add an item named `Groceries` with a budget of `8000`.
4. Read the item card.
5. Open the budget editor and clear the budget.
6. Open the budget editor and set it to `9000`.
7. Remove the item and confirm.
8. Add an item with no name and try to save.

**Test Data:** Item `Groceries`; budget 8000 → cleared → 9000.

**Expected Result:**
- The H1 reads **"Plan my month"** and the sub-line reads *"Fill the items with budgets for what you intend to spend. Changes save as you go."* The count chip reads **"N card(s) in plan"** and the section heading **"Your items"** carries the hint *"· Tap cards to select"*.
- The footer reads **"ⓘ Tap an item to edit it in a pop-up. Changes save automatically."**
- The add-item modal is titled **"Add new item"** / *"Pick an icon, name the item, set the budget. You can edit the budget later."* with the fields **Icon**, **Name**, **Budget (optional)** and the buttons **"Cancel"** / **"Save item"**.
- The budget editor is headed **"Set the budget."** and offers the pills **"Budget set"** / **"No budget"**, **"Clear budget"**, **"Save"**, and a footer **"Done with this item?"** with **"Remove item"**.
- The remove asks **"Delete "{name}"?"** with the body *"This item will be removed from this month's plan."* and the danger line **"The budget value for this item is removed."**
- Step 8 raises the banner **"Name the item"** / *"An item without a name has no plan."* / `Type a name (e.g. "Groceries") then save.`
- The change is saved automatically — no explicit **Save plan** is required or offered.

**Automation:** `test/e2e/ui_tests/plan.spec.ts` → "FIN-L06 Month Plan — add an item, set a budget, remove it"

### FIN-L07: The Month Plan quick-total checker

**Type:** Positive · **Priority:** Medium

**Precondition:** The Month Plan holds at least three items.

**Steps:**
1. Open **Plan → This month** and scroll to the **"Quick total"** card.
2. Read the card's title, sub-line and empty state.
3. Enter an income of `50000`.
4. Tick two items.
5. Read the totals.
6. Raise the income to `1000` so the selection costs more than the income.
7. Click **"Clear selection"**.
8. Reload the page and re-open the card.

**Test Data:** Income 50000, then 1000; two items ticked.

**Expected Result:**
- The card is titled **"Quick total"** with the sub-line *"Check the cards you'll pay"* and the explanation *"Tick items, set your income, see how much you'd save (or overspend). Nothing is saved."*
- It offers an **Income** field, a **"Clear selection"** control, the footer **"N of M selected"**, and the totals **"Total ৳X"** and **"Saved ৳X"** — or **"Over by ৳X"** when the selection exceeds the income.
- With no items it reads **"No items in this month's plan yet — open the planner to start."**
- Step 8 — the selection, the income and the totals are **all reset**. Nothing in this card is persisted; it is an ephemeral scratchpad.
- *Known gap:* `plannedIncome` is a persisted field on the Month Plan in PRD §9.15.1, but it has no UI surface at all — the only income input is this non-persisted checker.

**Automation:** `test/e2e/ui_tests/plan.spec.ts` → "FIN-L07 The Month Plan quick-total checker"

### FIN-L08: Event Plan detail, categories and the derived total

**Type:** Positive · **Priority:** High

**Precondition:** An event `Cox's Bazar trip` dated 2030-06-15 exists.

**Steps:**
1. Open the event detail.
2. Read the header and the summary strip.
3. Add a category `Hotel` with a budget of `40000` and a line item **"Two nights"** of `40000`.
4. Add a category `Tickets` with a budget of `12000` and a line item **"Bus tickets"** of `12000`.
5. Read the header total, the **"Allocated"** pill and the **"Paid"** pill.
6. Tick the **"Bus tickets"** line item.
7. Read the **"Paid"** pill and the category footer.
8. Read the timeline rail.

**Test Data:** `Hotel` 40000 / **"Two nights"** 40000; `Tickets` 12000 / **"Bus tickets"** 12000.

**Expected Result:**
- The H1 is the event's name and the sub-line carries the date and the derived total.
- The header total reads **"৳ 52,000 total (sum of categories)"** — 40000 + 12000 — and it changes as categories are added or edited. There is no field in which the event's own total can be typed.
- The summary strip shows the **"Allocated"**, **"Paid"** and **"Days to go"** pills.
- The category editor is headed **"Budget · spent (sum of line items) · due date."**, shows the pill **"No budget"** when no budget is set, and holds the fields **"Budget"**, **"Spent"** (hint *"Sum of all line items below."*), **"Due date"** and **"Line items"**, with the composer **"Add a line — e.g. Deposit, Tickets"**, **"Amount"** and **"Done"**.
- Step 6 — the **"Paid"** pill reads ৳12,000 and the `Tickets` card's footer reads **"1 of 1 paid"**, while `Hotel` reads **"0 of 1 paid"**.
- Step 8 — the timeline header reads **"Timeline"** (or **"Timeline (past)"** for a past-dated event) with the labels **"today"**, **"tomorrow"**, **"in N days"** and **"N days ago"**.

**Automation:** `test/e2e/ui_tests/eventPlans.spec.ts` → "FIN-L08 Event Plan detail, categories and the derived total"

### FIN-L09: Event Plan validation, completion, over-budget and deletion

**Type:** Negative · **Priority:** Medium

**Precondition:** The Event Plan list is open; one event exists.

**Steps:**
1. Open the create form, fill only the date, and click **"Create event"**.
2. Open the create form again, fill only the name, and click **"Create event"**.
3. Open an event and add a category with no name.
4. Tick every line item in every category.
5. Set a category's spent figure above its budget.
6. Open the event's date editor.
7. Delete a category and confirm.
8. Delete the event and confirm.

**Test Data:** One category with a spent figure above its budget.

**Expected Result:**
- Step 1 raises **"Event name is required"** / *"Without a name the event cannot be tracked."* / `Enter a name (e.g. "Cox's Bazar trip").` and the form stays open; no event is created.
- Step 2 raises **"Event date is required"** / *"The timeline is anchored to the date."* / *"Pick a date."* and the form stays open; no event is created.
- Step 3 raises **"Name the category"** / *"A category without a name is impossible to track."* / `Type a name (e.g. "Hotel") then save.`
- Step 4 raises the callout **"Event completed"** / *"Every line item is paid. {plan.name} is wrapped up."*
- Step 5 raises the over-budget headline **"Paid past the budget"** or **"Categories sum past the budget"**, with the figures **"Budget"**, **"Allocated"** and **"Over by"**.
- Step 6 — the date editor is titled **"Edit event date"** with the note *"The event's total budget is the sum of category budgets — edit a category to adjust the total."* The total is **not** editable there.
- Step 7 asks **"Delete {name}?"** / *"The category and every line item inside it will be removed from this event."* / *"This can't be undone — any amounts you typed are lost."*
- Step 8 asks **"Delete this event plan?"** / *"This is a scratchpad — nothing was recorded in your ledger. The plan and its categories are removed."*
- *Known gap:* PRD §9.15.2 specifies five event kits (wedding, trip, religious, party, generic) auto-selected by matching the event name against regex hints. The build ships a single generic preset panel, so a wedding event does not receive wedding categories.

**Automation:** `test/e2e/ui_tests/eventPlans.spec.ts` → "FIN-L09 Event Plan validation, completion, over-budget and deletion"

### Security — PIN

### FIN-P01: Set a PIN, lock the app and unlock it

**Type:** Positive · **Priority:** High

**Precondition:** No PIN is set on this device.

**Steps:**
1. Open **Settings** and click **"Set PIN"**.
2. Enter `123456` and click **"Continue"**.
3. Enter `654321` and click **"Save PIN"**.
4. Reload the page.
5. Enter `123456` on the lock screen.

**Test Data:** PIN `123456`; a mismatched confirmation `654321`.

**Expected Result:**
- The modal is titled **"Set a 6-digit PIN"** with the sub-line *"You'll enter this every time you open Finora"* and the helper *"Type with your keyboard. Each box accepts one digit."*
- The confirm step is titled **"Confirm your PIN"** / *"Type the same 6 digits once more"* with the button **"Save PIN"**. A mismatch shows **"PINs don't match — try again."** and nothing is saved.
- After the reload the lock screen renders with the aria-label **"Unlock Finora"**, the H1 **"Secure Finora"** and the sub-line **"Enter your 6-digit PIN to unlock"**; the normal app shell does **not** render.
- The correct PIN raises the banner **"Welcome back"** / *"PIN accepted."* / *"Your accounts are ready."*

**Automation:** `test/e2e/ui_tests/security.spec.ts` → "FIN-P01 Set a PIN, lock the app and unlock it"

### FIN-P02: PIN entry mechanics, a wrong PIN and rate limiting

**Type:** Negative · **Priority:** High

**Precondition:** A PIN is set; the lock screen is showing.

**Steps:**
1. Type one digit and observe the focus.
2. Press Backspace.
3. Paste a 6-digit string.
4. Use ArrowLeft and ArrowRight.
5. Press Enter.
6. Enter a wrong PIN four times in a row.
7. Close the tab, reopen it, and try the wrong PIN again.

**Test Data:** Correct PIN `123456`; wrong PIN `999999`.

**Expected Result:**
- Entry auto-advances to the next box; Backspace returns to the previous box and clears it; a pasted 6-digit string fills all six boxes; ArrowLeft and ArrowRight move the focus; Enter submits.
- The digit group carries the aria-label **"PIN entry, {n} of 6 digits entered"** and each cell **"Digit {n}"**.
- There is **no on-screen keypad** — only the six masked boxes.
- A wrong PIN shows **"Wrong PIN. Try again."** and the screen shakes.
- The delays escalate: roughly 1 s after the first failure, 5 s after the second and 30 s after the third, with the screen showing **"Locked. Reload the page to continue."** or **"Try again in {n}s"**. The fourth failure locks indefinitely until the page is reloaded.
- Step 7 — the lockout is **cleared** by closing the tab, because the counters live in `sessionStorage`.
- *Known gaps:* the doc comments describe a 3×4 on-screen keypad that is not implemented. Because the lockout lives in `sessionStorage`, closing the tab defeats it — a security finding.

**Automation:** `test/e2e/ui_tests/security.spec.ts` → "FIN-P02 PIN entry mechanics, a wrong PIN and rate limiting"

### FIN-P03: Change, disable and forget a PIN

**Type:** Positive · **Priority:** High

**Precondition:** A PIN is set.

**Steps:**
1. Open **Settings** and click **"Change PIN"**.
2. Enter a wrong current PIN.
3. Enter a mismatched new PIN.
4. Enter a valid new PIN and confirm.
5. Reload and unlock with the new PIN.
6. Open **Settings**, click **"Disable PIN"**, and confirm.
7. Reload the page.
8. Set a PIN again, lock the app, and click **"Forgot PIN? Wipe all data"**.

**Test Data:** Current PIN `123456`; wrong current `000000`; new PIN `654321`; mismatched new `111111`.

**Expected Result:**
- The change flow has three steps — **"Enter your current PIN"**, **"Choose a new PIN"**, **"Confirm the new PIN"** — with the subtitles *"We need to know it's really you before changing it."*, *"Pick a new 6-digit PIN."* and *"Type it once more to confirm."* Only a **"Cancel"** button is offered; there is no explicit Save.
- A wrong current PIN shows **"That PIN doesn't match the one on this device."**; a mismatch shows **"New PINs don't match — try again."**; success raises **"PIN changed"** / *"Your new PIN is in effect."*
- The disable asks **"Disable PIN lock?"** / *"You'll be able to open Finora without entering a PIN. You can turn it back on any time."* with the confirm button **"Disable PIN"**, then raises **"PIN disabled"** / *"Your app will open without asking."* / *"You can turn PIN protection back on at any time from this card."* After a reload there is no lock screen.
- The forgot flow asks **"Wipe all data and reset PIN?"** / *"This permanently deletes every account, transaction, goal, debt, investment, and plan — and clears the PIN. The app will reset to a clean install. There is no recovery."* with the confirm button **"Wipe everything"**, then raises **"All data wiped"** / *"Your local store is now empty."* / *"Add an account to start tracking again."* The app then opens without a PIN.
- *Known gaps:* the only PIN recovery is a **full data wipe** — there is no email or OTP path, and the copy says so. PRD §13.2 expects a non-destructive alternative.

**Automation:** `test/e2e/ui_tests/security.spec.ts` → "FIN-P03 Change, disable and forget a PIN"

### FIN-P04: The PIN never leaves the device

**Type:** Positive · **Priority:** High

**Precondition:** A PIN is set; seed data is present.

**Steps:**
1. Open **Settings** and click **"Export backup"**.
2. Open the downloaded JSON and search it for `pin`, `salt` and `hash`.
3. Read the About panel's privacy statement.
4. Check whether any data was transmitted: with the network panel open, record a transaction and confirm no request carries financial data.

**Test Data:** None.

**Expected Result:**
- The exported JSON contains **no** PIN salt and **no** PIN hash — only accounts, transactions, goals, debts, investments, categories, plans and settings.
- The About panel states that all data lives in the user's browser.
- No request leaves the device carrying financial data; the app is local-first and only talks to Supabase when the user has opted into cloud sync.
- This is the load-bearing assertion for PRD §13.2.

**Automation:** `test/e2e/ui_tests/security.spec.ts` → "FIN-P04 The PIN never leaves the device"

### Cloud sync

### FIN-C01: The sync-disabled build and the signed-out panel

**Type:** Negative · **Priority:** Medium

**Precondition:** A build without Supabase environment variables, or sync explicitly disabled.

**Steps:**
1. Open **Settings** and read the Cloud sync panel.
2. Click **"Sign in"**.

**Test Data:** None.

**Expected Result:**
- The panel reads **"Cloud sync is disabled in this build. Set BASE_URL and BASE_ANON_KEY in .env.local to enable it."**
- The signed-out panel reads *"Sync your data across devices with end-to-end RLS-scoped storage. Optional — Finora works fine without it. Your cloud copy is preserved when you sign out, so signing back in pulls the latest snapshot."* with a **"Sign in"** button.
- **"Sign in"** opens a dialog with the tabs **"Sign in"** / **"Create account"**, the headline **"Sign in to sync"**, the fields **"Email"** (placeholder `you@example.com`) and **"Password"**, and a **"Forgot password?"** link.
- *Known gap:* the on-screen instruction names `BASE_URL` and `BASE_ANON_KEY`, and the app now reads exactly those two variables, so following the instruction **does** enable sync. One stale string remains: the "Cloud sync off" pill's tooltip in `src/components/SyncStatusPill.tsx` still names the old `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` variables. The pill itself is no longer rendered in the sidebar — it appears only inside Settings → Cloud sync — so the stale tooltip is visible on the sync-disabled panel.

**Automation:** `test/e2e/ui_tests/cloud.nosync.spec.ts` → "FIN-C01 The sync-disabled build and the signed-out panel"

### FIN-C02: Sign-in and sign-up errors

**Type:** Negative · **Priority:** High

**Precondition:** Sync is enabled; the user is signed out.

**Steps:**
1. Sign in with an invalid email.
2. Sign in with a correct email and a wrong password.
3. Sign up with an email that already exists.
4. Sign up with a 7-character password.
5. Sign up with a new email and an 8-character password.

**Test Data:** Email `not-an-email`; existing email `rina@example.com`; passwords `Pass@123` and `short12`.

**Expected Result:**
- Row 1 — the inline error **"Enter a valid email address."** appears.
- Row 2 — the inline error **"That email and password don't match. Try again."** appears.
- Row 3 — the inline error **"An account with this email already exists. Try signing in instead."** appears.
- Row 4 — the inline error **"Password doesn't meet the server's requirements."** appears; the client-side minimum is 8 characters.
- Row 5 — a toast **"Account created"** / *"You're signed in and cloud sync is ready."* appears, or **"Check your email"** when the deployment requires email confirmation.

**Automation:** `test/e2e/ui_tests/cloud.spec.ts` → "FIN-C02 Sign-in and sign-up errors"

### FIN-C03: The signed-in state, a forced sync and the offline queue

**Type:** Positive · **Priority:** Medium

**Precondition:** Signed in to a cloud account; a second browser is signed in to the same account.

**Steps:**
1. Read the Cloud sync panel and the status pill.
2. Tap **"Force sync now"**.
3. Switch the browser to offline and record several transactions.
4. Switch back online.
5. Edit on browser A, wait for the sync, then edit on browser B.
6. Watch browser B without editing it.

**Test Data:** None.

**Expected Result:**
- The panel shows **"Signed in as"** with the email, and **"Last synced"** reading **"never"**, **"just now"**, **"Ns ago"**, **"Nm ago"**, **"Nh ago"** or **"Nd ago"**. The buttons are **"Force sync now"** (showing **"Syncing…"** while busy), **"Change password"** and **"Sign out"**.
- Step 2 raises the toast **"Sync complete"** and **"Last synced"** becomes **"just now"**.
- The status pill cycles through **"Cloud sync off"**, **"Cloud off"**, **"Synced · {relative}"**, **"Syncing…"**, **"Offline · {n} pending"** and **"Sync error"**. Clicking a signed-out or off pill navigates to `#/settings`; clicking an error pill raises a banner with the reason.
- Step 4 — the queued changes flush and coalesce into a single push, and the pill reads **"Synced"**.
- Step 5 — last-write-wins applies to the **whole state**: the newer `stateUpdatedAt` wins and the entire snapshot is adopted, with no per-field merge. The server clock breaks same-millisecond ties.
- Step 6 — browser B does **not** update live; sync is eventual, on the next reconcile.

**Automation:** `test/e2e/ui_tests/cloud.spec.ts` → "FIN-C03 The signed-in state, a forced sync and the offline queue"

### FIN-C04: Sign out, sign back in and the password flows

**Type:** Positive · **Priority:** High

**Precondition:** Signed in, with data present both locally and in the cloud.

**Steps:**
1. Tap **"Sign out"**.
2. Read the local data.
3. Sign back in with the same credentials.
4. Read the local data again.
5. Tap **"Change password"**, set a new one, and confirm.
6. Click **"Forgot password?"** and **"Send reset link"**; open the emailed link.
7. With two tabs open, click the recovery link in one of them.

**Test Data:** Password `Pass@123`, new password `Pass@456`.

**Expected Result:**
- Step 1 raises the toast **"Signed out"**, and the **local store is wiped** — accounts, transactions, goals, debts, investments and plans are all gone — while the **cloud copy is preserved**.
- Step 3 — the wiped local has `stateUpdatedAt = 0`, so the cloud row is adopted through last-write-wins and the snapshot reappears with no manual export or import.
- Step 5 — the modal reads **"Change password"** / *"Choose a new password for your account. Use at least 8 characters. You'll stay signed in on this device."* with a **"New password"** field and the buttons **"Cancel"** / **"Update password"**, then raises the toast **"Password updated"** / *"You're signed in with your new password."*
- Step 6 — the recovery link auto-opens a **"Set a new password"** dialog and raises the toast **"Password updated"**. The `#access_token=…&type=recovery` fragment survives the hash-mode redirect.
- Step 7 — only the tab that owns the fragment opens the dialog; the other tab stays signed in, and after the update the recovering tab broadcasts **"recovery-complete"** and the other tab reloads automatically.
- *Known gaps:* **"Sign out"** is destructive and has **no confirmation dialog**, unlike **"Wipe all data"**, and the local wipe is not disclosed in the UI copy — the toast reads only **"Signed out"**.

**Automation:** `test/e2e/ui_tests/cloud.spec.ts` → "FIN-C04 Sign out, sign back in and the password flows"

### Settings, backup and the wipe flow

### FIN-W01: Wipe all data while signed out and while signed in

**Type:** Negative · **Priority:** High

**Precondition:** Data is present locally.

**Steps:**
1. Signed out: open **Settings**, click **"Wipe all data"** in the Danger zone, and read the confirmation.
2. Cancel the confirmation.
3. Confirm **"Wipe everything"**.
4. Read the banner and the local data.
5. Re-seed, sign in, and repeat the wipe.
6. Read the confirmation and the banner.
7. Use the About panel link **"Erase everything and start over →"**.

**Test Data:** None.

**Expected Result:**
- Step 1 — the confirmation reads **"Wipe all data?"** with the signed-out body *"Every account, transaction, goal, debt, investment, and plan will be deleted from this device. Your cloud copy (if any) is preserved so signing back in will restore the latest snapshot. This cannot be undone."*
- Step 2 — cancelling leaves every record in place.
- Step 3 raises **"All data wiped"** / *"Your local store is now empty. Your cloud copy (if any) is preserved — sign back in to restore."* / *"Add an account to start tracking again, or sign back in to pull from the cloud."*
- Step 5 — the signed-in confirmation reads *"…will be deleted from THIS DEVICE and from your cloud copy on Supabase. This cannot be undone."* and the banner reads **"All data wiped"** / *"Your local store and cloud copy are now empty."* / *"Add an account to start tracking again."* Signing in again yields an **empty** account, because the cloud row was deleted.
- Step 7 — the About panel link runs the same flow.
- The Danger zone warns **"This action is destructive. Export first if unsure."**

**Automation:** `test/e2e/ui_tests/settings.spec.ts` → "FIN-W01 Wipe all data while signed out and while signed in"

### FIN-W02: A failed cloud delete aborts the wipe, and a wipe clears the PIN

**Type:** Negative · **Priority:** High

**Precondition:** Signed in; data present; a PIN is set.

**Steps:**
1. Switch the browser to offline, then trigger **"Wipe all data"** and confirm.
2. Read the banner and the local data.
3. Switch back online and wipe again with a PIN set.
4. Reload the page.
5. Wait about 10 seconds and re-check the cloud copy.
6. Close the browser entirely, reopen it, and check the data.

**Test Data:** None.

**Expected Result:**
- Step 1 — the banner reads **"Couldn't delete cloud copy"** with the fix **"Check your connection and try again. Local data was NOT wiped."** and the local data is **preserved**: the cloud row is deleted first, so a network failure aborts before the local wipe.
- Step 3 — a wipe with a PIN set clears the PIN, so the app opens without a lock screen.
- Step 5 — the cloud row stays deleted: the local reset does not bump `stateUpdatedAt`, so no debounced push re-creates it.
- Step 6 — data created before the close is still present after reopening.

**Automation:** `test/e2e/ui_tests/settings.spec.ts` → "FIN-W02 A failed cloud delete aborts the wipe, and a wipe clears the PIN"

### FIN-W03: Exporting a backup

**Type:** Positive · **Priority:** High

**Precondition:** Seed data is present, including at least one month plan and one event plan.

**Steps:**
1. Open **Settings** and click **"Export backup"**.
2. Read the banner.
3. Open the downloaded file.
4. Read its top-level keys and its `version` and `exportedAt` fields.
5. Read its `data` keys.
6. Search the file for the PIN salt and hash.

**Test Data:** None.

**Expected Result:**
- The file is named **"finora-backup-{yyyy}-{mm}-{dd}.json"** and the banner reads **"Downloaded finora-backup-2026-11-02.json"** / *"This file contains every account, transaction, goal, debt, and investment from your local store."* / *"Keep it somewhere safe — it's the only way to restore from a wipe."*
- The envelope is `{ version, exportedAt, data }` with `version: 1`, indented with two spaces.
- `data` holds `accounts`, `transactions`, `goals`, `debts`, `investments`, `categories`, `settings { theme, onboardingComplete }`, `monthPlans`, `eventPlans`, `investmentPlans` and `loanPlans` — every entity the app holds.
- The file contains **no** PIN salt and **no** PIN hash.

**Automation:** `test/e2e/ui_tests/settings.spec.ts` → "FIN-W03 Exporting a backup"

### FIN-W04: Importing a backup replaces the current data

**Type:** Positive · **Priority:** High

**Precondition:** The app holds at least one account and one transaction.

**Steps:**
1. Open **Settings** and click **"Export backup"**.
2. Open **Settings** and click **"Import backup"**.
3. Select the exported file and read the confirmation.
4. Cancel the confirmation.
5. Re-select the file and click **"Replace"**.
6. Read the banner.
7. Read the current data and compare it with the backup's contents.

**Test Data:** A backup file exported from this app in step 1.

**Expected Result:**
- The confirmation reads **"Replace current data with backup?"** / *"This will overwrite every account, transaction, goal, debt, and investment currently in the app."* with the confirm button **"Replace"** and a danger tone.
- Step 4 — cancelling leaves the current data untouched and raises no banner.
- Step 5 raises **"Backup restored"** / *"Your data is now identical to the backup file."* / *"Open Home to see the totals."*
- Step 7 — every record from the backup is present and the records created after the export are gone. The import is a full replace, not a merge.

**Automation:** `test/e2e/ui_tests/settings.spec.ts` → "FIN-W04 Importing a backup replaces the current data"

### FIN-W05: Import error paths

**Type:** Negative · **Priority:** High

**Precondition:** Three files are prepared — a non-JSON file, a JSON file with the wrong shape, and a file the browser cannot open.

**Steps:**
1. Open **Settings**, click **"Import backup"** and select the non-JSON file.
2. Read the banner.
3. Select the wrong-shape JSON file.
4. Read the banner.
5. Select the unreadable file.
6. Read the banner.
7. Check that the current data is untouched after all three attempts.

**Test Data:** `not-json.txt` containing `this is not json`; `wrong-shape.json` containing `{ "version": 1, "data": { "accounts": "not-an-array" } }`; a file with no read permission.

**Expected Result:**
- Step 2 raises **"Backup file is not valid JSON"** / *"The file couldn't be parsed as JSON — it may be corrupted."* / *"Re-export from the source device, or check that the file isn't truncated."*
- Step 4 raises **"Backup is missing field: {path}"** / *"The file doesn't match the Finora V1 backup shape."* / *"Make sure you exported from Finora V1 (not V0 or V2)."*
- Step 6 raises **"Could not read the file"** / *"The browser couldn't open the file you picked."* / *"Try a different file or copy-paste from TextEdit."*
- Step 7 — the existing data is untouched by all three failures; a failed import never partially applies.
- Every banner states what, why and how to fix it.

**Automation:** `test/e2e/ui_tests/settings.spec.ts` → "FIN-W05 Import error paths"

### FIN-W06: There is no standalone "Delete cloud copy" button

**Type:** Negative · **Priority:** Medium

**Precondition:** Signed in to a cloud account with data on the device and in the cloud.

**Steps:**
1. Open **Settings** and read the Danger zone.
2. Search the whole Settings screen for a "Delete cloud copy" control.
3. Delete the cloud copy by other means and check whether the local data survives.

**Test Data:** None.

**Expected Result:**
- The Danger zone offers **"Wipe all data"** and **no** standalone "Delete cloud copy" button.
- *Known gap:* PRD §9.12 requires a separate **Delete cloud copy** control that deletes only the cloud row and leaves the local data intact, and the README documents it. The only path to `deleteCloudCopy()` is as the first step of **"Wipe everything"**, which also wipes the local store — so the documented behaviour cannot be reached.

**Automation:** `test/e2e/ui_tests/settings.spec.ts` → "FIN-W06 There is no standalone "Delete cloud copy" button"

### Runtime persistence and accessibility

### FIN-R01: Data survives a reload and a full browser restart

**Type:** Positive · **Priority:** High

**Precondition:** A transaction, a goal and an event plan exist.

**Steps:**
1. Reload the page.
2. Read the transaction, the goal and the event plan.
3. Close the browser entirely and reopen it.
4. Read them again.

**Test Data:** None.

**Expected Result:**
- Every record survives both the reload and the full browser restart.
- The data lives in IndexedDB (database `finora`, store `kv`, key `state`), not in `localStorage`.
- The route is preserved across a reload, so the user lands back on the same screen.

**Automation:** `test/e2e/ui_tests/runtime.spec.ts` → "FIN-R01 Data survives a reload and a full browser restart"

### FIN-R02: Clearing site data yields a clean install

**Type:** Positive · **Priority:** Medium

**Precondition:** Data is present.

**Steps:**
1. In the browser devtools, clear site data.
2. Reload the page.
3. Walk through the first-run screens.

**Test Data:** None.

**Expected Result:**
- The app boots as a clean install: no accounts, no transactions, and the onboarding screen is reachable.
- Nothing is left behind in `localStorage` or `sessionStorage` — in particular the PIN salt and hash and the rate-limit counters are gone.
- A legacy `localStorage['finora:v1']` blob from a pre-2026-09-02 build is migrated into IndexedDB on first load and the legacy key is removed.

**Automation:** `test/e2e/ui_tests/runtime.spec.ts` → "FIN-R02 Clearing site data yields a clean install"

### FIN-R03: Accessibility and UI conventions

**Type:** Positive · **Priority:** Medium

**Precondition:** The app is running with data present.

**Steps:**
1. Open any form and inspect a field's label, hint and error state.
2. Click a label and check where the focus lands.
3. Inspect a goal or debt progress bar.
4. Open a confirm dialog and press **Escape**, then **Tab**.
5. Open the goal-contribution modal and click its backdrop.
6. Open the debt-payment modal and click its backdrop.
7. Trigger a banner and a toast and compare their structure.

**Test Data:** None.

**Expected Result:**
- Each label is programmatically associated with its control, so clicking the label focuses the field and a screen reader announces the label with the control.
- The hint is **hidden when an error is present** for that field, and the invalid field carries `aria-invalid` and a danger border.
- A progress bar carries `role="progressbar"` with `aria-valuenow`, `aria-valuemin=0` and `aria-valuemax=100`, with the value clamped to 0–100.
- A confirm dialog cancels on **Escape**, on a backdrop click and on **Cancel**; the initial focus lands on **"Cancel"**, not the destructive action.
- The goal-contribution modal closes on a backdrop click; the debt-payment modal does **not** — only **Escape** closes it. Log the inconsistency.
- The banner has `role="alert"` with three stacked lines (what / why / fix) and a **"Dismiss"** button, and auto-dismisses after about 3 s (6 s for errors). The toast has `role="status"` with at most two lines (what / why) and auto-dismisses after about 1.5 s (4 s for errors).

**Automation:** `test/e2e/ui_tests/runtime.spec.ts` → "FIN-R03 Accessibility and UI conventions"

### Exploratory charters

> The six cases below are time-boxed and goal-directed. They report **observations with evidence**, not pass/fail. A session that finds nothing still records that the area was walked.

### FIN-X01: First-run walkthrough

**Type:** Edge · **Priority:** Medium

**Precondition:** A fresh browser profile with zero data.

**Steps:**
1. Time-box to 25 minutes.
2. Open `#/` and read the Home banner.
3. Follow **"Start using Finora →"** to `#/onboarding`.
4. Click **"Get started"**.
5. Add the first account and record the first transaction.
6. Note every confusion, dead end and unexplained message.

**Test Data:** None.

**Expected Result:**
- An observation log with evidence for each confusion, dead end or unexplained message — no pass/fail verdict.
- Specifically check:
  - Two distinct **"Welcome to Finora."** surfaces exist — the onboarding screen and the Home banner — with different copy. Record which one appears on a fresh install.
  - The **"Insight"** H1 (singular) against Home's **"See full Insights →"**.
  - PRD §8.1 describes onboarding as *"two screens, one number"* that seeds a **Cash** account. The build ships a 3-step explainer with a **"Get started"** button and creates **no account** — so the first-run path to a working app costs one extra manual step.

**Automation:** Not automated — exploratory charter, not a pass/fail case

### FIN-X02: Ledger consistency across screens

**Type:** Edge · **Priority:** High

**Precondition:** Every entity type is seeded.

**Steps:**
1. Time-box to 40 minutes.
2. Create one instance of each entity type.
3. Compare the account balances on **Accounts** against Home's **"Cash"** tile and against Insight's **"Net worth"** card.
4. Compare each debt's outstanding against its linked transactions.
5. Compare each investment's **"Now"** and **"At maturity"** against the ledger.
6. Recompute the four Insight cards by hand from the raw transactions for the same range.

**Test Data:** None.

**Expected Result:**
- One consistent story, or a log of every figure two screens report differently — each entry naming the two screens and the two amounts.
- The reconciliation must hold for the net-worth identity: cash + active investments (current) + receivables − money owed.

**Automation:** Not automated — exploratory charter, not a pass/fail case

### FIN-X03: Destructive-action audit

**Type:** Edge · **Priority:** High

**Precondition:** Data is present across all entity types.

**Steps:**
1. Time-box to 30 minutes.
2. Trigger every destructive action: delete transaction · delete account (blocked) · delete goal · delete debt · delete investment · delete event plan · delete event category · delete month-plan item · close investment · roll over an investment · sign out · wipe all data · the forgot-PIN wipe · import backup · disable PIN.

**Test Data:** None.

**Expected Result:**
- For each action, a record of:
  - Is there a confirmation dialog?
  - Does the body name exactly what is lost?
  - Are local and cloud distinguished?
  - What is **preserved**?
  - Does the copy match the actual behaviour?
- The destructive actions to watch hardest are **delete debt** (a hard delete, not the PRD's soft-archive) and **sign out** (a destructive local wipe with no confirmation at all).

**Automation:** Not automated — exploratory charter, not a pass/fail case

### FIN-X04: Copy review

**Type:** Edge · **Priority:** Medium

**Precondition:** The app is running with data present.

**Steps:**
1. Time-box to 30 minutes.
2. Read every user-visible string as a copywriter and flag anything unclear, wrong or inconsistent.

**Test Data:** None.

**Expected Result:**
- A list of flagged strings with the screen and the suggested correction, covering at least:
  - Terminology drift — **"Insight"** vs **"Insights"**; the list chips **"Payouts"** / **"Debt payments"** against the row pills **"Payout"** / **"Debt payment"**; **"Investment Planner"** against the real **"Investments"** screen.
  - Dead copy — *"archive them"* when no archive exists; *"Pick a date in the future"* when no future-date validation exists; the sync-disabled message naming the wrong environment variables.
  - Banner **fix** lines that do not fix — *"Tap Save plan to keep the change."* on a screen with no **Save plan** button.
  - Empty states with and without a CTA.
  - The dropdown/card label-case difference.

**Automation:** Not automated — exploratory charter, not a pass/fail case

### FIN-X05: Layout stress

**Type:** Edge · **Priority:** Medium

**Precondition:** Seed data is present.

**Steps:**
1. Time-box to 25 minutes.
2. View the app at 1440×900, 1024×768, 768×1024, 375×812 and 320×568.

**Test Data:** None.

**Expected Result:**
- No clipped, overlapping or unreadable content at any width.
- Check specifically: the 3-column transfer form (From → To) at 375 px and 320 px · a 60-character account name · amounts of ৳12,34,567 · the amortization table at 320 px · the Month Plan batch sheet on mobile · long event names in the timeline · the About panel's privacy text at 320 px.

**Automation:** Not automated — exploratory charter, not a pass/fail case

### FIN-X06: Unusual but legal values

**Type:** Edge · **Priority:** Medium

**Precondition:** The app is running.

**Steps:**
1. Time-box to 30 minutes.
2. Enter unusual but legal values throughout the app.

**Test Data:**
- Amounts `0.01`, `999999999`, `2.5e2`
- A 60-character account name
- A goal target of `1`
- A debt term of 1 month
- An investment term of 1 day
- A start date of 31 January (the month-end clamp)
- A note containing emoji and Bengali (**বাংলা**)
- A category named like a default (case-insensitive merge)
- A future-dated contribution
- A past due date

**Expected Result:**
- No crash, no wrong math, no overflow, no mojibake and no silently dropped data.
- The month-end clamp resolves 31 January plus one month to 28 February.

**Automation:** Not automated — exploratory charter, not a pass/fail case
