/**
 * lockStore.ts — separate Zustand store for the PIN lock state.
 *
 * Why a separate store (not a field on the main `State` blob)?
 *   - `State` is the IndexedDB-persisted, Export-backup-included
 *     record. The PIN hash and the lock-state flag must NEVER be
 *     in there — wiping data would not be able to clear the lock
 *     (chicken/egg), and an Export backup would carry the hash out
 *     of the user's machine.
 *   - Separate store lives entirely in memory; cleared by tab close
 *     and reload, which matches the design ("every cold launch
 *     requires PIN entry").
 *
 * The store is small (4 fields, 4 actions) and intentionally has
 * no side effects beyond sessionStorage / localStorage access via
 * the rateLimit and pin helpers — keeps it testable in isolation.
 */

import { create } from 'zustand';
import {
  getLockoutRemaining,
  scheduleNextLockout,
  resetRateLimit,
} from './rateLimit';

export interface LockState {
  /**
   * True from cold launch until unlock succeeds. False on first
   * load when no PIN is configured.
   */
  locked: boolean;
  /**
   * How many wrong attempts the user has made in this tab session.
   * Drives the lockout countdown and is reset on successful unlock.
   */
  attempts: number;
  /**
   * Epoch ms until which further attempts are blocked. Null when
   * not in lockout.
   */
  lockoutUntil: number | null;
  /**
   * True iff `localStorage` itself is unavailable (private mode,
   * storage full, disabled). When true the PIN feature is skipped
   * entirely.
   */
  storageDisabled: boolean;
  /** Submit was in flight (verifying a hash). UI disables the keypad. */
  submitting: boolean;

  /** Boot-time setter used by main.tsx after feature-detecting. */
  init: (init: {
    locked: boolean;
    storageDisabled: boolean;
  }) => void;

  setLocked: (v: boolean) => void;
  setSubmitting: (v: boolean) => void;

  /**
   * Schedule the next lockout using the current attempt count and
   * set `attempts`/`lockoutUntil` accordingly. Returns the new
   * `lockoutUntil` value (epoch ms).
   */
  recordWrongAttempt: () => number;

  /** Reset attempts + lockout on successful unlock. */
  resetLock: () => void;

  /** Test-only: clear all in-memory state. Does NOT touch storage. */
  __resetForTests: () => void;
}

export const useLockStore = create<LockState>((set, get) => ({
  locked: false,
  attempts: 0,
  lockoutUntil: null,
  storageDisabled: false,
  submitting: false,

  init: (init) =>
    set({
      locked: init.locked,
      storageDisabled: init.storageDisabled,
      attempts: 0,
      lockoutUntil: null,
      submitting: false,
    }),

  setLocked: (v) => set({ locked: v }),
  setSubmitting: (v) => set({ submitting: v }),

  recordWrongAttempt: () => {
    const ms = scheduleNextLockout();
    const nextAttempts = get().attempts + 1;
    const lockoutUntil = ms === Number.MAX_SAFE_INTEGER
      ? Number.MAX_SAFE_INTEGER
      : Date.now() + ms;
    set({ attempts: nextAttempts, lockoutUntil });
    return lockoutUntil;
  },

  resetLock: () => {
    resetRateLimit();
    set({
      locked: false,
      attempts: 0,
      lockoutUntil: null,
      submitting: false,
    });
  },

  __resetForTests: () =>
    set({
      locked: false,
      attempts: 0,
      lockoutUntil: null,
      storageDisabled: false,
      submitting: false,
    }),
}));

// Re-export for convenience.
export { getLockoutRemaining };
