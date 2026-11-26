/**
 * InvestmentPlannerPage — the Investment Planner list
 * (`/plan/invest`), the new-plan form (`/plan/invest/new`) and
 * the plan detail (`/plan/invest/:id`).
 *
 * `src/screens/InvestmentPlannerScreen.tsx` — the list:
 *   - H1 "Investment Planner", the "sandbox" sub-line and the
 *     "+ New plan" CTA;
 *   - an empty state that leads with "How much could a 1-year FDR
 *     at 9% earn you?" and three starter kits — the DPS, FDR and
 *     savings kits — each a `card card-link` button;
 *   - once plans exist, one CERTIFICATE per plan — the same
 *     `.inv-cert` shell the real Investments screen uses, with a
 *     tilted PLANNED stamp in place of the real card's rate seal;
 *   - a Summary certificate in the right-hand column.
 *
 * `src/screens/InvestmentPlannerDetailScreen.tsx` — the detail:
 *   - a hero "Projection" card with the maturity figure, the
 *     "At maturity (projection)" caption, the "Your money" /
 *     "Interest earned" legend, the "Composition at maturity,
 *     over N months" line and the "You put in" / "You earn" /
 *     "Matures" chips;
 *   - the form (Name, Type, Monthly installment or Principal,
 *     Annual rate (%), Term — with a Months / Years toggle — Start
 *     date, Institution);
 *   - the shared `SaveResetBar` — "Unsaved changes" / "Saved",
 *     "Save plan" and "Delete".
 *
 * The planner is a **scratchpad**: nothing here touches the ledger.
 */
import type { Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class InvestmentPlannerPage extends BasePage {
  // ── List screen ──

  get heading(): Locator {
    return this.page.getByRole('heading', { level: 1, name: 'Investment Planner' });
  }

  get subLine(): Locator {
    return this.page.getByText(
      'Sketch a DPS, FDR, or savings certificate. Nothing here moves real money — it\'s a sandbox for "what if I opened a 1-year FDR at 9%?".',
      { exact: true },
    );
  }

  get newPlanButton(): Locator {
    return this.page.getByRole('button', { name: '+ New plan' });
  }

  /** The empty state's headline. */
  get emptyStateHeadline(): Locator {
    return this.page.getByText('How much could a 1-year FDR at 9% earn you?', { exact: true });
  }

  /** Every starter-kit card in the empty state. */
  get starterKits(): Locator {
    return this.page.locator('button.card-link');
  }

  /** A starter kit, by its kit name. */
  starterKit(name: string): Locator {
    return this.starterKits.filter({ hasText: name }).first();
  }

  /**
   * A saved plan card, by its name.
   *
   * A plan is a CERTIFICATE — the same `.inv-cert` shell the real
   * Investments screen uses — so the card is found by that class and
   * the PLANNED stamp stands in for the real card's rate seal.
   */
  planCard(name: string): Locator {
    return this.page.locator('button.card-link').filter({ hasText: name }).first();
  }

  /** A plan card's certificate surface. */
  planCertificate(name: string): Locator {
    return this.planCard(name).locator('.inv-cert');
  }

  /** A plan card's tilted PLANNED stamp. */
  planStamp(name: string): Locator {
    return this.planCertificate(name).locator('.inv-cert__stamp');
  }

  /**
   * A plan card's serial line — "NO. 413365 · DPS · DUTCH-BANGLA ·
   * Matures in ~4.8y".
   */
  planSerial(name: string): Locator {
    return this.planCertificate(name).locator('.inv-cert__serial');
  }

  /** A plan card's footer figure, by its label — "Committed" / "At maturity". */
  planValue(name: string, label: string): Locator {
    return this.planCertificate(name)
      .locator('.inv-cert__v')
      .filter({ has: this.page.getByText(label, { exact: true }) })
      .locator('.n');
  }

  /** The planner's Summary certificate. */
  get summaryCertificate(): Locator {
    return this.page.locator('.inv-cert--summary');
  }

  // ── Detail screen ──

  /** The detail screen's H1 — literally "Plan". */
  get detailHeading(): Locator {
    return this.page.getByRole('heading', { level: 1, name: 'Plan' });
  }

  /** The detail's "← Investment Planner" back link. */
  get backLink(): Locator {
    return this.page.getByRole('button', { name: '← Investment Planner' });
  }

  /** The hero card's "Projection" eyebrow label. */
  get projectionLabel(): Locator {
    return this.page.getByText('Projection', { exact: true });
  }

  /** The hero card's maturity figure. */
  get maturityValue(): Locator {
    return this.page.locator('div.text-\\[36px\\]');
  }

  /** The hero card's "At maturity (projection)" caption. */
  get atMaturityCaption(): Locator {
    return this.page.getByText('At maturity (projection)', { exact: true });
  }

  /** The donut's "Your money" legend row. */
  get yourMoneyLegend(): Locator {
    return this.page.getByText('Your money', { exact: true });
  }

  /** The donut's "Interest earned" legend row. */
  get interestEarnedLegend(): Locator {
    return this.page.getByText('Interest earned', { exact: true });
  }

  /**
   * The "Composition at maturity, over N months" line.
   *
   * The duration reads in the natural unit — "over 1 year", "over 18
   * months" — so the matcher accepts both.
   */
  get compositionLine(): Locator {
    return this.page.getByText(/^Composition at maturity, over .+$/);
  }

  /** The "You put in" chip. */
  get youPutInChip(): Locator {
    return this.page.getByText('You put in', { exact: true });
  }

  /** The "You earn" chip. */
  get youEarnChip(): Locator {
    return this.page.getByText('You earn', { exact: true });
  }

  /** The "Matures" chip. */
  get maturesChip(): Locator {
    return this.page.getByText('Matures', { exact: true });
  }

  /** The projection disclaimer. */
  get projectionWarning(): Locator {
    return this.page.getByText('ⓘ This is a projection. Actual bank payouts may differ.', { exact: true });
  }

  /** The screen footer. */
  get footerNote(): Locator {
    return this.page.getByText('Plans never touch your ledger.', { exact: true });
  }

  /**
   * A text node with an exact string.
   *
   * The detail screen's legend rows and chips are plain text, so
   * they are read through an exact-text lookup rather than a
   * structural selector.
   */
  textExact(text: string): Locator {
    return this.page.getByText(text, { exact: true });
  }

  // ── Detail form ──

  get nameInput(): Locator {
    return this.page.getByLabel('Name', { exact: true });
  }

  get typeSelect(): Locator {
    return this.page.getByLabel('Type', { exact: true });
  }

  get monthlyInstallmentInput(): Locator {
    return this.page.getByLabel('Monthly installment', { exact: true });
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

  get startDateInput(): Locator {
    return this.page.getByLabel('Start date', { exact: true });
  }

  get institutionInput(): Locator {
    return this.page.getByLabel('Institution', { exact: true });
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

  /** The toolbar's "Saved" caption. */
  get savedLabel(): Locator {
    return this.page.getByText('Saved', { exact: true });
  }

  get savePlanButton(): Locator {
    return this.page.getByRole('button', { name: 'Save plan' });
  }

  /**
   * The toolbar's "Delete" button.
   *
   * `SaveResetBar` labels it with an `aria-label`, so the accessible
   * name is "Delete this plan" — not the visible text "Delete".
   */
  get deletePlanButton(): Locator {
    return this.page.getByRole('button', { name: 'Delete this plan' });
  }

  /** Any "Reset" control — there is none, so this is always absent. */
  get resetButton(): Locator {
    return this.page.getByRole('button', { name: 'Reset' });
  }

  // ── navigation ──

  async gotoList(): Promise<void> {
    await this.gotoRoute('/plan/invest');
    await this.waitForAppReady();
  }

  async gotoNew(): Promise<void> {
    await this.gotoRoute('/plan/invest/new');
    await this.waitForAppReady();
  }

  /**
   * Open a starter kit from the empty state.
   *
   * The kit card navigates straight to the plan detail, so the
   * detail heading is the signal that the navigation landed.
   */
  async startFromKit(kitName: string): Promise<void> {
    await this.starterKit(kitName).click();
    await this.detailHeading.waitFor({ state: 'visible' });
  }

  /**
   * Create a brand-new, never-saved plan from the blank form.
   *
   * "+ New plan" opens the kit chooser; "Start from a blank form"
   * creates the draft plan and navigates to its detail screen. The
   * draft carries no `savedAt`, so it is the "never-saved" plan the
   * back link drops.
   */
  async startBlankPlan(): Promise<void> {
    await this.newPlanButton.click();
    await this.page.getByRole('heading', { level: 1, name: 'New plan' }).waitFor({
      state: 'visible',
    });
    await this.page.getByRole('button', { name: 'Start from a blank form' }).click();
    await this.detailHeading.waitFor({ state: 'visible' });
  }
}
