/**
 * duration.spec.ts — the years↔months bridge used by the Plan module's
 * Loan Calculator and Investment Planner.
 *
 * The stored term is always a month count; these helpers convert what
 * the user typed (in the unit they picked) into that canonical month
 * count and back out again for display.
 */
import { describe, expect, it } from 'vitest';
import {
  MONTHS_PER_YEAR,
  durationToMonths,
  formatDuration,
  formatDurationShort,
  monthsToUnit,
  splitDuration,
} from '../../../src/domain/duration';

describe('durationToMonths', () => {
  it('converts whole years to months', () => {
    expect(durationToMonths(1, 'years')).toBe(12);
    expect(durationToMonths(3, 'years')).toBe(36);
    expect(durationToMonths(10, 'years')).toBe(120);
  });

  it('converts fractional years to whole months', () => {
    expect(durationToMonths(2.5, 'years')).toBe(30);
    expect(durationToMonths(0.5, 'years')).toBe(6);
    expect(durationToMonths(1.5, 'years')).toBe(18);
  });

  it('passes months straight through', () => {
    expect(durationToMonths(12, 'months')).toBe(12);
    expect(durationToMonths(1, 'months')).toBe(1);
    expect(durationToMonths(240, 'months')).toBe(240);
  });

  it('collapses zero, negative and non-finite values to 0', () => {
    expect(durationToMonths(0, 'months')).toBe(0);
    expect(durationToMonths(0, 'years')).toBe(0);
    expect(durationToMonths(-5, 'months')).toBe(0);
    expect(durationToMonths(-2, 'years')).toBe(0);
    expect(durationToMonths(NaN, 'months')).toBe(0);
    expect(durationToMonths(Infinity, 'months')).toBe(0);
  });

  it('uses 12 months per year', () => {
    expect(MONTHS_PER_YEAR).toBe(12);
  });
});

describe('monthsToUnit', () => {
  it('picks years for whole-year terms', () => {
    expect(monthsToUnit(12)).toBe('years');
    expect(monthsToUnit(24)).toBe('years');
    expect(monthsToUnit(36)).toBe('years');
    expect(monthsToUnit(120)).toBe('years');
  });

  it('keeps months for sub-year terms', () => {
    expect(monthsToUnit(1)).toBe('months');
    expect(monthsToUnit(6)).toBe('months');
    expect(monthsToUnit(11)).toBe('months');
  });

  it('keeps months for a term that is not a whole year', () => {
    // "18 months" scans faster than "1.5 years" — bank contracts are
    // stated in months.
    expect(monthsToUnit(18)).toBe('months');
    expect(monthsToUnit(30)).toBe('months');
    expect(monthsToUnit(7)).toBe('months');
  });

  it('keeps months for an empty term', () => {
    expect(monthsToUnit(0)).toBe('months');
  });
});

describe('splitDuration', () => {
  it('expresses months in months', () => {
    expect(splitDuration(18, 'months')).toEqual({ value: 18, unit: 'months' });
  });

  it('expresses months in years', () => {
    expect(splitDuration(12, 'years')).toEqual({ value: 1, unit: 'years' });
    expect(splitDuration(36, 'years')).toEqual({ value: 3, unit: 'years' });
    expect(splitDuration(30, 'years')).toEqual({ value: 2.5, unit: 'years' });
  });

  it('never loses the month count when switching units', () => {
    // 18 months is 1.5 years — the Years field shows a fraction, and
    // converting back lands on exactly 18 months.
    const { value } = splitDuration(18, 'years');
    expect(durationToMonths(value, 'years')).toBe(18);
  });

  it('treats missing values as zero', () => {
    expect(splitDuration(0, 'months')).toEqual({ value: 0, unit: 'months' });
  });
});

describe('formatDuration', () => {
  it('reads a whole year as years', () => {
    expect(formatDuration(12)).toBe('1 year');
    expect(formatDuration(24)).toBe('2 years');
    expect(formatDuration(120)).toBe('10 years');
  });

  it('reads sub-year terms as months', () => {
    expect(formatDuration(1)).toBe('1 month');
    expect(formatDuration(6)).toBe('6 months');
    expect(formatDuration(11)).toBe('11 months');
  });

  it('splits mixed terms', () => {
    expect(formatDuration(18)).toBe('1 year 6 months');
    expect(formatDuration(30)).toBe('2 years 6 months');
  });

  it('handles zero', () => {
    expect(formatDuration(0)).toBe('0 months');
  });
});

describe('formatDurationShort', () => {
  it('keeps sub-year terms in months', () => {
    expect(formatDurationShort(1)).toBe('1mo');
    expect(formatDurationShort(11)).toBe('11mo');
  });

  it('collapses whole years', () => {
    expect(formatDurationShort(12)).toBe('1y');
    expect(formatDurationShort(36)).toBe('3y');
  });

  it('keeps one decimal for fractional years', () => {
    expect(formatDurationShort(30)).toBe('2.5y');
    expect(formatDurationShort(18)).toBe('1.5y');
  });
});
