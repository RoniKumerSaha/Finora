/**
 * schemas.ts — zod schemas for Finora V1 forms (AD-19).
 *
 * Each schema mirrors the validation rules in the matching domain module
 * (e.g. transactions.ts requires `amount > 0` and accountId for income/
 * expense). The data layer is the source of truth at the call site; zod
 * exists so forms get inline three-part errors before they ever reach
 * the data layer, and so each form's rules live in one place.
 *
 * Error mapping: see lib/errors.ts — `formatZodError(zodError)` turns the
 * raw issue into `{what, why, fix}` per field.
 */

import { z } from 'zod';

const positive = (n: number) => n > 0;
const nonNegative = (n: number) => n >= 0;

const requiredString = (label: string) =>
  z.string().min(1, { message: `${label} is required.` });

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}/, { message: 'Use a valid date.' });

// ---------- Account ----------

export const accountSchema = z.object({
  name: requiredString('Account name').max(60, { message: 'Name is too long (max 60 characters).' }),
  type: z.enum(['cash', 'bank', 'mobile_wallet', 'card', 'other']),
  openingBalance: z.coerce.number().refine(nonNegative, { message: 'Opening balance cannot be negative.' }),
});
export type AccountInput = z.infer<typeof accountSchema>;

// ---------- Transaction ----------

export const transferTxSchema = z.object({
  type: z.literal('transfer'),
  amount: z.coerce.number().refine(positive, { message: 'Amount must be greater than zero.' }),
  date: isoDate,
  fromAccountId: requiredString('Source account'),
  toAccountId: requiredString('Destination account'),
})
  .refine(d => d.fromAccountId !== d.toAccountId, {
    path: ['toAccountId'],
    message: 'Source and destination must differ.',
  });

export const incomeExpenseTxSchema = z.object({
  type: z.enum(['income', 'expense']),
  amount: z.coerce.number().refine(positive, { message: 'Amount must be greater than zero.' }),
  date: isoDate,
  accountId: requiredString('Account'),
  note: z.string().optional(),
  linkedDebtId: z.string().optional(),
  linkedInvestmentId: z.string().optional(),
});

export const transactionSchema = z.union([transferTxSchema, incomeExpenseTxSchema]);
export type TransactionInput = z.infer<typeof transactionSchema>;

// ---------- Goal ----------

export const goalSchema = z.object({
  name: requiredString('Goal name').max(80),
  target: z.coerce.number().refine(positive, { message: 'Target must be greater than zero.' }),
  // `saved` is required on the form — the user must consciously type
  // 0 or a positive number for how much they've already set aside.
  saved: z.coerce.number().refine(nonNegative, { message: 'Saved cannot be negative.' }),
  targetDate: isoDate.refine(d => d >= new Date().toISOString().slice(0, 10), {
    message: 'Target date must be in the future.',
  }),
});
export type GoalInput = z.infer<typeof goalSchema>;

// ---------- Debt ----------

export const debtSchema = z.object({
  name: requiredString('Debt name'),
  direction: z.enum(['i_owe', 'owed_to_me']),
  total: z.coerce.number().refine(positive, { message: 'Total must be greater than zero.' }),
  person: z.string().optional(),
  dueDate: z.string().optional(),
});
export type DebtInput = z.infer<typeof debtSchema>;

// ---------- Investment ----------

export const investmentSchema = z.object({
  name: requiredString('Investment name'),
  type: z.enum(['dps', 'fdr', 'savings']),
  principal: z.coerce.number().refine(positive, { message: 'Principal must be greater than zero.' }),
  rate: z.coerce.number().refine(r => r >= 0 && r <= 100, {
    message: 'Rate must be between 0 and 100.',
  }),
  startDate: isoDate,
  termMonths: z.coerce.number().refine(positive, { message: 'Term must be a positive number of months.' }),
  termDays: z.coerce.number().refine(positive, { message: 'Term must be a positive number of days.' }).optional(),
  payoutAccountId: z.string().optional(),
  institution: z.string().optional(),
}).refine(
  d => (d.termMonths > 0) !== (d.termDays != null && d.termDays > 0),
  { message: 'Set either term in months OR term in days, not both.', path: ['termDays'] }
);
export type InvestmentInput = z.infer<typeof investmentSchema>;

// ---------- Export / Import envelope ----------

export const STATE_VERSION = 1;
export const exportEnvelopeSchema = z.object({
  version: z.literal(STATE_VERSION),
  exportedAt: z.string(),
  data: z.object({
    version: z.literal(STATE_VERSION),
    accounts: z.array(z.any()),
    transactions: z.array(z.any()),
    goals: z.array(z.any()),
    debts: z.array(z.any()),
    investments: z.array(z.any()),
    categories: z.array(z.any()),
    // Plan scratchpads — added in 2026-08-17 (PRD §9.14 + §9.15).
    // Optional in the schema for forward-compat with older backups;
    // the persistence layer fills them with [] on load.
    monthPlans: z.array(z.any()).optional(),
    eventPlans: z.array(z.any()).optional(),
    // Investment Planner + Loan Calculator scratchpads — added in
    // 2026-08-30 (PRD §9.17). Same forward-compat pattern.
    investmentPlans: z.array(z.any()).optional(),
    loanPlans: z.array(z.any()).optional(),
    settings: z.object({
      theme: z.enum(['dark', 'light', 'auto']),
      onboardingComplete: z.boolean(),
    }),
  }),
});