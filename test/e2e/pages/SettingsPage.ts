/**
 * SettingsPage — the Settings screen (`/settings`).
 *
 * `src/screens/SettingsScreen.tsx` is a two-column layout:
 *
 *   - **Left column**
 *     1. `SecuritySection` — the PIN card (`data-testid="security-section"`).
 *     2. `AccountSection` — the Cloud sync card.
 *     3. A **Backup** card — "Export backup" / "Import backup".
 *     4. The **Danger zone** — "Wipe all data".
 *   - **Right column** — the **About** panel, with the
 *     "Erase everything and start over →" link.
 *
 * The PIN state lives OUTSIDE the persisted `State` blob (the salt and
 * hash sit in `localStorage`, the rate-limit counters in
 * `sessionStorage`), so the security tests need their own fixture
 * helpers rather than a `SeedState`.
 */
import type { Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class SettingsPage extends BasePage {
  // ── Screen chrome ──

  get screenHeading(): Locator {
    return this.page.getByRole('heading', { level: 1, name: 'Settings' });
  }

  get subLine(): Locator {
    return this.page.getByText('Backup and reset.', { exact: true });
  }

  // ── Security card ──

  /** The PIN card. */
  get securitySection(): Locator {
    return this.page.getByTestId('security-section');
  }

  /** The "Set PIN" button — present only when no PIN is configured. */
  get setPinButton(): Locator {
    return this.page.getByRole('button', { name: 'Set PIN', exact: true });
  }

  /** The "Change PIN" button — present only when a PIN is configured. */
  get changePinButton(): Locator {
    return this.page.getByRole('button', { name: 'Change PIN', exact: true });
  }

  /** The "Disable PIN" button — present only when a PIN is configured. */
  get disablePinButton(): Locator {
    return this.page.getByRole('button', { name: 'Disable PIN', exact: true });
  }

  /** The "there's no recovery" footnote under the security card. */
  get forgotPinNote(): Locator {
    return this.page.getByText(/Forgot your PIN\? Wipe all data from the Danger Zone/);
  }

  // ── PIN dialogs ──

  /**
   * The Set-PIN dialog.
   *
   * Scoped by its own heading text because the Change-PIN dialog is
   * also `role="dialog"` and is opened from the same card.
   */
  get setPinDialog(): Locator {
    return this.page.getByRole('dialog').filter({ hasText: 'Set a 6-digit PIN' });
  }

  /** The Set-PIN dialog's confirm step. */
  get confirmPinDialog(): Locator {
    return this.page.getByRole('dialog').filter({ hasText: 'Confirm your PIN' });
  }

  /** The Change-PIN dialog (any of its three steps). */
  get changePinDialog(): Locator {
    return this.page.getByRole('dialog').filter({ hasText: /current PIN|new PIN/ });
  }

  /** The dialog's title text. */
  get pinDialogTitle(): Locator {
    return this.page.getByRole('heading', { level: 3 });
  }

  /** The "Continue" / "Save PIN" primary action. */
  get pinContinueButton(): Locator {
    return this.page.getByRole('button', { name: /^(Continue|Save PIN)$/ });
  }

  get pinCancelButton(): Locator {
    return this.page.getByRole('button', { name: 'Cancel', exact: true });
  }

  /**
   * One of the six PIN boxes.
   *
   * `PinCells` gives each `<input>` an `aria-label` of "Digit {n}"
   * (1-indexed) and masks the digit visually — the input's `value` is
   * still the real digit.
   */
  pinDigit(index: number): Locator {
    return this.page.getByRole('textbox', { name: `Digit ${index}` });
  }

  /**
   * Type a 6-digit PIN into the open PIN dialog.
   *
   * Uses the KEYBOARD, not `fill()` per box. `PinCells` is a React
   * controlled input set that auto-advances focus on each keystroke;
   * driving it with `fill()` box-by-box races the re-render and can
   * drop a digit. Typing is the path a real user takes.
   *
   * The first box is CLICKED, not focused: `click()` auto-waits for
   * the element to become enabled, and the boxes are `disabled`
   * while a rate-limit lockout is active.
   */
  async typePin(pin: string): Promise<void> {
    await this.pinDigit(1).click();
    await this.page.keyboard.type(pin, { delay: 20 });
  }

  /** The PIN-entry group — its aria-label carries the "n of 6" count. */
  get pinGroup(): Locator {
    return this.page.getByRole('group');
  }

  // ── Cloud sync card ──

  /** The Cloud sync card. */
  get cloudSyncSection(): Locator {
    return this.page.locator('section.card').filter({ hasText: 'Cloud sync' });
  }

  /** The "sync is disabled in this build" notice. */
  get syncDisabledNotice(): Locator {
    return this.page.getByText(/Cloud sync is disabled in this build/);
  }

  /** The signed-out blurb. */
  get signedOutBlurb(): Locator {
    return this.page.getByText(/Sync your data across devices with end-to-end RLS-scoped storage/);
  }

  /** The "Sign in" button in the sync card. */
  get signInButton(): Locator {
    return this.page.getByRole('button', { name: 'Sign in', exact: true });
  }

  /**
   * The Cloud sync card's STATUS PILL.
   *
   * `AccountSection` renders a `<Pill>` next to the "Cloud sync"
   * heading. The pill is a `<span>` whose text is the status label
   * ("Cloud sync off" / "Cloud off" / "Synced · …" / "Syncing…" /
   * "Offline · N pending" / "Sync error") and whose `title` is the
   * tooltip. It is scoped to the card so the "Cloud sync" heading
   * itself is not matched.
   */
  get syncStatusPill(): Locator {
    return this.cloudSyncSection.locator('span[title]');
  }

  /**
   * The email shown under "Signed in as" — signed-in only.
   *
   * The caption and the value are siblings in a `flex flex-col`
   * wrapper, so the value is the caption's NEXT sibling.
   */
  get signedInEmail(): Locator {
    return this.signedInAsLabel.locator('..').locator('div.t-13.text-ink');
  }

  /**
   * The value shown under "Last synced" — signed-in only.
   *
   * "never" / "just now" / "Ns ago" / "Nm ago" / "Nh ago" / "Nd ago".
   */
  get lastSyncedValue(): Locator {
    return this.lastSyncedLabel.locator('..').locator('div.t-13.text-ink');
  }

  /** The "Sign out" button — signed-in only. */
  get signOutButton(): Locator {
    return this.page.getByRole('button', { name: 'Sign out', exact: true });
  }

  /** The "Force sync now" button — signed-in only. */
  get forceSyncButton(): Locator {
    return this.page.getByRole('button', { name: /Force sync now|Syncing…/ });
  }

  /** The "Change password" button — signed-in only. */
  get changePasswordButton(): Locator {
    return this.page.getByRole('button', { name: 'Change password', exact: true });
  }

  /** The "Signed in as" caption. */
  get signedInAsLabel(): Locator {
    return this.page.getByText('Signed in as', { exact: true });
  }

  /** The "Last synced" caption. */
  get lastSyncedLabel(): Locator {
    return this.page.getByText('Last synced', { exact: true });
  }

  // ── Sign-in dialog ──

  /**
   * The sign-in dialog.
   *
   * Scoped by its own tablist ("Sign-in mode"), which is present in
   * BOTH the sign-in and the create-account modes. Scoping by the
   * headline instead would break as soon as the user switches tabs
   * — the headline changes from "Sign in to sync" to "Create your
   * account" — and would also stop matching in the reset modes,
   * where the headline becomes "Reset your password" / "Check your
   * email" and the tablist is hidden entirely.
   */
  get signInDialog(): Locator {
    return this.page
      .getByRole('dialog')
      .filter({ has: this.page.getByRole('tablist', { name: 'Sign-in mode' }) });
  }

  /**
   * The sign-in dialog in its RESET mode.
   *
   * In the reset modes the tablist is hidden, so the dialog cannot
   * be scoped by it. It is scoped by the "Send reset link" /
   * "Back to sign in" pair instead — the two buttons that only
   * exist in the reset modes.
   */
  get resetPasswordPanel(): Locator {
    return this.page
      .getByRole('dialog')
      .filter({ has: this.page.getByRole('button', { name: 'Back to sign in' }) });
  }

  /** The dialog's "Sign in" / "Create account" tablist. */
  get signInTablist(): Locator {
    return this.page.getByRole('tablist', { name: 'Sign-in mode' });
  }

  /** A tab in the sign-in dialog. */
  signInTab(label: 'Sign in' | 'Create account'): Locator {
    return this.signInTablist.getByRole('tab', { name: label, exact: true });
  }

  get signInEmailInput(): Locator {
    return this.signInDialog.getByLabel('Email');
  }

  get signInPasswordInput(): Locator {
    return this.signInDialog.getByLabel('Password');
  }

  /**
   * The sign-in dialog's EMAIL field, scoped to the DIALOG rather
   * than to the tablist.
   *
   * The tablist is hidden in the RESET modes, so `signInEmailInput`
   * stops matching once the user clicks "Forgot password?". This one
   * keeps working in every mode.
   */
  get signInDialogEmailInput(): Locator {
    return this.page.getByRole('dialog').getByLabel('Email');
  }

  /**
   * The sign-in dialog's PASSWORD field, scoped to the DIALOG rather
   * than to the tablist.
   */
  get signInDialogPasswordInput(): Locator {
    return this.page.getByRole('dialog').getByLabel('Password');
  }

  /** The inline field error under the email field. */
  get signInFieldError(): Locator {
    return this.signInDialog.locator('[role="alert"]');
  }

  /**
   * The inline error under the EMAIL field specifically.
   *
   * `Field` renders the error as the wrapper's own
   * `div.t-12.text-danger` child, so the error is scoped to the
   * wrapper that owns the "Email" label. `signInFieldError` matches
   * ANY alert in the dialog — this one pins it to the email field.
   */
  get signInEmailError(): Locator {
    return this.page
      .getByRole('dialog')
      .locator('label:text-is("Email")')
      .locator('..')
      .locator('div.t-12.text-danger');
  }

  /**
   * The inline error under the PASSWORD field specifically.
   */
  get signInPasswordError(): Locator {
    return this.page
      .getByRole('dialog')
      .locator('label:text-is("Password")')
      .locator('..')
      .locator('div.t-12.text-danger');
  }

  /** The "Forgot password?" link. */
  get forgotPasswordLink(): Locator {
    return this.signInDialog.getByRole('button', { name: 'Forgot password?' });
  }

  /** The "Send reset link" button in the reset panel. */
  get sendResetLinkButton(): Locator {
    return this.resetPasswordPanel.getByRole('button', { name: 'Send reset link' });
  }

  /** The "Back to sign in" button in the reset panel. */
  get backToSignInButton(): Locator {
    return this.resetPasswordPanel.getByRole('button', { name: 'Back to sign in' });
  }

  /** The dialog's primary submit button. */
  get signInSubmitButton(): Locator {
    return this.signInDialog.getByRole('button', { name: /^(Sign in|Create account|Signing in…|Creating account…)$/ });
  }

  // ── Change-password dialog ──

  get changePasswordDialog(): Locator {
    return this.page.getByRole('dialog').filter({ hasText: 'Change password' });
  }

  get newPasswordInput(): Locator {
    return this.changePasswordDialog.getByLabel('New password');
  }

  get updatePasswordButton(): Locator {
    return this.changePasswordDialog.getByRole('button', { name: 'Update password' });
  }

  // ── Recovery "Set a new password" dialog ──

  /**
   * The dialog the emailed recovery link opens.
   *
   * `ResetPasswordDialog` is mounted at the APP level (not inside
   * Settings), so it can appear on any route. It is scoped by its
   * "Set a new password" heading, which is distinct from the
   * "Change password" dialog's own heading.
   */
  get setNewPasswordDialog(): Locator {
    return this.page.getByRole('dialog').filter({ hasText: 'Set a new password' });
  }

  /** The recovery dialog's password field. */
  get recoveryPasswordInput(): Locator {
    return this.setNewPasswordDialog.getByLabel('New password');
  }

  /** The recovery dialog's submit button. */
  get recoveryUpdatePasswordButton(): Locator {
    return this.setNewPasswordDialog.getByRole('button', { name: 'Update password' });
  }

  // ── Backup + Danger zone ──

  /** The Backup card. */
  get backupSection(): Locator {
    return this.page.locator('section.card').filter({ hasText: 'Backup' });
  }

  get exportBackupButton(): Locator {
    return this.page.getByRole('button', { name: 'Export backup', exact: true });
  }

  get importBackupButton(): Locator {
    return this.page.getByRole('button', { name: 'Import backup', exact: true });
  }

  /**
   * The hidden file input behind "Import backup".
   *
   * The button is a styled `<label>`-style trigger that clicks the
   * hidden `<input type="file">`, so a backup can only be supplied
   * through the input itself.
   */
  get importFileInput(): Locator {
    return this.page.locator('input[type="file"]');
  }

  /**
   * Supply a file to the hidden import input.
   *
   * The input is `hidden`, so `setInputFiles` — which does not need
   * the element to be visible — is the only way in. `buffer` writes
   * the payload without touching the disk.
   */
  async importFile(input: { name: string; mimeType: string; buffer: Buffer }): Promise<void> {
    await this.importFileInput.setInputFiles(input);
  }

  /** The Danger zone — the callout that holds the destructive actions. */
  get dangerZone(): Locator {
    return this.page
      .locator('section.rounded-card')
      .filter({ hasText: 'Danger zone' });
  }

  /** The Danger-zone heading. */
  get dangerZoneHeading(): Locator {
    return this.page.getByRole('heading', { level: 2, name: 'Danger zone' });
  }

  /** The Danger zone's "This action is destructive…" warning. */
  get dangerZoneWarning(): Locator {
    return this.dangerZone.getByText('This action is destructive.', { exact: false });
  }

  /** The Danger-zone "Wipe all data" button. */
  get wipeAllDataButton(): Locator {
    return this.page.getByRole('button', { name: 'Wipe all data', exact: true });
  }

  /**
   * The Danger zone's summary of what the wipe will delete.
   *
   * It names the cloud copy only when the user is signed in, so the
   * signed-out and signed-in variants differ.
   */
  get wipeSummary(): Locator {
    return this.dangerZone.getByText('Deletes every account', { exact: false });
  }

  /** The About panel's "Erase everything and start over →" link. */
  get eraseEverythingLink(): Locator {
    return this.page.getByRole('button', { name: /Erase everything and start over/ });
  }

  /** The About panel's version row. */
  get versionRow(): Locator {
    return this.page.locator('dl').getByText(/^v\d+\.\d+\.\d+$/);
  }

  /** The About panel's storage row. */
  get storageRow(): Locator {
    return this.page.locator('dl').getByText(/Saved on this device/);
  }

  // ── navigation ──

  async goto(): Promise<void> {
    await this.gotoRoute('/settings');
    await this.waitForAppReady();
  }
}
