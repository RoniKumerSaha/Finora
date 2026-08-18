/**
 * googleDrive.spec.ts — token storage & API surface contract.
 * Covers GD-1.1. Drive API + GIS lifecycle are covered in later specs.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  GDRIVE_TOKENS_KEY,
  loadTokens,
  saveTokens,
  clearTokens,
} from './googleDrive';

describe('token storage (GD-1.1)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loadTokens returns null when the key is absent', () => {
    expect(loadTokens()).toBeNull();
  });

  it('saveTokens then loadTokens returns the parsed object', () => {
    const t = {
      accessToken: 'ya29.test',
      expiresAt: 1724000000000,
      scope: 'https://www.googleapis.com/auth/drive.file',
      email: 'rahim@gmail.com',
    };
    saveTokens(t);
    expect(loadTokens()).toEqual(t);
  });

  it('clearTokens removes the localStorage key and loadTokens returns null', () => {
    saveTokens({
      accessToken: 'ya29.test',
      expiresAt: 1724000000000,
      scope: 'https://www.googleapis.com/auth/drive.file',
    });
    expect(localStorage.getItem(GDRIVE_TOKENS_KEY)).not.toBeNull();
    clearTokens();
    expect(localStorage.getItem(GDRIVE_TOKENS_KEY)).toBeNull();
    expect(loadTokens()).toBeNull();
  });

  it('loadTokens returns null when the stored value is malformed JSON', () => {
    localStorage.setItem(GDRIVE_TOKENS_KEY, 'not json{');
    expect(loadTokens()).toBeNull();
  });

  it('loadTokens returns null when localStorage throws (e.g. disabled)', () => {
    const original = localStorage.getItem;
    localStorage.getItem = () => {
      throw new Error('SecurityError: storage disabled');
    };
    try {
      expect(loadTokens()).toBeNull();
    } finally {
      localStorage.getItem = original;
    }
  });
});

describe('public API surface (GD-1.1)', () => {
  it('re-exports the documented token-storage names', () => {
    expect(typeof GDRIVE_TOKENS_KEY).toBe('string');
    expect(typeof loadTokens).toBe('function');
    expect(typeof saveTokens).toBe('function');
    expect(typeof clearTokens).toBe('function');
  });
});
