/**
 * format.spec.ts — regression coverage for `fmtBDTSigned`.
 *
 * 2026-09-02: `+` / `−` sign glyphs were removed from the output.
 * Direction is now carried by colour (primary / danger / ink) and
 * the row's ArrowUp/ArrowDown icon. The function still exists so
 * existing callers don't have to change, but the body is now plain
 * `৳ N` regardless of sign.
 */
import { describe, it, expect } from 'vitest';
import { fmtBDT, fmtBDTSigned } from './format';

describe('fmtBDT', () => {
  it('renders plain positive amounts', () => {
    expect(fmtBDT(3500)).toBe('\u09F3 3,500');
  });
  it('rounds fractional amounts', () => {
    expect(fmtBDT(3500.4)).toBe('\u09F3 3,500');
    expect(fmtBDT(3500.6)).toBe('\u09F3 3,501');
  });
  it('renders zero cleanly', () => {
    expect(fmtBDT(0)).toBe('\u09F3 0');
  });
  it('handles string input', () => {
    expect(fmtBDT('5000')).toBe('\u09F3 5,000');
  });
});

describe('fmtBDTSigned — sign-glyph removal', () => {
  it('returns the plain body for income ("in")', () => {
    expect(fmtBDTSigned(3500, 'in')).toBe('\u09F3 3,500');
  });
  it('returns the plain body for expense ("out")', () => {
    expect(fmtBDTSigned(3500, 'out')).toBe('\u09F3 3,500');
  });
  it('returns the plain body for transfer ("xfr")', () => {
    expect(fmtBDTSigned(3500, 'xfr')).toBe('\u09F3 3,500');
  });
  it('does NOT prepend a + sign', () => {
    expect(fmtBDTSigned(3500, 'in')).not.toMatch(/^\+/);
  });
  it('does NOT prepend a − sign', () => {
    expect(fmtBDTSigned(3500, 'out')).not.toMatch(/^\u2212/);
  });
  it('does NOT prepend an arrow sign for xfr', () => {
    expect(fmtBDTSigned(3500, 'xfr')).not.toMatch(/^\u21C4/);
  });
  it('defaults to plain body when no sign is provided', () => {
    expect(fmtBDTSigned(3500)).toBe('\u09F3 3,500');
  });
  it('uses absolute value of negative input', () => {
    expect(fmtBDTSigned(-3500, 'in')).toBe('\u09F3 3,500');
  });
});