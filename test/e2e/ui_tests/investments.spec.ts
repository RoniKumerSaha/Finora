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

      await expect(investments.cardTypePill(lifecycle.created.name)).toHaveText(
        lifecycle.expected.typePill,
      );
      await expect(investments.cardTermsLine(lifecycle.created.name)).toHaveText(
        lifecycle.expected.termsLine,
      );
      await expect(investments.cardPrincipalLine(lifecycle.created.name)).toHaveText(
        lifecycle.expected.principalLine,
      );

      // The countdown is derived from the calendar, so its shape is
      // asserted rather than its exact figure.
      await expect(investments.cardCountdown(lifecycle.created.name)).toHaveText(
        /^Matures in /,
      );

      // "Now" carries the current value; "At maturity" the projection.
      await expect(investments.cardCurrentLabel(lifecycle.created.name)).toHaveText(
        'Now',
      );
      await expect(investments.cardCurrentFigure(lifecycle.created.name)).toHaveText(
        lifecycle.expected.nowValue,
      );
      await expect(investments.cardMaturityLabel(lifecycle.created.name)).toHaveText(
        'At maturity',
      );
      await expect(investments.cardMaturityFigure(lifecycle.created.name)).toHaveText(
        lifecycle.expected.maturityValue,
      );
    });

    await test.step('Open the investment and read the money card', async () => {
      await investments.openInvestment(lifecycle.created.name);

      await expect(investments.detailHeading).toHaveText(lifecycle.created.name);
      await expect(investments.statusChip).toHaveText(
        lifecycle.expected.detailStatusChip,
      );
      await expect(investments.maturityCaption).toHaveText(
        lifecycle.expected.maturityCaption,
      );
      await expect(investments.moneyCardHeading).toHaveText(
        lifecycle.expected.moneyCardHeading,
      );

      await expect(investments.statValue('Principal')).toHaveText(
        data.fdr.principalFormatted,
      );
      await expect(investments.statValue('Maturity value')).toHaveText(
        data.fdr.maturityFormatted,
      );
      await expect(investments.statValue('Expected interest')).toHaveText(
        data.fdr.interestFormatted,
      );
      await expect(investments.statValue('Rate')).toHaveText(
        lifecycle.expected.rateStat,
      );
      await expect(investments.simpleInterestFormulaLine).toHaveText(
        lifecycle.expected.simpleInterestLine,
      );
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
      await expect(investments.cardTypePill(lifecycle.created.name)).toHaveText(
        lifecycle.expected.typePill,
      );
      await expect(investments.cardTermsLine(lifecycle.created.name)).toHaveText(
        lifecycle.expected.termsLine,
      );
      await expect(investments.cardMonthlyLine(lifecycle.created.name)).toHaveText(
        lifecycle.expected.monthlyLine,
      );
      await expect(investments.cardCurrentFigure(lifecycle.created.name)).toHaveText(
        lifecycle.expected.nowValue,
      );
      await expect(investments.cardMaturityFigure(lifecycle.created.name)).toHaveText(
        lifecycle.expected.maturityValue,
      );
    });

    await test.step('Read the Main Bank balance — no money moved', async () => {
      await accounts.goto();
      await expect(accounts.balanceValue(lifecycle.created.account)).toHaveText(
        lifecycle.expected.balanceBefore,
      );
    });

    await test.step('Open the investment and read the now-vs-maturity split', async () => {
      await investments.openInvestment(lifecycle.created.name);

      await expect(investments.moneyCardHeading).toHaveText(
        lifecycle.expected.moneyCardHeading,
      );
      await expect(investments.statValue('Contributed so far')).toHaveText(
        lifecycle.expected.contributedStat,
      );
      await expect(
        investments.statValue('Estimated payout when the term ends'),
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

    await test.step('Open the matured FDR and read its header and status chip', async () => {
      await investments.goto();
      await investments.openInvestment(data.fdr.name);

      await expect(investments.maturityCaption).toHaveText(
        maturity.expected.maturedCaption,
      );
      await expect(investments.statusChip).toHaveText(
        maturity.expected.maturedChip,
      );
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

      // The old investment is retired and sits in the "Closed" group.
      await expect(investments.closedSection).toBeVisible();
      await expect(investments.closedRow(data.fdr.name)).toContainText(
        maturity.expected.rolledOverChip,
      );

      // The replacement carries the same principal, rate and term, and
      // starts the day after the old maturity date.
      const replacement = investments.card(data.fdr.name);
      await expect(replacement).toBeVisible();
      await expect(investments.cardTypePill(data.fdr.name)).toHaveText('FDR');
      await expect(investments.cardTermsLine(data.fdr.name)).toHaveText(
        data.I01_fdrLifecycle.expected.termsLine,
      );
      await expect(investments.cardPrincipalLine(data.fdr.name)).toHaveText(
        data.I01_fdrLifecycle.expected.principalLine,
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

      await expect(investments.statusChip).toHaveText(maturity.expected.closedChip);
      await expect(investments.maturityCaption).toHaveText('Term ended');

      // It sits in the "Closed" group on the list.
      await investments.goto();
      await expect(investments.closedSection).toBeVisible();
      await expect(investments.closedRow(data.dps.name)).toContainText(
        maturity.expected.closedChip,
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

    await test.step('Open the DPS and read its money card', async () => {
      await investments.openInvestment(data.dps.name);

      await expect(investments.statValue('Current value')).toHaveText(
        split.dps.currentValue,
      );
      await expect(
        investments.statValue('Estimated payout when the term ends'),
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

    await test.step('Read the Summary card on the Investments screen', async () => {
      await investments.goto();

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

      // For an FDR the record is NOT auto-closed — the status is
      // still "matured", so the user must retire it by hand with
      // "Mark as done (no payout)".
      await expect(investments.statusChip).toHaveText(payout.expected.statusChip);
      await expect(investments.markDoneButton).toBeVisible();

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
      await expect(investments.closedRow(data.fdr.name)).toContainText(
        data.I05_maturity.expected.closedChip,
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
});
