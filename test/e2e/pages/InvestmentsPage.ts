/**
 * InvestmentsPage — `/investments`, `/investments/add` and
 * `/investments/:id` (detail).
 *
 * `src/screens/InvestmentsListScreen.tsx`:
 *   - each investment is a CERTIFICATE — an `<article class="inv-cert">`
 *     inside an `<a class="card-link">`. The certificate carries:
 *       · the name, a serial line ("NO. 157596 · DPS · DUTCH-BANGLA ·
 *         Matures in ~2.2y") and a tilted rate seal
 *       · three engraved fields — "Monthly" (a DPS) or "Principal"
 *         (a lump sum), "Term", and "Time left"
 *       · a two-line deposit ledger — "Last deposit" and either
 *         "Next due" (a DPS) or "Matures" (a lump sum), each with a
 *         date and an amount
 *       · a tally line — "৳ 1,70,000 contributed so far · ৳ 1,51,674 in
 *         the account" (a DPS) or "Lump sum · ৳ 2,00,000 locked in at
 *         start" (a lump sum)
 *       · a footer — "Value today", "Interest" and "At maturity"
 *     The ledger holds exactly TWO dated lines whatever the type, so
 *     the card's height never grows with the term.
 *   - the summary card carries "Current value" and "At maturity".
 *
 * `src/screens/InvestmentAddScreen.tsx` — "Name", "Type",
 * "Principal" (or "Monthly contribution" for a DPS), "Rate (% per
 * year)", "Start date", the days checkbox, "Term (months)" /
 * "Term (days)", "Account", "Institution (optional)".
 */
import type { Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export type InvestmentType = 'dps' | 'fdr' | 'savings';

export class InvestmentsPage extends BasePage {
  /** The "Add" link in the list header — its accessible name is "+ Add". */
  get addButton(): Locator {
    return this.page.getByRole('link', { name: '+ Add', exact: true });
  }

  /**
   * All ACTIVE investment cards.
   *
   * A retired holding also renders as a card-link (a closed
   * certificate), so the active list is scoped to the certificates
   * that are NOT closed — otherwise "the card for X" is ambiguous
   * once X has been retired.
   */
  get cards(): Locator {
    return this.page.locator('a.card-link').filter({ hasNot: this.page.locator('.inv-cert--closed') });
  }

  /** An ACTIVE investment card, by its name. */
  card(name: string): Locator {
    return this.cards.filter({ hasText: name }).first();
  }

  /** A card's certificate surface. */
  certificate(name: string): Locator {
    return this.card(name).locator('.inv-cert');
  }

  /**
   * The summary certificate — always rendered when there is an
   * investment. It is the same shell as a holding's card, so it is
   * located by its class rather than by its old prose.
   */
  get summaryCard(): Locator {
    return this.page.locator('.inv-cert--summary');
  }

  /**
   * A figure from the summary certificate, by its label.
   *
   * The label sits in a `.k` and the figure in a sibling `.n`, both
   * inside the same `.inv-cert__v` block.
   */
  summaryValue(label: string): Locator {
    return this.summaryCard
      .locator('.inv-cert__v')
      .filter({ has: this.page.getByText(label, { exact: true }) })
      .locator('.n');
  }

  /**
   * The summary's "Value today" caption.
   *
   * Scoped to the figure block's own key — the footnote repeats the
   * phrase in bold, so a bare text match would be ambiguous.
   */
  get summaryCurrentCaption(): Locator {
    return this.summaryCard.locator('.inv-cert__v--now .k');
  }

  /** The summary's "At maturity" caption. */
  get summaryMaturityCaption(): Locator {
    return this.summaryCard.locator('.inv-cert__v--mat .k');
  }

  /**
   * A line of the summary's per-type breakdown, by its label —
   * "DPS · 1", "FDR · 2", "Savings · 1".
   */
  summaryBreakdown(label: string): Locator {
    return this.summaryCard
      .locator('.inv-cert__fields--stack .inv-cert__f')
      .filter({ hasText: label })
      .first();
  }

  /** The summary's interest figure. */
  get summaryInterest(): Locator {
    return this.summaryCard.locator('.inv-cert__grow .gn');
  }

  /** The "{n} total" count under the page heading. */
  get totalCount(): Locator {
    return this.page.getByText(/^\d+ total$/);
  }

  /** The plain "No investments yet." empty state. */
  get emptyState(): Locator {
    return this.page.getByText('No investments yet.', { exact: true });
  }

  /**
   * The "Closed" section — only rendered when something is retired.
   * It is a plain heading over a grid of closed certificates.
   */
  get closedSection(): Locator {
    return this.page
      .locator('section')
      .filter({ has: this.page.getByRole('heading', { name: /^Closed/ }) });
  }

  /** A closed-investment certificate. */
  get closedRows(): Locator {
    return this.page.locator('.inv-cert--closed');
  }

  /**
   * A closed-investment certificate, by its name.
   *
   * The "Closed" section holds every retired investment, so the bare
   * locator is ambiguous as soon as there is more than one.
   */
  closedRow(name: string): Locator {
    return this.page.locator('.inv-cert--closed').filter({ hasText: name }).first();
  }

  /** A closed certificate's tilted status stamp — "Closed" / "Rolled over". */
  closedStamp(name: string): Locator {
    return this.closedRow(name).locator('.inv-cert__stamp');
  }

  // ── Card figures ──

  // ── Certificate anatomy ──

  /**
   * The certificate's serial line — "NO. 157596 · DPS · DUTCH-BANGLA ·
   * Matures in ~2.2y".
   *
   * It carries the type, the institution and the maturity countdown,
   * so it answers for all three of the old terms / countdown / type
   * locators.
   */
  cardSerial(name: string): Locator {
    return this.certificate(name).locator('.inv-cert__serial');
  }

  /**
   * The certificate's type — "DPS" / "FDR" / "SAVINGS".
   *
   * The type is one segment of the serial line, so the assertion is a
   * `toContainText` rather than `toHaveText`.
   */
  cardTypeLabel(name: string): Locator {
    return this.cardSerial(name);
  }

  /**
   * The certificate's maturity countdown — "Matures in ~1.0y" /
   * "Matures in 30d" / "Matured 6d ago".
   *
   * The countdown is a SEGMENT of the serial line, not an element of
   * its own, so the locator resolves to the whole line and the
   * assertion must be a `toContainText`.
   */
  cardCountdown(name: string): Locator {
    return this.cardSerial(name);
  }

  /** The certificate's tilted rate seal. */
  cardSeal(name: string): Locator {
    return this.certificate(name).locator('.inv-cert__seal');
  }

  /**
   * One of the certificate's three engraved fields, by its label —
   * "Monthly" (a DPS) / "Principal" (a lump sum), "Term", "Time left".
   *
   * The label and the figure are siblings, so the figure is the
   * field's `.v` child.
   */
  cardField(name: string, label: 'Monthly' | 'Principal' | 'Term' | 'Time left'): Locator {
    return this.certificate(name)
      .locator('.inv-cert__f')
      .filter({ hasText: label })
      .locator('.v');
  }

  /** The card's "Principal" figure (FDR / savings). */
  cardPrincipalValue(name: string): Locator {
    return this.cardField(name, 'Principal');
  }

  /** The card's "Monthly" figure (DPS) — the installment amount. */
  cardMonthlyValue(name: string): Locator {
    return this.cardField(name, 'Monthly');
  }

  /** The card's "Term" figure — "60 mo" / "181d". */
  cardTermValue(name: string): Locator {
    return this.cardField(name, 'Term');
  }

  /** The card's "Time left" figure — "~2.2y" / "30d" / "Matured". */
  cardTimeLeftValue(name: string): Locator {
    return this.cardField(name, 'Time left');
  }

  /** The ledger's section head — "Deposits" / "Deposit record". */
  cardLedgerHead(name: string): Locator {
    return this.certificate(name).locator('.inv-cert__ledger-head');
  }

  /**
   * The ledger's installment count — "34 of 60 paid" (a DPS) or
   * "1 lump sum" (a lump sum).
   */
  cardLedgerCount(name: string): Locator {
    return this.cardLedgerHead(name).locator('.n');
  }

  /**
   * A dated ledger line, by its label — "Last deposit" or
   * "Next due" (a DPS) / "Matures" (a lump sum).
   */
  cardLedgerLine(name: string, label: 'Last deposit' | 'Next due' | 'Matures' | 'Matured'): Locator {
    return this.certificate(name)
      .locator('.inv-cert__dline')
      .filter({ hasText: label })
      .first();
  }

  /** A dated ledger line's DATE. */
  cardLedgerDate(name: string, label: 'Last deposit' | 'Next due' | 'Matures' | 'Matured'): Locator {
    return this.cardLedgerLine(name, label).locator('.inv-cert__dd');
  }

  /** A dated ledger line's AMOUNT. */
  cardLedgerAmount(name: string, label: 'Last deposit' | 'Next due' | 'Matures' | 'Matured'): Locator {
    return this.cardLedgerLine(name, label).locator('.inv-cert__da');
  }

  /** The tally line — the totals the two date lines cannot carry. */
  cardTally(name: string): Locator {
    return this.certificate(name).locator('.inv-cert__tally');
  }

  /**
   * The card's "Value today" figure.
   *
   * On a matured holding the label is "Payable now" instead, so the
   * locator accepts either.
   */
  cardCurrentFigure(name: string): Locator {
    return this.certificate(name)
      .locator('.inv-cert__v--now')
      .locator('.n');
  }

  /** The card's "At maturity" figure. */
  cardMaturityFigure(name: string): Locator {
    return this.certificate(name)
      .locator('.inv-cert__v--mat')
      .locator('.n');
  }

  /** The card's "Interest" figure. */
  cardInterestFigure(name: string): Locator {
    return this.certificate(name).locator('.inv-cert__grow .gn');
  }

  /** The card's "Interest" label. */
  cardInterestLabel(name: string): Locator {
    return this.certificate(name).locator('.inv-cert__grow .gk');
  }

  /** The card's "Value today" / "Payable now" label. */
  cardCurrentLabel(name: string): Locator {
    return this.certificate(name)
      .locator('.inv-cert__v--now')
      .locator('.k');
  }

  /** The card's "At maturity" / "Term ended" label. */
  cardMaturityLabel(name: string): Locator {
    return this.certificate(name)
      .locator('.inv-cert__v--mat')
      .locator('.k');
  }

  // ── Add form ──

  get nameInput(): Locator {
    return this.page.getByLabel('Name', { exact: true });
  }

  get typeSelect(): Locator {
    return this.page.getByLabel('Type', { exact: true });
  }

  get principalInput(): Locator {
    return this.page.getByLabel('Principal', { exact: true });
  }

  get monthlyContributionInput(): Locator {
    return this.page.getByLabel('Monthly contribution');
  }

  get rateInput(): Locator {
    return this.page.getByLabel('Rate (% per year)');
  }

  get startDateInput(): Locator {
    return this.page.getByLabel('Start date');
  }

  /** The "Use days instead of months" checkbox. */
  get useDaysCheckbox(): Locator {
    return this.page.getByRole('checkbox', {
      name: 'Use days instead of months (for short-term terms < 1 month)',
    });
  }

  get termMonthsInput(): Locator {
    return this.page.getByLabel('Term (months)');
  }

  get termDaysInput(): Locator {
    return this.page.getByLabel('Term (days)');
  }

  get accountSelect(): Locator {
    return this.page.getByLabel('Account', { exact: true });
  }

  get institutionInput(): Locator {
    return this.page.getByLabel('Institution (optional)');
  }

  get saveButton(): Locator {
    return this.page.getByRole('button', { name: 'Save investment' });
  }

  /**
   * The "Review: You'll receive about …" maturity preview.
   *
   * "Review:" is a `<strong>` inside the preview block, so the block
   * is reached through the paragraph that holds the whole sentence.
   */
  get reviewPreview(): Locator {
    return this.page.getByText("You'll receive about", { exact: false });
  }

  /** The formula line under the maturity preview. */
  get reviewFormulaLine(): Locator {
    return this.page.getByText(/^Formula: principal/);
  }

  /** The add form's "Principal" error — FDR / savings only. */
  get principalError(): Locator {
    return this.page.getByText('Amount must be greater than zero.', { exact: true });
  }

  /**
   * The add form's amount error, whichever amount field is showing.
   *
   * The Principal field (FDR / savings) and the Monthly contribution
   * field (DPS) carry the SAME copy — "Amount must be greater than
   * zero." — so one locator covers both.
   */
  get amountError(): Locator {
    return this.page.getByText('Amount must be greater than zero.', { exact: true });
  }

  /**
   * The account picker's live balance line.
   *
   * It reads "Balance: ৳ X" and, for an FDR / savings with a
   * principal entered, "→ after parking: ৳ Y".
   */
  get accountBalancePreview(): Locator {
    return this.page.getByText(/^Balance: ৳/, { exact: false });
  }

  /**
   * Submit the add form WITHOUT the disabled-button guard.
   *
   * The form's own `onSubmit` handler raises the app's validation
   * banner (the name / rate / term / account guards), but the Save
   * button is disabled whenever any of those guards trips — so a
   * disabled button can never be clicked.
   *
   * Removing the `disabled` ATTRIBUTE imperatively is NOT safe:
   * React's virtual DOM still holds `disabled: true`, so the next
   * render does not re-apply the attribute and the button stays
   * wrongly enabled for the rest of the test. `requestSubmit()` runs
   * the form's own `onSubmit` handler without touching the button at
   * all.
   */
  async submitForm(): Promise<void> {
    await this.page
      .locator('form')
      .first()
      .evaluate((form: HTMLFormElement) => form.requestSubmit());
  }

  // ── Detail screen ──

  /** The detail screen's H1 — the investment's name. */
  get detailHeading(): Locator {
    return this.page.getByRole('heading', { level: 1 });
  }

  /** The "+ Add a contribution" button (DPS only). */
  get addContributionButton(): Locator {
    return this.page.getByRole('button', { name: '+ Add a contribution' });
  }

  get recordPayoutButton(): Locator {
    return this.page.getByRole('button', { name: 'Record bank payout' });
  }

  get renewButton(): Locator {
    return this.page.getByRole('button', { name: 'Renew for another term' });
  }

  get markDoneButton(): Locator {
    return this.page.getByRole('button', { name: 'Mark as done (no payout)' });
  }

  get deleteButton(): Locator {
    return this.page.getByRole('button', { name: 'Delete investment' });
  }

  /** The status chip — "active" / "matured" / "closed" / "rolled_over". */
  get statusChip(): Locator {
    return this.page.getByText(/^(active|matured|closed|rolled_over)$/, { exact: true });
  }

  /** The "Matures on" / "Matured on" / "Term ended" caption. */
  get maturityCaption(): Locator {
    return this.page.getByText(/^(Matures on|Matured on|Term ended)$/);
  }

  /** The maturity date figure in the status card. */
  get maturityDate(): Locator {
    return this.page.locator('div.text-2xl.font-bold.text-ink');
  }

  /**
   * A figure from the money card, by its StatCell label.
   *
   * `Stat` renders label / value / hint as three siblings, so the
   * value is the `tabular` div inside the label's parent. The hint
   * line also carries `tabular`, so the value is narrowed by
   * `leading-none` — which only the value has.
   */
  statValue(
    label:
      | 'Principal'
      | 'Contributed so far'
      | 'Current value'
      | 'Paid out'
      | 'Maturity value'
      | 'Estimated payout when the term ends'
      | 'Expected interest'
      | 'Rate',
  ): Locator {
    return this.page
      .getByText(label, { exact: true })
      .locator('..')
      .locator('div.tabular.leading-none');
  }

  /** The money card's heading — "Maturity" (FDR) or "Plan vs progress" (DPS). */
  get moneyCardHeading(): Locator {
    return this.page.getByRole('heading', { name: /^(Maturity|Plan vs progress)$/ });
  }

  /**
   * The DPS callout block.
   *
   * The block mixes several nodes — "What you have now:", the figure
   * and "(compounded to today)." — so it is reached through the
   * `<strong>` that opens it.
   */
  get dpsCallout(): Locator {
    return this.page.getByText('What you have now:', { exact: true }).locator('..');
  }

  /** The DPS callout's "At maturity:" clause. */
  get maturityCallout(): Locator {
    return this.page.getByText('At maturity:', { exact: true }).locator('..');
  }

  /** The annuity-due formula line on a DPS. */
  get annuityFormulaLine(): Locator {
    return this.page.getByText('Maturity uses annuity-due:', { exact: false });
  }

  /** The simple-interest formula line on an FDR / savings. */
  get simpleInterestFormulaLine(): Locator {
    return this.page.getByText('Maturity uses simple interest:', { exact: false });
  }

  /** The "Edit" link on the detail screen. */
  get editLink(): Locator {
    return this.page.getByRole('link', { name: 'Edit', exact: true });
  }

  /** The Activity card — only rendered when contributions exist. */
  get activityCard(): Locator {
    return this.page.locator('section.card').filter({ hasText: 'Activity' }).last();
  }

  /** The Activity card's rows. */
  get activityRows(): Locator {
    return this.activityCard.locator('div.divide-y > div');
  }

  /** The "contribution" / "payout" pill on an Activity row. */
  activityTag(index = 0): Locator {
    return this.activityRows.nth(index).getByText(/^(contribution|payout)$/);
  }

  /** The "Danger zone" section on the detail screen. */
  get dangerZone(): Locator {
    return this.page.getByRole('heading', { name: 'Danger zone' });
  }

  // ── Edit screen ──

  /** The edit screen's H1. */
  get editHeading(): Locator {
    return this.page.getByRole('heading', { level: 1 });
  }

  /** The edit screen's sub-line under the H1. */
  get editSubtitle(): Locator {
    return this.page.getByText(
      'Rate, term, and payout destination can change. Past contributions stay as they are.',
      { exact: true },
    );
  }

  /** The edit screen's "Term (months)" hint. */
  get termHint(): Locator {
    return this.page.getByText(
      'Changing this shifts the maturity date forward.',
      { exact: true },
    );
  }

  /** The edit screen's payout-account picker. */
  get payoutAccountSelect(): Locator {
    return this.page.getByLabel('Payout account (optional)');
  }

  /** The edit screen's "Save changes" button. */
  get saveChangesButton(): Locator {
    return this.page.getByRole('button', { name: 'Save changes' });
  }

  /** The "Locked — {n} contributions already recorded." hint. */
  get lockedHint(): Locator {
    return this.page.getByText(/Locked — \d+ contributions already recorded\./);
  }

  // ── Contribution modal ──

  get contributionDialog(): Locator {
    return this.page.getByRole('dialog');
  }

  get contributionAmountInput(): Locator {
    return this.page.getByLabel('Amount', { exact: true });
  }

  get contributionDateInput(): Locator {
    return this.page.getByLabel('Date', { exact: true });
  }

  /**
   * The contribution modal's "From account" picker.
   *
   * It is a raw `<select>` (not the shared `Field`/`Select`), so it has
   * no `label[for]` association — `getByLabel` cannot reach it.
   */
  get contributionAccountSelect(): Locator {
    return this.contributionDialog.locator('select');
  }

  /** The contribution modal's "From account" field label. */
  get contributionAccountLabel(): Locator {
    return this.contributionDialog.getByText('From account', { exact: true });
  }

  get contributionNoteInput(): Locator {
    return this.page.getByLabel('Note (optional)');
  }

  get submitContributionButton(): Locator {
    return this.page.getByRole('button', { name: 'Record contribution' });
  }

  /** The contribution modal's title. */
  get contributionTitle(): Locator {
    return this.contributionDialog.getByRole('heading');
  }

  /** The contribution modal's explanatory line. */
  get contributionBody(): Locator {
    return this.contributionDialog.getByText(
      'Records an expense from the chosen account and links it to this DPS.',
      { exact: true },
    );
  }

  /** The Amount field's inline error. */
  get contributionAmountError(): Locator {
    return this.contributionDialog.getByText('Amount must be greater than zero.', { exact: true });
  }

  /** The Amount field's plan hint — "Plan: ৳ X / month". */
  get contributionPlanHint(): Locator {
    return this.contributionDialog.getByText(/^Plan: ৳/, { exact: false });
  }

  // ── navigation ──

  async goto(): Promise<void> {
    await this.gotoRoute('/investments');
    await this.waitForAppReady();
  }

  async gotoAdd(): Promise<void> {
    await this.gotoRoute('/investments/add');
    await this.waitForAppReady();
  }

  /**
   * Open an investment's detail screen by clicking its card.
   *
   * Navigates to the list first — the caller may be on any screen
   * (the accounts list, a detail screen, a transaction form).
   */
  async openInvestment(name: string): Promise<void> {
    await this.goto();
    await this.card(name).click();
    await this.waitForAppReady();
  }

  /** Open an investment's edit screen. */
  async openEdit(name: string): Promise<void> {
    await this.openInvestment(name);
    await this.editLink.click();
    await this.waitForAppReady();
  }

  /**
   * Open a CLOSED investment's detail screen.
   *
   * A retired investment leaves the active card grid and moves into
   * the "Closed" section, where it is a bare `<Link>` whose text
   * carries the investment's name — so the active-card locator
   * cannot reach it.
   */
  async openClosedInvestment(name: string): Promise<void> {
    await this.goto();
    await this.closedRow(name).click();
    await this.waitForAppReady();
  }

  /**
   * Fill the add-investment form and save, then wait for the list.
   *
   * The form's account picker starts on the first account, so the
   * principal is deducted from the wrong account unless one is picked
   * explicitly — `accountName` is therefore required.
   */
  async createInvestment(input: {
    name: string;
    type: InvestmentType;
    amount: string;
    rate: string;
    startDate: string;
    termMonths?: string;
    termDays?: string;
    accountName?: string;
    institution?: string;
  }): Promise<void> {
    await this.gotoAdd();
    await this.fillForm(input);
    await this.saveButton.click();
    await this.page.waitForURL(/#\/investments$/);
  }

  /**
   * Fill the add-investment form.
   *
   * The Principal and Monthly-contribution fields are mutually
   * exclusive — the form shows one or the other depending on the type.
   *
   * `accountName` accepts the literal `'— None —'` to pick the empty
   * option — that is how the "no payout account" case is exercised.
   */
  async fillForm(input: {
    name: string;
    type: InvestmentType;
    amount: string;
    rate: string;
    startDate: string;
    termMonths?: string;
    termDays?: string;
    accountName?: string;
    institution?: string;
  }): Promise<void> {
    await this.nameInput.fill(input.name);
    await this.typeSelect.selectOption({
      label:
        input.type === 'dps'
          ? 'DPS (monthly installment)'
          : input.type === 'fdr'
            ? 'FDR (lump-sum, fixed term)'
            : 'Savings (interest-bearing)',
    });
    if (input.type === 'dps') {
      await this.monthlyContributionInput.fill(input.amount);
    } else {
      await this.principalInput.fill(input.amount);
    }
    await this.rateInput.fill(input.rate);
    await this.startDateInput.fill(input.startDate);
    if (input.termDays !== undefined) {
      await this.useDaysCheckbox.check();
      await this.termDaysInput.fill(input.termDays);
    } else {
      await this.termMonthsInput.fill(input.termMonths ?? '12');
    }
    if (input.accountName !== undefined) {
      await this.accountSelect.selectOption({ label: input.accountName });
    }
    if (input.institution !== undefined) {
      await this.institutionInput.fill(input.institution);
    }
  }

  /**
   * Record a DPS contribution from the detail screen.
   *
   * The modal is portal-rendered, so its fields only exist once the
   * dialog is on screen.
   */
  async contribute(input: {
    amount: string;
    date: string;
    accountName: string;
    note?: string;
  }): Promise<void> {
    await this.addContributionButton.click();
    await this.contributionDialog.waitFor({ state: 'visible' });
    await this.contributionAmountInput.fill(input.amount);
    await this.contributionDateInput.fill(input.date);
    await this.contributionAccountSelect.selectOption({ label: input.accountName });
    if (input.note !== undefined) {
      await this.contributionNoteInput.fill(input.note);
    }
    await this.submitContributionButton.click();
    await this.contributionDialog.waitFor({ state: 'detached' });
  }
}
