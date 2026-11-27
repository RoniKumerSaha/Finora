# Finora — Manual Test Plan

**Application:** Finora V1 — Bangladesh-first personal finance / bookkeeping web app
**Version under test:** `1.0.0` (per `package.json`; About panel falls back to `v1.0.0` when `VITE_APP_VERSION` is unset)
**Stack:** React 18 · TypeScript · Vite · Tailwind v4 (dark theme only) · Zustand · Dexie/IndexedDB (`finora` DB, single-blob row `state`) · React Router v7 in **hash mode** · optional Supabase cloud sync
**Test type:** Manual (exploratory + scripted functional)
**Owner:** _(fill in)_
**Last run:** _(fill in)_

---

## 1. Scope

### 1.1 In scope

Every route and feature reachable from the app shell:

| Area | Routes |
|---|---|
| Shell / navigation | `#/home`, drawer behaviour, mobile topbar, 404 |
| Home | `#/home` |
| Insight | `#/insights` |
| Transactions | `#/transactions`, `#/transactions/new`, `#/transactions/new/{expense,income,transfer}`, `#/transactions/:id/edit` |
| Accounts | `#/accounts`, `#/accounts/add`, `#/accounts/:id/edit` |
| Goals | `#/goals`, `#/goals/add`, `#/goals/:id` |
| Debts | `#/debts`, `#/debts/add`, `#/debts/:id/edit` |
| Investments | `#/investments`, `#/investments/add`, `#/investments/:id`, `#/investments/:id/edit` |
| Plan | `#/plan`, `#/plan/month`, `#/plan/event`, `#/plan/event/:id`, `#/plan/invest`, `#/plan/invest/new`, `#/plan/invest/:id`, `#/plan/loan`, `#/plan/loan/:id` |
| Settings | `#/settings` (Security, Cloud sync, Backup, Danger zone, About) |
| Onboarding | `#/onboarding` |
| Security | PIN set / change / disable, lock screen, rate limiting |
| Cloud sync | sign in, sign up, sign out, change password, password recovery, sync status, four wipe flows |
| Persistence | IndexedDB persistence, reload survival, export / import backup, legacy `localStorage` migration |

### 1.2 Out of scope

- Automated / Playwright test authoring (this document is the manual source of truth).
- Backend / Supabase internals beyond the observable sync behaviour (RLS policy SQL, GoTrue configuration).
- Real banking integrations — the app has none.
- Visual-regression pixel baselines. Layout is only checked qualitatively (see §9).
- Non-Chrome browsers beyond a smoke pass. The app is a local-first SPA with no browser-specific APIs beyond IndexedDB and `BroadcastChannel` (Chromium-recommended).

### 1.3 Product behaviours that do **not** exist

Verified absent in source. **Do not write test cases for these** — if a requirement document mentions them, log them as gaps.

1. No search field, category filter, account filter, date-range filter, sort control, or totals summary on the Transactions list. The only control dimension is 8 mutually-exclusive filter chips.
2. No category create / rename / delete UI. The only category mutation is the additive **"Restore default categories"** recovery button on the Add Transaction form.
3. No account `institution`, `notes`, or user-selectable `colour` field.
4. No on-screen 3×4 PIN keypad (doc comments claim one exists; only the 6-box masked input is implemented).
5. No PIN recovery by email / OTP — the only recovery path is a full data wipe.
6. No Month Plan rollover or month selector — only the current calendar month is editable.
7. No recurring-transaction insight on the Insight screen.
8. No Goals / Debts / Investments widgets on the Insight screen (the domain helpers exist but are not rendered).
9. No amortisation schedule table on the Debts screens (it exists only in the Loan Calculator scratchpad).
10. No "projected portfolio value over time" chart in the Investment Planner (maturity value + composition donut only).
11. No standalone "Delete cloud copy" UI button — `deleteCloudCopy()` is only reachable via the signed-in wipe flow.
12. No toast on account add / edit (silent redirect only).

---

## 2. Test environment

### 2.1 Setup

```bash
npm install
npm run dev        # http://localhost:5173 (next free port if busy)
```

Cloud sync is **opt-in** and requires build-time env vars:

| Var | Purpose | Required format |
|---|---|---|
| `BASE_URL` | Supabase project URL | `http://127.0.0.1:54321` (local stack) or `https://<project-ref>.supabase.co` |
| `BASE_ANON_KEY` | Supabase anon key | **JWT format** (`eyJ…`). `sb_publishable_…` is rejected by GoTrue with `bad_jwt: missing sub claim`. |

```bash
supabase start
supabase db reset    # creates the `finora_state` table
```

Without these vars the build ships without sync and Settings → Cloud sync shows **"Cloud sync is disabled in this build."**

### 2.2 Browsers & viewports

| Profile | Viewport | Notes |
|---|---|---|
| Desktop | 1440 × 900 | Sidebar ≥ `md` (768px) is a sticky 248px grid column |
| Tablet | 768 × 1024 | Sidebar becomes a fixed off-canvas drawer |
| Mobile | 375 × 812 | Topbar + hamburger; drawer; `px-5` content padding |

### 2.3 Test data

Use a dedicated browser profile. Data lives in IndexedDB (`finora` → `state`), **not** `localStorage`.

| Seed | Values |
|---|---|
| **Accounts** | `Cash` (cash, opening ৳5,000) · `Main Bank` (bank, opening ৳120,000) · `bKash` (mobile wallet, opening ৳2,500) · `Visa Card` (card, opening ৳0) |
| **Income txns** | ৳60,000 salary (Main Bank, Salary, 2026-11-01) · ৳12,000 freelance (bKash, Freelance, 2026-11-03) |
| **Expense txns** | ৳1,200 groceries (Cash, Groceries, 2026-11-02) · ৳18,000 rent (Main Bank, Rent, 2026-11-04) · ৳250 fuel (bKash, Fuel, 2026-11-05) |
| **Transfer** | ৳3,000 Cash → bKash (2026-11-06) |
| **Goal** | `Emergency fund`, target ৳50,000, already saved ৳10,000, target date 2027-06-30 |
| **Debt (i_owe, flat)** | `Loan from Rahim`, total ৳20,000, person `Rahim`, account `Main Bank` |
| **Debt (i_owe, loan)** | `Bike loan`, total ৳60,000, 12% APR, 36 months, account `Main Bank` |
| **Debt (owed_to_me)** | `Lent to Karim`, total ৳15,000, person `Karim`, account `Cash` |
| **Investment (FDR)** | `DBBL 1-year FDR`, principal ৳100,000, rate 9%, term 12 months, account `Main Bank`, institution `DBBL` |
| **Investment (DPS)** | `Monthly DPS`, ৳5,000/mo, 8%, 12 months, account `Main Bank` |
| **Event plan** | `Cox's Bazar trip`, 2027-01-15, categories `Hotel` (৳40,000) + `Tickets` (৳12,000) |
| **Month plan** | `Groceries` ৳8,000 · `Rent` ৳20,000 · `Transport` ৳3,000 |
| **Loan projection** | `Car loan`, principal ৳100,000, 9% APR, 12 months, first payment 2026-12-01 |
| **Investment projection** | `DBBL 1-year FDR`, principal ৳100,000, 9%, 12 months |

### 2.4 Feedback channels to watch

| Channel | Where | Duration | Structure |
|---|---|---|---|
| **Banner** (`role="alert"`) | Top-centre, global | success/info 3 s, error 6 s | Three stacked lines: **what** / **why** / **fix**; dismissible via "Dismiss" |
| **Toast** (`role="status"`) | Top-right | success/info 1.5 s, error 4 s | **what** + optional **why** (no *fix*) |
| **Confirm dialog** (`role="dialog"`) | Centred portal, 440px | — | Title / body / Cancel + confirm; Escape cancels, backdrop click cancels, focus lands on Cancel |

Which channel each area uses:
- **Goals** — banners for errors *and* successes.
- **Debts** — banners for errors and delete; **toast** for payment-modal success and edit-screen save.
- **Investments** — banners for errors and contribution/close/rollover/delete successes.
- **Transactions** — toast on add/edit save; banner on delete.
- **Accounts** — banner only on delete failure; no toast on add/edit.

### 2.5 Reset procedure between test runs

1. Settings → Danger zone → **"Wipe all data"** → confirm **"Wipe everything"**, **or**
2. Browser devtools → Application → IndexedDB → delete database `finora`, **or**
3. Devtools → Application → Clear site data (also clears the PIN salt/hash in `localStorage` and rate-limit keys in `sessionStorage`).

---

## 3. Test case index

| Prefix | Area | Section | Cases |
|---|---|---|---|
| `FIN-NAV` | Shell / navigation / routing | §4 | 12 |
| `FIN-ACC` | Accounts | §5 | 18 |
| `FIN-TXN` | Transactions | §6 | 44 |
| `FIN-HOM` | Home | §7 | 10 |
| `FIN-INS` | Insight | §8 | 12 |
| `FIN-GOA` | Goals | §9 | 18 |
| `FIN-DBT` | Debts | §10 | 25 |
| `FIN-INV` | Investments | §11 | 27 |
| `FIN-PLN` | Plan (hub / month / event / invest / loan) | §12 | 48 |
| `FIN-SEC` | Security (PIN) | §13 | 17 |
| `FIN-SYN` | Cloud sync / account | §14 | 19 |
| `FIN-SET` | Settings / backup / danger zone | §15 | 16 |
| `FIN-PER` | Persistence / migration / responsive | §16 | 10 |
| `FIN-A11Y` | Accessibility & UI conventions | §17 | 6 |
| **Total** | | | **282** |

---

## 4. Shell, navigation & routing

### FIN-NAV-01 — Sidebar renders all nine destinations
**Precondition:** App loaded, no PIN set, at least one account exists (no onboarding banner).
**Steps:** Open the app; inspect the left sidebar.
**Expected:** Brand mark + wordmark "Finora" at the top; nav items in this order — Home, Plan, Insight, Transactions, Accounts, Goals, Investments, Debts, Settings. A primary CTA **"+ Add transaction"** is pinned to the bottom of the sidebar.

### FIN-NAV-02 — Active nav item is highlighted
**Steps:** Click **Home**; then click **Investments**.
**Expected:** The active item shows a primary-tinted background, primary-coloured label, and a 4px primary accent bar on its left edge. Only one item is highlighted at a time.

### FIN-NAV-03 — Every nav destination opens
**Steps:** Click each of the nine nav items in turn.
**Expected:** Each renders its own screen with the correct H1 — `Home`, `Plan`, `Insight`, `Transactions`, `Accounts`, `Goals`, `Investments`, `Debts`, `Settings`. The URL hash updates to match. No console errors.

### FIN-NAV-04 — Root redirects to Home
**Steps:** Navigate to `#/`.
**Expected:** The app lands on `#/home` and the Home screen renders.

### FIN-NAV-05 — Unknown route shows the not-found screen
**Steps:** Navigate to `#/this-route-does-not-exist`.
**Expected:** The content area shows **"Not found."** The sidebar remains visible and navigable.

### FIN-NAV-06 — Browser back and forward work
**Steps:** Go Home → Transactions → Accounts; press browser Back twice, then Forward twice.
**Expected:** Each transition renders the expected screen and the active nav item follows.

### FIN-NAV-07 — Hash mode survives a static-file (file://) open
**Steps:** `npm run build`, then open `dist/index.html` directly from disk.
**Expected:** The app boots and all in-app navigation works. Note the router is hash-mode specifically so no SPA rewrite is required.

### FIN-NAV-08 — Mobile drawer opens
**Precondition:** Viewport < 768px.
**Steps:** Tap the hamburger in the mobile topbar.
**Expected:** The drawer slides in from the left over a blurred backdrop; the topbar shows the Finora wordmark centred with a hamburger on the left; the drawer contains the same nine nav items plus the **"+ Add transaction"** CTA and a close "×" button.

### FIN-NAV-09 — Mobile drawer dismisses on every exit path
**Steps (repeat for each):** (a) tap a nav item; (b) tap the backdrop; (c) tap the drawer's "×"; (d) press Escape.
**Expected:** In all four cases the drawer closes and the backdrop disappears.

### FIN-NAV-10 — Drawer locks body scroll while open
**Steps:** Open the drawer on mobile; attempt to scroll the page behind it.
**Expected:** The page behind does not scroll. After closing the drawer, scrolling works again.

### FIN-NAV-11 — "+ Add transaction" is hidden on the add-transaction screens
**Steps:** Open the sidebar CTA → the picker at `#/transactions/new`, then `#/transactions/new/expense`, `#/transactions/new/income`, `#/transactions/new/transfer`.
**Expected:** The **"+ Add transaction"** sidebar CTA is hidden on all four routes (it would duplicate the screen's own submit button). It reappears on any other screen, including `#/transactions/:id/edit`.

### FIN-NAV-12 — Sidebar layout at desktop width
**Steps:** View at 1440 × 900.
**Expected:** The sidebar is a sticky 248px left column with a right border and the brand row divided by a horizontal rule that does not span the full width. The CTA is pinned to the bottom, below a flexible spacer.

---

## 5. Accounts

### FIN-ACC-01 — Accounts list shows the empty state
**Precondition:** No accounts exist.
**Steps:** Open `#/accounts`.
**Expected:** H1 **"Accounts"**, count line **"0 total"**, an illustration, title **"No accounts yet"**, description **"Open an account for cash, a bank, a wallet, or a card. Each account tracks what's there now."**, a **"+ Add your first account"** button, and a **"How accounts work →"** link.

### FIN-ACC-02 — Help overlay opens from the empty state
**Steps:** On the empty Accounts screen, click **"How accounts work →"**.
**Expected:** A modal opens titled **"How accounts work"** with two explanatory paragraphs and a **"Got it"** button. Clicking "Got it" closes it.

### FIN-ACC-03 — Create a cash account
**Steps:** Click **"+ Add your first account"**; enter Name `Cash`; keep Type `cash`; set Opening balance `5000`; click **"Save account"**.
**Expected:** The app returns to `#/accounts`. The new card shows the name `Cash`, type label **"Cash"**, a wallet icon, and **"Balance ৳ 5,000"**. No toast appears (silent redirect — known behaviour).

### FIN-ACC-04 — Account type dropdown options
**Steps:** Open `#/accounts/add`; open the **Type** dropdown.
**Expected:** Exactly five options, rendered **lowercase**: `cash`, `bank`, `mobile wallet`, `card`, `other`. Note the list card later shows Title Case labels (`Cash`, `Bank Account`, `Mobile Wallet`, `Card`, `Other`) — the dropdown wording is deliberately lower-case.

### FIN-ACC-05 — Account type icons and tones
**Steps:** Create one account of each of the five types; compare their cards.
**Expected:** Distinct icons per type (wallet, classical bank with columns, phone-with-card, credit card, 3×3 dot grid). Each card's left accent strip and background wash match the type tone (cash = gold, bank = sage/primary, mobile wallet = blue/info, card = red/danger, other = neutral). Colour is derived from the type automatically — there is no colour picker.

### FIN-ACC-06 — Account name is required
**Steps:** On `#/accounts/add`, leave Name blank, enter an opening balance, observe the **"Save account"** button.
**Expected:** The save button is **disabled**. (Bypass the disabled button via devtools to exercise the banner path: **what** "Account name is required", **why** "Accounts without a name cannot be identified in lists or transactions.", **fix** `Enter a name (e.g. "Cash", "Main Bank").`)

### FIN-ACC-07 — Opening balance cannot be negative
**Steps:** On `#/accounts/add`, enter `-500` in **Opening balance**.
**Expected:** The inline field error **"Amount must be zero or greater."** appears and the field is highlighted with a danger border. **Save account** is disabled.

### FIN-ACC-08 — Empty opening balance is allowed on add
**Steps:** On `#/accounts/add`, enter a name, leave **Opening balance** empty, click **"Save account"**.
**Expected:** The account is created with a balance of ৳ 0.

### FIN-ACC-09 — Empty opening balance is NOT allowed on edit
**Steps:** Edit an existing account; clear the **Opening balance** field.
**Expected:** The inline error **"Amount must be zero or greater."** appears (the edit form requires an explicit value, unlike add).

### FIN-ACC-10 — Edit an account
**Steps:** On `#/accounts`, click a card; change the name and the opening balance; click **"Save changes"**.
**Expected:** The app returns to `#/accounts`; the card shows the new name and the recomputed balance. The edit screen subtitle reads **"Changes apply to this account only."**

### FIN-ACC-11 — Card overflow menu exposes Edit and Delete
**Steps:** On `#/accounts`, click the `⋯` button in a card's top-right corner (aria-label **"Actions for {name}"**).
**Expected:** A menu with **"Edit"** and **"Delete"** (Delete in red). The menu closes on item click, on outside mousedown, and on Escape.

### FIN-ACC-12 — Delete an account with no transactions
**Steps:** Via the overflow menu → **"Delete"**.
**Expected:** Confirm dialog title **"Delete "{name}"?"**, body **"This cannot be undone. Linked transactions must be removed first."**, buttons **"Delete"** (danger) and **"Cancel"**. Confirm → the card disappears, count line updates, no error banner.

### FIN-ACC-13 — Delete an account that has linked transactions
**Precondition:** `Cash` has at least one transaction.
**Steps:** Try to delete `Cash` and confirm.
**Expected:** The account is **not** deleted. A banner appears: **what** `Can't delete "Cash"`, **why** "3 transaction(s) still reference this account.", **fix** "Delete the linked transactions first, or archive them."
> **Known gap:** there is no "archive account" feature, so the suggested fix is not actionable. Also note this banner renders with default **info** styling rather than a danger tone, which can read as non-blocking. Log as a defect candidate.

### FIN-ACC-14 — Cancelling a destructive confirm does nothing
**Steps:** Open the account-delete confirm, press Escape; repeat by clicking the backdrop; repeat by clicking **"Cancel"**.
**Expected:** In all three cases the dialog closes and the account is untouched.

### FIN-ACC-15 — Balance calculation
**Precondition:** `Main Bank` opening ৳120,000; +৳60,000 salary; −৳18,000 rent; ৳3,000 transferred **out**.
**Steps:** Open `#/accounts`; read the `Main Bank` balance.
**Expected:** ৳159,000 (120,000 + 60,000 − 18,000 − 3,000).

### FIN-ACC-16 — Delta line and last-activity metadata
**Steps:** Read the `Main Bank` card's secondary line.
**Expected:** A green **"↑ ৳ 42,000"** followed by **" vs opening"**, plus the last-activity date (**"Today"** / **"Yesterday"** / **"3d ago"** / **"25 Aug 2026"**) and, where applicable, the transaction note or category name. An account with no activity shows **"no activity yet"**.

### FIN-ACC-17 — Accounts list ordering and grouping
**Steps:** Create three accounts of mixed types; open `#/accounts`.
**Expected:** Cards render in **insertion order**, not grouped by type and not sorted. There is no grouping or sort control.

### FIN-ACC-18 — Account not found
**Steps:** Navigate to `#/accounts/does-not-exist/edit`.
**Expected:** Inline text **"Account not found."** with a **"Back to accounts"** link.

---

## 6. Transactions

### 6.1 Transaction list

### FIN-TXN-01 — Transactions list shows the empty state
**Precondition:** No transactions.
**Steps:** Open `#/transactions`.
**Expected:** H1 **"Transactions"**, count line **"0 entries"**, illustration, title **"No transactions yet"**, description **"Record income, expenses, or transfers. Each one updates the account it touches."**, a **"+ Add transaction"** button, and a **"How transactions work →"** link.

### FIN-TXN-02 — Filter chips
**Steps:** Open `#/transactions`; click each chip in turn: **All**, **Income**, **Expense**, **Transfer**, **Payouts**, **Debt payments**, **This month**, **Cash**.
**Expected:** Exactly these eight chips exist. The list filters to match:
- **Income** → only `type === 'income'`
- **Expense** → only `type === 'expense'`
- **Transfer** → only `type === 'transfer'`
- **Payouts** → transactions linked to an investment
- **Debt payments** → transactions linked to a debt
- **This month** → transactions dated in the current calendar month
- **Cash** → transactions touching an account whose **name is exactly** `Cash` (name match, not account type — an account *typed* `cash` but named `Wallet` will not match)

Only one chip is active at a time — the filters are mutually exclusive.

### FIN-TXN-03 — Clicking the active chip resets to All
**Steps:** Click **Expense** (list narrows); click **Expense** again.
**Expected:** The filter resets to **All** and the full list returns.

### FIN-TXN-04 — Empty filter result
**Steps:** Apply a filter that matches nothing (e.g. **Payouts** with no investments).
**Expected:** The message **"No transactions match this filter. Try a different filter, or add a new transaction."**

### FIN-TXN-05 — Date grouping under All
**Steps:** Select **All**.
**Expected:** Rows are grouped under sticky day subheaders formatted as **"25 Aug 2026"**.

### FIN-TXN-06 — Flat list when a filter is active
**Steps:** Select any filter other than **All**.
**Expected:** Rows render as a **flat list with no date subheaders**.

### FIN-TXN-07 — Ordering is date-descending and not user-controllable
**Steps:** Add transactions with different dates; open the list.
**Expected:** Rows are ordered newest date first. There is no sort control — ordering is hardcoded.

### FIN-TXN-08 — Row anatomy
**Steps:** Read a row.
**Expected:** Left icon tile (up arrow = income / down arrow = expense / left-right arrow = transfer), title line = note → else category name → else type, an optional uppercase tag pill, a subtitle (`"Transfer · Cash → bKash"` or `"{account} · {category}"`, or an em-dash `—` when the account is missing), the amount on the right as **"৳ 3,500"** (BDT sign, space, en-IN grouping: 1,00,000), and a chevron on hover. Amounts carry **no** `+`/`−` sign — direction is shown by colour and icon.

### FIN-TXN-09 — Amount grouping uses the Indian system
**Steps:** Record an expense of 1234567.
**Expected:** The row reads **"৳ 12,34,567"** (en-IN grouping), not **"৳ 1,234,567"**.

### FIN-TXN-10 — Tag pills
**Steps:** Create a payout-linked income, a debt-linked expense, and a debt-linked income.
**Expected:** Pills read **"Payout"**, **"Borrowed"** / **"Lent"** (when the note starts with `Debt: `), or **"Debt payment"** / **"Debt received"**. Only one pill per row.

### FIN-TXN-11 — Clicking a row opens the edit screen
**Steps:** Click any row.
**Expected:** The app navigates to `#/transactions/:id/edit` showing H1 **"Edit transaction"** and a subtitle like **"expense · Lunch with team · Aug 12"**.

### FIN-TXN-12 — There is no totals summary
**Steps:** Inspect the Transactions screen header and footer.
**Expected:** Only an entry count is shown — **"7 entries"** (all) or **"3 of 7 entries"** (filtered). No income total, no expense total, no net figure. Log as a gap if the PRD expects totals.

### FIN-TXN-13 — No search, category, account or date filter
**Steps:** Inspect the filter bar.
**Expected:** Only the eight chips exist. No search input, no category/account/date-range filter, no sort control.

### 6.2 Add transaction — picker and shared fields

### FIN-TXN-14 — The type picker
**Steps:** Click **"+ Add"** on the Transactions screen (or the sidebar CTA).
**Expected:** H1 **"What happened?"**, subtitle **"Pick one to continue."**, and three cards: **Income** ("Money received", green up arrow) · **Expense** ("Money spent", red down arrow) · **Transfer** ("Between your accounts", gold left-right arrow).

### FIN-TXN-15 — Add expense — happy path
**Precondition:** `Cash` and `Main Bank` exist.
**Steps:** Picker → **Expense**. Enter Amount `1200`. Select category **Groceries**. Select account **Cash**. Leave Date as today. Note: `Lunch with team`. Click **"Save"**.
**Expected:** A toast appears — **"Transaction added"** / **"Your record is now in the transactions list."** After ~600 ms the app navigates to `#/transactions`. The `Cash` balance decreases by ৳1,200. The new row shows title **"Lunch with team"**, tag-free, subtitle **"Cash · Groceries"**, amount **"৳ 1,200"**.

### FIN-TXN-16 — Add income — happy path
**Steps:** Picker → **Income**. Amount `60000`. Category **Salary**. Account **Main Bank**. Note `September salary`. **"Save"**.
**Expected:** Toast **"Transaction added"**; redirect to `#/transactions`; the `Main Bank` balance increases by ৳60,000.

### FIN-TXN-17 — Amount must be greater than zero
**Steps:** On any add form, clear Amount, then type `0`, then `-250`.
**Expected:** The inline error **"Amount must be greater than zero."** appears under the field; the field turns danger-coloured; **"Save"** is **disabled**. (Bypassing the disabled button raises the banner: **what** "Amount must be greater than zero", **why** "Zero or negative amounts produce empty transactions.", **fix** "Enter a positive number, e.g. 1500.")

### FIN-TXN-18 — Amount accepts decimals, exponents and leading zeros
**Steps:** Try Amount values `12.50`, `2.5e2`, `0250`.
**Expected:** All are accepted as valid (> 0). Try `0`, `0.0`, `-250`, `abc`, `NaN`, `Infinity`, and a whitespace-only value — all rejected.

### FIN-TXN-19 — Expense preset amount chips
**Steps:** On `#/transactions/new/expense`, look below the Amount field.
**Expected:** Helper text **"Tap a preset chip to autofill common amounts."** and five chips: **"৳ 50"**, **"৳ 100"**, **"৳ 250"**, **"৳ 500"**, **"৳ 1,000"**. Tapping one fills Amount. Preset chips appear on the **expense form only** — not on income or transfer.

### FIN-TXN-20 — Amount placeholders per type
**Steps:** Open each of the three add forms.
**Expected:** Placeholders are `250` (expense), `60,000` (income), `5,000` (transfer). The input itself has **no** `৳` prefix — the symbol appears only in the preset chips and balance lines.

### FIN-TXN-21 — Category picker is a grouped chip cloud
**Steps:** On `#/transactions/new/expense`, scroll the Category area.
**Expected:** Only the first group **"Housing"** is shown initially, with a **"Show all 37 categories"** button. Clicking it expands all groups inline and the button becomes **"Hide list"**. Group headings: **"Housing"**, **"Utilities & bills"**, **"Daily life"**, **"Family & health"**, **"Giving & saving"**, **"Fun & occasions"**. The picker is **not searchable**.

### FIN-TXN-22 — Category groups and counts
**Expected:** 37 default expense categories across 6 groups:
- Housing — Rent, Service Charge, Groceries
- Utilities & bills — Utilities, LPG, WiFi, Phone & Internet, Subscriptions, Insurance
- Daily life — Food & Dining, Café, Transport, Fuel, Shopping, Personal Care, Maid
- Family & health — Health, Hospital, EMI, Education, Coaching, Books, Kids, Pets
- Giving & saving — Gifts & Family, Charity, Puja, Investment
- Fun & occasions — Entertainment, Travel, Stay, Party, Birthday, Hobbies, Home

### FIN-TXN-23 — Income category picker is flat
**Steps:** Open `#/transactions/new/income`; scroll the Category area.
**Expected:** All five income categories are visible without any expand control: **Salary**, **Freelance**, **Business**, **Gift**, **Other Income**.

### FIN-TXN-24 — Category is optional and clearable
**Steps:** Select a category; observe the selection state; press the `×` on the selected-category pill.
**Expected:** A **"Selected"** label and a pill with the category name appear. Clicking the chip again does **not** deselect — you must press `×` (aria-label **"Clear selected category"**). A transaction can be saved with no category at all; the row then falls back to the type name as its title.

### FIN-TXN-25 — Account picker and live balance projection
**Steps:** On the expense form, select account `Cash` and enter Amount `500`.
**Expected:** Under the account dropdown: **"Balance: ৳ 5,000"** and **" → projected balance after save: ৳ 4,500"**. Income adds, expense subtracts. The dropdown lists account **names** and is **not searchable**.

### FIN-TXN-26 — Category picker is not searchable
**Expected:** There is no text input in the category area; categories are picked from chips only.

### FIN-TXN-27 — Cancel on the add form returns to the picker
**Steps:** Open the expense form, click **"Cancel"**.
**Expected:** The app navigates to `#/transactions/new` (the **picker**), not the transactions list.

### FIN-TXN-28 — Note field
**Expected:** Expense/income show the label **"Note (optional)"** with placeholders `Lunch with team` (expense) and `September salary` (income). The note field is **absent on the transfer form**.

### FIN-TXN-29 — Restore default categories
**Precondition:** All categories of one type have been removed (not reachable through the UI — requires devtools/import manipulation).
**Steps:** Open the add form of that type.
**Expected:** An amber recovery panel replaces the chips: **"No income categories available. Your saved data is safe — only the category list needs restoring."** with a **"Restore default categories"** button. Clicking it shows the toast **"Default categories restored"**.

### 6.3 Transfers

### FIN-TXN-30 — Transfer happy path
**Precondition:** At least two accounts.
**Steps:** Picker → **Transfer**. From `Cash`, To `bKash`, Amount `3000`. **"Save"**.
**Expected:** Toast **"Transaction added"**; redirect to `#/transactions`. `Cash` decreases by ৳3,000 and `bKash` increases by ৳3,000. **Neither account's income/expense totals change** — a transfer is not income or expense. The row subtitle reads **"Transfer · Cash → bKash"** and the amount is in neutral ink, not green/red.

### FIN-TXN-31 — The To dropdown excludes the From account
**Steps:** On the transfer form, select From `Cash`; open the **To** dropdown.
**Expected:** `Cash` is **not** among the To options. A large left-right arrow glyph sits between the two dropdowns.

### FIN-TXN-32 — Transfer has no date, note, category, debt or investment fields
**Steps:** Inspect the transfer form in full.
**Expected:** Only **From**, **To**, and **Amount** are present. The transfer is saved with today's date.

### FIN-TXN-33 — Transfer amount must be positive
**Steps:** Enter `0` then `-100` in Amount on the transfer form.
**Expected:** Inline error **"Amount must be greater than zero."**; **"Save"** disabled.

### FIN-TXN-34 — Transfer balance projections
**Steps:** On the transfer form, set From `Cash` (৳5,000), To `bKash` (৳2,500), Amount `1000`.
**Expected:** Under **From**: **"Balance: ৳ 5,000 → projected balance after save: ৳ 4,000"**. Under **To**: **"Balance: ৳ 2,500 → projected balance after save: ৳ 3,500"**.

### FIN-TXN-35 — Single-account edge case
**Precondition:** Exactly one account exists.
**Steps:** Open the transfer form.
**Expected:** The **To** dropdown contains no selectable option (the only account is excluded). Saving must not produce a transfer with identical source and destination. Log the behaviour — the domain layer throws `"Transfer source and destination must differ."` if it is ever reached.

### 6.4 Edit and delete transactions

### FIN-TXN-36 — Edit a transaction
**Steps:** Open a transaction from the list; change the amount and note; **"Save"**.
**Expected:** Toast **"Transaction saved"** / **"Your changes are now in your records."**; redirect to `#/transactions`; the list shows the new amount and the account balance is recomputed.

### FIN-TXN-37 — Edit form differences from add
**Steps:** Open the edit screen and compare against the add screen.
**Expected:**
- No preset amount chips.
- No balance / projected-balance lines.
- Category label is **"Category"** (no "(optional)" suffix) with no hint.
- Note label is **"Note"** with the hint **"Add or change a note. Leave blank to remove."**
- A **"🗑 Delete"** button appears on the left of the action row.
- **"Cancel"** returns to `#/transactions` (not the picker).

### FIN-TXN-38 — Transaction type is locked on edit
**Steps:** Open the edit screen for an expense.
**Expected:** There is **no** type selector. The subtitle shows the type as a static label. A transaction's type cannot be changed after creation.

### FIN-TXN-39 — Delete a transaction
**Steps:** Open a transaction, click **"🗑 Delete"**.
**Expected:** Confirm dialog: title **"Delete this entry?"**, body **"This permanently removes this transaction from your records. This cannot be undone."**, buttons **"Delete"** (danger) / **"Cancel"**. Confirm → banner **what** "Transaction deleted", **why** "The entry is gone from your records.", **fix** "Open Transactions to see the updated list." The app navigates to `#/transactions` and the account balance is restored.

### FIN-TXN-40 — Transaction not found
**Steps:** Navigate to `#/transactions/does-not-exist/edit`.
**Expected:** H1 **"Transaction not found"** with a **"Back to transactions"** button.

### FIN-TXN-41 — Linked debt on an expense
**Precondition:** At least one active debt.
**Steps:** On the expense form, open **"Linked debt (optional)"**.
**Expected:** Options include **"— None —"** and each debt, with the hint **"Tag this transaction as a payment toward a debt."** and a **"Remaining: ৳ N"** line beneath. Selecting a debt clears any selected linked investment (only one link may exist).

### FIN-TXN-42 — Linked investment on an income
**Precondition:** At least one non-closed investment.
**Steps:** On the income form, open **"Linked investment (optional)"**.
**Expected:** Hint **"Selecting one routes the money to that investment's payout account."** Selecting an investment **auto-switches the Account** to that investment's payout account and shows **"Current value (projection): ৳ N"** (DPS) or **"At maturity (projection): ৳ N"**.

### FIN-TXN-43 — Payout-account mismatch warning
**Steps:** After selecting a linked investment, manually change the Account to a different account.
**Expected:** A non-blocking amber warning appears: **"Heads up:"** / *"payout account for {inv} is {acc}. You're sending this income to {acc}. Saving will record the payout as Income to {acc}, not {acc}."* Saving is still permitted.

### FIN-TXN-44 — Income linked-debt asymmetry
**Precondition:** A debt with direction `owed_to_me`.
**Steps:** Open the **add income** form — the **"Linked debt (optional)"** field is present for `owed_to_me` debts. Then open the **edit** form of an income transaction.
**Expected:** The edit form does **not** render the linked-debt select. Log this as an inconsistency (add/edit parity defect candidate).

---

## 7. Home

### FIN-HOM-01 — Home layout
**Steps:** Open `#/home`.
**Expected:** H1 **"Where is my money?"**, a meta line **"Net worth · across 3 accounts · updated just now"**, the Net worth hero + **"This month"** card pair, a four-up stat strip (**Cash**, **Receivables**, **Debts**, **Investments**), an **Accounts** preview card (max 4 accounts, **"Manage →"**), a **"Recent activity"** card (max 4 transactions, **"View all"**), and a **"See full Insights →"** link.

### FIN-HOM-02 — Net worth calculation
**Precondition:** Seed data from §2.3.
**Steps:** Read the Net worth figure.
**Expected:** Assets (sum of account balances + investment current values) minus liabilities (debts you owe minus receivables). When liabilities exceed assets the caption reads **"Liabilities exceed assets"**; otherwise **"Assets minus liabilities"**.

### FIN-HOM-03 — "This month" card
**Expected:** Rows **"Income"**, **"Expenses"**, **"Net saved"**, computed from transactions dated in the current calendar month.

### FIN-HOM-04 — Stat strip captions
**Expected:** **Cash** — "No accounts yet" when empty, otherwise "Sum of money across N accounts". **Receivables** — "no money owed to you" / "Owed by N people". **Debts** — "no active debts" / "You owe across N debts". **Investments** — "none yet" / "Locked in N active schemes".

### FIN-HOM-05 — Accounts preview empty state
**Precondition:** No accounts.
**Expected:** Card title **"No accounts yet"**, body **"Add an account to track balances, transactions, and net worth."**, CTA **"+ Add an account"**.

### FIN-HOM-06 — Recent activity empty state
**Precondition:** No transactions.
**Expected:** Card title **"No transactions yet"**, body **"Record income, expenses, or transfers to see them here."**, CTA **"+ Add a transaction"**.

### FIN-HOM-07 — Recent activity is a 4-item preview
**Precondition:** 6 transactions.
**Expected:** Only the 4 newest appear. **"View all"** navigates to `#/transactions` for the full list.

### FIN-HOM-08 — Accounts preview is a 4-item preview
**Precondition:** 6 accounts.
**Expected:** Only the first 4 appear. **"Manage →"** navigates to `#/accounts`.

### FIN-HOM-09 — Demo banner on a fresh install
**Precondition:** No accounts.
**Steps:** Open `#/home` on a fresh install.
**Expected:** A banner reads **"Welcome to Finora."** / **"Set up your first account to start tracking."** with a **"Start using Finora →"** CTA and a dismiss **×** (aria-label "Dismiss banner").
> **Note:** there are two different "Welcome" surfaces — the onboarding screen (`#/onboarding`, **"Welcome to Finora."** + three numbered steps + **"Get started"**) and this Home banner with different copy. Verify which one a fresh install actually shows and log the duplication.

### FIN-HOM-10 — Home meta line is static
**Steps:** Make a change, then read the meta line.
**Expected:** It still says **"updated just now"** — the string is hard-coded, not a live timestamp. Log as a cosmetic defect.

---

## 8. Insight

### FIN-INS-01 — Range pills
**Steps:** Open `#/insights`.
**Expected:** H1 **"Insight"** (singular — note the mismatch with the Home link **"See full Insights →"**) and a row of range pills: **"This month"**, **"Last 3 months"**, **"Last 6 months"**, **"Last 12 months"**, **"All time"**. The default is **Last 6 months**.

### FIN-INS-02 — Range selection persists
**Steps:** Select **"Last 12 months"**; reload the page.
**Expected:** The range remains **"Last 12 months"** (persisted in `localStorage` key `finora.insights.range`).

### FIN-INS-03 — Cash flow card
**Expected:** Heading **"Cash flow"**, sub **"Income & expense by month"**, legend **"Income"** / **"Expense"**, and a net line **"Net cash flow +৳X"**. If more than 12 months are in range, a note reads **"Showing last 12 of N months"**. The chart is a hand-rolled inline SVG line chart (no charting library).

### FIN-INS-04 — Cash flow empty state
**Precondition:** No transactions in the selected range.
**Expected:** **"No transactions in this period."** with an **"Add a transaction"** CTA.

### FIN-INS-05 — Spending by category card
**Expected:** Heading **"Spending by category"** with a **"Total ৳X"**. Only the **top 6** categories are broken out, with the remainder aggregated as **"Other"**; transactions with no category are counted under **"Unknown"**. Empty state: **"No expenses in this period."**

### FIN-INS-06 — Net worth card
**Expected:** Heading **"Net worth"**, end label **"Now"**, series capped at 12 points, hint **"Hover any bar for that month's figure."** Empty state: **"No balance history in this period."** with an **"Add an account"** CTA.

### FIN-INS-07 — Trends card rows
**Expected:** Heading **"Trends"**, sub **"Aggregates over the chosen range"**, and four rows:
1. **"Average monthly expense"** — sub "Total out across months with activity"
2. **"Savings rate"** — sub "(income − expense) ÷ income · 0 if no income"
3. **"Days of runway"** — sub "Cash ÷ daily avg expense · at current burn"
4. **"Investment growth"** — sub "Active schemes · maturity − contributed"; empty → **"No active investments yet"**

### FIN-INS-08 — Trends comparison caption
**Steps:** Have at least two consecutive ranges with data.
**Expected:** A caption such as **"↑12% vs previous 6 months"** appears above the rows.

### FIN-INS-09 — Trends footnote
**Expected:** A footnote **"Goal / Debt / Investment lists live on their own screens"** with links **"Goals"**, **"Debts"**, **"Investments"** that navigate to those screens.

### FIN-INS-10 — Hover tooltips on charts
**Steps:** Hover a cash-flow point and a net-worth bar.
**Expected:** The corresponding month's figure is shown for both charts.

### FIN-INS-11 — Range change re-computes every card
**Steps:** Switch from **"All time"** to **"This month"**.
**Expected:** All four cards recompute for the new range and empty states appear where the narrower range has no data.

### FIN-INS-12 — Absent insight types
**Steps:** Inspect the Insight screen for recurring-transaction detection and goal/debt/investment widgets.
**Expected:** Neither is present. The domain layer contains helpers for them, but they are not rendered. Log as a gap against any requirement that expects them.

---

## 9. Goals

### FIN-GOA-01 — Goals list empty state
**Precondition:** No goals.
**Steps:** Open `#/goals`.
**Expected:** H1 **"Goals"**, count **"0 total"**, illustration, title **"Save toward something"**, description **"Set a target amount and a date. We'll tell you how much to save each month."**, CTA **"+ New goal"**, and a **"How goals work →"** link.

### FIN-GOA-02 — Create a goal
**Steps:** **"+ New goal"**. Name `Emergency fund`. **Already saved** `10000`. **Target amount** `50000`. **Target date** `2027-06-30`. **"Save goal"**.
**Expected:** The app returns to `#/goals`. The card shows **"৳ 10,000 / ৳ 50,000"**, **"by 30 Jun 2027"**, a progress bar at 20%, and the line **"Need ৳ 8,000 more"** plus **"৳ 8,000/mo"**.

### FIN-GOA-03 — Goal field validation
**Steps:** On `#/goals/add`, clear **Target amount**, then `0`, then `-1`.
**Expected:** Inline error **"Amount must be greater than zero."**; **"Save goal"** disabled. Clear **Already saved** → inline error **"Amount must be zero or greater."** (empty is invalid here — the field is effectively required).

### FIN-GOA-04 — Goal name is required
**Steps:** Clear the Name field.
**Expected:** **"Save goal"** is disabled. (Bypass to see the banner: **what** "Goal name is required", **why** "Goals without a name cannot be tracked.", **fix** `Enter a name (e.g. "Emergency fund").`)

### FIN-GOA-05 — Target date is required but not future-checked
**Steps:** Clear **Target date** → **"Save goal"** disabled. Then enter a date **in the past** (e.g. `2020-01-01`) and save.
**Expected:** The past date is **accepted** — no future-date validation exists in the screen, even though the banner copy says *"Pick a date in the future."* Log as a defect (copy/behaviour mismatch).

### FIN-GOA-06 — "Already saved" seeds a first contribution
**Steps:** Create a goal with **Already saved** = `10000`.
**Expected:** The goal's contribution history contains one entry dated today with note **"Starting balance"** and amount ৳10,000.

### FIN-GOA-07 — Goal detail screen
**Steps:** Click the goal card.
**Expected:** H1 = goal name; a **"+ Add a contribution"** button and an **"Edit"** button; a progress card with **"Saved so far"** ৳10,000, **"Target"** ৳50,000, the progress bar, **"20% complete"** and **"৳ 40,000 remaining"**; and a **"By the numbers"** card with **"Required per month"**, **"Target date"**, **"Contributions"** and **"Created"**.

### FIN-GOA-08 — Contribution history section
**Steps:** Scroll the goal detail.
**Expected:** A **"Contribution history"** section listing contributions **newest date first**, each showing the amount then `"{date} · {note}"` (note appended only when present), with a **"Remove"** button per row. The section is hidden entirely when there are no contributions.

### FIN-GOA-09 — Add a contribution
**Steps:** On the goal detail, click **"+ Add a contribution"**.
**Expected:** A modal titled **"Add a contribution"** with sub **"Records the amount you've set aside toward this goal. Your account balance is not changed."**, fields **Amount** (placeholder `5000`), **Date** (today), **Note (optional)** (placeholder `December saving…`), and buttons **"Cancel"** / **"Add contribution"**.

### FIN-GOA-10 — Contribution does not move account balances
**Steps:** Record the `Cash` balance; add a ৳5,000 contribution; re-read the `Cash` balance.
**Expected:** The balance is **unchanged**. A success banner appears: **what** "৳ 5,000 toward Emergency fund", **why** "Saved as a plan entry — your account balance is unchanged.", **fix** "Saved is now ৳ 15,000 of ৳ 50,000."

### FIN-GOA-11 — Contribution validation
**Steps:** In the contribution modal, enter `0`.
**Expected:** Inline error **"Amount must be greater than zero."**; **"Add contribution"** disabled. (Bypass to see the banner: **what** "Amount must be greater than zero", **why** "You can't contribute nothing.", **fix** "Enter a positive amount.")

### FIN-GOA-12 — Contribution modal dismisses without recording
**Steps:** Open the contribution modal, press Escape; repeat by clicking the backdrop.
**Expected:** The modal closes and **no** contribution is recorded. (Both paths are wired here — contrast with the debt-payment modal, which only handles Escape.)

### FIN-GOA-13 — Remove a contribution
**Steps:** Click **"Remove"** on a contribution row.
**Expected:** Confirm dialog **"Remove this contribution?"** / **"The saved amount goes down by this entry. Your accounts are not affected."** / **"Remove"**. Confirm → banner **"Contribution removed"** / **"The saved amount has been adjusted."** / **"Add a new contribution if you made a mistake."** The saved total and progress bar decrease.

### FIN-GOA-14 — Edit a goal
**Steps:** On the goal detail, click **"Edit"**.
**Expected:** An **"Edit goal"** form with Name / Target amount / Target date and a warn callout: **"Heads up:"** / *"the \"saved so far\" figure above is the sum of your contributions. Editing this goal doesn't change that — add or remove a contribution instead."* The saved amount is **not** editable here. On save → banner **"Goal updated"** / **"Name, target, and date are now in effect."** / **"Your contribution history is unchanged — add or remove a contribution to adjust the saved amount."**

### FIN-GOA-15 — Goal status and pace
**Steps:** Create goals in different states and read their cards.
**Expected:**
- `saved >= target` → **"Goal reached. Nice."** on the card; the **"+ Add a contribution"** button is **hidden** on the detail screen.
- Target date in the past and not completed → pace **"Overdue"**; the detail shows **"Target date passed. Either extend it or close the goal."**
- Pace word **"Pace: Ahead"** / **"Pace: Behind"** is shown at the bottom of the card **only** for the ahead/behind states. On-track, completed and expired hide the word and show only the percentage chip.
- The chip shows the **percent**, with the title attribute `"{pct}% saved vs target pace"`.

### FIN-GOA-16 — Required-per-month edge cases
**Expected:** On the detail card, **"Required per month"** shows **"— done —"** when the goal is complete and **"— past due —"** when the target date has passed with money still outstanding.

### FIN-GOA-17 — Delete a goal
**Steps:** Scroll to the goal's **"Danger zone"**; click **"Delete goal"**.
**Expected:** Confirm **"Delete this goal?"** / *"{n} contribution entries will be removed. This cannot be undone."* / **"Delete goal"**. Confirm → banner **"Goal deleted"** / **"The goal and its contribution history are gone."** / **"Your accounts and transactions were not touched."** and the app navigates to `#/goals`.

### FIN-GOA-18 — Goal not found
**Steps:** Navigate to `#/goals/does-not-exist`.
**Expected:** **"Goal not found."** with a **"Back to goals"** button.

---

## 10. Debts

### FIN-DBT-01 — Debts list empty state
**Precondition:** No debts.
**Steps:** Open `#/debts`.
**Expected:** H1 **"Debts"**, count **"0 active"**, and plain text **"No debts yet."** / **"Add a debt to track who owes whom."**
> **Note:** unlike Goals and Accounts, the Debts empty state has **no CTA button, no illustration and no learn-more link**. Log as a UX consistency gap.

### FIN-DBT-02 — Create a flat debt (I owe)
**Precondition:** At least one account.
**Steps:** **"+ Add"**. Name `Loan from Rahim`. Direction **"I owe (you borrowed)"**. **Total amount** `20000`. **Cash goes into** `Main Bank`. Person `Rahim`. Save.
**Expected:** The app returns to `#/debts`. The card shows the direction tag **"I owe"**, the name, **"You've paid ৳ 0 of ৳ 20,000"**, **"Owed to Rahim"**, **"Remaining"** ৳20,000 and **"of ৳ 20,000 total"**, a 0% progress bar, and a **"Pay now"** button.

### FIN-DBT-03 — Creating a debt creates an opening transaction
**Steps:** After FIN-DBT-02, open `#/transactions` and the `Main Bank` account.
**Expected:** A new transaction of ৳20,000 with type **income**, linked to the debt, noted **"Debt: Loan from Rahim"**. The `Main Bank` balance **increases** by ৳20,000 — borrowed cash lands as Income. The transaction list filter **"Debt payments"** shows it.

### FIN-DBT-04 — Create a debt owed to me
**Steps:** Direction **"Owed to me (you lent)"**, total `15000`, **Cash goes from** `Cash`, person `Karim`.
**Expected:** An opening **expense** transaction of ৳15,000 is created (noted **"Debt: Lent to Karim"**) and the `Cash` balance **decreases** by ৳15,000. The card shows **"They've paid ৳ 0 of ৳ 15,000"**, **"Owed by Karim"**, and a **"Receive now"** button.

### FIN-DBT-05 — The loan toggle is hidden for `owed_to_me`
**Steps:** On the debt add form, set Direction to **"Owed to me (you lent)"**.
**Expected:** The **"Is this a loan with interest?"** checkbox disappears entirely, and any rate/term values are cleared. The toggle is only offered for **"I owe"**.

### FIN-DBT-06 — Create a loan-kind debt
**Steps:** Direction **"I owe (you borrowed)"**, total `60000`, tick **"Is this a loan with interest?"**, **Annual interest rate (%)** `12`, **Term in months** `36`.
**Expected:** The card shows a **"Loan"** pill, **"12% APR · 36mo"**, **"Loan amount ৳ 60,000"**, **"Paid ৳ 0 interest and ৳ 0 principal"**, and a **"Monthly EMI"** figure computed by the standard EMI formula.

### FIN-DBT-07 — Loan rate and term validation
**Steps:** With the loan toggle on, clear the rate, then enter `0`; clear the term, then enter `0`.
**Expected:** Inline errors **"Enter a rate greater than zero."** and **"Enter a term greater than zero."**; **"Save"** disabled. (Bypass to see the banners: **"Enter the annual interest rate"** / *"A loan-kind debt needs a rate so each payment can be split into interest and principal."* / *"Enter the rate as a percentage, e.g. 12 for 12% APR."* and **"Enter the term in months"** / *"A loan-kind debt needs a term so the Pay button can pre-fill with the standard EMI."* / *"Enter the term as a whole number of months, e.g. 36 for 3 years."*)

### FIN-DBT-08 — Debt account is required on add
**Steps:** Leave the account picker empty.
**Expected:** The save button is disabled; the field shows **"Pick an account."**

### FIN-DBT-09 — Debt add screen blocks when no account exists
**Precondition:** Zero accounts.
**Steps:** Open `#/debts/add`.
**Expected:** A modal replaces the form: title **"Add an account first"**, body **"A debt records the cash that gave rise to it. Add an account in Settings → Accounts, then come back to track this debt."**, buttons **"Back"** and **"Open Settings"**.

### FIN-DBT-10 — The debt card opens the slip, and Edit opens the form
**Steps:** Click a debt card.
**Expected:** The app navigates to `#/debts/:id` — a read-only **slip** with H1 **the debt's name**, the certificate (terms, stamp, figures) and the Activity ledger. The screen is for **reading**; it carries an **"Edit"** button in its header. Clicking **"Edit"** navigates to `#/debts/:id/edit` with H1 **"Edit debt"**.

### FIN-DBT-11 — Edit screen has no account picker
**Steps:** Inspect the edit form.
**Expected:** Direction, Name, Total amount, Person (optional), Due date (optional) and the loan toggle. The account picker from the add form is **absent**. The form's back-link and the **"Cancel"** button both return to the slip at `#/debts/:id`.

### FIN-DBT-12 — Record a flat payment
**Steps:** On the flat debt card, click **"Pay now"**.
**Expected:** Modal title **"Pay toward "Loan from Rahim""**, sub **"Outstanding: ৳ 20,000"**, fields **Amount** (empty, hint **"Enter whatever you paid."**), **Date** (today), **Paid from** (defaulted to the most recent transaction's account, else the first account), **Note (optional)** (placeholder `e.g. Partial payment`), buttons **"Cancel"** / **"Record payment"**.

### FIN-DBT-13 — Record a payment and check the balances
**Steps:** Enter Amount `5000`, account `Main Bank`, note `Part payment`; **"Record payment"**.
**Expected:** A toast appears — **what** "Payment paid — ৳ 5,000", and the app returns to `#/debts`. The `Main Bank` balance decreases by ৳5,000 (the **gross** payment). The debt card updates: **"You've paid ৳ 5,000 of ৳ 20,000"**, **"Remaining"** ৳15,000, progress bar 25%.

### FIN-DBT-14 — Record a loan payment and the interest/principal split
**Steps:** On the loan debt card, click **"Pay now"**.
**Expected:** The Amount field is **pre-filled** with the standard EMI for the term; hint **"Pre-filled with the standard EMI for {term}-month term. Adjust if you paid a different amount."** Below, a live preview **"This payment will be split as:"** with *"{interest} interest · {principal} principal"*.
**After recording:** the toast reads **"Payment paid — ৳ {interest} interest, ৳ {principal} principal"** with **"Outstanding reduced from ৳ X to ৳ Y."** The account balance moves by the **gross** amount; the outstanding drops by the **principal portion only**. Only the gross transaction is stored — the split is derived.

### FIN-DBT-15 — Underpayment warning
**Steps:** On a loan debt, enter an Amount smaller than one month's interest.
**Expected:** A warn chip **"Underpayment — this didn't cover the month's interest."** appears in the preview, and the success toast appends **" — underpayment: this didn't cover the month's interest."** The outstanding does not reduce.

### FIN-DBT-16 — Payment validation
**Steps:** In the payment modal, enter `0`; then clear the account.
**Expected:** Inline error **"Amount must be greater than zero."**; **"Record payment"** disabled. (Bypass to see the banners: **"Amount must be greater than zero"** / **"Enter a positive number."** and **"Pick an account"** / **"A payment has to land somewhere."** / **"Choose the account this payment came from / went to."**)

### FIN-DBT-17 — Payment modal blocks when no account exists
**Precondition:** A debt exists but all accounts were deleted (impossible via UI — accounts with transactions cannot be deleted; use devtools).
**Expected:** Modal **"Add an account first"** / **"Payments need an account to debit or credit. Add an account in Settings → Accounts, then come back to record this payment."** / **"Got it"**.

### FIN-DBT-18 — Debt Activity feed
**Steps:** On a debt with payments, open the edit screen.
**Expected:** An **"Activity"** card on the right with stats **"Payments"**, **"Total paid"**, **"Last payment"**; rows newest first, tagged **"Payment"** / **"Received"** / **"Reversal"** / **"Adjust"**, formatted `{TAG} · {date}` on the left and the amount on the right, with the account name and note on the second line. Loan-kind debts additionally show the per-row split `"{interest} int · {principal} princ"`. Footer: **"Payments you make toward this debt. Recorded as expenses tagged with this debt — usually via Add transaction → Expense."**

### FIN-DBT-19 — Fully-paid callout
**Steps:** Pay a flat debt in full.
**Expected:** The edit screen shows a callout **"Fully paid."** plus **"Last transaction used {accountName} — current balance: ৳ {balance}."** The sub-description becomes **"This debt is fully paid. Editing the total keeps the record accurate."** The debt moves to the **"Completed (n)"** section of the list, shown as *"{total} paid off"* plus optional person and account name.

### FIN-DBT-20 — Debts Summary card
**Steps:** Open `#/debts` with at least one `i_owe` and one `owed_to_me` debt.
**Expected:** A sticky **"Summary"** card with **"You owe"** (danger) and **"Owed to you"** (primary), each with a sub-line **"Across N debt(s)"**. The footer **"How it works:"** explains the opening-transaction behaviour. If any active debt is loan-kind, an extra paragraph is appended explaining the interest/principal split. The summary card is hidden entirely when nothing is outstanding.

### FIN-DBT-21 — Changing a loan debt to flat
**Steps:** On a loan-kind debt's edit screen, untick **"Is this a loan with interest?"** and save.
**Expected:** A confirm dialog appears: **"Treat this debt as a flat IOU?"** / **"Past payments will be reinterpreted 1-for-1 going forward. The transaction records themselves stay unchanged."** / **"Save as flat"**. Cancelling aborts the save.

### FIN-DBT-22 — Delete a debt
**Steps:** On the edit screen, scroll to **"Danger zone"** and click **"Delete debt"**.
**Expected:** Confirm **"Delete "{name}"?"** with body *"{n} linked transaction(s) stay in your records. Only the debt record is removed."* (or **"The debt record is removed. No transactions are linked."**) and a **"Delete debt"** button. Confirm → banner **"Debt deleted"** / *"{n} linked transaction(s) remain in your records."* / **"Open Debts to see the updated list."**
> **Key behaviour:** the linked transactions — including the auto-created opening transaction — **remain in the ledger**, and their balance impact persists. Verify the account balance after the deletion.

### FIN-DBT-23 — Edit a debt and save
**Steps:** Change the name or total and **"Save changes"**.
**Expected:** A toast (not a banner) **"Debt updated"** / **"Changes are saved."** appears; after ~600 ms the app navigates to `#/debts`.

### FIN-DBT-24 — Due date is stored but never shown
**Steps:** Set a **Due date (optional)** on a debt; then browse the list and the edit screen.
**Expected:** The due date is accepted and stored, but it is **never displayed** on any debt screen — it is only used for ordering inside the Insight calculations. Log as a UX gap.

### FIN-DBT-25 — Debt not found
**Steps:** Navigate to `#/debts/does-not-exist/edit`.
**Expected:** **"Debt not found."** with a **"Back to debts"** button.

---

## 11. Investments

### FIN-INV-01 — Investments list empty state
**Precondition:** No investments.
**Steps:** Open `#/investments`.
**Expected:** H1 **"Investments"**, count **"0 total"**, and plain text **"No investments yet."**
> **Note:** no CTA, no illustration, no learn-more link — and the Investments count includes **closed** investments, unlike Debts which counts active and completed separately.

### FIN-INV-02 — Create an FDR
**Precondition:** `Main Bank` exists.
**Steps:** **"+ Add"**. Name `DBBL 1-year FDR`. Type **"FDR (lump-sum, fixed term)"**. Principal `100000`. Rate `9`. Start date today. Term (months) `12`. Account `Main Bank`. Institution `DBBL`. **"Save investment"**.
**Expected:** The app returns to `#/investments`. The card shows a **"FDR"** pill, **"9% · 12mo · DBBL"**, **"Principal ৳ 1,00,000"**, a maturity label of **"Matures in ~1.0y"**, and the right zone showing **"Now"** ৳1,00,000 and **"At maturity"** ৳1,09,000 (simple interest: P × (1 + r × months/12)).

### FIN-INV-03 — Creating an FDR deducts the principal
**Steps:** After FIN-INV-02, check the `Main Bank` balance and `#/transactions`.
**Expected:** The `Main Bank` balance **decreases** by ৳1,00,000 immediately. A linked **expense** transaction exists, dated on the start date, noted **"Principal parked in DBBL 1-year FDR"**, categorised under **Investment**. The **"Payouts"** transaction filter does **not** show it (it is not a payout); it appears under the investment's Activity as a contribution.

### FIN-INV-04 — Live maturity preview on the add form
**Steps:** On `#/investments/add`, fill principal `100000`, rate `9`, term `12`.
**Expected:** A **"Review:"** block appears: **"You'll receive about"** ৳1,09,000 **"at maturity"** **"(projection — actual payout may differ)."** plus the formula line **"Formula: principal × (1 + rate/100 × termMonths/12). Simple interest, no compounding."**

### FIN-INV-05 — DPS hides the principal field
**Steps:** Change Type to **"DPS (monthly installment)"**.
**Expected:** The **Principal** field disappears and **"Monthly contribution"** appears instead. For DPS, no principal transaction is created at creation time and no money is deducted.

### FIN-INV-06 — Short-term deposit uses days
**Steps:** Tick **"Use days instead of months (for short-term terms < 1 month)"**.
**Expected:** The **"Term (days)"** field replaces **"Term (months)"** (hint: **"For short-term deposits under a month. Maturity = start + this many days."**). The preview formula changes to **"Formula: principal × (1 + rate/100 × termDays/365). Simple interest, no compounding."** The checkbox is **hidden for DPS**.

### FIN-INV-07 — Investment validation
**Steps:** On `#/investments/add`, clear the name; set principal `0`; set rate `-1`; set term `0`; deselect the account on an FDR.
**Expected:** Inline errors **"Amount must be greater than zero."** and **"Rate must be a non-negative number."**; **"Save investment"** disabled. (Bypass for the banners: **"Investment name is required"**, **"Principal must be greater than zero"** / *"FDR and savings need a lump-sum principal."*, **"Monthly contribution is required"**, **"Rate must be a non-negative number"** / *"Negative rates aren't supported in V1."*, **"Term must be a positive number of months"**, and **"Account is required for FDR and savings"** / *"The principal is deducted from this account on creation — without one, the money would silently appear in both the account and the investment."*)

### FIN-INV-08 — Rate 0 is allowed
**Steps:** Set Rate to `0`.
**Expected:** Accepted (rate must be ≥ 0, not > 0). The maturity value equals the principal.

### FIN-INV-09 — Interest rate is not capped at 100
**Steps:** Enter a rate of `150`.
**Expected:** Accepted by the form. Only the unused zod schema caps at 100. Log as a low-severity validation gap.

### FIN-INV-10 — Create a DPS
**Steps:** Type **"DPS (monthly installment)"**, name `Monthly DPS`, monthly contribution `5000`, rate `8`, term `12`, account `Main Bank`. Save.
**Expected:** The app returns to `#/investments`. The card shows a **"DPS"** pill, **"8% · 12mo"**, **"৳ 5,000/mo"**, and the right zone **"Now"** ৳0 (no contributions yet) with **"At maturity"** ৳64,190 (annuity-due: M × ((1+r)^T − 1)/r × (1+r)). No account balance changes yet.

### FIN-INV-11 — Add a DPS contribution
**Steps:** Open the DPS detail; click **"+ Add a contribution"**.
**Expected:** Modal **"Add a contribution"** / **"Records an expense from the chosen account and links it to this DPS."** with **Amount** (placeholder = the plan amount), **Date** (today), **From account**, **Note (optional)** (placeholder `October installment…`), and **"Cancel"** / **"Record contribution"**.
**After saving:** banner **what** "৳ 5,000 toward Monthly DPS", **why** "Recorded as an expense transaction linked to this investment.", **fix** "৳ 5,000 contributed so far." The `Main Bank` balance decreases by ৳5,000 and the DPS current value rises to the compounded figure.

### FIN-INV-12 — DPS contribution validation
**Steps:** Enter `0` in the contribution Amount; then clear the account.
**Expected:** Inline error **"Amount must be greater than zero."**; **"Record contribution"** disabled. (Bypass for the banners: **"Amount must be greater than zero"** / **"You can't contribute nothing."** and **"Pick an account"** / **"Contributions need an account to come from."** / **"Select the source account."**)

### FIN-INV-13 — Investment detail screen
**Steps:** Open an FDR.
**Expected:** H1 = investment name; eyebrow = the raw type (`fdr`); status card with **"Status"** and **"Matures on"**; the **"Maturity"** card with **"Principal"**, **"Estimated payout when the term ends"** / **"Maturity value"**, **"Expected interest"**, **"Rate"**; and the **"When it matures"** card.

### FIN-INV-14 — Maturity value and expected interest
**Expected (FDR ৳100,000 @ 9% for 12 months):** maturity value ৳1,09,000; expected interest ৳9,000. For DPS the formula line reads **"Maturity uses annuity-due: {M} × ((1 + r)^T − 1) / r × (1 + r) where r = {rate}%/12 and T = {term} months."** For FDR/savings: **"Maturity uses simple interest: principal × (1 + rate × years). No compounding."**

### FIN-INV-15 — Current value vs at maturity
**Expected:** For FDR/savings the **"Now"** value equals the principal; the **"At maturity"** line appears on the card **only when `projected − current > 1`**. For DPS the detail screen shows a callout **"What you have now:"** (compounded to today) and **"At maturity:"** (projection if every installment is paid).

### FIN-INV-16 — Record a bank payout
**Steps:** Open a matured/active FDR with a payout account; click **"Record bank payout"**.
**Expected:** The app navigates to the **add income** form with the amount, account and linked investment **pre-filled** and the note **"maturity payout — {name}"**. The button is disabled when there is no payout account or the remaining amount is ≤ 0.

### FIN-INV-17 — No payout account warning
**Steps:** Edit an investment and set **"Payout account (optional)"** to **"— None —"**.
**Expected:** The detail screen shows a warn callout: **"Choose which account receives the money when the bank pays out this {TYPE}."** with an **"Edit the investment"** link.

### FIN-INV-18 — Renew for another term
**Steps:** On an active investment, click **"Renew for another term"**.
**Expected:** Confirm **"Roll over into a new term?"** / **"A new investment is created starting the day after this one matures. Terms and rate carry over."** / **"Roll over"**. Confirm → banner **"{name} rolled over"** / **"A new investment with the same terms starts after maturity."** / **"Open Investments to see the new one."** The old investment's status becomes `rolled_over` (shown with a **"ROLLED_OVER"** pill in the **"Closed"** section) and the new one starts the day after the old maturity.

### FIN-INV-19 — Mark as done
**Steps:** On an investment, click **"Mark as done (no payout)"**.
**Expected:** Confirm **"Close this investment?"** / **"Marks the investment as closed. The record stays for history, but it won't appear in active summaries."** / **"Close investment"**. Banner: **"{name} closed"** / **"It's been moved out of the active list."** / **"Open Investments to see closed items."**
> For DPS, this button is rendered **only when no payout has been recorded**; for FDR/savings it is always shown.

### FIN-INV-20 — Maturity status derivation
**Steps:** Create an investment whose maturity date is in the past.
**Expected:** Its status becomes `matured` (chip **"MATURED"**) and the status card shows **"Matured on"** with the date. An investment with a future maturity is `active` (chip **"ACTIVE"**, label **"Matures on"**). Note `matured` investments are **still counted as held** in summaries.

### FIN-INV-21 — Maturity date month-end clamping
**Steps:** Create an FDR starting 31 Jan 2026 with a 1-month term.
**Expected:** Maturity is **28 Feb 2026** (clamped to the last day of the target month), not 3 Mar.

### FIN-INV-22 — Edit an investment
**Steps:** Open the investment, click **"Edit"**; change rate, term and payout account; **"Save changes"**.
**Expected:** The app returns to `#/investments/:id`. The Edit screen subtitle reads **"Rate, term, and payout destination can change. Past contributions stay as they are."** and the term hint reads **"Changing this shifts the maturity date forward."**

### FIN-INV-23 — DPS monthly contribution locks after contributions
**Steps:** On a DPS with at least one recorded contribution, open **"Edit"**.
**Expected:** The **Monthly contribution** field is **disabled** with the hint **"Locked — {n} contributions already recorded."**
> **Note:** the lock counts **all** linked transactions (contributions *and* payouts), not contributions only — a payout alone will also lock the field. Log as a possible defect.

### FIN-INV-24 — Delete an investment
**Steps:** On the detail screen, scroll to **"Danger zone"**; click **"Delete investment"**.
**Expected:** Confirm **"Delete this investment?"** / *"{n} linked contribution transactions stay in your records. Only the investment record is removed."* / **"Delete investment"**. Banner **"Investment deleted"** / **"Linked contributions remain in your transactions."** / **"Open Home or Transactions to see them."** The linked transactions remain in the ledger and their balance impact persists.

### FIN-INV-25 — Investment Activity card
**Steps:** Open an investment with contributions and/or a payout.
**Expected:** An **"Activity"** card lists rows newest first, each with the amount, `"{date} · {accountName}"` and optionally the note, plus a pill reading **"contribution"** or **"payout"**.

### FIN-INV-26 — Investments Summary card
**Steps:** Open `#/investments` with investments present.
**Expected:** A sticky **"Summary"** card with **"Current value"** (sub **"Money tied up right now"**) and **"At maturity"** (sub **"If every term completes"**, or **"— No future growth —"** when there is none), plus the **"How it works:"** footer explaining current vs maturity value and advising recording the payout as Income.

### FIN-INV-27 — Investment not found
**Steps:** Navigate to `#/investments/does-not-exist`.
**Expected:** **"Investment not found."** with a **"Back to investments"** button.

---

## 12. Plan

### 12.1 Plan hub

### FIN-PLN-01 — Plan hub
**Steps:** Open `#/plan`.
**Expected:** H1 **"Plan"**, sub **"Scratchpads for what you intend to spend. Nothing here is recorded in your ledger — it's a way to think ahead."**, and four rows: **Investments**, **Loans**, **This month**, **Events**. The footer reads **"ⓘ Plans are pure scratch — switch tabs, swap emoji, abandon mid-edit. Nothing here touches your real accounts or transactions."**

### FIN-PLN-02 — Hub row states
**Expected:** **Investments** shows "at maturity" when projections exist. **Loans** shows "/mo EMI". **This month** shows **"budgeted · N item(s)"** or **"nothing planned"**. **Events** shows **"N days away · {name}"**, **"N days ago · {name}"**, or **"no events yet"**.

### 12.2 Month Plan

### FIN-PLN-03 — Month Plan screen
**Steps:** Open `#/plan/month`.
**Expected:** H1 **"Plan my month"**, sub **"Fill the items with budgets for what you intend to spend. Changes save as you go."**, a count chip **"N card(s) in plan"**, a section **"Your items"** with the hint **"· Tap cards to select"**, and the footer **"ⓘ Tap an item to edit it in a pop-up. Changes save automatically."**

### FIN-PLN-04 — Add a month-plan item
**Steps:** Use the picker to add an item.
**Expected:** The modal is titled **"Add new item"** with body **"Pick an icon, name the item, set the budget. You can edit the budget later."** Fields **"Icon"**, **"Name"** (placeholder `e.g. Groceries, Rent, Transport…`), **"Budget (optional)"**; buttons **"Cancel"** / **"Save item"**.

### FIN-PLN-05 — Month-plan name validation
**Steps:** Save an item with a blank Name.
**Expected:** Banner **what** "Name the item", **why** "An item without a name has no plan.", **fix** `Type a name (e.g. "Groceries") then save.`

### FIN-PLN-06 — Set a budget on a card
**Steps:** Tap a card.
**Expected:** A pop-up editor titled **"Set the budget."** with a status pill **"Budget set"** / **"No budget"**, the **"Budget"** field, a **"Clear budget"** button, a **"Save"** button, a **"Done with this item?"** footer and a **"Remove item"** button.

### FIN-PLN-07 — Remove a month-plan item
**Steps:** Delete a card.
**Expected:** Confirm **"Delete "{name}"?"** / **"This item will be removed from this month's plan."** with the danger line **"The budget value for this item is removed."** and a **"Delete"** button.

### FIN-PLN-08 — Batch budget editor
**Steps:** Tap **"Select multiple"**; select cards; tap **"Edit budgets"**.
**Expected:** The floating bar shows **"Tap cards to select"**, **"{n} of {total} selected"**, **"Select all"**, **"All selected"**, **"Clear"**, **"Edit budgets"** and an exit-selection control. The bottom sheet is headed **"Batch update budget"** with tabs **"Custom amounts"**, **"Same amount"**, **"Adjust %"**, **"Clear"**, and an apply button **"Apply to {n} card(s)"**. The custom-amount helper reads **"Type a new budget for each card. Leave blank to skip that card."** with **"Clear all"** and **"Fill all with…"**.

### FIN-PLN-09 — Batch editor empty state
**Steps:** Open the batch sheet with nothing selected.
**Expected:** **"Nothing is selected. Pick a few cards first, then come back here."**

### FIN-PLN-10 — Batch apply feedback
**Steps:** Apply a batch update.
**Expected:** A banner **"{n} card(s) updated"** (or **"{n} card(s) cleared"**) with the fix **"Tap Save plan to keep the change."**

### FIN-PLN-11 — Quick total checker
**Steps:** In the month plan, open **"Quick total"**.
**Expected:** **"Quick total"** / **"Check the cards you'll pay"** / **"Tick items, set your income, see how much you'd save (or overspend). Nothing is saved."** An **"Income"** field, a **"Clear selection"** action, a footer **"N of M selected"**, and totals **"Total ৳X"** and **"Saved ৳X"** / **"Over by ৳X"**. Empty: **"No items in this month's plan yet — open the planner to start."**

### FIN-PLN-12 — Month plan auto-saves and has no rollover
**Steps:** Edit a budget, navigate away, come back, then try to select a different month.
**Expected:** The edit persists without an explicit Save. **There is no month selector and no rollover** — only the current calendar month is editable. Log the absence of rollover as a gap if a budget-carry feature is expected.

### FIN-PLN-13 — Month plan does not touch the ledger
**Steps:** Add month-plan items with large budgets; check the Home balances.
**Expected:** No account balance changes and no transactions are created.

### 12.3 Event Plan

### FIN-PLN-14 — Event list empty state
**Steps:** Open `#/plan/event` with no events.
**Expected:** H1 **"Plan an event"**, sub **"Weddings, trips, Eid, anything with a date and a budget."**, CTA **"+ New event"**, and empty state **"Plan your first event"** / **"Set a date. Add categories with their own budgets — the event's total is the sum of category budgets."**

### FIN-PLN-15 — Create an event
**Steps:** **"+ New event"**. Name `Cox's Bazar trip`. Date `2027-01-15`. Unallocated `80000`. **"Create event"**.
**Expected:** The card shows **"N days to go"**, the name, and **"No budget"** or a category count. Creating with an Unallocated amount seeds a **"🪙" / "Unallocated"** category.

### FIN-PLN-16 — Event validation
**Steps:** Clear the name; clear the date; try each.
**Expected:** Banner **"Event name is required"** / **"Without a name the event cannot be tracked."** / `Enter a name (e.g. "Cox's Bazar trip").` and banner **"Event date is required"** / **"The timeline is anchored to the date."** / **"Pick a date."**

### FIN-PLN-17 — Event total is the sum of category budgets
**Steps:** Open the event; add categories `Hotel` (৳40,000) and `Tickets` (৳12,000).
**Expected:** The header reads **"৳ 52,000 total (sum of categories)"** and the summary strip shows **"Allocated"** and **"Paid"**. The Unallocated field hint reads **"Top-down ballpark. Add categories below to split it; the event's total budget is the sum of categories."**

### FIN-PLN-18 — Event category editor
**Steps:** Add a category, then open its editor.
**Expected:** Sub **"Budget · spent (sum of line items) · due date."**, a **"No budget"** / **"Budget set"** pill, fields **"Budget"** (placeholder `Enter budget`), **"Spent"** (hint **"Sum of all line items below."**), **"Due date"**, a **"Line items"** section with the hint **"Tap the amount field to set the cost for this category."**, a composer with placeholders **"Add a line — e.g. Deposit, Tickets"** / **"Amount"** and an **"Add line item"** control, and a **"Done"** button.

### FIN-PLN-19 — Event category validation
**Steps:** Save a category with a blank name.
**Expected:** Banner **"Name the category"** / **"A category without a name is impossible to track."** / `Type a name (e.g. "Hotel") then save.`

### FIN-PLN-20 — Event timeline
**Steps:** Scroll the event detail.
**Expected:** A **"Timeline"** section (or **"Timeline (past)"**) with relative labels **"today"**, **"tomorrow"**, **"in N days"**, **"N days ago"**.

### FIN-PLN-21 — Event completion callout
**Steps:** Mark every line item of every category as paid.
**Expected:** A callout **"Event completed"** / **"Every line item is paid. {plan.name} is wrapped up."** with **"Spent"** and **"Paid"**.

### FIN-PLN-22 — Event over-budget callout
**Steps:** Make the sum of line items exceed the category budget.
**Expected:** A callout with headline **"Paid past the budget"** (paid exceeds budget) or **"Categories sum past the budget"** (allocations exceed budget), with side labels **"Budget"**, **"Allocated"**, **"Over by"**.

### FIN-PLN-23 — Delete an event category
**Steps:** In the category editor, click **"Delete category"**.
**Expected:** Confirm **"Delete {name}?"** / **"The category and every line item inside it will be removed from this event."** / **"This can't be undone — any amounts you typed are lost."** / **"Delete category"**.

### FIN-PLN-24 — Edit the event date
**Steps:** Click the **"Edit event details"** button.
**Expected:** Modal **"Edit event date"** / **"The event's total budget is the sum of category budgets — edit a category to adjust the total."** with an **"Event date"** field and **"Cancel"** / **"Save changes"**. The total budget is **not** editable here.

### FIN-PLN-25 — Delete an event
**Steps:** Delete an event from the list.
**Expected:** Confirm **"Delete this event plan?"** / **"This is a scratchpad — nothing was recorded in your ledger. The plan and its categories are removed."** / **"Delete"**.

### 12.4 Investment Planner (scratchpad)

### FIN-PLN-26 — Investment Planner list
**Steps:** Open `#/plan/invest`.
**Expected:** H1 **"Investment Planner"**, sub **"Sketch a DPS, FDR, or savings certificate. Nothing here moves real money — it's a sandbox for \"what if I opened a 1-year FDR at 9%?\"."**, CTA **"+ New plan"**.

### FIN-PLN-27 — Investment Planner empty state
**Expected:** **"How much could a 1-year FDR at 9% earn you?"** / **"Pick a starter kit to see the projection. Nothing moves real money — it's a sandbox."** with starter-kit cards labelled **"→ ৳X in 1 year"** / **"→ ৳X in 3 years"**.
> The kit labels read the term in the natural unit — a 12-month kit says **"in 1 year"**, a 36-month kit says **"in 3 years"**.

### FIN-PLN-28 — Starter kits
**Steps:** Open **"+ New plan"**.
**Expected:** Three kits with the copy:
- **"Monthly deposit scheme (DPS)"** — "Small monthly installments. Banks compound the balance monthly until the term ends." (defaults ৳5,000/mo, 8%, 12mo)
- **"Fixed deposit receipt (FDR)"** — "Lump sum locked for a fixed term. Simple interest, paid out at maturity." (৳100,000, 9%, 12mo)
- **"Savings certificate / term deposit"** — "Catch-all for non-DPS, non-FDR interest-bearing instruments." (৳50,000, 7%, 36mo)

Plus a **"Start from a blank form"** option.

### FIN-PLN-29 — Investment plan form
**Steps:** Open a blank plan form.
**Expected:** Fields **"Name"** (placeholder `DBBL 1-year FDR`), **"Type"** (options **"DPS — monthly deposit scheme"**, **"FDR — fixed deposit receipt"**, **"Other (savings certificate / term deposit)"**), **"Monthly installment"** (DPS only) or **"Principal"**, **"Annual rate (%)"** (hint **"Annual interest rate. Capped at 0–100%."**), **"Term"**, **"Start date"**, **"Institution"**.
> **Term** carries a **Months / Years** toggle. The stored term is always a month count — the toggle only changes how it is entered and displayed. Switching the unit preserves the value (**36 months** ⇄ **3 years**).

### FIN-PLN-30 — Investment plan save validation
**Steps:** Save with a missing name, then with a missing/zero amount.
**Expected:** The save control is disabled and the reason is shown: **"Add a name and an amount to save."** / **"Add a name to save."** / **"Enter a positive amount to save."**

### FIN-PLN-31 — Investment plan projection
**Steps:** Open a saved FDR plan (৳100,000 @ 9% for 12 months).
**Expected:** A **"Projection"** hero labelled **"At maturity (projection)"** with a donut legend **"Your money"** / **"Interest earned"**, the line **"Composition at maturity, over 1 year"**, and chips **"You put in"** / **"You earn"** / **"Matures"**. The warning **"ⓘ This is a projection. Actual bank payouts may differ."** is shown. Footer **"Plans never touch your ledger."**
> The composition line reads the term in the natural unit — **"over 1 year"**, **"over 18 months"** — not always in months.
> There is **no** time-series value chart here — only the maturity figure and the composition donut.

### FIN-PLN-32 — Investment plan list card
**Expected:** A type pill (**"DPS"** / **"FDR"** / **"Savings"**), a **"Planned"** pill (tooltip **"This is a projection — no real money is involved."**), a **"Draft"** pill for unsaved plans, meta **"{rate}% · {term} · {institution}"**, a maturity label **"Matures in ~X.Xy"** / **"Matures in Nd"** / **"Matures today"** / **"Matured Nd ago"**, **"Principal ৳X"**, **"· Earns ৳X"**, and right-side **"Now"** / **"At maturity"** values.
> The meta term is compact: **"1y"** for a whole year, **"18mo"** for a sub-year term, **"2.5y"** for 30 months.

### FIN-PLN-33 — Investment planner summary
**Expected:** A **"Summary"** card with **"Your money committed"** (sub **"Across N projection(s)"**), **"If every term matures"** → **"Projected growth ৳X"** (or **"— No projected growth —"**), and a **"How it works:"** footer.

### FIN-PLN-34 — Delete an investment plan
**Steps:** Delete a plan.
**Expected:** Confirm **"Delete this plan?"** / **"The plan is removed. This cannot be undone."** / **"Delete"**.

### FIN-PLN-35 — Investment plan not found
**Steps:** Navigate to `#/plan/invest/does-not-exist`.
**Expected:** **"Plan not found."** with a **"Back to planner"** button.

### 12.5 Loan Calculator (scratchpad)

### FIN-PLN-36 — Loan Calculator list
**Steps:** Open `#/plan/loan`.
**Expected:** H1 **"Loan Calculator"**, sub **"Project what a loan will cost. Enter principal, rate, and term — the app fills the amortization table for you."**, CTA **"+ New projection"**.

### FIN-PLN-37 — Loan Calculator empty state
**Expected:** **"No projections yet"** / **"Try a sample — 100,000 BDT at 9% for 12 months — and see the EMI + total interest computed live."** / **"Start a projection"**.

### FIN-PLN-38 — Loan projection form
**Steps:** Open **"+ New projection"**.
**Expected:** Fields **"Name"** (placeholder `Personal loan`), **"Principal"** (placeholder `100000`), **"Annual rate (%)"** (placeholder `9`), **"Term"**, **"First payment date"**. Hints: **"Total amount borrowed."**, **"Total number of monthly payments. Enter the term in months or years."**, **"When the first EMI is due."**
> **Term** carries a **Months / Years** toggle. The stored term is always a month count — the toggle only changes how it is entered and displayed. A whole-year term opens in Years (a 12-month term reads **"1"**); switching the unit re-expresses the same value (**36 months** ⇄ **3 years**) without losing it.

### FIN-PLN-39 — Loan projection computation
**Steps:** Enter ৳100,000 @ 9% for 12 months.
**Expected:** The **"Summary (projection)"** card shows **"EMI"**, **"Total you pay"** and **"Total interest"**. The warning **"ⓘ Projection only. Actual loan terms may include fees, insurance, or rounding that change the numbers slightly."** is shown.

### FIN-PLN-40 — Amortization table
**Steps:** Scroll to the table.
**Expected:** Heading **"Amortization table"** with columns **"Period"**, **"Due"**, **"Payment"**, **"Interest"**, **"Principal"**, **"Balance"**. Empty state **"Enter a principal and term to see the breakdown."** More than 60 rows → **"Showing first 60 of N rows."** The heading carries a year-aware caption — **"36 monthly payments over 3 years"**.

### FIN-PLN-41 — Loan projection save validation
**Steps:** Save with a missing name, then with a missing/zero principal.
**Expected:** The save control is disabled with the reason **"Add a name and a principal to save."** / **"Add a name to save."** / **"Enter a positive principal to save."**

### FIN-PLN-42 — Loan projection list card
**Expected:** Name (or **"Untitled loan"**), a **"Loan"** pill, a **"Planned"** pill (tooltip **"This is a projection — no real loan has been taken."**), a **"Draft"** pill for unsaved plans, meta **"{rate}% APR · {term} · starts {date}"** (the term reads in the natural unit — **"1y"**, **"18mo"**, **"2.5y"**), **"Principal ৳X"**, **"Pay ৳Y interest"**, and the hero **"Monthly EMI"** / **"Total you pay"**.

### FIN-PLN-43 — Loan calculator summary
**Expected:** A **"Summary"** card with **"Projections"** (sub **"saved loan plan(s)"**), **"If you borrow this much"** → **"Total principal across every projection"**, **"Total interest across all"** → **"Sum of interest across every projection"**, and a **"How it works:"** footer.

### FIN-PLN-44 — Clear drafts
**Steps:** Create an unsaved draft; open **"Clear drafts"**.
**Expected:** The section **"Unsaved drafts (N)"** with the copy **"Drafts are shown above with a Draft pill. Clear them here if you don't want to keep them."** and a **"Clear drafts"** button.

### FIN-PLN-45 — Delete a loan projection
**Steps:** Delete a projection.
**Expected:** Confirm **"Delete this projection?"** / **"The plan is removed. This cannot be undone."** / **"Delete"**.

### FIN-PLN-46 — Loan projection not found
**Steps:** Navigate to `#/plan/loan/does-not-exist`.
**Expected:** A not-found state with a **"Back to Loan Calculator"** control (H1 **"Loan projection"** screen equivalent).

### FIN-PLN-47 — Planners never touch the ledger
**Steps:** Create month-plan items, an event, an investment plan and a loan projection; then check `#/transactions` and all account balances.
**Expected:** **No** transactions are created and **no** balance changes. All planner content is a scratchpad.

### FIN-PLN-48 — Planner content is included in the backup
**Steps:** Export a backup; inspect the JSON.
**Expected:** The envelope contains `data.monthPlans`, `data.eventPlans`, `data.investmentPlans` and `data.loanPlans` alongside the core arrays.

---

## 13. Security (PIN)

### FIN-SEC-01 — Security section
**Steps:** Open `#/settings`.
**Expected:** A **"Security"** card headed **"Security"** with body **"Protect this device data with a 6-digit PIN. You'll need to enter it every time the app loads."** and buttons **"Set PIN"**, **"Change PIN"**, **"Disable PIN"**. Note **"Forgot your PIN? Wipe all data from the Danger Zone — there's no recovery, by design."**

### FIN-SEC-02 — Set a PIN
**Steps:** Click **"Set PIN"**.
**Expected:** A modal titled **"Set a 6-digit PIN"** with sub **"You'll enter this every time you open Finora"**, six masked digit boxes, the helper **"Type with your keyboard. Each box accepts one digit."**, and buttons **"Cancel"** / **"Continue"**.

### FIN-SEC-03 — PIN confirmation step
**Steps:** Enter a valid 6-digit PIN and click **"Continue"**.
**Expected:** The modal title becomes **"Confirm your PIN"** with sub **"Type the same 6 digits once more"**, and the primary button becomes **"Save PIN"**.

### FIN-SEC-04 — Mismatched confirmation
**Steps:** Enter `123456` then `654321` at the confirm step.
**Expected:** The error **"PINs don't match — try again."** is shown and nothing is saved.

### FIN-SEC-05 — PIN digit entry mechanics
**Steps:** Type digits, press Backspace, paste a 6-digit string, use ArrowLeft/ArrowRight, press Enter.
**Expected:** Auto-advance to the next box on entry; Backspace returns to the previous box and clears it; a pasted 6-digit string fills all boxes; arrow keys move focus; Enter submits.

### FIN-SEC-06 — PIN is not in the backup
**Steps:** Set a PIN; export a backup; inspect the JSON file.
**Expected:** The PIN salt/hash are **not** present in the export (the PIN lives in a separate in-memory store plus `localStorage` keys, not in the state blob).

### FIN-SEC-07 — Lock screen on reload
**Steps:** Set a PIN, then reload the page.
**Expected:** The app does **not** render the normal shell. A lock screen appears with the container aria-label **"Unlock Finora"**, H1 **"Secure Finora"** and sub **"Enter your 6-digit PIN to unlock"**, with six masked boxes.

### FIN-SEC-08 — Successful unlock
**Steps:** Enter the correct PIN.
**Expected:** A banner **"Welcome back"** / **"PIN accepted."** / **"Your accounts are ready."** and the app renders the normal Home screen.

### FIN-SEC-09 — Wrong PIN
**Steps:** Enter a wrong 6-digit PIN.
**Expected:** The error **"Wrong PIN. Try again."** is shown and the boxes shake.

### FIN-SEC-10 — Rate limiting
**Steps:** Enter wrong PINs repeatedly, timing each attempt.
**Expected:** After the 1st failure there is a ~1 s delay; after the 2nd ~5 s; after the 3rd ~30 s. The lock screen shows **"Locked. Reload the page to continue."** or **"Try again in {n}s"**. After the 4th failure the lockout is indefinite until the page is reloaded.

### FIN-SEC-11 — Lockout state is per-session
**Steps:** Trigger the indefinite lockout, then **close the tab and open a new one**.
**Expected:** The lockout is **cleared** — the counters live in `sessionStorage`. Log as a security finding: an attacker with filesystem access to the profile can bypass the lockout by closing the tab.

### FIN-SEC-12 — Forgot PIN → wipe
**Steps:** On the lock screen, click **"Forgot PIN? Wipe all data"**.
**Expected:** Confirm **"Wipe all data and reset PIN?"** / **"This permanently deletes every account, transaction, goal, debt, investment, and plan — and clears the PIN. The app will reset to a clean install. There is no recovery."** / **"Wipe everything"**. Confirm → banner **"All data wiped"** / **"Your local store is now empty."** / **"Add an account to start tracking again."** and the app opens without a PIN.
> **Note:** there is no non-destructive PIN recovery. Log as a product finding.

### FIN-SEC-13 — Change PIN
**Steps:** With a PIN set, open **"Change PIN"**.
**Expected:** A three-step flow: **"Enter your current PIN"** → **"Choose a new PIN"** → **"Confirm the new PIN"**, with subtitles **"We need to know it's really you before changing it."**, **"Pick a new 6-digit PIN."**, **"Type it once more to confirm."** Only a **"Cancel"** button is present (no explicit Save).

### FIN-SEC-14 — Change PIN — wrong current PIN
**Steps:** Enter a wrong current PIN.
**Expected:** The error **"That PIN doesn't match the one on this device."**

### FIN-SEC-15 — Change PIN — mismatch
**Steps:** Enter a correct current PIN, then mismatched new PINs.
**Expected:** **"New PINs don't match — try again."**

### FIN-SEC-16 — Change PIN success and disable
**Steps:** Complete the change → banner **"PIN changed"** / **"Your new PIN is in effect."** Then click **"Disable PIN"** → confirm **"Disable PIN lock?"** / **"You'll be able to open Finora without entering a PIN. You can turn it back on any time."** / **"Disable PIN"** → banner **"PIN disabled"** / **"Your app will open without asking."** / **"You can turn PIN protection back on at any time from this card."** Reload → the app opens without a lock screen.

### FIN-SEC-17 — PIN lock blocks cloud push
**Steps:** With a PIN set and the app signed in, make a change while the app is locked, then unlock.
**Expected:** The change is pushed after unlocking — locked sessions do not push. Verify the sync indicator updates post-unlock.

---

## 14. Cloud sync & account

### FIN-SYN-01 — Sync-disabled build
**Precondition:** Build without `BASE_URL` / `BASE_ANON_KEY`.
**Steps:** Open `#/settings`.
**Expected:** The **"Cloud sync"** card reads **"Cloud sync is disabled in this build. Set BASE_URL and BASE_ANON_KEY in .env.local to enable it."**
> **Known defect candidate:** the app actually reads `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (per the sync-status tooltip), so following the on-screen instruction will **not** enable sync. Verify which variables this build reads, then log the mismatch.

### FIN-SYN-02 — Signed-out copy
**Precondition:** Sync enabled, not signed in.
**Steps:** Open `#/settings`.
**Expected:** The Cloud sync card reads **"Sync your data across devices with end-to-end RLS-scoped storage. Optional — Finora works fine without it. Your cloud copy is preserved when you sign out, so signing back in pulls the latest snapshot."** with a **"Sign in"** button.

### FIN-SYN-03 — Sign-in dialog
**Steps:** Click **"Sign in"**.
**Expected:** A dialog with mode tabs **"Sign in"** / **"Create account"**, headline **"Sign in to sync"** and sub **"Sign in with the email and password you used when you created your account."** Fields **"Email"** (placeholder `you@example.com`) and **"Password"**, a **"Forgot password?"** link, and a **"Sign in"** button.

### FIN-SYN-04 — Sign-in with a wrong password
**Steps:** Enter a valid email and a wrong password; **"Sign in"**.
**Expected:** The inline error **"That email and password don't match. Try again."**

### FIN-SYN-05 — Invalid email
**Steps:** Enter `not-an-email` and submit.
**Expected:** The inline error **"Enter a valid email address."**

### FIN-SYN-06 — Create account
**Steps:** Switch to **"Create account"**; enter a new email and a password of 8+ characters; submit.
**Expected:** Headline **"Create your account"**, sub **"Pick an email and a password — you'll use these to sign in on every device."**, password placeholder **"At least 8 characters"**. On success a toast **"Account created"** / **"You're signed in and cloud sync is ready."** If email confirmation is required, a toast **"Check your email"** explains the confirmation link.

### FIN-SYN-07 — Duplicate account
**Steps:** Try to create an account with an email that already exists.
**Expected:** The inline error **"An account with this email already exists. Try signing in instead."**

### FIN-SYN-08 — Password too short
**Steps:** In create-account mode, enter a 7-character password.
**Expected:** The inline error **"Password doesn't meet the server's requirements."**

### FIN-SYN-09 — Signed-in state
**Steps:** Sign in successfully; open `#/settings`.
**Expected:** The card shows **"Signed in as"** with the email, **"Last synced"** with a relative value (**"never"** / **"just now"** / **"Ns ago"** / **"Nm ago"** / **"Nh ago"** / **"Nd ago"**), and buttons **"Force sync now"**, **"Change password"**, **"Sign out"**.

### FIN-SYN-10 — Force sync now
**Steps:** Click **"Force sync now"**.
**Expected:** The button label changes to **"Syncing…"** while running, then a toast **"Sync complete"** appears and **"Last synced"** updates to **"just now"**.

### FIN-SYN-11 — Sync status pill states
**Steps:** Observe the sync status indicator in various states.
**Expected:** Labels **"Cloud sync off"** (unconfigured), **"Cloud off"** (signed out), **"Synced · {relative}"**, **"Syncing…"**, **"Offline · {n} pending"**, **"Sync error"**. Clicking the signed-out/off pill navigates to `#/settings`; clicking an error pill shows a banner with the reason.

### FIN-SYN-12 — Offline queueing
**Steps:** Sign in; go offline (devtools → Network → Offline); record several transactions; go back online.
**Expected:** The status shows **"Offline · {n} pending"**. On reconnect the queue flushes and coalesces into a single push; the status returns to **"Synced"**.

### FIN-SYN-13 — Last-write-wins reconciliation
**Steps:** Sign in on two browsers/devices; edit on device A, wait for the sync, then edit on device B and observe both.
**Expected:** The newer `stateUpdatedAt` wins and the whole state is adopted — there is **no per-field merge**. Concurrent edits resolve whole-state LWW with the server clock as the tiebreaker for identical millisecond timestamps.

### FIN-SYN-14 — Sign out preserves the cloud copy
**Precondition:** Signed in with data synced.
**Steps:** Click **"Sign out"**.
**Expected:** A toast **"Signed out"** appears. The **local store is wiped** — accounts, transactions, goals, debts, investments and plans are all gone from this device. The cloud copy is **preserved**.
> **Finding candidate:** sign-out is destructive **and has no confirmation dialog**, unlike **"Wipe all data"**. The local wipe is not spelled out in the UI either. Recommend an explicit confirm + warning copy.

### FIN-SYN-15 — Sign back in restores the cloud snapshot
**Steps:** After FIN-SYN-14, sign in again.
**Expected:** The wiped local store has `stateUpdatedAt = 0`, so the cloud row is adopted via LWW and the latest snapshot reappears — **no manual export/import is required**.

### FIN-SYN-16 — Change password
**Steps:** Click **"Change password"**.
**Expected:** Modal **"Change password"** / **"Choose a new password for your account. Use at least 8 characters. You'll stay signed in on this device."** with a **"New password"** field and **"Cancel"** / **"Update password"**. On success a toast **"Password updated"** / **"You're signed in with your new password."**

### FIN-SYN-17 — Password recovery link
**Steps:** Click **"Forgot password?"** → **"Send reset link"**; then open the emailed link.
**Expected:** The app opens a **"Set a new password"** dialog / **"Choose a new password for your account. Use at least 8 characters."** Setting a new password succeeds and the app shows **"Password updated"**.
> **Verify:** the router is hash-mode and the reset link uses `redirectTo = window.location.origin + '/'` — confirm the `#access_token=…&type=recovery` fragment survives the redirect and that the dialog auto-opens.

### FIN-SYN-18 — Cross-tab password recovery
**Steps:** With two tabs open, click the recovery link in one tab.
**Expected:** The dialog opens in the tab that owns the link; the other tab stays on the signed-in view. After the password is updated, the recovering tab broadcasts **"recovery-complete"** and the **other tab reloads automatically** to pick up the new session.

### FIN-SYN-19 — No real-time cross-device updates
**Steps:** Edit on device A with device B open.
**Expected:** Device B does **not** update live — sync is eventual, on the next reconcile. There are no real-time subscriptions.

---

## 15. Settings, backup & danger zone

### FIN-SET-01 — Settings layout
**Steps:** Open `#/settings`.
**Expected:** H1 **"Settings"**, sub **"Backup and reset."** At ≥768px a two-column layout (controls left, About panel right at 320px). Below 768px it collapses to one column with the About panel rendered **after** the Danger zone.

### FIN-SET-02 — About panel
**Expected:** Heading **"About"**, name **"Finora"**, the tagline **"A quiet place for your money. Track what you have, where it goes, and what you're aiming for — without an account, an inbox, or a notification asking for anything back."**, and rows **"Version"** (`v1.0.0` by default), **"Privacy"**, **"Storage"** (e.g. **"Saved on this device · 42 entries"**, or **"Saved on this device only"** when empty).

### FIN-SET-03 — About panel privacy copy changes when signed in
**Steps:** Compare the Privacy row signed out vs signed in.
**Expected:** Signed out → **"Stored on this device only. Cloud sync is opt-in — see the Cloud sync panel above."** Signed in → **"Stored on this device and synced to your cloud copy on Supabase. RLS scopes every read and write to your account."**

### FIN-SET-04 — Export backup
**Steps:** Click **"Export backup"**.
**Expected:** A file named **"finora-backup-{yyyy}-{mm}-{dd}.json"** downloads. A banner appears: **what** "Downloaded finora-backup-2026-11-02.json", **why** "This file contains every account, transaction, goal, debt, and investment from your local store.", **fix** "Keep it somewhere safe — it's the only way to restore from a wipe."

### FIN-SET-05 — Backup file shape
**Steps:** Open the exported JSON.
**Expected:** Top-level envelope `{ version, exportedAt, data }` with `version: 1`. `data` contains `accounts`, `transactions`, `goals`, `debts`, `investments`, `categories`, `settings { theme, onboardingComplete }` and — when present — `monthPlans`, `eventPlans`, `investmentPlans`, `loanPlans`. The file is pretty-printed with 2-space indentation.

### FIN-SET-06 — Import backup — happy path
**Precondition:** Change some data (add an account, edit a transaction).
**Steps:** Click **"Import backup"**; select the previously exported file.
**Expected:** Confirm **"Replace current data with backup?"** / **"This will overwrite every account, transaction, goal, debt, and investment currently in the app."** / **"Replace"** (danger). Confirm → banner **"Backup restored"** / **"Your data is now identical to the backup file."** / **"Open Home to see the totals."** The pre-import changes are gone.

### FIN-SET-07 — Import a non-JSON file
**Steps:** Import a text file.
**Expected:** Banner **what** "Backup file is not valid JSON", **why** "The file couldn't be parsed as JSON — it may be corrupted.", **fix** "Re-export from the source device, or check that the file isn't truncated."

### FIN-SET-08 — Import a JSON file with the wrong shape
**Steps:** Import a JSON file that is valid JSON but not a Finora backup.
**Expected:** Banner **what** "Backup is missing field: {path}", **why** "The file doesn't match the Finora V1 backup shape.", **fix** "Make sure you exported from Finora V1 (not V0 or V2)."

### FIN-SET-09 — Import a corrupt/unreadable file
**Steps:** Import a file the browser cannot read.
**Expected:** Banner **what** "Could not read the file", **why** "The browser couldn't open the file you picked.", **fix** "Try a different file or copy-paste from TextEdit."

### FIN-SET-10 — Danger zone layout
**Steps:** Scroll to the Danger zone.
**Expected:** A danger-tinted card headed **"Danger zone"** with the copy **"This action is destructive. Export first if unsure."**, the row title **"Wipe all data"**, the description **"Deletes every account, transaction, goal, debt, investment, and plan from this device — leaves the app as a clean install."** (adds **"and from your cloud copy on Supabase"** when signed in), and a danger **"Wipe all data"** button.

### FIN-SET-11 — Wipe everything while signed out
**Precondition:** Signed out.
**Steps:** Click **"Wipe all data"**.
**Expected:** Confirm **"Wipe all data?"** / **"Every account, transaction, goal, debt, investment, and plan will be deleted from this device. Your cloud copy (if any) is preserved so signing back in will restore the latest snapshot. This cannot be undone."** / **"Wipe everything"**. Confirm → banner **"All data wiped"** / **"Your local store is now empty. Your cloud copy (if any) is preserved — sign back in to restore."** / **"Add an account to start tracking again, or sign back in to pull from the cloud."**

### FIN-SET-12 — Wipe everything while signed in
**Precondition:** Signed in.
**Steps:** Click **"Wipe all data"**.
**Expected:** Confirm body is the signed-in variant: **"Every account, transaction, goal, debt, investment, and plan will be deleted from THIS DEVICE and from your cloud copy on Supabase. This cannot be undone."** Confirm → banner **"All data wiped"** / **"Your local store and cloud copy are now empty."** / **"Add an account to start tracking again."** Signing in again yields an **empty** account — the cloud row was deleted.

### FIN-SET-13 — Wipe aborts if the cloud delete fails
**Steps:** Sign in, go **offline**, then trigger **"Wipe all data"**.
**Expected:** The banner **"Couldn't delete cloud copy"** appears with the reason and the fix **"Check your connection and try again. Local data was NOT wiped."** The local data is **preserved** — the cloud is deleted first so a network failure aborts before the local wipe.

### FIN-SET-14 — About panel "Erase everything and start over"
**Steps:** Click **"Erase everything and start over →"** in the About panel.
**Expected:** The same confirm dialog and wipe flow as the Danger zone button.

### FIN-SET-15 — Wipe clears the PIN
**Precondition:** A PIN is set.
**Steps:** Wipe all data; reload the app.
**Expected:** The app opens **without** a lock screen — the PIN is cleared along with the data. The rate-limit counters are reset too.

### FIN-SET-16 — Wipe does not re-push an empty state
**Precondition:** Signed in with a cloud row.
**Steps:** Wipe everything; wait ~10 s; re-check the cloud row (via the Supabase dashboard or by signing in on a second browser).
**Expected:** The cloud row stays **deleted**. The local reset does not bump `stateUpdatedAt`, so no debounced push re-creates it.

---

## 16. Persistence, migration & responsiveness

### FIN-PER-01 — Data survives a reload
**Steps:** Create an account, transaction, goal, debt and investment; reload the page.
**Expected:** All records persist (IndexedDB database `finora`, row `state`). Balances and derived fields are recomputed on boot.

### FIN-PER-02 — Data survives a tab close and reopen
**Steps:** Close the browser entirely, reopen, and load the app.
**Expected:** All data is present.

### FIN-PER-03 — Browser "Clear site data" wipes everything
**Steps:** Clear site data for the origin; reload.
**Expected:** The app opens as a clean install with no accounts. This is documented as the expected behaviour — back up regularly.

### FIN-PER-04 — Legacy localStorage migration
**Precondition:** A pre-2026-09-02 build wrote `localStorage['finora:v1']`.
**Steps:** Load the new build.
**Expected:** The legacy data is migrated into IndexedDB on first load and the legacy key is removed. Verify the legacy key is gone from `localStorage` after migration.

### FIN-PER-05 — Route state survives a reload
**Steps:** Open `#/insights`, change the range, reload.
**Expected:** The route and the range selection persist.

### FIN-PER-06 — Desktop layout at 1440px
**Steps:** View at 1440 × 900.
**Expected:** A 248px sticky sidebar; content area with generous padding; the Settings About panel sits in a right-hand 320px column.

### FIN-PER-07 — Tablet layout at 768px
**Steps:** View at 768 × 1024.
**Expected:** The sidebar becomes an off-canvas drawer reachable via the hamburger; the main content uses reduced padding.

### FIN-PER-08 — Mobile layout at 375px
**Steps:** View at 375 × 812.
**Expected:** A sticky mobile topbar (hamburger + centred Finora wordmark); `px-5` content padding; the Accounts and Investments grids collapse to a single column; the Month Plan transfer layout stacks vertically.

### FIN-PER-09 — Number inputs do not change on scroll
**Steps:** Focus an amount field and scroll the mouse wheel over it.
**Expected:** The value does **not** change (number inputs blur on wheel scroll).

### FIN-PER-10 — Dark theme only
**Steps:** Inspect the app and the Settings screen for a theme switcher.
**Expected:** There is **no** runtime theme selection — the app forces `data-theme="dark"` on the root element at boot. Any PRD requirement for a light theme is unimplemented; log as a gap.

---

## 17. Accessibility & UI conventions

### FIN-A11Y-01 — Confirm dialog keyboard behaviour
**Steps:** Open any confirm dialog; press Escape; then open again and press Tab.
**Expected:** Escape cancels. Focus lands on the **Cancel** button (not the destructive action). Backdrop click cancels.

### FIN-A11Y-02 — Modal backdrop behaviour differs between modals
**Steps:** Open the goal-contribution modal and click its backdrop (closes). Open the debt-payment modal and click its backdrop (does **not** close — only Escape works).
**Expected:** The goal modal closes; the debt modal stays open. Log the inconsistency.

### FIN-A11Y-03 — Banner and toast structure
**Steps:** Trigger a banner (e.g. delete a transaction) and a toast (e.g. add a transaction).
**Expected:** The banner has `role="alert"` and three lines (what / why / fix) with a **"Dismiss"** button, and auto-dismisses after ~3 s (6 s for errors). The toast has `role="status"`, two lines at most (what / why), and auto-dismisses after ~1.5 s (4 s for errors).

### FIN-A11Y-04 — Field labels and hints
**Steps:** Inspect any form.
**Expected:** Labels are rendered in 11px uppercase muted text. The hint is **hidden when an error is present** for that field. Invalid fields get `aria-invalid` and a danger border. Each label is **programmatically associated** with its control — `label[for]` matches the control's `id`, so clicking the label focuses the field and a screen reader announces the label with the control. Fields whose control is not labelable (the category picker, a plain `<div>`) render their label without `for`.

### FIN-A11Y-05 — Progress bars
**Steps:** Inspect a goal or debt progress bar.
**Expected:** `role="progressbar"` with `aria-valuenow`, `aria-valuemin=0`, `aria-valuemax=100`; the value is clamped to 0–100.

### FIN-A11Y-06 — PIN entry accessibility
**Steps:** Inspect the PIN boxes.
**Expected:** The group has aria-label **"PIN entry, {n} of 6 digits entered"**; each cell has aria-label **"Digit {n}"**.

---

## 18. Known defects & inconsistencies to verify

Treat these as **expected findings** during the run. If a case behaves differently from what is written here, that is a change worth investigating (either a fix landed or a new regression).

| # | Area | Finding | Verify with |
|---|---|---|---|
| 1 | Cloud sync | The disabled-sync copy names `BASE_URL` / `BASE_ANON_KEY`, but the app reads `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`. Following the on-screen instruction will not enable sync. | FIN-SYN-01 |
| 2 | Cloud sync | **"Sign out"** wipes the local store with **no confirmation dialog**, unlike **"Wipe all data"**. The local wipe is not disclosed in the UI copy. | FIN-SYN-14 |
| 3 | Security | Rate-limit lockout (including the indefinite 4th-attempt lock) lives in `sessionStorage`, so closing and reopening the tab resets it. | FIN-SEC-11 |
| 4 | Security | Doc comments describe an on-screen 3×4 PIN keypad that is not implemented — only the 6-box masked input exists. | FIN-SEC-05 |
| 5 | Goals | The **"Target date is required"** banner says *"Pick a date in the future"* but **no future-date validation exists**; past dates are accepted. | FIN-GOA-05 |
| 6 | Goals | `recomputeGoalSaved` re-derives `saved` from contributions on every load, so a stale `saved` value self-heals — verify a stale value does not survive a reload. | FIN-GOA-14 |
| 7 | Accounts | The delete-blocked banner suggests **"or archive them"** but **no archive feature exists**. It also renders with default *info* styling rather than a danger tone, so a destructive failure reads as non-blocking. | FIN-ACC-13 |
| 8 | Accounts | Account add/edit produce **no toast** — a silent redirect only. | FIN-ACC-03 |
| 9 | Transactions | The **linked-debt** select exists on the add-income form but is **missing on the edit-income form** (add/edit parity). | FIN-TXN-44 |
| 10 | Transactions | The transfer form has **no date and no note** — transfers cannot be dated or annotated. | FIN-TXN-32 |
| 11 | Transactions | A transfer created with a single account can still have identical source/destination in state; the domain layer throws to prevent it, but the UI path is not obviously blocked. | FIN-TXN-35 |
| 12 | Investments | The DPS **monthly-contribution lock** counts **all** linked transactions (contributions *and* payouts), so a payout alone locks the field. | FIN-INV-23 |
| 13 | Investments | The interest rate is **not capped at 100** in the UI (only in an unused zod schema). | FIN-INV-09 |
| 14 | Debts | The **due date** is stored but **never displayed** on any debt screen. | FIN-DBT-24 |
| 15 | Debts | No amortisation schedule table exists on the debt screens; only the Loan Calculator has one. | FIN-DBT-10 |
| 16 | Planner | Month Plan has **no month selector and no rollover** — only the current calendar month is editable. | FIN-PLN-12 |
| 17 | Planner | `plannedIncome` exists in the MonthPlan type but has **no UI surface**; income exists only in the ephemeral, non-persisted Quick Total checker. | FIN-PLN-11 |
| 18 | Home | The meta line **"updated just now"** is a hard-coded string, not a live timestamp. | FIN-HOM-10 |
| 19 | Home | Two distinct **"Welcome to Finora."** surfaces exist (onboarding screen and Home demo banner) with different copy. | FIN-HOM-09 |
| 20 | Insight | The page H1 is **"Insight"** (singular) while the Home link reads **"See full Insights →"**. | FIN-INS-01 |
| 21 | Insight | The range is persisted in `localStorage` (`finora.insights.range`); a stale key from another version could leave the selection on a range with no matching pill. | FIN-INS-02 |
| 22 | Transactions | There are **no totals** on the Transactions list, and no search / category / account / date filter or sort control. | FIN-TXN-12, FIN-TXN-13 |
| 23 | Transactions | The expense-category count is 37, but the existing unit-test comment claims 31 — confirm the shipped number. | FIN-TXN-22 |
| 24 | Category | There is **no category CRUD UI**; the only mutation is the additive **"Restore default categories"** button. | FIN-TXN-29 |
| 25 | Validation | No date field rejects future **or** past dates across goals, debts, investments and contributions. | FIN-GOA-05, FIN-INV-07 |

---

## 19. Execution log

| Date | Tester | Build | Area | Result | Defect refs | Notes |
|---|---|---|---|---|---|---|
| | | | | | | |
| | | | | | | |
| | | | | | | |

**Pass:** all expected results met.
**Fail:** at least one expected result not met — raise a defect.
**Blocked:** cannot be executed (missing dependency, environment issue) — record the blocker.
**N/A:** the behaviour does not exist in this build — only use with a written justification (see §1.3).

---

## 20. Sign-off

| Role | Name | Date | Signature |
|---|---|---|---|
| Test lead | | | |
| QA engineer | | | |
| Product owner | | | |
