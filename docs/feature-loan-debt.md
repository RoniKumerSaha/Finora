# Feature PRD — Loan-kind Debt with Amortised Payments

| Field | Value |
|---|---|
| **Feature** | Loan-kind Debt — interest-aware payments inside the Debts section |
| **Status** | Draft for review |
| **Owner** | John (PM) |
| **Target build** | v1.1 (next sprint after V1 ships) |
| **Last updated** | 2026-08-31 |

---

## 1. Problem

Today, every debt in Finora is a flat personal IOU. The user picks a direction (`i_owe` / `owed_to_me`), enters a total, and records payments via linked expense / income transactions. **Every payment reduces `paidSoFar` 1-for-1**, regardless of whether the debt carries interest.

This works fine for informal IOUs between friends. It breaks for the very common case the user actually has: *"I took a ৳1,00,000 loan from DBBL at 12% APR for 36 months. Every month I pay an EMI that goes partly to interest and partly to principal."* Today, the app can model that loan's EMI as a projection in the **Loan Calculator** (sandbox), but the moment the user wants to track payments against their *real* DBBL loan, the Debts section treats each EMI as if 100% goes to principal. The numbers drift, and the user stops trusting the "Remaining" figure on the card.

## 3. Goal

When a debt is a **loan**, Finora should:

1. Split each payment into **interest** (calculated on outstanding principal) and **principal** (the remainder).
2. Reduce the *outstanding principal* by the principal portion only.
3. Show the user the split every time they record a payment, so they understand where their money went.
4. Continue to roll up cleanly into the existing Debts summary cards and transaction ledger.

Flat debts keep today's behaviour — no breaking changes for existing users.

## 4. Non-goals (this version)

- No automatic monthly schedule / no reminders. The user still records payments manually when they happen.
- No fixed-EMI amortization that closes the loan automatically. We compute one month of interest per payment, not the standard amortization schedule. (We considered EMI-based amortization but that couples the debt to a fixed term the user often wants to leave flexible — paying early, paying less some months, etc.)
- No migration of existing flat debts to loan-kind. They keep `kind: 'flat'`.
- No new top-level navigation. The entry lives inside the existing Debts section.

## 5. Personas & use cases

**Persona — Rumi (the planning user).** Has a 1-year personal loan from a friend at a 6% "favoured customer" rate she agreed on verbally. She wants to know: if I send ৳9,000 this month, how much is the friend actually getting, and how much is bringing down what I owe?

**Persona — Karim (the salaried user).** Took a ৳5,00,000 home loan from DBBL at 11.5% for 20 years. He records his monthly EMI as a transaction every month and wants to see, on the debt row, *"Remaining: ৳4,82,300 — last payment: ৳6,420 interest, ৳1,180 principal."* Without this, the row just says "Remaining: ৳4,98,000" and Karim can't tell whether the loan is actually going down.

## 6. User stories

See `docs/feature-loan-debt-stories.md` (separate file, one per story).

## 7. Data model

### 7.1 `Debt.kind` (new field)

```ts
type DebtKind = 'flat' | 'loan';

interface Debt {
  // ...existing fields...
  /** V1.1: how payments are accounted.
   *  'flat'  — every payment reduces principal 1-for-1 (today's behaviour).
   *  'loan'  — each payment is split into interest + principal based on
   *            outstanding principal × rate / 12. Requires `interestRate > 0`. */
  kind?: DebtKind;          // optional in storage; defaults to 'flat' on read
  /** Annual interest rate %, required when kind === 'loan'. Same
   *  0–100 cap as Investment.rate. Ignored when kind === 'flat'. */
  interestRate?: number;
}
```

**Migration.** `kind` and `interestRate` are both optional. On read, `debts.list()` (and `get()`) fill in `kind: 'flat'` if missing. No migration script needed; existing debts behave exactly as before.

**Validation.** Saving a debt with `kind: 'loan'` requires `interestRate > 0`. Validation runs in `debts.add` and `debts.update`. Failed validation surfaces a sticky banner, matching the existing error pattern.

### 7.2 What gets stored per payment

**No new persisted structure.** Payments continue to be `Transaction` records with `linkedDebtId`. For `kind: 'loan'` debts, **each transaction's `amount` is the *gross payment*** (e.g. ৳7,600 EMI). The split between interest and principal is **derived at read time** from the debt's outstanding principal and the transaction history — see §8.

This keeps the ledger single-source-of-truth: one transaction row per payment, no duplicate "interest" / "principal" entries that could get out of sync.

### 7.3 Derived value: outstanding principal

For a `kind: 'loan'` debt, **outstanding principal** is computed from the transaction history, not stored:

```
outstanding = principal
            − Σ principalPortion(t) for each linked transaction t
            (in chronological order)
```

For a `kind: 'flat'` debt, outstanding principal equals `total − paidSoFar` (today's logic, untouched).

## 8. Math — payment split

For each linked transaction on a `kind: 'loan'` debt, processed in chronological order:

```
monthlyRate       = interestRate / 12 / 100
interestPortion   = round(outstanding × monthlyRate)
principalPortion  = max(0, payment − interestPortion)
outstanding      −= principalPortion
```

Rules:
- Round interest first, then derive principal. Matches the existing convention in `loanAmortization()` (`src/domain/math.ts`).
- If `payment < interestPortion` (partial month, underpayment), `principalPortion = 0`, `interestPortion = payment`, outstanding stays. The unpaid interest does **not** accrue onto principal in v1.1 — that's a deferred feature. Surface a warning to the user: "This payment didn't cover this month's interest."
- If `payment > outstanding + interestPortion` (overpayment), cap `principalPortion` at outstanding; the excess is logged as "extra paid" but doesn't reduce outstanding below zero.
- `paidSoFar` (the cache that drives the progress bar and "X% paid" caption) keeps using **gross payment sums** — the user's mental model of "I've paid ৳76,000 toward this loan" should match what their bank statement says.

### Worked example

Loan: ৳1,00,000, 12% APR, 36 months.
- Month 1: outstanding = 1,00,000. monthlyRate = 0.01. interest = 1,000. User pays ৳3,321 (the standard 36-month EMI). principal = 2,321. New outstanding = 97,679.
- Month 2: outstanding = 97,679. interest = 977. User pays ৳3,321. principal = 2,344. New outstanding = 95,335.
- The card shows: "Remaining ৳95,335 · 23% paid" (paid ৳6,642 gross so far).

## 9. UI surfaces

### 9.1 DebtAddScreen / DebtEditScreen — extend the form

- New optional section **"Is this a loan with interest?"** (collapsed by default).
- When opened, it reveals: an interest rate field (`%`, 0–100), with hint text *"If the loan charges interest, enter the annual rate. We'll split each payment into interest and principal."*
- Setting the rate flips `kind` to `'loan'` on save; clearing it flips back to `'flat'`.
- No change to the existing form fields. Existing flat-debt flow is identical.

### 9.2 DebtsListScreen — per-card entry point

- For `kind: 'loan'` cards only, add a small **"Pay"** button in the right zone, below the existing "of X total" caption. Hidden for `kind: 'flat'` cards.
- Tap → opens a small modal: amount (pre-filled with the suggested EMI from the loan parameters if a `termMonths` is set on the debt), date, account, optional note. Mirror the existing Add Transaction picker, scoped to this debt.

### 9.3 DebtsListScreen — split breakdown on the card

- For loan-kind cards, add a small line under the "of X total" caption showing the **most recent payment's split**: e.g. *"Last: ৳1,000 interest · ৳2,321 principal"*. Hidden if no payments yet.
- Replace the **"Paid X of Y total"** meta with **"Paid X · Y interest · Z principal"** when the debt has any payment. Keeps flat-debt wording unchanged.

### 9.4 DebtEditScreen — activity feed gains a split column

- The existing "Activity" feed lists linked transactions. For loan-kind debts, each row gets a tiny two-line breakdown: top row = date + amount + account (today), bottom row = `৳1,000 interest · ৳2,321 principal` in muted text.

### 9.5 Summary card (right column) — unchanged

The existing Summary card aggregates by direction. No new fields; loan-kind payments roll into the same totals because we don't change how transactions are counted.

### 9.6 "How it works" copy

The bottom of the Summary card gets one extra sentence, only when at least one loan-kind debt exists:

> *For loans with interest, each payment is split into interest (calculated on outstanding principal) and principal. The principal portion is what reduces what you still owe.*

## 10. Persistence & migration

- `kind` and `interestRate` are both optional in the `Debt` interface. Older saved JSON in localStorage continues to deserialize; `kind` defaults to `'flat'`.
- No version bump required on `State.version`. The persisted state shape is backwards-compatible.
- If a user toggles a debt from `loan` back to `flat`, the existing transaction history is untouched — only the interpretation of those payments changes (back to 1-for-1). No data is lost.

## 11. Edge cases

| Case | Behaviour |
|---|---|
| Payment with `amount <= 0` | Rejected at the transaction layer (existing validation). |
| Payment on a fully-paid loan | Existing flow: transaction is still recorded but `status` stays `completed`. Split shows 0 interest, 0 principal. |
| Two payments on the same date | Both processed in `id`-stable order (existing `sort by date, then by id`). |
| Editing a past transaction's amount | Outstanding recomputes from scratch on every read. The card updates immediately. |
| Editing the loan's `interestRate` after payments exist | Outstanding is unchanged (we don't retroactively recompute history). The card shows a tiny disclaimer: *"Rate changed on <date>. Earlier payments used the previous rate."* (Defer to v1.2 if too much for the first cut.) |
| `interestRate` changed to 0 with `kind: 'loan'` | Validation forces `kind` back to `'flat'` or rejects the save with a banner. |
| Owed-to-me loan | Supported. The math is symmetric — the receiver's "outstanding" reduces by the principal portion of each repayment they receive. |
| Loan with `termMonths` set | Optional. If set, the **Pay** modal pre-fills with the standard EMI (`loanEMI(principal, rate, termMonths)` from `src/domain/math.ts`). User can override. |
| Loan without `termMonths` | **Pay** modal leaves the amount field empty; user enters whatever they paid. |

## 12. Open questions for v1.2

- Should we record the *interest portion* as a separate Expense (e.g. category "Loan interest")? Today the gross payment hits one expense category; the split is derived. Some users will want interest to flow into their Insights category breakdown. Defer.
- Should the card show an amortization preview ("at this rate you'll pay ৳19,500 interest over the remaining term")? Useful but a separate feature.

## 13. Success metrics (local — qualitative review only)

We can't measure retention on a local-first app, so success is:
- Users with at least one loan-kind debt complete the **Pay** flow at least once in a test session without backtracking.
- The "Remaining" figure on a loan-kind card agrees with the user's bank statement after 3 months of payments.
- No regression in the flat-debt flow (snapshot of existing debts list renders identically).

---

## Appendix A — Files likely to change

| Layer | File | Change |
|---|---|---|
| Domain types | `src/domain/types.ts` | Add `DebtKind`, `interestRate?` on `Debt`. |
| Domain debt CRUD | `src/domain/debts.ts` | `add` / `update` accept optional `kind`, `interestRate`. Validation: `kind: 'loan'` requires `interestRate > 0`. `list()` / `get()` default `kind` to `'flat'`. |
| Domain math | `src/domain/math.ts` | Add `loanPaymentSplit(outstanding, payment, annualRate)` returning `{interest, principal}`. Pure function, easy to unit test. |
| Tests | `src/domain/math.spec.ts`, `src/domain/debts.spec.ts` (if present) | Cover: zero rate → flat, payment < interest, overpayment, mixed flat/loan in same list. |
| Add screen | `src/screens/DebtAddScreen.tsx` | New "Is this a loan?" toggle, conditional rate field. |
| Edit screen | `src/screens/DebtEditScreen.tsx` | Same toggle + rate field; activity feed adds split row for loan-kind. |
| List screen | `src/screens/DebtsListScreen.tsx` | "Pay" button on loan cards; split line under "of total"; changed "Paid" wording; updated "How it works" copy. |
| New modal | `src/screens/LoanPaymentModal.tsx` (or inline within DebtsListScreen) | Quick payment entry, pre-filled with EMI if `termMonths` is set. |
| PRD | `PRD.md` | Add new section §9.18 (Loan-kind Debt), update §10 (Rules) with R20 + R21. |

## Appendix B — Test coverage targets

- `loanPaymentSplit()`: 6 cases (normal, zero rate, underpayment, overpayment, exact payoff, negative payment).
- `debts.list()` with mixed flat/loan debts: derived `paidSoFar`, status auto-completion, summary aggregation unchanged.
- Round-trip persistence: a saved loan debt with 3 payments re-reads with correct outstanding.
- UI snapshot: loan-kind card renders "Last: X interest · Y principal" line; flat card does not.

## Appendix C — Epics & stories

See `docs/feature-loan-debt-stories.md`.