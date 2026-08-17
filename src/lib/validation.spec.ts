/**
 * validation.spec.ts — covers the inline negative-amount guard.
 *
 * Spine: docs/ux-designs/ux-finora-2026-08-14-negative-guard/EXPERIENCE.md
 */
import { describe, expect, it } from 'vitest';
import {
  isPositiveMoney,
  isNonNegativeMoney,
  isOptionalNonNegativeMoney,
  POSITIVE_MONEY_ERROR,
  NON_NEGATIVE_MONEY_ERROR,
} from './validation';

describe('isPositiveMoney (strict > 0)', () => {
  it('accepts positive integers', () => {
    expect(isPositiveMoney('250')).toBe(true);
    expect(isPositiveMoney('1')).toBe(true);
    expect(isPositiveMoney('999999')).toBe(true);
  });

  it('accepts positive decimals', () => {
    expect(isPositiveMoney('12.50')).toBe(true);
    expect(isPositiveMoney('0.01')).toBe(true);
  });

  it('accepts scientific notation that coerces to positive', () => {
    expect(isPositiveMoney('2.5e2')).toBe(true);   // 250
    expect(isPositiveMoney('1E0')).toBe(true);      // 1
  });

  it('accepts leading-zero forms', () => {
    expect(isPositiveMoney('0250')).toBe(true); // coerces to 250
  });

  it('rejects empty / whitespace', () => {
    expect(isPositiveMoney('')).toBe(false);
    expect(isPositiveMoney('   ')).toBe(false);
  });

  it('rejects zero and zero-ish', () => {
    expect(isPositiveMoney('0')).toBe(false);
    expect(isPositiveMoney('0.0')).toBe(false);
    expect(isPositiveMoney('0e0')).toBe(false);
    expect(isPositiveMoney('-0')).toBe(false);
  });

  it('rejects negatives in every form', () => {
    expect(isPositiveMoney('-250')).toBe(false);
    expect(isPositiveMoney('-12.50')).toBe(false);
    expect(isPositiveMoney('-2.5e2')).toBe(false);
  });

  it('rejects non-numeric strings', () => {
    expect(isPositiveMoney('abc')).toBe(false);
    expect(isPositiveMoney('12abc')).toBe(false);
  });

  it('rejects NaN, Infinity, -Infinity', () => {
    expect(isPositiveMoney('NaN')).toBe(false);
    expect(isPositiveMoney('Infinity')).toBe(false);
    expect(isPositiveMoney('-Infinity')).toBe(false);
  });
});

describe('isNonNegativeMoney (>= 0)', () => {
  it('accepts zero', () => {
    expect(isNonNegativeMoney('0')).toBe(true);
    expect(isNonNegativeMoney('0.0')).toBe(true);
    expect(isNonNegativeMoney('0e0')).toBe(true);
  });

  it('accepts positive numbers', () => {
    expect(isNonNegativeMoney('250')).toBe(true);
    expect(isNonNegativeMoney('0.01')).toBe(true);
  });

  it('rejects negatives', () => {
    expect(isNonNegativeMoney('-1')).toBe(false);
    expect(isNonNegativeMoney('-0.01')).toBe(false);
  });

  it('rejects empty / non-numeric', () => {
    expect(isNonNegativeMoney('')).toBe(false);
    expect(isNonNegativeMoney('abc')).toBe(false);
  });
});

describe('error copy', () => {
  it('exposes the two error strings', () => {
    expect(POSITIVE_MONEY_ERROR).toBe('Amount must be greater than zero.');
    expect(NON_NEGATIVE_MONEY_ERROR).toBe('Amount must be zero or greater.');
  });
});

describe('isOptionalNonNegativeMoney (>= 0 OR empty)', () => {
  // Used by fields that show no pre-placed 0 by default — empty means
  // "leave it at zero" rather than "invalid". Locks the behavior so
  // AccountAddScreen.openingBalance and GoalAddScreen.saved don't
  // flash an error the moment the modal opens.
  it('accepts empty / whitespace as "leave it at zero"', () => {
    expect(isOptionalNonNegativeMoney('')).toBe(true);
    expect(isOptionalNonNegativeMoney('   ')).toBe(true);
  });

  it('accepts zero and positive numbers', () => {
    expect(isOptionalNonNegativeMoney('0')).toBe(true);
    expect(isOptionalNonNegativeMoney('250')).toBe(true);
    expect(isOptionalNonNegativeMoney('0.01')).toBe(true);
  });

  it('still rejects negatives and non-numerics', () => {
    expect(isOptionalNonNegativeMoney('-1')).toBe(false);
    expect(isOptionalNonNegativeMoney('abc')).toBe(false);
  });
});
