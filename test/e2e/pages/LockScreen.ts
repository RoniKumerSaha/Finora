/**
 * LockScreen — the full-screen PIN unlock surface.
 *
 * `src/security/LockScreen.tsx` renders INSTEAD of the whole app
 * (`src/main.tsx`: `if (locked) return <LockScreen />`). So when the
 * PIN lock is on, the normal shell — sidebar, `main`, every screen —
 * is not in the DOM at all.
 *
 * The surface is:
 *   - a `role="region"` with `aria-label="Unlock Finora"`,
 *   - an H1 **"Secure Finora"**,
 *   - the six `PinCells` boxes,
 *   - an error line,
 *   - the "Forgot PIN? Wipe all data" link.
 *
 * ⚠️ The doc comments on this file describe a 3×4 on-screen keypad.
 * There is none — the six OTP boxes take physical-keyboard input
 * only. `LockScreen` is a good example of why the specs assert the
 * shipped behaviour rather than the documented one.
 */
import type { Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class LockScreen extends BasePage {
  /** The whole unlock surface. */
  get region(): Locator {
    return this.page.getByRole('region', { name: 'Unlock Finora' });
  }

  /** The "Secure Finora" H1. */
  get heading(): Locator {
    return this.page.getByRole('heading', { level: 1, name: 'Secure Finora' });
  }

  /** The "Enter your 6-digit PIN to unlock" sub-line. */
  get subLine(): Locator {
    return this.page.getByText('Enter your 6-digit PIN to unlock', { exact: true });
  }

  /** The PIN-entry group — aria-label carries the "n of 6" count. */
  get pinGroup(): Locator {
    return this.page.getByRole('group');
  }

  /** One of the six PIN boxes (1-indexed). */
  pinDigit(index: number): Locator {
    return this.page.getByRole('textbox', { name: `Digit ${index}` });
  }

  /** The error line — "Wrong PIN. Try again." etc. */
  get errorMessage(): Locator {
    return this.page.getByRole('alert');
  }

  /** The "Forgot PIN? Wipe all data" link. */
  get forgotPinLink(): Locator {
    return this.page.getByRole('button', { name: 'Forgot PIN? Wipe all data' });
  }

  /** The countdown / indefinite-lockout line. */
  get lockoutNotice(): Locator {
    return this.page.getByText(/Try again in \d+s|Locked\. Reload the page to continue\./);
  }

  /**
   * Type a 6-digit PIN.
   *
   * Uses the KEYBOARD, not `fill()` per box. `PinCells` is a React
   * controlled input set that auto-advances focus on each keystroke;
   * driving it with `fill()` box-by-box races the re-render and can
   * drop a digit (the value lands in the previous box). Typing is
   * also the path a real user takes — and the auto-advance it relies
   * on is itself a documented behaviour (FIN-P02).
   *
   * The first box is CLICKED, not focused: `click()` auto-waits for
   * the element to become enabled, and the boxes are `disabled` for
   * the duration of an active lockout (FIN-P02). A plain `focus()`
   * would silently no-op on a disabled input and the keystrokes
   * would go nowhere.
   */
  async enterPin(pin: string): Promise<void> {
    await this.pinDigit(1).click();
    await this.page.keyboard.type(pin, { delay: 20 });
  }

  /**
   * Enter a PIN and wait for the lock screen to go away.
   *
   * A correct PIN unmounts the whole lock surface and mounts the app,
   * so the region disappearing is the success signal.
   */
  async unlockWith(pin: string): Promise<void> {
    await this.enterPin(pin);
    await this.region.waitFor({ state: 'detached' });
  }
}
