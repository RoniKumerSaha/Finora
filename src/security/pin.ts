/**
 * pin.ts — 6-digit PIN hashing + localStorage bookkeeping.
 *
 * The PIN is kept out of the main `State` blob on purpose: Export
 * backup JSON would otherwise include the hash and be a credential
 * leak to anyone who got the file. Instead we store:
 *
 *   localStorage['finora.pin.salt']  — base64(16 random bytes)
 *   localStorage['finora.pin.hash']  — hex(SHA-256(salt + '|' + pin))
 *
 * Threat model is opportunistic, not adversarial: a casual visitor
 * who opens DevTools. A determined attacker with file-system access
 * can also `removeItem('finora.pin.hash')` to skip the lock — the
 * recovery path is to wipe everything and start fresh, deliberately
 * matching the rest of the app's "no cloud, no recovery" stance.
 *
 * All operations guard localStorage access with try/catch so private
 * mode / storage-full / disabled cookies do not crash the app.
 */

const SALT_KEY = 'finora.pin.salt';
const HASH_KEY = 'finora.pin.hash';

const enc = new TextEncoder();

function b64encode(bytes: Uint8Array): string {
  // String.fromCharCode with spread is fine for <32KB inputs; salt is
  // 16 bytes so this is safe.
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

export function generateSalt(): string {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  return b64encode(buf);
}

/**
 * Hash a PIN with the supplied salt. Deterministic for the same
 * (salt, pin) pair. SHA-256 is more than enough for a local-only
 * 6-digit lockout.
 */
export async function hashPin(pin: string, saltB64: string): Promise<string> {
  const data = enc.encode(saltB64 + '|' + pin);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(digest);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Returns true iff both a salt and hash are present in localStorage
 * AND the candidate PIN hashes to the stored hash. All operations
 * are guarded; if localStorage throws (private mode etc.) we return
 * false so the caller treats it as "no PIN configured" rather than
 * locking the user out.
 */
export async function verifyPin(pin: string): Promise<boolean> {
  let salt: string | null;
  let hash: string | null;
  try {
    salt = localStorage.getItem(SALT_KEY);
    hash = localStorage.getItem(HASH_KEY);
  } catch {
    return false;
  }
  if (!salt || !hash) return false;
  const candidate = await hashPin(pin, salt);
  if (candidate.length !== hash.length) return false;
  // Constant-time compare: cheap local-dev hardening, costs nothing.
  let diff = 0;
  for (let i = 0; i < candidate.length; i++) {
    diff |= candidate.charCodeAt(i) ^ hash.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Persist the PIN. Generates a fresh salt and stores both keys. The
 * caller is expected to have validated that `pin` is exactly 6 digits
 * (we don't enforce here so the same helper can be reused for any
 * future length change).
 */
export async function setPin(pin: string): Promise<void> {
  const salt = generateSalt();
  const hash = await hashPin(pin, salt);
  localStorage.setItem(SALT_KEY, salt);
  localStorage.setItem(HASH_KEY, hash);
}

/**
 * Returns true iff a PIN is configured (i.e. both the salt and hash
 * are present in localStorage). Feature-detect via try/catch so a
 * disabled-storage browser falls back to "no PIN".
 */
export function hasPin(): boolean {
  try {
    return !!localStorage.getItem(SALT_KEY) && !!localStorage.getItem(HASH_KEY);
  } catch {
    return false;
  }
}

/**
 * Returns true iff `localStorage.getItem` works. Use on app boot to
 * decide whether the PIN feature is even available in this browser
 * mode.
 */
export function isLocalStorageAvailable(): boolean {
  try {
    const probe = '__finora_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

/**
 * Wipe the PIN. Used by the disable flow and the global wipe flow.
 * Never throws.
 */
export function clearPin(): void {
  try {
    localStorage.removeItem(SALT_KEY);
    localStorage.removeItem(HASH_KEY);
  } catch {
    /* storage disabled, nothing to do */
  }
}

// Exported for tests / inspection.
export const STORAGE_KEY_SALT = SALT_KEY;
export const STORAGE_KEY_HASH = HASH_KEY;
