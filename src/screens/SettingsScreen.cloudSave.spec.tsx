/**
 * SettingsScreen.cloudSave.spec.tsx — GD-3.2 acceptance tests for the
 * Save-to-Drive flow.
 *
 * Mocks the googleDrive module so we can simulate Drive API responses
 * without hitting the network. Verifies:
 *  - successful save updates lastSavedAt and shows the three-part success banner
 *  - 401 / auth_expired drops the section back to Disconnected and shows re-auth banner
 *  - network error keeps buttons enabled and shows three-part error banner
 *  - double-click on Save is a no-op (button disabled while working)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsScreen } from './SettingsScreen';
import { RoleAlertBanner } from '../components/RoleAlertBanner';
import * as googleDrive from '../lib/googleDrive';
import { useStore } from '../domain/store';
import { DEFAULT_STATE } from '../domain/persistence';

const GDRIVE_TOKENS_KEY = 'finora:gdrive:tokens';

function saveTokens() {
  localStorage.setItem(GDRIVE_TOKENS_KEY, JSON.stringify({
    accessToken: 'ya29.test',
    expiresAt: Date.now() + 3600_000,
    scope: 'https://www.googleapis.com/auth/drive.file',
    email: 'me@example.com',
  }));
}

function okJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('SettingsScreen save-to-Drive flow (GD-3.2)', () => {
  let fetchSpy: any;

  beforeEach(() => {
    localStorage.clear();
    useStore.setState({ state: { ...DEFAULT_STATE } });
    googleDrive.__test__resetLifecycle();
    googleDrive.__test__markGisReady();
    vi.unstubAllEnvs();
    vi.stubEnv('VITE_FEATURE_GDRIVE_SYNC', 'true');
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test.apps.googleusercontent.com');
    saveTokens();
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    cleanup();
    fetchSpy.mockRestore();
    vi.unstubAllEnvs();
    googleDrive.__test__resetLifecycle();
    useStore.setState({ state: { ...DEFAULT_STATE } });
  });

  it('successful save updates lastSavedAt and shows success banner', async () => {
    fetchSpy.mockImplementation(async () => okJson({ id: 'file-1', modifiedTime: '2026-08-18T12:00:00.000Z' }));
    render(<><RoleAlertBanner /><SettingsScreen /></>);
    const saveBtn = await screen.findByRole('button', { name: /Save backup to Drive/i });
    await userEvent.click(saveBtn);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Saved to Drive/);
    });
    expect(screen.getByRole('alert')).toHaveTextContent(/Finora backups folder/);
    expect(screen.getByRole('alert')).toHaveTextContent(/drive\.google\.com/);
    // lastSavedAt is set in store.
    expect(useStore.getState().state.settings.cloudBackup?.lastSavedAt).toBe('2026-08-18T12:00:00.000Z');
  });

  it('auth_expired drops to Disconnected and shows re-auth banner', async () => {
    fetchSpy.mockImplementation(async () => okJson({}, 401));
    render(<><RoleAlertBanner /><SettingsScreen /></>);
    const saveBtn = await screen.findByRole('button', { name: /Save backup to Drive/i });
    await userEvent.click(saveBtn);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Disconnected from Google Drive/i);
    });
    // Section transitions: tokens cleared, only Connect button remains.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Connect Google Drive/i })).toBeInTheDocument();
    });
    expect(localStorage.getItem(GDRIVE_TOKENS_KEY)).toBeNull();
  });

  it('network error keeps buttons enabled and shows three-part banner', async () => {
    fetchSpy.mockImplementation(async () => { throw new TypeError('Failed to fetch'); });
    render(<><RoleAlertBanner /><SettingsScreen /></>);
    const saveBtn = await screen.findByRole('button', { name: /Save backup to Drive/i });
    await userEvent.click(saveBtn);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Couldn.t reach Google Drive/i);
    });
    // Save button is back to enabled (working=false after the catch).
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Save backup to Drive/i })).not.toBeDisabled();
    });
  });

  it('double-click on Save is a no-op (button disabled while working)', async () => {
    let resolveFetch: (r: Response) => void = () => {};
    fetchSpy.mockImplementation(async () => new Promise<Response>((res) => { resolveFetch = res; }));
    render(<><RoleAlertBanner /><SettingsScreen /></>);
    const saveBtn = await screen.findByRole('button', { name: /Save backup to Drive/i });
    // First click begins the (pending) save.
    await userEvent.click(saveBtn);
    // While pending, button text shows "Saving…" and is disabled.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Saving…/i })).toBeDisabled();
    });
    // Try to click again — should be ignored.
    const disabledBtn = screen.getByRole('button', { name: /Saving…/i });
    await userEvent.click(disabledBtn).catch(() => {
      // userEvent.click on a disabled button throws in some configurations.
      // Either way, fetch should not have been called twice.
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    // Resolve the first save so React flushes its state.
    await act(async () => {
      resolveFetch(okJson({ id: 'file-1', modifiedTime: '2026-08-18T12:00:00.000Z' }));
    });
  });
});