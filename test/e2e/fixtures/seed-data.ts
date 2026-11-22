/**
 * seed-data.ts — the canonical fixtures.
 *
 * These mirror the manual plan's §1 seed. Every fixture is built from
 * the JSON data store in `test/data/` so adding a row there needs no
 * code change.
 *
 * The base state comes from the shared builder (`test/support/state.ts`),
 * so every fixture starts from the app's own `DEFAULT_STATE` — same
 * entity arrays, same default categories, same `State` type. The
 * fixtures below only layer their own data on top.
 *
 * Two variants of the transaction set exist:
 *   - `today`    — dates inside the current month, so the "This month"
 *                  filter and the `thisMonth` Insights range have data.
 *   - `spanning` — dates spread across the last 6 months, so the
 *                  Insights period-comparison caption has a previous
 *                  window to compare against.
 */
import type { SeedState } from './app-state';
import type {
  AccountType,
  DebtDirection,
  DebtKind,
  InvestmentType,
  PlanCategory,
} from '@/domain/types';
import { makeState } from '../../support/state';
import { buildDefaultCategories } from '@/domain/persistence';
import accountsData from '../../data/accounts.json' with { type: 'json' };
import transactionsData from '../../data/transactions.json' with { type: 'json' };
import goalsData from '../../data/goals.json' with { type: 'json' };
import debtsData from '../../data/debts.json' with { type: 'json' };
import investmentsData from '../../data/investments.json' with { type: 'json' };
import plansData from '../../data/plans.json' with { type: 'json' };

/**
 * The JSON stores are heterogeneous — a transaction row has
 * `categoryName`, a transfer row does not, and a debt row may or
 * may not carry `person`. TypeScript infers a UNION of object
 * shapes from the array, so a field that only some rows have comes
 * back as `T | undefined`.
 *
 * These local interfaces describe the *union* the fixture actually
 * reads. They are deliberately narrow: the fixtures only ever
 * touch these fields, and narrowing here keeps the mapping code
 * free of `as` casts.
 */
interface AccountFixture {
  name: string;
  type: AccountType;
  openingBalance: number;
}

interface TransactionFixture {
  id: string;
  type: string;
  amount: number;
  note: string;
  /** Present on income / expense rows. */
  accountName?: string;
  categoryName?: string;
  /** Present on transfer rows. */
  fromAccountName?: string;
  toAccountName?: string;
}

interface DebtFixture {
  name: string;
  direction: DebtDirection;
  total: number;
  person?: string;
  kind?: DebtKind;
  interestRate?: number;
  termMonths?: number;
}

interface InvestmentFixture {
  name: string;
  type: InvestmentType;
  principal: number;
  rate: number;
  termMonths: number;
  payoutAccountName: string;
  institution: string;
  monthlyContribution?: number;
}

/** A planner category — the Month Plan's and the Event Plan's share
 *  the same shape, with the Event Plan adding line items and a due
 *  date. */
interface PlanCategoryFixture {
  id: string;
  emoji: string;
  name: string;
  budget: number;
  planned: number;
  tone?: PlanCategory['tone'];
  /** Event Plan only. */
  dueDate?: string;
  /** Event Plan only. */
  items?: Array<{ id: string; label: string; amount: number; done: boolean }>;
}

/** An event plan — the app's `EventPlan` shape. */
interface EventPlanFixture {
  id: string;
  name: string;
  emoji?: string;
  eventDate: string;
  budget: number;
  planned: number;
  categories: PlanCategoryFixture[];
}

/** Today, as `YYYY-MM-DD`. */
export function isoToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

/** `YYYY-MM` for a month `back` months before the current one. */
export function isoMonth(back: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - back);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** A date inside the month `back` months ago. */
export function isoDateInMonth(back: number, day = 15): string {
  return `${isoMonth(back)}-${String(day).padStart(2, '0')}`;
}

/**
 * The app's default income and expense categories.
 *
 * The seeded path SKIPS `mergeDefaults`, so a fixture with
 * `categories: []` makes the expense form render a "Restore default
 * categories" recovery panel instead of the chip picker. Every
 * fixture therefore carries a real category set.
 *
 * These are the app's OWN defaults (`buildDefaultCategories()`), not
 * a hand-written list — so the fixture has the same categories a real
 * user has, including the "Investment" category that the investment
 * auto-tagging depends on. A hand-written list silently drifts the
 * moment the app adds a category; this cannot.
 *
 * The names the fixtures reference — Salary, Freelance, Groceries,
 * Rent, Fuel — are all in the app's default set.
 */
export const CATEGORIES = buildDefaultCategories();

/** Build the account list with stable ids. */
function buildAccounts(): SeedState['accounts'] {
  return (accountsData.accounts as AccountFixture[]).map((a, i) => ({
    id: `acc-${i + 1}`,
    name: a.name,
    type: a.type,
    openingBalance: a.openingBalance,
    createdAt: isoMonth(6) + '-01',
  }));
}

/** Map an account name to its id. */
export function accountIdByName(name: string): string {
  const idx = accountsData.accounts.findIndex(a => a.name === name);
  if (idx < 0) throw new Error(`No fixture account named "${name}"`);
  return `acc-${idx + 1}`;
}

/** Map a category name to its id. */
export function categoryIdByName(name: string): string {
  const cat = CATEGORIES.find(c => c.name === name);
  if (!cat) throw new Error(`No fixture category named "${name}"`);
  return cat.id;
}

/**
 * Read a required field off a fixture row, failing loudly if it is
 * missing.
 *
 * The JSON stores are heterogeneous by design — a transaction row
 * has `categoryName` only when it is not a transfer. Without this
 * guard a typo in the data file would silently produce
 * `undefined`, and the test would fail later with a confusing
 * "expected 6 rows, got 0" instead of naming the missing field.
 */
function required<T>(value: T | undefined, field: string): T {
  if (value === undefined || value === null || value === '') {
    throw new Error(`Fixture row is missing the required field "${field}"`);
  }
  return value;
}

/** The transaction rows, narrowed to the fixture shape. */
function transactionFixtures(): TransactionFixture[] {
  return transactionsData.transactions as TransactionFixture[];
}

/**
 * The base state: accounts + categories + the goal / debt / investment
 * fixtures. Transactions are added by the variants below.
 */
export function baseState(): SeedState {
  const state = makeState();
  state.accounts = buildAccounts();
  state.categories = CATEGORIES.map(c => ({ ...c }));

  state.goals = goalsData.goals.map((g, i) => ({
    id: `goal-${i + 1}`,
    name: g.name,
    target: g.target,
    // `saved` is a cache — `recomputeGoalSaved` overwrites it on boot
    // from `contributions`. Seed the contributions, not the total.
    saved: 0,
    contributions: g.contributions.map((amount, j) => ({
      id: `goal-${i + 1}-contrib-${j + 1}`,
      amount,
      date: isoDateInMonth(1, 5 + j),
    })),
    targetDate: g.targetDate,
    createdAt: isoMonth(6) + '-01',
  }));

  state.debts = (debtsData.debts as DebtFixture[]).map((d, i) => ({
    id: `debt-${i + 1}`,
    name: d.name,
    direction: d.direction,
    total: d.total,
    // Also a cache — recomputed on boot from linked transactions.
    paidSoFar: 0,
    person: d.person,
    status: 'active',
    kind: d.kind ?? 'flat',
    interestRate: d.interestRate,
    termMonths: d.termMonths,
    createdAt: isoMonth(6) + '-01',
  }));

  state.investments = (investmentsData.investments as InvestmentFixture[]).map((v, i) => ({
    id: `inv-${i + 1}`,
    name: v.name,
    type: v.type,
    principal: v.principal,
    monthlyContribution: v.monthlyContribution,
    rate: v.rate,
    startDate: isoMonth(3) + '-01',
    termMonths: v.termMonths,
    payoutAccountId: accountIdByName(v.payoutAccountName),
    institution: v.institution,
    status: 'active',
    createdAt: isoMonth(3) + '-01',
  }));

  return state;
}

/**
 * The transactions whose dates fall in the current month.
 *
 * Used by the "This month" filter and the `thisMonth` Insights range.
 */
export function todayTransactions(): SeedState['transactions'] {
  const date = isoToday();
  return transactionFixtures().map(t => {
    if (t.type === 'transfer') {
      return {
        id: t.id,
        type: 'transfer' as const,
        amount: t.amount,
        date,
        fromAccountId: accountIdByName(required(t.fromAccountName, 'fromAccountName')),
        toAccountId: accountIdByName(required(t.toAccountName, 'toAccountName')),
        note: t.note,
      };
    }
    return {
      id: t.id,
      type: t.type as 'income' | 'expense',
      amount: t.amount,
      date,
      accountId: accountIdByName(required(t.accountName, 'accountName')),
      categoryId: categoryIdByName(required(t.categoryName, 'categoryName')),
      note: t.note,
    };
  });
}

/**
 * The same six transactions spread across the last 6 months, one per
 * month, so the Insights "vs previous N months" caption has a
 * previous window to compare against.
 */
export function spanningTransactions(): SeedState['transactions'] {
  const transactions = transactionFixtures().map(t => {
    if (t.type === 'transfer') {
      return {
        id: t.id,
        type: 'transfer' as const,
        amount: t.amount,
        date: isoDateInMonth(3, 10),
        fromAccountId: accountIdByName(required(t.fromAccountName, 'fromAccountName')),
        toAccountId: accountIdByName(required(t.toAccountName, 'toAccountName')),
        note: t.note,
      };
    }
    return {
      id: t.id,
      type: t.type as 'income' | 'expense',
      amount: t.amount,
      date: isoDateInMonth(3, 10),
      accountId: accountIdByName(required(t.accountName, 'accountName')),
      categoryId: categoryIdByName(required(t.categoryName, 'categoryName')),
      note: t.note,
    };
  });

  // A second pass one month earlier gives the previous window a
  // comparable figure.
  const earlier = transactionFixtures()
    .filter(t => t.type === 'expense')
    .map(t => ({
      id: `${t.id}-prev`,
      type: 'expense' as const,
      amount: t.amount,
      date: isoDateInMonth(5, 10),
      accountId: accountIdByName(required(t.accountName, 'accountName')),
      categoryId: categoryIdByName(required(t.categoryName, 'categoryName')),
      note: t.note,
    }));

  return [...transactions, ...earlier];
}

/** The standard fixture: everything, with this month's transactions. */
export function todayState(): SeedState {
  const state = baseState();
  state.transactions = todayTransactions();
  return state;
}

/** The fixture for period-comparison assertions. */
export function spanningState(): SeedState {
  const state = baseState();
  state.transactions = spanningTransactions();
  return state;
}

/**
 * The fixture for the Insights "vs previous N months" caption.
 *
 * The caption only renders when the PREVIOUS window has a non-zero
 * figure, so the fixture has to straddle two windows:
 *
 *   - the default range is "Last 6 months" → the current window is
 *     months −5 … 0;
 *   - `previousRangeOf` then looks at months −11 … −6.
 *
 * So one month of spending has to land in −5…0 and another in −11…−6.
 * `spanningTransactions` puts its earlier batch in month −5, which is
 * inside the CURRENT window — so its previous-window total is zero and
 * the caption never renders. Hence this dedicated fixture.
 */
export function comparisonState(): SeedState {
  const state = baseState();

  const inCurrentWindow = transactionFixtures()
    .filter(t => t.type === 'expense')
    .map(t => ({
      id: `${t.id}-cur`,
      type: 'expense' as const,
      amount: t.amount,
      date: isoDateInMonth(2, 10),
      accountId: accountIdByName(required(t.accountName, 'accountName')),
      categoryId: categoryIdByName(required(t.categoryName, 'categoryName')),
      note: t.note,
    }));

  const inPreviousWindow = transactionFixtures()
    .filter(t => t.type === 'expense')
    .map(t => ({
      id: `${t.id}-prev`,
      type: 'expense' as const,
      amount: t.amount,
      date: isoDateInMonth(8, 10),
      accountId: accountIdByName(required(t.accountName, 'accountName')),
      categoryId: categoryIdByName(required(t.categoryName, 'categoryName')),
      note: t.note,
    }));

  state.transactions = [...inCurrentWindow, ...inPreviousWindow];
  return state;
}

/** The fixture for the empty-state cases — accounts only, no ledger. */
export function emptyLedgerState(): SeedState {
  const state = baseState();
  state.transactions = [];
  return state;
}

/**
 * The fixture for the transaction FORM cases (FIN-T01, T03, T04, T05).
 *
 * The standard accounts and categories, but an EMPTY ledger — so the
 * rows and balances a test reads are the ones it created itself
 * through the UI, with nothing else in the way.
 *
 * The goal / debt / investment fixtures are KEPT, because the add
 * form's "Linked debt (optional)" and "Linked investment (optional)"
 * dropdowns are populated from them — the form cases assert on those
 * dropdowns.
 */
export function formState(): SeedState {
  const state = baseState();
  state.transactions = [];
  return state;
}

/**
 * The fixture for the investment cases — no schemes at all.
 *
 * The base state ships an FDR and a DPS. The investment lifecycle
 * cases create their own, and two schemes sharing a name would make
 * the card locators ambiguous.
 */
export function noInvestmentsState(): SeedState {
  const state = baseState();
  state.investments = [];
  return state;
}

/** A fixture with no accounts at all — the true first-run state. */
export function firstRunState(): SeedState {
  const state = makeState();
  state.categories = CATEGORIES.map(c => ({ ...c }));
  return state;
}

/**
 * The fixture for the transaction-filter case (FIN-T02).
 *
 * Seven transactions: the standard six plus a **payout** (linked to an
 * investment) and a **debt payment** (linked to a debt), so the
 * "Payouts" and "Debt payments" chips each have a match. The standard
 * six are dated today, so the "This month" chip matches too.
 */
export function filterState(): SeedState {
  const state = baseState();
  const bank = accountIdByName('Main Bank');
  const cash = accountIdByName('Cash');
  const debt = state.debts[0]?.id ?? 'debt-1';
  const investment = state.investments[0]?.id ?? 'inv-1';

  state.transactions = [
    ...todayTransactions(),
    {
      id: 'tx-filter-payout',
      type: 'income' as const,
      amount: 109000,
      date: isoToday(),
      accountId: bank,
      categoryId: categoryIdByName('Other Income'),
      note: 'maturity payout — DBBL 1-year FDR',
      linkedInvestmentId: investment,
    },
    {
      id: 'tx-filter-debt-payment',
      type: 'expense' as const,
      amount: 5000,
      date: isoToday(),
      accountId: cash,
      categoryId: categoryIdByName('Groceries'),
      note: 'Part payment',
      linkedDebtId: debt,
    },
  ];

  return state;
}

/**
 * The fixture for the linked-debt case (FIN-T09).
 *
 * "Loan from Rahim" is owed 20,000 with 5,000 already paid, so the
 * remaining reads 15,000 before the new payment and 13,000 after.
 */
export function debtPaymentState(): SeedState {
  const state = baseState();
  const cash = accountIdByName('Cash');
  const debt = state.debts.find(d => d.name === 'Loan from Rahim');
  if (!debt) throw new Error('Fixture debt "Loan from Rahim" is missing');

  state.transactions = [
    {
      id: 'tx-debt-paid-1',
      type: 'expense' as const,
      amount: 5000,
      date: isoToday(),
      accountId: cash,
      categoryId: categoryIdByName('Groceries'),
      note: 'Part payment',
      linkedDebtId: debt.id,
    },
  ];

  return state;
}

/**
 * The fixture for the linked-investment case (FIN-T10).
 *
 * One FDR whose payout account is "Main Bank", so the form's account
 * field can be shown auto-switching to it.
 */
export function fdrState(): SeedState {
  const state = noInvestmentsState();

  state.investments = [
    {
      id: 'inv-fdr-1',
      name: 'DBBL 1-year FDR',
      type: 'fdr' as const,
      principal: 100000,
      rate: 9,
      startDate: isoMonth(3) + '-01',
      termMonths: 12,
      payoutAccountId: accountIdByName('Main Bank'),
      institution: 'DBBL',
      status: 'active' as const,
      createdAt: isoMonth(3) + '-01',
    },
  ];

  return state;
}

/**
 * The fixture for the "a filter that matches nothing" case (FIN-T02).
 *
 * ONE transaction, and it touches the "Visa Card" account — an
 * account whose TYPE is "card" but whose NAME is not "Cash". The
 * "Cash" chip matches on the account NAME, so it matches nothing
 * here, and the case's empty state is reached.
 */
export function visaCardOnlyState(): SeedState {
  const state = baseState();
  state.transactions = [
    {
      id: 'tx-visa-only',
      type: 'expense' as const,
      amount: 900,
      date: isoToday(),
      accountId: accountIdByName('Visa Card'),
      categoryId: categoryIdByName('Groceries'),
      note: 'Card purchase',
    },
  ];
  return state;
}

/**
 * The fixture for the amount-formatting case (FIN-T11).
 *
 * Two transactions whose amounts exercise both the thousands separator
 * and the en-IN lakh grouping.
 */
export function formattingState(): SeedState {
  const state = baseState();
  const bank = accountIdByName('Main Bank');

  state.transactions = [
    {
      id: 'tx-fmt-small',
      type: 'expense' as const,
      amount: 3500,
      date: isoToday(),
      accountId: bank,
      categoryId: categoryIdByName('Groceries'),
      note: 'Weekly shop',
    },
    {
      id: 'tx-fmt-large',
      type: 'income' as const,
      amount: 1234567,
      date: isoToday(),
      accountId: bank,
      categoryId: categoryIdByName('Salary'),
      note: 'Yearly bonus',
    },
  ];

  return state;
}

/**
 * The fixture for the loan-kind debt case (FIN-D02).
 *
 * A single loan-kind debt: 60,000 at 12% over 36 months, owed to
 * "Rahim", with no payments yet.
 */
export function loanDebtState(): SeedState {
  const state = baseState();
  state.debts = [
    {
      id: 'debt-loan-1',
      name: 'Loan from Rahim',
      direction: 'i_owe' as const,
      total: 60000,
      paidSoFar: 0,
      person: 'Rahim',
      status: 'active' as const,
      kind: 'loan' as const,
      interestRate: 12,
      termMonths: 36,
      createdAt: isoMonth(6) + '-01',
    },
  ];
  return state;
}

/**
 * The fixture for the flat-debt lifecycle case (FIN-D01).
 *
 * NO debts and an EMPTY ledger — the case creates its own debt
 * through the UI, so the card and the opening transaction are the
 * ones the case made.
 */
export function noDebtsState(): SeedState {
  const state = baseState();
  state.debts = [];
  state.transactions = [];
  return state;
}

/**
 * The fixture for the delete / auto-completion case (FIN-D04).
 *
 * Three flat debts, so every step of the case has its own subject:
 *   - "Loan from Rahim" — 20,000, owed, with ONE linked 5,000
 *     payment (the row that must survive the delete),
 *   - "Advance to Karim" — 8,000, owed, with NO payments (the one
 *     whose direction is flipped),
 *   - "Bike loan" — 60,000, owed, with NO payments (the one that is
 *     paid off).
 *
 * All three are FLAT on purpose. The loan-kind downgrade guard fires
 * a confirmation when a loan is flipped back to flat, which is a
 * different behaviour from the direction flip the case exercises.
 *
 * The payment is a linked EXPENSE, which is what an "I owe"
 * repayment is.
 */
export function debtWithPaymentState(): SeedState {
  const state = baseState();
  const cash = accountIdByName('Cash');
  const debt = state.debts.find(d => d.name === 'Loan from Rahim');
  if (!debt) throw new Error('Fixture debt "Loan from Rahim" is missing');

  state.debts = [
    debt,
    {
      id: 'debt-flat-2',
      name: 'Advance to Karim',
      direction: 'i_owe' as const,
      total: 8000,
      paidSoFar: 0,
      person: 'Karim',
      status: 'active' as const,
      kind: 'flat' as const,
      createdAt: isoMonth(6) + '-01',
    },
    {
      id: 'debt-flat-3',
      name: 'Bike loan',
      direction: 'i_owe' as const,
      total: 60000,
      paidSoFar: 0,
      person: 'Rahim',
      status: 'active' as const,
      kind: 'flat' as const,
      createdAt: isoMonth(6) + '-01',
    },
  ];

  state.transactions = [
    {
      id: 'tx-debt-payment-1',
      type: 'expense' as const,
      amount: 5000,
      date: isoToday(),
      accountId: cash,
      categoryId: categoryIdByName('Groceries'),
      note: 'Part payment',
      linkedDebtId: debt.id,
    },
  ];

  return state;
}

/**
 * The fixture for the activity-feed case (FIN-D05).
 *
 * "Loan from Rahim" carries THREE linked payments — two expenses
 * (the normal "Payment" rows for an "I owe" debt) and one income
 * (the "Reversal" row) — so every tag the Activity card can render
 * is exercised.
 */
export function debtActivityState(): SeedState {
  const state = baseState();
  const cash = accountIdByName('Cash');
  const debt = state.debts.find(d => d.name === 'Loan from Rahim');
  if (!debt) throw new Error('Fixture debt "Loan from Rahim" is missing');

  state.transactions = [
    {
      id: 'tx-debt-activity-1',
      type: 'expense' as const,
      amount: 5000,
      date: isoDateInMonth(0, 10),
      accountId: cash,
      categoryId: categoryIdByName('Groceries'),
      note: 'First instalment',
      linkedDebtId: debt.id,
    },
    {
      id: 'tx-debt-activity-2',
      type: 'expense' as const,
      amount: 7000,
      date: isoDateInMonth(1, 12),
      accountId: cash,
      categoryId: categoryIdByName('Groceries'),
      note: 'Second instalment',
      linkedDebtId: debt.id,
    },
    {
      id: 'tx-debt-activity-3',
      type: 'income' as const,
      amount: 1000,
      date: isoDateInMonth(2, 14),
      accountId: cash,
      categoryId: categoryIdByName('Salary'),
      note: 'Adjustment',
      linkedDebtId: debt.id,
    },
  ];

  return state;
}

/**
 * The fixture for the overpayment case (FIN-D06).
 *
 * ONE flat debt — "Loan from Rahim", 20,000, owed — with an EMPTY
 * ledger, so the outstanding is exactly 20,000 and nothing else can
 * move the figures the case reads.
 */
export function singleFlatDebtState(): SeedState {
  const state = baseState();
  state.debts = state.debts.filter(d => d.name === 'Loan from Rahim');
  state.transactions = [];
  return state;
}

/**
 * The fixture for the repayment case (FIN-D07).
 *
 * ONE flat debt — "Lent to Karim", 15,000, owed TO ME — with an
 * EMPTY ledger, so the Cash balance is its opening 5,000 and the
 * debt's paid figure is 0.
 */
export function singleReceivableDebtState(): SeedState {
  const state = baseState();
  state.debts = state.debts.filter(d => d.name === 'Lent to Karim');
  state.transactions = [];
  return state;
}

/**
 * The fixture for the fully-paid debt case (FIN-D04).
 *
 * A flat debt of 20,000 with a 5,000 payment already against it, so
 * the paid figure reads 5,000 and the remaining 15,000.
 */
export function paidDebtState(): SeedState {
  const state = baseState();
  const cash = accountIdByName('Cash');
  const debt = state.debts.find(d => d.name === 'Loan from Rahim');
  if (!debt) throw new Error('Fixture debt "Loan from Rahim" is missing');

  state.transactions = [
    {
      id: 'tx-debt-partial',
      type: 'expense' as const,
      amount: 5000,
      date: isoToday(),
      accountId: cash,
      categoryId: categoryIdByName('Groceries'),
      note: 'Part payment',
      linkedDebtId: debt.id,
    },
  ];

  return state;
}

/**
 * The fixture for the DPS cases (FIN-I02, FIN-I06).
 *
 * One DPS with a 5,000 monthly contribution, 8% over 12 months, and
 * no contribution paid yet.
 */
export function dpsState(): SeedState {
  const state = noInvestmentsState();

  state.investments = [
    {
      id: 'inv-dps-1',
      name: 'Monthly DPS',
      type: 'dps' as const,
      principal: 0,
      monthlyContribution: 5000,
      rate: 8,
      startDate: isoMonth(3) + '-01',
      termMonths: 12,
      payoutAccountId: accountIdByName('Main Bank'),
      institution: 'BRAC',
      status: 'active' as const,
      createdAt: isoMonth(3) + '-01',
    },
  ];

  return state;
}

/**
 * The fixture for the current-vs-maturity case (FIN-I06).
 *
 * A DPS with ONE 5,000 contribution already paid, and an FDR with a
 * 100,000 principal. The DPS's contribution is dated 3 months ago —
 * the same month its plan started — so its CURRENT value (the
 * contributions compounded to today) is a real compounded figure
 * rather than the bare contribution.
 *
 * The ledger holds ONLY that contribution, so the "current value"
 * the case reads is the DPS's own figure and nothing else.
 */
export function dpsWithContributionState(): SeedState {
  const state = noInvestmentsState();
  const bank = accountIdByName('Main Bank');

  state.investments = [
    {
      id: 'inv-dps-1',
      name: 'Monthly DPS',
      type: 'dps' as const,
      principal: 0,
      monthlyContribution: 5000,
      rate: 8,
      startDate: isoMonth(3) + '-01',
      termMonths: 12,
      payoutAccountId: bank,
      institution: 'BRAC',
      status: 'active' as const,
      createdAt: isoMonth(3) + '-01',
    },
    {
      id: 'inv-fdr-1',
      name: 'DBBL 1-year FDR',
      type: 'fdr' as const,
      principal: 100000,
      rate: 9,
      startDate: isoMonth(3) + '-01',
      termMonths: 12,
      payoutAccountId: bank,
      institution: 'DBBL',
      status: 'active' as const,
      createdAt: isoMonth(3) + '-01',
    },
  ];

  state.transactions = [
    {
      id: 'tx-dps-contribution-1',
      type: 'expense' as const,
      amount: 5000,
      date: isoMonth(3) + '-01',
      accountId: bank,
      categoryId: categoryIdByName('Investment'),
      note: 'October installment',
      linkedInvestmentId: 'inv-dps-1',
    },
  ];

  return state;
}

/**
 * The fixture for the maturity-payout case (FIN-I07).
 *
 * One MATURED FDR — 100,000 at 9% over 12 months, started 14 months
 * ago so it matured a month ago — with `Main Bank` as its payout
 * account, plus the opening principal expense that a real creation
 * would have produced.
 *
 * The principal expense is what brings `Main Bank` down to 20,000,
 * so the payout the case records raises it back by the payout amount.
 */
export function maturedFdrState(): SeedState {
  const state = noInvestmentsState();
  const bank = accountIdByName('Main Bank');

  state.investments = [
    {
      id: 'inv-matured-1',
      name: 'DBBL 1-year FDR',
      type: 'fdr' as const,
      principal: 100000,
      rate: 9,
      startDate: isoMonth(14) + '-01',
      termMonths: 12,
      payoutAccountId: bank,
      institution: 'DBBL',
      status: 'active' as const,
      createdAt: isoMonth(14) + '-01',
    },
  ];

  state.transactions = [
    {
      id: 'tx-investment-principal-1',
      type: 'expense' as const,
      amount: 100000,
      date: isoMonth(14) + '-01',
      accountId: bank,
      categoryId: categoryIdByName('Investment'),
      note: 'Principal parked in DBBL 1-year FDR',
      linkedInvestmentId: 'inv-matured-1',
    },
  ];

  return state;
}

/**
 * The fixture for the maturity-status cases (FIN-I05).
 *
 * One FDR whose maturity date has already passed — its start date is
 * 14 months ago with a 12-month term — and one DPS that has never
 * been paid out.
 */
export function maturedInvestmentState(): SeedState {
  const state = noInvestmentsState();

  state.investments = [
    {
      id: 'inv-matured-1',
      name: 'DBBL 1-year FDR',
      type: 'fdr' as const,
      principal: 100000,
      rate: 9,
      // 14 months ago + 12 months → matured a month ago.
      startDate: isoMonth(14) + '-01',
      termMonths: 12,
      payoutAccountId: accountIdByName('Main Bank'),
      institution: 'DBBL',
      status: 'active' as const,
      createdAt: isoMonth(14) + '-01',
    },
    {
      id: 'inv-dps-1',
      name: 'Monthly DPS',
      type: 'dps' as const,
      principal: 0,
      monthlyContribution: 5000,
      rate: 8,
      startDate: isoMonth(3) + '-01',
      termMonths: 12,
      payoutAccountId: accountIdByName('Main Bank'),
      institution: 'BRAC',
      status: 'active' as const,
      createdAt: isoMonth(3) + '-01',
    },
  ];

  return state;
}

/**
 * The fixture for the Home case (FIN-H01).
 *
 * Four accounts, the standard six transactions, one goal, debts and
 * investments — so every tile on the Home screen has a figure.
 */
export function homeState(): SeedState {
  return todayState();
}

/**
 * The fixture for the Home case (FIN-H01).
 *
 * The standard six transactions, dated TODAY so the "This month"
 * card and the Recent activity preview both have rows.
 *
 * The balances the case reads:
 *   Cash      5000 − 1200 − 3000        =   800
 *   Main Bank 120000 + 60000 − 18000     = 162000
 *   bKash     2500 + 12000 − 250 + 3000 = 17250
 *   Visa Card 0                          =     0
 *   → strip "Cash" = ৳ 1,80,050
 *
 * ⚠️ `todayState()` cannot be used here — it carries the standard six
 * transactions but ALSO the DPS and FDR fixtures, and the Home case
 * reads the "Investments" strip cell. This fixture keeps the base
 * schemes so the projection column has something to show.
 */
export function homeLedgerState(): SeedState {
  const state = baseState();
  state.transactions = [
    {
      id: 'tx-home-salary',
      type: 'income' as const,
      amount: 60000,
      date: isoToday(),
      accountId: accountIdByName('Main Bank'),
      categoryId: categoryIdByName('Salary'),
      note: 'Monthly salary',
    },
    {
      id: 'tx-home-freelance',
      type: 'income' as const,
      amount: 12000,
      date: isoToday(),
      accountId: accountIdByName('bKash'),
      categoryId: categoryIdByName('Freelance'),
      note: 'Design work',
    },
    {
      id: 'tx-home-groceries',
      type: 'expense' as const,
      amount: 1200,
      date: isoToday(),
      accountId: accountIdByName('Cash'),
      categoryId: categoryIdByName('Groceries'),
      note: 'Weekly shop',
    },
    {
      id: 'tx-home-rent',
      type: 'expense' as const,
      amount: 18000,
      date: isoToday(),
      accountId: accountIdByName('Main Bank'),
      categoryId: categoryIdByName('Rent'),
      note: 'Monthly rent',
    },
    {
      id: 'tx-home-fuel',
      type: 'expense' as const,
      amount: 250,
      date: isoToday(),
      accountId: accountIdByName('bKash'),
      categoryId: categoryIdByName('Fuel'),
      note: 'Petrol',
    },
    {
      id: 'tx-home-transfer',
      type: 'transfer' as const,
      amount: 3000,
      date: isoToday(),
      fromAccountId: accountIdByName('Cash'),
      toAccountId: accountIdByName('bKash'),
      note: 'Top up wallet',
    },
    {
      // A DPS contribution dated LAST MONTH.
      //
      // The hero's "vs last month" row is dropped when the delta is
      // zero, and `computeNetWorth` computes cash from ALL
      // transactions regardless of the `asOf` date — so the only
      // figure that differs between "now" and "last month end" is a
      // DPS's compounded current value. Without this transaction the
      // row never renders and the case's "vs last month" clause is
      // unreachable.
      id: 'tx-home-dps-contribution',
      type: 'expense' as const,
      amount: 5000,
      date: isoDateInMonth(1, 5),
      accountId: accountIdByName('Main Bank'),
      categoryId: categoryIdByName('Investment'),
      note: 'October installment',
      linkedInvestmentId: 'inv-2',
    },
  ];
  return state;
}

/**
 * The fixture for the Insights range case (FIN-H02).
 *
 * Twelve transactions spread across three months, so:
 *   - the default "Last 6 months" window holds two months of data,
 *   - the spending-by-category card has more than six categories, so
 *     the "Other" bucket renders,
 *   - one transaction points at a category id that does not exist, so
 *     the "Unknown" bucket renders.
 *
 * One expense sits 14 months back, so "All time" spans 15 months and
 * the cash-flow chart's 12-month cap kicks in — which is what makes
 * the "Showing last 12 of 15 months" note render.
 */
export function insightsRangeState(): SeedState {
  const state = baseState();
  const bank = accountIdByName('Main Bank');
  const cash = accountIdByName('Cash');
  const wallet = accountIdByName('bKash');

  const twoMonthsBack = isoDateInMonth(2, 1);
  const oneMonthBack = isoDateInMonth(1, 1);

  state.transactions = [
    { id: 'tx-h02-salary', type: 'income' as const, amount: 60000, date: twoMonthsBack, accountId: bank, categoryId: categoryIdByName('Salary'), note: 'Monthly salary' },
    { id: 'tx-h02-freelance', type: 'income' as const, amount: 20000, date: oneMonthBack, accountId: wallet, categoryId: categoryIdByName('Freelance'), note: 'Design work' },
    { id: 'tx-h02-rent', type: 'expense' as const, amount: 18000, date: twoMonthsBack, accountId: bank, categoryId: categoryIdByName('Rent'), note: 'Monthly rent' },
    { id: 'tx-h02-groceries', type: 'expense' as const, amount: 1200, date: oneMonthBack, accountId: cash, categoryId: categoryIdByName('Groceries'), note: 'Weekly shop' },
    { id: 'tx-h02-fuel', type: 'expense' as const, amount: 250, date: oneMonthBack, accountId: wallet, categoryId: categoryIdByName('Fuel'), note: 'Petrol' },
    { id: 'tx-h02-utilities', type: 'expense' as const, amount: 800, date: oneMonthBack, accountId: bank, categoryId: categoryIdByName('Utilities'), note: 'Electricity bill' },
    { id: 'tx-h02-transport', type: 'expense' as const, amount: 600, date: oneMonthBack, accountId: cash, categoryId: categoryIdByName('Transport'), note: 'Rickshaw fare' },
    { id: 'tx-h02-phone', type: 'expense' as const, amount: 500, date: oneMonthBack, accountId: bank, categoryId: categoryIdByName('Phone & Internet'), note: 'Mobile bill' },
    { id: 'tx-h02-subscriptions', type: 'expense' as const, amount: 400, date: oneMonthBack, accountId: wallet, categoryId: categoryIdByName('Subscriptions'), note: 'Streaming' },
    { id: 'tx-h02-health', type: 'expense' as const, amount: 300, date: oneMonthBack, accountId: cash, categoryId: categoryIdByName('Health'), note: 'Medicine' },
    // Points at a category id that is NOT in the store — the
    // breakdown renders it under "Unknown".
    { id: 'tx-h02-orphan', type: 'expense' as const, amount: 5000, date: oneMonthBack, accountId: bank, categoryId: 'cat-removed-1', note: 'Spend with a deleted category' },
    // 14 months back — makes "All time" span 15 months.
    { id: 'tx-h02-ancient', type: 'expense' as const, amount: 2000, date: isoDateInMonth(14, 1), accountId: bank, categoryId: categoryIdByName('Books'), note: 'Old purchase' },
  ];
  return state;
}

/**
 * The fixture for the Trends case (FIN-H04).
 *
 * Four expenses, one per comparison window, so the "vs previous N
 * months" caption has a previous window with data at every range:
 *
 *   - month −2  → inside "Last 3 / 6 / 12 months" and "All time"
 *   - month −4  → inside "Last 6 / 12 months" and "All time"
 *   - month −8  → inside "Last 12 months" and "All time"
 *   - month −14 → inside "All time" only
 *
 * ⚠️ There is NO income, so the "Savings rate" row renders "—".
 */
export function trendsState(): SeedState {
  const state = baseState();
  const bank = accountIdByName('Main Bank');

  const rent = (id: string, monthsBack: number, amount: number, note: string) => ({
    id,
    type: 'expense' as const,
    amount,
    date: isoDateInMonth(monthsBack, 1),
    accountId: bank,
    categoryId: categoryIdByName('Rent'),
    note,
  });

  state.transactions = [
    rent('tx-h04-current', 2, 20000, 'Rent two months back'),
    rent('tx-h04-prev3', 4, 10000, 'Rent four months back'),
    rent('tx-h04-prev6', 8, 5000, 'Rent eight months back'),
    rent('tx-h04-prev12', 14, 50000, 'Rent fourteen months back'),
  ];
  return state;
}

/**
 * The fixture for the Trends case (FIN-H04) — the "previous window
 * has no data" branch.
 *
 * ONE expense, dated two months back. Every previous window is then
 * empty, so the caption is suppressed on every range.
 */
export function trendsNoPreviousState(): SeedState {
  const state = baseState();
  state.transactions = [
    {
      id: 'tx-h04-lonely',
      type: 'expense' as const,
      amount: 20000,
      date: isoDateInMonth(2, 1),
      accountId: accountIdByName('Main Bank'),
      categoryId: categoryIdByName('Rent'),
      note: 'Rent two months back',
    },
  ];
  return state;
}

/**
 * The fixture for the "Home reflects the ledger" case (FIN-H01) with
 * liabilities dominating.
 *
 * A single account that OVERDRAWS: the opening balance is zeroed and a
 * 2,000 expense is recorded against it, so the net worth is negative
 * and the hero's caption flips to "Liabilities exceed assets".
 */
export function negativeNetWorthState(): SeedState {
  const state = baseState();
  const cash = accountIdByName('Cash');
  state.accounts = state.accounts
    .filter(a => a.id === cash)
    .map(a => ({ ...a, openingBalance: 0 }));
  state.goals = [];
  state.debts = [];
  state.investments = [];

  state.transactions = [
    {
      id: 'tx-h01-overdraft',
      type: 'expense' as const,
      amount: 2000,
      date: isoToday(),
      accountId: cash,
      categoryId: categoryIdByName('Groceries'),
      note: 'Big purchase',
    },
  ];
  return state;
}

/**
 * The fixture for the Event Plan + ledger case (FIN-L09).
 *
 * The event plan's categories carry line items, and the ledger is
 * populated so the test can prove the plan never touched it.
 */
export function eventPlanFullState(): SeedState {
  return eventPlanLedgerState();
}

/**
 * A fixture with exactly ONE account — the transfer case's
 * single-account profile (FIN-T05).
 */
export function singleAccountState(): SeedState {
  const state = baseState();
  state.accounts = state.accounts.filter(a => a.name === 'Cash');
  state.debts = [];
  state.investments = [];
  state.goals = [];
  state.transactions = [];
  return state;
}

/**
 * The fixture for the goal-pace case (FIN-G03).
 *
 * Two goals with the SAME target (50000) and the SAME target date —
 * one saved ahead of the planned pace, one behind it.
 *
 * ## Why the dates are relative
 *
 * `paceOf()` (in `src/screens/GoalsListScreen.tsx`) compares the saved
 * amount against `(elapsedMonths / plannedMonths) * target`, where
 * `plannedMonths` runs from the goal's `createdAt` to its
 * `targetDate` and `elapsedMonths` from `createdAt` to TODAY.
 *
 * A FIXED `createdAt` would make the classification drift with the
 * calendar — the same fixture would read "Ahead" in January and
 * "Behind" in December. So both dates are derived: `createdAt` is the
 * 1st of the month 6 months ago, and `targetDate` is 12 months after
 * it. That pins the ratio at 6/12 = 50% of the target for ANY run
 * date:
 *
 *   expected = (6 / 12) * 50000 = 25000
 *   ahead   → saved >= 25000
 *   behind  → saved <  25000 * 0.8 = 20000
 *
 * The saved amounts are then 31000 (ahead) and 6000 (behind) — which
 * also give the percentage chips the manual states: 62% and 12%.
 */
export function goalPaceState(): SeedState {
  const state = baseState();
  state.transactions = [];

  const createdAt = isoMonth(6) + '-01';

  // Twelve months after `createdAt`, same day-of-month.
  const created = new Date(`${createdAt}T00:00:00Z`);
  created.setUTCMonth(created.getUTCMonth() + 12);
  const targetDate = created.toISOString().slice(0, 10);

  const makeGoal = (
    id: string,
    name: string,
    amount: number,
    contributionId: string,
  ): SeedState['goals'][number] => ({
    id,
    name,
    target: goalsData.G03_pace.target,
    // A cache — `recomputeGoalSaved` overwrites it on boot from the
    // contributions below.
    saved: 0,
    contributions: [
      {
        id: contributionId,
        amount,
        date: isoToday(),
      },
    ],
    targetDate,
    createdAt,
  });

  state.goals = [
    makeGoal('goal-ahead', goalsData.G03_pace.ahead.name, goalsData.G03_pace.ahead.saved, 'goal-ahead-contrib-1'),
    makeGoal('goal-behind', goalsData.G03_pace.behind.name, goalsData.G03_pace.behind.saved, 'goal-behind-contrib-1'),
  ];

  return state;
}

/**
 * The fixture for the goal-lifecycle case (FIN-G01).
 *
 * NO goals at all — the case creates its own through the UI, so the
 * card locators are unambiguous.
 */
export function noGoalsState(): SeedState {
  const state = baseState();
  state.goals = [];
  return state;
}

/**
 * The fixture for the "a contribution never moves a balance" case
 * (FIN-G04).
 *
 * `Cash` opens at 5000 and the ledger is EMPTY, so the Transactions
 * list and the Home "This month" card both start from zero.
 */
export function goalLedgerState(): SeedState {
  const state = baseState();
  state.goals = [];
  state.debts = [];
  state.investments = [];
  state.transactions = [];
  return state;
}

/**
 * The fixture for the goal status-states case (FIN-G02).
 *
 * Two goals:
 *   - one whose contributions already reach the target (complete),
 *   - one whose target date has passed (expired).
 *
 * Their `createdAt` is in the past so the expiry check is not
 * ambiguous.
 */
export function goalStatusState(): SeedState {
  const state = baseState();
  state.transactions = [];

  state.goals = [
    {
      id: 'goal-reached',
      name: 'Reached goal',
      target: goalsData.G02_validation.reached.target,
      saved: 0,
      contributions: [
        {
          id: 'goal-reached-contrib-1',
          amount: goalsData.G02_validation.reached.target,
          date: isoToday(),
        },
      ],
      targetDate: goalsData.G02_validation.reached.targetDate,
      createdAt: isoMonth(6) + '-01',
    },
    {
      id: 'goal-expired',
      name: 'Expired goal',
      target: goalsData.G02_validation.expired.target,
      saved: 0,
      contributions: [
        {
          id: 'goal-expired-contrib-1',
          amount: goalsData.G02_validation.expired.saved,
          date: goalsData.G02_validation.expired.contributionDate,
        },
      ],
      targetDate: goalsData.G02_validation.expired.targetDate,
      createdAt: goalsData.G02_validation.expired.createdAt,
    },
  ];

  return state;
}

/**
 * The fixture for the account-balance metadata case.
 *
 * `Main Bank` opens at 120000 and carries exactly four movements, so
 * its card shows the figure the manual case states:
 *
 *   120000 + 60000 − 18000 − 3000 = 159000
 *
 * and a delta of `+42000` against the opening balance. The other
 * accounts are left untouched so one of them can act as the "no
 * activity yet" control.
 *
 * ⚠️ `todayState()` cannot be used here — its standard six
 * transactions leave `Main Bank` at ৳1,62,000, not the ৳1,59,000 the
 * case documents.
 */
export function accountMetadataState(): SeedState {
  const state = baseState();
  const bank = accountIdByName('Main Bank');
  const cash = accountIdByName('Cash');

  state.transactions = [
    {
      id: 'tx-meta-income',
      type: 'income' as const,
      amount: 60000,
      date: isoToday(),
      accountId: bank,
      categoryId: categoryIdByName('Salary'),
      note: 'Monthly salary',
    },
    {
      id: 'tx-meta-expense',
      type: 'expense' as const,
      amount: 18000,
      date: isoToday(),
      accountId: bank,
      categoryId: categoryIdByName('Rent'),
      note: 'Monthly rent',
    },
    {
      id: 'tx-meta-transfer',
      type: 'transfer' as const,
      amount: 3000,
      date: isoToday(),
      fromAccountId: bank,
      toAccountId: cash,
      note: 'Top up wallet',
    },
    {
      // Offsets the 3000 transfer INTO Cash, so Cash's balance moves
      // but its net delta against the opening balance is zero. This
      // is the only way to reach the card's "— no change" branch:
      // a non-zero delta requires a transaction, which always yields
      // a last-activity date, so an account with NO transactions
      // renders no secondary row at all.
      id: 'tx-meta-offset',
      type: 'expense' as const,
      amount: 3000,
      date: isoToday(),
      accountId: cash,
      categoryId: categoryIdByName('Groceries'),
      note: 'Offsetting spend',
    },
  ];

  return state;
}

/**
 * The fixture for the "an account with linked transactions cannot be
 * deleted" case.
 *
 * `Cash` carries exactly three linked transactions, so the delete
 * refusal reports "3 transaction(s) still reference this account."
 */
export function linkedTransactionsState(): SeedState {
  const state = baseState();
  const cash = accountIdByName('Cash');

  state.transactions = [
    {
      id: 'tx-linked-1',
      type: 'expense' as const,
      amount: 1200,
      date: isoToday(),
      accountId: cash,
      categoryId: categoryIdByName('Groceries'),
      note: 'Weekly shop',
    },
    {
      id: 'tx-linked-2',
      type: 'expense' as const,
      amount: 250,
      date: isoToday(),
      accountId: cash,
      categoryId: categoryIdByName('Fuel'),
      note: 'Petrol',
    },
    {
      id: 'tx-linked-3',
      type: 'income' as const,
      amount: 900,
      date: isoToday(),
      accountId: cash,
      categoryId: categoryIdByName('Freelance'),
      note: 'Design work',
    },
  ];

  return state;
}

/**
 * The fixture for the negative-balance case (FIN-T12).
 *
 * `Cash` opens at 1000 and the ledger is EMPTY — the manual case
 * RECORDS the 2500 expense itself, so a pre-seeded one would double
 * the spend and the balance would read ৳ −4,000 instead of ৳ −1,500.
 *
 * ⚠️ ONLY the Cash account survives. The manual case expects the
 * Home "Cash" tile and the net-worth figure to report the SAME
 * signed figure as the account card — and Home's "Cash" tile is the
 * SUM of every account's balance, so a second account would make
 * the two disagree.
 */
export function negativeBalanceState(): SeedState {
  const state = baseState();
  const cash = accountIdByName('Cash');
  state.accounts = state.accounts.filter(a => a.id === cash);
  const account = state.accounts.find(a => a.id === cash);
  if (account) account.openingBalance = 1000;

  state.transactions = [];
  state.goals = [];
  state.debts = [];
  state.investments = [];

  return state;
}

/**
 * The fixture for the edit-recalculates case (FIN-T07).
 *
 * `Cash` opens at 1000 and carries ONE expense of 1200 — the entry
 * the case edits to 1500.
 */
export function editableExpenseState(): SeedState {
  const state = baseState();
  const cash = accountIdByName('Cash');
  const account = state.accounts.find(a => a.id === cash);
  if (account) account.openingBalance = 1000;

  state.transactions = [
    {
      id: 'tx-editable-1',
      type: 'expense' as const,
      amount: 1200,
      date: isoToday(),
      accountId: cash,
      categoryId: categoryIdByName('Groceries'),
      note: 'Weekly shop',
    },
  ];

  return state;
}

/**
 * The fixture for the visual suite — a rich, deterministic state.
 *
 * The visual baselines are only as good as the state behind them, so
 * this fixture is deliberately MORE complete than the functional
 * ones:
 *
 *   - five accounts, one per account type, so the Accounts grid shows
 *     every icon and label variant;
 *   - six transactions spanning every row shape the ledger can
 *     render, including all five transaction tags ("Payout",
 *     "Borrowed", "Lent", "Debt payment", "Debt received");
 *   - the goal / debt / investment / month-plan fixtures.
 *
 * ⚠️ **The dates are FIXED, not relative.** A snapshot of a screen
 * that renders "3 days ago" would drift every day and the baseline
 * would be useless by the next week. Every date here is a constant,
 * so the rendered output is identical on every run and on every
 * machine.
 *
 * ⚠️ The month plan still uses the CURRENT month (`isoMonth(0)`) —
 * the Month Plan screen has no month selector, so a stale key would
 * render an empty grid.
 */
export function visualState(): SeedState {
  const state = makeState();
  state.categories = CATEGORIES.map(c => ({ ...c }));
  state.accounts = [
    { id: 'acc-cash', name: 'Cash', type: 'cash', openingBalance: 5000, createdAt: '2026-01-01' },
    { id: 'acc-bank', name: 'Main Bank', type: 'bank', openingBalance: 120000, createdAt: '2026-01-01' },
    { id: 'acc-wallet', name: 'bKash', type: 'mobile_wallet', openingBalance: 2500, createdAt: '2026-01-01' },
    { id: 'acc-card', name: 'Visa Card', type: 'card', openingBalance: 0, createdAt: '2026-01-01' },
    { id: 'acc-other', name: 'Gift Box', type: 'other', openingBalance: 750, createdAt: '2026-01-01' },
  ];

  // Fixed anchor — see the fixture's doc comment.
  const D = '2026-06-15';
  state.transactions = [
    // Plain income — no tag.
    { id: 'tx-salary', type: 'income', amount: 65000, date: D, accountId: 'acc-bank', categoryId: categoryIdByName('Salary'), note: 'Monthly salary' },
    // Plain expense.
    { id: 'tx-shop', type: 'expense', amount: 3200, date: D, accountId: 'acc-cash', categoryId: categoryIdByName('Groceries'), note: 'Weekly shop' },
    // Transfer.
    { id: 'tx-topup', type: 'transfer', amount: 1000, date: D, fromAccountId: 'acc-bank', toAccountId: 'acc-wallet', note: 'Top up wallet' },
    // Debt opening leg, INCOME → "Borrowed".
    { id: 'tx-borrow', type: 'income', amount: 20000, date: D, accountId: 'acc-cash', linkedDebtId: 'debt-1', note: 'Debt: Loan from Rahim' },
    // Debt opening leg, EXPENSE → "Lent".
    { id: 'tx-lent', type: 'expense', amount: 15000, date: D, accountId: 'acc-bank', linkedDebtId: 'debt-3', note: 'Debt: Lent to Karim' },
    // Investment payout → "Payout".
    { id: 'tx-payout', type: 'income', amount: 109000, date: D, accountId: 'acc-bank', linkedInvestmentId: 'inv-1', note: 'DBBL FDR payout' },
  ];

  state.goals = [
    {
      id: 'goal-1',
      name: 'Emergency fund',
      target: 100000,
      saved: 0,
      contributions: [
        { id: 'gc-1', amount: 25000, date: '2026-02-05' },
        { id: 'gc-2', amount: 30000, date: '2026-04-05' },
      ],
      targetDate: '2027-01-01',
      createdAt: '2026-01-01',
    },
  ];

  state.debts = [
    {
      id: 'debt-1',
      name: 'Loan from Rahim',
      direction: 'i_owe',
      total: 20000,
      paidSoFar: 0,
      dueDate: '2026-09-30',
      person: 'Rahim',
      status: 'active',
      kind: 'flat',
      createdAt: '2026-01-01',
    },
    {
      id: 'debt-2',
      name: 'Bike loan',
      direction: 'i_owe',
      total: 60000,
      paidSoFar: 0,
      dueDate: '2029-01-01',
      status: 'active',
      kind: 'loan',
      interestRate: 12,
      termMonths: 36,
      createdAt: '2026-01-01',
    },
    {
      id: 'debt-3',
      name: 'Lent to Karim',
      direction: 'owed_to_me',
      total: 15000,
      paidSoFar: 0,
      dueDate: '2026-08-15',
      person: 'Karim',
      status: 'active',
      kind: 'flat',
      createdAt: '2026-01-01',
    },
  ];

  state.investments = [
    {
      id: 'inv-1',
      name: 'DBBL 1-year FDR',
      type: 'fdr',
      principal: 100000,
      rate: 9,
      startDate: '2026-03-01',
      termMonths: 12,
      payoutAccountId: 'acc-bank',
      institution: 'DBBL',
      status: 'active',
      createdAt: '2026-03-01',
    },
    {
      id: 'inv-2',
      name: 'Monthly DPS',
      type: 'dps',
      principal: 0,
      monthlyContribution: 5000,
      rate: 8,
      startDate: '2026-03-01',
      termMonths: 12,
      payoutAccountId: 'acc-bank',
      institution: 'BRAC',
      status: 'active',
      createdAt: '2026-03-01',
    },
  ];

  state.monthPlans = [
    {
      key: isoMonth(0),
      plannedIncome: 0,
      categories: [
        { id: 'pl-cat-1', emoji: '🛒', name: 'Groceries', budget: 8000, planned: 8000, tone: 'primary' },
        { id: 'pl-cat-2', emoji: '🏠', name: 'Rent', budget: 25000, planned: 25000, tone: 'accent' },
        { id: 'pl-cat-3', emoji: '🚌', name: 'Transport', budget: 3000, planned: 3000, tone: 'info' },
      ],
    },
  ];

  return state;
}

/**
 * The fixture for the Month Plan, built from `test/data/plans.json`.
 *
 * Two items with budgets, so the grid, the count chip, the hub's
 * "budgeted · N items" line and the batch editor all have something
 * to work with.
 *
 * The JSON store is the source of truth for the plan's numbers, so a
 * change to a budget in the data file needs no code change here.
 *
 * ⚠️ The plan's KEY is stamped with the CURRENT month even though the
 * data file does not carry one — the Month Plan screen has no month
 * selector and no rollover, so a stale key would render an empty grid.
 */
export function monthPlanState(): SeedState {
  const state = baseState();
  const plan = plansData.monthPlan;
  const categories = plan.categories as PlanCategoryFixture[];
  state.monthPlans = [
    {
      key: isoMonth(0),
      plannedIncome: plan.plannedIncome,
      categories: categories.map(c => ({ ...c })),
    },
  ];
  return state;
}

/**
 * The fixture for the Event Plan, built from `test/data/plans.json`.
 *
 * One event with two categories — `Hotel` and `Tickets` — each
 * carrying a line item. The `Tickets` item is ticked, so the card's
 * "Paid" figure is non-zero and the progress bar has something to
 * show.
 *
 * The event's own `budget` is 0 on purpose: the app derives the
 * total from `Σ category.budget` (see `summariseEventPlan`), so a
 * non-zero value here would be a stale legacy figure that the app
 * ignores.
 */
export function eventPlanState(): SeedState {
  const state = baseState();
  state.eventPlans = (plansData.eventPlans as EventPlanFixture[]).map(ev => ({
    id: ev.id,
    name: ev.name,
    emoji: ev.emoji,
    eventDate: ev.eventDate,
    budget: ev.budget,
    planned: ev.planned,
    categories: ev.categories.map(c => ({
      id: c.id,
      emoji: c.emoji,
      name: c.name,
      budget: c.budget,
      planned: c.planned,
      tone: c.tone,
      dueDate: c.dueDate,
      items: (c.items ?? []).map(it => ({ ...it })),
    })),
  }));
  return state;
}

/**
 * The Event Plan fixture PLUS a populated ledger.
 *
 * The planners are pure scratch — they never touch the ledger — so a
 * test that asserts "editing the plan left the transactions alone"
 * needs both halves present.
 */
export function eventPlanLedgerState(): SeedState {
  const state = eventPlanState();
  state.transactions = todayTransactions();
  return state;
}

/**
 * The Month Plan fixture PLUS a populated ledger.
 *
 * `monthPlanState()` is built on `baseState()`, which ships **no
 * transactions** — right for the planner's own screens, but it leaves
 * a ledger-isolation case with nothing to compare against. This
 * variant carries the same two plan items alongside the standard six
 * transactions, so a test can assert "the plan grew and the ledger
 * did not".
 */
export function monthPlanLedgerState(): SeedState {
  const state = monthPlanState();
  state.transactions = todayTransactions();
  return state;
}
