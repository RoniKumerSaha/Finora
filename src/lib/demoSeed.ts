/**
 * demoSeed.ts — populate the store with a realistic Bangladesh-first
 * dataset so the app isn't empty after onboarding.
 *
 * 2026-08-14 expansion: dataset scaled to ~2 years of demo history so
 * every chart on /insights has meaningful data to render. Coverage:
 *   - 10 accounts (cash, bKash, bank × 3, cards × 2, mobile wallets × 2,
 *     investment wallet)
 *   - 6 categories (top-level buckets) — actually we expand to 12 below
 *   - 6 goals (emergency, laptop, vacation, parents' gift, home
 *     renovation, emergency-medical sub-fund)
 *   - 6 debts — 4 i_owe, 2 owed_to_me, varied progress
 *   - 20 investments — DPS × 6, FDR × 8, savings × 6 across 3 statuses
 *   - 130+ transactions across ~24 months including:
 *       * monthly salary + rent (12 cycles)
 *       * monthly groceries, transport, utilities, phone, subscriptions
 *       * quarterly freelance income (4 cycles)
 *       * seasonal: Eid bonuses, vacation, gifts, electronics purchases
 *       * linked debt payments (drives paidSoFar on i_owe debts)
 *       * linked income from Karim drives paidSoFar on owed_to_me debts
 *       * DPS monthly contributions across multiple active DPS accounts
 *       * FDR / savings maturity payouts
 *
 * Linked transactions attach to debts / investments so the derived math
 * (R6/R7/R10) has data to fire. Recompute runs on every load anyway —
 * these dates and amounts only need to be sane enough to look real.
 */
import type { State } from '../domain/types';
import { uid } from '../domain/ids';

function dateOffset(daysFromToday: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromToday);
  return d.toISOString().slice(0, 10);
}

/* ---------- tiny deterministic RNG ----------
 * Mulberry32 — small, fast, seeded so the demo data is identical
 * every reload. Lets us generate ~130 transactions with believable
 * variation without calling out to Math.random (which would make the
 * seed unstable across machines / reloads).
 */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedDemo(state: State): State {
  // ---------- accounts ----------
  const cashId      = uid();
  const bkashId     = uid();
  const bankId      = uid();
  const cardId      = uid();
  const salaryId    = uid();
  const savingsId   = uid();
  const nagadId     = uid();
  const rocketId    = uid();
  const usdCardId   = uid();
  const investWalId = uid();

  const accounts = [
    { id: cashId,      name: 'Cash wallet',         type: 'cash' as const,         openingBalance: 4500,   createdAt: dateOffset(-720) },
    { id: bkashId,     name: 'bKash',               type: 'mobile_wallet' as const, openingBalance: 12500,  createdAt: dateOffset(-720) },
    { id: bankId,      name: 'DBBL Bank',           type: 'bank' as const,         openingBalance: 85000,  createdAt: dateOffset(-720) },
    { id: cardId,      name: 'EBL Credit Card',     type: 'card' as const,         openingBalance: 0,      createdAt: dateOffset(-540) },
    { id: salaryId,    name: 'BRAC Salary Account', type: 'bank' as const,         openingBalance: 0,      createdAt: dateOffset(-720) },
    { id: savingsId,   name: 'DBBL Savings',        type: 'bank' as const,         openingBalance: 25000,  createdAt: dateOffset(-700) },
    { id: nagadId,     name: 'Nagad',               type: 'mobile_wallet' as const, openingBalance: 3200,   createdAt: dateOffset(-600) },
    { id: rocketId,    name: 'Rocket',              type: 'mobile_wallet' as const, openingBalance: 1500,   createdAt: dateOffset(-500) },
    { id: usdCardId,   name: 'Dual-currency Card',  type: 'card' as const,         openingBalance: 0,      createdAt: dateOffset(-360) },
    { id: investWalId, name: 'Investment Wallet',   type: 'cash' as const,         openingBalance: 8000,   createdAt: dateOffset(-660) },
  ];

  // ---------- categories ----------
  // Seed categories mirror DEFAULT_EXPENSE_CATEGORIES /
  // DEFAULT_INCOME_CATEGORIES from persistence.ts. Adding a default
  // there means adding it here too — otherwise seeded data points at
  // phantom ids the picker can never resolve. Demo seed only uses a
  // subset below (the ones referenced by transactions); the rest
  // surface through mergeDefaults() on every load.
  const catSalary    = uid();
  const catFreelance = uid();
  const catBusiness  = uid();
  const catGift      = uid();
  const catIncomeOth = uid();
  const catRent      = uid();
  const catFood      = uid();
  const catTransport = uid();
  const catUtilities = uid();
  const catShopping  = uid();
  const catGifts     = uid();
  const catPhone     = uid();
  const catHealth    = uid();
  const catEdu       = uid();
  const catTravel    = uid();

  const categories = [
    { id: catSalary,    type: 'income'  as const, name: 'Salary' },
    { id: catFreelance, type: 'income'  as const, name: 'Freelance' },
    { id: catBusiness,  type: 'income'  as const, name: 'Business' },
    { id: catGift,      type: 'income'  as const, name: 'Gift' },
    { id: catIncomeOth, type: 'income'  as const, name: 'Other Income' },
    { id: catRent,      type: 'expense' as const, name: 'Rent' },
    { id: catFood,      type: 'expense' as const, name: 'Food & Dining' },
    { id: catTransport, type: 'expense' as const, name: 'Transport' },
    { id: catUtilities, type: 'expense' as const, name: 'Utilities' },
    { id: catShopping,  type: 'expense' as const, name: 'Shopping' },
    { id: catGifts,     type: 'expense' as const, name: 'Gifts & Family' },
    { id: catPhone,     type: 'expense' as const, name: 'Phone & Internet' },
    { id: catHealth,    type: 'expense' as const, name: 'Health' },
    { id: catEdu,       type: 'expense' as const, name: 'Education' },
    { id: catTravel,    type: 'expense' as const, name: 'Travel' },
  ];

  // ---------- goals ----------
  const goalEmergencyId  = uid();
  const goalLaptopId     = uid();
  const goalVacationId   = uid();
  const goalParentsId    = uid();
  const goalHomeId       = uid();
  const goalMedId        = uid();

  const goals = [
    // `saved` values reflect progress a long-running user might have
    // (Emergency: 6 × 15000 = 90000, etc.) so the demo doesn't look
    // entirely flat. Goals are plan-only — these don't touch accounts.
    { id: goalEmergencyId,  name: 'Emergency fund (6 months)', target: 300000, saved: 90000,  contributions: [], targetDate: dateOffset(365),  createdAt: dateOffset(-700) },
    { id: goalLaptopId,     name: 'New laptop',                target: 120000, saved: 48000,  contributions: [], targetDate: dateOffset(180),  createdAt: dateOffset(-540) },
    { id: goalVacationId,   name: 'Cox\u2019s Bazar trip',     target: 40000,  saved: 24000,  contributions: [], targetDate: dateOffset(60),   createdAt: dateOffset(-480) },
    { id: goalParentsId,    name: 'Parents\u2019 anniversary gift', target: 25000, saved: 10000,  contributions: [], targetDate: dateOffset(45),  createdAt: dateOffset(-300) },
    { id: goalHomeId,       name: 'Home renovation',           target: 500000, saved: 25000,  contributions: [], targetDate: dateOffset(900),  createdAt: dateOffset(-200) },
    { id: goalMedId,        name: 'Medical buffer',            target: 80000,  saved: 5000,   contributions: [], targetDate: dateOffset(220),  createdAt: dateOffset(-150) },
  ];

  // ---------- debts ----------
  const debtRahimId   = uid();
  const debtKarimId   = uid();
  const debtAuntieId  = uid();
  const debtSisterId  = uid();
  const debtNadiaId   = uid();
  const debtBhaiId    = uid();

  const debts = [
    { id: debtRahimId,  name: 'Loan from Rahim',     direction: 'i_owe' as const,      total: 50000, paidSoFar: 0, status: 'active' as const, dueDate: dateOffset(90),  person: 'Rahim (cousin)',   createdAt: dateOffset(-540) },
    { id: debtKarimId,  name: 'Advance to Karim',    direction: 'owed_to_me' as const, total: 25000, paidSoFar: 0, status: 'active' as const, dueDate: dateOffset(30),  person: 'Karim (friend)',   createdAt: dateOffset(-420) },
    { id: debtAuntieId, name: 'Bike loan',           direction: 'i_owe' as const,      total: 80000, paidSoFar: 0, status: 'active' as const, dueDate: dateOffset(180), person: 'Auntie',           createdAt: dateOffset(-360) },
    { id: debtSisterId, name: 'Sister (UK)',          direction: 'i_owe' as const,      total: 60000, paidSoFar: 0, status: 'active' as const, dueDate: dateOffset(240), person: 'Sister — wedding fund',  createdAt: dateOffset(-300) },
    { id: debtNadiaId,  name: 'Nadia (roommate)',     direction: 'owed_to_me' as const, total: 18000, paidSoFar: 0, status: 'active' as const, dueDate: dateOffset(20),  person: 'Nadia',            createdAt: dateOffset(-240) },
    { id: debtBhaiId,   name: 'Brother (Raihan)',     direction: 'i_owe' as const,      total: 35000, paidSoFar: 0, status: 'active' as const, dueDate: dateOffset(150), person: 'Raihan (brother)',  createdAt: dateOffset(-200) },
  ];

  // ---------- investments ----------
  // 20 total: 6 active DPS + 6 active FDR + 3 active savings + 3 matured/closed + 2 old.
  const dps1Id     = uid(); // active, almost done
  const dps2Id     = uid(); // active, mid-term
  const dps3Id     = uid(); // active, just started
  const dps4Id     = uid(); // active, large
  const dps5Id     = uid(); // active, near end
  const dps6Id     = uid(); // active, small early
  const dpsClosedId= uid(); // closed (fully paid out)

  const fdr1Id     = uid(); // active, mid-term
  const fdr2Id     = uid(); // active, near maturity
  const fdr3Id     = uid(); // active, just started
  const fdr4Id     = uid(); // active, large
  const fdr5Id     = uid(); // active, mid
  const fdr6Id     = uid(); // active, short-term high-yield
  const fdrMaturedId = uid(); // matured (payout)

  const sav1Id     = uid(); // active, mid
  const sav2Id     = uid(); // active, near maturity
  const sav3Id     = uid(); // active, long-term
  const savMatured1Id = uid(); // already matured (paid out)
  const savMatured2Id = uid(); // already matured (paid out)
  const savRolledId  = uid(); // rolled over

  const investments = [
    /* ---------- DPS ---------- */
    { id: dps1Id,  name: 'DBBL DPS #1',     type: 'dps' as const, principal: 0,         monthlyContribution: 5000, rate: 8,   startDate: dateOffset(-540), termMonths: 60, payoutAccountId: bankId,      institution: 'DBBL',     status: 'active' as const, createdAt: dateOffset(-540) },
    { id: dps2Id,  name: 'EBL DPS Saver',   type: 'dps' as const, principal: 0,         monthlyContribution: 3000, rate: 7.5, startDate: dateOffset(-300), termMonths: 36, payoutAccountId: salaryId,    institution: 'EBL',      status: 'active' as const, createdAt: dateOffset(-300) },
    { id: dps3Id,  name: 'BRAC DPS Plus',   type: 'dps' as const, principal: 0,         monthlyContribution: 4000, rate: 8.2, startDate: dateOffset(-90),  termMonths: 60, payoutAccountId: savingsId,   institution: 'BRAC',     status: 'active' as const, createdAt: dateOffset(-90) },
    { id: dps4Id,  name: 'DBBL DPS Jumbo',  type: 'dps' as const, principal: 0,         monthlyContribution: 10000,rate: 8.5, startDate: dateOffset(-660), termMonths: 120,payoutAccountId: savingsId,   institution: 'DBBL',     status: 'active' as const, createdAt: dateOffset(-660) },
    { id: dps5Id,  name: 'EBL DPS Long',    type: 'dps' as const, principal: 0,         monthlyContribution: 6000, rate: 8.0, startDate: dateOffset(-480), termMonths: 48, payoutAccountId: bankId,      institution: 'EBL',      status: 'active' as const, createdAt: dateOffset(-480) },
    { id: dps6Id,  name: 'City Bank Micro', type: 'dps' as const, principal: 0,         monthlyContribution: 2000, rate: 7.0, startDate: dateOffset(-60),  termMonths: 36, payoutAccountId: bkashId,     institution: 'City Bank',status: 'active' as const, createdAt: dateOffset(-60) },
    { id: dpsClosedId, name: 'DBBL DPS Closed', type: 'dps' as const, principal: 0,    monthlyContribution: 3000, rate: 7.5, startDate: dateOffset(-900), termMonths: 36, payoutAccountId: bankId,      institution: 'DBBL',     status: 'closed' as const,  createdAt: dateOffset(-900) },

    /* ---------- FDR ---------- */
    { id: fdr1Id,  name: 'EBL FDR 1-year',     type: 'fdr' as const, principal: 200000,  rate: 9.5, startDate: dateOffset(-180), termMonths: 12, payoutAccountId: bankId,    institution: 'EBL',         status: 'active' as const, createdAt: dateOffset(-180) },
    { id: fdr2Id,  name: 'DBBL FDR 6mo',       type: 'fdr' as const, principal: 80000,   rate: 8.5, startDate: dateOffset(-90),  termMonths: 6,  payoutAccountId: savingsId, institution: 'DBBL',        status: 'active' as const, createdAt: dateOffset(-90) },
    { id: fdr3Id,  name: 'BRAC FDR Fresh',     type: 'fdr' as const, principal: 50000,   rate: 9.0, startDate: dateOffset(-30),  termMonths: 12, payoutAccountId: bankId,    institution: 'BRAC',        status: 'active' as const, createdAt: dateOffset(-30) },
    { id: fdr4Id,  name: 'EBL FDR Long',       type: 'fdr' as const, principal: 300000,  rate: 10.0,startDate: dateOffset(-270), termMonths: 24, payoutAccountId: savingsId, institution: 'EBL',         status: 'active' as const, createdAt: dateOffset(-270) },
    { id: fdr5Id,  name: 'City FDR Mid',       type: 'fdr' as const, principal: 150000,  rate: 9.2, startDate: dateOffset(-150), termMonths: 12, payoutAccountId: bankId,    institution: 'City Bank',   status: 'active' as const, createdAt: dateOffset(-150) },
    { id: fdr6Id,  name: 'DBBL FDR Special',   type: 'fdr' as const, principal: 100000,  rate: 9.8, startDate: dateOffset(-60),  termMonths: 6,  payoutAccountId: savingsId, institution: 'DBBL',        status: 'active' as const, createdAt: dateOffset(-60) },
    { id: fdrMaturedId, name: 'BRAC FDR Matured', type: 'fdr' as const, principal: 120000, rate: 9.0, startDate: dateOffset(-700), termMonths: 12, payoutAccountId: bankId, institution: 'BRAC',        status: 'matured' as const, createdAt: dateOffset(-700) },

    /* ---------- savings ---------- */
    { id: sav1Id,  name: 'DBBL Savings Plus',  type: 'savings' as const, principal: 60000,  rate: 7.0, startDate: dateOffset(-220), termMonths: 12, payoutAccountId: savingsId, institution: 'DBBL',     status: 'active' as const, createdAt: dateOffset(-220) },
    { id: sav2Id,  name: 'EBL Double Saver',   type: 'savings' as const, principal: 40000,  rate: 6.5, startDate: dateOffset(-200), termMonths: 8,  payoutAccountId: savingsId, institution: 'EBL',      status: 'active' as const, createdAt: dateOffset(-200) },
    { id: sav3Id,  name: 'BRAC Long Saver',    type: 'savings' as const, principal: 100000, rate: 7.5, startDate: dateOffset(-540), termMonths: 24, payoutAccountId: savingsId, institution: 'BRAC',     status: 'active' as const, createdAt: dateOffset(-540) },
    { id: savMatured1Id, name: 'BRAC Savings Matured 1', type: 'savings' as const, principal: 100000, rate: 7.0, startDate: dateOffset(-400), termMonths: 12, payoutAccountId: bankId, institution: 'BRAC Bank', status: 'matured' as const, createdAt: dateOffset(-400) },
    { id: savMatured2Id, name: 'DBBL Savings Matured 2',  type: 'savings' as const, principal: 50000,  rate: 6.5, startDate: dateOffset(-640), termMonths: 12, payoutAccountId: bankId, institution: 'DBBL',       status: 'matured' as const, createdAt: dateOffset(-640) },
    { id: savRolledId, name: 'EBL Rolled Saver', type: 'savings' as const, principal: 75000,  rate: 7.2, startDate: dateOffset(-840), termMonths: 12, payoutAccountId: savingsId, institution: 'EBL',     status: 'rolled_over' as const, createdAt: dateOffset(-840) },
  ];

  // ---------- transactions ----------
  // Hand-written "anchor" transactions + auto-generated recurring ones.
  const transactions: State['transactions'] = [];

  const pushTx = (t: State['transactions'][number]) => { transactions.push(t); };
  const rand = rng(20260814);

  /* ---- Auto-generated 24 months of recurring flows ----
   * Salary (income) on the 1st of every month → salaryId
   * Rent (expense) on the 5th of every month   → bankId
   * Groceries (expense, 2x per month)          → bkashId
   * Transport (expense, 4x per month)          → cashId
   * Utilities (expense, mid-month)             → bkashId
   * Phone/internet (expense, monthly)          → bkashId
   * Quarterly freelance income                 → varies
   * Random small shopping                      → varies
   */
  const today = new Date();
  for (let monthsAgo = 24; monthsAgo >= 0; monthsAgo--) {
    const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - monthsAgo, 1));
    const y = monthStart.getUTCFullYear();
    const m = monthStart.getUTCMonth() + 1;

    // Salary — every month, slight variation (60k base)
    pushTx({
      id: uid(), type: 'income', amount: Math.round(60000 + (rand() - 0.5) * 2000),
      date: dateForMonthDay(y, m, 1), accountId: salaryId, categoryId: catSalary,
      note: `Salary — ${monthShort(m)} ${y}`,
    });

    // Quarterly freelance boost (every 3rd month)
    if (monthsAgo % 3 === 0) {
      pushTx({
        id: uid(), type: 'income', amount: Math.round(8000 + rand() * 6000),
        date: dateForMonthDay(y, m, 12), accountId: bkashId, categoryId: catFreelance,
        note: `Freelance project — ${monthShort(m)}`,
      });
    }

    // Rent — every month on the 5th
    pushTx({
      id: uid(), type: 'expense', amount: 18000,
      date: dateForMonthDay(y, m, 5), accountId: bankId, categoryId: catRent,
      note: `Rent — ${monthShort(m)}`,
    });

    // Phone/internet — every month
    pushTx({
      id: uid(), type: 'expense', amount: 1500 + Math.round(rand() * 500),
      date: dateForMonthDay(y, m, 18), accountId: bkashId, categoryId: catPhone,
      note: `Internet / phone — ${monthShort(m)}`,
    });

    // Utilities — every month (electricity has small variation, gas fixed)
    pushTx({
      id: uid(), type: 'expense', amount: Math.round(1800 + rand() * 1200),
      date: dateForMonthDay(y, m, 14), accountId: bkashId, categoryId: catUtilities,
      note: `Electricity — ${monthShort(m)}`,
    });
    pushTx({
      id: uid(), type: 'expense', amount: 850,
      date: dateForMonthDay(y, m, 8), accountId: bkashId, categoryId: catUtilities,
      note: `Gas — ${monthShort(m)}`,
    });

    // Groceries — twice per month
    pushTx({
      id: uid(), type: 'expense', amount: Math.round(3500 + rand() * 1500),
      date: dateForMonthDay(y, m, 10), accountId: bkashId, categoryId: catFood,
      note: `Groceries — early ${monthShort(m)}`,
    });
    pushTx({
      id: uid(), type: 'expense', amount: Math.round(4000 + rand() * 2000),
      date: dateForMonthDay(y, m, 22), accountId: bkashId, categoryId: catFood,
      note: `Groceries — late ${monthShort(m)}`,
    });

    // Transport — 4x per month
    for (let w = 0; w < 4; w++) {
      pushTx({
        id: uid(), type: 'expense', amount: Math.round(800 + rand() * 1500),
        date: dateForMonthDay(y, m, 3 + w * 7), accountId: cashId, categoryId: catTransport,
        note: `Transport — week ${w + 1} ${monthShort(m)}`,
      });
    }

    // Random small shopping — ~50% of months
    if (rand() > 0.5) {
      pushTx({
        id: uid(), type: 'expense', amount: Math.round(1200 + rand() * 3000),
        date: dateForMonthDay(y, m, 16 + Math.floor(rand() * 8)),
        accountId: cardId, categoryId: catShopping,
        note: `Small shopping — ${monthShort(m)}`,
      });
    }
  }

  // Seasonal: Eid bonus 2 years ago, last year, and this year
  pushTx({
    id: uid(), type: 'income', amount: 30000, date: dateOffset(-700),
    accountId: salaryId, categoryId: catGift, note: 'Eid-ul-Fitr bonus',
  });
  pushTx({
    id: uid(), type: 'income', amount: 35000, date: dateOffset(-330),
    accountId: salaryId, categoryId: catGift, note: 'Eid-ul-Fitr bonus',
  });

  // Side-business income — sold a few items, occasional. Tagged "Business".
  pushTx({
    id: uid(), type: 'income', amount: 12000, date: dateOffset(-260),
    accountId: bkashId, categoryId: catBusiness, note: 'Sold old books / stationery',
  });
  pushTx({
    id: uid(), type: 'income', amount: 18000, date: dateOffset(-410),
    accountId: bkashId, categoryId: catBusiness, note: 'Sold old phone',
  });
  pushTx({
    id: uid(), type: 'income', amount: 9500, date: dateOffset(-485),
    accountId: nagadId, categoryId: catBusiness, note: 'Sold furniture',
  });

  // Wedding gifts received — modest amount
  pushTx({
    id: uid(), type: 'income', amount: 8000, date: dateOffset(-160),
    accountId: bkashId, categoryId: catGift, note: 'Wedding gift (cousin)',
  });
  pushTx({
    id: uid(), type: 'income', amount: 5000, date: dateOffset(-360),
    accountId: bkashId, categoryId: catGift, note: 'Aqiqah gift (neighbour)',
  });

  // Late refund — falls under "Other Income"
  pushTx({
    id: uid(), type: 'income', amount: 3500, date: dateOffset(-110),
    accountId: bankId, categoryId: catIncomeOth, note: 'Tax refund',
  });
  pushTx({
    id: uid(), type: 'income', amount: 2200, date: dateOffset(-220),
    accountId: bankId, categoryId: catIncomeOth, note: 'Bank interest adjustment',
  });

  // Vacation expense 18 months ago
  pushTx({
    id: uid(), type: 'expense', amount: 22000, date: dateOffset(-540),
    accountId: cardId, categoryId: catTravel, note: 'Sundarbans trip — booking',
  });
  pushTx({
    id: uid(), type: 'expense', amount: 8500, date: dateOffset(-535),
    accountId: cashId, categoryId: catTravel, note: 'Sundarbans — on-the-road',
  });

  // Big electronics purchase last year
  pushTx({
    id: uid(), type: 'expense', amount: 65000, date: dateOffset(-200),
    accountId: cardId, categoryId: catShopping, note: 'New phone',
  });

  // Medical bills
  pushTx({
    id: uid(), type: 'expense', amount: 6500, date: dateOffset(-150),
    accountId: bkashId, categoryId: catHealth, note: 'Pharmacy + checkup',
  });
  pushTx({
    id: uid(), type: 'expense', amount: 12000, date: dateOffset(-65),
    accountId: savingsId, categoryId: catHealth, note: 'Dental work',
  });

  // Education — a course
  pushTx({
    id: uid(), type: 'expense', amount: 15000, date: dateOffset(-280),
    accountId: cardId, categoryId: catEdu, note: 'Online course — design',
  });

  /* ---- Debt payments (drives R7 paidSoFar math) ---- */
  // Rahim — partial payments, recent + older
  pushTx({ id: uid(), type: 'expense', amount: 10000, date: dateOffset(-3),  accountId: cashId,    categoryId: catGifts, linkedDebtId: debtRahimId,   note: 'Partial payment — Rahim' });
  pushTx({ id: uid(), type: 'expense', amount: 5000,  date: dateOffset(-32), accountId: cashId,    categoryId: catGifts, linkedDebtId: debtRahimId,   note: 'Partial payment — Rahim' });
  pushTx({ id: uid(), type: 'expense', amount: 8000,  date: dateOffset(-180),accountId: bkashId,   categoryId: catGifts, linkedDebtId: debtRahimId,   note: 'Partial payment — Rahim' });

  // Auntie — bike loan installments
  pushTx({ id: uid(), type: 'expense', amount: 8000,  date: dateOffset(-7),  accountId: cashId,    categoryId: catGifts, linkedDebtId: debtAuntieId,  note: 'Bike loan installment' });
  pushTx({ id: uid(), type: 'expense', amount: 8000,  date: dateOffset(-37), accountId: cashId,    categoryId: catGifts, linkedDebtId: debtAuntieId,  note: 'Bike loan installment' });
  pushTx({ id: uid(), type: 'expense', amount: 8000,  date: dateOffset(-67), accountId: cashId,    categoryId: catGifts, linkedDebtId: debtAuntieId,  note: 'Bike loan installment' });

  // Sister — wedding fund contributions
  pushTx({ id: uid(), type: 'expense', amount: 5000,  date: dateOffset(-100),accountId: bkashId,   categoryId: catGifts, linkedDebtId: debtSisterId,  note: 'Sister — wedding fund' });
  pushTx({ id: uid(), type: 'expense', amount: 7000,  date: dateOffset(-45), accountId: bankId,    categoryId: catGifts, linkedDebtId: debtSisterId,  note: 'Sister — wedding fund' });

  // Brother (Raihan) — partial payment
  pushTx({ id: uid(), type: 'expense', amount: 5000,  date: dateOffset(-80), accountId: bkashId,   categoryId: catGifts, linkedDebtId: debtBhaiId,    note: 'Brother — partial' });

  // Karim — pays us back partially (owed_to_me direction)
  pushTx({ id: uid(), type: 'income',  amount: 8000,  date: dateOffset(-20), accountId: bkashId,   categoryId: catIncomeOth, linkedDebtId: debtKarimId,   note: 'Karim — partial payback' });
  pushTx({ id: uid(), type: 'income',  amount: 5000,  date: dateOffset(-95), accountId: bkashId,   categoryId: catIncomeOth, linkedDebtId: debtKarimId,   note: 'Karim — partial payback' });

  // Nadia — pays back partially (owed_to_me direction)
  pushTx({ id: uid(), type: 'income',  amount: 6000,  date: dateOffset(-50), accountId: bkashId,   categoryId: catIncomeOth, linkedDebtId: debtNadiaId,   note: 'Nadia — partial payback' });

  /* ---- Investment payouts (income transactions linked to matured investments) ---- */
  pushTx({ id: uid(), type: 'income',  amount: 107000, date: dateOffset(-2), accountId: bankId,    categoryId: catIncomeOth, linkedInvestmentId: savMatured1Id, note: 'BRAC Savings Plus — maturity payout' });
  pushTx({ id: uid(), type: 'income',  amount: 56300,  date: dateOffset(-310),accountId: bankId,   categoryId: catIncomeOth, linkedInvestmentId: savMatured2Id, note: 'DBBL Savings — maturity payout' });
  pushTx({ id: uid(), type: 'income',  amount: 130800, date: dateOffset(-450),accountId: bankId,   categoryId: catIncomeOth, linkedInvestmentId: fdrMaturedId,   note: 'BRAC FDR — maturity payout' });

  /* ---- Transfers (a few to make transfer rules visible) ---- */
  pushTx({ id: uid(), type: 'transfer', amount: 5000,  date: dateOffset(-4),   fromAccountId: bankId,    toAccountId: cashId,    note: 'ATM withdrawal' });
  pushTx({ id: uid(), type: 'transfer', amount: 3000,  date: dateOffset(-1),   fromAccountId: bkashId,   toAccountId: cashId,    note: 'Cash out for groceries' });
  pushTx({ id: uid(), type: 'transfer', amount: 10000, date: dateOffset(-130), fromAccountId: salaryId,  toAccountId: savingsId, note: 'Monthly savings sweep' });
  pushTx({ id: uid(), type: 'transfer', amount: 7500,  date: dateOffset(-220), fromAccountId: bankId,    toAccountId: nagadId,   note: 'Pay a vendor via Nagad' });
  pushTx({ id: uid(), type: 'transfer', amount: 4000,  date: dateOffset(-65),  fromAccountId: bkashId,   toAccountId: rocketId,  note: 'Send to family via Rocket' });

  /* ---- DPS monthly contributions (R6 / dpsContributedSoFar) ----
   * dps1 (DBBL DPS #1, 18 months so far @ 5000)        → 18 × 5000 = 90,000
   * dps2 (EBL DPS Saver, 10 months so far @ 3000)      → 10 × 3000 = 30,000
   * dps3 (BRAC DPS Plus, 3 months so far @ 4000)       →  3 × 4000 = 12,000
   * dps4 (DBBL DPS Jumbo, 22 months so far @ 10000)    → 22 × 10000 = 220,000
   * dps5 (EBL DPS Long, 16 months so far @ 6000)       → 16 × 6000 = 96,000
   * dps6 (City Bank Micro, 2 months so far @ 2000)     →  2 × 2000 = 4,000
   * Total DPS contributed: ~452,000 across 6 active DPS accounts.
   */
  pushDpsContribs(bankId, dps1Id,    5000,  18, pushTx);
  pushDpsContribs(bankId, dps2Id,    3000,  10, pushTx);
  pushDpsContribs(bankId, dps3Id,    4000,   3, pushTx);
  pushDpsContribs(bankId, dps4Id,   10000,  22, pushTx);
  pushDpsContribs(bankId, dps5Id,    6000,  16, pushTx);
  pushDpsContribs(bankId, dps6Id,    2000,   2, pushTx);
  // Closed DPS — full history (would have been 36 monthly contributions)
  pushDpsContribs(bankId, dpsClosedId, 3000, 36, pushTx);

  // Goals are plan-only scratchpads — no transactions are seeded for
  // them. The `saved` values on the goal entities above are the
  // source of truth for demo progress.

  return {
    ...state,
    accounts,
    categories,
    transactions,
    goals,
    debts,
    investments,
    // Plans stay as the user had them — `Load demo data` should not
    // touch the planner. The plans are personal scratchpads.
    monthPlans: state.monthPlans,
    eventPlans: state.eventPlans,
    settings: { ...state.settings, onboardingComplete: true },
  };
}

/* ---------- small date helpers (local to demoSeed) ---------- */

function dateForMonthDay(year: number, month1based: number, day: number): string {
  // Clamp day to last day of month so e.g. Jan 31 + 1mo = Feb 28 not Mar 3.
  const lastDay = new Date(Date.UTC(year, month1based, 0)).getUTCDate();
  const d = Math.min(day, lastDay);
  return new Date(Date.UTC(year, month1based - 1, d)).toISOString().slice(0, 10);
}

function monthShort(m1based: number): string {
  return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m1based - 1];
}

/**
 * Push `count` monthly DPS contributions of `amount` ৳ ending at "today"
 * (i.e. the most recent contribution is for the current month). Each
 * contribution is an `expense` transaction linked to the given
 * investment so `dpsContributedSoFar` accumulates across months.
 */
function pushDpsContribs(
  accountId: string,
  investmentId: string,
  amount: number,
  count: number,
  push: (t: State['transactions'][number]) => void
): void {
  // Walk backwards `count` months from today; for each month place the
  // contribution around the 25th so it doesn't collide with salary
  // (1st) and rent (5th).
  const start = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const m = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - i, 25));
    push({
      id: uid(),
      type: 'expense',
      amount,
      date: m.toISOString().slice(0, 10),
      accountId,
      linkedInvestmentId: investmentId,
      note: `DPS installment #${count - i}`,
    });
  }
}
