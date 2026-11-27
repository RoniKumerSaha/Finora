/**
 * A11yPage — the cross-cutting accessibility and UI-convention helpers.
 *
 * These are not tied to one screen: FIN-R03 walks the whole app and
 * asserts the conventions that hold everywhere.
 *
 * ## What the app guarantees
 *
 *   - `Field` wires `label[for]` to its control, so clicking the
 *     label focuses the field. (`src/components/Field.tsx`)
 *   - `Field` hides the hint when an error is present, and the error
 *     renders in the danger colour.
 *   - `ProgressBar` renders `role="progressbar"` with
 *     `aria-valuenow`, `aria-valuemin="0"` and `aria-valuemax="100"`.
 *     (`src/components/ProgressBar.tsx`)
 *   - The banner is `role="alert"` with what / why / fix and a
 *     "Dismiss" button; the toast is `role="status"` with what / why.
 */
import type { Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class A11yPage extends BasePage {
  /** Every progress bar on the screen. */
  get progressBars(): Locator {
    return this.page.getByRole('progressbar');
  }

  /** A progress bar, by index. */
  progressBar(index = 0): Locator {
    return this.progressBars.nth(index);
  }

  /**
   * The hint line under a labelled field.
   *
   * `Field` renders `<div><label/><control/><hint/><error/></div>`
   * (`src/components/Field.tsx`), so the hint is the SIBLING that
   * follows the label — not a descendant of it. The wrapper is found
   * by the label it contains, and the hint is that wrapper's own
   * `div.t-12.text-muted` child.
   *
   * The wrapper is matched by its DIRECT label child, so an ancestor
   * that merely CONTAINS the label (the form, the section, the
   * screen) is not matched.
   */
  fieldHint(label: string): Locator {
    return this.fieldWrapper(label).locator('div.t-12.text-muted');
  }

  /** The error line under a labelled field. */
  fieldError(label: string): Locator {
    return this.fieldWrapper(label).locator('div.t-12.text-danger');
  }

  /**
   * The `Field` wrapper that owns a label.
   *
   * `Field` renders `<div><label/><control/><hint/><error/></div>`, so
   * the wrapper is the label's PARENT — the nearest common ancestor
   * rather than the widest one.
   */
  private fieldWrapper(label: string): Locator {
    return this.page.locator(`label:text-is("${label}")`).locator('..');
  }

  /**
   * The label element associated with a control.
   *
   * `getByLabel` already resolves the association, so this is the
   * `<label>` node itself — used to assert that clicking the label
   * moves the focus.
   */
  labelFor(accessibleName: string): Locator {
    return this.page.locator(`label[for]`).filter({
      hasText: new RegExp(`^${accessibleName}$`),
    });
  }

  /**
   * The control a label points at, by its `id`.
   *
   * `label[for]` names the control's `id`, so the association is
   * checked by resolving the id back to an element.
   */
  controlById(id: string): Locator {
    return this.page.locator(`#${id}`);
  }

  /** The number of focusable elements in the document. */
  async focusableCount(): Promise<number> {
    return this.page.evaluate(
      () =>
        document.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ).length,
    );
  }
}
