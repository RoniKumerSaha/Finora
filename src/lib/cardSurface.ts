/**
 * Card surface styles — the shared "warm gradient + bg tint" treatment
 * applied to list-card surfaces across the app (Accounts, Debts,
 * Investments, Investment plans, Loan plans).
 *
 * The wash is theme-aware: it uses `var(--bg)` as the mix target so the
 * same percentage renders darker in dark mode (mixes with deep teal)
 * and lighter in light mode (mixes with paper white). Together with the
 * `leftBarClass` colour, every card in the app shares the same visual
 * signature.
 *
 * 2026-08-31 component-consistency: extracted from AccountsListScreen.
 */

import type { CSSProperties } from 'react';
import type { DebtDirection, DebtKind, InvestmentType } from '../domain/types';

export type CardTone = 'primary' | 'danger' | 'accent' | 'warn' | 'success' | 'info' | 'muted';

const TONE_VAR: Record<CardTone, string> = {
  primary: 'var(--primary)',
  danger:  'var(--danger)',
  accent:  'var(--accent)',
  warn:    'var(--warn)',
  success: 'var(--success)',
  info:    'var(--info)',
  muted:   'var(--muted)',
};

const BAR_CLASS: Record<CardTone, string> = {
  primary: 'bg-primary',
  danger:  'bg-danger',
  accent:  'bg-accent',
  warn:    'bg-warn',
  success: 'bg-success',
  info:    'bg-info',
  muted:   'bg-muted',
};

/**
 * Returns a CSSProperties object to apply on a card surface. The result
 * combines:
 *   - a 14%-opaque page-background tint (so the card sits a touch
 *     deeper than the page — gives the wash somewhere to anchor)
 *   - a top-down linear gradient using the tone colour, blended with
 *     `var(--bg)` so the gradient darkens in dark mode and tints
 *     deeper in light mode. Stronger than the previous wash so the
 *     account card carries a clear "this is part of a story" tint
 *     even in light mode.
 *
 * Use as `style={cardSurfaceStyle(tone)}` on any `.card` element.
 */
export function cardSurfaceStyle(tone: CardTone): CSSProperties {
  const toneVar = TONE_VAR[tone];
  return {
    backgroundColor: 'color-mix(in srgb, var(--bg) 14%, transparent)',
    backgroundImage: `linear-gradient(to bottom, color-mix(in srgb, ${toneVar} 10%, var(--bg)) 0%, color-mix(in srgb, ${toneVar} 8%, transparent) 35%, transparent 80%)`,
  };
}

/**
 * Tailwind class for the 3px left accent bar. Apply on a sibling
 * `<span>` positioned absolutely inside the card.
 */
export function leftBarClass(tone: CardTone): string {
  return BAR_CLASS[tone];
}

/**
 * Per-domain tone mapping. The whole app (debt, investment, loan,
 * etc.) routes its existing discriminators through one of these so
 * every card carries the same color identity end-to-end (wash + bar
 * + bold figures + pills). Per-category: all DPS share one tone, all
 * FDR share another, and so on.
 *
 *   Debt direction:
 *     i_owe       → danger    (you owe — red, regardless of kind)
 *     owed_to_me  → primary   (you are owed — green)
 *   Investment type:
 *     dps         → primary   (green)
 *     fdr         → accent    (gold)
 *     savings     → info      (cool blue)
 *   Loan plan (Loan Calculator):
 *     any         → danger    (cost / interest)
 *
 * Debt `kind` is ignored for tone: a loan you took out still reads
 * red ("you owe"), and money owed to you still reads green
 * ("you'd receive it back"). The Loan pill on the card surface
 * still distinguishes the loan-kind sub-type.
 */
export function debtTone(direction: DebtDirection, _kind: DebtKind | undefined): CardTone {
  return direction === 'i_owe' ? 'danger' : 'primary';
}

export function investmentTone(type: InvestmentType): CardTone {
  switch (type) {
    case 'dps':     return 'primary';
    case 'fdr':     return 'accent';
    case 'savings': return 'info';
    default:        return 'muted';
  }
}

export function loanPlanTone(): CardTone {
  return 'danger';
}

/**
 * Tailwind class helpers for tone-themed sub-elements inside a card.
 * Use these so the wash + bar + bold figure + pill all share one color
 * family.
 */
const TONE_SOFT_BG: Record<CardTone, string> = {
  primary: 'bg-primary-soft text-primary',
  danger:  'bg-danger-soft text-danger',
  accent:  'bg-accent-soft text-accent',
  warn:    'bg-warn-soft text-warn',
  success: 'bg-success-soft text-success',
  info:    'bg-info-soft text-info',
  muted:   'bg-surface-2 text-muted',
};

const TONE_TEXT: Record<CardTone, string> = {
  primary: 'text-primary',
  danger:  'text-danger',
  accent:  'text-accent',
  warn:    'text-warn',
  success: 'text-success',
  info:    'text-info',
  muted:   'text-muted',
};

const TONE_FILL: Record<CardTone, string> = {
  primary: 'bg-primary',
  danger:  'bg-danger',
  accent:  'bg-accent',
  warn:    'bg-warn',
  success: 'bg-success',
  info:    'bg-info',
  muted:   'bg-muted',
};

/** `bg-*-soft text-*` classes — for icon tiles and pill backgrounds. */
export function toneTileClass(tone: CardTone): string {
  return TONE_SOFT_BG[tone];
}

/** `text-*` class — for the bold figure, the title colour, etc. */
export function toneTextClass(tone: CardTone): string {
  return TONE_TEXT[tone];
}

/** `bg-*` class — for solid-fill chips / progress bars. */
export function toneFillClass(tone: CardTone): string {
  return TONE_FILL[tone];
}

/** CSS color value — for the donut / progress bar fill style. */
export function toneVar(tone: CardTone): string {
  return TONE_VAR[tone];
}

/**
 * Pair tone for the secondary figure on an investment card. NOW uses
 * the card tone (hero); AT MATURITY uses the pair tone so the two
 * values read as distinct figures in the same color family but
 * different shades. Mappings:
 *
 *   primary → accent     (DPS: green NOW, gold AT MATURITY)
 *   accent  → primary    (FDR: gold NOW, green AT MATURITY)
 *   info    → accent     (Savings: blue NOW, gold AT MATURITY)
 *   danger  → warn       (Loans: red NOW, amber AT MATURITY — unused
 *                         on real investment cards but kept for
 *                         symmetry)
 *   warn    → danger
 *   success → primary
 *   muted   → muted
 */
export function pairTone(tone: CardTone): CardTone {
  switch (tone) {
    case 'primary': return 'accent';
    case 'accent':  return 'primary';
    case 'info':    return 'accent';
    case 'danger':  return 'warn';
    case 'warn':    return 'danger';
    case 'success': return 'primary';
    default:        return 'muted';
  }
}
