/**
 * cloud.spec.ts — FIN-C02 … FIN-C04.
 *
 * The cloud-sync flows that need a LIVE backend: the sign-in and
 * sign-up error paths, the signed-in panel with a forced sync, and the
 * sign-out / password flows.
 *
 * Each manual case becomes EXACTLY ONE test, titled with its manual
 * ID and the manual title verbatim. Every `**Priority:** High` case
 * carries the `@smoke` tag — in the details object, never in the
 * title.
 *
 * FIN-C01 (the sync-disabled build) lives in
 * `cloud.nosync.spec.ts`, because its precondition needs its own
 * build.
 *
 * ## Why these skip by default
 *
 * Finora has NO first-party HTTP API. Cloud sync is Supabase, and
 * the app only builds a client when BOTH `BASE_URL` and
 * `BASE_ANON_KEY` are present at build time (`src/lib/supabase.ts`
 * reads them through `vite.config.ts`'s `define` block). Without
 * them `supabase === null` and every signed-in flow is unreachable.
 *
 * So these cases **skip loudly** — never silently — when the env is
 * missing. A silent skip would make the suite look green while
 * proving nothing, which is exactly what the manual plan's run-log
 * rule forbids.
 *
 * ## The inline-error timing
 *
 * `SignInDialog` renders its client-side validation errors LIVE:
 * `emailError = fieldErrors.email ?? (touched.email && !emailValid ? … : undefined)`.
 * So an invalid email shows its error as soon as the field has been
 * touched — the user does NOT have to press "Sign in", and cannot:
 * the submit button is disabled until both fields are valid
 * (`canSubmit = emailValid && passwordValid`).
 *
 * The server-side errors (wrong password, email taken, weak
 * password) come back from `mapAuthErrorToField` AFTER a submit, so
 * those rows do press the button.
 */
import { expect, test } from '@playwright/test';
import { SettingsPage } from '../pages/SettingsPage';
import { Feedback } from '../pages/component/Feedback';
import { readState, seedState } from '../fixtures/app-state';
import { baseState, todayTransactions } from '../fixtures/seed-data';
import { envValue, requireEnv } from '../support/env';
import { uniqueEmail } from '../support/unique-email';
import authJson from '../../data/auth.json' with { type: 'json' };

const data = authJson;

/**
 * Is a live Supabase backend configured?
 *
 * `envValue` (not `process.env`) so a developer's `.env.local`
 * counts — that is the same precedence the app's own loader uses.
 * `envValue` returns `undefined` for an EMPTY value, so a
 * placeholder `.env.local` correctly reads as "not configured".
 */
const BACKEND = Boolean(envValue('BASE_URL') && envValue('BASE_ANON_KEY'));

const SKIP_REASON =
  'No Supabase backend configured (BASE_URL / BASE_ANON_KEY unset) — the ' +
  'signed-in cloud flows cannot run without a live backend.';

/** The email the cloud test account signs in with. */
function userEmail(): string {
  return envValue('FINORA_E2E_USER_EMAIL') ?? data.validCredentials.email;
}

/** The password the cloud test account signs in with. */
function userPassword(): string {
  return requireEnv(data.validCredentials.passwordEnv);
}

/**
 * A fresh address for the sign-up rows.
 *
 * Sign-up is one-shot — a second attempt with the same address
 * returns "User already registered" — so the address carries a
 * per-run suffix. See `test/e2e/support/unique-email.ts`.
 */
function newSignupEmail(): string {
  return uniqueEmail(
    envValue('FINORA_E2E_NEW_USER_EMAIL') ?? data.validCredentials.email,
  );
}

test.describe('Cloud sync', () => {
  let settings: SettingsPage;
  let feedback: Feedback;

  test.beforeEach(async ({ page }) => {
    settings = new SettingsPage(page);
    feedback = new Feedback(page);
  });

  test('FIN-C02 Sign-in and sign-up errors', { tag: '@smoke' }, async () => {
    test.skip(!BACKEND, SKIP_REASON);

    const errors = data.C02_errors;
    const email = userEmail();
    const password = userPassword();

    await test.step('Open Settings and click "Sign in"', async () => {
      await settings.goto();
      await settings.signInButton.click();
      await expect(settings.signInDialog).toBeVisible();
    });

    await test.step('Row 1 — sign in with an invalid email', async () => {
      // The error is LIVE: the field reports it as soon as it has
      // been touched, and the submit button stays disabled because
      // the form is not valid.
      await settings.signInDialogEmailInput.fill(errors.invalidEmail.email);
      await settings.signInDialogPasswordInput.fill(password);

      await expect(settings.signInEmailError).toHaveText(
        errors.invalidEmail.expectedError,
      );
      await expect(settings.signInSubmitButton).toBeDisabled();
    });

    await test.step('Row 2 — sign in with a correct email and a wrong password', async () => {
      await settings.signInDialogEmailInput.fill(email);
      await settings.signInDialogPasswordInput.fill(
        requireEnv(errors.wrongPassword.passwordEnv),
      );
      await settings.signInSubmitButton.click();

      await expect(settings.signInEmailError).toHaveText(
        errors.wrongPassword.expectedError,
      );
    });

    await test.step('Row 3 — sign up with an email that already exists', async () => {
      await settings.signInTab('Create account').click();
      await settings.signInDialogEmailInput.fill(email);
      await settings.signInDialogPasswordInput.fill(errors.existingEmail.password);
      await settings.signInSubmitButton.click();

      await expect(settings.signInEmailError).toHaveText(
        errors.existingEmail.expectedError,
      );
    });

    await test.step('Row 4 — sign up with a 7-character password', async () => {
      await settings.signInTab('Create account').click();
      await settings.signInDialogEmailInput.fill(newSignupEmail());
      await settings.signInDialogPasswordInput.fill(
        errors.shortPassword.password,
      );

      // The client-side floor is 8 characters, so the password is
      // rejected before it reaches the server. The button is disabled.
      await expect(settings.signInSubmitButton).toBeDisabled();
    });

    await test.step('Row 5 — sign up with a new email and an 8-character password', async () => {
      await settings.signInTab('Create account').click();
      await settings.signInDialogEmailInput.fill(newSignupEmail());
      await settings.signInDialogPasswordInput.fill(errors.newEmail.password);
      await settings.signInSubmitButton.click();

      // Either the account was created and the user is signed in, or
      // the deployment demands an email confirmation. The manual case
      // accepts both, so the assertion accepts both.
      await expect(feedback.toastTitle).toHaveText(
        new RegExp(
          `^(${errors.newEmail.expectedToast}|${errors.newEmail.alternativeToast})$`,
        ),
      );

      if ((await feedback.toastTitle.textContent()) === errors.newEmail.expectedToast) {
        await expect(feedback.toastBody).toHaveText(
          errors.newEmail.expectedToastBody,
        );
      }
    });
  });

  test('FIN-C03 The signed-in state, a forced sync and the offline queue', async ({ page }) => {
    test.skip(!BACKEND, SKIP_REASON);

    const expected = data.C03_signedIn.expected;

    await test.step('Sign in and read the Cloud sync panel', async () => {
      await settings.goto();
      await settings.signInButton.click();
      await settings.signInDialogEmailInput.fill(userEmail());
      await settings.signInDialogPasswordInput.fill(userPassword());
      await settings.signInSubmitButton.click();

      // "Signed in as" with the email.
      await expect(settings.signedInAsLabel).toHaveText(expected.signedInAs);
      await expect(settings.signedInEmail).toHaveText(userEmail());

      // "Last synced" reads one of the relative forms.
      await expect(settings.lastSyncedValue).toHaveText(
        new RegExp(`^(${expected.lastSyncedValues.join('|')}|\\d+[smhd] ago)$`),
      );

      // The three signed-in buttons.
      await expect(settings.forceSyncButton).toHaveText(expected.buttons[0]);
      await expect(settings.changePasswordButton).toHaveText(expected.buttons[1]);
      await expect(settings.signOutButton).toHaveText(expected.buttons[2]);
    });

    await test.step('Tap "Force sync now"', async () => {
      await settings.forceSyncButton.click();

      // The toast.
      await expect(feedback.toastTitle).toHaveText(expected.syncToast);

      // "Last synced" becomes "just now".
      await expect(settings.lastSyncedValue).toHaveText(
        expected.lastSyncedValues[1],
      );
    });

    await test.step('Switch the browser to offline', async () => {
      await page.context().setOffline(true);

      // The pill flips to the offline state.
      await expect(settings.syncStatusPill).toHaveText(
        new RegExp(`^${expected.pillLabels[4]}`),
      );
    });

    await test.step('Switch back online and watch the queue flush', async () => {
      await page.context().setOffline(false);

      // The queued changes flush and the pill reads "Synced".
      await expect(settings.syncStatusPill).toHaveText(
        new RegExp(`^${expected.pillLabels[2]}`),
      );
    });
  });

  test('FIN-C04 Sign out, sign back in and the password flows', { tag: '@smoke' }, async ({ page }) => {
    test.skip(!BACKEND, SKIP_REASON);

    const expected = data.C04_signOut.expected;

    // A store with data in it, so the sign-out wipe is observable.
    const state = baseState();
    state.transactions = todayTransactions();

    await test.step('Sign in with data present locally', async () => {
      await seedState(page, state);
      await settings.goto();
      await settings.signInButton.click();
      await settings.signInDialogEmailInput.fill(userEmail());
      await settings.signInDialogPasswordInput.fill(userPassword());
      await settings.signInSubmitButton.click();

      await expect(settings.signedInAsLabel).toBeVisible();
    });

    await test.step('Tap "Sign out" and read the local data', async () => {
      await settings.signOutButton.click();

      await expect(feedback.toastTitle).toHaveText(expected.signOutToast);

      // The local store is wiped: accounts, transactions, goals,
      // debts, investments and plans are all gone.
      const wiped = await readState(page);
      expect(wiped?.accounts ?? []).toHaveLength(0);
      expect(wiped?.transactions ?? []).toHaveLength(0);
      expect(wiped?.goals ?? []).toHaveLength(0);
      expect(wiped?.debts ?? []).toHaveLength(0);
      expect(wiped?.investments ?? []).toHaveLength(0);
      expect(wiped?.monthPlans ?? []).toHaveLength(0);
      expect(wiped?.eventPlans ?? []).toHaveLength(0);
    });

    await test.step('Sign back in with the same credentials', async () => {
      await settings.signInButton.click();
      await settings.signInDialogEmailInput.fill(userEmail());
      await settings.signInDialogPasswordInput.fill(userPassword());
      await settings.signInSubmitButton.click();

      await expect(settings.signedInAsLabel).toBeVisible();
    });

    await test.step('Read the local data again', async () => {
      // The cloud row is adopted through last-write-wins and the
      // snapshot reappears — no manual export or import.
      await expect
        .poll(
          async () => {
            const restored = await readState(page);
            return (restored?.accounts ?? []).length;
          },
          { timeout: 15_000 },
        )
        .toBeGreaterThan(0);
    });

    await test.step('Tap "Change password", set a new one, and confirm', async () => {
      await settings.changePasswordButton.click();

      await expect(settings.changePasswordDialog).toBeVisible();
      await expect(settings.changePasswordDialog).toContainText(
        expected.changePasswordTitle,
      );
      await expect(settings.changePasswordDialog).toContainText(
        expected.changePasswordBody,
      );
      await expect(settings.newPasswordInput).toBeVisible();
      await expect(settings.updatePasswordButton).toHaveText(
        expected.updateButton,
      );

      await settings.newPasswordInput.fill(data.C04_signOut.newPassword);
      await settings.updatePasswordButton.click();

      await expect(feedback.toastTitle).toHaveText(
        expected.passwordUpdatedToast,
      );
      await expect(feedback.toastBody).toHaveText(expected.passwordUpdatedBody);
    });

    await test.step('Change the password back, so the suite stays re-runnable', async () => {
      // Changing the password is a REAL mutation of the shared test
      // account — it is not undone by signing out. So the original
      // password is restored before the test ends, otherwise the
      // second run would fail at the sign-in step with the wrong
      // credentials.
      await settings.changePasswordButton.click();
      await expect(settings.changePasswordDialog).toBeVisible();

      await settings.newPasswordInput.fill(userPassword());
      await settings.updatePasswordButton.click();

      await expect(feedback.toastTitle).toHaveText(
        expected.passwordUpdatedToast,
      );
    });

    await test.step('Click "Forgot password?" and "Send reset link"', async () => {
      // Sign out first — the reset link is requested from the
      // signed-out panel, which is where a user who forgot their
      // password would start.
      await settings.signOutButton.click();
      await expect(feedback.toastTitle).toHaveText(expected.signOutToast);

      await settings.signInButton.click();
      await settings.forgotPasswordLink.click();

      // The dialog switched to its RESET mode: the headline is
      // "Reset your password" and the "Send reset link" button
      // replaces the sign-in / create-account pair.
      await expect(settings.resetPasswordPanel).toBeVisible();
      await expect(settings.resetPasswordPanel).toContainText(
        expected.resetPanelTitle,
      );
      await expect(settings.sendResetLinkButton).toBeVisible();

      // The panel is in RESET mode now, so the tablist is hidden —
      // the email field is scoped to the DIALOG, not to the tablist.
      await settings.signInDialogEmailInput.fill(userEmail());
      await settings.sendResetLinkButton.click();

      // The panel swaps to "Check your email".
      await expect(settings.resetPasswordPanel).toContainText(
        expected.resetSentTitle,
      );
    });
  });
});
