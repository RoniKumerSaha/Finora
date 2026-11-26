/**
 * investments.spec.ts — FIN-I01 … FIN-I08.
 *
 * The investments domain: the FDR and DPS lifecycles, the validation
 * rules and their variants, the principal deduction that creating an
 * FDR performs, the maturity / rollover / close actions, the
 * current-value-versus-projection split, the maturity payout, and the
 * delete that leaves the linked transactions behind.
 *
 * Each manual case becomes EXACTLY ONE test, titled with its manual
 * ID and the manual title verbatim. `**Priority:** High` cases carry
 * the `@smoke` tag — in the details object, never in the title.
 *
 * Every selector lives in `InvestmentsPage` (or `AccountsPage` /
 * `TransactionsPage` / `HomePage`); this file carries no locator
 * strings and no copy literals — every user-visible string is read
 * from `test/data/investments.json`.
 */
import { expect, test } from '@playwright/test';
import { AccountsPage } from '../pages/AccountsPage';
import { HomePage } from '../pages/HomePage';
import { InvestmentsPage } from '../pages/InvestmentsPage';
import { TransactionsPage } from '../pages/TransactionsPage';
import { ConfirmDialog } from '../pages/component/ConfirmDialog';
import { Feedback } from '../pages/component/Feedback';
import { seedState } from '../fixtures/app-state';
import {
  dpsWithContributionState,
  isoToday,
  maturedFdrState,
  maturedInvestmentState,
  noInvestmentsState,
} from '../fixtures/seed-data';
import investmentsJson from '../../data/investments.json' with { type: 'json' };

const data = investmentsJson;

/**
 * Today, formatted the way the app formats a date — "26 Nov 2026".
 *
 * The certificate's LAST DEPOSIT line shows the investment's start
 * date, which the add form sets to today.
 */
function fmtToday(): string {
  const d = new Date();
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

test.describe('Investments', () => {
  let investments: InvestmentsPage;

  test.beforeEach(async ({ page }) => {
    investments = new InvestmentsPage(page);
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-I01 — the FDR lifecycle
  // ─────────────────────────────────────────────────────────────────

  test('FIN-I01 FDR lifecycle', { tag: '@smoke' }, async ({ page }) => {
    const lifecycle = data.I01_fdrLifecycle;
    await seedState(page, noInvestmentsState());

    await test.step('Open "+ Add" and fill the FDR form', async () => {
      await investments.goto();
      await investments.addButton.click();

      await investments.saveButton.waitFor({ state: 'visible' });

      await investments.fillForm({
        name: lifecycle.created.name,
        type: 'fdr',
        amount: lifecycle.created.principal,
        rate: lifecycle.created.rate,
        startDate: isoToday(),
        termMonths: lifecycle.created.term,
        accountName: lifecycle.created.account,
        institution: lifecycle.created.institution,
      });
    });

    await test.step('Read the "Review:" block on the add form', async () => {
      await expect(investments.reviewPreview).toContainText(
        lifecycle.expected.reviewLead,
      );
      await expect(investments.reviewPreview).toContainText(
        lifecycle.expected.maturityValue.replace(' ', ''),
      );
      await expect(investments.reviewPreview).toContainText('at maturity');
      await expect(investments.reviewPreview).toContainText(
        lifecycle.expected.reviewNote,
      );
      await expect(investments.reviewFormulaLine).toHaveText(
        lifecycle.expected.reviewFormula,
      );
    });

    await test.step('Save and read the card', async () => {
      await investments.saveButton.click();

      await expect(page).toHaveURL(/#\/investments$/);

      // The certificate's serial line carries the type, the institution
      // and the maturity countdown.
      await expect(investments.cardTypeLabel(lifecycle.created.name)).toContainText(
        lifecycle.expected.typeLabel,
      );
      await expect(investments.cardSerial(lifecycle.created.name)).toContainText(
        lifecycle.created.institution,
      );

      // The countdown is derived from the calendar, so its shape is
      // asserted rather than its exact figure. It is a segment of the
      // serial line, so the assertion is a `toContainText`.
      await expect(investments.cardCountdown(lifecycle.created.name)).toContainText(
        /Matures in /,
      );

      // The engraved terms.
      await expect(investments.cardPrincipalValue(lifecycle.created.name)).toHaveText(
        lifecycle.expected.principalValue,
      );
      await expect(investments.cardTermValue(lifecycle.created.name)).toHaveText(
        lifecycle.expected.termValue,
      );

      // "Value today" carries the current value; "At maturity" the
      // projection; "Interest" the gap between them.
      await expect(investments.cardCurrentLabel(lifecycle.created.name)).toHaveText(
        'Value today',
      );
      await expect(investments.cardCurrentFigure(lifecycle.created.name)).toHaveText(
        lifecycle.expected.nowValue,
      );
      await expect(investments.cardInterestLabel(lifecycle.created.name)).toHaveText(
        'Interest',
      );
      await expect(investments.cardInterestFigure(lifecycle.created.name)).toHaveText(
        lifecycle.expected.interestValue,
      );
      await expect(investments.cardMaturityLabel(lifecycle.created.name)).toHaveText(
        'At maturity',
      );
      await expect(investments.cardMaturityFigure(lifecycle.created.name)).toHaveText(
        lifecycle.expected.maturityValue,
      );

      // The ledger holds exactly TWO dated lines — the deposit and the
      // maturity — so a lump sum's card never grows with a term.
      await expect(investments.cardLedgerCount(lifecycle.created.name)).toHaveText(
        '1 lump sum',
      );
      await expect(investments.cardLedgerDate(lifecycle.created.name, 'Last deposit')).toHaveText(
        fmtToday(),
      );
      await expect(investments.cardLedgerAmount(lifecycle.created.name, 'Last deposit')).toHaveText(
        lifecycle.expected.principalValue,
      );
      await expect(investments.cardLedgerAmount(lifecycle.created.name, 'Matures')).toHaveText(
        lifecycle.expected.maturityValue,
      );
    });

    await test.step('Open the investment and read its certificate', async () => {
      await investments.openInvestment(lifecycle.created.name);

      await expect(investments.detailHeading).toHaveText(lifecycle.created.name);

      // The certificate's serial line carries the type, the
      // institution and the maturity countdown.
      await expect(investments.detailSerial).toContainText(
        lifecycle.expected.typeLabel,
      );
      await expect(investments.detailSerial).toContainText(
        lifecycle.created.institution,
      );
      await expect(investments.detailSerial).toContainText(/MATURES IN/);

      // The engraved terms.
      await expect(investments.detailField('Principal')).toHaveText(
        data.fdr.principalFormatted,
      );
      await expect(investments.detailField('Term')).toHaveText(
        lifecycle.expected.detailTermValue,
      );
      await expect(investments.detailField('Rate')).toHaveText(
        lifecycle.expected.rateStat,
      );

      // The closing value.
      await expect(investments.detailValue('Maturity value')).toHaveText(
        data.fdr.maturityFormatted,
      );
      await expect(investments.simpleInterestFormulaLine).toContainText(
        lifecycle.expected.simpleInterestLine,
      );

      // The maturity rail runs from the start date to the maturity
      // date, with a marker at today's position.
      await expect(investments.maturityRail).toBeVisible();
      await expect(investments.maturityMark).toBeVisible();
      await expect(investments.maturityEnds).toContainText('Started');
      await expect(investments.maturityEnds).toContainText('Matures');
    });

    await test.step('Tap "Record bank payout"', async () => {
      await investments.recordPayoutButton.click();

      await expect(page).toHaveURL(/#\/transactions\/new\/income/);

      // The amount, the account and the linked investment are all
      // pre-filled, and the note names the payout.
      const transactions = new TransactionsPage(page);
      await expect(transactions.amountInput).toHaveValue(
        lifecycle.expected.payoutAmount,
      );
      await expect(transactions.accountSelect).not.toHaveValue('');
      await expect(transactions.linkedInvestmentSelect).not.toHaveValue('');
      await expect(transactions.noteInput).toHaveValue(lifecycle.expected.payoutNote);
    });

    await test.step('Go back and delete the investment', async () => {
      await investments.goto();
      await investments.openInvestment(lifecycle.created.name);
      await investments.deleteButton.click();

      const dialog = new ConfirmDialog(page);
      await expect(dialog.heading).toHaveText(lifecycle.expected.deleteConfirm);
      await dialog.confirm(lifecycle.expected.deleteConfirmButton);

      await expect(page).toHaveURL(/#\/investments$/);
      await expect(investments.card(lifecycle.created.name)).toHaveCount(0);
    });

    await test.step('Read the "Investment deleted" banner', async () => {
      const feedback = new Feedback(page);
      await feedback.expectBannerText(lifecycle.expected.deleteToast);
      await feedback.expectBannerText(lifecycle.expected.deleteToastWhy);
      await feedback.expectBannerText(lifecycle.expected.deleteToastFix);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-I02 — the DPS lifecycle and its contribution
  // ─────────────────────────────────────────────────────────────────

  test('FIN-I02 DPS lifecycle and contribution', { tag: '@smoke' }, async ({ page }) => {
    const lifecycle = data.I02_dpsLifecycle;
    await seedState(page, noInvestmentsState());

    const accounts = new AccountsPage(page);

    await test.step('Open the form and switch the type to DPS', async () => {
      await investments.gotoAdd();

      await investments.typeSelect.selectOption({
        label: lifecycle.created.type,
      });

      // The Principal field is hidden and the contribution field
      // takes its place.
      await expect(investments.principalInput).toHaveCount(0);
      await expect(investments.monthlyContributionInput).toBeVisible();
    });

    await test.step('Fill the DPS form and save', async () => {
      await investments.fillForm({
        name: lifecycle.created.name,
        type: 'dps',
        amount: lifecycle.created.monthlyContribution,
        rate: lifecycle.created.rate,
        startDate: isoToday(),
        termMonths: lifecycle.created.term,
        accountName: lifecycle.created.account,
      });
      await investments.saveButton.click();

      await expect(page).toHaveURL(/#\/investments$/);
    });

    await test.step('Read the card', async () => {
      await expect(investments.cardTypeLabel(lifecycle.created.name)).toContainText(
        lifecycle.expected.typeLabel,
      );
      // A DPS has no principal — the first engraved field names the
      // monthly installment instead.
      await expect(investments.cardMonthlyValue(lifecycle.created.name)).toHaveText(
        lifecycle.expected.monthlyValue,
      );
      await expect(investments.cardTermValue(lifecycle.created.name)).toHaveText(
        lifecycle.expected.termValue,
      );
      await expect(investments.cardCurrentFigure(lifecycle.created.name)).toHaveText(
        lifecycle.expected.nowValue,
      );
      await expect(investments.cardMaturityFigure(lifecycle.created.name)).toHaveText(
        lifecycle.expected.maturityValue,
      );

      // The ledger holds exactly TWO dated lines — the last deposit and
      // the next due — so the card's height never grows with the term.
      await expect(investments.cardLedgerCount(lifecycle.created.name)).toHaveText(
        lifecycle.expected.ledgerCount,
      );
      await expect(investments.cardLedgerLine(lifecycle.created.name, 'Last deposit')).toHaveCount(1);
      await expect(investments.cardLedgerLine(lifecycle.created.name, 'Next due')).toHaveCount(1);
    });

    await test.step('Read the Main Bank balance — no money moved', async () => {
      await accounts.goto();
      await expect(accounts.balanceValue(lifecycle.created.account)).toHaveText(
        lifecycle.expected.balanceBefore,
      );
    });

    await test.step('Open the investment and read its certificate', async () => {
      await investments.openInvestment(lifecycle.created.name);

      // The engraved terms.
      await expect(investments.detailField('Monthly contribution')).toHaveText(
        lifecycle.expected.monthlyValue,
      );
      await expect(investments.detailField('Term')).toHaveText(
        lifecycle.expected.detailTermValue,
      );

      // The contribution tally — how much has gone in, and how much of
      // the schedule that is.
      await expect(investments.detailTally).toContainText(
        lifecycle.expected.contributedStat,
      );

      // The now-vs-maturity split.
      await expect(investments.detailValue('Current value')).toHaveText(
        lifecycle.expected.nowValue,
      );
      await expect(
        investments.detailValue('Estimated payout when the term ends'),
      ).toHaveText(lifecycle.expected.estimatedPayoutStat);

      await expect(investments.dpsCallout).toContainText(
        lifecycle.expected.calloutNow,
      );
      await expect(investments.dpsCallout).toContainText(
        lifecycle.expected.calloutCompounded,
      );
      await expect(investments.maturityCallout).toContainText(
        lifecycle.expected.calloutAtMaturity,
      );
      await expect(investments.maturityCallout).toContainText(
        lifecycle.expected.calloutProjection,
      );

      await expect(investments.annuityFormulaLine).toContainText(
        lifecycle.expected.formulaLine,
      );
      await expect(investments.annuityFormulaLine).toContainText(
        lifecycle.expected.formulaRate,
      );
      await expect(investments.annuityFormulaLine).toContainText(
        lifecycle.expected.formulaTerm,
      );
    });

    await test.step('Open "+ Add a contribution" and read the modal', async () => {
      await investments.addContributionButton.click();
      await investments.contributionDialog.waitFor({ state: 'visible' });

      await expect(investments.contributionTitle).toHaveText(
        lifecycle.expected.contributionModalTitle,
      );
      await expect(investments.contributionBody).toHaveText(
        lifecycle.expected.contributionModalBody,
      );

      // The amount field carries the plan amount as its placeholder,
      // and the plan hint repeats it once the amount is valid.
      await expect(investments.contributionAmountInput).toHaveAttribute(
        'placeholder',
        lifecycle.contribution.amount,
      );
      await expect(investments.contributionAccountLabel).toBeVisible();
      await expect(investments.contributionNoteInput).toBeVisible();

      await investments.contributionAmountInput.fill(lifecycle.contribution.amount);
      await expect(investments.contributionPlanHint).toHaveText(
        lifecycle.expected.contributionPlanHint,
      );
    });

    await test.step('Enter 5000 and record the contribution', async () => {
      await investments.contributionAmountInput.fill(lifecycle.contribution.amount);
      await investments.contributionAccountSelect.selectOption({
        label: lifecycle.created.account,
      });
      await investments.contributionNoteInput.fill(lifecycle.contribution.note);
      await investments.submitContributionButton.click();

      await investments.contributionDialog.waitFor({ state: 'detached' });
    });

    await test.step('Read the contribution banner', async () => {
      const feedback = new Feedback(page);
      await feedback.expectBannerText(lifecycle.expected.contributionBanner);
      await feedback.expectBannerText(lifecycle.expected.contributionBannerWhy);
      await feedback.expectBannerText(lifecycle.expected.contributionBannerFix);
    });

    await test.step('Read the Main Bank balance again', async () => {
      await accounts.goto();

      // The contribution DID move the money this time.
      await expect(accounts.balanceValue(lifecycle.created.account)).toHaveText(
        lifecycle.expected.balanceAfter,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-I03 — validation and variants
  // ─────────────────────────────────────────────────────────────────

  test('FIN-I03 Investment validation and variants', { tag: '@smoke' }, async ({ page }) => {
    const validation = data.I03_validation;
    await seedState(page, noInvestmentsState());

    await test.step('Leave Name empty and try to save', async () => {
      await investments.gotoAdd();
      await investments.typeSelect.selectOption({
        label: data.I01_fdrLifecycle.created.type,
      });
      await investments.principalInput.fill(data.fdr.principal);
      await investments.rateInput.fill(data.fdr.rate);
      await investments.termMonthsInput.fill(data.fdr.termMonths);

      // The save is disabled.
      await expect(investments.saveButton).toBeDisabled();

      // Bypassing it raises the banner — the same thing the manual
      // case reaches through devtools.
      await investments.submitForm();

      const feedback = new Feedback(page);
      await feedback.expectBannerText(validation.nameRequired.banner.what);
      await feedback.expectBannerText(validation.nameRequired.banner.why);
      await feedback.expectBannerText(validation.nameRequired.banner.fix);
    });

    await test.step('Set the principal to 0 on an FDR', async () => {
      await investments.nameInput.fill('Validation FDR');
      await investments.principalInput.fill('0');

      // The inline error appears and the save stays disabled.
      await expect(investments.amountError).toBeVisible();
      await expect(investments.saveButton).toBeDisabled();
    });

    await test.step('Set the monthly contribution to 0 on a DPS', async () => {
      await investments.typeSelect.selectOption({
        label: data.I02_dpsLifecycle.created.type,
      });
      await investments.monthlyContributionInput.fill('0');

      // The same inline error, on the other amount field.
      await expect(investments.amountError).toBeVisible();
      await expect(investments.saveButton).toBeDisabled();

      // Back to the FDR for the remaining steps.
      await investments.typeSelect.selectOption({
        label: data.I01_fdrLifecycle.created.type,
      });
      await investments.principalInput.fill(data.fdr.principal);
    });

    await test.step('Set the rate to -1', async () => {
      await investments.rateInput.fill('-1');

      // The save is disabled — the rate guard is on the button.
      await expect(investments.saveButton).toBeDisabled();

      // Bypassing it raises the banner. (The rate field carries NO
      // inline error — the message is a banner, not a field error.)
      await investments.submitForm();

      const feedback = new Feedback(page);
      await feedback.expectBannerText(validation.rateError.banner.what);
      await feedback.expectBannerText(validation.rateError.banner.why);
      await feedback.expectBannerText(validation.rateError.banner.fix);
    });
    await test.step('Set the rate to 0 — it is ACCEPTED', async () => {
      await investments.rateInput.fill(validation.acceptedZeroRate.rate);

      await expect(investments.saveButton).toBeEnabled();
      await expect(investments.reviewPreview).toContainText(
        validation.acceptedZeroRate.maturityPreviewRaw,
      );
    });

    await test.step('Set the rate to 150 — it is ACCEPTED too', async () => {
      await investments.rateInput.fill(validation.acceptedHighRate.rate);

      await expect(investments.saveButton).toBeEnabled();
      await expect(investments.reviewPreview).toContainText(
        validation.acceptedHighRate.maturityPreviewRaw,
      );
    });

    await test.step('Set the term to 0', async () => {
      await investments.rateInput.fill(data.fdr.rate);
      await investments.termMonthsInput.fill('0');

      // The save is disabled — the term guard is on the button.
      await expect(investments.saveButton).toBeDisabled();

      // Bypassing it raises the banner.
      await investments.submitForm();

      const feedback = new Feedback(page);
      await feedback.expectBannerText(validation.termError.banner.what);
      await feedback.expectBannerText(validation.termError.banner.why);
      await feedback.expectBannerText(validation.termError.banner.fix);
    });
    await test.step('Tick "Use days instead of months"', async () => {
      await investments.termMonthsInput.fill(data.fdr.termMonths);
      await investments.useDaysCheckbox.check();

      // "Term (days)" replaces "Term (months)".
      await expect(investments.termDaysInput).toBeVisible();
      await expect(investments.termMonthsInput).toHaveCount(0);

      // The formula swaps to the days variant — but only once the
      // term itself is positive, because the "Review:" block (and
      // its formula line) renders only with a complete projection.
      await investments.termDaysInput.fill(validation.shortTerm.termDays);
      await expect(investments.reviewFormulaLine).toHaveText(
        validation.daysFormula,
      );
      await expect(investments.reviewPreview).toContainText(
        validation.shortTerm.maturityPreviewRaw,
      );
    });

    await test.step('Switch the type to DPS', async () => {
      await investments.typeSelect.selectOption({
        label: data.I02_dpsLifecycle.created.type,
      });

      // The Principal field is hidden, and so is the days checkbox.
      await expect(investments.principalInput).toHaveCount(0);
      await expect(investments.useDaysCheckbox).toHaveCount(0);
    });

    await test.step('Clear the account on an FDR and try to save', async () => {
      await investments.typeSelect.selectOption({
        label: data.I01_fdrLifecycle.created.type,
      });

      // The days checkbox is still ticked from the earlier step — it
      // is FDR/savings-only, so it comes back when the type returns.
      // Unticking it brings "Term (months)" back.
      await investments.useDaysCheckbox.uncheck();
      await expect(investments.termMonthsInput).toBeVisible();

      await investments.principalInput.fill(data.fdr.principal);
      await investments.rateInput.fill(data.fdr.rate);
      await investments.termMonthsInput.fill(data.fdr.termMonths);
      await investments.accountSelect.selectOption({ label: '— None —' });

      // The guard lives in the submit handler, so the button stays
      // enabled — the banner is what stops the save.
      await expect(investments.saveButton).toBeEnabled();

      await investments.submitForm();

      const feedback = new Feedback(page);
      await feedback.expectBannerText(validation.accountRequired.banner.what);
      await feedback.expectBannerText(validation.accountRequired.banner.why);
      await feedback.expectBannerText(validation.accountRequired.banner.fix);
      // The app stayed on the form — nothing was created.
      await expect(page).toHaveURL(/#\/investments\/add$/);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-I04 — the principal leaves the account at creation
  // ─────────────────────────────────────────────────────────────────

  test('FIN-I04 Creating an FDR deducts the principal immediately', { tag: '@smoke' }, async ({ page }) => {
    const deduction = data.I04_principalDeduction;
    await seedState(page, noInvestmentsState());

    const accounts = new AccountsPage(page);
    const transactions = new TransactionsPage(page);

    await test.step('Read the Main Bank balance', async () => {
      await accounts.goto();
      await expect(accounts.balanceValue(deduction.accountName)).toHaveText(
        deduction.expected.balanceBefore,
      );
    });

    await test.step('Create the FDR', async () => {
      await investments.createInvestment({
        name: data.fdr.name,
        type: 'fdr',
        amount: data.fdr.principal,
        rate: data.fdr.rate,
        startDate: isoToday(),
        termMonths: data.fdr.termMonths,
        accountName: data.fdr.accountName,
        institution: data.fdr.institution,
      });

      await expect(page).toHaveURL(/#\/investments$/);
    });

    await test.step('Read the Main Bank balance again', async () => {
      await accounts.goto();

      // The principal left the account at creation.
      await expect(accounts.balanceValue(deduction.accountName)).toHaveText(
        deduction.expected.balanceAfter,
      );
    });

    await test.step('Open Transactions and read the newest row', async () => {
      await transactions.goto();

      const row = transactions.row(deduction.expected.transactionNote);
      await expect(row).toBeVisible();
      await expect(transactions.amountOf(row)).toHaveText(
        deduction.expected.transactionAmount,
      );
      await expect(transactions.subtitleOf(row)).toHaveText(
        deduction.expected.transactionSubtitle,
      );
      await expect(transactions.rowTag(deduction.expected.transactionNote)).toHaveAttribute(
        'aria-label',
        deduction.expected.tagLabel,
      );
    });

    await test.step('The row appears under the "Payouts" filter chip', async () => {
      await transactions.applyFilter(
        deduction.expected.payoutsFilter as 'Payouts',
      );
      await expect(transactions.row(deduction.expected.transactionNote)).toBeVisible();
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-I05 — maturity status, rollover and close
  // ─────────────────────────────────────────────────────────────────

  test('FIN-I05 Maturity status, rollover and close', { tag: '@smoke' }, async ({ page }) => {
    const maturity = data.I05_maturity;
    await seedState(page, maturedInvestmentState());

    await test.step('Open the matured FDR and read its certificate', async () => {
      await investments.goto();
      await investments.openInvestment(data.fdr.name);

      // A matured holding's serial line says when it ENDED, and the
      // certificate carries a "Matured" stamp instead of a rate seal.
      await expect(investments.detailSerial).toContainText('ENDED');
      await expect(
        investments.detailCertificate.locator('.inv-cert__stamp'),
      ).toHaveText('Matured');
    });

    await test.step('Tap "Renew for another term" and confirm', async () => {
      await investments.renewButton.click();

      const dialog = new ConfirmDialog(page);
      await expect(dialog.heading).toHaveText(maturity.rolloverConfirm);
      await expect(dialog.body).toHaveText(maturity.rolloverConfirmBody);
      await dialog.confirm(maturity.rolloverConfirmButton);
    });

    await test.step('Read the "{name} rolled over" banner', async () => {
      const feedback = new Feedback(page);
      await feedback.expectBannerText(maturity.expected.rolledOverBanner);
      await feedback.expectBannerText(maturity.expected.rolledOverBannerWhy);
    });

    await test.step('Read the old investment and the new one', async () => {
      await investments.goto();

      // The old investment is retired and sits in the "Closed" group,
      // stamped as a document that has been rolled into another.
      await expect(investments.closedSection).toBeVisible();
      await expect(investments.closedStamp(data.fdr.name)).toHaveText(
        maturity.expected.rolledOverStamp,
      );

      // The replacement carries the same principal, rate and term, and
      // starts the day after the old maturity date.
      const replacement = investments.card(data.fdr.name);
      await expect(replacement).toBeVisible();
      await expect(investments.cardTypeLabel(data.fdr.name)).toContainText('FDR');
      await expect(investments.cardTermValue(data.fdr.name)).toHaveText(
        data.I01_fdrLifecycle.expected.termValue,
      );
      await expect(investments.cardPrincipalValue(data.fdr.name)).toHaveText(
        data.I01_fdrLifecycle.expected.principalValue,
      );
    });

    await test.step('Open the DPS and tap "Mark as done (no payout)"', async () => {
      await investments.openInvestment(data.dps.name);

      // The button renders for a DPS that has never been paid out.
      await expect(investments.markDoneButton).toBeVisible();
      await investments.markDoneButton.click();

      const dialog = new ConfirmDialog(page);
      await expect(dialog.heading).toHaveText(maturity.closeConfirm);
      await expect(dialog.body).toHaveText(maturity.closeConfirmBody);
      await dialog.confirm(maturity.closeConfirmButton);
    });

    await test.step('Read the "{name} closed" banner', async () => {
      const feedback = new Feedback(page);
      await feedback.expectBannerText(maturity.expected.closedBanner);
      await feedback.expectBannerText(maturity.expected.closedBannerWhy);
    });

    await test.step('Read the DPS status and its list grouping', async () => {
      // A closed investment leaves the active card grid, so it is
      // reached through the "Closed" section.
      await investments.openClosedInvestment(data.dps.name);

      // A closed holding's certificate carries a "Closed" stamp.
      await expect(
        investments.detailCertificate.locator('.inv-cert__stamp'),
      ).toHaveText('Closed');
      await expect(investments.detailSerial).toContainText('ENDED');

      // It sits in the "Closed" group on the list, stamped as closed.
      await investments.goto();
      await expect(investments.closedSection).toBeVisible();
      await expect(investments.closedStamp(data.dps.name)).toHaveText(
        maturity.expected.closedStamp,
      );

      // The count INCLUDES closed investments.
      await expect(investments.totalCount).toHaveText('3 total');
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-I06 — current value versus at maturity
  // ─────────────────────────────────────────────────────────────────

  test('FIN-I06 Current value versus at maturity', async ({ page }) => {
    const split = data.I06_currentVsMaturity;
    await seedState(page, dpsWithContributionState());

    const home = new HomePage(page);

    await test.step('Open Investments and read both rows', async () => {
      await investments.goto();

      // The DPS headline is the CURRENT value, with the projection
      // beneath it — the projected value never stands alone.
      await expect(investments.cardCurrentFigure(data.dps.name)).toHaveText(
        split.dps.currentValue,
      );
      await expect(investments.cardMaturityFigure(data.dps.name)).toHaveText(
        split.dps.maturityValue,
      );
      await expect(investments.cardMaturityLabel(data.dps.name)).toHaveText(
        'At maturity',
      );

      // The FDR row shows the principal as its headline, with the
      // maturity value beneath it.
      await expect(investments.cardCurrentFigure(data.fdr.name)).toHaveText(
        split.fdr.currentValue,
      );
      await expect(investments.cardMaturityFigure(data.fdr.name)).toHaveText(
        split.fdr.maturityValue,
      );
    });

    await test.step('Open the DPS and read its certificate', async () => {
      await investments.openInvestment(data.dps.name);

      await expect(investments.detailValue('Current value')).toHaveText(
        split.dps.currentValue,
      );
      await expect(
        investments.detailValue('Estimated payout when the term ends'),
      ).toHaveText(split.dps.maturityValue);
    });

    await test.step('Read the Home status bar', async () => {
      await home.goto();

      // The status bar carries the CURRENT net worth — a DPS's full
      // mature amount must not skew the headline.
      //
      // The projection column was removed from Home on 2026-11-24
      // (Variant H — The board); the Investments screen's Summary
      // card, read in the next step, carries the current/maturity
      // split.
      await expect(home.netWorthFigure).toBeVisible();
      await expect(
        home.textExact(split.expected.homeProjectionLabel),
      ).toHaveCount(0);
      await expect(
        home.textExact(split.expected.homeProjectionCaption),
      ).toHaveCount(0);
    });

    await test.step('Read the Summary certificate on the Investments screen', async () => {
      await investments.goto();

      // The Summary is the same certificate shell as a holding's card,
      // so its figures are labelled blocks: "VALUE TODAY" and "AT
      // MATURITY", each with the figure under it.
      await expect(investments.summaryValue(split.expected.summaryCurrentLabel)).toHaveText(
        split.expected.summaryCurrentValue,
      );
      await expect(investments.summaryCurrentCaption).toHaveText(
        split.expected.summaryCurrentCaption,
      );
      await expect(investments.summaryValue(split.expected.summaryMaturityLabel)).toHaveText(
        split.expected.summaryMaturityValue,
      );
      await expect(investments.summaryMaturityCaption).toHaveText(
        split.expected.summaryMaturityCaption,
      );

      // The interest between them is named, not left as a bare delta.
      await expect(investments.summaryInterest).toHaveText(
        split.expected.summaryInterestValue,
      );

      // The per-type breakdown says WHERE the money is parked.
      await expect(investments.summaryBreakdown('DPS')).toContainText('৳ 5,101');
      await expect(investments.summaryBreakdown('FDR')).toContainText('৳ 1,00,000');
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-I07 — recording a maturity payout
  // ─────────────────────────────────────────────────────────────────

  test('FIN-I07 Recording a maturity payout', { tag: '@smoke' }, async ({ page }) => {
    const payout = data.I07_payout;
    await seedState(page, maturedFdrState());

    const accounts = new AccountsPage(page);
    const transactions = new TransactionsPage(page);

    await test.step('Open the investment and click "Record bank payout"', async () => {
      await investments.goto();
      await investments.openInvestment(data.fdr.name);
      await investments.recordPayoutButton.click();

      await expect(page).toHaveURL(/#\/transactions\/new\/income/);
    });

    await test.step('Read the amount, account and note pre-filled on the income form', async () => {
      // The amount is the CALCULATED maturity value.
      await expect(transactions.amountInput).toHaveValue(payout.calculatedMaturity);

      // The account and the linked investment are pre-filled too.
      await expect(transactions.accountSelect).not.toHaveValue('');
      await expect(transactions.linkedInvestmentSelect).not.toHaveValue('');
      await expect(transactions.noteInput).toHaveValue(payout.expected.note);
    });

    await test.step('Change the amount to 108000 and save', async () => {
      await transactions.amountInput.fill(payout.payoutAmount);
      await transactions.saveAndWaitForList();
    });

    await test.step('Read the account balance', async () => {
      await accounts.goto();

      // The balance rises by the payout amount — 20,000 + 108,000.
      await expect(accounts.balanceValue(data.fdr.accountName)).toHaveText(
        payout.expected.balanceAfter,
      );
    });

    await test.step('Read the investment status and the payout transaction', async () => {
      await investments.openInvestment(data.fdr.name);

      // For an FDR the record is NOT auto-closed — the certificate
      // still carries a "Matured" stamp, so the user must retire it by
      // hand with "Mark as done (no payout)".
      await expect(
        investments.detailCertificate.locator('.inv-cert__stamp'),
      ).toHaveText('Matured');
      await expect(investments.markDoneButton).toBeVisible();

      // The payout shows in the activity ledger, tagged as a payout.
      await expect(investments.activityTag(0)).toContainText('Payout');
      await expect(investments.activityAmount(0)).toHaveText(
        payout.expected.payoutFormatted,
      );

      await transactions.goto();
      const row = transactions.row(payout.expected.note);
      await expect(row).toBeVisible();
      await expect(transactions.rowTag(payout.expected.note)).toHaveAttribute(
        'aria-label',
        payout.expected.payoutTagLabel,
      );
    });

    await test.step('Open the "Mark as done" path for the FDR', async () => {
      // Back to the investment — the previous step ended on the
      // Transactions list.
      await investments.openInvestment(data.fdr.name);

      await investments.markDoneButton.click();

      const dialog = new ConfirmDialog(page);
      await expect(dialog.heading).toHaveText(data.I05_maturity.closeConfirm);
      await dialog.confirm(data.I05_maturity.closeConfirmButton);

      const feedback = new Feedback(page);
      await feedback.expectBannerText(payout.expected.closedBanner);
      await feedback.expectBannerText(payout.expected.closedBannerWhy);
      // It leaves the active list and stays under "Closed".
      await investments.goto();
      await expect(investments.closedSection).toBeVisible();
      await expect(investments.closedStamp(data.fdr.name)).toHaveText(
        data.I05_maturity.expected.closedStamp,
      );
      await expect(investments.card(data.fdr.name)).toHaveCount(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-I08 — deleting an investment leaves its transactions behind
  // ─────────────────────────────────────────────────────────────────

  test('FIN-I08 Deleting an investment leaves its linked transactions behind', async ({ page }) => {
    const deletion = data.I08_deleteLeavesTransactions;
    await seedState(page, maturedFdrState());

    const accounts = new AccountsPage(page);
    const transactions = new TransactionsPage(page);

    await test.step('Record the Main Bank balance', async () => {
      await accounts.goto();
      await expect(accounts.balanceValue(deletion.accountName)).toHaveText(
        deletion.expected.balanceBefore,
      );
    });

    await test.step('Open the investment, click "Delete investment", and confirm', async () => {
      await investments.goto();
      await investments.openInvestment(data.fdr.name);
      await investments.deleteButton.click();

      const dialog = new ConfirmDialog(page);
      await expect(dialog.heading).toHaveText(deletion.expected.confirmTitle);
      await expect(dialog.body).toHaveText(deletion.expected.confirmBody);
      await dialog.confirm('Delete investment');
    });

    await test.step('Read the banner', async () => {
      const feedback = new Feedback(page);
      await feedback.expectBannerText(deletion.expected.banner);
      await feedback.expectBannerText(deletion.expected.bannerWhy);
      await feedback.expectBannerText(deletion.expected.bannerFix);
    });
    await test.step('Read the Main Bank balance again', async () => {
      await accounts.goto();

      // The balance KEEPS the reduction — the principal expense
      // survived the deletion, so its balance impact persists.
      await expect(accounts.balanceValue(deletion.accountName)).toHaveText(
        deletion.expected.balanceAfter,
      );
    });

    await test.step('Open Transactions and look for the principal expense', async () => {
      await transactions.goto();

      await expect(transactions.row(data.fdr.principalNote)).toBeVisible();
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-I09 — the edit screen previews the new terms live
  // ─────────────────────────────────────────────────────────────────

  test('FIN-I09 Editing an investment previews the new terms', async ({ page }) => {
    const preview = data.I09_editPreview;
    await seedState(page, dpsWithContributionState());

    await test.step('Open the DPS edit screen and read the preview', async () => {
      await investments.goto();
      await investments.openEdit(preview.dps.name);

      await expect(investments.editHeading).toHaveText('Edit investment');
      await expect(investments.editSubtitle).toBeVisible();

      // The certificate above the form re-engraves itself: it shows
      // the terms as they stand, with the maturity value and date.
      await expect(investments.previewMaturityValue).toHaveText(
        preview.expected.initialMaturityValue,
      );
      await expect(investments.previewCertificate).toContainText(
        preview.expected.previewLead,
      );

      // The summary column carries the same three figures.
      await expect(investments.activitySheet).toContainText(
        preview.expected.termsHeading,
      );
      await expect(investments.activityStat('You put in')).toHaveText(
        preview.expected.summaryYouPutIn,
      );
      await expect(investments.activityStat('Interest')).toHaveText(
        preview.expected.summaryInterest,
      );
      await expect(investments.activityStat('You get')).toHaveText(
        preview.expected.summaryYouGet,
      );
    });

    await test.step('The monthly amount is LOCKED — a contribution exists', async () => {
      await expect(investments.lockedHint).toHaveText(
        preview.expected.lockedHint,
      );
      await expect(investments.monthlyContributionInput).toBeDisabled();
    });

    await test.step('Raise the rate — the preview re-engraves itself', async () => {
      await investments.rateInput.fill('10');
      await expect(investments.previewMaturityValue).toHaveText(
        preview.expected.newRateMaturityValue,
      );
    });

    await test.step('Switch the type to FDR — the principal field replaces it', async () => {
      await investments.typeOption('FDR').click();

      await expect(investments.principalInput).toBeVisible();
      await expect(investments.monthlyContributionInput).toHaveCount(0);

      // The certificate takes the FDR's tone — the seal reads the new
      // type's rate.
      await expect(investments.previewCertificate).toContainText('FDR');

      // A DPS carries no principal, so the switch leaves the field
      // empty and the save disabled until it is filled.
      await expect(investments.saveChangesButton).toBeDisabled();
      await investments.principalInput.fill('100000');
      await expect(investments.saveChangesButton).toBeEnabled();
    });

    await test.step('Save and read the banner', async () => {
      await investments.saveChangesButton.click();

      await expect(page).toHaveURL(/#\/investments\/inv-dps-1$/);

      const feedback = new Feedback(page);
      await feedback.expectBannerText('Monthly DPS updated');
    });
  });
});
