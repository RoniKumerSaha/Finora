/**
 * LoanCalculatorPage — the Loan Calculator list (`/plan/loan`) and
 * the projection detail (`/plan/loan/:id`).
 *
 * `src/screens/LoanCalculatorListScreen.tsx` — the list:
 *   - H1 "Loan Calculator", the "project what a loan will cost"
 *     sub-line and the "+ New projection" CTA;
 *   - an empty state reading "No projections yet" with a
 *     "Start a projection" button;
 *   - one `div.debt-cert` projection certificate per projection.
 *
 * `src/screens/LoanCalculatorDetailScreen.tsx` — the detail:
 *   - the "Summary (projection)" card with the **EMI**, **Total you
 *     pay** and **Total interest** stats, plus the projection
 *     disclaimer;
 *   - the form (Name, Principal, Annual rate (%), Term — with a
 *     Months / Years toggle — First payment date);
 *   - the "Amortization table" with the columns **Period**, **Due**,
 *     **Payment**, **Interest**, **Principal**, **Balance**;
 *   - the shared `SaveResetBar` — "Unsaved changes" / "Saved",
 *     "Save plan" and "Delete".
 *
 * A projection is a **scratchpad**: nothing here touches the ledger.
 */
import type { Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class LoanCalculatorPage extends BasePage {
  // ── List screen ──

  get heading(): Locator {
    return this.page.getByRole('heading', { level: 1, name: 'Loan Calculator' });
  }

  get subLine(): Locator {
    return this.page.getByText(
      'Project what a loan will cost. Enter principal, rate, and term — the app fills the amortization table for you.',
      { exact: true },
    );
  }

  get newProjectionButton(): Locator {
    return this.page.getByRole('button', { name: '+ New projection' });
  }

  /** The empty state's headline. */
  get emptyStateTitle(): Locator {
    return this.page.getByText('No projections yet', { exact: true });
  }

  /** The empty state's body copy. */
  get emptyStateBody(): Locator {
    return this.page.getByText(
      'Try a sample — 100,000 BDT at 9% for 12 months — and see the EMI + total interest computed live.',
      { exact: true },
    );
  }

  /** The empty state's "Start a projection" button. */
  get startProjectionButton(): Locator {
    return this.page.getByRole('button', { name: 'Start a projection' });
  }

  /**
   * A projection card, by its name.
   *
   * Each projection renders as a `div.debt-cert` with `role="button"`
   * — the same certificate shell the Debts screen uses.
   */
  projectionCard(name: string): Locator {
    return this.page.locator('div.debt-cert').filter({ hasText: name }).first();
  }

  // ── Detail screen ──

  /** The detail screen's H1 — literally "Loan projection". */
  get detailHeading(): Locator {
    return this.page.getByRole('heading', { level: 1, name: 'Loan projection' });
  }

  /** The detail's "← Loan Calculator" back link. */
  get backLink(): Locator {
    return this.page.getByRole('button', { name: '← Loan Calculator' });
  }

  /** The "Summary (projection)" card's eyebrow label. */
  get summaryLabel(): Locator {
    return this.page.getByText('Summary (projection)', { exact: true });
  }

  /** The summary card's "EMI" stat label. */
  get emiLabel(): Locator {
    return this.page.getByText('EMI', { exact: true });
  }

  /** The summary card's "Total you pay" stat label. */
  get totalYouPayLabel(): Locator {
    return this.page.getByText('Total you pay', { exact: true });
  }

  /** The summary card's "Total interest" stat label. */
  get totalInterestLabel(): Locator {
    return this.page.getByText('Total interest', { exact: true });
  }

  /** The projection disclaimer. */
  get projectionWarning(): Locator {
    return this.page.getByText(
      'ⓘ Projection only. Actual loan terms may include fees, insurance, or rounding that change the numbers slightly.',
      { exact: true },
    );
  }

  /** The amortization table's header row. */
  get amortizationTable(): Locator {
    return this.page.getByRole('table');
  }

  /**
   * The year-aware caption above the amortization table —
   * "36 monthly payments over 3 years".
   */
  get termCaption(): Locator {
    return this.page.getByText(/^\d+ monthly payments? over .+$/);
  }

  /** A column heading in the amortization table. */
  amortizationColumn(name: string): Locator {
    return this.amortizationTable.getByRole('columnheader', { name, exact: true });
  }

  /** The amortization table's body rows — the header row excluded. */
  get amortizationRows(): Locator {
    return this.amortizationTable.locator('tbody tr');
  }

  // ── Detail form ──

  get nameInput(): Locator {
    return this.page.getByLabel('Name', { exact: true });
  }

  get principalInput(): Locator {
    return this.page.getByLabel('Principal', { exact: true });
  }

  get annualRateInput(): Locator {
    return this.page.getByLabel('Annual rate (%)', { exact: true });
  }

  /**
   * The term input.
   *
   * The label is "Term" (not "Term (months)") because the field ships
   * with a Months / Years toggle — the unit lives in the toggle, not
   * the label, so the accessible name stays stable whichever unit is
   * active.
   */
  get termInput(): Locator {
    return this.page.getByLabel('Term', { exact: true });
  }

  /** Backwards-compatible alias for the term input. */
  get termMonthsInput(): Locator {
    return this.termInput;
  }

  /** The "Months" half of the term-unit toggle. */
  get termUnitMonthsButton(): Locator {
    return this.page.getByRole('button', { name: 'Months', exact: true });
  }

  /** The "Years" half of the term-unit toggle. */
  get termUnitYearsButton(): Locator {
    return this.page.getByRole('button', { name: 'Years', exact: true });
  }

  get firstPaymentDateInput(): Locator {
    return this.page.getByLabel('First payment date', { exact: true });
  }

  /**
   * A labelled form control, by its exact label.
   *
   * The projection form's fields are Name, Principal, Annual rate
   * (%), Term and First payment date — the manual case reads them
   * all, so the lookup is parameterised.
   */
  labelledField(label: string): Locator {
    return this.page.getByLabel(label, { exact: true });
  }

  // ── Save / delete toolbar ──

  /** The toolbar's status caption. */
  get saveStatusLine(): Locator {
    return this.page.locator('div.card-flat').first();
  }

  /** The toolbar's "Unsaved changes" caption. */
  get unsavedChangesLabel(): Locator {
    return this.page.getByText('Unsaved changes', { exact: true });
  }

  /**
   * The toolbar's "Unsaved changes" hint line.
   *
   * "Unsaved changes — your edits haven't been saved yet."
   */
  get unsavedChangesHint(): Locator {
    return this.page.getByText(
      'Unsaved changes — your edits haven\'t been saved yet.',
      { exact: true },
    );
  }

  /** The toolbar's "Saved" caption. */
  get savedLabel(): Locator {
    return this.page.getByText('Saved', { exact: true });
  }

  get savePlanButton(): Locator {
    return this.page.getByRole('button', { name: 'Save plan' });
  }

  /**
   * The Save button's blocked-save tooltip.
   *
   * `SaveResetBar` puts the reason in the button's `title` attribute
   * — there is no visible copy — so the reason is read from there.
   */
  get saveDisabledReason(): Locator {
    return this.page.getByRole('button', { name: 'Save plan' });
  }

  /**
   * The toolbar's "Delete" button.
   *
   * `SaveResetBar` labels it with an `aria-label`, so the accessible
   * name is "Delete" here (the Loan Calculator passes
   * `deleteLabel="Delete"`).
   */
  get deleteProjectionButton(): Locator {
    return this.page.getByRole('button', { name: 'Delete', exact: true });
  }

  /** Any "Reset" control — there is none, so this is always absent. */
  get resetButton(): Locator {
    return this.page.getByRole('button', { name: 'Reset' });
  }

  // ── navigation ──

  async gotoList(): Promise<void> {
    await this.gotoRoute('/plan/loan');
    await this.waitForAppReady();
  }

  /**
   * Open the "New projection" form.
   *
   * The list's CTA creates a draft and navigates straight to the
   * detail, so the detail heading is the landing signal.
   */
  async startNewProjection(): Promise<void> {
    await this.newProjectionButton.click();
    await this.detailHeading.waitFor({ state: 'visible' });
  }
}
