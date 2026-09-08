/**
 * ResetPasswordDialog.spec.tsx — exercise the "set a new password"
 * dialog that opens after the user clicks the recovery email link.
 *
 * Covers:
 *   - empty submit blocked at the client (no engine call)
 *   - short password surfaces an inline error
 *   - valid password calls updatePassword + closes the dialog +
 *     renders a success toast
 *   - server-side error (rate-limit) falls through to a toast and
 *     keeps the dialog open
 *   - PASSWORD_RECOVERY from the fake's onAuthStateChange fires the
 *     recovery listener that App.tsx subscribes to (regression for
 *     the wiring in src/domain/sync.ts)
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ResetPasswordDialog } from '../ResetPasswordDialog';
import { Toast } from '../Toast';
import {
  installFakeSupabase,
  __resetSyncForTests,
  __seedAuthUser,
  __setAuthError,
  __simulateRecovery,
} from '../../test/sync-helpers';
import { syncEngine } from '../../domain/sync';
import { useStore } from '../../domain/store';
import * as crossTab from '../crossTabRecovery';
import { captureRecoveryFragment } from '../crossTabRecovery';

beforeEach(async () => {
  __resetSyncForTests();
  installFakeSupabase();
  syncEngine.signOut();
  await syncEngine.init();
  // Simulate the user having just clicked the recovery email link —
  // i.e. this tab is the fragment-receiving tab. Without this, the
  // dialog's cross-tab dedupe would treat every test as an "old tab"
  // and close on mount. The dedupe-specific tests clear this in their
  // own beforeEach.
  window.location.hash = '#access_token=abc&type=recovery';
  captureRecoveryFragment('#access_token=abc&type=recovery');
  // Wipe any leftover toast/banner from a previous test. The Toast
  // component auto-clears after 2.4s, but consecutive tests run
  // faster than that — without this, a toast from the previous
  // test (e.g. "Too many requests") lingers into the next one's
  // assertions and trips up `queryByRole('status')`.
  useStore.setState({ toast: null, banner: null });
});

function renderDialog(onClose = vi.fn()) {
  return render(
    <MemoryRouter>
      <Toast />
      <ResetPasswordDialog open onClose={onClose} />
    </MemoryRouter>,
  );
}

// The Field label renders a <label> with text "New password" and the
// input has aria-label="New password" — both match
// getByLabelText(/new password/i). Query the input directly to avoid
// the duplicate-match error.
function passwordInput() {
  return screen.getByLabelText('New password');
}

describe('ResetPasswordDialog — client-side validation', () => {
  it('blocks empty submit', async () => {
    const user = userEvent.setup();
    renderDialog();
    const submit = screen.getByRole('button', { name: /update password/i });
    expect(submit).toBeDisabled();
    await user.click(submit);
    // No engine call — still no new password persisted.
    expect(syncEngine.getStatus().kind).not.toBe('signed-in-error');
  });

  it('blocks a short password with an inline error', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.type(passwordInput(), 'short');
    const submit = screen.getByRole('button', { name: /update password/i });
    expect(submit).toBeDisabled();
    // The subtitle also mentions "at least 8" — match the danger
    // inline-error copy specifically.
    expect(passwordInput()).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Password must be at least 8 characters.')).toBeInTheDocument();
  });
});

describe('ResetPasswordDialog — happy path', () => {
  it('a valid password calls updatePassword, closes the dialog, and shows a success toast', async () => {
    // Simulate the user having clicked the recovery link and being
    // back in the app — this is what fires PASSWORD_RECOVERY.
    __seedAuthUser('a@b.com', 'old-password-1');
    await syncEngine.signInWithPassword('a@b.com', 'old-password-1');
    __simulateRecovery();

    const user = userEvent.setup();
    const onClose = vi.fn();
    renderDialog(onClose);

    await user.type(passwordInput(), 'fresh-pw1234');
    await user.click(screen.getByRole('button', { name: /update password/i }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    // Toast confirms the rotation.
    await waitFor(() => expect(screen.getByText(/password updated/i)).toBeInTheDocument());
  });
});

describe('ResetPasswordDialog — server error', () => {
  it('a rate-limited update falls through to a toast and keeps the dialog open', async () => {
    __setAuthError({ name: 'AuthApiError', status: 429, message: 'Too many requests' });
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderDialog(onClose);
    await user.type(passwordInput(), 'fresh-pw1234');
    await user.click(screen.getByRole('button', { name: /update password/i }));
    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
    expect(onClose).not.toHaveBeenCalled();
  });

  it('a server-side password-rejection renders inline (not as a toast)', async () => {
    __setAuthError({ name: 'AuthApiError', status: 422, message: 'Password should be at least 8 characters' });
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderDialog(onClose);
    await user.type(passwordInput(), 'fresh-pw1234');
    await user.click(screen.getByRole('button', { name: /update password/i }));
    await waitFor(() => expect(passwordInput()).toHaveAttribute('aria-invalid', 'true'));
    // No toast — the inline error renders below the field.
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('ResetPasswordDialog — recovery wiring', () => {
  it('the PASSWORD_RECOVERY event fires the registered listener', () => {
    const cb = vi.fn();
    syncEngine.onPasswordRecovery(cb);
    __simulateRecovery();
    expect(cb).toHaveBeenCalledTimes(1);
    // Cleanup: unsubscribe on test teardown so callbacks don't leak
    // across tests.
    syncEngine.onPasswordRecovery(() => {})(); // no-op subscribe + unsubscribe
  });
});

describe('ResetPasswordDialog — cross-tab dedupe', () => {
  it('closes immediately on open when this tab is NOT the fragment-receiving tab', async () => {
    // Simulate the OLD tab that was already signed in when the user
    // opened the recovery link in a NEW tab — the supabase-js storage
    // event fires PASSWORD_RECOVERY here, but its URL has no fragment,
    // so the dialog should self-close.
    window.location.hash = '';
    captureRecoveryFragment(''); // clear the boot-time snapshot
    expect(window.location.hash).toBe('');

    const onClose = vi.fn();
    renderDialog(onClose);

    // The close is deferred via setTimeout(0) so the caller's render
    // doesn't see onClose fire synchronously while still mounting.
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('broadcasts recovery-opened when this IS the fragment-receiving tab', () => {
    // The top-level beforeEach already sets the recovery fragment.
    const broadcastSpy = vi.spyOn(crossTab, 'broadcast');

    renderDialog();

    // The dialog's open-effect broadcasts immediately on mount.
    expect(broadcastSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'recovery-opened', tabId: expect.any(String) }),
    );

    broadcastSpy.mockRestore();
  });

  it('a successful update broadcasts recovery-complete', async () => {
    // The dialog only calls updatePassword + broadcast when the URL
    // carries the recovery fragment — that's the "this tab is owning
    // the dialog" assertion. Top-level beforeEach sets the fragment.
    const broadcastSpy = vi.spyOn(crossTab, 'broadcast');
    __seedAuthUser('a@b.com', 'old-password-1');
    await syncEngine.signInWithPassword('a@b.com', 'old-password-1');
    __simulateRecovery();

    const user = userEvent.setup();
    renderDialog(vi.fn());

    await user.type(passwordInput(), 'fresh-pw1234');
    await user.click(screen.getByRole('button', { name: /update password/i }));

    await waitFor(() =>
      expect(broadcastSpy).toHaveBeenCalledWith({ type: 'recovery-complete' }),
    );

    broadcastSpy.mockRestore();
  });
});
