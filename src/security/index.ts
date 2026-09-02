/**
 * security/index.ts — barrel for the PIN-lock feature.
 *
 * Most callers import from here rather than the individual files.
 */
export {
  STORAGE_KEY_SALT,
  STORAGE_KEY_HASH,
  clearPin,
  generateSalt,
  hasPin,
  hashPin,
  isLocalStorageAvailable,
  setPin,
  verifyPin,
} from './pin';
export {
  STORAGE_KEY_ATTEMPTS,
  STORAGE_KEY_LOCKOUT,
  LOCKOUT_SCHEDULE_MS,
  getAttempts,
  getLockoutRemaining,
  resetRateLimit,
  scheduleNextLockout,
} from './rateLimit';
export { useLockStore } from './lockStore';
export type { LockState } from './lockStore';
export { PinCells } from './PinCells';
export { LockScreen } from './LockScreen';
export { SetPinDialog } from './SetPinDialog';
export { ChangePinDialog } from './ChangePinDialog';
export { SecuritySection } from './SecuritySection';
