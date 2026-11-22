/**
 * BasePage — the root of the page-object hierarchy.
 *
 * Holds the `page` reference and the navigation helpers. Feature
 * pages extend this; `ShellPage` extends this too and adds the
 * sidebar / drawer chrome.
 *
 * Rules this file follows (from the project's Playwright conventions):
 *   - Locators are `readonly` and bound once in the constructor.
 *   - Method names express intent, not mechanism.
 *   - Every parameter a method takes is consumed.
 *   - No fixed delays — wait on conditions, never on the clock.
 */
import type { Locator, Page } from '@playwright/test';
import { Absence } from './component/Absence';

export class BasePage {
  readonly page: Page;

  /**
   * The locators for things the screen is NOT supposed to show.
   *
   * A page object exposes the elements a screen HAS. The manual
   * plan's negative cases — "no Save plan button", "no Archived debt
   * tag" — need the opposite, so those selectors live here instead
   * of in the spec files.
   */
  readonly absent: Absence;

  constructor(page: Page) {
    this.page = page;
    this.absent = new Absence(page);
  }

  /**
   * Navigate to a hash route.
   *
   * Finora is hash-routed (`HashRouter` in `src/App.tsx`), so the
   * browser path stays at `/` and the route lives in the fragment.
   * `page.goto('/#/accounts')` is the correct way in.
   */
  async gotoRoute(hash: string): Promise<void> {
    await this.page.goto(`/#${hash}`);
  }

  /** The page's main heading. Every screen renders exactly one. */
  get heading(): Locator {
    return this.page.getByRole('heading').first();
  }

  /**
   * The screen's `<h1>`.
   *
   * `heading` is `getByRole('heading').first()` — that also matches
   * `<h2>`/`<h3>`, so a spec that needs the level-1 heading
   * specifically uses this.
   */
  get screenHeading(): Locator {
    return this.page.getByRole('heading', { level: 1 });
  }

  /** All headings on the page — used to assert a screen's structure. */
  get headings(): Locator {
    return this.page.getByRole('heading');
  }

  /**
   * The app's `<main>` region — the shell's content column.
   *
   * The first `<main>` is the app shell's; a lock screen or the
   * onboarding gate may render a second one.
   */
  get mainRegion(): Locator {
    return this.page.locator('main').first();
  }

  /**
   * Any modal dialog currently on screen.
   *
   * The app's dialogs are portals with `role="dialog"`, so this is
   * the signal for "a dialog is open" — and, with a `toHaveCount(0)`
   * assertion, "no dialog is open".
   */
  get anyDialog(): Locator {
    return this.page.getByRole('dialog');
  }

  /**
   * Locate a labelled form control.
   *
   * `Field` now wires `label[for]` to its control, so `getByLabel`
   * resolves on every labelled field. This helper is the fallback for
   * the two that have no label association (the category picker and
   * the inline `<select>` in the investment contribution modal).
   */
  field(label: string): Locator {
    return this.page
      .locator('div')
      .filter({ has: this.page.getByText(label, { exact: true }) })
      .locator('input, select, textarea')
      .first();
  }

  /** Wait until the app has mounted its shell. */
  async waitForAppReady(): Promise<void> {
    await this.page.locator('main').first().waitFor({ state: 'visible' });
  }

  /**
   * Click a modal's BACKDROP, at the exposed edge.
   *
   * The backdrop is `<button class="absolute inset-0">` rendered
   * BEHIND the centred modal card, so its centre is physically
   * covered by the card. A real user taps the exposed strip at the
   * edge — so the click lands near the top-left corner, which is
   * always outside the card.
   *
   * The backdrop is labelled "Close dialog".
   */
  async clickModalBackdrop(dialog: Locator): Promise<void> {
    const backdrop = dialog.getByRole('button', { name: 'Close dialog', exact: true });
    const box = await backdrop.boundingBox();
    if (!box) throw new Error('The modal backdrop has no bounding box');
    await this.page.mouse.click(box.x + 16, box.y + 16);
  }
}
