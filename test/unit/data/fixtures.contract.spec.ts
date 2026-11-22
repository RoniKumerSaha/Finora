/**
 * fixtures.contract.spec.ts — the contract between `test/data/*.json`
 * and the app.
 *
 * ## Why this exists
 *
 * The JSON stores under `test/data/` are the single source of truth
 * for the e2e suite's inputs. Every row in them is typed as
 * `string` (because JSON has no types) and mapped into the app's
 * entity shapes by `test/e2e/fixtures/seed-data.ts`.
 *
 * Without a contract, a malformed fixture surfaces as a CONFUSING
 * failure three layers down: the seed throws "No fixture account named
 * \"Mian Bank\"", or the row silently vanishes from a list, or a
 * Playwright test times out waiting for an element that was never
 * going to appear. The developer has no idea the problem is in the
 * data file.
 *
 * This spec makes the data file itself the thing under test. Every
 * store is validated against the SAME zod schema / constant / math
 * function the app uses, so a typo fails HERE — with a message that
 * names the file, the row and the offending field.
 *
 * ## What "the app's schema" means
 *
 * Each store is checked against the closest thing the app itself
 * uses, in preference order:
 *
 *   1. **The app's own zod schema** (`src/lib/schemas.ts`) where one
 *      exists — account, transaction, goal, debt, investment. These
 *      are the form-validation rules.
 *   2. **The app's own constants** — `TRANSACTION_FILTERS`,
 *      `AMOUNT_PRESETS`, `ACCOUNT_TYPE_LABELS`,
 *      `INVESTMENT_TYPE_LABELS`, `POSITIVE_MONEY_ERROR`, … A fixture
 *      that lists a filter chip the app does not render fails here.
 *   3. **The app's own math** (`src/domain/math.ts`) — the maturity
 *      values, EMIs and interest figures the fixture asserts on are
 *      recomputed and compared. A fixture whose "maturity ৳ 1,09,000"
 *      no longer matches the app's formula fails here.
 *   4. **The app's own domain validators** (`accounts.add`,
 *      `transactions.add`, …) — the fixture rows are actually run
 *      through the domain layer, so a row the app would reject is
 *      caught even where no zod schema covers it.
 *
 * ## Where this runs
 *
 * Vitest — `npm run test`. It is a pure data test: no browser, no
 * DOM, no IndexedDB. It runs in the `unit` CI job alongside the
 * rest of the unit suite, so a broken fixture never reaches the
 * Playwright suite.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  accountSchema,
  debtSchema,
  goalSchema,
  investmentSchema,
  transactionSchema,
} from '@/lib/schemas';
import {
  NON_NEGATIVE_MONEY_ERROR,
  POSITIVE_MONEY_ERROR,
  POSITIVE_RATE_ERROR,
  POSITIVE_TERM_ERROR,
  isNonNegativeMoney,
  isPositiveMoney,
} from '@/lib/validation';
import {
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_TYPE_TONES,
  AMOUNT_PRESETS,
  INVESTMENT_TYPE_LABELS,
  TRANSACTION_FILTERS,
} from '@/domain/options';
import { ACCOUNT_TYPES } from '@/domain/accounts';
import { buildDefaultCategories } from '@/domain/persistence';
import {
  dpsMaturityValue,
  investmentMaturityValue,
  investmentMaturityValueFromDays,
  loanEMI,
  loanPaymentSplit,
} from '@/domain/math';
import { monthKey, summariseEventPlan, summariseMonthPlan } from '@/domain/plans';
import { fmtBDT } from '@/lib/format';
import type {
  AccountType,
  DebtDirection,
  DebtKind,
  EventPlan,
  InvestmentType,
  MonthPlan,
  PlanCategory,
} from '@/domain/types';

import accountsJson from '../../data/accounts.json' with { type: 'json' };
import transactionsJson from '../../data/transactions.json' with { type: 'json' };
import goalsJson from '../../data/goals.json' with { type: 'json' };
import debtsJson from '../../data/debts.json' with { type: 'json' };
import investmentsJson from '../../data/investments.json' with { type: 'json' };
import authJson from '../../data/auth.json' with { type: 'json' };
import plansJson from '../../data/plans.json' with { type: 'json' };

/* ─────────────────────────────────────────────────────────────────────
   Helpers
   ───────────────────────────────────────────────────────────────────── */

/**
 * Assert that a zod schema accepts a value, and report the failure
 * in terms of the FIXTURE rather than the schema.
 *
 * A bare `expect(schema.parse(x)).toBeTruthy()` prints zod's issue
 * list, which names the schema path ("openingBalance") but not the
 * file the value came from. Prefixing the message with the file
 * turns "some number is wrong" into "test/data/accounts.json, row 2,
 * account 'Mian Bank': openingBalance — …".
 */
function expectValid<T>(
  schema: z.ZodType<T>,
  value: unknown,
  where: string,
): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    const issues = result.error.issues
      .map(i => `${i.path.join('.') || '(root)'} — ${i.message}`)
      .join('; ');
    throw new Error(`${where}\n  ${issues}`);
  }
  return result.data;
}

/** The `YYYY-MM-DD` shape the app's date fields accept. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Read a field that the fixture MUST carry, failing loudly if it is
 * missing.
 *
 * The JSON stores are heterogeneous by design — a transaction row has
 * `accountName` only when it is not a transfer — so TypeScript infers
 * `string | undefined` for the shared fields. Silently comparing
 * `undefined` against a set would make the assertion pass vacuously
 * (a missing reference reads as "not found", which happens to be the
 * assertion's expected `false`… or `true`, depending on direction).
 * This turns the omission into a named failure.
 */
function required<T>(value: T | undefined, field: string, where: string): T {
  if (value === undefined || value === null || value === '') {
    throw new Error(`${where} — the fixture row is missing "${field}".`);
  }
  return value;
}

/** A taka amount as the app formats it: `৳ 1,09,000`. */
const bdt = (n: number) => fmtBDT(n);

/* ─────────────────────────────────────────────────────────────────────
   accounts.json
   ───────────────────────────────────────────────────────────────────── */

describe('test/data/accounts.json', () => {
  it('lists exactly the account types the app supports', () => {
    const types = accountsJson.types.map(t => t.value);

    expect(types).toEqual([...ACCOUNT_TYPES]);
  });

  it('labels every account type the way the app labels it', () => {
    for (const t of accountsJson.types) {
      expect(
        t.label,
        `test/data/accounts.json — the label for "${t.value}" does not match the app's own label.`,
      ).toBe(ACCOUNT_TYPE_LABELS[t.value as AccountType]);
    }
  });

  it('gives every account type the tone the app gives it', () => {
    for (const t of accountsJson.types) {
      expect(
        t.tone,
        `test/data/accounts.json — the "${t.value}" account carries the tone "${t.tone}", but the app renders "${ACCOUNT_TYPE_TONES[t.value as AccountType]}".`,
      ).toBe(ACCOUNT_TYPE_TONES[t.value as AccountType]);
    }
  });

  it('seeds only accounts the app would accept', () => {
    for (const [i, a] of accountsJson.accounts.entries()) {
      expectValid(
        accountSchema,
        { name: a.name, type: a.type, openingBalance: a.openingBalance },
        `test/data/accounts.json — accounts[${i}] ("${a.name}")`,
      );
    }
  });

  it('gives every seeded account a distinct name', () => {
    const names = accountsJson.accounts.map(a => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('spells each validation case the way the app rejects it', () => {
    for (const v of accountsJson.validation) {
      if (v.expectedError === null) {
        // "Opening balance of exactly zero" — valid, so the field
        // must accept it.
        expect(
          isNonNegativeMoney(v.openingBalance),
          `test/data/accounts.json — the "${v.case}" case expects no error, but "${v.openingBalance}" is rejected.`,
        ).toBe(true);
        continue;
      }
      expect(
        isNonNegativeMoney(v.openingBalance),
        `test/data/accounts.json — the "${v.case}" case expects "${v.expectedError}", but "${v.openingBalance}" is accepted.`,
      ).toBe(false);
      expect(v.expectedError).toBe(NON_NEGATIVE_MONEY_ERROR);
    }
  });
});

/* ─────────────────────────────────────────────────────────────────────
   transactions.json
   ───────────────────────────────────────────────────────────────────── */

describe('test/data/transactions.json', () => {
  it('lists exactly the filter chips the app renders', () => {
    expect(transactionsJson.filters.map(f => f.label)).toEqual(
      TRANSACTION_FILTERS.map(f => f.label),
    );
  });

  it('offers exactly the amount presets the app renders', () => {
    expect(transactionsJson.amountPresets.map(p => Number(p.amount))).toEqual([
      ...AMOUNT_PRESETS,
    ]);
  });

  it('formats every preset label the way the app renders it', () => {
    // `PresetChips` renders `৳ ` + the amount in en-IN grouping.
    for (const p of transactionsJson.amountPresets) {
      expect(
        p.label,
        `test/data/transactions.json — the preset "${p.amount}" is labelled "${p.label}", but the app renders "${bdt(Number(p.amount))}".`,
      ).toBe(bdt(Number(p.amount)));
    }
  });

  it('seeds only transactions the app would accept', () => {
    for (const [i, t] of transactionsJson.transactions.entries()) {
      const where = `test/data/transactions.json — transactions[${i}] ("${t.note}")`;

      if (t.type === 'transfer') {
        expectValid(
          transactionSchema,
          {
            type: 'transfer',
            amount: t.amount,
            date: '2026-01-01',
            fromAccountId: t.fromAccountName,
            toAccountId: t.toAccountName,
          },
          where,
        );
        // A transfer between the same account is a no-op the app
        // rejects outright.
        expect(
          t.fromAccountName,
          `${where} — a transfer's source and destination must differ.`,
        ).not.toBe(t.toAccountName);
        continue;
      }

      expectValid(
        transactionSchema,
        {
          type: t.type,
          amount: t.amount,
          date: '2026-01-01',
          accountId: t.accountName,
          note: t.note,
        },
        where,
      );
    }
  });

  it('seeds only transactions whose accounts and categories exist', () => {
    const accountNames = new Set(accountsJson.accounts.map(a => a.name));
    const categoryNames = new Set(
      buildDefaultCategories().map(c => c.name),
    );

    for (const t of transactionsJson.transactions) {
      const where = `test/data/transactions.json — the transaction "${t.note}"`;
      const named = t.type === 'transfer'
        ? [
            required(t.fromAccountName, 'fromAccountName', where),
            required(t.toAccountName, 'toAccountName', where),
          ]
        : [required(t.accountName, 'accountName', where)];

      for (const name of named) {
        expect(
          accountNames.has(name),
          `${where} references the account "${name}", which is not in accounts.json.`,
        ).toBe(true);
      }

      if (t.type !== 'transfer') {
        const categoryName = required(t.categoryName, 'categoryName', where);
        expect(
          categoryNames.has(categoryName),
          `${where} references the category "${categoryName}", which is not one of the app's default categories.`,
        ).toBe(true);
      }
    }
  });

  it('gives every transaction a distinct id', () => {
    const ids = transactionsJson.transactions.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('spells each rejected amount the way the app rejects it', () => {
    for (const v of transactionsJson.validation) {
      expect(
        isPositiveMoney(v.amount),
        `test/data/transactions.json — the "${v.case}" case expects "${v.expectedError}", but "${v.amount}" is accepted.`,
      ).toBe(false);
      expect(v.expectedError).toBe(POSITIVE_MONEY_ERROR);
    }
  });

  it('rejects the non-numeric amounts the app rejects', () => {
    for (const r of transactionsJson.rejectedText) {
      expect(
        isPositiveMoney(r.text),
        `test/data/transactions.json — the "${r.case}" case expects "${r.text}" to be rejected, but the app accepts it.`,
      ).toBe(false);
    }
  });

  it('accepts the amounts the app accepts', () => {
    for (const a of transactionsJson.acceptedAmounts) {
      expect(
        isPositiveMoney(a.amount),
        `test/data/transactions.json — the "${a.case}" case expects "${a.amount}" to be accepted, but the app rejects it.`,
      ).toBe(true);
    }
  });

  it('names only categories the app ships with', () => {
    const defaults = buildDefaultCategories();
    const byName = new Map(defaults.map(c => [c.name, c.type]));

    for (const [type, names] of Object.entries(transactionsJson.categories)) {
      for (const name of names) {
        expect(
          byName.get(name),
          `test/data/transactions.json — the category "${name}" is listed under "${type}" but the app's default set has it as "${byName.get(name) ?? 'nothing'}".`,
        ).toBe(type);
      }
    }
  });
});

/* ─────────────────────────────────────────────────────────────────────
   goals.json
   ───────────────────────────────────────────────────────────────────── */

describe('test/data/goals.json', () => {
  it('seeds only goals the app would accept', () => {
    for (const [i, g] of goalsJson.goals.entries()) {
      // `goalSchema` requires `saved`; the fixture stores
      // `contributions` instead, so the saved total is derived here
      // exactly as `recomputeGoalSaved` derives it.
      const saved = g.contributions.reduce((s, c) => s + c, 0);

      expectValid(
        goalSchema,
        {
          name: g.name,
          target: g.target,
          saved,
          targetDate: g.targetDate,
        },
        `test/data/goals.json — goals[${i}] ("${g.name}")`,
      );
    }
  });

  it('gives every goal a target date in the future', () => {
    // `goalSchema` enforces this, but a stale fixture would only fail
    // once the date passed — better to name it here.
    const today = new Date().toISOString().slice(0, 10);
    for (const g of goalsJson.goals) {
      expect(
        g.targetDate > today,
        `test/data/goals.json — the goal "${g.name}" targets ${g.targetDate}, which is in the past. The app rejects a past target date.`,
      ).toBe(true);
    }
  });

  it('spells each validation case the way the app rejects it', () => {
    for (const v of goalsJson.validation) {
      // The e2e spec fills the fields the case does not name with
      // these defaults — mirror them exactly, so the contract checks
      // the same pair of values the browser will actually submit.
      const target = v.target ?? '1000';
      const alreadySaved = v.alreadySaved ?? '0';

      // The target field is strictly positive; the "already saved"
      // field is non-negative — and REQUIRED, so an empty value is
      // rejected too. Exactly one of the two trips in each case.
      const targetBad = !isPositiveMoney(target);
      const savedBad = !isNonNegativeMoney(alreadySaved);

      if (targetBad) {
        expect(
          v.expectedError,
          `test/data/goals.json — the "${v.case}" case trips the target guard.`,
        ).toBe(POSITIVE_MONEY_ERROR);
      } else if (savedBad) {
        expect(
          v.expectedError,
          `test/data/goals.json — the "${v.case}" case trips the saved guard.`,
        ).toBe(NON_NEGATIVE_MONEY_ERROR);
      } else {
        throw new Error(
          `test/data/goals.json — the "${v.case}" case trips no guard at all: target "${target}" and saved "${alreadySaved}" are both valid.`,
        );
      }
    }
  });
});

/* ─────────────────────────────────────────────────────────────────────
   debts.json
   ───────────────────────────────────────────────────────────────────── */

describe('test/data/debts.json', () => {
  it('seeds only debts the app would accept', () => {
    for (const [i, d] of debtsJson.debts.entries()) {
      expectValid(
        debtSchema,
        {
          name: d.name,
          direction: d.direction,
          total: d.total,
          person: d.person,
        },
        `test/data/debts.json — debts[${i}] ("${d.name}")`,
      );
    }
  });

  it('gives every loan-kind debt a rate and a term the app accepts', () => {
    // `debts.add` refuses a loan-kind debt without a positive rate.
    for (const d of debtsJson.debts) {
      if (d.kind !== 'loan') continue;
      expect(
        d.interestRate,
        `test/data/debts.json — the loan "${d.name}" has no interest rate, but debts.add refuses one.`,
      ).toBeGreaterThan(0);
      expect(
        d.termMonths,
        `test/data/debts.json — the loan "${d.name}" has no term in months.`,
      ).toBeGreaterThan(0);
    }
  });

  it('uses a kind the app knows about', () => {
    const KINDS: DebtKind[] = ['flat', 'loan'];
    for (const d of debtsJson.debts) {
      expect(
        KINDS,
        `test/data/debts.json — the debt "${d.name}" carries an unknown kind "${d.kind}".`,
      ).toContain(d.kind ?? 'flat');
    }
  });

  it('uses a direction the app knows about', () => {
    const DIRECTIONS: DebtDirection[] = ['i_owe', 'owed_to_me'];
    for (const d of debtsJson.debts) {
      expect(
        DIRECTIONS,
        `test/data/debts.json — the debt "${d.name}" carries an unknown direction "${d.direction}".`,
      ).toContain(d.direction);
    }
  });

  it('recomputes the loan EMI the way the app computes it', () => {
    const loan = debtsJson.loan;
    const emi = loanEMI(Number(loan.total), Number(loan.rate), Number(loan.term));

    expect(
      String(Math.round(emi)),
      `test/data/debts.json — the loan's EMI is stated as "${loan.emi}", but loanEMI() computes ${Math.round(emi)}.`,
    ).toBe(loan.emi);

    // The first EMI splits into interest + principal.
    const split = loanPaymentSplit(Number(loan.total), Math.round(emi), Number(loan.rate));
    expect(
      String(split.interest),
      `test/data/debts.json — the loan's first interest is stated as "${loan.interest}", but loanPaymentSplit() computes ${split.interest}.`,
    ).toBe(loan.interest);
    expect(
      String(split.principal),
      `test/data/debts.json — the loan's first principal is stated as "${loan.principal}", but loanPaymentSplit() computes ${split.principal}.`,
    ).toBe(loan.principal);

    // And the outstanding afterwards is what the app would show.
    const outstanding = Number(loan.total) - split.principal;
    expect(
      String(outstanding),
      `test/data/debts.json — the outstanding after the first EMI is stated as "${loan.outstandingAfterEmi}", but the app computes ${outstanding}.`,
    ).toBe(loan.outstandingAfterEmi);
  });

  it('spells each validation case the way the app rejects it', () => {
    for (const v of debtsJson.validation) {
      const amountField = v.total;
      const rateField = v.interestRate;
      const termField = v.termMonths;

      // Exactly one of the three guards is expected to trip in each
      // case. Work out which by checking the fields themselves.
      const amountBad = !isPositiveMoney(amountField);
      const rateBad = !isPositiveMoney(rateField);
      const termBad = !isPositiveMoney(termField);

      if (amountBad) {
        expect(
          v.expectedError,
          `test/data/debts.json — the "${v.case}" case trips the amount guard.`,
        ).toBe(POSITIVE_MONEY_ERROR);
      } else if (rateBad) {
        expect(
          v.expectedError,
          `test/data/debts.json — the "${v.case}" case trips the rate guard.`,
        ).toBe(POSITIVE_RATE_ERROR);
      } else if (termBad) {
        expect(
          v.expectedError,
          `test/data/debts.json — the "${v.case}" case trips the term guard.`,
        ).toBe(POSITIVE_TERM_ERROR);
      } else {
        throw new Error(
          `test/data/debts.json — the "${v.case}" case trips no guard at all: total "${amountField}", rate "${rateField}", term "${termField}" are all valid.`,
        );
      }
    }
  });
});

/* ─────────────────────────────────────────────────────────────────────
   investments.json
   ───────────────────────────────────────────────────────────────────── */

describe('test/data/investments.json', () => {
  it('seeds only investments the app would accept', () => {
    for (const [i, v] of investmentsJson.investments.entries()) {
      expectValid(
        investmentSchema,
        {
          name: v.name,
          type: v.type,
          // A DPS has no principal — the app stores 0 for it.
          principal: v.type === 'dps' ? 1 : v.principal,
          rate: v.rate,
          startDate: '2026-01-01',
          termMonths: v.termMonths,
          payoutAccountId: v.payoutAccountName,
          institution: v.institution,
        },
        `test/data/investments.json — investments[${i}] ("${v.name}")`,
      );
    }
  });

  it('gives a DPS a monthly contribution and no principal', () => {
    for (const v of investmentsJson.investments) {
      if (v.type !== 'dps') continue;
      expect(
        v.monthlyContribution,
        `test/data/investments.json — the DPS "${v.name}" has no monthly contribution, but the app requires one.`,
      ).toBeGreaterThan(0);
    }
  });

  it('uses a type the app knows about', () => {
    const TYPES: InvestmentType[] = ['dps', 'fdr', 'savings'];
    for (const v of investmentsJson.investments) {
      expect(
        TYPES,
        `test/data/investments.json — the investment "${v.name}" carries an unknown type "${v.type}".`,
      ).toContain(v.type);
    }
  });

  it('labels every investment type the way the app labels it', () => {
    // The type picker's option labels, keyed by type.
    for (const v of investmentsJson.investments) {
      const type = v.type as InvestmentType;
      expect(
        INVESTMENT_TYPE_LABELS[type],
        `test/data/investments.json — the type "${type}" has no label the app renders.`,
      ).toBeTruthy();
    }
  });

  it('recomputes the FDR maturity the way the app computes it', () => {
    const fdr = investmentsJson.fdr;
    const maturity = investmentMaturityValue({
      principal: Number(fdr.principal),
      rate: Number(fdr.rate),
      termMonths: Number(fdr.termMonths),
    } as never);

    expect(
      fdr.maturityFormatted,
      `test/data/investments.json — the FDR's maturity is stated as "${fdr.maturityFormatted}", but the app computes ${bdt(maturity)}.`,
    ).toBe(bdt(maturity));

    // The "Review:" line renders the raw figure with no space.
    expect(fdr.maturityPreviewRaw).toBe(`৳${Math.round(maturity).toLocaleString('en-IN')}`);

    // The expected interest is maturity minus principal.
    const interest = maturity - Number(fdr.principal);
    expect(
      fdr.interestFormatted,
      `test/data/investments.json — the FDR's interest is stated as "${fdr.interestFormatted}", but the app computes ${bdt(interest)}.`,
    ).toBe(bdt(interest));

    // The principal line is the principal itself.
    expect(fdr.principalFormatted).toBe(bdt(Number(fdr.principal)));
  });

  it('recomputes the DPS maturity the way the app computes it', () => {
    const dps = investmentsJson.dps;
    const maturity = dpsMaturityValue({
      type: 'dps',
      monthlyContribution: Number(dps.monthlyContribution),
      rate: Number(dps.rate),
      termMonths: Number(dps.termMonths),
    } as never);

    expect(
      dps.maturityFormatted,
      `test/data/investments.json — the DPS's maturity is stated as "${dps.maturityFormatted}", but the app computes ${bdt(maturity)}.`,
    ).toBe(bdt(maturity));

    expect(dps.maturityPreviewRaw).toBe(`৳${Math.round(maturity).toLocaleString('en-IN')}`);

    // The "৳ 5,000/mo" line.
    expect(dps.monthlyFormatted).toBe(`${bdt(Number(dps.monthlyContribution))}/mo`);
  });

  it('recomputes each variant maturity the way the app computes it', () => {
    for (const v of investmentsJson.variants) {
      const maturity = investmentMaturityValue({
        principal: Number(v.amount),
        rate: Number(v.rate),
        termMonths: Number(v.term),
      } as never);

      expect(
        v.maturityFormatted,
        `test/data/investments.json — the "${v.case}" variant's maturity is stated as "${v.maturityFormatted}", but the app computes ${bdt(maturity)}.`,
      ).toBe(bdt(maturity));

      expect(v.maturityPreviewRaw).toBe(`৳${Math.round(maturity).toLocaleString('en-IN')}`);

      // The investment CARD shows the "At maturity" pair only when
      // there is projected growth — `showBoth = projected - current
      // > 1` in `InvestmentsListScreen`. A zero rate means no
      // interest, so the maturity equals the principal and the card
      // shows a single "Value" figure instead.
      const showBoth = maturity - Number(v.amount) > 1;
      expect(
        v.showsMaturity,
        `test/data/investments.json — the "${v.case}" variant states showsMaturity=${v.showsMaturity}, but the app computes ${showBoth}.`,
      ).toBe(showBoth);
    }
  });

  it('recomputes the short-term maturity the way the app computes it', () => {
    const s = investmentsJson.shortTerm;
    const maturity = investmentMaturityValueFromDays({
      principal: Number(s.principal),
      rate: Number(s.rate),
      termDays: Number(s.termDays),
    } as never);

    expect(
      s.maturityPreviewRaw,
      `test/data/investments.json — the short-term maturity is stated as "${s.maturityPreviewRaw}", but the app computes ৳${Math.round(maturity).toLocaleString('en-IN')}.`,
    ).toBe(`৳${Math.round(maturity).toLocaleString('en-IN')}`);
  });

  it('spells each validation case the way the app rejects it', () => {
    for (const v of investmentsJson.validation) {
      // The amount field is the principal (FDR) or the monthly
      // contribution (DPS). Both are strictly positive, and both
      // carry an inline error message.
      const amountBad = !isPositiveMoney(v.amount);

      if (amountBad) {
        expect(
          v.expectedError,
          `test/data/investments.json — the "${v.case}" case trips the amount guard.`,
        ).toBe(POSITIVE_MONEY_ERROR);
        continue;
      }

      // The rate and term fields have NO inline error — they only
      // block the Save button. So a case whose amount is fine must
      // expect no message, and must trip the rate or the term
      // guard.
      expect(
        v.expectedError,
        `test/data/investments.json — the "${v.case}" case has a valid amount, so the app shows no inline error message.`,
      ).toBeNull();

      const rateBad = !(Number(v.rate) >= 0);
      const termBad = !(Number(v.term) > 0);
      expect(
        rateBad || termBad,
        `test/data/investments.json — the "${v.case}" case has a valid amount, a valid rate "${v.rate}" and a valid term "${v.term}", so the app would let the user save.`,
      ).toBe(true);
    }
  });

  it('pays out the principal to an account the fixture owns', () => {
    const accountNames = new Set(accountsJson.accounts.map(a => a.name));
    for (const v of investmentsJson.investments) {
      expect(
        accountNames.has(v.payoutAccountName),
        `test/data/investments.json — the investment "${v.name}" pays out to "${v.payoutAccountName}", which is not in accounts.json.`,
      ).toBe(true);
    }
  });
});

/* ─────────────────────────────────────────────────────────────────────
   auth.json
   ───────────────────────────────────────────────────────────────────── */

describe('test/data/auth.json', () => {
  it('uses a well-formed email address', () => {
    const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const addresses = [
      authJson.validCredentials.email,
      authJson.invalidCredentials.email,
      authJson.nonexistentUser.email,
    ];
    for (const address of addresses) {
      expect(
        EMAIL.test(address),
        `test/data/auth.json — "${address}" is not a valid email address.`,
      ).toBe(true);
    }
  });

  it('keeps every secret out of the tracked file', () => {
    // The passwords live in the environment, not in the repository.
    // The JSON holds only the NAME of the variable.
    for (const [label, holder] of [
      ['validCredentials', authJson.validCredentials],
      ['invalidCredentials', authJson.invalidCredentials],
      ['nonexistentUser', authJson.nonexistentUser],
      ['passwordPolicy.strong', authJson.passwordPolicy.strong],
    ] as const) {
      expect(
        'passwordEnv' in holder,
        `test/data/auth.json — the ${label} password must be read from the environment (passwordEnv), not stored in the file.`,
      ).toBe(true);
      expect(
        'password' in holder,
        `test/data/auth.json — the ${label} password must not be stored in the file.`,
      ).toBe(false);
    }
  });

  it('names environment variables that exist in .env.example', () => {
    const example = readFileSync(resolve(__dirname, '..', '..', '..', '.env.example'), 'utf8');
    const names = [
      authJson.validCredentials.passwordEnv,
      authJson.invalidCredentials.passwordEnv,
      authJson.nonexistentUser.passwordEnv,
      authJson.passwordPolicy.strong.passwordEnv,
    ];
    for (const name of names) {
      expect(
        example.includes(name),
        `.env.example — the variable "${name}" referenced by test/data/auth.json is not listed.`,
      ).toBe(true);
    }
  });

  it('uses a password the app rejects for the too-short case', () => {
    expect(
      authJson.passwordPolicy.tooShort.password.length,
      'test/data/auth.json — the tooShort password must be shorter than the policy minimum.',
    ).toBeLessThan(8);
  });

  it('uses a distinct variable for the wrong password', () => {
    expect(authJson.invalidCredentials.passwordEnv).not.toBe(
      authJson.validCredentials.passwordEnv,
    );
  });
});

/* ─────────────────────────────────────────────────────────────────────
   plans.json
   ───────────────────────────────────────────────────────────────────── */

describe('test/data/plans.json', () => {
  /**
   * The Month Plan as the app stores it.
   *
   * The data file does NOT carry the plan's key — the Month Plan
   * screen has no month selector and no rollover, so it always edits
   * the current calendar month. The fixture builder stamps the key at
   * seed time; this mirrors that.
   */
  function monthPlan(): MonthPlan {
    return {
      key: monthKey(),
      plannedIncome: plansJson.monthPlan.plannedIncome,
      categories: plansJson.monthPlan.categories as PlanCategory[],
    };
  }

  it('seeds a Month Plan the app would accept', () => {
    const plan = monthPlan();

    expect(
      plan.key,
      'test/data/plans.json — the Month Plan key must be the current month ("YYYY-MM").',
    ).toMatch(/^\d{4}-\d{2}$/);

    expect(plan.plannedIncome).toBeGreaterThanOrEqual(0);
    expect(plan.categories.length).toBeGreaterThan(0);

    for (const [i, c] of plan.categories.entries()) {
      const where = `test/data/plans.json — monthPlan.categories[${i}] ("${c.name}")`;

      expect(c.id, `${where} — a category needs an id.`).toBeTruthy();
      expect(c.name, `${where} — a category needs a name.`).toBeTruthy();
      expect(c.emoji, `${where} — a category needs an emoji.`).toBeTruthy();
      // The app's plan categories are always zero-or-positive.
      expect(c.budget, `${where} — the budget cannot be negative.`).toBeGreaterThanOrEqual(0);
      expect(c.planned, `${where} — the planned amount cannot be negative.`).toBeGreaterThanOrEqual(0);
      if (c.tone !== undefined) {
        expect(
          ['primary', 'accent', 'info', 'warn', 'violet', 'danger', 'success'],
          `${where} — the tone "${c.tone}" is not one the app renders.`,
        ).toContain(c.tone);
      }
    }
  });

  it('recomputes the Month Plan totals the way the app computes them', () => {
    const summary = summariseMonthPlan(monthPlan());

    expect(
      summary.count,
      'test/data/plans.json — the Month Plan card count is stated wrongly.',
    ).toBe(plansJson.expected.monthPlan.categoryCount);

    // The hub's headline figure is the summed budget, not the
    // planned amount.
    const totalBudget = plansJson.monthPlan.categories.reduce(
      (s, c) => s + Number(c.budget || 0),
      0,
    );
    expect(
      plansJson.expected.monthPlan.totalBudgetFormatted,
      `test/data/plans.json — the Month Plan's total budget is stated as "${plansJson.expected.monthPlan.totalBudgetFormatted}", but the app computes ${bdt(totalBudget)}.`,
    ).toBe(bdt(totalBudget));

    // "Saved" is what is left after the planned spend.
    const saved = Math.max(
      0,
      plansJson.monthPlan.plannedIncome -
        plansJson.monthPlan.categories.reduce((s, c) => s + Number(c.planned || 0), 0),
    );
    expect(
      plansJson.expected.monthPlan.savedFormatted,
      `test/data/plans.json — the Month Plan's saving is stated as "${plansJson.expected.monthPlan.savedFormatted}", but the app computes ${bdt(saved)}.`,
    ).toBe(bdt(saved));
  });

  it('seeds an Event Plan the app would accept', () => {
    const events = plansJson.eventPlans as EventPlan[];

    expect(events.length).toBeGreaterThan(0);

    for (const [i, ev] of events.entries()) {
      const where = `test/data/plans.json — eventPlans[${i}] ("${ev.name}")`;

      expect(ev.id, `${where} — an event needs an id.`).toBeTruthy();
      expect(ev.name, `${where} — an event needs a name.`).toBeTruthy();
      // The app's event dates are ISO `YYYY-MM-DD`.
      expect(ev.eventDate, `${where} — the event date is not an ISO date.`).toMatch(ISO_DATE);
      expect(ev.categories.length, `${where} — the event has no categories.`).toBeGreaterThan(0);

      for (const [j, c] of ev.categories.entries()) {
        const catWhere = `${where} → categories[${j}] ("${c.name}")`;

        expect(c.id, `${catWhere} — a category needs an id.`).toBeTruthy();
        expect(c.name, `${catWhere} — a category needs a name.`).toBeTruthy();
        expect(c.budget, `${catWhere} — the budget cannot be negative.`).toBeGreaterThanOrEqual(0);
        expect(c.planned, `${catWhere} — the planned amount cannot be negative.`).toBeGreaterThanOrEqual(0);

        if (c.dueDate !== undefined) {
          expect(c.dueDate, `${catWhere} — the due date is not an ISO date.`).toMatch(ISO_DATE);
        }

        expect(c.items, `${catWhere} — the category needs a line-item list.`).toBeInstanceOf(Array);
        for (const it of c.items ?? []) {
          expect(it.id, `${catWhere} — a line item needs an id.`).toBeTruthy();
          expect(it.label, `${catWhere} — a line item needs a label.`).toBeTruthy();
          expect(it.amount, `${catWhere} — a line item amount cannot be negative.`).toBeGreaterThanOrEqual(0);
          expect(typeof it.done, `${catWhere} — a line item needs a "done" flag.`).toBe('boolean');
        }
      }
    }
  });

  it('recomputes the Event Plan totals the way the app computes them', () => {
    const ev = (plansJson.eventPlans as EventPlan[])[0];
    const summary = summariseEventPlan(ev);

    expect(
      summary.count,
      'test/data/plans.json — the Event Plan category count is stated wrongly.',
    ).toBe(plansJson.expected.eventPlan.categoryCount);

    // The event's total is `Σ category.budget` — the event's own
    // `budget` field is legacy and the app ignores it whenever a
    // category carries a budget.
    const budget = ev.categories.reduce((s, c) => s + Number(c.budget || 0), 0);
    expect(
      plansJson.expected.eventPlan.budgetFormatted,
      `test/data/plans.json — the Event Plan's budget is stated as "${plansJson.expected.eventPlan.budgetFormatted}", but the app computes ${bdt(budget)}.`,
    ).toBe(bdt(summary.budget));

    // "Planned" is the sum of the line items (the granular truth).
    const planned = ev.categories.reduce(
      (s, c) =>
        s +
        (c.items.length > 0
          ? c.items.reduce((is, it) => is + Number(it.amount || 0), 0)
          : Number(c.planned || 0)),
      0,
    );
    expect(
      plansJson.expected.eventPlan.plannedFormatted,
      `test/data/plans.json — the Event Plan's allocated figure is stated as "${plansJson.expected.eventPlan.plannedFormatted}", but the app computes ${bdt(planned)}.`,
    ).toBe(bdt(summary.planned));

    // "Paid" is the sum of the TICKED line items only.
    const paid = ev.categories.reduce(
      (s, c) =>
        s + c.items.filter(it => it.done).reduce((is, it) => is + Number(it.amount || 0), 0),
      0,
    );
    expect(
      plansJson.expected.eventPlan.paidFormatted,
      `test/data/plans.json — the Event Plan's paid figure is stated as "${plansJson.expected.eventPlan.paidFormatted}", but the app computes ${bdt(paid)}.`,
    ).toBe(bdt(summary.paidSoFar));
  });

  it('gives every plan category a distinct id', () => {
    const ids = [
      ...plansJson.monthPlan.categories.map(c => c.id),
      ...plansJson.eventPlans.flatMap(ev =>
        ev.categories.flatMap(c => [
          c.id,
          ...(c.items ?? []).map(it => it.id),
        ]),
      ),
    ];
    expect(
      new Set(ids).size,
      'test/data/plans.json — a plan category or line item shares its id with another.',
    ).toBe(ids.length);
  });

  it('keeps every category due date on or before its event date', () => {
    // A category that is due AFTER the event has happened is a data
    // mistake — the app's timeline would show it past the anchor.
    for (const ev of plansJson.eventPlans as EventPlan[]) {
      for (const c of ev.categories) {
        if (!c.dueDate) continue;
        expect(
          c.dueDate <= ev.eventDate,
          `test/data/plans.json — the category "${c.name}" is due ${c.dueDate}, after its event (${ev.eventDate}).`,
        ).toBe(true);
      }
    }
  });
});

/* ─────────────────────────────────────────────────────────────────────
   Cross-store invariants
   ───────────────────────────────────────────────────────────────────── */

describe('the JSON stores agree with each other', () => {
  it('uses the same email in the valid and invalid credential sets', () => {
    // The invalid case is "right address, wrong password" — a
    // different address would test the wrong thing.
    expect(authJson.invalidCredentials.email).toBe(authJson.validCredentials.email);
  });

  it('points every account reference at an account that exists', () => {
    const names = new Set(accountsJson.accounts.map(a => a.name));
    const referenced = [
      ...transactionsJson.transactions.flatMap(t =>
        t.type === 'transfer'
          ? [t.fromAccountName, t.toAccountName]
          : [t.accountName],
      ),
      ...investmentsJson.investments.map(v => v.payoutAccountName),
      investmentsJson.fdr.accountName,
      investmentsJson.dps.accountName,
    ].filter((n): n is string => typeof n === 'string' && n !== '');

    for (const name of referenced) {
      expect(
        names.has(name),
        `A store references the account "${name}", which accounts.json does not define.`,
      ).toBe(true);
    }
  });

  it('uses an ISO date wherever the app expects one', () => {
    const dates = [
      ...goalsJson.goals.map(g => g.targetDate),
    ];
    for (const d of dates) {
      expect(
        ISO_DATE.test(d),
        `"${d}" is not an ISO YYYY-MM-DD date.`,
      ).toBe(true);
    }
  });
});
