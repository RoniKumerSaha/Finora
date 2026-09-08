/**
 * TransactionTag — pill tag that classifies a transaction.
 *
 * Tags surface typed semantics that were previously plain text in the
 * subtitle ("DBBL Bank · payout", "Cash wallet · debt payment"). They
 * make the row scannable at a glance and match the chip vocabulary
 * already used elsewhere (Active status, percent chips).
 *
 * Tag derivation (precedence matters — only one tag per row, since
 * the data model allows at most one link per transaction):
 *
 *   1. linkedInvestmentId              → "Payout"            (accent outline)
 *   2. linkedDebtId + opening note     → direction of the tx:
 *        - income  (cash into account)  → "Borrowed"          (primary outline)
 *        - expense (cash out of account) → "Lent"             (accent  outline)
 *      Detected by `tx.note` starting with "Debt: " — written by
 *      DebtAddScreen when the debt is first created (the opening leg
 *      of the debt's ledger entry). User-written repayment notes are
 *      free-form and don't collide with this prefix.
 *   3. linkedDebtId + repayment        → tx type:
 *        - expense (i_owe, paying down) → "Debt payment"      (primary outline)
 *        - income  (owed_to_me, paid back) → "Debt received"  (info outline)
 *   4. Nothing                         → renders `null`
 *
 * All four debt-related tags share the same outline treatment — 1px
 * tone border, transparent fill, tone-coloured text — so a row of
 * mixed opening + repayment entries reads as one chip family. Only
 * the colour and label differentiate them. (Earlier revisions used
 * soft-fill for the opening leg; reverted to outline for visual
 * consistency.)
 *
 * Tone palette mirrors the app's existing token system. No new
 * tokens are introduced — every color used here is already defined
 * in src/styles/theme.css.
 *
 * Returns `null` when there's nothing to tag (plain income, expense,
 * or transfer without a linked entity). The caller doesn't need to
 * check — `<TransactionTag tx={tx} />` is safe to always render.
 *
 * Goals no longer produce transaction tags — contributions are a
 * plan-only scratchpad and don't touch the ledger.
 */
import type { Transaction } from '../domain/types';

export type TagKind = 'payout' | 'borrowed' | 'lent' | 'debt-out' | 'debt';

/** Prefix written by DebtAddScreen on the opening transaction so the
 *  row can be classified as the cash-event leg of a debt rather
 *  than a repayment. Kept exported so tests / future migrations can
 *  reference the same constant. */
export const DEBT_OPENING_NOTE_PREFIX = 'Debt: ';

interface Props {
  tx: Pick<Transaction, 'linkedInvestmentId' | 'linkedDebtId' | 'type' | 'note'>;
}

/**
 * Pure derivation — kept exported so callers (e.g. analytics, search)
 * can reuse the same precedence logic without re-implementing it.
 */
export function deriveTag(tx: Props['tx']): TagKind | null {
  if (tx.linkedInvestmentId) return 'payout';
  if (tx.linkedDebtId) {
    // Opening leg: written by DebtAddScreen with a "Debt: {name}" note.
    // Direction here is the transaction's own direction (cash movement
    // type), not the debt's polarity — borrowed cash is income into
    // the account; lent cash is expense out of it. This is the same
    // rule the rest of the ledger uses for what an income/expense
    // means, so the tag always agrees with the row's signed amount.
    if (tx.note && tx.note.startsWith(DEBT_OPENING_NOTE_PREFIX)) {
      return tx.type === 'income' ? 'borrowed' : 'lent';
    }
    // Repayment leg: derive from the debt's polarity. The caller
    // supplies `debtDirection` via the component prop below; the bare
    // `deriveTag` (this function) only sees the tx, so without that
    // hint we fall back to the generic "debt" tag (info outline) —
    // still useful, just less specific.
    return 'debt';
  }
  return null;
}

const TAG_STYLES: Record<TagKind, { label: string; className: string }> = {
  // Outline-only treatment — no fill, just a 1px tone border so the
  // tag reads as a label rather than a coloured badge. The text
  // picks up the same tone so legibility stays high in dark mode.
  // All four debt-related tags (Borrowed / Lent / Debt payment /
  // Debt received) share this treatment so a row of repayments plus
  // the opening leg all look like one chip family.
  'payout':   { label: 'Payout',         className: 'border border-accent text-accent' },
  'debt-out': { label: 'Debt payment',   className: 'border border-primary text-primary' },
  'debt':     { label: 'Debt received',  className: 'border border-info text-info' },
  'borrowed': { label: 'Borrowed',       className: 'border border-primary text-primary' },
  'lent':     { label: 'Lent',           className: 'border border-accent text-accent' },
};

interface FullProps extends Props {
  /**
   * Optional override for the debt tag direction. Pass the resolved
   * debt.direction so the tag can distinguish "paying down" (primary)
   * from "being paid back" (info). Omit when not a debt, or when the
   * direction is unknown.
   */
  debtDirection?: 'i_owe' | 'owed_to_me';
}

export function TransactionTag({ tx, debtDirection }: FullProps) {
  let kind = deriveTag(tx);
  if (kind === 'debt' && debtDirection === 'i_owe') {
    kind = 'debt-out';
  }
  if (!kind) return null;

  const style = TAG_STYLES[kind];
  // All tags share the same outline treatment (1px tone border,
  // transparent fill). The 9.5px / tight-padding sizing keeps the
  // row line-height stable when a tag is present.
  return (
    <span
      className={`inline-flex items-center px-1.5 py-[1px] rounded-pill text-[9.5px] font-bold uppercase tracking-[0.06em] leading-[1.5] ${style.className}`}
      aria-label={`category: ${style.label.toLowerCase()}`}
    >
      {style.label}
    </span>
  );
}
