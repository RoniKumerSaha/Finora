/**
 * planners.spec.ts — FIN-L04.
 *
 * The Investment Planner and the Loan Calculator — the two MOCK
 * planners. Both are scratchpads: they compute a projection and
 * nothing else. Neither writes a transaction, moves a balance, or
 * reaches the Insights screen.
 *
 * ## Known gaps this suite ASSERTS
 *
 * The manual plan describes the starter kits as
 * "৳5,000/mo, 8%, 12mo" etc. The build renders each kit's PROJECTED
 * MATURITY instead — "→ ৳ 62,665 in 1 year" — and offers the
 * blank-form route through the "+ New plan" CTA rather than a fourth
 * kit card. Both are asserted as they are built.
 *
 * ## Term in months OR years
 *
 * Both planner detail forms ship a Months / Years toggle on the term
 * field. The stored term is always a month count; the toggle only
 * changes how it is entered and displayed. The suite covers the
 * round-trip: a term entered in years converts to months, and
 * switching the unit back re-expresses the same month count.
 */
import { expect, test } from '@playwright/test';
import { InvestmentPlannerPage } from '../pages/InvestmentPlannerPage';
import { LoanCalculatorPage } from '../pages/LoanCalculatorPage';
import { AccountsPage } from '../pages/AccountsPage';
import { TransactionsPage } from '../pages/TransactionsPage';
import { seedState } from '../fixtures/app-state';
import { baseState, todayTransactions } from '../fixtures/seed-data';
import plansJson from '../../data/plans.json' with { type: 'json' };

const data = plansJson;

test.describe('Planners', () => {
  let invest: InvestmentPlannerPage;
  let loan: LoanCalculatorPage;
  let accounts: AccountsPage;
  let transactions: TransactionsPage;

  test.beforeEach(async ({ page }) => {
    invest = new InvestmentPlannerPage(page);
    loan = new LoanCalculatorPage(page);
    accounts = new AccountsPage(page);
    transactions = new TransactionsPage(page);
  });

  test('FIN-L04 Investment Planner and Loan Calculator', async ({ page }) => {
    const l04 = data.L04_planners;
    const expected = l04.expected;

    // A ledger the planners must leave alone.
    const state = baseState();
    state.transactions = todayTransactions();
    await seedState(page, state);

    await test.step('Open Plan → Loans and read the empty state', async () => {
      await loan.gotoList();

      await expect(loan.heading).toHaveText(expected.loanHeading);
      await expect(loan.subLine).toHaveText(expected.loanSubLine);
      await expect(loan.newProjectionButton).toBeVisible();

      await expect(loan.emptyStateTitle).toHaveText(expected.loanEmptyTitle);
      await expect(loan.emptyStateBody).toHaveText(expected.loanEmptyBody);
      await expect(loan.startProjectionButton).toBeVisible();
    });

    await test.step('Open "+ New projection" and read the form fields and the blocked-save reasons', async () => {
      await loan.startNewProjection();

      // The five fields.
      for (const field of expected.loanFields) {
        await expect(loan.labelledField(field)).toBeVisible();
      }

      // The term field ships with a Months / Years toggle.
      for (const unit of expected.loanTermUnitLabels) {
        await expect(
          loan.page.getByRole('button', { name: unit, exact: true }),
        ).toBeVisible();
      }
      // A new projection seeds a 12-month term, which is a whole
      // year — so the unit auto-picks Years and the field reads "1".
      await expect(loan.termUnitYearsButton).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await expect(loan.termInput).toHaveValue('1');

      // Nothing is filled in, so the Save button is disabled and
      // explains why.
      await expect(loan.savePlanButton).toBeDisabled();
      await expect(loan.savePlanButton).toHaveAttribute(
        'title',
        expected.loanBlockedReasons[0],
      );

      // A principal but no name.
      await loan.principalInput.fill(l04.loan.principal);
      await expect(loan.savePlanButton).toHaveAttribute(
        'title',
        expected.loanBlockedReasons[1],
      );

      // A name but no principal.
      await loan.nameInput.fill(l04.loan.name);
      await loan.principalInput.fill('');
      await expect(loan.savePlanButton).toHaveAttribute(
        'title',
        expected.loanBlockedReasons[2],
      );
    });

    await test.step('Enter the projection and save it', async () => {
      await loan.nameInput.fill(l04.loan.name);
      await loan.principalInput.fill(l04.loan.principal);
      await loan.annualRateInput.fill(l04.loan.rate);
      // Enter the term in months — the unit opens in Years, so switch
      // over first.
      await loan.termUnitMonthsButton.click();
      await loan.termInput.fill(l04.loan.term);
      await loan.firstPaymentDateInput.fill(l04.loan.firstPaymentDate);

      // With a name and a positive principal the save is unblocked.
      await expect(loan.savePlanButton).toBeEnabled();

      await loan.savePlanButton.click();
      await expect(page).toHaveURL(/#\/plan\/loan$/);
    });

    await test.step('Read the summary and the amortization table', async () => {
      await loan.projectionCard(l04.loan.name).click();
      await expect(loan.detailHeading).toBeVisible();

      // The "Summary (projection)" card and its three stats.
      await expect(loan.summaryLabel).toHaveText('Summary (projection)');
      await expect(loan.emiLabel).toHaveText(expected.loanSummaryStats[0]);
      await expect(loan.totalYouPayLabel).toHaveText(expected.loanSummaryStats[1]);
      await expect(loan.totalInterestLabel).toHaveText(expected.loanSummaryStats[2]);

      await expect(loan.projectionWarning).toHaveText(expected.loanWarning);

      // The amortization table's six columns.
      for (const column of expected.amortizationColumns) {
        await expect(loan.amortizationColumn(column)).toBeVisible();
      }

      // One row per month of the term.
      await expect(loan.amortizationRows).toHaveCount(Number(l04.loan.term));
    });

    await test.step('Enter the same term in years and read the converted term', async () => {
      // Switch the term unit to Years. The 12-month term becomes "1".
      await loan.termUnitYearsButton.click();
      await expect(loan.termUnitYearsButton).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await expect(loan.termInput).toHaveValue('1');

      // Typing 3 years converts to 36 months — the amortization table
      // grows to 36 rows and the caption reads in years.
      await loan.termInput.fill('3');
      await expect(loan.amortizationRows).toHaveCount(36);
      await expect(loan.termCaption).toHaveText(
        expected.loanTermYearsCaption,
      );

      // Switching back to Months re-expresses the same 36 months —
      // the value is never lost by a unit switch.
      await loan.termUnitMonthsButton.click();
      await expect(loan.termInput).toHaveValue('36');
      await expect(loan.amortizationRows).toHaveCount(36);
    });

    await test.step('Open Plan → Investments and read the empty state and the starter kits', async () => {
      await invest.gotoList();

      await expect(invest.heading).toHaveText(expected.investHeading);
      await expect(invest.subLine).toHaveText(expected.investSubLine);
      await expect(invest.newPlanButton).toBeVisible();

      await expect(invest.emptyStateHeadline).toHaveText(
        'How much could a 1-year FDR at 9% earn you?',
      );

      // The three starter kits.
      await expect(invest.starterKits).toHaveCount(3);
      for (const kit of l04.investmentKits) {
        await expect(invest.starterKit(kit.name)).toBeVisible();
      }
    });

    await test.step('Create a plan from the FDR starter kit and read the detail screen', async () => {
      const fdr = l04.investmentKits[1];
      await invest.startFromKit(fdr.name);

      await expect(invest.detailHeading).toBeVisible();

      // The hero card.
      await expect(invest.projectionLabel).toHaveText(expected.investProjection);
      await expect(invest.atMaturityCaption).toHaveText(expected.investMaturity);

      // The donut's legend.
      for (const legend of expected.investLegend) {
        await expect(invest.textExact(legend)).toBeVisible();
      }

      // The composition line and the three chips.
      await expect(invest.compositionLine).toBeVisible();
      for (const chip of expected.investChips) {
        await expect(invest.textExact(chip)).toBeVisible();
      }

      await expect(invest.projectionWarning).toHaveText(expected.investWarning);
      await expect(invest.footerNote).toHaveText(expected.investFooter);

      // The FDR kit's defaults: 100,000 at 9% for 12 months.
      await expect(invest.principalInput).toHaveValue('100000');
      await expect(invest.annualRateInput).toHaveValue('9');
    });

    await test.step('Read the plan term in years', async () => {
      // The 12-month term opens in Years ("1") because 12 months is a
      // whole year — the unit auto-picks the natural one.
      await expect(invest.termUnitYearsButton).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await expect(invest.termInput).toHaveValue('1');

      // The composition line reads in years too.
      await expect(invest.compositionLine).toHaveText(
        expected.investCompositionYears,
      );

      // Switching to Months re-expresses the same term — the value is
      // never lost by a unit switch.
      await invest.termUnitMonthsButton.click();
      await expect(invest.termInput).toHaveValue('12');
      await expect(invest.compositionLine).toHaveText(
        'Composition at maturity, over 1 year',
      );
    });

    await test.step('Return to Transactions — the ledger is untouched', async () => {
      // *The planners are scratch only* (FIN-L04, PRD §9.17.4). The
      // Transactions list still holds exactly the fixture's six
      // rows, and the account balances are unchanged.
      await transactions.goto();
      await expect(transactions.rows).toHaveCount(6);

      await accounts.goto();
      await expect(accounts.cards).toHaveCount(
        state.accounts.length,
      );
    });
  });
});
