/**
 * debts.spec.ts — FIN-D01 … FIN-D07.
 *
 * The debts domain: the flat and loan lifecycles, the opening
 * transaction every debt creates, the interest/principal split on a
 * loan payment, the direction / validation sweep, the delete /
 * completion semantics, the activity feed, the overpayment gap and the
 * owed-to-me repayment flow.
 *
 * Each manual case becomes EXACTLY ONE test, titled with its manual
 * ID and the manual title verbatim. `**Priority:** High` cases carry
 * the `@smoke` tag — in the details object, never in the title.
 *
 * Every selector lives in `DebtsPage` (or `AccountsPage` /
 * `TransactionsPage`); this file carries no locator strings and no
 * copy literals — every user-visible string is read from
 * `test/data/debts.json`.
 */
import { expect, test } from '@playwright/test';
import { AccountsPage } from '../pages/AccountsPage';
import { DebtsPage } from '../pages/DebtsPage';
import { TransactionsPage } from '../pages/TransactionsPage';
import { ConfirmDialog } from '../pages/component/ConfirmDialog';
import { Feedback } from '../pages/component/Feedback';
import { seedState } from '../fixtures/app-state';
import {
  debtActivityState,
  debtWithPaymentState,
  noDebtsState,
  singleFlatDebtState,
  singleReceivableDebtState,
} from '../fixtures/seed-data';
import debtsJson from '../../data/debts.json' with { type: 'json' };

const data = debtsJson;

test.describe('Debts', () => {
  let debts: DebtsPage;

  test.beforeEach(async ({ page }) => {
    debts = new DebtsPage(page);
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-D01 — the flat debt lifecycle
  // ─────────────────────────────────────────────────────────────────

  test('FIN-D01 Flat debt lifecycle and its opening transaction', { tag: '@smoke' }, async ({ page }) => {
    const lifecycle = data.D01_flatLifecycle;
    const accounts = new AccountsPage(page);
    const transactions = new TransactionsPage(page);

    await seedState(page, noDebtsState());

    await test.step('Open Debts and click "+ New debt"', async () => {
      await debts.goto();
      await debts.addButton.click();

      await debts.saveButton.waitFor({ state: 'visible' });
    });

    await test.step('Read the Main Bank balance before the debt exists', async () => {
      // The debt does not exist yet, so the account still carries its
      // opening balance.
      await accounts.goto();
      await expect(accounts.balanceValue(lifecycle.created.account)).toHaveText(
        lifecycle.expected.balanceBefore,
      );
    });

    await test.step(
      'Enter the name, the direction, the total, the account and the person, and save',
      async () => {
        await debts.gotoAdd();

        await debts.fillForm({
          name: lifecycle.created.name,
          direction: 'i_owe',
          total: lifecycle.created.total,
          accountName: lifecycle.created.account,
          person: lifecycle.created.person,
        });
        await debts.saveButton.click();

        await expect(page).toHaveURL(/#\/debts$/);
      },
    );

    await test.step('Read the new card', async () => {
      const card = debts.card(lifecycle.created.name);
      await expect(card).toBeVisible();

      await expect(debts.cardDirectionTag(lifecycle.created.name)).toHaveText(
        lifecycle.expected.directionTag,
      );
      await expect(debts.cardPaidLine(lifecycle.created.name)).toHaveText(
        lifecycle.expected.paidLine,
      );
      await expect(debts.cardCounterpartyLine(lifecycle.created.name)).toContainText(
        lifecycle.expected.counterparty,
      );
      await expect(debts.cardHeadlineFigure(lifecycle.created.name)).toHaveText(
        lifecycle.expected.remaining,
      );
      // A FLAT debt carries ONE figure — the amount still owed. It has
      // no "of ৳ Y total" caption and no "% paid" rail, because both
      // would be a second measure competing with the hero amount.
      await expect(debts.cardTotalCaption(lifecycle.created.name)).toHaveCount(0);
      await expect(debts.cardPercentPaid(lifecycle.created.name)).toHaveCount(0);

      // The "Pay now" chip is offered for an active debt.
      await expect(debts.payChip(lifecycle.created.name)).toBeVisible();
    });

    await test.step('Open Transactions and read the rows', async () => {
      await transactions.goto();

      // The opening leg is IN the ledger — an Income of ৳20,000 noted
      // "Debt: Loan from Rahim".
      const row = transactions.row(lifecycle.expected.openingTransactionNote);
      await expect(row).toBeVisible();
      await expect(transactions.amountOf(row)).toHaveText(lifecycle.expected.remaining);

      // It carries the "Borrowed" tag.
      await expect(transactions.rowTag(lifecycle.expected.openingTransactionNote)).toHaveAttribute(
        'aria-label',
        lifecycle.expected.openingTag,
      );
    });

    await test.step('Read the Main Bank balance again', async () => {
      await accounts.goto();

      // The account GAINED ৳20,000 — the known gap against PRD §9.7
      // ("Creating a debt does not affect account balances").
      await expect(accounts.balanceValue(lifecycle.created.account)).toHaveText(
        lifecycle.expected.balanceAfterOpening,
      );
    });

    await test.step('The opening row appears under the "Debt payments" chip', async () => {
      await transactions.goto();
      await transactions.applyFilter('Debt payments');

      await expect(
        transactions.row(lifecycle.expected.openingTransactionNote),
      ).toBeVisible();
    });

    await test.step('Tap "Pay now" and read the payment modal', async () => {
      await debts.goto();
      await debts.openPayment(lifecycle.created.name);

      await expect(debts.paymentTitle).toHaveText(lifecycle.expected.paymentModalTitle);
      await expect(debts.paymentOutstanding).toContainText(
        lifecycle.expected.paymentOutstanding,
      );

      // The four fields.
      await expect(debts.paymentAmountInput).toBeVisible();
      await expect(debts.paymentDateInput).toBeVisible();
      await expect(debts.paymentAccountSelect).toBeVisible();
      await expect(debts.paymentNoteInput).toBeVisible();
    });

    await test.step('Enter 5000, choose Main Bank, add the note, and save', async () => {
      await debts.paymentAmountInput.fill(lifecycle.payment.amount);
      await debts.paymentAccountSelect.selectOption({ label: lifecycle.payment.account });
      await debts.paymentNoteInput.fill(lifecycle.payment.note);
      await debts.recordPaymentButton.click();

      await debts.paymentDialog.waitFor({ state: 'detached' });
    });

    await test.step('Read the payment toast', async () => {
      const feedback = new Feedback(page);
      await feedback.waitForToast();
      await expect(feedback.toastTitle).toContainText(lifecycle.expected.paymentToast);
    });

    await test.step('Read the card again', async () => {
      await debts.goto();

      await expect(debts.cardPaidLine(lifecycle.created.name)).toHaveText(
        lifecycle.expected.paidAfter,
      );
      await expect(debts.cardHeadlineFigure(lifecycle.created.name)).toHaveText(
        lifecycle.expected.remainingAfter,
      );
      // Still one figure only — the hero amount drops, no rail appears.
      await expect(debts.cardPercentPaid(lifecycle.created.name)).toHaveCount(0);
    });

    await test.step('Read the Main Bank balance once more', async () => {
      await accounts.goto();

      // The account lost the GROSS amount — 1,40,000 − 5,000.
      await expect(accounts.balanceValue(lifecycle.created.account)).toHaveText(
        lifecycle.expected.balanceAfterPayment,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-D02 — the loan-kind debt
  // ─────────────────────────────────────────────────────────────────

  test('FIN-D02 Loan-kind debt and the interest/principal split', { tag: '@smoke' }, async ({ page }) => {
    const loan = data.D02_loanKind;
    const accounts = new AccountsPage(page);

    await seedState(page, noDebtsState());

    await test.step('Open "+ New debt"', async () => {
      await debts.gotoAdd();
    });

    await test.step(
      'Set the direction, the total, tick the loan toggle, set the rate and the term, pick the account, and save',
      async () => {
        await debts.fillForm({
          name: loan.created.name,
          direction: 'i_owe',
          total: loan.created.total,
          accountName: loan.created.account,
          loan: true,
          interestRate: loan.created.rate,
          termMonths: loan.created.term,
        });
        await debts.saveButton.click();

        await expect(page).toHaveURL(/#\/debts$/);
      },
    );

    await test.step('Read the card', async () => {
      const card = debts.card(loan.created.name);
      await expect(card).toBeVisible();

      // The "Loan" pill.
      await expect(card.getByText(loan.expected.loanPill, { exact: true })).toBeVisible();

      // "12% APR · 36mo".
      await expect(debts.cardLoanTerms(loan.created.name)).toHaveText(
        loan.expected.termsLine,
      );

      // "Loan amount" with "৳ 60,000" on the line below it, and
      // "Paid ৳ 0 interest and ৳ 0 principal".
      await expect(debts.cardLoanAmountLabel(loan.created.name)).toHaveText(
        loan.expected.loanAmountLabel,
      );
      await expect(debts.cardLoanAmount(loan.created.name)).toHaveText(
        loan.expected.loanAmount,
      );
      await expect(debts.cardLoanSplitLine(loan.created.name)).toHaveText(
        loan.expected.splitLine,
      );

      // "Monthly EMI" and the outstanding.
      await expect(debts.cardMonthlyEmi(loan.created.name)).toHaveText(
        loan.expected.emi,
      );
      await expect(debts.cardOutstanding(loan.created.name)).toHaveText(
        loan.expected.outstanding,
      );
    });

    await test.step('Tap "Pay now" and read the pre-filled amount and the split preview', async () => {
      await debts.openPayment(loan.created.name);

      // The Amount field is pre-filled with the standard EMI.
      await expect(debts.paymentAmountInput).toHaveValue(loan.expected.emi.replace(/[^0-9]/g, ''));

      // The loan pre-fill hint.
      await expect(debts.paymentAmountHint).toContainText(loan.expected.emiHint);

      // The split preview.
      await expect(debts.splitPreview).toHaveText(loan.expected.splitPreviewHeading);
      await expect(debts.splitFigures).toContainText(loan.expected.firstSplit);
    });

    await test.step('Save the payment and read the toast and the card', async () => {
      await debts.recordPaymentButton.click();
      await debts.paymentDialog.waitFor({ state: 'detached' });

      const feedback = new Feedback(page);
      await feedback.waitForToast();
      await expect(feedback.toastTitle).toContainText(loan.expected.firstToast);
      await expect(feedback.toastBody).toContainText(loan.expected.firstToastWhy);
    });

    await test.step('Read the card after the first payment', async () => {
      await debts.goto();

      await expect(debts.cardLoanSplitLine(loan.created.name)).toHaveText(
        loan.expected.splitLineAfter,
      );
      await expect(debts.cardOutstanding(loan.created.name)).toHaveText(
        loan.expected.outstandingAfter,
      );
    });

    await test.step('Read the Main Bank balance after the first payment', async () => {
      await accounts.goto();

      // The account moved by the GROSS amount (1,993), not by the
      // principal portion (1,393).
      await expect(accounts.balanceValue(loan.created.account)).toHaveText(
        loan.expected.balanceAfterPayment,
      );
    });

    await test.step('Pay a second time with an amount smaller than one month\'s interest', async () => {
      await debts.goto();
      await debts.openPayment(loan.created.name);

      await debts.paymentAmountInput.fill(loan.secondPaymentAmount);

      // The underpayment chip appears and the principal is 0.
      await expect(debts.underpaymentChip).toHaveText(loan.expected.underpaymentChip);
      await expect(debts.splitFigures).toContainText(loan.expected.secondSplit);

      await debts.recordPaymentButton.click();
      await debts.paymentDialog.waitFor({ state: 'detached' });
    });

    await test.step('Read the underpayment toast', async () => {
      const feedback = new Feedback(page);
      await feedback.waitForToast();
      await expect(feedback.toastTitle).toContainText(loan.expected.underpaymentToast);
      await expect(feedback.toastBody).toContainText(loan.expected.underpaymentSuffix);
    });

    await test.step('Read the outstanding on the card', async () => {
      await debts.goto();

      // The outstanding did NOT reduce — the whole payment went to
      // interest.
      await expect(debts.cardOutstanding(loan.created.name)).toHaveText(
        loan.expected.outstandingAfter,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-D03 — direction, validation and the detail screen
  // ─────────────────────────────────────────────────────────────────

  test('FIN-D03 Debt direction, validation and the detail screen', { tag: '@smoke' }, async ({ page }) => {
    const validation = data.D03_directionValidation;
    const accounts = new AccountsPage(page);
    const transactions = new TransactionsPage(page);

    await seedState(page, noDebtsState());

    await test.step('Open the Add debt form', async () => {
      await debts.gotoAdd();
    });

    await test.step('Switch the direction to "Owed to me (you lent)" and read the form', async () => {
      await debts.directionSelect.selectOption({
        label: validation.owedToMeDirection,
      });

      // The loan toggle DISAPPEARS entirely for the owed-to-me
      // direction — it is offered only for "I owe".
      await expect(debts.loanCheckbox).toHaveCount(0);
      await expect(debts.interestRateInput).toHaveCount(0);
      await expect(debts.termMonthsInput).toHaveCount(0);

      // The account label flips with the direction.
      await expect(debts.accountSelect).toHaveAttribute('id', /.*/);
      await expect(debts.accountFromLabel).toBeVisible();
    });

    await test.step('Leave Name empty and try to save', async () => {
      // The save is disabled.
      await expect(debts.saveButton).toBeDisabled();

      // Bypassing it raises the banner.
      await debts.submitForm();

      const feedback = new Feedback(page);
      await feedback.expectBannerText(validation.nameRequired.banner.what);
      await feedback.expectBannerText(validation.nameRequired.banner.why);
      await feedback.expectBannerText(validation.nameRequired.banner.fix);
    });
    await test.step('Enter a total of 0', async () => {
      await debts.nameInput.fill('Validation debt');
      await debts.totalAmountInput.fill('0');

      // The inline error appears.
      await expect(debts.totalError).toHaveText(validation.totalError);
      await expect(debts.saveButton).toBeDisabled();
    });

    await test.step('Tick the loan toggle, then clear the rate; clear the term', async () => {
      // The toggle is back — the direction is "I owe" again, so the
      // rate/term sweep needs the loan fields in play.
      await debts.directionSelect.selectOption({ label: 'I owe (you borrowed)' });
      await debts.loanCheckbox.check();

      await debts.interestRateInput.fill('0');
      await expect(debts.rateError).toHaveText(validation.rateError);
      await expect(debts.saveButton).toBeDisabled();

      await debts.interestRateInput.fill('12');
      await debts.termMonthsInput.fill('0');
      await expect(debts.termError).toHaveText(validation.termError);
      await expect(debts.saveButton).toBeDisabled();
    });

    await test.step('Leave the account unselected', async () => {
      // Untick the loan so its rate/term fields go away, leaving the
      // account as the only thing the save is still missing.
      await debts.loanCheckbox.uncheck();

      await debts.clearAccountSelection();

      // The inline error reads "Pick an account." and the save is
      // disabled.
      await expect(debts.accountHintText).toHaveText(validation.accountHint);
      await expect(debts.saveButton).toBeDisabled();
    });

    await test.step('Save an "Owed to me" debt of 15000 against Cash, with the person Karim', async () => {
      await debts.directionSelect.selectOption({ label: validation.owedToMeDirection });
      await debts.nameInput.fill('Lent to Karim');
      await debts.totalAmountInput.fill(validation.created.total);
      await debts.accountSelect.selectOption({ label: validation.created.account });
      await debts.personInput.fill(validation.created.person);
      await debts.saveButton.click();

      await expect(page).toHaveURL(/#\/debts$/);
    });

    await test.step('Read the card', async () => {
      await expect(debts.cardDirectionTag('Lent to Karim')).toHaveText(
        validation.expected.directionTag,
      );
      await expect(debts.cardPaidLine('Lent to Karim')).toHaveText(
        validation.expected.paidLine,
      );
      await expect(debts.cardCounterpartyLine('Lent to Karim')).toContainText(
        validation.expected.counterparty,
      );
      await expect(debts.payChip('Lent to Karim')).toHaveText(
        validation.expected.receiveChip,
      );
    });

    await test.step('Read the Transactions list and the Cash balance', async () => {
      await transactions.goto();

      // An Expense opening transaction of ৳15,000, noted
      // "Debt: Lent to Karim".
      const row = transactions.row(validation.expected.openingTransactionNote);
      await expect(row).toBeVisible();
      await expect(transactions.rowTag(validation.expected.openingTransactionNote)).toHaveAttribute(
        'aria-label',
        validation.expected.openingTag,
      );
    });

    await test.step('Read the Cash balance', async () => {
      await accounts.goto();

      // Cash is DEBITED by ৳15,000 — it opened at ৳ 5,000.
      await expect(accounts.balanceValue(validation.created.account)).toHaveText(
        validation.expected.cashAfter,
      );
    });

    await test.step('Open a saved debt and read the screen', async () => {
      await debts.goto();

      // The card opens the SLIP — the document you READ. The edit
      // pass is one click further, from the slip's own Edit button.
      await debts.openDebt('Lent to Karim');
      await expect(page).toHaveURL(/#\/debts\/[^/]+$/);
      await expect(debts.detailHeading).toHaveText('Lent to Karim');

      await debts.editLink.click();
      await debts.waitForAppReady();
      await expect(page).toHaveURL(/#\/debts\/[^/]+\/edit$/);
      await expect(debts.editHeading).toHaveText(validation.expected.editHeading);

      // There is NO account picker on the edit screen.
      await expect(debts.accountPicker).toHaveCount(0);
    });

    await test.step('Save the edit and read the toast', async () => {
      await debts.saveChangesButton.click();

      const feedback = new Feedback(page);
      await feedback.waitForToast();
      await expect(feedback.toastTitle).toContainText(validation.expected.updateToast);
      await expect(feedback.toastBody).toContainText(validation.expected.updateToastBody);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-D04 — delete semantics, auto-completion and direction flip
  // ─────────────────────────────────────────────────────────────────

  test('FIN-D04 Debt delete semantics, auto-completion and direction flip', { tag: '@smoke' }, async ({ page }) => {
    const lifecycle = data.D04_deleteAndCompletion;
    const transactions = new TransactionsPage(page);

    await seedState(page, debtWithPaymentState());

    await test.step('Open the debt with the linked payment, click "Delete debt", and confirm', async () => {
      await debts.goto();
      await debts.openDebt(lifecycle.debtWithPayment.name);

      await debts.deleteButton.click();

      const dialog = new ConfirmDialog(page);
      await dialog.confirm('Delete debt');

      await expect(page).toHaveURL(/#\/debts$/);
    });

    await test.step('Read the "Debt deleted" banner', async () => {
      const feedback = new Feedback(page);
      await feedback.expectBannerText(lifecycle.expected.deleteBanner);
    });
    await test.step('The debt record is removed outright', async () => {
      await debts.goto();
      await expect(debts.card(lifecycle.debtWithPayment.name)).toHaveCount(0);

      // *Known gap:* PRD §8.14 / §15 require a SOFT archive — the
      // debt must survive with `status = 'archived'` and carry an
      // "Archived debt" tag. The build performs a hard delete, so
      // neither the record nor the tag exists.
      await expect(
        debts.absent.text(lifecycle.expected.archivedTagLabel),
      ).toHaveCount(0);
    });

    await test.step('Inspect the surviving linked transaction in Transactions and read its tag', async () => {
      await transactions.goto();

      // The row is STILL in the ledger.
      const row = transactions.row('Part payment');
      await expect(row).toBeVisible();

      // The orphaned repayment row falls back to the generic
      // "Debt received" tag.
      await expect(transactions.rowTag('Part payment')).toHaveAttribute(
        'aria-label',
        lifecycle.expected.orphanTag,
      );
      await expect(transactions.rowTag('Part payment')).toHaveText(
        lifecycle.expected.orphanTagLabel,
      );
    });

    await test.step(
      'Open the payment-free debt, change the direction from "I owe" to "Owed to me", and save',
      async () => {
        await debts.goto();
        await debts.openEdit(lifecycle.debtWithoutPayment.name);

        await debts.directionSelect.selectOption({ label: 'Owed to me (you lent)' });
        await debts.saveChangesButton.click();

        // The save is NOT gated behind any confirmation — no dialog
        // appears, and the app navigates back to the SLIP, where the
        // new terms are now engraved.
        await expect(page).toHaveURL(/#\/debts\/[^/]+$/);
      },
    );

    await test.step('Read the before/after direction stamp and the amount due', async () => {
      await debts.goto();

      // The direction flip re-derives the paid figure against the new
      // polarity — a payment-free debt reads 0% either way, and the
      // card now carries the owed-to-me wording. The flat card has no
      // "% paid" rail at all, so what the flip is asserted on is the
      // stamp and the single amount.
      await expect(debts.cardPercentPaid(lifecycle.debtWithoutPayment.name)).toHaveCount(0);
      await expect(debts.cardDirectionTag(lifecycle.debtWithoutPayment.name)).toHaveText(
        'Owed to me',
      );
      await expect(debts.cardPaidLine(lifecycle.debtWithoutPayment.name)).toHaveText(
        'Nothing received yet',
      );
    });

    await test.step('Record a payment equal to the remaining total of a third debt', async () => {
      await debts.goto();

      // Pay the EXACT remaining total.
      await debts.openPayment(lifecycle.debtToPayOff.name);
      await debts.paymentAmountInput.fill('60000');
      await debts.paymentAccountSelect.selectOption({ label: 'Cash' });
      await debts.recordPaymentButton.click();
      await debts.paymentDialog.waitFor({ state: 'detached' });
    });

    await test.step('Read the completed section', async () => {
      await debts.goto();

      // The debt leaves the active grid and appears under
      // "Completed (n)" as "{total} paid off · {person} · {account}".
      await expect(debts.card(lifecycle.debtToPayOff.name)).toHaveCount(0);
      await expect(debts.completedHeading).toHaveText(
        lifecycle.expected.completedHeading,
      );
      await expect(debts.completedRows.first()).toContainText(
        lifecycle.expected.paidOffLabel,
      );
      await expect(debts.completedRows.first()).toContainText('Rahim');
      await expect(debts.completedRows.first()).toContainText('Cash');
    });

    await test.step('Look for the PRD\'s "paid off. Nice." acknowledgement', async () => {
      // *Known gap:* PRD §8.15 expects a "City Bank loan paid off.
      // Nice." toast when a debt is settled. The build raises a
      // generic payment toast instead, so the acknowledgement string
      // does not exist anywhere on the screen.
      await expect(
        debts.absent.text(lifecycle.expected.paidOffToast, false),
      ).toHaveCount(0);
    });

    await test.step('Look for any way to record a further payment against the completed debt', async () => {
      await debts.goto();

      // The "Pay now" chip renders only for an active debt, so no
      // payment path is offered.
      await expect(debts.payChip(lifecycle.debtToPayOff.name)).toHaveCount(0);

      // And there is no message explaining why — the only "completed"
      // wording on the screen is the section's own heading.
      await expect(
        debts.absent.text(/fully paid|already paid/i, false),
      ).toHaveCount(0);
      await expect(
        debts.absent.text(/this debt is (?:fully )?paid/i, false),
      ).toHaveCount(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-D05 — the activity feed and the summary card
  // ─────────────────────────────────────────────────────────────────

  test('FIN-D05 Debt activity feed and summary card', async ({ page }) => {
    const activity = data.D05_activity;

    await seedState(page, debtActivityState());

    await test.step('Open the debt and read the Activity card', async () => {
      await debts.goto();
      await debts.openDebt('Loan from Rahim');

      await expect(debts.activityCard).toBeVisible();

      // The three stats.
      for (const stat of activity.expected.stats) {
        await expect(debts.activityCard.getByText(stat, { exact: true })).toBeVisible();
      }

      // Two matching payments (the expenses) and ৳12,000 paid.
      await expect(debts.activityStats.getByText(activity.expected.paymentsCount, { exact: true })).toBeVisible();
      await expect(debts.activityStats.getByText(activity.expected.totalPaid, { exact: true })).toBeVisible();
    });

    await test.step('Read the activity rows', async () => {
      // The two expenses are "Payment" rows and the income is a
      // "Reversal" row on an "I owe" debt. Each row reads
      // "{TAG} · {date}".
      await expect(debts.activityTag('Payment')).toHaveCount(2);
      await expect(debts.activityTag('Reversal')).toHaveCount(1);

      // The amount sits on the right of the row.
      for (const amount of activity.expected.rowAmounts) {
        await expect(debts.activityCard.getByText(amount, { exact: true })).toBeVisible();
      }
    });

    await test.step('Read the Activity footer', async () => {
      await expect(debts.activityCard).toContainText(activity.expected.footer);
    });

    await test.step('Read the Summary card', async () => {
      await debts.goto();

      await expect(debts.summaryCard).toBeVisible();

      // "You owe" in the danger tone and "Owed to you" in the primary
      // tone.
      await expect(debts.summaryCard.getByText('You owe', { exact: true })).toBeVisible();
      await expect(debts.summaryCard.getByText('Owed to you', { exact: true })).toBeVisible();

      // Each with its "Across N debt(s)" caption.
      await expect(debts.summaryCaption('You owe')).toHaveText(
        activity.expected.summaryAcrossOwe,
      );
      await expect(debts.summaryCaption('Owed to you')).toHaveText(
        activity.expected.summaryAcrossReceivable,
      );

      // The "How it works:" footer.
      await expect(debts.summaryCard).toContainText(activity.expected.howItWorks);
    });

    await test.step('Open a debt with no payments', async () => {
      await debts.goto();
      await debts.openDebt('Bike loan');

      // The Activity card is shown only when payments exist.
      await expect(debts.activityCard).toHaveCount(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-D06 — the overpayment gap
  // ─────────────────────────────────────────────────────────────────

  test('FIN-D06 A payment larger than the outstanding is not blocked', async ({ page }) => {
    const overpay = data.D06_overpayment;

    await seedState(page, singleFlatDebtState());

    await test.step('Tap "Pay now"', async () => {
      await debts.goto();
      await debts.openPayment('Loan from Rahim');
    });

    await test.step(`Enter ${overpay.paymentAmount} — more than the ৳${overpay.outstanding.toLocaleString('en-US')} outstanding — and save`, async () => {
      // No validation blocks the overpayment.
      await debts.paymentAmountInput.fill(overpay.paymentAmount);
      await expect(debts.paymentAmountError).toHaveCount(0);
      await expect(debts.recordPaymentButton).toBeEnabled();

      await debts.paymentAccountSelect.selectOption({ label: 'Cash' });
      await debts.recordPaymentButton.click();
      await debts.paymentDialog.waitFor({ state: 'detached' });
    });

    await test.step('Read the toast', async () => {
      const feedback = new Feedback(page);
      await feedback.waitForToast();
      await expect(feedback.toastTitle).toContainText(overpay.expected.toast);
    });

    await test.step('Read the card and the debt\'s paid figure', async () => {
      await debts.goto();

      // The overpayment retires the debt, so it leaves the active
      // grid and appears under "Completed (n)".
      await expect(debts.card('Loan from Rahim')).toHaveCount(0);
      await expect(debts.completedHeading).toHaveText(
        overpay.expected.completedHeading,
      );
      await expect(debts.completedRows.first()).toContainText(
        overpay.expected.paidOffLabel,
      );
    });

    await test.step('Read the paid and outstanding figures on the debt\'s own screen', async () => {
      await debts.openCompletedDebt('Loan from Rahim');

      // The Activity card's "Total paid" reads ৳25,000 — more than the
      // ৳20,000 total.
      await expect(
        debts.activityStats.getByText(overpay.expected.totalPaidAfter, { exact: true }),
      ).toBeVisible();

      // The fully-paid callout carries the debt's balance, and the
      // outstanding has been clamped to ৳0.
      await expect(debts.fullyPaidCallout).toBeVisible();
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-D07 — the owed-to-me repayment
  // ─────────────────────────────────────────────────────────────────

  test('FIN-D07 Receiving a repayment on an owed-to-me debt', { tag: '@smoke' }, async ({ page }) => {
    const repayment = data.D07_repayment;
    const accounts = new AccountsPage(page);
    const transactions = new TransactionsPage(page);

    await seedState(page, singleReceivableDebtState());

    await test.step('Open "+ Add transaction" and choose Income', async () => {
      await transactions.openPickerAndChoose('income');
    });

    await test.step('Open the "Linked debt (optional)" dropdown', async () => {
      // The dropdown offers ONLY debts with the "Owed to me" direction.
      await expect(transactions.linkedDebtSelect).toBeVisible();

      const options = transactions.linkedDebtOptions;
      await expect(options).toHaveCount(2); // "— None —" + the debt
      await expect(options.nth(1)).toHaveText(repayment.debtName);
    });

    await test.step('Select Lent to Karim', async () => {
      await transactions.linkedDebtSelect.selectOption({ label: repayment.debtName });

      // The linked line reads the remaining BEFORE the payment.
      await expect(transactions.linkedDebtRemaining).toContainText(
        repayment.expected.remainingBefore,
      );
    });

    await test.step('Enter 5000, choose the account Cash, and save', async () => {
      await transactions.amountInput.fill(repayment.amount);
      await transactions.accountSelect.selectOption({ label: repayment.account });
      await transactions.saveAndWaitForList();
    });

    await test.step('Read the debt card', async () => {
      await debts.goto();

      await expect(debts.cardPaidLine(repayment.debtName)).toHaveText(
        repayment.expected.paidLine,
      );
      // A flat card states one figure — no rail, no "% paid" caption.
      await expect(debts.cardPercentPaid(repayment.debtName)).toHaveCount(0);
    });

    await test.step('Read the Cash balance', async () => {
      await accounts.goto();

      // Cash GAINED ৳5,000 — a repayment is income, so the receiving
      // account is credited.
      await expect(accounts.balanceValue(repayment.account)).toHaveText(
        repayment.expected.cashAfter,
      );
    });

    await test.step('Read the linked line on the form again', async () => {
      // The remaining figure falls by the linked amount — this is what
      // the case's step 2 asserts, checked against the form after the
      // payment has landed.
      await transactions.gotoForm('income');
      await transactions.linkedDebtSelect.selectOption({ label: repayment.debtName });

      await expect(transactions.linkedDebtRemaining).toContainText(
        repayment.expected.remainingAfter,
      );
    });
  });
});
