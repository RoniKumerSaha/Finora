/**
 * options.ts — the fixed option lists the UI offers.
 *
 * These live here rather than inline in the screens so the test
 * fixtures can be validated against the SAME list the app renders.
 *
 * Why not import the screen module directly? The screens pull in the
 * zustand store, React Router and the icon set — importing one just
 * to read a list of labels drags a React runtime into a plain data
 * contract test. Keeping the lists here makes "the fixture matches
 * what the app shows" a one-line import.
 *
 * Changing a label here changes what the app shows AND what the
 * fixture contract expects — one source of truth, no drift.
 */

/* ---------- Accounts ---------- */

/**
 * The human-readable label for each account type.
 *
 * The Accounts list, the Home preview and the add/edit form picker
 * all render these, so they are defined once here.
 */
export const ACCOUNT_TYPE_LABELS: Readonly<Record<'cash' | 'bank' | 'mobile_wallet' | 'card' | 'other', string>> = {
  cash:          'Cash',
  bank:          'Bank Account',
  mobile_wallet: 'Mobile Wallet',
  card:          'Card',
  other:         'Other',
};

/**
 * The colour tone each account type wears.
 *
 * The Accounts list, the Home preview and the add/edit form picker
 * all render the tone, so it is defined once here alongside the
 * labels.
 */
export const ACCOUNT_TYPE_TONES: Readonly<Record<'cash' | 'bank' | 'mobile_wallet' | 'card' | 'other', 'accent' | 'primary' | 'info' | 'danger' | 'muted'>> = {
  cash:          'accent',
  bank:          'primary',
  mobile_wallet: 'info',
  card:          'danger',
  other:         'muted',
};

/* ---------- Transactions list ---------- */

/** The transaction list's filter keys. */
export type FilterKey =
  | 'all'
  | 'income'
  | 'expense'
  | 'transfer'
  | 'payouts'
  | 'debtPayments'
  | 'thisMonth'
  | 'cash';

/**
 * The transaction list's filter chips, in display order.
 *
 * `payouts` matches a linked investment; `debtPayments` matches a
 * linked debt; `thisMonth` and `cash` are narrow filters that
 * intersect with the type chips.
 */
export const TRANSACTION_FILTERS: ReadonlyArray<{ key: FilterKey; label: string }> = [
  { key: 'all',           label: 'All' },
  { key: 'income',        label: 'Income' },
  { key: 'expense',       label: 'Expense' },
  { key: 'transfer',      label: 'Transfer' },
  { key: 'payouts',       label: 'Payouts' },
  { key: 'debtPayments',  label: 'Debt payments' },
  { key: 'thisMonth',     label: 'This month' },
  { key: 'cash',          label: 'Cash' },
];

/* ---------- Transaction amount ---------- */

/**
 * The preset amount chips on the expense form.
 *
 * The income and transfer forms have no presets — a preset is only
 * offered where a small, common amount is plausible.
 */
export const AMOUNT_PRESETS: ReadonlyArray<number> = [50, 100, 250, 500, 1000];

/* ---------- Investments ---------- */

/** The investment type picker's option labels, by type key. */
export const INVESTMENT_TYPE_LABELS: Readonly<Record<'dps' | 'fdr' | 'savings', string>> = {
  dps: 'DPS (monthly installment)',
  fdr: 'FDR (lump-sum, fixed term)',
  savings: 'Savings (interest-bearing)',
};
