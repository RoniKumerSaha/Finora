---
status: final
name: Finora — Negative-amount guard
date: 2026-08-14
sources:
  - ../ux-finora-2026-08-13/DESIGN.md
  - ../ux-finora-2026-08-13/EXPERIENCE.md
  - src/domain/validation (target location)
parent_run: ux-finora-2026-08-13
updated: 2026-08-14
---

# Finora — Negative-amount guard

A peer contract capturing the rule, the inline error contract, the domain defense-in-depth, and the acceptance criteria for **preventing zero/negative money amounts** from being saved across every money-amount input in the app.

> Spine rule. This document captures behavioral decisions only. Visual identity (the inline error styling, the danger border, the disabled Save button) inherits verbatim from the parent run. No new tokens, no new components, no new copy beyond the existing *"Amount must be greater than zero."* banner string.

## Foundation

- **Scope**: every money-amount input in the application. Single rule, single source of truth.
- **Enforcement model**: **defense-in-depth.**
  - **Inline layer** (UI): the input shows a danger-colored border and an inline error the moment the value is invalid. Save is disabled.
  - **Domain layer** (`src/domain/transactions.ts` etc.): the existing `validate()` rule (`amount > 0`) is the source of truth. The UI is a presentation of this rule.
- **Why defense-in-depth**: a future programmatic save, a dev-tools tampering, or a future feature path that bypasses the inline validation must not be able to insert a negative transaction. The domain guard is the floor.

## Rule definition

A money-amount input value is **valid** if and only if all of the following hold:

1. The string is not empty.
2. The string parses as a finite JavaScript number (`Number.isFinite(n)` is `true`).
3. The parsed number is strictly greater than `0`.

This rejects:
- Empty strings (`""`)
- The literal string `"0"`, `"0.0"`, `"0e0"`
- Negative integers (`"-250"`)
- Negative decimals (`"-12.50"`)
- Negative scientific notation (`"-2.5e2"`)
- `NaN` (`Number("abc")`)
- `Infinity` / `-Infinity` (browser quirks)

It accepts:
- Positive integers (`"250"`)
- Positive decimals (`"12.50"`)
- Positive scientific notation (`"2.5e2"` — coerces to 250)
- Leading-zero forms (`"0250"` — coerces to 250)

The rule lives in one place:

```ts
// src/lib/validation.ts (NEW)
export function isPositiveMoney(s: string): boolean {
  const n = Number(s);
  return Number.isFinite(n) && n > 0;
}
```

## Surfaces

Every form that accepts a money-amount input must apply this rule. The current inventory:

| # | Screen | Field | Form / Modal |
|---|---|---|---|
| 1 | Add Expense | Amount | Form |
| 2 | Add Income | Amount | Form |
| 3 | Add Transfer | Amount | Form |
| 4 | Edit Transaction | Amount | Form |
| 5 | Investment detail (DPS) | Amount | Modal |
| 6 | Goal detail | Amount | Modal |
| 7 | Add Account | Opening balance | Form |
| 8 | Edit Account | Opening balance | Form |
| 9 | Add Goal | Target amount | Form |
| 10 | Add Goal | Already saved | Form (optional) |
| 11 | Add Debt | Total amount | Form |
| 12 | Edit Debt | Total amount | Form |
| 13 | Add Investment | Principal | Form |
| 14 | Add Investment | Monthly contribution | Form (DPS only) |
| 15 | Edit Investment | Principal | Form (non-DPS only) |
| 16 | Edit Investment | Monthly contribution | Form (DPS only, may be locked) |

**Note**: opening balance and "already saved" can legitimately be **zero** in some real scenarios (a brand-new account with no starting funds; a fresh goal that hasn't received any contribution yet). The rule therefore only applies to fields where the model says "must be > 0." For "already saved" the rule is **`>= 0`**, not `> 0`. The implementation must distinguish these two cases.

The rule per field:

| Field | Rule | Reason |
|---|---|---|
| Transaction amount (income/expense/transfer) | `> 0` | A zero transaction is meaningless. |
| DPS contribution amount | `> 0` | A zero contribution is meaningless. |
| Goal contribution amount | `> 0` | A zero contribution is meaningless. |
| Account opening balance | `>= 0` | Allowed to be `0` (a new empty account). |
| Goal target amount | `> 0` | A zero target makes the goal meaningless. |
| Goal "already saved" | `>= 0` | Allowed to be `0` (nothing saved yet). |
| Debt total | `> 0` | A zero debt is meaningless. |
| Investment principal (non-DPS) | `> 0` | A zero principal is meaningless. |
| Investment monthly contribution (DPS) | `> 0` | A zero monthly contribution is meaningless. |

Two helpers are exported:

```ts
export function isPositiveMoney(s: string): boolean { /* > 0 */ }
export function isNonNegativeMoney(s: string): boolean { /* >= 0 */ }
```

## Inline error contract

When the field is invalid:

1. The input's border becomes danger-colored (`border-danger`).
2. The focus ring (when focused) becomes danger-tinted (`focus:ring-danger/30` instead of `focus:ring-primary/30`).
3. An inline error appears directly below the field, in 12px danger color, with the exact copy: **"Amount must be greater than zero."** (For the `>= 0` rule on opening balance / already saved, the copy is **"Amount must be zero or greater."**)
4. The form's **Save** button is **disabled** (`disabled={true}`), grayed to 50% opacity, cursor `not-allowed`.

When the user fixes the value:

1. The border returns to its resting state (`border-border`).
2. The focus ring returns to its resting state (`focus:ring-primary/30`).
3. The inline error disappears.
4. The Save button re-enables.

The user **always keeps what they typed**. There is no auto-strip, no auto-correct, no input event listener that mutates the value. The validation is purely presentational — it shows the user that what they typed is invalid, but does not change what they typed. They can fix the minus sign themselves.

## Submit-time contract

- The Save button is disabled while invalid. Clicking it does nothing.
- The domain `validate()` is **not** removed. It remains the source of truth and runs on every `add()` / `update()` call from the domain layer. If the inline validation is ever bypassed (programmatic save, future feature), the domain guard still throws.
- The existing banner system continues to work. If the inline validation is bypassed and the domain throws, the banner still shows the same copy as a last resort.

## State patterns

### Field-empty state

- An empty amount field is treated as invalid (`isPositiveMoney("")` is `false`). The inline error reads *"Amount must be greater than zero."* Save stays disabled.
- This applies to **every** money-amount field including optional ones (e.g. "already saved" — when empty, the rule treats empty as `>= 0` since `Number("") === 0` is finite and `0 >= 0`).

### Pre-populated edit form

- When the user lands on the Edit Transaction / Edit Account / Edit Goal / Edit Debt / Edit Investment screen, the field is **pre-populated with the stored value**. The stored value is always valid (the domain guard prevents invalid saves). So on first render, the field is valid; the inline error does not appear; Save is enabled.
- The user can edit it to make it invalid; the inline error appears; Save disables.
- This is **expected behavior**, not a bug.

### DPS locked monthly contribution

- In Edit Investment (DPS only), if the investment has contributions recorded, the Monthly contribution field is `disabled` (read-only). The validation rule does not apply to disabled fields. Save is enabled as long as the other fields are valid.

### Modal flow

- The DPS contribution modal and the Goal contribution modal use the same rule. The field starts empty (invalid). The user must enter a positive number to enable "Record contribution". Same inline error styling as the inline forms.

## Interaction primitives

- The inline error appears **synchronously** on every input event. No debounce, no animation. The user sees the error as they type.
- Save stays disabled until the field is valid. There is no "wait 300ms" grace period.
- There is no toast or banner on the inline path. The inline error is enough. The banner copy is reserved for the (rare) case where the inline validation is bypassed and the domain throws.

## Accessibility floor

- The inline error is rendered in the `<Field>`'s existing `error` slot, which lives inside the field's `<div role="group">` and is associated with the input via the surrounding label.
- Screen readers announce the error when focus enters the invalid field (`aria-invalid="true"` is set on the input).
- The disabled Save button is announced as disabled.
- Color is not the only signal — the inline error text and the disabled Save button both carry the meaning.

## Key flows

### Flow 1 — "I typo'd a minus sign"

**Protagonist**: Rahim, 31, freelancer, logging a lunch expense.

1. Rahim opens the Add Expense form.
2. He types `"-250"` in the amount field.
3. As soon as the field contains `-250`, the border turns danger-red and an inline error reads *"Amount must be greater than zero."* below the field. Save is disabled.
4. Rahim notices the error, moves the cursor to the start of the field, deletes the `-`, leaving `250`.
5. The border returns to its resting state, the inline error disappears, Save re-enables.
6. He fills the rest of the form and clicks Save. The expense is recorded.

### Flow 2 — "I tried to submit anyway"

**Protagonist**: Sumaiya, 26, designer.

1. Sumaiya enters `-100` in the amount field. Inline error appears, Save is disabled.
2. She clicks Save anyway. Nothing happens. The button does not respond (it's disabled).
3. She reads the inline error, fixes the value, and Save re-enables.

### Flow 3 — "Opening balance is allowed to be zero"

**Protagonist**: Karim, fresh install.

1. Karim opens Add Account.
2. He enters `0` in the Opening balance field.
3. The border stays resting, no inline error appears, Save is enabled.
4. He saves; the account is created with a zero opening balance.

This is **deliberately allowed**. Opening balance of zero is a valid real-world scenario (the user is starting fresh). The rule for opening balance is `>= 0`, not `> 0`.

### Flow 4 — "Defense-in-depth catches a future bypass"

**Protagonist**: A future feature path that calls `transactions.add(state, { amount: -50, ... })` programmatically.

1. The inline validation is bypassed (no UI path).
2. The domain `validate()` throws `TransactionError('Amount must be greater than zero.')`.
3. The caller catches it and shows the existing banner with the same copy.
4. The state remains unchanged. The transaction is not inserted.

This is the existing behavior — the inline layer is additive, the domain layer is unchanged.

## Out of scope for V1

- Decimal precision / rounding rules. Not in this run.
- Maximum value / cap. Not in this run.
- Multi-currency. Not in this run (Finora is BDT-only).
- The "Already saved" field on Add Goal — same `>= 0` rule applies, no special UX.

## Acceptance criteria

A run is complete when all of the following are true:

1. Typing `-250`, `0`, `0.0`, `0e0`, `-2.5e2`, `abc`, or empty into a money-amount field that uses the `> 0` rule immediately shows the inline error, marks the field border danger-red, and disables Save.
2. Typing `0` or empty into a money-amount field that uses the `>= 0` rule (opening balance, already saved) does **not** show an error and does **not** disable Save.
3. Fixing the value to a valid positive number clears the error, restores the border, and re-enables Save.
4. The user keeps what they typed — no auto-strip, no auto-correct.
5. The domain `validate()` still rejects negative/zero as defense-in-depth. Existing banner system still works.
6. Both the inline error and the banner use the same copy: *"Amount must be greater than zero."* (For `>= 0` rules: *"Amount must be zero or greater."*)
7. The rule applies to all 16 surfaces in the inventory table.
8. Disabled fields (e.g. locked DPS monthly contribution) bypass the rule.
9. No regression to existing form flow: required-field banners, success banners, navigation after save — all unchanged.
10. No new tokens, no new components, no new copy beyond the two error strings.