/**
 * envCheck.spec.ts — unit tests for the runtime environment checks.
 * GD-4.1 (file:// detection) + GD-4.3 (env defaults).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isFileProtocol, readFeatureFlagDefault, readClientIdDefault } from './envCheck';

describe('isFileProtocol (GD-4.1)', () => {
  const originalLocation = (globalThis as any).window?.location;

  beforeEach(() => {
    // Make sure we have a window.location we can mutate per-test.
    if (typeof (globalThis as any).window === 'undefined') {
      (globalThis as any).window = {};
    }
  });

  afterEach(() => {
    if (originalLocation === undefined) {
      delete (globalThis as any).window.location;
    } else {
      (globalThis as any).window.location = originalLocation;
    }
  });

  it('returns true when window.location.protocol === "file:"', () => {
    (globalThis as any).window.location = { protocol: 'file:' };
    expect(isFileProtocol()).toBe(true);
  });

  it('returns false when window.location.protocol === "https:"', () => {
    (globalThis as any).window.location = { protocol: 'https:' };
    expect(isFileProtocol()).toBe(false);
  });

  it('returns false when window.location.protocol === "http:"', () => {
    (globalThis as any).window.location = { protocol: 'http:' };
    expect(isFileProtocol()).toBe(false);
  });

  it('returns false when window is undefined (node-only test env)', () => {
    const win = (globalThis as any).window;
    delete (globalThis as any).window;
    try {
      expect(isFileProtocol()).toBe(false);
    } finally {
      (globalThis as any).window = win;
    }
  });
});

describe('env defaults (GD-4.3)', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('readFeatureFlagDefault returns false by default', () => {
    // process.env is read via (globalThis as any).process.env — make sure
    // we don't have a stale VITE_FEATURE_GDRIVE_SYNC=true from a previous
    // test's stub.
    delete (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.VITE_FEATURE_GDRIVE_SYNC;
    expect(readFeatureFlagDefault()).toBe(false);
  });

  it('readFeatureFlagDefault returns true only for "true"', () => {
    vi.stubEnv('VITE_FEATURE_GDRIVE_SYNC', 'true');
    expect(readFeatureFlagDefault()).toBe(true);
    vi.stubEnv('VITE_FEATURE_GDRIVE_SYNC', 'TRUE');
    expect(readFeatureFlagDefault()).toBe(false);
    vi.stubEnv('VITE_FEATURE_GDRIVE_SYNC', '1');
    expect(readFeatureFlagDefault()).toBe(false);
  });

  it('readClientIdDefault returns an empty string when unset', () => {
    delete (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.VITE_GOOGLE_CLIENT_ID;
    expect(readClientIdDefault()).toBe('');
  });

  it('readClientIdDefault returns the env value when set', () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'abc.apps.googleusercontent.com');
    expect(readClientIdDefault()).toBe('abc.apps.googleusercontent.com');
  });
});

describe('build-time env wiring (GD-4.3)', () => {
  it('isFeatureEnabled returns false by default (no VITE_FEATURE_GDRIVE_SYNC set)', async () => {
    const { isFeatureEnabled } = await import('./googleDrive');
    // Make sure neither import.meta.env nor process.env has it set.
    delete (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.VITE_FEATURE_GDRIVE_SYNC;
    expect(isFeatureEnabled()).toBe(false);
  });

  it('isFeatureEnabled returns true when VITE_FEATURE_GDRIVE_SYNC="true"', async () => {
    const { isFeatureEnabled } = await import('./googleDrive');
    vi.stubEnv('VITE_FEATURE_GDRIVE_SYNC', 'true');
    expect(isFeatureEnabled()).toBe(true);
  });
});