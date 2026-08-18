/**
 * googleDrive.auth.spec.ts — OAuth connect / disconnect / getAccessToken.
 * GD-1.3.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as googleDrive from './googleDrive';
import * as scriptMod from './googleDrive.script';
import type { MockInstance } from 'vitest';

const { connect, disconnect, getAccessToken, loadTokens, clearTokens, __test__resetLifecycle, isGisReady } = googleDrive;

interface GisMockCall {
  initTokenClient: ReturnType<typeof vi.fn>;
  callback: ((resp: { access_token: string; expires_in: number; token_type: string; scope: string }) => void) | null;
  errorCallback: ((err: { type?: string; message?: string }) => void) | null;
  requestAccessToken: ReturnType<typeof vi.fn>;
  refresh: ReturnType<typeof vi.fn>;
}

const __gisRecord: { current: GisMockCall | null } = { current: null };

function installGis() {
  const initTokenClient = vi.fn((config: any) => {
    __gisRecord.current = {
      ...(__gisRecord.current ?? ({} as GisMockCall)),
      initTokenClient,
      callback: config.callback,
      errorCallback: config.error_callback,
      requestAccessToken: __gisRecord.current?.requestAccessToken ?? vi.fn(),
      refresh: __gisRecord.current?.refresh ?? vi.fn(),
    };
    return {
      requestAccessToken: (opts: { prompt?: string }) => {
        __gisRecord.current!.requestAccessToken(opts);
      },
    };
  });
  const refresh = vi.fn((opts: any) => {
    // Default: succeed with a fresh token.
    opts?.callback?.({ access_token: 'ya29.refreshed', expires_in: 3600 });
  });
  const oauth2 = { initTokenClient, refresh };
  ;(globalThis as any).google = { accounts: { oauth2 } };
  __gisRecord.current = { initTokenClient, callback: null, errorCallback: null, requestAccessToken: vi.fn(), refresh };
}

function uninstallGis() {
  delete (globalThis as any).google;
  __gisRecord.current = null;
}

const TOKEN_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';

describe('OAuth connect (GD-1.3)', () => {
  let injectSpy: MockInstance<any>;
  let fetchSpy: MockInstance<any>;

  beforeEach(() => {
    localStorage.clear();
    __test__resetLifecycle();
    installGis();
    injectSpy = vi.spyOn(scriptMod, 'injectGisScript').mockResolvedValue(undefined);
    // Mark ready so connect() doesn't reject with script_not_ready.
    // We use the public seam: call isGisReady() path via loadGisScript with a mock.
    // Easier: directly use the test seam.
    (googleDrive as any).__test__markGisReady();
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', TOKEN_CLIENT_ID);
    vi.stubEnv('VITE_FEATURE_GDRIVE_SYNC', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    uninstallGis();
    injectSpy.mockRestore();
    fetchSpy.mockRestore();
    clearTokens();
  });

  it('isGisReady is true after marking ready', () => {
    expect(isGisReady()).toBe(true);
  });

  it('connect() happy path: tokens are saved with access token + expiresAt + scope', async () => {
    const promise = connect();
    // Drive the GIS callback synchronously.
    __gisRecord.current!.callback!({
      access_token: 'ya29.test',
      expires_in: 3600,
      token_type: 'Bearer',
      scope: 'https://www.googleapis.com/auth/drive.file',
    });
    const tokens = await promise;
    expect(tokens.accessToken).toBe('ya29.test');
    expect(tokens.expiresAt).toBeGreaterThan(Date.now());
    expect(tokens.scope).toBe('https://www.googleapis.com/auth/drive.file');
    expect(loadTokens()).toEqual(tokens);
  });

  it('connect() uses prompt=consent on first connect', async () => {
    const promise = connect();
    expect(__gisRecord.current!.requestAccessToken).toHaveBeenCalledWith({ prompt: 'consent' });
    __gisRecord.current!.callback!({
      access_token: 'ya29.test',
      expires_in: 3600,
      token_type: 'Bearer',
      scope: 'https://www.googleapis.com/auth/drive.file',
    });
    await promise;
  });

  it('connect() user closes the popup → rejects with GdriveError code=popup_closed', async () => {
    const promise = connect();
    __gisRecord.current!.errorCallback!({ type: 'popup_closed', message: 'user closed' });
    await expect(promise).rejects.toMatchObject({ code: 'popup_closed' });
  });

  it('connect() user denies → rejects with GdriveError code=access_denied', async () => {
    const promise = connect();
    __gisRecord.current!.errorCallback!({ type: 'access_denied', message: 'denied' });
    await expect(promise).rejects.toMatchObject({ code: 'access_denied' });
  });

  it('connect() with no client_id → rejects with code=unknown and console.error', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '');
    const promise = connect();
    await expect(promise).rejects.toMatchObject({ code: 'unknown' });
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('connect() before GIS ready → rejects with code=script_not_ready', async () => {
    __test__resetLifecycle();
    vi.stubEnv('VITE_FEATURE_GDRIVE_SYNC', 'false');
    await expect(connect()).rejects.toMatchObject({ code: 'script_not_ready' });
  });
});

describe('OAuth disconnect (GD-1.3)', () => {
  let fetchSpy: MockInstance<any>;

  beforeEach(() => {
    localStorage.clear();
    __test__resetLifecycle();
    installGis();
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
  });

  afterEach(() => {
    uninstallGis();
    fetchSpy.mockRestore();
    clearTokens();
  });

  it('disconnect() clears tokens from localStorage', async () => {
    localStorage.setItem('finora:gdrive:tokens', JSON.stringify({
      accessToken: 'ya29.test',
      expiresAt: Date.now() + 3600_000,
      scope: 'https://www.googleapis.com/auth/drive.file',
    }));
    await disconnect();
    expect(loadTokens()).toBeNull();
  });

  it('disconnect() fires one revoke fetch to the Google revoke endpoint', async () => {
    localStorage.setItem('finora:gdrive:tokens', JSON.stringify({
      accessToken: 'ya29.toRevoke',
      expiresAt: Date.now() + 3600_000,
      scope: 'https://www.googleapis.com/auth/drive.file',
    }));
    await disconnect();
    const revokeCalls = fetchSpy.mock.calls.filter((c: any[]) =>
      typeof c[0] === 'string' && c[0].includes('oauth2.googleapis.com/revoke')
    );
    expect(revokeCalls).toHaveLength(1);
    expect(String(revokeCalls[0][0])).toContain('ya29.toRevoke');
  });

  it('disconnect() silently swallows revoke failures', async () => {
    fetchSpy.mockRejectedValue(new Error('network down'));
    localStorage.setItem('finora:gdrive:tokens', JSON.stringify({
      accessToken: 'ya29.test',
      expiresAt: Date.now() + 3600_000,
      scope: 'https://www.googleapis.com/auth/drive.file',
    }));
    // Should not throw.
    await expect(disconnect()).resolves.toBeUndefined();
    expect(loadTokens()).toBeNull();
  });

  it('disconnect() with no tokens is a no-op (still resolves)', async () => {
    await expect(disconnect()).resolves.toBeUndefined();
  });
});

describe('getAccessToken (GD-1.3)', () => {
  let injectSpy: MockInstance<any>;
  let fetchSpy: MockInstance<any>;

  beforeEach(() => {
    localStorage.clear();
    __test__resetLifecycle();
    installGis();
    injectSpy = vi.spyOn(scriptMod, 'injectGisScript').mockResolvedValue(undefined);
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubEnv('VITE_FEATURE_GDRIVE_SYNC', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    uninstallGis();
    injectSpy.mockRestore();
    fetchSpy.mockRestore();
    clearTokens();
  });

  it('returns the access token when tokens are present and not expiring', async () => {
    saveToken({ accessToken: 'ya29.fresh', expiresAt: Date.now() + 3600_000 });
    const token = await getAccessToken();
    expect(token).toBe('ya29.fresh');
    expect(__gisRecord.current!.refresh).not.toHaveBeenCalled();
  });

  it('clears tokens and rejects with code=auth_expired when no tokens are present', async () => {
    await expect(getAccessToken()).rejects.toMatchObject({ code: 'auth_expired' });
    expect(loadTokens()).toBeNull();
  });

  it('refreshes when the token expires in < 60s', async () => {
    saveToken({ accessToken: 'ya29.stale', expiresAt: Date.now() + 30_000 });
    const token = await getAccessToken();
    expect(token).toBe('ya29.refreshed');
    expect(__gisRecord.current!.refresh).toHaveBeenCalled();
    // Tokens are re-saved.
    expect(loadTokens()?.accessToken).toBe('ya29.refreshed');
  });

  it('does not refresh when the token expires in > 60s', async () => {
    saveToken({ accessToken: 'ya29.fresh', expiresAt: Date.now() + 120_000 });
    await getAccessToken();
    expect(__gisRecord.current!.refresh).not.toHaveBeenCalled();
  });

  it('refresh failure clears tokens and rejects with code=auth_expired', async () => {
    __gisRecord.current!.refresh.mockImplementation((opts: any) => {
      opts?.error_callback?.({ type: 'invalid_grant' });
    });
    saveToken({ accessToken: 'ya29.stale', expiresAt: Date.now() + 30_000 });
    await expect(getAccessToken()).rejects.toMatchObject({ code: 'auth_expired' });
    expect(loadTokens()).toBeNull();
  });
});

function saveToken(t: { accessToken: string; expiresAt: number; scope?: string; email?: string }) {
  localStorage.setItem('finora:gdrive:tokens', JSON.stringify({
    scope: t.scope ?? 'https://www.googleapis.com/auth/drive.file',
    email: t.email,
    ...t,
  }));
}
