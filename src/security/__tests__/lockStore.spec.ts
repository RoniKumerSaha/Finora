/**
 * lockStore.spec.ts — store transitions for the PIN lock feature.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useLockStore } from '../lockStore';
import { resetRateLimit } from '../rateLimit';

describe('useLockStore', () => {
  beforeEach(() => {
    useLockStore.getState().__resetForTests();
    resetRateLimit();
    sessionStorage.clear();
  });

  it('init sets locked and storageDisabled', () => {
    useLockStore.getState().init({ locked: true, storageDisabled: false });
    expect(useLockStore.getState().locked).toBe(true);
    expect(useLockStore.getState().storageDisabled).toBe(false);
    expect(useLockStore.getState().attempts).toBe(0);
    expect(useLockStore.getState().lockoutUntil).toBeNull();
  });

  it('setLocked toggles the lock', () => {
    useLockStore.getState().setLocked(false);
    expect(useLockStore.getState().locked).toBe(false);
    useLockStore.getState().setLocked(true);
    expect(useLockStore.getState().locked).toBe(true);
  });

  it('setSubmitting toggles the submitting flag', () => {
    useLockStore.getState().setSubmitting(true);
    expect(useLockStore.getState().submitting).toBe(true);
    useLockStore.getState().setSubmitting(false);
    expect(useLockStore.getState().submitting).toBe(false);
  });

  it('recordWrongAttempt increments attempts and sets lockoutUntil', () => {
    const until = useLockStore.getState().recordWrongAttempt();
    expect(useLockStore.getState().attempts).toBe(1);
    expect(until).toBeGreaterThan(Date.now());
    expect(until).toBeLessThanOrEqual(Date.now() + 1100);
  });

  it('recordWrongAttempt tracks MAX_SAFE_INTEGER for 4th attempt', () => {
    useLockStore.getState().recordWrongAttempt();
    useLockStore.getState().recordWrongAttempt();
    useLockStore.getState().recordWrongAttempt();
    const until = useLockStore.getState().recordWrongAttempt();
    expect(useLockStore.getState().attempts).toBe(4);
    expect(until).toBe(Number.MAX_SAFE_INTEGER);
    expect(useLockStore.getState().lockoutUntil).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('resetLock zeros the lock state', () => {
    useLockStore.getState().setLocked(true);
    useLockStore.getState().recordWrongAttempt();
    useLockStore.getState().setSubmitting(true);
    useLockStore.getState().resetLock();
    const s = useLockStore.getState();
    expect(s.locked).toBe(false);
    expect(s.attempts).toBe(0);
    expect(s.lockoutUntil).toBeNull();
    expect(s.submitting).toBe(false);
  });
});