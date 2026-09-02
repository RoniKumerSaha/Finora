/**
 * pin.spec.ts — hashing and verification contract.
 *
 * Hash determinism: same (pin, salt) → same hex.
 * Salt sensitivity: different salts → different hashes for the same pin.
 * verifyPin: returns true iff both salt and hash are present and the
 *   candidate hashes to the stored value.
 * setPin / clearPin / hasPin: round-trip the localStorage entries.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  STORAGE_KEY_HASH,
  STORAGE_KEY_SALT,
  clearPin,
  generateSalt,
  hashPin,
  hasPin,
  setPin,
  verifyPin,
} from '../pin';

describe('pin — hashing', () => {
  it('produces a deterministic hash for the same (pin, salt)', async () => {
    const salt = generateSalt();
    const a = await hashPin('123456', salt);
    const b = await hashPin('123456', salt);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/); // SHA-256 = 64 hex chars
  });

  it('produces different hashes for the same pin with different salts', async () => {
    const a = await hashPin('123456', generateSalt());
    const b = await hashPin('123456', generateSalt());
    expect(a).not.toBe(b);
  });

  it('produces different hashes for different pins with the same salt', async () => {
    const salt = generateSalt();
    const a = await hashPin('123456', salt);
    const b = await hashPin('654321', salt);
    expect(a).not.toBe(b);
  });

  it('generateSalt returns base64 of 16 bytes (~24 chars w/ padding)', () => {
    const s = generateSalt();
    // 16 bytes → 24 base64 chars when not stripped (22 chars + "==").
    expect(s.length).toBeGreaterThanOrEqual(22);
    expect(s.length).toBeLessThanOrEqual(24);
  });
});

describe('pin — setPin / hasPin / verifyPin / clearPin', () => {
  beforeEach(() => {
    clearPin();
  });

  it('hasPin returns false when nothing is stored', () => {
    expect(hasPin()).toBe(false);
  });

  it('setPin makes hasPin return true and verifyPin accept the right pin', async () => {
    await setPin('123456');
    expect(hasPin()).toBe(true);
    expect(await verifyPin('123456')).toBe(true);
  });

  it('verifyPin rejects the wrong pin', async () => {
    await setPin('123456');
    expect(await verifyPin('000000')).toBe(false);
    expect(await verifyPin('123457')).toBe(false);
  });

  it('verifyPin rejects when salt is missing (corrupt state)', async () => {
    await setPin('123456');
    localStorage.removeItem(STORAGE_KEY_SALT);
    expect(await verifyPin('123456')).toBe(false);
  });

  it('verifyPin rejects when hash is missing (corrupt state)', async () => {
    await setPin('123456');
    localStorage.removeItem(STORAGE_KEY_HASH);
    expect(await verifyPin('123456')).toBe(false);
  });

  it('clearPin removes both keys and verifyPin rejects afterwards', async () => {
    await setPin('123456');
    clearPin();
    expect(hasPin()).toBe(false);
    expect(await verifyPin('123456')).toBe(false);
  });

  it('setPin rotates the salt on each call (different hash, same pin)', async () => {
    await setPin('123456');
    const first = localStorage.getItem(STORAGE_KEY_HASH);
    const firstSalt = localStorage.getItem(STORAGE_KEY_SALT);
    await setPin('123456');
    const second = localStorage.getItem(STORAGE_KEY_HASH);
    const secondSalt = localStorage.getItem(STORAGE_KEY_SALT);
    expect(firstSalt).not.toBe(secondSalt);
    expect(first).not.toBe(second);
    expect(await verifyPin('123456')).toBe(true);
  });
});
