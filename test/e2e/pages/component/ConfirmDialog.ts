/**
 * ConfirmDialog — page object for the destructive-action modal.
 *
 * `src/components/ConfirmDialog.tsx` renders a `role="dialog"` portal
 * with a heading, an optional body, and a Cancel | Confirm action row.
 * Focus lands on Cancel when the dialog opens; Escape and a backdrop
 * click both answer "no".
 *
 * The backdrop is a `<button aria-label="Close dialog">`, so
 * `getByRole('button', { name: 'Close' })` would substring-match BOTH
 * it and a ✕ button elsewhere on the page. Always use
 * `closeBackdrop` (exact "Close dialog") or the confirm/cancel
 * buttons.
 */
import type { Locator, Page } from '@playwright/test';

export class ConfirmDialog {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * The confirm dialog itself.
   *
   * Scoped by the presence of a "Cancel" button rather than by
   * `getByRole('dialog')` alone: a confirm can be raised FROM another
   * portal modal (the Month Plan's item editor, for instance), and
   * both are `role="dialog"`. Neither the item editor nor the
   * "Add new item" modal has a Cancel button, so this filter picks
   * the confirm and only the confirm.
   */
  get dialog(): Locator {
    return this.page
      .getByRole('dialog')
      .filter({ has: this.page.getByRole('button', { name: 'Cancel', exact: true }) });
  }

  /**
   * The dialog's heading — whatever it says.
   *
   * `title` is a narrower, keyword-based matcher kept for the common
   * destructive flows. Use this when the heading doesn't contain one
   * of those keywords (e.g. "Remove this contribution?").
   */
  get heading(): Locator {
    return this.dialog.getByRole('heading');
  }

  get title(): Locator {
    return this.page.getByRole('heading', { name: /Delete|Wipe|Replace|Disable|Close|Roll over|Record payment|Save as|Remove/ });
  }

  /** The dialog's body copy. */
  get body(): Locator {
    return this.dialog.locator('div.t-13.text-muted');
  }

  /**
   * The dialog's danger callout.
   *
   * `ConfirmDialog` renders `dangerText` as its own callout block —
   * a `t-13` div with a danger background — separate from the
   * body paragraph. It is absent when the caller passes no
   * `dangerText`.
   */
  get dangerLine(): Locator {
    return this.dialog.locator('div.t-13.rounded-btn');
  }

  get cancelButton(): Locator {
    return this.dialog.getByRole('button', { name: 'Cancel' });
  }

  /** The backdrop, labelled exactly "Close dialog". */
  get closeBackdrop(): Locator {
    return this.page.getByRole('button', { name: 'Close dialog', exact: true });
  }

  /** The confirm button, matched by its exact label. */
  confirmButton(label: string): Locator {
    return this.dialog.getByRole('button', { name: label, exact: true });
  }

  /** Click the confirm button and wait for the dialog to close. */
  async confirm(label: string): Promise<void> {
    await this.confirmButton(label).click();
    await this.dialog.waitFor({ state: 'detached' });
  }

  /** Click Cancel and wait for the dialog to close. */
  async cancel(): Promise<void> {
    await this.cancelButton.click();
    await this.dialog.waitFor({ state: 'detached' });
  }

  /**
   * Dismiss via the backdrop and wait for the dialog to close.
   *
   * The backdrop is `absolute inset-0` behind the 440px modal card, so
   * its centre is physically covered — a real user taps the exposed
   * strip at the edge. Click near the top-left corner instead, which
   * is always outside the centred card.
   */
  async dismissWithBackdrop(): Promise<void> {
    const box = await this.closeBackdrop.boundingBox();
    if (!box) throw new Error('Confirm backdrop has no bounding box');
    await this.page.mouse.click(box.x + 16, box.y + 16);
    await this.dialog.waitFor({ state: 'detached' });
  }

  /** Dismiss via Escape and wait for the dialog to close. */
  async dismissWithEscape(): Promise<void> {
    await this.page.keyboard.press('Escape');
    await this.dialog.waitFor({ state: 'detached' });
  }
}
