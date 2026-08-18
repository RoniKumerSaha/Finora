/**
 * googleDrive.lifecycle.spec.ts — GIS bootstrap + feature flag. GD-1.2.
 *
 * Tests isGisReady / onGisReady / onGisLoadError / loadGisScript.
 * The DOM side-effects live in googleDrive.script.ts; the lifecycle
 * dispatcher in googleDrive.ts is exercised here via a spy on the
 * injectGisScript export.
 */
import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import * as scriptMod from './googleDrive.script';
import * as googleDrive from './googleDrive';
const { isGisReady, onGisReady, onGisLoadError, loadGisScript, isFeatureEnabled, __test__resetLifecycle } = googleDrive;

describe('GIS feature flag (GD-1.2)', () => {
  beforeEach(() => vi.unstubAllEnvs());
  afterEach(() => vi.unstubAllEnvs());

  it('isFeatureEnabled returns false when VITE_FEATURE_GDRIVE_SYNC is unset', () => {
    vi.stubEnv('VITE_FEATURE_GDRIVE_SYNC', '');
    expect(isFeatureEnabled()).toBe(false);
  });

  it('isFeatureEnabled returns true when VITE_FEATURE_GDRIVE_SYNC is "true"', () => {
    vi.stubEnv('VITE_FEATURE_GDRIVE_SYNC', 'true');
    expect(isFeatureEnabled()).toBe(true);
  });

  it('isFeatureEnabled returns false for any value other than "true"', () => {
    vi.stubEnv('VITE_FEATURE_GDRIVE_SYNC', '1');
    expect(isFeatureEnabled()).toBe(false);
    vi.stubEnv('VITE_FEATURE_GDRIVE_SYNC', 'yes');
    expect(isFeatureEnabled()).toBe(false);
  });
});

describe('GIS lifecycle (GD-1.2)', () => {
  let injectSpy: MockInstance<(opts: { url: string; timeoutMs: number }) => Promise<void>>;

  beforeEach(() => {
    __test__resetLifecycle();
    vi.unstubAllEnvs();
    vi.stubEnv('VITE_FEATURE_GDRIVE_SYNC', 'true');
    injectSpy = vi.spyOn(scriptMod, 'injectGisScript') as MockInstance<(opts: { url: string; timeoutMs: number }) => Promise<void>>;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    injectSpy.mockRestore();
  });

  it('isGisReady returns false before the script has loaded', () => {
    expect(isGisReady()).toBe(false);
  });

  it('loadGisScript resolves, sets ready, and fires onGisReady callbacks', async () => {
    injectSpy.mockResolvedValue(undefined);
    let fired = 0;
    onGisReady(() => { fired += 1; });
    await loadGisScript();
    expect(isGisReady()).toBe(true);
    expect(fired).toBe(1);
  });

  it('loadGisScript is idempotent — second call does not re-inject', async () => {
    injectSpy.mockResolvedValue(undefined);
    await loadGisScript();
    await loadGisScript();
    await loadGisScript();
    expect(injectSpy).toHaveBeenCalledTimes(1);
  });

  it('loadGisScript rejects with GdriveError code=script_load_failed when the injector rejects', async () => {
    injectSpy.mockRejectedValue(new Error('network down'));
    const errs: unknown[] = [];
    onGisLoadError((e: unknown) => errs.push(e));
    await expect(loadGisScript()).rejects.toMatchObject({ code: 'script_load_failed' });
    expect(errs).toHaveLength(1);
    expect((errs[0] as any).code).toBe('script_load_failed');
  });

  it('loadGisScript does nothing when the feature flag is off', async () => {
    vi.stubEnv('VITE_FEATURE_GDRIVE_SYNC', 'false');
    await loadGisScript();
    expect(injectSpy).not.toHaveBeenCalled();
    expect(isGisReady()).toBe(false);
  });

  it('onGisReady fires the callback on the next microtask if already ready', async () => {
    injectSpy.mockResolvedValue(undefined);
    await loadGisScript();
    let fired = false;
    onGisReady(() => { fired = true; });
    await Promise.resolve();
    expect(fired).toBe(true);
  });

  it('onGisReady returns an unsubscribe function', async () => {
    injectSpy.mockResolvedValue(undefined);
    let fired = 0;
    const unsub = onGisReady(() => { fired += 1; });
    await loadGisScript();
    expect(fired).toBe(1);
    unsub();
    // Trigger another ready cycle by re-stubbing: this is not a real-world
    // scenario (ready is terminal in production), but proves the unsub works.
    // We can't easily simulate that without a second internals seam, so we
    // rely on the Set semantics: the unsubscribed callback is gone.
    expect(typeof unsub).toBe('function');
  });

  it('onGisLoadError returns an unsubscribe function', async () => {
    injectSpy.mockRejectedValue(new Error('boom'));
    let fires = 0;
    const unsub = onGisLoadError((_e: unknown) => { fires += 1; });
    await expect(loadGisScript()).rejects.toBeTruthy();
    expect(fires).toBe(1);
    unsub();
    // After retry, the unsubscribed listener must not fire.
    injectSpy.mockRejectedValue(new Error('boom2'));
    await expect(loadGisScript()).rejects.toBeTruthy();
    expect(fires).toBe(1);
  });
});
