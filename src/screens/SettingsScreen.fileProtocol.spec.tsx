/**
 * SettingsScreen.fileProtocol.spec.tsx — GD-4.1 acceptance tests.
 *
 * Validates that the Cloud backup section is hidden when the app is
 * running from a file:// URL, even when the feature flag is on and
 * GIS is ready.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { RoleAlertBanner } from '../components/RoleAlertBanner';
import { SettingsScreen } from './SettingsScreen';
import * as googleDrive from '../lib/googleDrive';
import { useStore } from '../domain/store';
import { DEFAULT_STATE } from '../domain/persistence';

function setLocationProtocol(protocol: string) {
  // happy-dom exposes window.location but it's read-only; we patch the
  // protocol property via Object.defineProperty.
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { protocol },
  });
}

describe('SettingsScreen file:// hiding (GD-4.1)', () => {
  let originalLocation: any;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    originalLocation = (window as any).location;
    localStorage.clear();
    useStore.setState({ state: { ...DEFAULT_STATE } });
    googleDrive.__test__resetLifecycle();
    googleDrive.__test__markGisReady();
    vi.unstubAllEnvs();
    vi.stubEnv('VITE_FEATURE_GDRIVE_SYNC', 'true');
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test.apps.googleusercontent.com');
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    Object.defineProperty(window, 'location', Object.getOwnPropertyDescriptor(window, 'location') || {});
    // Restore happy-dom's default location.
    if (originalLocation) {
      Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
    }
    warnSpy.mockRestore();
    vi.unstubAllEnvs();
    googleDrive.__test__resetLifecycle();
  });

  it('does NOT render the Cloud backup section when on file://', async () => {
    setLocationProtocol('file:');
    render(<><RoleAlertBanner /><SettingsScreen /></>);
    // Give the lazy chunk a tick to resolve.
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText(/Cloud backup \(Google Drive\)/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Connect Google Drive/i })).not.toBeInTheDocument();
  });

  it('emits a dev console.warn when the Cloud section is hidden because of file://', async () => {
    setLocationProtocol('file:');
    render(<><RoleAlertBanner /><SettingsScreen /></>);
    await new Promise((r) => setTimeout(r, 0));
    expect(warnSpy).toHaveBeenCalled();
    const call = warnSpy.mock.calls.find((c) => String(c[0]).includes('file://'));
    expect(call).toBeDefined();
  });

  it('renders the Cloud backup section when on http://localhost', async () => {
    setLocationProtocol('http:');
    render(<><RoleAlertBanner /><SettingsScreen /></>);
    expect(await screen.findByText(/Cloud backup \(Google Drive\)/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Connect Google Drive/i })).toBeInTheDocument();
  });

  it('renders the Cloud backup section when on https://', async () => {
    setLocationProtocol('https:');
    render(<><RoleAlertBanner /><SettingsScreen /></>);
    expect(await screen.findByText(/Cloud backup \(Google Drive\)/i)).toBeInTheDocument();
  });

  it('the local Export/Import card still renders on file://', () => {
    setLocationProtocol('file:');
    render(<><RoleAlertBanner /><SettingsScreen /></>);
    expect(screen.getByRole('button', { name: /Export backup/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Import backup/i })).toBeInTheDocument();
  });
});

describe('SettingsScreen file:// degradation banner (GD-4.2)', () => {
  let originalLocation: any;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    originalLocation = (window as any).location;
    localStorage.clear();
    useStore.setState({ state: { ...DEFAULT_STATE } });
    googleDrive.__test__resetLifecycle();
    googleDrive.__test__markGisReady();
    vi.unstubAllEnvs();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    if (originalLocation) {
      Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
    }
    warnSpy.mockRestore();
    vi.unstubAllEnvs();
    googleDrive.__test__resetLifecycle();
  });

  it('does NOT show the notice when the feature flag is off', () => {
    vi.stubEnv('VITE_FEATURE_GDRIVE_SYNC', '');
    setLocationProtocol('file:');
    render(<><RoleAlertBanner /><SettingsScreen /></>);
    expect(screen.queryByTestId('file-protocol-notice')).not.toBeInTheDocument();
  });

  it('shows the notice when the flag is on AND on file://', () => {
    vi.stubEnv('VITE_FEATURE_GDRIVE_SYNC', 'true');
    setLocationProtocol('file:');
    render(<><RoleAlertBanner /><SettingsScreen /></>);
    const notice = screen.getByTestId('file-protocol-notice');
    expect(notice).toBeInTheDocument();
    expect(notice.textContent).toMatch(/Cloud backup requires hosting/);
    expect(notice.textContent).toMatch(/Netlify|Vercel|GitHub Pages/);
  });

  it('does NOT show the notice when hosted on https://', () => {
    vi.stubEnv('VITE_FEATURE_GDRIVE_SYNC', 'true');
    setLocationProtocol('https:');
    render(<><RoleAlertBanner /><SettingsScreen /></>);
    expect(screen.queryByTestId('file-protocol-notice')).not.toBeInTheDocument();
  });

  it('does NOT show the notice when hosted on http://localhost', () => {
    vi.stubEnv('VITE_FEATURE_GDRIVE_SYNC', 'true');
    setLocationProtocol('http:');
    render(<><RoleAlertBanner /><SettingsScreen /></>);
    expect(screen.queryByTestId('file-protocol-notice')).not.toBeInTheDocument();
  });

  // GD-4.5 — visual regression: with the flag off, the Settings screen
  // renders the same as it did before V1.1 (no Cloud section, no banner).
  it('with the flag off, the Settings screen renders identically to V1.0', () => {
    vi.stubEnv('VITE_FEATURE_GDRIVE_SYNC', '');
    setLocationProtocol('http:');
    render(<><RoleAlertBanner /><SettingsScreen /></>);
    expect(screen.queryByText(/Cloud backup \(Google Drive\)/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('file-protocol-notice')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Connect Google Drive/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Save backup to Drive/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Restore from Drive/i })).not.toBeInTheDocument();
    // Existing local-only controls still render.
    expect(screen.getByRole('button', { name: /Export backup/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Import backup/i })).toBeInTheDocument();
  });
});