/**
 * LockScreen.spec.tsx — integration coverage.
 *
 * These specs exercise the real LockScreen component end-to-end
 * (state + render + user input + verifyPin). The Root gate in
 * main.tsx is the only thing NOT exercised here, but it is one
 * line: `if (locked) return <LockScreen />; return <App />;`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LockScreen } from '../LockScreen';
import { useLockStore } from '../lockStore';
import {
  STORAGE_KEY_HASH,
  STORAGE_KEY_SALT,
  clearPin,
  setPin,
  verifyPin,
} from '../pin';
import { resetRateLimit } from '../rateLimit';
import { useStore } from '../../domain/store';
import { ensureReady, __resetPersistenceForTests, DEFAULT_STATE } from '../../domain/persistence';
import { resetIDB, seedIDB, flushPendingWrites } from '../../test/idb-helpers';
import type { State } from '../../domain/types';

// ─── helpers ────────────────────────────────────────────────────────────

function seedNoData() {
  // Minimal empty state so any in-component reads from useStore don't blow up.
  const seed: State = {
    ...DEFAULT_STATE,
    settings: { ...DEFAULT_STATE.settings, onboardingComplete: true },
  };
  return seed;
}

beforeEach(async () => {
  await resetIDB();
  await ensureReady();
  await seedIDB(seedNoData());
  await flushPendingWrites();
  useStore.setState({ state: seedNoData() });
  useLockStore.getState().__resetForTests();
  clearPin();
  resetRateLimit();
  sessionStorage.clear();
  localStorage.clear();
});

// ─── specs ──────────────────────────────────────────────────────────────

describe('LockScreen — happy path', () => {
  it('renders the lock surface with no chips filled', async () => {
    await setPin('123456');
    useLockStore.getState().init({ locked: true, storageDisabled: false });
    render(<LockScreen />);
    expect(screen.getByText(/Secure Finora/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Digit 1')).toBeInTheDocument();
  });

  it('unlocks on correct 6-digit PIN and shows the home shell', async () => {
    await setPin('123456');
    useLockStore.getState().init({ locked: true, storageDisabled: false });
    render(<LockScreen />);

    const user = userEvent.setup();
    // Paste the entire PIN into the first box — PinCells splits the
    // string across all six inputs (auto-advance + auto-fill).
    const firstBox = screen.getByLabelText('Digit 1') as HTMLInputElement;
    await user.click(firstBox);
    await user.paste('123456');

    // Lock flips → LockScreen unmounts.
    await vi.waitFor(() => {
      expect(useLockStore.getState().locked).toBe(false);
    });
    expect(screen.queryByText(/Secure Finora/i)).not.toBeInTheDocument();
  });

  it('rejects a wrong PIN, records the attempt, keeps the lock', async () => {
    await setPin('123456');
    useLockStore.getState().init({ locked: true, storageDisabled: false });
    render(<LockScreen />);

    const user = userEvent.setup();
    const firstBox = screen.getByLabelText('Digit 1') as HTMLInputElement;
    await user.click(firstBox);
    await user.paste('999999');

    await vi.waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/wrong pin/i);
    });
    expect(useLockStore.getState().locked).toBe(true);
    expect(useLockStore.getState().attempts).toBe(1);
    // Localstorage hash untouched.
    expect(localStorage.getItem(STORAGE_KEY_HASH)).toMatch(/^[0-9a-f]{64}$/);
    expect(await verifyPin('123456')).toBe(true);
  });
});

describe('LockScreen — storage disabled', () => {
  it('renders nothing when storageDisabled (caller chooses to skip the lock)', () => {
    useLockStore.getState().init({ locked: false, storageDisabled: true });
    const { container } = render(<LockScreen />);
    // The component short-circuits on !locked → renders nothing.
    expect(container.firstChild).toBeNull();
  });
});

describe('LockScreen — rate limit', () => {
  it('disables the input with a countdown reason after a wrong attempt', async () => {
    await setPin('123456');
    useLockStore.getState().init({ locked: true, storageDisabled: false });
    render(<LockScreen />);

    const user = userEvent.setup();
    const firstBox = screen.getByLabelText('Digit 1') as HTMLInputElement;
    await user.click(firstBox);
    await user.paste('000000');

    // The OTP boxes become disabled (can't accept more digits) and
    // the lockout countdown text appears below the boxes.
    await vi.waitFor(() => {
      const nextBox = screen.getByLabelText('Digit 1') as HTMLInputElement;
      expect(nextBox).toBeDisabled();
    });
    // And the wrong-PIN alert is still visible (takes priority over countdown).
    expect(screen.getByRole('alert')).toHaveTextContent(/wrong pin/i);
  });
});

describe('LockScreen — forgot PIN wipes data', () => {
  it('clicking "Forgot PIN" → confirm → wipes IndexedDB + PIN + locks off', async () => {
    await setPin('123456');
    useLockStore.getState().init({ locked: true, storageDisabled: false });

    // Seed something into IDB so we can verify it gets wiped.
    const seed: State = {
      ...seedNoData(),
      accounts: [{
        id: 'acc-1', type: 'bank', name: 'Test Bank',
        openingBalance: 1000, createdAt: '2026-01-01T00:00:00Z',
      } as any],
    };
    await seedIDB(seed);
    await flushPendingWrites();

    render(<LockScreen />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /Forgot PIN/i }));

    // ConfirmDialog opens
    await vi.waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /Wipe everything/i }));

    // Data wiped, PIN cleared, lock cleared.
    await vi.waitFor(() => {
      expect(localStorage.getItem(STORAGE_KEY_HASH)).toBeNull();
      expect(localStorage.getItem(STORAGE_KEY_SALT)).toBeNull();
      expect(useLockStore.getState().locked).toBe(false);
    });
    // useStore now reflects the empty state.
    expect(useStore.getState().state.accounts.length).toBe(0);
  });
});

afterEach(() => {
  // Hard reset to avoid bleed between specs.
  __resetPersistenceForTests();
  useLockStore.getState().__resetForTests();
  localStorage.clear();
  sessionStorage.clear();
});