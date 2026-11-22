# Finora — Playwright Automation Plan

**Purpose:** automate the 50-case manual plan in [`test/manual-test.md`](manual-test.md).
**Status:** superseded — the plan has been implemented. The path layout below is
the *original* proposal; the repo now uses a single `test/` root (see
[§11 — Where the code actually lives](#11-where-the-code-actually-lives)).
**Reference spec:** [`test/manual-test-detailed.md`](manual-test-detailed.md) — 282 cases, a superset of the 50; this plan automates the 50 and points at the detailed spec for anything wider.

---

## 1. What we're automating, and why it's shaped this way

The manual plan has **50 cases across 5 tiers**. The tiers are *risk tiers*, not difficulty tiers — T1 is the smoke gate, T4 is the destructive/security tier. That maps cleanly onto Playwright:

| Manual tier | Cases | Playwright home | Why |
|---|---|---|---|
| T1 Smoke | 6 | `test/e2e/ui_tests/` — `smoke.spec.ts` | Runs first, fails fast. Same gate semantics. |
| T2 Core functional | 24 | `test/e2e/ui_tests/` — one spec per domain | The bulk of the value: CRUD + invariants. |
| T3 Plan scratchpads | 5 | `test/e2e/ui_tests/plan/` | Scratchpads — assert isolation, not maths. |
| T4 Risk (security, sync, wipe) | 9 | `test/e2e/ui_tests/` + `test/e2e/api_tests/` | PIN is UI; Supabase sign-in is API; wipe is UI+destructive. |
| T5 Exploratory | 6 | `test/e2e/visual_tests/` + manual | **Mostly stays manual** — see §8. |

**Two suites, not three, are worth building first.** This app has no first-party HTTP API — Supabase is optional and env-gated. So:

- `test/e2e/ui_tests/` — the main suite. 44 of the 50 cases.
- `test/e2e/visual_tests/` — snapshot regressions for the 8 visual surfaces.
- `test/e2e/api_tests/` — **defer**. Only meaningful against a real Supabase instance. See §9.

---

## 2. Prerequisites — two upstream changes that make automation possible

> **Status: both applied.** §2.1 landed as `src/components/Field.tsx` +
> `src/components/__tests__/Field.spec.tsx` (9 tests). §2.2 landed as the
> `dev:e2e` script in `package.json`. The rest of the plan assumes both
> are in place.

### 2.1 `getByLabel()` was unusable — **fixed**

`src/components/Field.tsx` used to render the label with **no `htmlFor`**
and the input with **no `id`**:

```tsx
<div className="flex flex-col gap-1.5">
  <label className="text-[11px] text-muted uppercase tracking-[0.08em] font-semibold">
    {label}
  </label>
  {children}
```

There is exactly **one** `data-testid` in the entire app (`security-section`,
`src/security/SecuritySection.tsx:91`). So every form field had to be located
by placeholder or by a fragile wrapper pattern:

```ts
// ✗ did not work
page.getByLabel('Amount')

// △ worked but was brittle — the label's wrapper div
page.locator('div')
  .filter({ has: page.getByText('Amount', { exact: true }) })
  .locator('input')

// ✓ worked — placeholders are unique per form
page.getByPlaceholder('250')
```

**The fix** — generate an id, wire `htmlFor`, and clone it onto the control:

```tsx
const generatedId = useId();
const id = `field-${generatedId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

const controls = new Set<unknown>([Input, Select, Textarea, AmountInput]);
const childArray = Children.toArray(children);
const controlIndex = childArray.findIndex(
  c => isValidElement(c) && isLabelable(c.type, controls),
);
const rendered = childArray.map((child, i) =>
  i === controlIndex ? cloneElement(child as ReactElement, { id }) : child,
);
```

Three details that mattered:

1. **Only *labelable* children get the id.** A `<div>` is a host element but
   the HTML spec only makes `button`/`input`/`meter`/`output`/`progress`/
   `select`/`textarea` labelable. `CategoryGrid` (used for the transaction
   category picker) is neither, so it renders untouched and its label has no
   `for`.
2. **Siblings must survive.** Several fields render a decorative sibling next
   to the control — e.g. `<Field label="From">` in `AddTransactionForm.tsx`
   puts a "Balance: ৳5,000" `<div>` under the `<Select>`. Cloning only the
   control would silently drop it, so the children are *mapped*, not replaced.
3. **`useId()` emits `:r0:`.** Colons are legal in an HTML id but break CSS
   `#id` selectors, so they're stripped.

`getByLabel('Amount')` now resolves on every form field.

### 2.2 Dev-server port must be pinned for `webServer` — **fixed**

`vite.config.ts:41-44` sets `port: 5173` with **no `strictPort`**, so Vite
silently falls back to 5174 if 5173 is busy. Playwright's `webServer.url`
would then poll a dead port.

**The fix** — dedicated script, no change to the dev experience:

```json
"scripts": {
  "dev:e2e": "vite --port 5174 --strictPort"
}
```

`playwright.config.ts` uses `command: 'npm run dev:e2e'` with
`baseURL: 'http://localhost:5174'`.

---

## 3. Project layout to create

```
playwright.config.ts          # UI suite
api.config.ts                 # Supabase direct
visual.config.ts              # snapshots
test/
  e2e/
    fixtures/
      app-state.ts            # IndexedDB seeding + reset helpers
      seed-data.ts            # JSON store loaders
    pages/
      BasePage.ts             # page ref, goto helpers, common nav
      ShellPage.ts            # extends BasePage — sidebar, drawer, nav
      component/
        ConfirmDialog.ts      # page object for role=dialog
        Feedback.ts
        HelpOverlay.ts
      AccountsPage.ts
      TransactionsPage.ts
      DebtsPage.ts
      InvestmentsPage.ts
      GoalsPage.ts
      InsightsPage.ts
      PlanPage.ts
      SettingsPage.ts
      LockScreen.ts
    ui_tests/
      smoke.spec.ts
      accounts.spec.ts
      transactions.spec.ts
      goals.spec.ts
      debts.spec.ts
      investments.spec.ts
      insights.spec.ts
      plan.spec.ts
      security.spec.ts
      known-defects.spec.ts
    api_tests/
      AuthTests.spec.ts
      StateApiTests.spec.ts
    visual_tests/
      VisualTest.spec.ts
  data/
    auth.json
    accounts.json
    transactions.json
    goals.json
    debts.json
    investments.json
    plans.json
```

**Note on `pages/component/Navbar.ts`:** the skill's default hierarchy assumes a top navbar. Finora has a **sidebar** on desktop and a **drawer** on mobile. So the chain is `ShellPage → BasePage → {feature pages}`, and the drawer/backdrop logic lives in `ShellPage`. Don't create a `Navbar` page object — there is no navbar.

---

## 4. Core infrastructure

### 4.1 Config — `playwright.config.ts`

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './test/e2e/ui_tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  timeout: 30_000,
  expect: { timeout: 5_000 },

  use: {
    baseURL: 'http://localhost:5174',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile',   use: { ...devices['Pixel 7'] } },        // drawer tests only
  ],

  webServer: {
    command: 'npm run dev:e2e',
    url: 'http://localhost:5174',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
```

Two projects: `chromium` (desktop 1440×900 — the sidebar layout) and `mobile` (Pixel 7 — drawer + topbar). Don't run every spec in both — the mobile project should only pick up specs tagged `@mobile`.

### 4.2 Locator strategy — `getByLabel()` now works

Because §2.1 is applied, **every labelled form field is reachable by
`getByLabel`**:

```ts
await this.page.getByLabel('Amount').fill('2500');
await this.page.getByLabel('Type').selectOption('cash');
```

That is the primary strategy. Placeholders remain a good fallback for
fields with no label association (the category picker, the raw
`<select>` in `InvestmentDetailScreen`) — the full placeholder table is
in §4.3.

**One caveat:** several forms have two fields with the *same* label.
`AddTransactionForm` has **"Linked debt (optional)"** on both the expense
and the income branch (only one renders at a time, so it's fine there), and
`InvestmentAddScreen` / `InvestmentEditScreen` both render
**"Term (days)"** and **"Term (months)"** under the same `Type` — scope
those to the visible branch:

```ts
await page.getByLabel('Term (months)').fill('12');   // unique label
```

If a label genuinely repeats on screen at the same time, use
`.first()` or scope to the containing `Field` div.

**Keep the `field()` helper anyway** as a fallback for the two
non-labelable cases, but it should rarely be needed:

```ts
// Fallback for fields with no <label for> association.
protected field(label: string): Locator {
  return this.page
    .locator('div')
    .filter({ has: this.page.getByText(label, { exact: true }) })
    .locator('input, select, textarea')
    .first();
}
```

### 4.3 Field → locator cheat sheet

*(verified against `src/` — see `src/screens/*` line refs in the appendix)*

| Screen | Field | Locator |
|---|---|---|
| Account add | Name | `getByPlaceholder('Cash, Wallet, Main Bank…')` |
| | Type | `select` by option — `cash` / `bank` / `mobile wallet` / `card` / `other` |
| | Opening balance | `field('Opening balance')` (number, no placeholder) |
| Transaction add | Amount | `getByPlaceholder('250')` expense · `'60,000'` income · `'5,000'` transfer |
| | Category | `getByRole('button', { name: 'Rent' })` — chips are `div[role=button]` |
| | From / To / Account | `field('From')` / `field('To')` / `field('Account')` |
| | Date | `field('Date')` (date input) |
| | Note | `getByPlaceholder('Lunch with team')` / `'September salary'` |
| Goal add | Name | `getByPlaceholder('Emergency fund, laptop…')` |
| | Already saved | `getByPlaceholder('0')` |
| | Target amount | `getByPlaceholder('50000')` |
| | Target date | `field('Target date')` |
| Debt add | Name | `getByPlaceholder('Loan from a friend, advance to a colleague…')` |
| | Total amount | `getByPlaceholder('10000')` |
| | Direction | `selectOption({ label: 'I owe (you borrowed)' })` |
| | Person | `getByPlaceholder('Friend, family…')` |
| | Loan checkbox | `getByLabel('Mark this debt as a loan with interest')` ← **has a real aria-label** |
| Investment add | Name | `getByPlaceholder('DPS #1, Main FDR…')` |
| | Principal | `getByPlaceholder('100000')` |
| | Monthly contribution | `getByPlaceholder('5000')` |
| | Rate | `getByPlaceholder('8')` |
| | Term (months) | `getByPlaceholder('12')` ⚠ collides with debt rate — scope to the form |
| | Type | `selectOption({ label: 'FDR (lump-sum, fixed term)' })` |

### 4.4 Shared components — `pages/component/`

**Confirm dialog** — every destructive action uses this:

```ts
export class ConfirmDialog {
  readonly dialog: Locator;
  constructor(page: Page) { this.dialog = page.getByRole('dialog'); }
  title()   { return this.dialog.getByRole('heading'); }
  cancel() { return this.dialog.getByRole('button', { name: 'Cancel' }); }
  confirm(label: string) { return this.dialog.getByRole('button', { name: label }); }
}
```

Confirm labels by action — all verified in `src/`:
`Delete` (account/tx/goal/event) · `Delete debt` · `Delete goal` · `Delete investment` · `Delete category` · `Delete plan` · `Delete projection` · `Delete this plan?` · `Save as flat` (loan→flat downgrade) · `Close investment` · `Roll over` · `Replace` (import) · `Wipe everything` · `Disable PIN` · `Record payment`.

**Toast vs banner** — the app uses both, and the choice differs per area:

```ts
export class Feedback {
  constructor(private page: Page) {}
  toast()   { return this.page.getByRole('status'); }   // role=status, 1.5s / 4s
  banner()  { return this.page.getByRole('alert'); }    // role=alert,  3s / 6s
  dismiss() { return this.page.getByRole('button', { name: 'Dismiss', exact: true }); }
}
```

> ⚠️ **Timing.** Toasts live 1.5 s (4 s for errors) and the transaction form navigates after 600 ms. Assert the toast **before** the navigation, or don't assert it. Prefer asserting the post-navigation state.
>
> ⚠️ `getByRole('button', { name: 'Dismiss' })` also matches the Home onboarding banner's **"Dismiss banner"** button (substring match). Use `exact: true`.

### 4.5 State seeding — the highest-leverage piece

The app persists one blob: IndexedDB → database **`finora`** → object store **`kv`** → key **`state`** → value `{ id: 'state', data: <State> }` (`src/domain/persistence.ts:75-86`, `:299`).

`data` is stored via structured clone, so it must be a **plain object**, not a JSON string.

`ensureReady()` reads `db.kv.get('state')` and uses it **verbatim** — no `mergeDefaults`. So a seeded row boots straight into the seeded state.

**Seed before boot, via `addInitScript`:**

```ts
// test/e2e/fixtures/app-state.ts
export async function seedState(page: Page, state: unknown) {
  await page.addInitScript(async (s) => {
    localStorage.removeItem('finora:v1');                       // legacy migration guard
    localStorage.removeItem('finora.pin.salt');                // no lock screen
    localStorage.removeItem('finora.pin.hash');
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('finora');
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('kv'))   db.createObjectStore('kv',   { keyPath: 'id' });
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(['kv', 'meta'], 'readwrite');
        tx.objectStore('kv').put({ id: 'state', data: s });
        tx.objectStore('meta').put({ key: 'schema', value: 1 });
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
  }, state);
}
```

**Why `addInitScript` and not `page.evaluate`:** the app's boot is async. `main.tsx` awaits `ensureReady()` *before* React mounts, and `ensureReady()` memoizes its promise and its in-memory `cached` value. Seeding after load gets overwritten by the next mutation. `addInitScript` runs before any page script.

**Critical seeding rules:**

| Rule | Why |
|---|---|
| Seed at least one income + one expense category | `mergeDefaults` is skipped on the seeded path — seed `categories: []` and the expense form renders a *"Restore default categories"* recovery panel instead of chips |
| Set `settings.onboardingComplete: true` | Otherwise Home shows the onboarding banner, which adds a **"Dismiss banner"** button and changes the layout |
| Don't hand-compute `paidSoFar` / `saved` / status | `recomputeDerived()` runs on boot (`App.tsx:66`) and overwrites them. Set the underlying `transactions` / `contributions` instead |
| Don't set `settings.cloudSyncEnabled: true` | A live Supabase session can reconcile and overwrite the seeded state on boot |
| Fresh browser context per test | Playwright already isolates; but never reuse `storageState` that contains a Supabase session |

**There's a ready-made seed** — `src/lib/demoSeed.ts:54` exports `seedDemo(state)` with `onboardingComplete: true` (`:455`). Use it as the canonical fixture template; mirror its output into `test/data/*.json` so the data lives in JSON per the skill's convention.

### 4.6 The seed fixture set

Mirror the manual plan's §1 seed into JSON:

```
data/
  accounts.json      Cash ৳5,000 · Main Bank ৳120,000 · bKash ৳2,500 · Visa Card ৳0
  transactions.json  Income ৳60,000 Salary→Main Bank · ৳12,000 Freelance→bKash
                     Expense ৳1,200 Groceries→Cash · ৳18,000 Rent→Main Bank · ৳250 Fuel→bKash
                     Transfer ৳3,000 Cash→bKash
  goals.json         Emergency fund ৳50,000 / ৳10,000 saved / 2027-06-30
  debts.json         flat  Loan from Rahim ৳20,000→Main Bank
                     loan  Bike loan ৳60,000 12% 36mo→Main Bank
                     lent  Lent to Karim ৳15,000←Cash
  investments.json   FDR  DBBL 1-year FDR ৳100,000 9% 12mo→Main Bank
                     DPS  Monthly DPS ৳5,000/mo 8% 12mo→Main Bank
  plans.json         Event Cox's Bazar trip 2027-01-15
                     Month plan Groceries ৳8,000 · Rent ৳20,000
                     Loan projection Car loan ৳100,000 9% 12mo
                     Investment projection DBBL 1-year FDR ৳100,000 9% 12mo
```

Two variants of every fixture are needed:
- **`today`** — dates anchored to the current month (for "this month" range assertions).
- **`spanning`** — dates spread across the last 6 months (for Insights period-comparison captions, FIN-H04).

---

## 5. Suite mapping — every manual case

50 cases. `A` = fully automatable, `P` = partially (some assertions need a human), `M` = manual-only, `V` = visual suite.

### T1 — Smoke (6) → `test/e2e/ui_tests/smoke.spec.ts`

| Manual | Test | Notes |
|---|---|---|
| FIN-S01 | `User can open the app and sees the shell` | Assert `data-theme="dark"` on `<html>`, sidebar visible |
| FIN-S02 | `User can reach all nine destinations` | Loop the 9 nav labels; assert each H1 |
| FIN-S03 | `Root redirect and 404` | `#/` → `#/home`; `#/nope` → **"Not found."** |
| FIN-S04 | `Hash routing survives a static build` | Separate project; `file://` — **P**, needs a `file://` project |
| FIN-S05 | `User can open and close the mobile drawer` | `@mobile` project; 4 dismissal paths |
| FIN-S06 | `Layout holds at three breakpoints` | Set viewport 1440 / 768 / 375, assert no horizontal overflow |

### T2 — Core functional (24) → one spec per domain

**`accounts.spec.ts`** — FIN-A01..A05

| Manual | Test | Key assertions |
|---|---|---|
| FIN-A01 | Account lifecycle | Create → card shows `Balance` + `৳ 5,000` (two separate nodes — assert separately); edit; delete |
| FIN-A02 | Account types | Table-driven: 5 types → title-case card label + icon + tone |
| FIN-A03 | Account validation | Table-driven: name empty → **"Account name is required"**; negative balance |
| FIN-A04 | Delete blocked by linked transactions | Banner: `Can't delete "Cash"` / `3 transaction(s) still reference this account.` / `Delete the linked transactions first, or archive them.` |
| FIN-A05 | Empty states + learn-more overlay | 96×96 illustration, `How accounts work →` → dialog → 4 dismissal paths (×, `Got it`, Escape, backdrop). ⚠️ `getByRole('button', {name:'Close'})` matches **both** backdrop and ✕ — use `exact: true` for ✕, `Close dialog` for backdrop |

**`transactions.spec.ts`** — FIN-T01..T06

| Manual | Test | Key assertions |
|---|---|---|
| FIN-T01 | Income/expense/transfer lifecycle | After save → URL becomes `#/transactions` (**wait for URL, don't sleep**) |
| FIN-T02 | Filters, grouping, ordering | 8 chips: `All` `Income` `Expense` `Transfer` `Payouts` `Debt payments` `This month` `Cash` |
| FIN-T03 | Amount validation & presets | Preset chips `৳ 50`…`৳ 1,000`; zero amount → **"Amount must be greater than zero"** |
| FIN-T04 | Category picker | Chips are `div[role=button]`; `Show all 36 categories` toggle; `Clear selected category` aria-label |
| FIN-T05 | Transfer specifics | From/To selects; assert identical source/destination is blocked |
| FIN-T06 | Edit form, linked debt & investment | Income has linked-debt select, **edit-income does not** (known defect → assert absence) |

**`goals.spec.ts`** — FIN-G01..G02 · **`debts.spec.ts`** — FIN-D01..D04 · **`investments.spec.ts`** — FIN-I01..I03 · **`insights.spec.ts`** — FIN-H01..H04

> FIN-D04 is a **defect-verification** case — see §7.

### T3 — Plan scratchpads (5) → `test/e2e/ui_tests/plan.spec.ts`

| Manual | Test | Key assertions |
|---|---|---|
| FIN-L01 | Plan hub + Month Plan | Hub rows: `Investments` / `Loans` / `This month` / `Events`; footnote **"Plans are pure scratch…"** |
| FIN-L02 | Batch budget editor | `Select multiple` → `Edit budgets` → tablist `Batch mode`: `Custom amounts` / `Same amount` / `Adjust %` / `Clear` |
| FIN-L03 | Event Plan | `Plan an event` → `Create event`; `Line items`; `Allocated` / `Paid` summary |
| FIN-L04 | Investment Planner + Loan Calculator | `Your money committed` / `If every term matures`; loan donut aria-label `Loan composition: …` |
| FIN-L05 | Save / Reset / dirty discipline | Status line `Unsaved changes — your edits haven't been saved yet.` / `Saved`; **there is no Reset button** — assert absence (defect) |

### T4 — Risk (9)

| Manual | Test | Suite |
|---|---|---|
| FIN-P01..P03 | PIN set/lock/unlock, wrong PIN, rate limiting, change/disable/forget | ui — `security.spec.ts` |
| FIN-C01..C04 | Sync panel, sign-in errors, signed-in state, sign-out | ui — `sync.spec.ts` — **env-gated** |
| FIN-W01..W02 | Wipe signed out / signed in; cloud-failure abort; PIN clear; persistence | ui — `wipe.spec.ts` |

### T5 — Exploratory (6) → mostly manual

See §8.

---

## 6. Data-driven tests

The manual plan has several table sweeps that map directly to JSON-driven specs.

**Account types (FIN-A02):**

```ts
// test/data/accounts.json
{
  "types": [
    { "value": "cash",          "label": "Cash",          "tone": "gold" },
    { "value": "bank",          "label": "Bank Account",  "tone": "sage" },
    { "value": "mobile_wallet", "label": "Mobile Wallet", "tone": "blue" },
    { "value": "card",          "label": "Card",          "tone": "red" },
    { "value": "other",         "label": "Other",         "tone": "neutral" }
  ]
}
```

```ts
// test/e2e/ui_tests/accounts.spec.ts
import * as data from '../../data/accounts.json';

data.types.forEach((t) => {
  test(`User can create a ${t.label} account`, async ({ page }) => {
    const accounts = new AccountsPage(page);
    await accounts.create({ name: `Test ${t.value}`, type: t.value, opening: 0 });
    await expect(accounts.card(`Test ${t.value}`)).toContainText(t.label);
  });
});
```

**Amount presets (FIN-T03)** and **validation sweeps (FIN-A03, FIN-T03, FIN-D03, FIN-I03)** follow the same shape — one JSON entry per case, no locator strings in specs, no array indexing for visual targets.

**Insights period comparison (FIN-H04)** — needs the `spanning` fixture:

```ts
test('Insight shows a period comparison only on comparable ranges', async ({ page }) => {
  await seedState(page, spanningFixture);
  const insights = new InsightsPage(page);
  await insights.goto();

  // last6 → caption present
  await insights.selectRange('Last 6 months');
  await expect(insights.trendRow('Average monthly expense')).toContainText('vs previous 6 months');

  // thisMonth → caption suppressed
  await insights.selectRange('This month');
  await expect(insights.trendRow('Average monthly expense')).not.toContainText('vs previous');
});
```

---

## 7. Automating the known-defect cases

The manual plan's §8 has **45 known defects**. Most are *negative* assertions — "this should be there but isn't" — which are the easiest kind to automate and the highest-value regression guards.

**Pattern:**

```ts
test('Debt delete is a hard delete, not a soft-archive (known defect #29)', async ({ page }) => {
  const debts = new DebtsPage(page);
  await debts.createFlatDebt({ name: 'Loan from Rahim', total: 20000, account: 'Main Bank' });

  await debts.openEdit('Loan from Rahim');
  await debts.deleteButton.click();
  await new ConfirmDialog(page).confirm('Delete debt').click();

  // The debt record is gone entirely (expected: PRD requires status='archived').
  await expect(debts.list).not.toContainText('Loan from Rahim');

  // The linked opening transaction survives.
  await debts.gotoTransactions();
  await expect(page.getByText('Borrowed')).toBeVisible();
});
```

**Automatable defect assertions, by case:**

| Manual | Defect | Assertion |
|---|---|---|
| FIN-D04 | #29 hard delete, not soft-archive | Debt absent from list after delete |
| FIN-D04 | #30 no "Archived debt" tag | `expect(page.getByText('Archived debt')).toHaveCount(0)` |
| FIN-D04 | #31 no "paid off. Nice." toast | `expect(page.getByRole('status')).toHaveCount(0)` after paying in full |
| FIN-D04 | #32 direction flip not confirmed | Save → no dialog appears |
| FIN-D04 | #33 no "unarchive it first" message | Pay chip absent for completed debt |
| FIN-D04 | #34 orphaned row says "Debt received" | `getByText('Debt received')` visible on an i_owe payment |
| FIN-L05 | #35 auto-save vs explicit save | Month Plan has no `Save plan` button |
| FIN-L05 | #36 "Tap Save plan" points at nothing | Banner text present, button absent |
| FIN-L05 | #37 Reset unimplemented | `expect(page.getByRole('button', { name: 'Reset' })).toHaveCount(0)` |
| FIN-L05 | #38 never-saved plan silently deleted | Plan absent after back-navigation |
| FIN-H04 | #39 Insights stat row divergence | Assert the 4 shipped rows; assert `Net flow` / `Saved toward goals` absent |
| FIN-H04 | #41 hint contradicts behaviour | Savings-rate hint says "0 if no income" but value renders `—` |
| FIN-A02 | #42 account type divergence | Assert `card` option exists; `Savings Account` does not |
| FIN-W01 | #45 no "Delete cloud copy" button | `expect(page.getByRole('button', { name: /Delete cloud copy/i })).toHaveCount(0)` |

> ⚠️ **When a defect gets fixed, these tests fail.** That's the point — but they need a clear convention so a fix doesn't look like a regression. Tag them `@known-defect` and document the expected-failure state. Options: (a) `test.fixme()` with a linked issue, (b) a dedicated `test/e2e/ui_tests/known-defects.spec.ts` excluded from the main gate, (c) `test.fail()` so Playwright reports "known failure" and flips to "unexpectedly passing" when fixed.
>
> **Recommended: (c) `test.fail()`** — Playwright then *reports the fix as a failure to act on*, which is exactly the signal you want.

---

## 8. T5 — what stays manual

The exploratory tier is a **charter**, not a checklist. Six cases:

| Manual | Charter | Automatable? |
|---|---|---|
| FIN-X01 | First-run walkthrough | **M** — observational, but the *known* sub-findings (two "Welcome to Finora." surfaces, `Insight` vs `See full Insights →`) become two assertions in `smoke.spec.ts` |
| FIN-X02 | Ledger consistency across screens | **P** — the numeric reconciliation (balance vs Home vs Insights) is a great automated check: seed a known state, read the figure from 3 screens, assert they're equal. High value — automate this |
| FIN-X03 | Destructive-action audit | **P** — every destructive action gets a confirm-dialog assertion; the *audit table* stays manual |
| FIN-X04 | Copy review | **M** — a human reads the copy |
| FIN-X05 | Layout stress | **V** — visual snapshots + long-string overflow checks |
| FIN-X06 | Unusual-but-legal values | **A** — table-driven: very long names, zero, negative, huge numbers, unicode |

So realistically: **FIN-X02, X03 (partially), and X06 should be automated.** FIN-X01, X04, X05 stay manual + visual.

---

## 9. Visual suite

**`visual.config.ts`** — must match the config that generated the baselines, and the CI OS must match the baseline OS.

Surfaces worth snapshotting (the ones with real visual design, not just text):

| Snapshot | Target |
|---|---|
| `Home.png` | full page, seeded state |
| `HomeEmpty.png` | no accounts |
| `Accounts.png` | 5 account cards, one per type |
| `Transactions.png` | mixed rows showing all 5 tag pills |
| `Debts.png` | i_owe + owed_to_me + loan cards + Summary |
| `Investments.png` | list with dual-value rows |
| `Insights.png` | all four cards, last6 range |
| `PlanMonth.png` | month plan grid |
| `DarkThemeOnly.png` | settings — proving no light theme exists |

Baselines go in `test/e2e/visual_tests/VisualTest.spec.ts-snapshots/` and **must be committed** — check `.gitignore` doesn't exclude them (the current one doesn't, but a future `*.png` rule would).

Windows vs Linux baselines are **not** interchangeable. Either generate per-OS baselines or run the visual job on the same OS as the committed baseline. For this repo, I'd pin the CI visual job to `ubuntu-latest` and commit `-linux` baselines only.

---

## 10. API suite — deferred

There's no first-party API. The only network surface is Supabase, and it's optional (build-time `BASE_URL` + `BASE_ANON_KEY`).

`test/e2e/api_tests/` is worth building **only** if you want to test the auth contract directly:

| Test | Endpoint |
|---|---|
| Sign up | `POST /auth/v1/signup` |
| Sign in | `POST /auth/v1/token?grant_type=password` |
| Wrong password | 400 + `invalid_credentials` |
| RLS isolation | User A cannot read User B's `finora_state` row |

The last one is the highest value — it's the security property the whole sync design rests on. But it needs a live Supabase instance, so:

- Run against `supabase start` (local) in CI, or a hosted project with service-role keys.
- Gate the suite: `test.skip(!process.env.BASE_URL, 'No Supabase configured')`.
- Keep `api.config.ts` separate so `npm run test_api` never runs in the default gate.

**Do this after the UI suite is green.** It's ~5% of the value for 100% of the environment complexity.

---

## 11. Execution order & build-out

| Phase | Deliverable | Effort |
|---|---|---|
| **0** | ✅ **DONE** — `dev:e2e` script (§2.2) + `Field` label fix (§2.1). Still to do: `npm i -D @playwright/test` · `npx playwright install --with-deps` · the three config files | ½ day left |
| **1** | `test/e2e/fixtures/app-state.ts` (IndexedDB seeding) + `BasePage` + `ShellPage` + `ConfirmDialog` + `Feedback` + JSON data store | 1 day |
| **2** | `smoke.spec.ts` (FIN-S01..S06) — proves the whole harness works | ½ day |
| **3** | T2 specs — accounts, transactions, goals, debts, investments, insights | 3–4 days |
| **4** | `known-defects.spec.ts` — the 14 assertions from §7 | 1 day |
| **5** | T3 plan specs + T4 security/sync/wipe specs | 2 days |
| **6** | Visual suite + baselines | 1 day |
| **7** | API suite (optional) + CI wiring | 1–2 days |

**Total: ~9 working days** for phases 0–6 (phase 0 is mostly done).

### CI

```yaml
jobs:
  e2e:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        os: [ubuntu-latest]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20.x', cache: npm }
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run build
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

---

## 12. Risks & gotchas

| # | Risk | Mitigation |
|---|---|---|
| 1 | ~~**`getByLabel` doesn't work** on any form field~~ **FIXED** | §2.1 applied — `Field.tsx` now wires `htmlFor`/`id`. Locked in by `Field.spec.tsx` |
| 2 | **Nav label is `Insight`, not `Insights`** | Locator uses `getByRole('link', { name: 'Insight' })`; route is `#/insights` |
| 3 | **Two `Close menu` buttons** when the drawer is open | Scope to `aside` or use `.first()` (backdrop is first in DOM) |
| 4 | **`aria-label="Close"` substring-matches `Close dialog`** | `exact: true` for ✕ buttons, `'Close dialog'` for backdrops |
| 5 | **Investment status pills are lowercase** (`active`, `matured`, `closed`, `rolled_over`) — not uppercase as in the design mockups | Use `getByText('active', { exact: true })` |
| 6 | **Account balance is two text nodes** — no contiguous `"Balance ৳ 5,000"` | Assert `Balance` and `৳ 5,000` separately, scoped to the card |
| 7 | **Only one `data-testid` in the app** | Everything is role+name based — but §2.1 gives every form field a real `<label for>`, so most targets are role+name too |
| 8 | **Toasts vanish in 1.5 s**; transaction form navigates after 600 ms | Assert post-navigation state, not the toast |
| 9 | **Seeding after boot gets overwritten** | Use `page.addInitScript`, not `page.evaluate` |
| 10 | **`recomputeDerived()` overwrites `paidSoFar`/`saved`/status on boot** | Seed underlying transactions/contributions, never derived fields |
| 11 | **`mergeDefaults` is skipped on the seeded path** | Seed real categories, else the expense form shows a recovery panel |
| 12 | ~~**Vite port fallback breaks `webServer`**~~ **FIXED** | `dev:e2e` script with `--strictPort` on 5174 |
| 13 | **A live Supabase session in reused storage state can overwrite the seed** | Never reuse storage state; force `cloudSyncEnabled: false` |
| 14 | **Sidebar `<aside>` stays in the DOM at mobile width** (transform-hidden, not `aria-hidden`) | Don't use visibility to distinguish desktop/mobile — use viewport + the `@mobile` project |
| 15 | **Two `EmptyState` components** — shared (`title`/`description`/`cta`) vs. Insights-local (`message`/`cta`) | A generic empty-state helper must handle both shapes |
| 16 | **`.only` / `--browser=all` / `--headed` in CI scripts** | `forbidOnly: true` in config; `headless` in config, never in a script |
| 17 | **A form renders two fields with the same label** (e.g. "Term (days)" and "Term (months)" under one `Type` branch) | Scope to the visible branch, or use `.first()` |

---

## 13. Appendix — verified locator reference

All strings below were read out of `src/` — not from the design mockups or the PRD.

### Navigation
```
Home · Plan · Insight · Transactions · Accounts · Goals · Investments · Debts · Settings
```
Sidebar CTA → `#/transactions/new`, accessible name `Add transaction` (a `+` glyph in a sibling span).
Hamburger → `getByRole('button', { name: 'Open menu' })`. Drawer close → `Close menu` (×2 — scope to `aside`).

### Filter chips (Transactions)
`All` · `Income` · `Expense` · `Transfer` · `Payouts` · `Debt payments` · `This month` · `Cash`

### Transaction tag pills
`Payout` · `Borrowed` · `Lent` · `Debt payment` · `Debt received`
(a11y name: `category: <label lowercased>`)

### Range pills (Insights)
`This month` · `Last 3 months` · `Last 6 months` · `Last 12 months` · `All time` (default `last6`)
Section aria-labels: `Cash flow over {range}` · `Net worth over {range}` · `Trends over {range}`

### Insights Trends rows
| Label | Hint | Value |
|---|---|---|
| `Average monthly expense` | `Total out across months with activity` | `৳ 5,000` |
| `Savings rate` | `(income − expense) ÷ income · 0 if no income` | `+12%` / `−8%` / `—` |
| `Days of runway` | `Cash ÷ daily avg expense · at current burn` | `45 d` / `—` |
| `Investment growth` | `Active schemes · maturity − contributed` | `+৳ 5,000` / `—` |

### Debt direction options
`I owe (you borrowed)` · `Owed to me (you lent)`

### Investment type options
`DPS (monthly installment)` · `FDR (lump-sum, fixed term)` · `Savings (interest-bearing)`
(Prompts use a *different* set: `DPS — monthly deposit scheme` · `FDR — fixed deposit receipt` · `Other (savings certificate / term deposit)` — don't mix them up.)

### Account type options
`cash` · `bank` · `mobile wallet` · `card` · `other` (lowercase — the cards render title-case)

### Plan preset cards (27)
`Rent` `Service Charge` `Groceries` `Utilities` `LPG` `WiFi` `Transport` `Food` `EMI` `Phone` `Health` `Education` `Coaching` `Kids` `Insurance` `Maid` `Pets` `Gym` `Entertainment` `Shopping` `Personal` `Gifts` `Charity` `Puja` `Savings` `Investment` `Goals`

### Confirm-dialog labels
`Delete` · `Delete debt` · `Delete goal` · `Delete investment` · `Delete category` · `Delete plan` · `Delete projection` · `Save as flat` · `Close investment` · `Roll over` · `Replace` · `Wipe everything` · `Disable PIN` · `Record payment`

### Formatting
- `fmtBDT` → `৳ 3,500` (U+09F3 + space + en-IN grouping, no decimals)
- `fmtDate` → `12 Aug 2026`
- `fmtRelative` → `Today` · `Yesterday` · `{n}d ago`

### Stable `aria-label` inventory
`security-section` (testid) · `Close dialog` · `Close` · `Open menu` · `Close menu` · `Dismiss` · `Dismiss banner` · `Clear selected category` · `Batch selection actions` · `Exit selection mode` · `Batch mode` · `Percentage change` · `New budget` · `Fill all with` · `Unlock Finora` · `Digit {n}` · `Mark this debt as a loan with interest` · `Add new item` · `Add line item` · `Edit event details` · `Event date` · `Remove contribution` · `Quick add budget cards` · `Quick add event categories` · `Event kit` · `Delete this plan` · `Net worth by month` · `Email address` · `Password` · `New password` · `Sign-in mode`

---

## 14. What this plan does **not** cover

- ~~**No Playwright code is written yet.**~~ **Done.** The plan is implemented; see §11 for the final layout.
- ~~**No first-party API to test.**~~ **Done.** `test/e2e/api_tests/` exercises the Supabase contract (RLS isolation + GoTrue auth) against a real project.
- **The 232 cases in `manual-test-detailed.md` beyond the 50** are out of scope. The detailed spec remains the source for anyone extending coverage.
- ~~**Visual baselines don't exist.**~~ **Done.** Both `-linux` and `-win32` baselines are committed; the CI visual job pins `ubuntu-latest` to match the `-linux` set.
- **Supabase-dependent behaviour** (FIN-C01..C04) is **Blocked** in CI without the `SUPABASE_URL` / `SUPABASE_ANON_KEY` secrets — same as the manual plan's §1. The suite self-skips when they are unset.

---

## 11. Where the code actually lives

The plan proposed `tests/` (Playwright) and `data/` (fixtures) as siblings of `src/`. The
implementation consolidated **everything test-related under a single `test/` root**, so
there is exactly one place to look and one glob to configure.

```
test/
  data/                 # JSON fixture stores (accounts, transactions, goals, …)
  docs/                 # this plan + the manual test specs
  e2e/
    api_tests/          # Playwright, api.config.ts   — Supabase REST contract
    fixtures/           # app-state seeding + JSON store loaders
    pages/              # Page Object Model (BasePage → ShellPage → feature pages)
    ui_tests/           # Playwright, playwright.config.ts — functional UI suite
    visual_tests/       # Playwright, visual.config.ts  — snapshot regressions
  support/              # shared test helpers (idb-helpers, sync-helpers)
  unit/                 # Vitest — unit + component specs, mirroring the src/ tree
  setup.ts              # Vitest global setup
```

Config mapping:

| Suite | Config | `testDir` |
|---|---|---|
| Unit / component | `vitest.config.ts` | `test/unit/**/*.spec.{ts,tsx}` |
| UI | `playwright.config.ts` | `test/e2e/ui_tests` |
| API | `api.config.ts` | `test/e2e/api_tests` |
| Visual | `visual.config.ts` | `test/e2e/visual_tests` |

Vitest specs import app modules through the `@/` alias (mirroring `tsconfig.json`
`paths`); the Playwright suites use relative paths because they run outside the Vite
alias resolution context.
