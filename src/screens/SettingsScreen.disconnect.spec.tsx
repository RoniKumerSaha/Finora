/**
 * SettingsScreen.disconnect.spec.tsx — GD-3.4 acceptance tests.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, cleanup, within } from '@testing-library/react';
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

describe('SettingsScreen disconnect UX (GD-3.4)', () => {
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
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
  });

  afterEach(() => {
    cleanup();
    fetchSpy.mockRestore();
    vi.unstubAllEnvs();
    googleDrive.__test__resetLifecycle();
  });

  it('clicking Disconnect shows the confirm dialog with the standard copy', async () => {
    render(<><RoleAlertBanner /><SettingsScreen /></>);
    const disconnectBtn = await screen.findByRole('button', { name: /Disconnect/i });
    await userEvent.click(disconnectBtn);
    expect(screen.getByRole('dialog')).toHaveTextContent(/Disconnect Google Drive\?/);
    expect(screen.getByRole('dialog')).toHaveTextContent(/local backup/i);
    expect(screen.getByRole('dialog')).toHaveTextContent(/Connect Google Drive/);
  });

  it('cancelling the confirm leaves tokens intact', async () => {
    render(<><RoleAlertBanner /><SettingsScreen /></>);
    const disconnectBtn = await screen.findByRole('button', { name: /Disconnect/i });
    await userEvent.click(disconnectBtn);
    const dialog = await screen.findByRole('dialog');
    const cancelBtn = await within(dialog).findByRole('button', { name: /^Cancel$/ });
    await userEvent.click(cancelBtn);
    expect(localStorage.getItem(GDRIVE_TOKENS_KEY)).not.toBeNull();
    // Section still shows the email + Disconnect link.
    expect(screen.getByText(/me@example\.com/)).toBeInTheDocument();
  });

  it('confirming Disconnect clears tokens and shows the standard three-part banner', async () => {
    render(<><RoleAlertBanner /><SettingsScreen /></>);
    const disconnectBtn = await screen.findByRole('button', { name: /Disconnect/i });
    await userEvent.click(disconnectBtn);
    const dialog = await screen.findByRole('dialog');
    const confirmBtn = await within(dialog).findByRole('button', { name: /Disconnect/ });
    await userEvent.click(confirmBtn);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Disconnected from Google Drive/i);
    });
    // Banner has all three parts: what, why, fix.
    const banner = screen.getByRole('alert');
    expect(banner).toHaveTextContent(/local backup/);
    expect(banner).toHaveTextContent(/Connect Google Drive/);
    // localStorage key gone.
    expect(localStorage.getItem(GDRIVE_TOKENS_KEY)).toBeNull();
  });

  it('after disconnect, the section transitions back to the Connect button view', async () => {
    render(<><RoleAlertBanner /><SettingsScreen /></>);
    const disconnectBtn = await screen.findByRole('button', { name: /Disconnect/i });
    await userEvent.click(disconnectBtn);
    const dialog = await screen.findByRole('dialog');
    const confirmBtn = await within(dialog).findByRole('button', { name: /Disconnect/ });
    await userEvent.click(confirmBtn);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Connect Google Drive/i })).toBeInTheDocument();
    });
    expect(screen.queryByText(/me@example\.com/)).not.toBeInTheDocument();
  });
});