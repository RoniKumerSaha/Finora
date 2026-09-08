/**
 * SignInDialog.spec.tsx — exercise the password sign-in / sign-up flow.
 *
 * Covers the user-visible behavior of the dialog:
 *   - empty / invalid-email / short-password submit is blocked at the
 *     client (no engine call, inline error visible)
 *   - a valid sign-in dispatches to syncEngine.signInWithPassword and
 *     closes the dialog
 *   - a server-side auth error (wrong password, user exists, etc.)
 *     surfaces via the toast layer and keeps the dialog open
 *   - the Sign in / Create account toggle re-labels the primary
 *     button and switches the password field's autoComplete hint
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SignInDialog } from '../SignInDialog';
import { Toast } from '../Toast';
import {
  installFakeSupabase,
  __resetSyncForTests,
  __seedAuthUser,
  __setAuthError,
} from '../../test/sync-helpers';
import { syncEngine } from '../../domain/sync';
import { useStore } from '../../domain/store';
import { resetIDB } from '../../test/idb-helpers';

beforeEach(async () => {
  __resetSyncForTests();
  await resetIDB();
  installFakeSupabase();
  // Reset the production singleton to a clean state so each test
  // starts signed-out (the fake's authState is shared between tests
  // until __resetSyncForTests runs above).
  syncEngine.signOut();
  // init() registers the onAuthStateChange listener that flips the
  // engine to signed-in after a successful sign-in. Production
  // main.tsx calls init() at boot before any UI mounts; do the same
  // here so the dialog's onClose → status assertion holds.
  await syncEngine.init();
  // Wipe stale toast/banner so a previous test's "Too many requests"
  // (or similar) doesn't leak into the next one's assertions.
  useStore.setState({ toast: null, banner: null });
});

function renderDialog() {
  return render(
    <MemoryRouter>
      <Toast />
      <SignInDialog open onClose={() => { /* noop for these specs */ }} />
    </MemoryRouter>,
  );
}

describe('SignInDialog — client-side validation', () => {
  it('blocks empty submit', async () => {
    const user = userEvent.setup();
    renderDialog();
    // Primary button is disabled when both fields are empty.
    const submit = screen.getByRole('button', { name: /^sign in$/i });
    expect(submit).toBeDisabled();
    await user.click(submit);
    // No engine call happened — no signed-in state.
    expect(syncEngine.getStatus().kind).toBe('signed-out');
  });

  it('blocks an invalid email with an inline error', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.type(screen.getByLabelText(/email/i), 'not-an-email');
    await user.type(screen.getByLabelText(/password/i), 'longenoughpw');
    const submit = screen.getByRole('button', { name: /^sign in$/i });
    expect(submit).toBeDisabled();
    // Inline error renders below the field.
    expect(screen.getByText(/enter a valid email/i)).toBeInTheDocument();
    expect(syncEngine.getStatus().kind).toBe('signed-out');
  });

  it('blocks a short password with an inline error', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.type(screen.getByLabelText(/email/i), 'a@b.co');
    await user.type(screen.getByLabelText(/password/i), 'short');
    const submit = screen.getByRole('button', { name: /^sign in$/i });
    expect(submit).toBeDisabled();
    expect(screen.getByText(/at least 8/i)).toBeInTheDocument();
    expect(syncEngine.getStatus().kind).toBe('signed-out');
  });
});

describe('SignInDialog — sign-in flow', () => {
  it('a valid sign-in calls signInWithPassword and closes the dialog', async () => {
    __seedAuthUser('a@b.com', 'correct-horse');
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <MemoryRouter>
        <SignInDialog open onClose={onClose} />
      </MemoryRouter>,
    );
    await user.type(screen.getByLabelText(/email/i), 'a@b.com');
    await user.type(screen.getByLabelText(/password/i), 'correct-horse');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(syncEngine.getStatus().kind).toBe('signed-in-synced');
    expect(syncEngine.getEmail()).toBe('a@b.com');
  });

  it('a wrong password surfaces an inline error on the email field and keeps the dialog open', async () => {
    __seedAuthUser('a@b.com', 'correct-horse');
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <MemoryRouter>
        <SignInDialog open onClose={onClose} />
      </MemoryRouter>,
    );
    await user.type(screen.getByLabelText(/email/i), 'a@b.com');
    await user.type(screen.getByLabelText(/password/i), 'wrong-pw');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));
    // "Invalid login credentials" maps to the email field inline.
    // The field's aria-invalid flips and the error text renders below it.
    await waitFor(() => expect(screen.getByLabelText(/email/i)).toHaveAttribute('aria-invalid', 'true'));
    expect(screen.getByText(/don.?t match/i)).toBeInTheDocument();
    // No toast for this case — it's an inline form error.
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    // Engine stays signed-out (the fake never flipped authState).
    expect(syncEngine.getStatus().kind).toBe('signed-out');
  });
});

describe('SignInDialog — forgot password', () => {
  it('the link is visible in sign-in mode and hidden in create-account mode', async () => {
    const user = userEvent.setup();
    renderDialog();
    // Default mode is sign-in.
    expect(screen.getByRole('button', { name: /forgot password\?/i })).toBeInTheDocument();
    // Switch to create-account.
    await user.click(screen.getByRole('tab', { name: /create account/i }));
    expect(screen.queryByRole('button', { name: /forgot password\?/i })).not.toBeInTheDocument();
  });

  it('clicking the link opens the inline reset panel; submit fires resetPasswordForEmail', async () => {
    // Spy on the engine call rather than stubbing the method (the
    // dialog calls `syncEngine.resetPasswordForEmail(...)` directly,
    // and overwriting the method would also affect the spy).
    const orig = syncEngine.resetPasswordForEmail;
    let calledWith: string | null = null;
    syncEngine.resetPasswordForEmail = async (email: string) => {
      calledWith = email;
    };
    try {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(
        <MemoryRouter>
          <Toast />
          <SignInDialog open onClose={onClose} />
        </MemoryRouter>,
      );
      await user.click(screen.getByRole('button', { name: /forgot password\?/i }));
      // Inline reset panel: same email field, primary "Send reset link",
      // secondary "Back to sign in". The sign-in mode toggle is hidden
      // while in reset mode.
      expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /back to sign in/i })).toBeInTheDocument();
      expect(screen.queryByRole('tab', { name: /create account/i })).not.toBeInTheDocument();

      await user.type(emailInput(), 'a@b.com');
      await user.click(screen.getByRole('button', { name: /send reset link/i }));
      expect(calledWith).toBe('a@b.com');
      // Engine call succeeded → dialog flips to the "check your email"
      // confirmation panel. Dialog stays open.
      await waitFor(() => expect(screen.getByText(/check your email/i)).toBeInTheDocument());
      expect(onClose).not.toHaveBeenCalled();
    } finally {
      syncEngine.resetPasswordForEmail = orig;
    }
  });
});

// The Field label renders a <label> with text "Email" and the input
// has aria-label="Email address" — both match
// getByLabelText(/email/i). Query the input directly to avoid the
// duplicate-match error.
function emailInput() {
  return screen.getByLabelText('Email address');
}

describe('SignInDialog — sign-up flow', () => {
  it('the mode toggle re-labels the primary button and changes autoComplete', async () => {
    const user = userEvent.setup();
    renderDialog();
    // Default mode is "Sign in".
    expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toHaveAttribute('autoComplete', 'current-password');

    // Switch to "Create account".
    const createTab = screen.getByRole('tab', { name: /create account/i });
    await user.click(createTab);
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toHaveAttribute('autoComplete', 'new-password');
  });

  it('a successful sign-up issues a session and closes the dialog', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <MemoryRouter>
        <SignInDialog open onClose={onClose} />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('tab', { name: /create account/i }));
    await user.type(screen.getByLabelText(/email/i), 'new@example.com');
    await user.type(screen.getByLabelText(/password/i), 'fresh-pw123');
    await user.click(screen.getByRole('button', { name: /create account/i }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    // The fake's signUp flipped authState — engine sees a session.
    expect(syncEngine.getStatus().kind).toBe('signed-in-synced');
    expect(syncEngine.getEmail()).toBe('new@example.com');
  });

  it('a sign-up that returns requiresEmailConfirmation=true shows a check-your-email toast', async () => {
    // Inject an AuthApiError with a 500 status — but we want signUp to
    // SUCCEED without a session. Override the fake's signUp directly.
    const fake = (syncEngine as unknown as { __setClientForTests: (c: unknown) => void });
    // We need a more invasive swap — easier to just stub signUpWithPassword.
    const orig = syncEngine.signUpWithPassword;
    syncEngine.signUpWithPassword = async () => ({ requiresEmailConfirmation: true });
    try {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(
        <MemoryRouter>
          <Toast />
          <SignInDialog open onClose={onClose} />
        </MemoryRouter>,
      );
      await user.click(screen.getByRole('tab', { name: /create account/i }));
      await user.type(screen.getByLabelText(/email/i), 'pending@example.com');
      await user.type(screen.getByLabelText(/password/i), 'fresh-pw123');
      await user.click(screen.getByRole('button', { name: /create account/i }));
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      // Toast appears with "Check your email" copy.
      await waitFor(() => expect(screen.getByText(/check your email/i)).toBeInTheDocument());
    } finally {
      syncEngine.signUpWithPassword = orig;
      // Reference to suppress unused-var if any.
      void fake;
    }
  });

  it('a sign-up error (user already exists) surfaces an inline email error and keeps the dialog open', async () => {
    __setAuthError({ name: 'AuthApiError', status: 422, message: 'User already registered' });
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <MemoryRouter>
        <SignInDialog open onClose={onClose} />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('tab', { name: /create account/i }));
    await user.type(screen.getByLabelText(/email/i), 'dup@example.com');
    await user.type(screen.getByLabelText(/password/i), 'fresh-pw123');
    await user.click(screen.getByRole('button', { name: /create account/i }));
    // Email field flips to aria-invalid and shows an inline error
    // pointing the user at "Sign in" instead. No toast.
    await waitFor(() => expect(screen.getByLabelText(/email/i)).toHaveAttribute('aria-invalid', 'true'));
    expect(screen.getByText(/already exists/i)).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
