---
project: Finora
scope: V1 functional prototype
altitude: feature (entire V1)
date: 2026-08-13
status: draft
audience: solo developer (single user)
---

# Finora — Architecture Spine

## 1. Paradigm

**Local-first single-page app, no framework, no build step.** The product is a personal bookkeeping tool for one user (you). The whole app lives in one HTML file plus a CSS file plus a handful of JS modules. It opens by double-click. Data is per-browser via `localStorage`. There is no backend, no account, no sync.

**Why this paradigm:** the PRD is local-first by design (§1, §13). Every architectural choice flows from that. Choosing otherwise would mean rewriting the PRD.

**Carries for free:** the four-question mental model, the no-PIN-recovery stance, the JSON export/import contract, the dark/light theme split, the additive module design (Debts → Investments → future).

## 2. Stack and shape

| Layer | Choice | Notes |
|---|---|---|
| Markup | One HTML file | Per AD-8. Contains all 35 screens as `<section id="X" class="screen">`. |
| Styling | One CSS file | Custom properties driven, `[data-theme="dark"\|"light"]` switches the palette. |
| Logic | Vanilla JS, ES modules | One module per entity + a thin `app.js` glue layer. No transpilation. |
| Build | None | No bundler, no npm runtime, no Vite, no React. Vitest lives in a separate `tests/` tree. |
| Persistence | `localStorage` key `finora:v1` | Single JSON blob, full state. Per AD-2. |
| Tests | Vitest, run via `npx vitest` | Source files remain browser-loadable. Per AD-12. |
| Deploy | Static file host (GitHub Pages / Netlify / Vercel) | After AD-8 single-file merge. Per AD-13. |

## 3. Data shape (AD-9)

Top-level keys, in this order:

```
finora:v1 → {
  version: 1,
  accounts:      [{ id, name, type, openingBalance, createdAt }],
  transactions:  [{ id, type, amount, date, accountId, categoryId?,
                    linkedDebtId?, linkedInvestmentId?, note? }],
  goals:         [{ id, name, target, saved, targetDate, createdAt }],
  debts:         [{ id, name, direction, total, paidSoFar, dueDate?,
                    person?, status, createdAt }],
  investments:   [{ id, name, type, principal, rate, startDate,
                    termMonths, payoutAccountId, institution?, status,
                    rolledIntoId?, createdAt }],
  categories:    [{ id, type: 'income'|'expense', name }],
  settings:      { theme: 'dark'|'light'|'auto', onboardingComplete: bool }
}
```

**Invariants:**

- IDs are UUIDs, generated client-side at create time.
- `transactions` is the only collection that holds money movement. Account balances are derived.
- `linkedDebtId` and `linkedInvestmentId` are one-way pointers from transaction → entity. The entity does NOT carry a list of its transactions.
- `paidSoFar` on a debt is derived as the sum of its linked transactions. Stored only as a cache for sort order; recomputed on every load.
- `investments.maturityValue` is computed (`principal × (1 + rate/100 × termMonths/12)`), never stored. `maturityDate` is computed (`startDate + termMonths`), never stored.

## 4. Math rules (PRD §10, codify in tests)

| ID | Rule | Formula |
|---|---|---|
| R1 | Monthly income | Σ income transactions dated in current month |
| R2 | Monthly expenses | Σ expense transactions dated in current month |
| R3 | Account balance | openingBalance + Σ all transactions on that account |
| R4 | Transfer rule | Transfers move money between accounts; not income or expense |
| R5 | Goal requirement | (target − saved) ÷ monthsLeft |
| R7 | Debt paid_so_far | Σ linkedExpense transactions (i_owe) or linkedIncome transactions (owed_to_me) |
| R8 | Debt completion | paid_so_far ≥ total → auto-complete |
| R9 | Investment maturity value | principal × (1 + rate/100 × termMonths/12) |
| R10 | Investment status flip | today ≥ maturityDate → matured |

(R6 and the implicit R-accounts-derive-from-transactions are not numbered in the PRD; treat them as load-bearing invariants.)

## 5. Render layer (AD-6)

**Rule:** every screen has a `render(state)` function. On any data mutation, `app.js` calls `render(state)` on the active screen.

**Boundary — the focus rule:**

```
on dataChanged(state):
  active = document.activeElement
  insideActiveScreen = active && activeScreen.contains(active)
  if !insideActiveScreen: render(state)
  else: skipRenderButUpdateDerivedValues(state)
```

Where `updateDerivedValues(state)` updates only computed text in the active screen (e.g. the "remaining" label on a goal form) without touching the focused input.

**Prevents:** React-style reconciliation, focus loss bugs, custom diffing libraries.

## 6. Routing (AD-7)

Hash routing, location-only. URL shape: `index.html#<screen-id>`.

**Upgrade:** most navigations are `<a href="#screen-id">`. The router listens to `hashchange` and toggles `class="screen active"`. Buttons inside forms that should be navigation use `data-goto="screen-id"` and the router has a small bridge that intercepts clicks and updates the hash.

**Prevents:** History API (which would break `file://`), server routing, pushState complexity.

## 7. Theming (AD-8)

CSS custom properties scoped to `:root` and `[data-theme="dark"]` / `[data-theme="light"]`. Single source of truth.

```
[data-theme="dark"] {
  --bg: #1E2A26; --surface: #253229; --ink: #F1F3EF;
  --primary: #5DBFA0; --accent: #D9B26B; --danger: #D67560;
  /* ... full token set ... */
}
[data-theme="light"] {
  --bg: #F7F4EC; --surface: #FFFFFF; --ink: #1A1F1B;
  --primary: #0D8275; --accent: #A47E2C; --danger: #B8553F;
  /* ... full token set ... */
}
```

**Theme apply:** `app.js` reads `settings.theme` on boot and sets `document.documentElement.dataset.theme`. If `theme === 'auto'`, it listens to `matchMedia('(prefers-color-scheme: dark)')` and reflects the live value into the dataset.

**Prevents:** the dual-file drift that bit the last commit. Two HTML files diverging on every screen addition.

## 8. Persistence (AD-2, AD-3)

```
KEY = 'finora:v1'
load()   → JSON.parse(localStorage.getItem(KEY) || 'null') || DEFAULT_STATE
save(s)  → localStorage.setItem(KEY, JSON.stringify(s, null, 2))
```

**Single blob.** Save the whole state on every mutation. ~30 ms at 10K rows. Acceptable per AD-3.

**Save triggers:** explicit user actions only. Edit field, focus lost, blur → save. Buttons that mutate → save on click. No debouncing for V1; localStorage writes are coalesced by the browser.

**Quota handling:** if `setItem` throws (QuotaExceededError), `app.js` shows the role=alert banner: *"Couldn't save. Your storage is full. Export and delete old data."* Per AD-11.

## 9. Error model (AD-11)

| Error class | Surface | Format |
|---|---|---|
| Field validation | Inline, below the input | Three-part: what, why, fix (PRD §11) |
| Async / system | `<div role="alert">` banner top-of-screen | Same three-part format |
| Confirmations (delete, replace-on-import) | Modal | Cancel \| Confirm |
| Save success | None | Silent. Screen return is the cue. |

No toasts. No success toasts. No "Saved!" badge.

## 10. Export / Import (AD-10)

**Export** writes `finora-backup-YYYY-MM-DD.json`:

```json
{
  "version": 1,
  "exportedAt": "2026-08-13T12:34:56.789Z",
  "data": { /* the entire state blob */ }
}
```

Pretty-printed, 2-space indent. The `version` field is the forward-compat escape hatch.

**Import** validates:
1. Top-level `version` is a number ≤ current.
2. `data` has all required top-level keys.
3. Each entity has the required fields (by schema).

On failure, role=alert banner with the specific failure ("Missing field `rate` on investment `DBBL FDR`"). On success, modal confirms "This will replace all your current data. Continue?" → wipes current → loads file → re-renders.

## 11. Test surface (AD-12)

```
package.json     ← vitest, no build tools
tests/
  math.spec.js   ← R1–R10, all formulas
  debts.spec.js  ← auto-complete at paid_so_far ≥ total, derived paid_so_far
  investments.spec.js ← maturity value, status flips, rollover
  export-import.spec.js ← round-trip identity, version check, schema validation
```

Source files (`accounts.js`, `debts.js`, etc.) are ES modules with no DOM access for the math side. Vitest imports them directly. Tests run via `npx vitest`. CI script: `npm test`.

## 12. Module map

```
docs/architecture/2026-08-13-arch-v1/
  ARCHITECTURE-SPINE.md  ← this file
  .memlog.md             ← append-only decision log
docs/ux-designs/ux-finora-2026-08-13/
  PRD.md
  UI-UX-FLOW.md
  mockups/v2/
    index.html  ← after AD-8 merge (single file, both themes)
    app.css
    js/
      app.js        ← router, render layer, persistence glue
      accounts.js
      transactions.js
      goals.js
      debts.js
      investments.js
      settings.js
      export-import.js
      math.js       ← pure functions, tested by Vitest
  tests/
    math.spec.js
    debts.spec.js
    investments.spec.js
    export-import.spec.js
  package.json    ← only dev dep: vitest
```

## 13. Deferred (named so they don't sneak back in)

- **Backend / sync** — explicitly out per PRD §1, §13.2. Not even a "future" placeholder in code.
- **Auth / account / PIN recovery** — PRD §1 says no. PIN-lock is the only auth surface; loss = data loss.
- **Charts, financial health, monthly planning, net worth, insights** — PRD §5 non-goals.
- **Stocks / mutual funds / crypto / market-price instruments** — PRD §5 N3 deferred to V2.
- **Daily interest accrual** — PRD §5 N4 explicitly deferred.
- **Pre-closure of investments with adjusted interest** — deferred to V2 per PRD §9.8.
- **Compounding frequency other than simple** — deferred.
- **Tax (TDS) tracking on interest income** — deferred.
- **React / any framework port** — possible V2 if the prototype graduates, but not in V1.
- **State-management library / Zustand / Redux** — vanilla is enough.
- **Build tool / Vite / esbuild / webpack** — none in V1.
- **Hosting beyond static files** — no server-side rendering, no edge functions.

## 14. Open questions

(None at time of writing. Anything discovered during build lands here.)

## 15. Pre-flight checklist for the build

1. AD-8 first: merge `dark.html` + `light.html` into a single `index.html` driven by `[data-theme]`. This is the foundation; everything else depends on it.
2. AD-12 second: scaffold `tests/` with Vitest and write the math tests (R1–R10) before any wiring. The math is load-bearing.
3. AD-9 third: implement the data layer (`accounts.js`, `transactions.js`, `goals.js`, `debts.js`, `investments.js`) with pure CRUD. No DOM yet.
4. AD-6 fourth: implement the render layer (`app.js` with `render(state)` + focus rule).
5. AD-7 fifth: convert `data-goto` buttons to `<a href="#screen">` where possible; add the click-bridge for the rest.
6. AD-11 sixth: error UI — inline + role=alert banner component.
7. AD-10 seventh: export/import wiring.
8. AD-13 last: deploy to GitHub Pages (or chosen host) once everything else is solid.

## 16. Definition of Done — architecture

- [ ] Single-file theming refactor landed (AD-8).
- [ ] Vitest setup with all R1–R10 math tests passing (AD-12).
- [ ] Data layer modules in place with the shape in §3 (AD-9).
- [ ] Render layer with focus rule implemented (AD-6).
- [ ] Hash routing with `<a href>` polish (AD-7).
- [ ] Inline errors + role=alert banner working on all 35 screens (AD-11).
- [ ] Export/import round-trip test passing (AD-10).
- [ ] Deployed to a static host with a reachable URL (AD-13).
- [ ] No AD in §13 was violated.