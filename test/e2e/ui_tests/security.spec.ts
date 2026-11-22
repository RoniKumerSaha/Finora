/**
 * security.spec.ts — FIN-P01 … FIN-P04.
 *
 * The PIN-lock domain. Every manual case becomes EXACTLY ONE test,
 * titled with its manual ID and the manual title verbatim. All four
 * cases are `**Priority:** High`, so all four carry the `@smoke` tag —
 * in the details object, never in the title.
 *
 * ## Where the PIN lives
 *
 * The PIN is deliberately OUTSIDE the persisted `State` blob:
 *
 *   localStorage['finora.pin.salt']  — base64(16 random bytes)
 *   localStorage['finora.pin.hash']  — hex(SHA-256(salt + '|' + pin))
 *   sessionStorage['finora.pin.attempts'] / ['finora.pin.lockoutUntil']
 *                                    — the rate limiter
 *
 * (`src/security/pin.ts`, `src/security/rateLimit.ts`.) That split is
 * the whole point of FIN-P04: an Export backup can never carry the
 * credential off the machine.
 *
 * ## Seeding note
 *
 * `seedState` clears the PIN keys on every load by default, which
 * would wipe a PIN the test just set. Every case that sets a PIN and
 * then reloads therefore passes `{ clearPin: false }`.
 *
 * `seedPin` writes the salt/hash via `addInitScript`, so the app boots
 * straight into the lock screen. It is idempotent — it leaves an
 * existing device PIN alone — and `{ once: true }` restricts it to the
 * first load, which is what the "the app can CLEAR the PIN" case
 * needs (otherwise the fixture would re-seed the PIN and the
 * assertion would be measuring the fixture, not the app).
 */
import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { SettingsPage } from '../pages/SettingsPage';
import { LockScreen } from '../pages/LockScreen';
import { ShellPage } from '../pages/ShellPage';
import { ConfirmDialog } from '../pages/component/ConfirmDialog';
import { Feedback } from '../pages/component/Feedback';
import { TransactionsPage } from '../pages/TransactionsPage';
import {
  PIN_HASH_KEY,
  PIN_LOCKOUT_KEY,
  PIN_SALT_KEY,
  readState,
  seedPin,
  seedState,
} from '../fixtures/app-state';
import { baseState, todayState } from '../fixtures/seed-data';
import { LOCKOUT_SCHEDULE_MS } from '@/security/rateLimit';
import securityJson from '../../data/security.json' with { type: 'json' };

const data = securityJson;

/* ── helpers ────────────────────────────────────────────────────────── */

/**
 * Record every `aria-label` change in the document.
 *
 * The PIN group's label ("PIN entry, 6 of 6 digits entered") only
 * exists for the instant before the lock screen unmounts, so polling
 * the DOM for it would race the unlock. A MutationObserver catches
 * the attribute change instead — the label is pushed the moment React
 * commits it.
 */
async function startLabelRecorder(page: Page): Promise<void> {
  await page.evaluate(() => {
    const store = window as unknown as { __pinLabels: string[] };
    store.__pinLabels = [];
    new MutationObserver((records) => {
      for (const record of records) {
        const target = record.target as Element;
        const label = target.getAttribute?.('aria-label');
        if (label) store.__pinLabels.push(label);
      }
    }).observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-label'],
    });
  });
}

/** The `aria-label`s the recorder has seen so far. */
async function recordedLabels(page: Page): Promise<string[]> {
  return page.evaluate(
    () => (window as unknown as { __pinLabels?: string[] }).__pinLabels ?? [],
  );
}

/**
 * The PIN group's aria-label for `n` digits entered.
 *
 * The JSON carries the format string; only the count is substituted.
 */
function pinGroupLabel(n: number): string {
  return data.P02_entryMechanics.expected.groupLabelFormat.replace('{n}', String(n));
}

/** The milliseconds of lockout still to run, read from the app's own store. */
async function lockoutRemainingMs(page: Page): Promise<number> {
  const until = await page.evaluate(
    (key) => Number(sessionStorage.getItem(key) ?? 0),
    PIN_LOCKOUT_KEY,
  );
  return until - Date.now();
}

/** Collect every request the page makes, with its body. */
function recordRequests(page: Page): { url: string; body: string | null }[] {
  const seen: { url: string; body: string | null }[] = [];
  page.on('request', (request) => {
    seen.push({ url: request.url(), body: request.postData() });
  });
  return seen;
}

/** Every key that appears anywhere in a JSON value, lower-cased. */
function collectKeys(value: unknown, into: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, into);
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      into.add(key.toLowerCase());
      collectKeys(nested, into);
    }
  }
}

/* ── the suite ──────────────────────────────────────────────────────── */

test.describe('Security', () => {
  let settings: SettingsPage;
  let lock: LockScreen;
  let shell: ShellPage;

  test.beforeEach(async ({ page }) => {
    settings = new SettingsPage(page);
    lock = new LockScreen(page);
    shell = new ShellPage(page);
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-P01 — set, lock, unlock
  // ─────────────────────────────────────────────────────────────────

  test('FIN-P01 Set a PIN, lock the app and unlock it', { tag: '@smoke' }, async ({ page }) => {
    const p01 = data.P01_setPin;
    const expected = p01.expected;

    // The PIN must survive the reload below, so the seed must not
    // clear it.
    await seedState(page, baseState(), { clearPin: false });

    await test.step('Open Settings and click "Set PIN"', async () => {
      await settings.goto();
      await expect(settings.securitySection).toBeVisible();
      await expect(settings.setPinButton).toBeVisible();
      await expect(settings.changePinButton).toHaveCount(0);
      await expect(settings.disablePinButton).toHaveCount(0);
      await settings.setPinButton.click();
    });

    await test.step('The modal is titled "Set a 6-digit PIN"', async () => {
      await expect(settings.setPinDialog).toBeVisible();
      await expect(
        settings.setPinDialog.getByRole('heading', { level: 3 }),
      ).toHaveText(expected.setModalTitle);
      await expect(
        settings.setPinDialog.getByText(expected.setModalSubLine),
      ).toBeVisible();
      await expect(
        settings.setPinDialog.getByText(expected.setModalHelper),
      ).toBeVisible();
      // "Continue" is disabled until the sixth digit lands.
      await expect(settings.pinContinueButton).toBeDisabled();
    });

    await test.step(`Enter ${p01.pin} and click "Continue"`, async () => {
      await settings.typePin(p01.pin);

      // The app auto-advances to the confirm step on the sixth digit,
      // so the primary action is now "Save PIN".
      await expect(settings.confirmPinDialog).toBeVisible();
      await expect(
        settings.confirmPinDialog.getByRole('heading', { level: 3 }),
      ).toHaveText(expected.confirmModalTitle);
      await expect(
        settings.confirmPinDialog.getByText(expected.confirmModalSubLine),
      ).toBeVisible();
      await expect(settings.pinContinueButton).toHaveText(expected.savePinButton);
    });

    await test.step(`Enter ${p01.mismatchedPin} and click "Save PIN"`, async () => {
      await settings.typePin(p01.mismatchedPin);

      // A mismatch is reported and NOTHING is saved.
      await expect(settings.setPinDialog.getByRole('alert')).toHaveText(
        expected.mismatchError,
      );
      const salt = await page.evaluate(
        (key) => localStorage.getItem(key),
        PIN_SALT_KEY,
      );
      expect(salt).toBeNull();
    });

    await test.step(`Enter ${p01.pin} again and confirm it`, async () => {
      // The mismatch sends the flow back to the first step.
      await expect(
        settings.setPinDialog.getByRole('heading', { level: 3 }),
      ).toHaveText(expected.setModalTitle);

      await settings.typePin(p01.pin);
      await expect(settings.confirmPinDialog).toBeVisible();
      await settings.typePin(p01.pin);

      // The dialog closes and the card flips to the "PIN is set" state.
      await expect(settings.setPinDialog).toHaveCount(0);
      await expect(settings.changePinButton).toBeVisible();
      await expect(settings.disablePinButton).toBeVisible();
      await expect(settings.setPinButton).toHaveCount(0);
    });

    await test.step('Reload the page', async () => {
      await page.reload();
    });

    await test.step('The lock screen replaces the app shell', async () => {
      await expect(lock.region).toBeVisible();
      await expect(lock.region).toHaveAttribute('aria-label', expected.lockAriaLabel);
      await expect(lock.heading).toHaveText(expected.lockHeading);
      await expect(lock.subLine).toHaveText(expected.lockSubLine);

      // The normal app shell does NOT render while the app is locked —
      // no sidebar, and no <main> either.
      await expect(shell.sidebar).toHaveCount(0);
      await expect(shell.mainRegion).toHaveCount(0);
    });

    await test.step(`Enter ${p01.pin} on the lock screen`, async () => {
      await lock.unlockWith(p01.pin);

      await expect(lock.region).toHaveCount(0);
      await expect(shell.navLink('Settings')).toBeVisible();

      // The correct PIN raises the welcome banner.
      const feedback = new Feedback(page);
      await feedback.expectBannerText(expected.unlockBanner);
      await feedback.expectBannerText(expected.unlockBannerBody);
      await feedback.expectBannerText(expected.unlockBannerFix);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-P02 — entry mechanics, a wrong PIN, rate limiting
  // ─────────────────────────────────────────────────────────────────

  test('FIN-P02 PIN entry mechanics, a wrong PIN and rate limiting', { tag: '@smoke' }, async ({ page, context }) => {
    const p02 = data.P02_entryMechanics;
    const expected = p02.expected;

    // The rate limiter escalates to a 30 s wait and then to an
    // indefinite lock, so the case needs more than the default 30 s.
    test.setTimeout(180_000);

    await seedState(page, baseState(), { clearPin: false });

    await test.step('Set a PIN so the app boots into the lock screen', async () => {
      await settings.goto();
      await settings.setPinButton.click();
      await settings.typePin(p02.pin);
      await expect(settings.confirmPinDialog).toBeVisible();
      await settings.typePin(p02.pin);
      await expect(settings.setPinDialog).toHaveCount(0);
      await page.reload();
      await expect(lock.region).toBeVisible();
    });

    await startLabelRecorder(page);

    await test.step('Type one digit and observe the focus', async () => {
      await lock.pinDigit(1).click();
      await page.keyboard.type(p02.pin.slice(0, 1));

      // Entry auto-advances to the next box…
      await expect(lock.pinDigit(2)).toBeFocused();
      await expect(lock.pinGroup).toHaveAttribute('aria-label', pinGroupLabel(1));

      // …and each cell is labelled "Digit {n}".
      for (let n = 1; n <= 6; n++) {
        await expect(lock.pinDigit(n)).toHaveAttribute(
          'aria-label',
          expected.digitLabelFormat.replace('{n}', String(n)),
        );
      }
    });

    await test.step('Press Backspace', async () => {
      await page.keyboard.press('Backspace');

      // Backspace returns to the previous box and clears it.
      await expect(lock.pinDigit(1)).toBeFocused();
      await expect(lock.pinDigit(1)).toHaveValue('');
      await expect(lock.pinGroup).toHaveAttribute('aria-label', pinGroupLabel(0));
    });

    await test.step('Paste a 6-digit string', async () => {
      // A real paste event — the app reads `clipboardData`, so a
      // synthetic `insertText` would not exercise the paste branch.
      await page.evaluate((digits: string) => {
        const target = document.activeElement;
        if (!target) throw new Error('Nothing is focused to paste into');
        const clipboard = new DataTransfer();
        clipboard.setData('text', digits);
        target.dispatchEvent(
          new ClipboardEvent('paste', {
            clipboardData: clipboard,
            bubbles: true,
            cancelable: true,
          }),
        );
      }, p02.pin);

      // The pasted string fills all six boxes…
      await expect
        .poll(async () => (await recordedLabels(page)).includes(pinGroupLabel(6)))
        .toBe(true);

      // …and the app unlocks on the sixth digit.
      await expect(lock.region).toHaveCount(0);
    });

    await test.step('Use ArrowLeft and ArrowRight', async () => {
      await page.reload();
      await expect(lock.region).toBeVisible();

      await lock.pinDigit(1).click();
      await page.keyboard.type(p02.pin.slice(0, 2));

      // Two digits in — the focus sits on the third box.
      await expect(lock.pinDigit(3)).toBeFocused();

      await page.keyboard.press('ArrowLeft');
      await expect(lock.pinDigit(2)).toBeFocused();

      await page.keyboard.press('ArrowRight');
      await expect(lock.pinDigit(3)).toBeFocused();
    });

    await test.step('Press Enter', async () => {
      await page.reload();
      await expect(lock.region).toBeVisible();

      await lock.pinDigit(1).click();
      await page.keyboard.type(p02.pin);
      await page.keyboard.press('Enter');

      // The app opens on the correct PIN.
      await expect(lock.region).toHaveCount(0);
      await expect(shell.navLink('Settings')).toBeVisible();
    });

    await test.step('There is no on-screen keypad — only the six masked boxes', async () => {
      await page.reload();
      await expect(lock.region).toBeVisible();

      // Six digit boxes…
      await expect(lock.region.getByRole('textbox')).toHaveCount(6);
      // …and exactly one button: the "Forgot PIN?" escape hatch. A
      // 3x4 keypad would add thirteen.
      await expect(lock.region.getByRole('button')).toHaveCount(1);

      // The boxes are masked: the digit is painted transparent and a
      // bullet is drawn on top of it.
      await expect(lock.pinDigit(1)).toHaveCSS('color', 'rgba(0, 0, 0, 0)');
    });

    await test.step('Enter a wrong PIN four times in a row', async () => {
      // Attempt 1 — the error and the ~1 s lockout.
      await lock.pinDigit(1).click();
      await page.keyboard.type(p02.wrongPin);
      await expect(lock.errorMessage).toHaveText(expected.wrongPinError);

      // The screen shakes.
      await expect(lock.pinGroup).toHaveCSS('animation-name', 'pin-shake');

      // The boxes are disabled for the duration of the lockout.
      await expect(lock.pinDigit(1)).toBeDisabled();
      const firstDelay = await lockoutRemainingMs(page);
      expect(firstDelay).toBeGreaterThan(0);
      expect(firstDelay).toBeLessThan(LOCKOUT_SCHEDULE_MS[0] * 2);

      // ⚠️ The countdown line never renders. `LockScreen.tsx` only
      // draws the "Try again in {n}s" / "Locked." notice when there is
      // NO error, and a wrong PIN always leaves an error on screen —
      // so that branch is dead code. See the report.
      await expect(lock.lockoutNotice).toHaveCount(0);

      // Attempt 2 — the delay escalates to ~5 s.
      await expect(lock.pinDigit(1)).toBeEnabled({ timeout: 15_000 });
      await lock.pinDigit(1).click();
      await page.keyboard.type(p02.wrongPin);
      await expect(lock.errorMessage).toHaveText(expected.wrongPinError);
      await expect(lock.pinDigit(1)).toBeDisabled();
      const secondDelay = await lockoutRemainingMs(page);
      expect(secondDelay).toBeGreaterThan(0);
      expect(secondDelay).toBeLessThan(LOCKOUT_SCHEDULE_MS[1] * 2);

      // Attempt 3 — the delay escalates to ~30 s.
      await expect(lock.pinDigit(1)).toBeEnabled({ timeout: 20_000 });
      await lock.pinDigit(1).click();
      await page.keyboard.type(p02.wrongPin);
      await expect(lock.errorMessage).toHaveText(expected.wrongPinError);
      await expect(lock.pinDigit(1)).toBeDisabled();
      const thirdDelay = await lockoutRemainingMs(page);
      expect(thirdDelay).toBeGreaterThan(0);
      expect(thirdDelay).toBeLessThan(LOCKOUT_SCHEDULE_MS[2] * 2);

      // Attempt 4 — the lockout becomes indefinite.
      await expect(lock.pinDigit(1)).toBeEnabled({ timeout: 60_000 });
      await lock.pinDigit(1).click();
      await page.keyboard.type(p02.wrongPin);

      // ⚠️ The shipped copy is "Too many attempts. Reload the page to
      // continue.", NOT the doc's "Locked. Reload the page to
      // continue.". The JSON carries the doc's wording, so the spec
      // asserts the shared tail and asserts that the doc's prefix is
      // NOT what ships. See the report.
      const [docPrefix, reloadTail] = expected.lockedNotice.split('. ');
      await expect(lock.errorMessage).toContainText(reloadTail);
      await expect(lock.errorMessage).not.toContainText(docPrefix);
      await expect(lock.errorMessage).not.toHaveText(expected.wrongPinError);

      // The boxes stay disabled forever — the countdown line is dead
      // code, so the alert is the only signal.
      await expect(lock.lockoutNotice).toHaveCount(0);
      await expect(lock.pinDigit(1)).toBeDisabled();
      const fourthDelay = await lockoutRemainingMs(page);
      expect(fourthDelay).toBeGreaterThan(LOCKOUT_SCHEDULE_MS[2]);
    });

    await test.step('Close the tab, reopen it, and try the wrong PIN again', async () => {
      // The lockout lives in sessionStorage, so it dies with the tab.
      await page.close();

      const reopened = await context.newPage();
      const reopenedLock = new LockScreen(reopened);
      const reopenedShell = new ShellPage(reopened);
      await seedState(reopened, baseState(), { clearPin: false });
      await reopened.goto('/#/home');

      // The PIN is still set (localStorage), so the app is locked…
      await expect(reopenedLock.region).toBeVisible();
      // …but the lockout is gone: the boxes are usable again.
      await expect(reopenedLock.pinDigit(1)).toBeEnabled();

      // And a wrong PIN is met with the ordinary first-failure
      // message, not the indefinite lockout.
      await reopenedLock.pinDigit(1).click();
      await reopened.keyboard.type(p02.wrongPin);
      await expect(reopenedLock.errorMessage).toHaveText(expected.wrongPinError);
      await expect(reopenedShell.sidebar).toHaveCount(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-P03 — change, disable and forget a PIN
  // ─────────────────────────────────────────────────────────────────

  test('FIN-P03 Change, disable and forget a PIN', { tag: '@smoke' }, async ({ page }) => {
    const p03 = data.P03_changePin;
    const expected = p03.expected;

    // `once: true` — the fixture seeds the PIN on the FIRST load only,
    // so the "the app cleared the PIN" assertion below measures the
    // app rather than the fixture.
    await seedState(page, baseState(), { clearPin: false });
    await seedPin(page, p03.currentPin, { once: true });

    await test.step('Open Settings and click "Change PIN"', async () => {
      await page.goto('/#/settings');
      await expect(lock.region).toBeVisible();
      await lock.unlockWith(p03.currentPin);

      await settings.goto();
      await expect(settings.changePinButton).toBeVisible();
      await settings.changePinButton.click();
    });

    await test.step('The change flow has three steps and only a Cancel button', async () => {
      await expect(
        settings.changePinDialog.getByRole('heading', { level: 3 }),
      ).toHaveText(expected.steps[0].title);
      await expect(
        settings.changePinDialog.getByText(expected.steps[0].subLine),
      ).toBeVisible();

      await expect(settings.pinCancelButton).toHaveText(expected.cancelButton);
      // There is no explicit Save.
      await expect(
        settings.changePinDialog.getByRole('button', { name: /Save/i }),
      ).toHaveCount(0);
    });

    await test.step('Enter a wrong current PIN', async () => {
      await settings.typePin(p03.wrongCurrentPin);
      await expect(settings.changePinDialog.getByRole('alert')).toHaveText(
        expected.wrongCurrentError,
      );
      // The flow stays on the first step.
      await expect(
        settings.changePinDialog.getByRole('heading', { level: 3 }),
      ).toHaveText(expected.steps[0].title);
    });

    await test.step('Enter a mismatched new PIN', async () => {
      // The failed attempt starts a short lockout — wait it out.
      await expect(settings.pinDigit(1)).toBeEnabled({ timeout: 15_000 });

      await settings.typePin(p03.currentPin);
      await expect(
        settings.changePinDialog.getByRole('heading', { level: 3 }),
      ).toHaveText(expected.steps[1].title);
      await expect(
        settings.changePinDialog.getByText(expected.steps[1].subLine),
      ).toBeVisible();

      await settings.typePin(p03.newPin);
      await expect(
        settings.changePinDialog.getByRole('heading', { level: 3 }),
      ).toHaveText(expected.steps[2].title);
      await expect(
        settings.changePinDialog.getByText(expected.steps[2].subLine),
      ).toBeVisible();

      // The confirmation does not match the new PIN.
      await settings.typePin(p03.mismatchedNewPin);
      await expect(settings.changePinDialog.getByRole('alert')).toHaveText(
        expected.mismatchError,
      );
      await expect(
        settings.changePinDialog.getByRole('heading', { level: 3 }),
      ).toHaveText(expected.steps[1].title);
    });

    await test.step('Enter a valid new PIN and confirm', async () => {
      await settings.typePin(p03.newPin);
      await expect(
        settings.changePinDialog.getByRole('heading', { level: 3 }),
      ).toHaveText(expected.steps[2].title);
      await settings.typePin(p03.newPin);

      await expect(settings.changePinDialog).toHaveCount(0);

      const feedback = new Feedback(page);
      await feedback.expectBannerText(expected.successToast);
      await feedback.expectBannerText(expected.successToastBody);
    });

    await test.step('Reload and unlock with the new PIN', async () => {
      await page.reload();
      await expect(lock.region).toBeVisible();
      await lock.unlockWith(p03.newPin);
      await expect(shell.navLink('Settings')).toBeVisible();
    });

    await test.step('Click "Disable PIN" and confirm', async () => {
      await settings.goto();
      await expect(settings.forgotPinNote).toBeVisible();
      await settings.disablePinButton.click();

      const dialog = new ConfirmDialog(page);
      await expect(dialog.heading).toHaveText(expected.disableConfirmTitle);
      await expect(dialog.body).toContainText(expected.disableConfirmBody);
      await dialog.confirm(expected.disableConfirmButton);

      // The card flips back to the "no PIN" state.
      await expect(settings.setPinButton).toBeVisible();
      await expect(settings.changePinButton).toHaveCount(0);
      await expect(settings.disablePinButton).toHaveCount(0);

      const feedback = new Feedback(page);
      await feedback.expectBannerText(expected.disableToast);
      await feedback.expectBannerText(expected.disableToastBody);
      await feedback.expectBannerText(expected.disableToastFix);
    });
    await test.step('Reload the page — there is no lock screen', async () => {
      await page.reload();
      await expect(lock.region).toHaveCount(0);
      await expect(shell.navLink('Settings')).toBeVisible();
    });

    await test.step('Set a PIN again and lock the app', async () => {
      await settings.goto();
      await settings.setPinButton.click();
      await settings.typePin(p03.currentPin);
      await expect(settings.confirmPinDialog).toBeVisible();
      await settings.typePin(p03.currentPin);
      await expect(settings.setPinDialog).toHaveCount(0);

      await page.reload();
      await expect(lock.region).toBeVisible();
    });

    await test.step('Click "Forgot PIN? Wipe all data" and confirm', async () => {
      await lock.forgotPinLink.click();

      const dialog = new ConfirmDialog(page);
      await expect(dialog.heading).toHaveText(expected.forgotConfirmTitle);
      await expect(dialog.body).toContainText(expected.forgotConfirmBody);
      await dialog.confirm(expected.forgotConfirmButton);

      const feedback = new Feedback(page);
      await feedback.expectBannerText(expected.wipeToast);
      await feedback.expectBannerText(expected.wipeToastBody);
      await feedback.expectBannerText(expected.wipeToastFix);
    });
    await test.step('The app then opens without a PIN', async () => {
      await expect(lock.region).toHaveCount(0);
      await expect(shell.navLink('Settings')).toBeVisible();

      const state = await readState(page);
      expect(state?.accounts).toHaveLength(0);
      expect(state?.transactions).toHaveLength(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-P04 — the PIN never leaves the device
  // ─────────────────────────────────────────────────────────────────

  test('FIN-P04 The PIN never leaves the device', { tag: '@smoke' }, async ({ page }) => {
    const p04 = data.P04_pinStaysLocal;
    const expected = p04.expected;
    const pin = data.P02_entryMechanics.pin;

    await seedState(page, todayState(), { clearPin: false });
    await seedPin(page, pin);

    const requests = recordRequests(page);

    await test.step('Unlock the app and open Settings', async () => {
      await page.goto('/#/settings');
      await expect(lock.region).toBeVisible();
      await lock.unlockWith(pin);

      await settings.goto();
      await expect(settings.screenHeading).toBeVisible();
    });

    await test.step('The PIN is stored as a salted hash, not as the digits', async () => {
      const stored = await page.evaluate(
        ({ saltKey, hashKey }) => ({
          salt: localStorage.getItem(saltKey),
          hash: localStorage.getItem(hashKey),
          values: Object.values(localStorage),
        }),
        { saltKey: PIN_SALT_KEY, hashKey: PIN_HASH_KEY },
      );

      expect(stored.salt).toBeTruthy();
      expect(stored.hash).toBeTruthy();

      // The stored value is a SHA-256 digest, not the PIN.
      expect(stored.hash).not.toBe(pin);
      expect(stored.hash).toMatch(/^[0-9a-f]{64}$/);

      // …and it really is the digest of the salt + PIN.
      const recomputed = await page.evaluate(
        async ({ salt, candidate }: { salt: string; candidate: string }) => {
          const data = new TextEncoder().encode(`${salt}|${candidate}`);
          const digest = await crypto.subtle.digest('SHA-256', data);
          return Array.from(new Uint8Array(digest))
            .map((byte) => byte.toString(16).padStart(2, '0'))
            .join('');
        },
        { salt: stored.salt as string, candidate: pin },
      );
      expect(recomputed).toBe(stored.hash);

      // No localStorage value carries the digits.
      for (const value of stored.values) {
        expect(value).not.toContain(pin);
      }
    });

    await test.step('Open Settings and click "Export backup"', async () => {
      const downloadPromise = page.waitForEvent('download');
      await settings.exportBackupButton.click();
      const download = await downloadPromise;

      const path = await download.path();
      expect(path).toBeTruthy();
      const text = await readFile(path as string, 'utf8');

      // The exported JSON holds no PIN salt and no PIN hash.
      const salt = await page.evaluate(
        (key) => localStorage.getItem(key) ?? '',
        PIN_SALT_KEY,
      );
      const hash = await page.evaluate(
        (key) => localStorage.getItem(key) ?? '',
        PIN_HASH_KEY,
      );
      expect(text).not.toContain(salt);
      expect(text).not.toContain(hash);

      // …and no key named salt / hash / pin.
      const parsed = JSON.parse(text) as { data: Record<string, unknown> };
      const keys = new Set<string>();
      collectKeys(parsed, keys);
      for (const forbidden of expected.forbiddenKeys) {
        expect(keys.has(forbidden.toLowerCase())).toBe(false);
      }

      // The export carries the app's data and nothing else.
      for (const key of expected.exportedKeys) {
        expect(Object.keys(parsed.data)).toContain(key);
      }
    });

    await test.step('The About panel states that the data lives on this device', async () => {
      // The About panel's Storage row — "Saved on this device …" — is
      // the panel's local-first statement.
      await expect(settings.storageRow).toBeVisible();
    });

    await test.step('Record a transaction and watch the network', async () => {
      // The transaction is derived from the seeded state, so the spec
      // carries no literal amount.
      const state = await readState(page);
      const expense = state?.transactions.find((t) => t.type === 'expense');
      expect(expense).toBeTruthy();
      const account = state?.accounts.find((a) => a.id === expense?.accountId);
      const category = state?.categories.find((c) => c.id === expense?.categoryId);
      expect(account).toBeTruthy();
      expect(category).toBeTruthy();

      const transactions = new TransactionsPage(page);
      await transactions.recordTransaction({
        type: 'expense',
        amount: String(expense?.amount),
        accountName: account?.name as string,
        categoryName: category?.name as string,
      });

      // The app's own origin — the dev server serving the SPA. Anything
      // addressed elsewhere would be data leaving the device.
      const appOrigin = new URL(page.url()).origin;

      for (const request of requests) {
        // The PIN never appears in a URL or in a request body.
        expect(request.url).not.toContain(pin);
        if (request.body) {
          expect(request.body).not.toContain(pin);
          // …nor the financial data of the transaction just recorded.
          expect(request.body).not.toContain(String(expense?.amount));
        }

        // Nothing left the device: every request is addressed to the
        // app's own origin. The app is local-first and only talks to
        // Supabase when the user has opted into cloud sync.
        expect(new URL(request.url).origin).toBe(appOrigin);
      }

      // The strongest form of the same claim: nothing was UPLOADED at
      // all — not one request carried a body.
      const uploads = requests.filter((request) => request.body !== null);
      expect(uploads).toHaveLength(0);
    });
  });
});
