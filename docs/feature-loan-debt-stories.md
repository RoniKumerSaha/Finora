# Loan-kind Debt — Epics & Stories

Companion to `docs/feature-loan-debt.md`. Stories are sized for one dev-day each. Dependencies are noted as `[blocks: …]` / `[blocked by: …]`.

**Status legend** — ☐ todo · ◐ in progress · ☑ done

---

## Epic L1 — Data model & math

The smallest layer that makes loan-kind debts possible. No UI.

### Story L1.1 — Add `DebtKind` and `interestRate` to the Debt type
**File:** `src/domain/types.ts`

- Add `export type DebtKind = 'flat' | 'loan';`
- Add optional fields `kind?: DebtKind;` and `interestRate?: number;` on the `Debt` interface.
- JSDoc: explain that `kind === 'loan'` requires `interestRate > 0`, and that both fields are optional in storage (defaults applied on read).

**AC:**
- `tsc --noEmit` passes.
- Existing test suite passes (no regressions).
- A debt with neither field present still parses from localStorage.

☐ todo

### Story L1.2 — Pure function `loanPaymentSplit` in math.ts
**File:** `src/domain/math.ts`

Add a single exported pure function:

```ts
export interface LoanPaymentSplit {
  interest: number;
  principal: number;
}

export function loanPaymentSplit(
  outstanding: number,
  payment: number,
  annualRate: number,
): LoanPaymentSplit
```

Rules per PRD §8:
- `monthlyRate = annualRate / 12 / 100`.
- `interest = round(outstanding * monthlyRate)`.
- If `payment < interest`: `interest = payment`, `principal = 0` (underpayment — caller surfaces a warning).
- If `payment > outstanding + interest`: `principal = outstanding`, `interest = round(outstanding * monthlyRate)`, no negative outstanding.
- Otherwise: `principal = payment − interest`.

**AC:**
- Function is pure, no side effects.
- All edge cases covered by tests in `math.spec.ts`.
- `loanEMI()` is reused for the modal pre-fill, but `loanPaymentSplit` does **not** depend on it.

☐ todo

### Story L1.3 — Extend `debts.add` / `debts.update` with `kind` and `interestRate`
**File:** `src/domain/debts.ts`

- `AddDebtInput` accepts `kind?: DebtKind` and `interestRate?: number`.
- `add()`: if `kind === 'loan'`, require `interestRate > 0` (throw the same error pattern as today).
- `update()`: same validation. If a patch sets `kind: 'flat'`, clear `interestRate`.
- `list()` / `get()`: default missing `kind` to `'flat'`.
- `withDerived()`: still computes `paidSoFar` the same way (gross sums) — that's unchanged. Outstanding derivation for loans happens in the read-side helper (story L1.4).

**AC:**
- Adding `kind: 'loan'` without a rate throws.
- Adding `kind: 'loan'` with `rate: 12` succeeds; persisted debt round-trips.
- Adding `kind: 'flat'` (or omitting) keeps today's behaviour exactly.
- Existing tests pass.

☐ todo

### Story L1.4 — `outstandingFor(debt, transactions)` derived helper
**File:** `src/domain/debts.ts`

Add:

```ts
export function outstandingFor(debt: Debt, transactions: Transaction[]): number
```

- For `kind === 'flat'`: returns `total − paidSoFar` (today's behaviour).
- For `kind === 'loan'`: walks linked transactions chronologically, applies `loanPaymentSplit` at each step. Returns the resulting outstanding after the last transaction.

**AC:**
- A loan debt with no payments returns `principal`.
- After the worked example in PRD §8, outstanding equals 95,335.
- Pure function; no state mutation.

☐ todo

---

## Epic L2 — Add / Edit screens

The user entry points for declaring *"this debt carries interest."*

### Story L2.1 — DebtAddScreen: optional "Is this a loan?" toggle + rate field
**File:** `src/screens/DebtAddScreen.tsx`

- Add a collapsed `<details>` (or styled toggle) titled **"Is this a loan with interest?"**.
- Inside: an interest-rate field (`%`, 0–100) with the hint copy from PRD §9.1.
- Toggling it on sets `kind = 'loan'` in local state; toggling off sets `kind = 'flat'` and clears the rate.
- On submit, include both fields in the `debts.add` call.
- Validation: rate field turns red and Save is disabled if rate is empty while toggle is on.

**AC:**
- Submitting with toggle off behaves identically to today.
- Submitting with toggle on + rate 12 creates a loan-kind debt.
- Submitting with toggle on + empty rate surfaces a banner *"Enter the annual interest rate."*
- All existing tests pass.

☐ todo

### Story L2.2 — DebtEditScreen: same toggle + rate field, pre-filled
**File:** `src/screens/DebtEditScreen.tsx`

Mirror L2.1:
- Toggle state derived from `debt.kind === 'loan'`.
- Rate field pre-filled with `debt.interestRate` if present.
- Save validates the same way.
- When toggling a loan-kind debt back to flat, confirm dialog: *"This will treat past payments as 1-for-1 going forward. Continue?"* (One-step confirmation; no data lost.)

**AC:**
- Opening an existing loan-kind debt shows the toggle on and the rate populated.
- Saving keeps `kind` and `rate` intact.
- Toggling back to flat asks for confirmation, then clears the rate field on save.
- Existing flat debts open with the toggle off and no rate field shown.

☐ todo

---

## Epic L3 — Debts list card

Where the user sees the result.

### Story L3.1 — Per-card "Pay" button on loan-kind debts
**File:** `src/screens/DebtsListScreen.tsx`

- In the right zone of `DebtCard`, below the "of X total" caption, render a small **"Pay"** button — only when `d.kind === 'loan'` and `d.status === 'active'`.
- Tap → open `LoanPaymentModal` (story L3.2).
- Style: same `Button` component, `variant="ghost"`, compact size, full-width within the right zone.

**AC:**
- Pay button is hidden on flat debts and on completed loans.
- Pay button never pushes the right zone wider than its current `sm:min-w-[200px]`.

☐ todo

### Story L3.2 — `LoanPaymentModal` quick-entry
**File:** new `src/screens/LoanPaymentModal.tsx`

- Fields: amount (pre-filled with `loanEMI(principal, rate, termMonths)` if `termMonths` is set on the debt; otherwise empty), date (today), account (the user's last-used account), optional note.
- On save: creates an expense transaction (or income, for `owed_to_me`) tagged with `linkedDebtId`.
- Closes the modal, fires a toast: *"Payment of ৳3,321 recorded — ৳1,000 interest, ৳2,321 principal."*

**AC:**
- Modal mounts and unmounts cleanly; no memory leak.
- Toast shows the actual computed split.
- Side-effect: opens AddTransactionPicker-style? — No, this is its own focused modal to keep the flow tight.

☐ todo

### Story L3.3 — Per-card split line + "Paid" wording
**File:** `src/screens/DebtsListScreen.tsx` (in `DebtCard`)

- For loan-kind debts with ≥ 1 linked transaction, render under "of X total": *"Last: ৳1,000 interest · ৳2,321 principal"*.
- For loan-kind debts with payments, change the left-zone meta from *"Paid X of Y total"* to *"Paid X · ৳1,000 interest · ৳2,321 principal"* (use the running totals).
- For flat debts, nothing changes.

**AC:**
- Split line uses `tabular-nums` and `text-muted`.
- Line ellipsizes gracefully on narrow viewports.

☐ todo

### Story L3.4 — Outstanding replaces Remaining for loan-kind debts
**File:** `src/screens/DebtsListScreen.tsx`

- Right zone headline: for loan-kind, label changes from "Remaining" to "Outstanding". Value is `outstandingFor(d, state.transactions)`.
- For flat debts, "Remaining" + `total − paidSoFar` (today's behaviour).

**AC:**
- Outstanding for the worked-example loan matches the calculation in PRD §8 after 2 payments.
- Flat-debt rows render identically to today.

☐ todo

---

## Epic L4 — Activity feed and summary

### Story L4.1 — Activity feed gains a split row for loan-kind debts
**File:** `src/screens/DebtEditScreen.tsx`

- Each linked transaction row in the Activity card gets a tiny bottom line for loan-kind debts: `৳1,000 interest · ৳2,321 principal` in muted text.
- Flat debts keep the existing single-line rows.

**AC:**
- Hidden when `kind === 'flat'`.
- For loan-kind debts, the running outstanding after each transaction can be displayed in a third micro-line if it fits — defer if cluttered.

☐ todo

### Story L4.2 — Summary card "How it works" copy gains one sentence
**File:** `src/screens/DebtsListScreen.tsx`

- When at least one active loan-kind debt exists, append one sentence to the existing "How it works" paragraph per PRD §9.6.
- Otherwise: no change.

**AC:**
- Copy is visually integrated (same `text-xs text-muted`, same italic emphasis).

☐ todo

---

## Epic L5 — Tests, persistence, docs

### Story L5.1 — Unit tests for `loanPaymentSplit` and `outstandingFor`
**Files:** `src/domain/math.spec.ts`, `src/domain/debts.spec.ts`

- Cover the 6 cases listed in PRD Appendix B.
- Cover round-trip persistence for a loan debt with 3 payments.

**AC:** `npx vitest run` passes; coverage report ≥ existing baseline.

☐ todo

### Story L5.2 — Update PRD.md with §9.18 and rules R20, R21
**File:** `PRD.md`

- Add §9.18 referencing this PRD.
- Add R20 ("Loan-kind Debt — outstanding computed from transaction history using `loanPaymentSplit`") and R21 ("`kind === 'loan'` requires `interestRate > 0`").
- Update the "Last Updated" line in the header table.

**AC:** Document builds; no broken anchors.

☐ todo

---

## Dependency graph

```
L1.1 ──► L1.3 ──► L2.1 ──► L3.1 ──► L3.2
        │              │            │
        ▼              ▼            ▼
       L1.4 ──► L3.4   L2.2 ──► L3.3 ──► L4.1
                                │
                                ▼
                              L4.2
                                │
                                ▼
                              L5.1, L5.2
```

L1.1 and L1.2 are independent and can be picked up in parallel.

---

## Sizing

| Epic | Stories | Approx. dev-days |
|---|---|---|
| L1 — Data model & math | 4 | 2 |
| L2 — Add / Edit screens | 2 | 1.5 |
| L3 — Debts list card | 4 | 2 |
| L4 — Activity feed & summary | 2 | 0.5 |
| L5 — Tests, persistence, docs | 2 | 1 |
| **Total** | **14** | **~7 dev-days** |
