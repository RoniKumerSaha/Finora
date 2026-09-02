/**
 * rateLimit.spec.ts — wrong-PIN exponential delay schedule + reset.
 *
 * The schedule is a fixed 3-step ramp (1s, 5s, 30s) followed by an
 * indefinite "reload to recover" lockout.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  LOCKOUT_SCHEDULE_MS,
  getAttempts,
  getLockoutRemaining,
  resetRateLimit,
  scheduleNextLockout,
} from '../rateLimit';

describe('rateLimit', () => {
  beforeEach(() => {
    resetRateLimit();
    sessionStorage.clear();
  });

  it('first attempt schedules 1000ms', () => {
    const ms = scheduleNextLockout();
    expect(ms).toBe(LOCKOUT_SCHEDULE_MS[0]);
    expect(getAttempts()).toBe(1);
  });

  it('second attempt schedules 5000ms', () => {
    scheduleNextLockout();
    const ms = scheduleNextLockout();
    expect(ms).toBe(LOCKOUT_SCHEDULE_MS[1]);
    expect(getAttempts()).toBe(2);
  });

  it('third attempt schedules 30000ms', () => {
    scheduleNextLockout();
    scheduleNextLockout();
    const ms = scheduleNextLockout();
    expect(ms).toBe(LOCKOUT_SCHEDULE_MS[2]);
    expect(getAttempts()).toBe(3);
  });

  it('fourth+ attempt schedules MAX_SAFE_INTEGER (UI says "reload")', () => {
    scheduleNextLockout();
    scheduleNextLockout();
    scheduleNextLockout();
    const ms = scheduleNextLockout();
    expect(ms).toBe(Number.MAX_SAFE_INTEGER);
    expect(getAttempts()).toBe(4);
    // Subsequent attempts keep returning MAX_SAFE_INTEGER
    const again = scheduleNextLockout();
    expect(again).toBe(Number.MAX_SAFE_INTEGER);
    expect(getAttempts()).toBe(5);
  });

  it('getLockoutRemaining counts down to 0', () => {
    const ms = scheduleNextLockout();
    expect(ms).toBe(1000);
    // Just after scheduling, remaining should be ~1000ms
    const r = getLockoutRemaining();
    expect(r).toBeGreaterThan(0);
    expect(r).toBeLessThanOrEqual(1000);
  });

  it('resetRateLimit clears attempts and the pending lockout', () => {
    scheduleNextLockout();
    scheduleNextLockout();
    expect(getAttempts()).toBe(2);
    resetRateLimit();
    expect(getAttempts()).toBe(0);
    expect(getLockoutRemaining()).toBe(0);
  });

  it('returns to 1000ms schedule after reset', () => {
    scheduleNextLockout();
    scheduleNextLockout();
    resetRateLimit();
    const ms = scheduleNextLockout();
    expect(ms).toBe(1000);
  });
});
