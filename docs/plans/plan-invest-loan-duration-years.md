# Plan — Duration in Years *or* Months for Loan & Investment Planners

## Goal

In the **Plan** module (`/plan/loan` and `/plan/invest`), the term/duration is currently
enterable only in months. Users think in years ("a 3-year FDR", "a 5-year personal loan").
Add a **unit toggle** so the duration can be entered in **years** or **months**, on both:

- the Loan Calculator detail form (`LoanCalculatorDetailScreen.tsx`)
- the Investment Planner detail form (`InvestmentPlannerDetailScreen.tsx`)

and surface a year-aware duration label across the list cards and hero copy.

## Non-goals

- The **real** Investments screen (`InvestmentAddScreen` / `InvestmentEditScreen`) and the
  **real** Debts screen keep months-only. The request is scoped to the *Plan* module.
- No change to the stored data model, no migration, no change to any formula.

## Key design decision — `termMonths` stays canonical

`InvestmentPlan.termMonths` and `LoanPlan.termMonths` remain the single source of truth.
The UI toggle is a **presentation-layer conversion only**:

```
years input  →  termMonths = round(years × 12)
months input →  termMonths = months
```

Why this is the right call:

- **No migration.** Existing persisted state (localStorage blob + Supabase rows) is untouched.
- **No formula churn.** `investmentPlanMaturityValue`, `projectionSeries`,
  `projectionBreakdown`, `investmentPlanMaturityDate`, `loanEMI`, `loanAmortization`,
  `summariseLoanPlan` all keep reading `termMonths`. The amortization table and the
  maturity date stay provably correct.
- **No ambiguity.** A stored plan has exactly one term number, so there is no
  "1 year vs 12 months" conflict to resolve on read.
- 12 months = 1 year exactly, so the conversion is lossless in both directions.

The alternative (storing `termYears` alongside `termMonths`) would need a migration,
conflict-resolution rules, and edits to every formula — all for no user-visible gain.

## 1. New shared helper — `src/domain/duration.ts`

A small, pure module. No React.

```ts
export type DurationUnit = 'years' | 'months';

export const MONTHS_PER_YEAR = 12;

/** Convert a user-entered duration in `unit` to whole months. */
export function durationToMonths(value: number, unit: DurationUnit): number;

/** Pick the natural unit for a stored month count. */
export function monthsToUnit(months: number): DurationUnit;

/** Split a month count into the (unit, value) pair for editing. */
export function splitDuration(months: number, unit: DurationUnit): { value: number; unit: DurationUnit };

/** Human label: "1 year", "18 months", "1 year 6 months", "6 months". */
export function formatDuration(months: number): string;

/** Compact label for list cards: "1y", "18mo", "2.5y". */
export function formatDurationShort(months: number): string;
```

Rules:

- `durationToMonths` rounds to a whole number of months, min 0. Years allow a
  fraction (`2.5 years` → 30 months). Non-positive / non-finite values collapse to 0.
- `monthsToUnit` picks **years only when the term is a whole number of years**
  (12, 24, 36). A term like 18 months stays in months — "18 months" scans faster
  than "1.5 years", and bank contracts are stated in months anyway. A zero term
  stays in months.
- `formatDuration`: months < 12 → `"N months"`; a whole year → `"N years"`;
  otherwise → `"N years M months"` (e.g. 18 → `"1 year 6 months"`).
- `formatDurationShort`: `12` → `"1y"`, `18` → `"18mo"`, `30` → `"2.5y"`.

## 2. New shared UI component — `src/components/DurationField.tsx`

A `Field`-wrapped control with a **Months / Years segmented toggle** under the number
input. Reused by both planner detail screens so the two surfaces stay siblings.

Shape:

```
TERM
┌──────────────────────────────┐
│  12                           │   ← input, value depends on the active unit
└──────────────────────────────┘
┌───────────────┐
│ [ Months ][ Years ]           │   ← unit toggle
└───────────────┘
```

Behaviour:

- The toggle is two small buttons (matching the app's `rounded-btn` segmented idiom
  already used in `SignInDialog.tsx` / `BatchBudgetEditor.tsx`).
- The input's accessible name is **`Term`** (not "Term (months)") — the unit lives in the
  toggle, so the label stays stable across unit switches. This keeps the field locatable
  in tests regardless of the active unit.
- Switching units **preserves the value**: 12 months → switch to Years → the field shows
  `1`. 1 year → switch to Months → the field shows `12`.
- The number input's `inputMode` is `decimal` when the unit is Years (fractional years
  allowed) and `numeric` when it is Months.
- The hint text changes with the unit:
  - Months → "Use the same number of months as your bank contract."
  - Years → "Years are converted to months — 1 year = 12 months."
- The component is controlled: props `months`, `onChange(months: number)`, plus optional
  `label` / `hint` overrides.

### Accessibility — the input must be the FIRST child of `Field`

`Field` associates its label with the first *labelable* child. A labelable element is
`button`, `input`, `meter`, `output`, `progress`, `select` or `textarea` — **not** a
`<div>`. So the number input has to be the first child of `Field` and the toggle a
decorative sibling *after* it; wrapping the input in a `<div>` (as an earlier draft did)
leaves the "Term" label unassociated and `getByLabel('Term')` finds nothing.

### Accessibility

- The toggle is a `role="group"` with `aria-label="Term unit"`.
- Each toggle button carries `aria-pressed`.
- The input keeps `id` wiring so `getByLabel('Term')` resolves.

## 3. Loan Calculator detail — `src/screens/LoanCalculatorDetailScreen.tsx`

- Replace the `Term (months)` `Field` with `<DurationField>`.
- Local state: keep `termMonths` as the single numeric state (already `useState`). The
  `DurationField` derives the displayed value + active unit from it, so there is no
  second source of truth and no conversion bug on blur.
- The `summary` / `rows` computations keep reading `termMonths` — unchanged.
- Amortization table caption: add the year-aware term, e.g.
  `"36 monthly payments over 3 years"` — keep the existing `Period / Due / Payment /
  Interest / Principal / Balance` columns untouched.
- The `← Loan Calculator` back link and Save/Delete toolbar are unchanged.

## 4. Investment Planner detail — `src/screens/InvestmentPlannerDetailScreen.tsx`

- Replace the `Term (months)` `Field` with `<DurationField>`.
- The live projection (`livePlan.termMonths`) is unchanged — it already reads
  `termMonths`.
- Hero copy becomes year-aware:
  - donut `ariaLabel`: `"… over 3 years"` instead of `"over 36 months"`.
  - the composition line: `"Composition at maturity, over 3 years"`.
- Maturity-date derivation (`matDateISO`) is unchanged — it already adds
  `termMonths` to the start month.

## 5. List cards & kit cards — year-aware labels

- `InvestmentPlannerScreen.tsx` — the plan card's rate/term row currently renders
  `{plan.termMonths}mo`. Use `formatDurationShort(plan.termMonths)` → `"1y"`,
  `"18mo"`, `"2.5y"`.
- `LoanCalculatorListScreen.tsx` — the rate/term row currently renders
  `{plan.termMonths}mo`. Same treatment.
- `InvestmentPlannerScreen.tsx` + `InvestmentPlannerNewScreen.tsx` — the starter-kit
  projection line currently reads `"in 12 months"`. Use `formatDuration(...)` →
  `"in 1 year"`, `"in 3 years"`.
- The maturity countdown label (`Matures in ~1.5y` / `Matures in 45d`) is already
  year-aware and stays as-is.

## 6. Tests

### Unit tests — new `test/unit/domain/duration.spec.ts`

Cover `durationToMonths`, `monthsToUnit`, `splitDuration`, `formatDuration`,
`formatDurationShort`:
- 12 months → "1 year"; 1 month → "1 month"; 18 → "1 year 6 months"; 30 → "2.5 years".
- `durationToMonths(2.5, 'years')` → 30; `durationToMonths(12, 'months')` → 12;
  `durationToMonths(0, …)` → 0; negative → 0.
- `splitDuration(12, 'years')` → `{ value: 1, unit: 'years' }`;
  `splitDuration(12, 'months')` → `{ value: 12, unit: 'months' }`;
  `splitDuration(24, 'months')` → `{ value: 2, unit: 'years' }` (auto-switch).

### E2E page objects

- `test/e2e/pages/LoanCalculatorPage.ts`
  - replace `termMonthsInput` with a `termInput` located by `getByLabel('Term')`.
  - add `termUnitMonthsButton` / `termUnitYearsButton` locators (by accessible name).
  - keep a `termMonthsInput` alias for compatibility with existing specs.
- `test/e2e/pages/InvestmentPlannerPage.ts` — same treatment.

### E2E specs

- `test/e2e/ui_tests/planners.spec.ts`
  - the existing "Term (months)" flow still works: the toggle defaults to **Months**, so
    `await loan.termInput.fill('12')` is unchanged.
  - add a step: switch the loan term to **Years**, fill `3`, and assert the amortization
    table has 36 rows (i.e. 3 years → 36 months).
  - add a step: on the FDR kit detail, switch to **Years**, fill `1`, and assert the
    maturity value / composition line read "1 year".
- `test/e2e/ui_tests/plan.spec.ts` — update the locator used at line 311.

### Test data

- `test/data/plans.json` — `loanFields` currently lists `"Term (months)"`. Change to
  `"Term"`. Add the new expected strings for the year-aware copy
  (`loanTermYearsCaption`, `investCompositionYears`).

### Manual test docs

- `test/docs/manual-test.md` and `test/docs/manual-test-detailed.md` — update the
  Loan Calculator / Investment Planner sections to describe the Months/Years toggle and
  the new year-aware copy.

## 7. Files touched

**New (feature)**
- `src/domain/duration.ts`
- `src/components/DurationField.tsx`
- `test/unit/domain/duration.spec.ts`

**Modified (feature)**
- `src/screens/LoanCalculatorDetailScreen.tsx`
- `src/screens/InvestmentPlannerDetailScreen.tsx`
- `src/screens/LoanCalculatorListScreen.tsx`
- `src/screens/InvestmentPlannerScreen.tsx`
- `src/screens/InvestmentPlannerNewScreen.tsx`
- `test/e2e/pages/LoanCalculatorPage.ts`
- `test/e2e/pages/InvestmentPlannerPage.ts`
- `test/e2e/ui_tests/planners.spec.ts`
- `test/e2e/ui_tests/plan.spec.ts`
- `test/data/plans.json`

**Restored from the `test` branch (branch drift, not feature — see §9)**
- `test/` (the whole suite), `vitest.config.ts`, `playwright.config.ts`,
  `visual.config.ts`, `api.config.ts`, `vite.config.nosync.ts`, `tsconfig.e2e.json`,
  `.env.example`
- `src/components/Field.tsx`, `src/domain/options.ts`, `src/lib/validation.ts`,
  `src/screens/DebtAddScreen.tsx`, `src/screens/DebtEditScreen.tsx`
- `package.json` — the `dev:e2e` / `test:e2e` scripts the runner needs

**Unchanged (deliberately)**
- `src/domain/types.ts` — no new fields.
- `src/domain/investmentPlans.ts`, `src/domain/loanPlans.ts`, `src/domain/math.ts` —
  all formulas keep reading `termMonths`.
- `src/domain/persistence*.ts` — no migration needed.
- The **real** Investments and Debts screens — months-only, untouched.

## 8. Risks

| Risk | Mitigation |
|---|---|
| Unit-switch loses the user's value | `DurationField` re-derives the displayed value from `termMonths` on every render — the value is never discarded, only re-expressed. |
| Fractional years produce a non-whole month count | `durationToMonths` rounds to whole months (1 year = 12 months exactly, so `2.5` → 30 exactly). |
| Existing e2e selectors break on the label change | `getByLabel('Term')` replaces `getByLabel('Term (months)')` in the two planner page objects, and `plan.spec.ts` / `planners.spec.ts` are updated. The real Investments / Debts pages keep their old labels, so their specs are untouched. |
| Amortization table row count changes | It can't — the table is driven by `termMonths`, and the conversion is exact. A 3-year term yields 36 rows, which is what the new spec asserts. |

## 9. Branch-drift fixes required to run the suite

The Playwright suite and the unit specs live on the **`test` branch**, not on `master`.
Running them on `master` fails at the very first `getByLabel(...)` because the
label-association feature they depend on is only on `test`. Four files were brought
across so the suite can run at all:

| File | Why |
|---|---|
| `src/components/Field.tsx` | Adds `htmlFor`/`id` label association. Without it every `getByLabel(...)` in the suite finds nothing — and `test/unit/components/Field.spec.tsx` (8 tests) fails. |
| `src/domain/options.ts` | Pure data module (account-type labels, filters). `test/unit/data/fixtures.contract.spec.ts` imports it. |
| `src/lib/validation.ts` + `src/screens/DebtAddScreen.tsx` + `src/screens/DebtEditScreen.tsx` | Extracts the hardcoded `"Enter a rate greater than zero."` / `"Enter a term greater than zero."` strings into `POSITIVE_RATE_ERROR` / `POSITIVE_TERM_ERROR`. Behaviour-identical; the fixture contract expects the named constants. |
| `.env.example` | `test/unit/data/fixtures.contract.spec.ts` asserts that every env var named in `test/data/auth.json` exists in `.env.example`. |

Also restored from `test` (the working tree was missing them, so the e2e runner could not
start): `test/`, `vitest.config.ts`, `playwright.config.ts`, `visual.config.ts`,
`api.config.ts`, `vite.config.nosync.ts`, `tsconfig.e2e.json`, and the `dev:e2e` /
`test:e2e` npm scripts.

These are **not** part of the feature — they are the pre-existing gap between the two
branches, closed so the feature could be verified. They are called out separately in the
commit so they can be reviewed on their own.

## 10. Verification

1. `npx tsc -b --noEmit` — clean. `npx tsc --noEmit -p tsconfig.e2e.json` — clean.
2. `npm run build` — succeeds (pre-existing chunk-size warnings only).
3. `npm test` — **487 passed / 487**, 37 files. Includes the 22 new `duration.spec.ts`
   cases and the previously-failing `Field.spec.tsx` / `fixtures.contract.spec.ts`.
4. `npx playwright test --project=chromium test/e2e/ui_tests/planners.spec.ts
   test/e2e/ui_tests/plan.spec.ts` — **6 passed**, including the new years assertions.
5. Full chromium suite — 72–74 passed per run. The 1–3 failures are `cloud.spec.ts`
   (needs a live Supabase backend) and `smoke.spec.ts` FIN-S06 (a viewport reflow
   flake); both pass in isolation and neither touches the Plan module.
6. Manual pass: open Plan → Loans → new projection → switch term to Years → `3` → the
   amortization table shows 36 rows and the caption reads "3 years"; Plan → Investments →
   FDR kit → switch to Years → `1` → the composition line reads "over 1 year" and the
   maturity date is 12 months out.
