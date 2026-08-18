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
 *   1. linkedInvestmentId  → "Payout"        (accent)
 *   2. linkedDebtId        → direction-aware:
 *      - expense (i_owe, paying down)         → "Debt payment" (primary)
 *      - income  (owed_to_me, being paid)     → "Debt received" (info)
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

export type TagKind = 'payout' | 'debt-out' | 'debt';

interface Props {
  tx: Pick<Transaction, 'linkedInvestmentId' | 'linkedDebtId' | 'type'>;
}

/**
 * Pure derivation — kept exported so callers (e.g. analytics, search)
 * can reuse the same precedence logic without re-implementing it.
 */
export function deriveTag(tx: Props['tx']): TagKind | null {
  if (tx.linkedInvestmentId) return 'payout';
  if (tx.linkedDebtId) {
    // Direction can't be inferred from the tx alone (it just holds
    // linkedDebtId), so the caller needs to pass the resolved debt
    // direction. The component below accepts an optional `direction`
    // override. When no override is supplied, fall back to a generic
    // "debt" tag (info tone) — still useful, just less specific.
    return 'debt';
  }
  return null;
}

const TAG_STYLES: Record<TagKind, { label: string; className: string }> = {
  'payout':   { label: 'Payout',         className: 'bg-accent-soft text-accent' },
  'debt-out': { label: 'Debt payment',   className: 'bg-primary-soft text-primary' },
  'debt':     { label: 'Debt received',  className: 'bg-info-soft text-info' },
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
  return (
    <span
      className={`inline-flex items-center px-1.5 py-[1px] rounded-pill text-[9.5px] font-bold uppercase tracking-[0.06em] leading-[1.5] ${style.className}`}
      aria-label={`category: ${style.label.toLowerCase()}`}
    >
      {style.label}
    </span>
  );
}