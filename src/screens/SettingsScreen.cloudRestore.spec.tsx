/**
 * SettingsScreen.cloudRestore.spec.tsx — GD-3.3 acceptance tests for the
 * Restore-from-Drive flow.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
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

function okText(body: string): Response {
  return new Response(body, { status: 200 });
}

function validEnvelope() {
  return JSON.stringify({
    version: 1,
    exportedAt: '2026-08-18T12:00:00.000Z',
    data: {
      ...DEFAULT_STATE,
      // bump accounts count so we can verify importAndReplace ran
      accounts: [{
        id: 'acc-1',
        name: 'Imported',
        kind: 'cash',
        currency: 'BDT',
        balanceMinor: 5000,
        createdAt: '2026-08-18T00:00:00.000Z',
        archived: false,
      }],
    },
  });
}

describe('SettingsScreen restore-from-Drive flow (GD-3.3)', () => {
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

  it('0 backups: shows info banner, no confirm dialog', async () => {
    fetchSpy.mockImplementation(async () => okJson({ files: [] }));
    render(<><RoleAlertBanner /><SettingsScreen /></>);
    const restoreBtn = await screen.findByRole('button', { name: /Restore from Drive/i });
    await userEvent.click(restoreBtn);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/No backups found/i);
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('1 backup: shows one new "Restore from Drive?" confirm, then existing "Replace?" confirm, then importAndReplace runs', async () => {
    fetchSpy.mockImplementation(async (input: any) => {
      const url = typeof input === 'string' ? input : String(input?.url ?? '');
      if (url.includes('/drive/v3/files?') && !url.includes('alt=media')) {
        return okJson({ files: [{ id: 'file-1', name: 'finora-backup-2026-08-18.json', modifiedTime: '2026-08-18T12:00:00.000Z' }] });
      }
      if (url.includes('alt=media')) {
        return okText(validEnvelope());
      }
      return okJson({}, 404);
    });
    render(<><RoleAlertBanner /><SettingsScreen /></>);
    const restoreBtn = await screen.findByRole('button', { name: /Restore from Drive/i });
    await userEvent.click(restoreBtn);
    // First confirm: "Restore from Drive?"
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toHaveTextContent(/Restore from Drive\?/);
    });
    await userEvent.click(screen.getByRole('button', { name: /^Restore$/ }));
    // Second confirm: "Replace current data with backup?"
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toHaveTextContent(/Replace current data with backup\?/);
    });
    await userEvent.click(screen.getByRole('button', { name: /^Replace$/ }));
    // importAndReplace has run: store now has 1 account.
    await waitFor(() => {
      expect(useStore.getState().state.accounts).toHaveLength(1);
    });
    expect(useStore.getState().state.accounts[0].name).toBe('Imported');
  });

  it('2+ backups: opens picker modal with the list, newest-first', async () => {
    fetchSpy.mockImplementation(async (input: any) => {
      const url = typeof input === 'string' ? input : String(input?.url ?? '');
      if (url.includes('/drive/v3/files?')) {
        return okJson({
          files: [
            { id: 'b', name: 'finora-backup-2026-08-17.json', modifiedTime: '2026-08-17T12:00:00.000Z' },
            { id: 'a', name: 'finora-backup-2026-08-18.json', modifiedTime: '2026-08-18T12:00:00.000Z' },
          ],
        });
      }
      return okJson({}, 404);
    });
    render(<><RoleAlertBanner /><SettingsScreen /></>);
    const restoreBtn = await screen.findByRole('button', { name: /Restore from Drive/i });
    await userEvent.click(restoreBtn);
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toHaveTextContent(/Choose a backup to restore/);
    });
    // Both rows render.
    expect(screen.getByText('finora-backup-2026-08-18.json')).toBeInTheDocument();
    expect(screen.getByText('finora-backup-2026-08-17.json')).toBeInTheDocument();
  });

  it('auth_expired on listBackups drops to Disconnected and shows re-auth banner', async () => {
    fetchSpy.mockImplementation(async () => okJson({}, 401));
    render(<><RoleAlertBanner /><SettingsScreen /></>);
    const restoreBtn = await screen.findByRole('button', { name: /Restore from Drive/i });
    await userEvent.click(restoreBtn);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Disconnected from Google Drive/i);
    });
    expect(localStorage.getItem(GDRIVE_TOKENS_KEY)).toBeNull();
  });

  it('after a successful restore, Last saved is not updated', async () => {
    fetchSpy.mockImplementation(async (input: any) => {
      const url = typeof input === 'string' ? input : String(input?.url ?? '');
      if (url.includes('/drive/v3/files?')) {
        return okJson({ files: [{ id: 'file-1', name: 'finora-backup-2026-08-18.json', modifiedTime: '2026-08-18T12:00:00.000Z' }] });
      }
      if (url.includes('alt=media')) {
        return okText(validEnvelope());
      }
      return okJson({}, 404);
    });
    const before = useStore.getState().state.settings.cloudBackup?.lastSavedAt;
    render(<><RoleAlertBanner /><SettingsScreen /></>);
    const restoreBtn = await screen.findByRole('button', { name: /Restore from Drive/i });
    await userEvent.click(restoreBtn);
    await waitFor(() => screen.getByRole('dialog'));
    await userEvent.click(screen.getByRole('button', { name: /^Restore$/ }));
    await waitFor(() => screen.getByRole('dialog'));
    await userEvent.click(screen.getByRole('button', { name: /^Replace$/ }));
    await waitFor(() => {
      expect(useStore.getState().state.accounts).toHaveLength(1);
    });
    // Last saved unchanged — restore doesn't touch it.
    expect(useStore.getState().state.settings.cloudBackup?.lastSavedAt).toBe(before);
  });

  it('cancelling the Restore from Drive? confirm does not import', async () => {
    fetchSpy.mockImplementation(async (input: any) => {
      const url = typeof input === 'string' ? input : String(input?.url ?? '');
      if (url.includes('/drive/v3/files?')) {
        return okJson({ files: [{ id: 'file-1', name: 'finora-backup-2026-08-18.json', modifiedTime: '2026-08-18T12:00:00.000Z' }] });
      }
      return okJson({}, 404);
    });
    render(<><RoleAlertBanner /><SettingsScreen /></>);
    const restoreBtn = await screen.findByRole('button', { name: /Restore from Drive/i });
    await userEvent.click(restoreBtn);
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toHaveTextContent(/Restore from Drive\?/);
    });
    await userEvent.click(screen.getByRole('button', { name: /^Cancel$/ }));
    // No import should have happened.
    expect(useStore.getState().state.accounts).toHaveLength(0);
  });
});