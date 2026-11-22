/**
 * Absence — the locators for things the app is NOT supposed to show.
 *
 * ## Why this exists
 *
 * A large share of the manual plan's expected results are *negative*:
 *
 *   - "the Month Plan has no Save plan button",
 *   - "there is no 'Delete cloud copy' button",
 *   - "no 'Archived debt' tag",
 *   - "the item editor does not ask for a confirmation".
 *
 * A page object exposes the elements a screen HAS. It cannot expose
 * an element that does not exist, so those locators had nowhere to
 * live — and the specs ended up building raw `page.getByText(...)`
 * calls, which puts a selector string back into the spec file.
 *
 * This component is where those selectors live instead. It is
 * deliberately dumb: it just builds the locator for a piece of text
 * or a control that should not be there, so the spec can assert
 * `toHaveCount(0)` on it.
 *
 * The component is composed into the page objects that need it, so
 * a spec never touches `page` directly.
 */
import type { Locator, Page } from '@playwright/test';

export class Absence {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * A piece of text that should not be on screen.
   *
   * `exact` is honoured so a caller can look for a whole phrase
   * rather than a fragment.
   */
  text(value: string | RegExp, exact = true): Locator {
    return this.page.getByText(value, { exact });
  }

  /**
   * A control that should not be on screen, by its accessible name.
   *
   * The `role` is a parameter because the plan's negative cases
   * cover several kinds of control — a button, a link, a combobox.
   */
  control(role: 'button' | 'link' | 'combobox' | 'textbox' | 'checkbox', name: string | RegExp): Locator {
    return this.page.getByRole(role, { name });
  }

  /**
   * Any element carrying a `data-testid` that should not be there.
   *
   * Used where a screen is expected to render a marked control that
   * the build never ships.
   */
  testId(id: string): Locator {
    return this.page.getByTestId(id);
  }
}
