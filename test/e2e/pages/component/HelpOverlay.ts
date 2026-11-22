/**
 * HelpOverlay — page object for the "How X work →" explainer modal.
 *
 * `src/components/HelpOverlay.tsx` renders a 480px dialog with a
 * title, body copy, a ✕ button (aria-label "Close"), and a "Got it"
 * button.
 *
 * The backdrop is also labelled "Close dialog" — a DIFFERENT string
 * from the ✕'s "Close". But `getByRole('button', { name: 'Close' })`
 * substring-matches both, so the ✕ always needs `exact: true`.
 */
import type { Locator, Page } from '@playwright/test';

export class HelpOverlay {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  get dialog(): Locator {
    return this.page.getByRole('dialog');
  }

  /**
   * The 480px modal CARD inside the dialog.
   *
   * `role="dialog"` sits on the full-bleed wrapper
   * (`fixed inset-0 … p-4`), which is as wide as the viewport. The
   * 480px card is the `div` inside it that carries the `w-[480px]`
   * class — so a width assertion has to target the card, not the
   * dialog role.
   */
  get card(): Locator {
    return this.dialog.locator('div.w-\\[480px\\]');
  }

  get title(): Locator {
    return this.dialog.getByRole('heading');
  }

  /** The ✕ button — labelled "Close", NOT "Close dialog". */
  get closeButton(): Locator {
    return this.dialog.getByRole('button', { name: 'Close', exact: true });
  }

  /** The primary "Got it" button. */
  get gotItButton(): Locator {
    return this.dialog.getByRole('button', { name: 'Got it' });
  }

  /** The backdrop — labelled "Close dialog". */
  get backdrop(): Locator {
    return this.page.getByRole('button', { name: 'Close dialog', exact: true });
  }

  /** Dismiss with the ✕ button. */
  async dismissWithCloseButton(): Promise<void> {
    await this.closeButton.click();
    await this.dialog.waitFor({ state: 'detached' });
  }

  /** Dismiss with the "Got it" button. */
  async dismissWithGotIt(): Promise<void> {
    await this.gotItButton.click();
    await this.dialog.waitFor({ state: 'detached' });
  }

  /** Dismiss with the Escape key. */
  async dismissWithEscape(): Promise<void> {
    await this.page.keyboard.press('Escape');
    await this.dialog.waitFor({ state: 'detached' });
  }

  /**
   * Dismiss with the backdrop.
   *
   * The backdrop is `absolute inset-0` behind the 480px centred card,
   * so its centre is physically covered by the card. Click near the
   * top-left corner, which is always exposed.
   */
  async dismissWithBackdrop(): Promise<void> {
    const box = await this.backdrop.boundingBox();
    if (!box) throw new Error('Help overlay backdrop has no bounding box');
    await this.page.mouse.click(box.x + 16, box.y + 16);
    await this.dialog.waitFor({ state: 'detached' });
  }
}
