/**
 * demoSeed.ts — populate the store with a realistic Bangladesh-first
 * dataset so the app isn't empty after onboarding.
 *
 * Coverage:
 *   - 4 accounts (cash, bKash, DBBL bank, EBL card)
 *   - ~20 transactions across current + previous months, including
 *     income, expense, and transfers
 *   - 3 goals (emergency fund, laptop, vacation)
 *   - 2 debts — one you owe (with partial payments), one owed to you
 *   - 3 investments — active DPS, active FDR, one already matured
 *   - 6 categories (food, transport, salary, freelance, gifts, rent)
 *
 * Linked transactions attach to debts so the paidSoFar math fires
 * (R7). Investment payouts attach to the matured one so the linked-income
 * story shows up. Recompute runs on every load anyway — these dates and
 * amounts only need to be sane enough to look real.
 */
import type { State } from '../domain/types';
import { uid } from '../domain/ids';

function dateOffset(daysFromToday: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromToday);
  return d.toISOString().slice(0, 10);
}

export function seedDemo(state: State): State {
  // ---------- accounts ----------
  const cashId    = uid();
  const bkashId   = uid();
  const bankId    = uid();
  const cardId    = uid();

  const accounts = [
    { id: cashId,  name: 'Cash wallet', type: 'cash' as const,         openingBalance: 4500,  createdAt: dateOffset(-180) },
    { id: bkashId, name: 'bKash',       type: 'mobile_wallet' as const, openingBalance: 12500, createdAt: dateOffset(-180) },
    { id: bankId,  name: 'DBBL Bank',   type: 'bank' as const,         openingBalance: 85000, createdAt: dateOffset(-180) },
    { id: cardId,  name: 'EBL Credit Card', type: 'card' as const,    openingBalance: 0,     createdAt: dateOffset(-90)  },
  ];

  // ---------- categories ----------
  const catSalary    = uid();
  const catFreelance = uid();
  const catFood      = uid();
  const catTransport = uid();
  const catRent      = uid();
  const catGifts     = uid();
  const catUtilities = uid();
  const catShopping  = uid();

  const categories = [
    { id: catSalary,    type: 'income'  as const, name: 'Salary' },
    { id: catFreelance, type: 'income'  as const, name: 'Freelance' },
    { id: catFood,      type: 'expense' as const, name: 'Food & Dining' },
    { id: catTransport, type: 'expense' as const, name: 'Transport' },
    { id: catRent,      type: 'expense' as const, name: 'Rent' },
    { id: catGifts,     type: 'expense' as const, name: 'Gifts & Family' },
    { id: catUtilities, type: 'expense' as const, name: 'Utilities' },
    { id: catShopping,  type: 'expense' as const, name: 'Shopping' },
  ];

  // ---------- goals ----------
  const goalEmergencyId = uid();
  const goalLaptopId    = uid();
  const goalVacationId  = uid();

  const goals = [
    { id: goalEmergencyId, name: 'Emergency fund (6 months)', target: 300000, saved: 145000, targetDate: dateOffset(365),  createdAt: dateOffset(-150) },
    { id: goalLaptopId,    name: 'New laptop',                target: 120000, saved: 38000,  targetDate: dateOffset(180),  createdAt: dateOffset(-90)  },
    { id: goalVacationId,  name: 'Cox\u2019s Bazar trip',     target: 40000,  saved: 40000,  targetDate: dateOffset(60),   createdAt: dateOffset(-120) },
  ];

  // ---------- debts ----------
  const debtRahimId   = uid();
  const debtKarimId   = uid();
  const debtAuntieId  = uid();

  const debts = [
    { id: debtRahimId,  name: 'Loan from Rahim',  direction: 'i_owe' as const,      total: 50000, paidSoFar: 0, status: 'active' as const, dueDate: dateOffset(90), person: 'Rahim (cousin)', createdAt: dateOffset(-60) },
    { id: debtKarimId,  name: 'Advance to Karim', direction: 'owed_to_me' as const, total: 25000, paidSoFar: 0, status: 'active' as const, dueDate: dateOffset(30), person: 'Karim (friend)', createdAt: dateOffset(-45) },
    { id: debtAuntieId, name: 'Bike loan',        direction: 'i_owe' as const,      total: 80000, paidSoFar: 0, status: 'active' as const, dueDate: dateOffset(180), person: 'Auntie', createdAt: dateOffset(-30) },
  ];

  // ---------- investments ----------
  const dpsId       = uid();
  const fdrId       = uid();
  const maturedId   = uid();

  const investments = [
    {
      id: dpsId, name: 'DBBL DPS #1', type: 'dps' as const,
      principal: 50000, rate: 8,
      startDate: dateOffset(-540), termMonths: 60,
      payoutAccountId: bankId, institution: 'DBBL',
      status: 'active' as const, createdAt: dateOffset(-540),
    },
    {
      id: fdrId, name: 'EBL FDR 1-year', type: 'fdr' as const,
      principal: 200000, rate: 9.5,
      startDate: dateOffset(-180), termMonths: 12,
      payoutAccountId: bankId, institution: 'EBL',
      status: 'active' as const, createdAt: dateOffset(-180),
    },
    {
      // Already matured — will auto-flip to 'matured' on load via recompute.
      id: maturedId, name: 'BRAC Savings Plus', type: 'savings' as const,
      principal: 100000, rate: 7,
      startDate: dateOffset(-400), termMonths: 12,
      payoutAccountId: bankId, institution: 'BRAC Bank',
      status: 'matured' as const, createdAt: dateOffset(-400),
    },
  ];

  // ---------- transactions ----------
  // Salary on the 1st of this month and last month. Some daily expenses.
  // A few transfers between cash and bKash to show that working.
  const transactions: State['transactions'] = [
    // --- this month ---
    { id: uid(), type: 'income',  amount: 60000, date: dateOffset(-5),  accountId: bankId,  categoryId: catSalary,    note: 'Salary — September' },
    { id: uid(), type: 'income',  amount: 8000,  date: dateOffset(-7),  accountId: bkashId, categoryId: catFreelance, note: 'Logo design for Studio X' },
    { id: uid(), type: 'expense', amount: 18000, date: dateOffset(-3),  accountId: bankId,  categoryId: catRent,      note: 'September rent' },
    { id: uid(), type: 'expense', amount: 4500,  date: dateOffset(-2),  accountId: bkashId, categoryId: catFood,      note: 'Lunch — kacchi' },
    { id: uid(), type: 'expense', amount: 1200,  date: dateOffset(-2),  accountId: cashId,  categoryId: catTransport, note: 'CNG to office' },
    { id: uid(), type: 'expense', amount: 3500,  date: dateOffset(-1),  accountId: bkashId, categoryId: catFood,      note: 'Groceries — Agora' },
    { id: uid(), type: 'expense', amount: 2200,  date: dateOffset(-4),  accountId: bkashId, categoryId: catUtilities, note: 'Internet bill' },
    { id: uid(), type: 'expense', amount: 1500,  date: dateOffset(-6),  accountId: bkashId, categoryId: catFood,      note: 'Coffee + samosa' },

    // --- debt payments (R7 — sums into paidSoFar) ---
    { id: uid(), type: 'expense', amount: 10000, date: dateOffset(-3), accountId: cashId, categoryId: catGifts, linkedDebtId: debtRahimId,  note: 'Partial payment — Rahim' },
    { id: uid(), type: 'expense', amount: 8000,  date: dateOffset(-7), accountId: cashId, categoryId: catGifts, linkedDebtId: debtAuntieId, note: 'Bike loan installment' },

    // --- investment payout (linked to matured investment) ---
    { id: uid(), type: 'income',  amount: 107000, date: dateOffset(-2), accountId: bankId, categoryId: catFreelance, linkedInvestmentId: maturedId, note: 'BRAC Savings Plus — maturity payout' },

    // --- transfers ---
    { id: uid(), type: 'transfer', amount: 5000, date: dateOffset(-4), fromAccountId: bankId, toAccountId: cashId, note: 'ATM withdrawal' },
    { id: uid(), type: 'transfer', amount: 3000, date: dateOffset(-1), fromAccountId: bkashId, toAccountId: cashId, note: 'Cash out for groceries' },

    // --- last month ---
    { id: uid(), type: 'income',  amount: 60000, date: dateOffset(-35), accountId: bankId,  categoryId: catSalary, note: 'Salary — August' },
    { id: uid(), type: 'income',  amount: 5000,  date: dateOffset(-28), accountId: bkashId, categoryId: catFreelance, note: 'WordPress fix' },
    { id: uid(), type: 'expense', amount: 18000, date: dateOffset(-33), accountId: bankId,  categoryId: catRent,    note: 'August rent' },
    { id: uid(), type: 'expense', amount: 6500,  date: dateOffset(-30), accountId: bkashId, categoryId: catFood,    note: 'Iftar groceries' },
    { id: uid(), type: 'expense', amount: 2500,  date: dateOffset(-29), accountId: bkashId, categoryId: catShopping, note: 'Books from Nilkhet' },
    { id: uid(), type: 'expense', amount: 1800,  date: dateOffset(-25), accountId: cashId,  categoryId: catTransport, note: 'Rickshaw' },

    // debt payment last month too — drives paidSoFar on Rahim
    { id: uid(), type: 'expense', amount: 5000, date: dateOffset(-32), accountId: cashId, categoryId: catGifts, linkedDebtId: debtRahimId, note: 'Partial payment — Rahim' },

    // Karim pays us back partially — drove by direction='owed_to_me'
    { id: uid(), type: 'income', amount: 8000, date: dateOffset(-20), accountId: bkashId, categoryId: catGifts, linkedDebtId: debtKarimId, note: 'Karim — partial payback' },
  ];

  return {
    ...state,
    accounts,
    categories,
    transactions,
    goals,
    debts,
    investments,
    settings: { ...state.settings, onboardingComplete: true },
  };
}