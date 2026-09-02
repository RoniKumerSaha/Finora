/**
 * rateLimit.ts — wrong-PIN counter + exponential backoff.
 *
 * sessionStorage is the right home for the rate-limit clock:
 *   - Clearing with tab close means the 4th attempt in a fresh tab
 *     incurs only the 1s delay again. Matches the design choice
 *     "reload to recover" — there's nothing adversarial here.
 *   - Stays out of localStorage so an attacker who can read it
 *     (DevTools) cannot get a persistent lockout.
 *
 * The schedule is fixed (1s, 5s, 30s — attempts 1, 2, 3). On the
 * 4th attempt in the same tab we set the lockout until to
 * `Number.MAX_SAFE_INTEGER` so the UI shows "Reload to continue"
 * indefinitely.
 */

const ATTEMPTS_KEY = 'finora.pin.attempts';
const LOCKOUT_KEY = 'finora.pin.lockoutUntil';

const SCHEDULE_MS = [1000, 5000, 30000];

/**
 * Returns the milliseconds remaining on the current lockout, or 0
 * if no lockout is active or storage is unavailable.
 */
export function getLockoutRemaining(): number {
  let until = 0;
  try {
    until = Number(sessionStorage.getItem(LOCKOUT_KEY) || 0);
  } catch {
    return 0;
  }
  if (!until) return 0;
  return Math.max(0, until - Date.now());
}

/**
 * Increment the wrong-attempt counter and return the lockout
 * duration just scheduled for THIS attempt.
 *
 *   attempt 1 → 1000ms
 *   attempt 2 → 5000ms
 *   attempt 3 → 30000ms
 *   attempt 4+ → Number.MAX_SAFE_INTEGER (UI shows "reload to continue")
 */
export function scheduleNextLockout(): number {
  let attempts = 0;
  try {
    attempts = Number(sessionStorage.getItem(ATTEMPTS_KEY) || 0) + 1;
    sessionStorage.setItem(ATTEMPTS_KEY, String(attempts));
  } catch {
    /* no-op */
  }
  if (attempts > SCHEDULE_MS.length) {
    const ms = Number.MAX_SAFE_INTEGER;
    try {
      sessionStorage.setItem(LOCKOUT_KEY, String(Date.now() + ms));
    } catch {
      /* no-op */
    }
    return ms;
  }
  const ms = SCHEDULE_MS[attempts - 1];
  try {
    sessionStorage.setItem(LOCKOUT_KEY, String(Date.now() + ms));
  } catch {
    /* no-op */
  }
  return ms;
}

/**
 * Read the current wrong-attempt counter (for tests / debugging).
 */
export function getAttempts(): number {
  try {
    return Number(sessionStorage.getItem(ATTEMPTS_KEY) || 0);
  } catch {
    return 0;
  }
}

/**
 * Clear both keys. Called on successful unlock and from the wipe
 * flow.
 */
export function resetRateLimit(): void {
  try {
    sessionStorage.removeItem(ATTEMPTS_KEY);
    sessionStorage.removeItem(LOCKOUT_KEY);
  } catch {
    /* no-op */
  }
}

// Exported for tests / inspection.
export const STORAGE_KEY_ATTEMPTS = ATTEMPTS_KEY;
export const STORAGE_KEY_LOCKOUT = LOCKOUT_KEY;
export const LOCKOUT_SCHEDULE_MS = SCHEDULE_MS;
