/**
 * transactions.spec.ts — FIN-T01 … FIN-T12.
 *
 * The Transactions domain: the add/edit/delete lifecycle, the list
 * filters, the amount rules, the category picker, the transfer form's
 * specifics, the linked-debt / linked-investment records and the row
 * anatomy.
 *
 * Each manual case becomes EXACTLY ONE test, titled with its manual
 * ID and the manual title verbatim. `**Priority:** High` cases carry
 * the `@smoke` tag — in the details object, never in the title.
 *
 * Every selector lives in `TransactionsPage` (or `AccountsPage` /
 * `DebtsPage` / `HomePage`); this file carries no locator strings and
 * no copy literals — every user-visible string is read from
 * `test/data/transactions.json` (or `accounts.json`).
 */
import { expect, test } from '@playwright/test';
import { AccountsPage } from '../pages/AccountsPage';
import { DebtsPage } from '../pages/DebtsPage';
import { HomePage } from '../pages/HomePage';
import { TransactionsPage } from '../pages/TransactionsPage';
import { ConfirmDialog } from '../pages/component/ConfirmDialog';
import { Feedback } from '../pages/component/Feedback';
import { seedState, reseedState } from '../fixtures/app-state';
import {
  debtPaymentState,
  editableExpenseState,
  fdrState,
  filterState,
  formattingState,
  formState,
  negativeBalanceState,
  singleAccountState,
  visaCardOnlyState,
} from '../fixtures/seed-data';
import transactionsJson from '../../data/transactions.json' with { type: 'json' };
import accountsJson from '../../data/accounts.json' with { type: 'json' };

const data = transactionsJson;
const accountsData = accountsJson;

test.describe('Transactions', () => {
  let transactions: TransactionsPage;
  let accounts: AccountsPage;

  test.beforeEach(async ({ page }) => {
    transactions = new TransactionsPage(page);
    accounts = new AccountsPage(page);
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-T01 — the add lifecycle for all three types
  // ─────────────────────────────────────────────────────────────────

  test('FIN-T01 Income, expense and transfer lifecycle', { tag: '@smoke' }, async ({ page }) => {
    const lifecycle = data.T01_lifecycle;
    await seedState(page, formState());

    // Each save raises a "Transaction added" toast. The toast lives
    // 1.5 s, so its copy is captured AT the moment of the save rather
    // than asserted later — by the time a single assertion at the end
    // of the test would run, the first toast has long expired.
    const toasts: { title: string; body: string }[] = [];

    await test.step('Click "+ Add transaction" and choose Income', async () => {
      await transactions.goto();
      await transactions.addButton.click();
      await transactions.pickerHeading.waitFor({ state: 'visible' });
      await transactions.typeCard('income').click();
      await transactions.formHeading('income').waitFor({ state: 'visible' });
    });

    await test.step('Enter 60000, choose the category Salary, choose the account Main Bank, and save', async () => {
      await transactions.amountInput.fill(lifecycle.income.amount);
      await transactions.categoryChip(lifecycle.income.category).click();
      await transactions.accountSelect.selectOption({ label: lifecycle.income.account });
      toasts.push(await transactions.saveAndReadToast());
    });

    await test.step('Click "+ Add transaction" and choose Expense', async () => {
      await transactions.addButton.click();
      await transactions.pickerHeading.waitFor({ state: 'visible' });
      await transactions.typeCard('expense').click();
      await transactions.formHeading('expense').waitFor({ state: 'visible' });
    });

    await test.step('Enter 1200, choose the category Groceries, choose the account Cash, and save', async () => {
      await transactions.amountInput.fill(lifecycle.expense.amount);
      await transactions.categoryChip(lifecycle.expense.category).click();
      await transactions.accountSelect.selectOption({ label: lifecycle.expense.account });
      toasts.push(await transactions.saveAndReadToast());
    });

    await test.step('Click "+ Add transaction" and choose Transfer', async () => {
      await transactions.addButton.click();
      await transactions.pickerHeading.waitFor({ state: 'visible' });
      await transactions.typeCard('transfer').click();
      await transactions.formHeading('transfer').waitFor({ state: 'visible' });
    });

    await test.step('Enter 3000, set From to Cash and To to bKash, and save', async () => {
      await transactions.amountInput.fill(lifecycle.transfer.amount);
      await transactions.fromSelect.selectOption({ label: lifecycle.transfer.from });
      await transactions.toSelect.selectOption({ label: lifecycle.transfer.to });
      toasts.push(await transactions.saveAndReadToast());
    });

    await test.step('Read the three rows in the Transactions list', async () => {
      await expect(transactions.rows).toHaveCount(3);

      // The subtitles carry account + category (or the transfer pair).
      await expect(
        transactions.subtitleOf(transactions.row(lifecycle.income.category)),
      ).toHaveText(lifecycle.expected.rowSubtitles[0]);
      await expect(
        transactions.subtitleOf(transactions.row(lifecycle.expense.category)),
      ).toHaveText(lifecycle.expected.rowSubtitles[1]);
      await expect(transactions.subtitleOf(transactions.row('transfer'))).toHaveText(
        lifecycle.expected.rowSubtitles[2],
      );
    });

    await test.step(`Amounts render as "${lifecycle.expected.amountFormat}" — no + / − sign`, async () => {
      // The transfer row's amount is 3000; the manual's exemplar is
      // the same rendering with a different figure, so the format is
      // read from the JSON store and the figure swapped.
      await expect(transactions.amountOf(transactions.row('transfer'))).toHaveText(
        lifecycle.expected.amountFormat.replace('3,500', '3,000'),
      );

      // No sign glyph anywhere in the amount column.
      const amounts = await transactions.rows
        .locator('div.font-bold.tabular')
        .allTextContents();
      expect(amounts.length).toBe(3);
      for (const amount of amounts) {
        expect(amount).not.toMatch(/[+−]/);
      }
    });

    await test.step('Each save raises a "Transaction added" toast', async () => {
      // All three saves raise the same toast, and each one's copy was
      // captured at the moment it was raised.
      expect(toasts).toHaveLength(3);
      for (const toast of toasts) {
        expect(toast.title).toBe(lifecycle.expected.toast);
        expect(toast.body).toBe(lifecycle.expected.toastBody);
      }
    });

    await test.step('Read the balance of Main Bank, Cash and bKash on Accounts', async () => {
      await accounts.goto();

      // Main Bank 120000 + 60000 = 180000; Cash 5000 − 1200 − 3000
      // = 800; bKash 2500 + 3000 = 5500.
      await expect(accounts.balanceValue(lifecycle.income.account)).toHaveText(
        lifecycle.expected.balances['Main Bank'],
      );
      await expect(accounts.balanceValue(lifecycle.expense.account)).toHaveText(
        lifecycle.expected.balances['Cash'],
      );
      await expect(accounts.balanceValue(lifecycle.transfer.to)).toHaveText(
        lifecycle.expected.balances['bKash'],
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-T02 — the list filters
  // ─────────────────────────────────────────────────────────────────

  test('FIN-T02 List filters, grouping and ordering', { tag: '@smoke' }, async ({ page }) => {
    const filters = data.T02_filters;
    await seedState(page, filterState());

    await test.step('Open Transactions and read the header count', async () => {
      await transactions.goto();

      // The fixture carries eight transactions: the standard six plus
      // a payout and a debt payment.
      await expect(transactions.headerCount).toHaveText('8 entries');
    });

    await test.step('Click each filter chip in turn', async () => {
      for (const chip of data.filters) {
        await test.step(`Click ${chip.label}`, async () => {
          await transactions.applyFilter(chip.label as 'All');

          // Exactly one chip is active at a time.
          await expect(transactions.activeFilterChip).toHaveCount(1);
          await expect(transactions.activeFilterChip).toHaveText(chip.label);
        });
      }
    });

    await test.step('Click the active chip again', async () => {
      await transactions.applyFilter('Income');
      await expect(transactions.activeFilterChip).toHaveText('Income');

      await transactions.filterChip('Income').click();

      // The active chip resets to All.
      await expect(transactions.activeFilterChip).toHaveText('All');
    });

    await test.step('Read the list under All', async () => {
      await transactions.applyFilter('All');

      // The unfiltered view groups rows under sticky day headers.
      await expect(transactions.dayHeaders.first()).toBeVisible();
      expect(await transactions.dayHeaders.count()).toBeGreaterThan(0);
    });

    await test.step('Read the list under a non-All filter', async () => {
      await transactions.applyFilter('Transfer');

      // Any non-All filter collapses to a flat list — no subheaders.
      await expect(transactions.dayHeaders).toHaveCount(0);
      await expect(transactions.rows).toHaveCount(1);
    });

    await test.step('Apply a filter that matches nothing', async () => {
      // The "Cash" chip matches transactions touching an account
      // NAMED EXACTLY "Cash" — a name match, not a type match. On a
      // ledger whose only transaction touches "Visa Card", the chip
      // matches NOTHING, which is the empty state the case asks for.
      await reseedState(page, visaCardOnlyState());
      await transactions.goto();

      await transactions.applyFilter('Cash');

      await expect(transactions.noMatchMessage).toBeVisible();
      await expect(transactions.noMatchMessage).toHaveText(
        filters.expected.noMatchMessage,
      );
    });

    await test.step('Restore the seeded ledger', async () => {
      await reseedState(page, filterState());
      await transactions.goto();
    });

    await test.step('The header shows only a count — no income/expense/net totals', async () => {
      await transactions.applyFilter('All');
      await expect(transactions.headerCount).toContainText(filters.expected.countFormat);

      // There is no totals summary, no search and no sort control.
      await expect(transactions.totalsSummary).toHaveCount(0);
      await expect(transactions.searchField).toHaveCount(0);
      await expect(transactions.sortControl).toHaveCount(0);
    });

    await test.step('The filtered header reads "N of M entries"', async () => {
      await transactions.applyFilter('Income');

      // The filter state carries three incomes — the standard two
      // plus the payout.
      await expect(transactions.headerCount).toHaveText('3 of 8 entries');
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-T03 — the amount rules
  // ─────────────────────────────────────────────────────────────────

  test('FIN-T03 Amount validation and presets', { tag: '@smoke' }, async ({ page }) => {
    const amounts = data.T03_amounts;
    await seedState(page, formState());

    await test.step('Open the Add transaction form on the Expense type', async () => {
      await transactions.gotoForm('expense');
    });

    await test.step('Enter each of the invalid amounts in turn', async () => {
      for (const invalid of amounts.invalid) {
        await test.step(invalid.case, async () => {
          // The field is `type="number"`, so the non-numeric values
          // can only reach it as a paste — which is exactly what the
          // form's own guard has to reject.
          await transactions.pasteAmount(invalid.amount);

          // Every invalid amount raises the inline error and disables
          // Save.
          await expect(transactions.amountError).toHaveText(amounts.inlineError);
          await expect(transactions.amountError).toBeVisible();
          await expect(transactions.submitButton).toBeDisabled();
        });
      }
    });

    await test.step('Enter each of the valid amounts in turn', async () => {
      for (const valid of amounts.valid) {
        await test.step(valid.case, async () => {
          await transactions.pasteAmount(valid.amount);

          // Every valid amount is accepted.
          await expect(transactions.amountError).toHaveCount(0);
          await expect(transactions.submitButton).toBeEnabled();
        });
      }
    });

    await test.step('Read the helper line and the preset chips', async () => {
      await expect(transactions.amountHelper).toHaveText(amounts.helper);

      const presets = await transactions.amountPresets.allTextContents();
      expect(presets).toEqual(amounts.presets);
    });

    await test.step('The placeholder is 250 for expense', async () => {
      // `toHaveAttribute` RETRIES, so the assertion waits out the
      // route transition instead of reading the previous form's
      // placeholder.
      await expect(transactions.amountInput).toHaveAttribute(
        'placeholder',
        amounts.placeholders.expense,
      );
    });

    await test.step('The placeholder is 60,000 for income and 5,000 for transfer', async () => {
      await transactions.gotoForm('income');
      await expect(transactions.amountInput).toHaveAttribute(
        'placeholder',
        amounts.placeholders.income,
      );

      await transactions.gotoForm('transfer');
      await expect(transactions.amountInput).toHaveAttribute(
        'placeholder',
        amounts.placeholders.transfer,
      );
    });

    await test.step('The helper and the presets are on the expense form only', async () => {
      await transactions.gotoForm('income');
      await expect(transactions.amountHelper).toHaveCount(0);
      await expect(transactions.amountPresets).toHaveCount(0);

      await transactions.gotoForm('transfer');
      await expect(transactions.amountHelper).toHaveCount(0);
      await expect(transactions.amountPresets).toHaveCount(0);
    });

    await test.step('The input carries no ৳ prefix', async () => {
      await transactions.gotoForm('expense');

      // The field's own value carries no currency glyph — the chip
      // labels do, the input does not.
      await transactions.amountInput.fill('250');
      expect(await transactions.amountInput.inputValue()).toBe('250');
    });

    await test.step('Bypass the disabled Save button with an invalid amount and submit', async () => {
      await transactions.amountInput.fill('-250');

      // The manual case reaches the disabled button through devtools;
      // Playwright refuses to click a disabled button, so the DOM
      // attribute is removed first — the same thing devtools does.
      await transactions.submitButton.evaluate((button: HTMLButtonElement) => {
        button.removeAttribute('disabled');
      });
      await transactions.submitButton.click();

      const feedback = new Feedback(page);
      await feedback.expectBannerText(amounts.banner.what);
      await feedback.expectBannerText(amounts.banner.why);
      await feedback.expectBannerText(amounts.banner.fix);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-T04 — the category picker
  // ─────────────────────────────────────────────────────────────────

  test('FIN-T04 Category picker', async ({ page }) => {
    const categories = data.T04_categories;
    await seedState(page, formState());

    await test.step('Open the Add transaction form on the Expense type', async () => {
      await transactions.gotoForm('expense');
    });

    await test.step('Expand the category list and read the group headings', async () => {
      // Collapsed, only the FIRST group renders.
      await expect(transactions.categoryGroups).toHaveCount(1);
      await expect(transactions.groupHeading(categories.expenseGroups[0])).toBeVisible();

      await transactions.showAllCategoriesButton.click();

      // Expanded, every group renders inline.
      await expect(transactions.categoryGroups).toHaveCount(
        categories.expenseGroups.length,
      );
      for (const group of categories.expenseGroups) {
        await expect(transactions.groupHeading(group)).toBeVisible();
      }
    });

    await test.step('Read the toggle button', async () => {
      // The expander becomes "Hide list" once expanded.
      await expect(transactions.hideListButton).toBeVisible();
      await expect(transactions.showAllCategoriesButton).toHaveCount(0);
    });

    await test.step('Select a category', async () => {
      await transactions.categoryChip('Rent').click();

      await expect(transactions.selectedCategoryLabel).toHaveText(categories.selectedLabel);
    });

    await test.step('Clicking the chip again does not deselect it', async () => {
      await transactions.categoryChip('Rent').click();

      // Still selected.
      await expect(transactions.selectedCategoryLabel).toHaveText(categories.selectedLabel);
    });

    await test.step('Clear the selected category', async () => {
      await transactions.clearCategoryButton.click();

      await expect(transactions.selectedCategoryLabel).toHaveCount(0);
    });

    await test.step('Switch the type to Income and read the category list', async () => {
      await transactions.gotoForm('income');

      // The income picker is flat — all five visible, no group
      // headings and no expander.
      for (const category of categories.incomeCategories) {
        await expect(transactions.categoryChip(category)).toBeVisible();
      }
      await expect(transactions.categoryGroups).toHaveCount(0);
      await expect(transactions.showAllCategoriesButton).toHaveCount(0);
    });

    await test.step('Look for a search field', async () => {
      // The picker is not searchable.
      await expect(transactions.searchField).toHaveCount(0);
    });

    await test.step('Save the form with no category selected and read the resulting row title', async () => {
      // The form on screen is the INCOME form — the case switched to
      // Income in the previous step.
      await transactions.amountInput.fill('250');
      await transactions.accountSelect.selectOption({ label: 'Cash' });
      await transactions.saveAndWaitForList();

      // No category → the row title falls back to the type name.
      await expect(transactions.rowTitle('income')).toHaveText('income');
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-T05 — the transfer form's specifics
  // ─────────────────────────────────────────────────────────────────

  test('FIN-T05 Transfer specifics', { tag: '@smoke' }, async ({ page }) => {
    const transfer = data.T05_transfers;
    await seedState(page, formState());

    await test.step('Open "+ Add transaction" and choose Transfer', async () => {
      await transactions.gotoPicker();
      await transactions.typeCard('transfer').click();
      await transactions.formHeading('transfer').waitFor({ state: 'visible' });
    });

    await test.step('Read the fields on the form', async () => {
      // Two selects, From and To, with a left-right arrow between.
      await expect(transactions.fromSelect).toBeVisible();
      await expect(transactions.toSelect).toBeVisible();
      await expect(transactions.transferArrow).toBeVisible();

      // A positive-amount Amount field.
      await expect(transactions.amountInput).toBeVisible();
    });

    await test.step('There is no Date, no Note, no Category, no Debt and no Investment field', async () => {
      await expect(transactions.dateInput).toHaveCount(0);
      await expect(transactions.noteInput).toHaveCount(0);
      await expect(transactions.addCategoryLabel).toHaveCount(0);
      await expect(transactions.linkedDebtSelect).toHaveCount(0);
      await expect(transactions.linkedInvestmentSelect).toHaveCount(0);
    });

    await test.step('Open the To dropdown with From set to Cash', async () => {
      await transactions.fromSelect.selectOption({ label: transfer.from });

      const toOptions = await transactions.toOptions.allTextContents();

      // The From account is removed from the To options.
      expect(toOptions).not.toContain(transfer.from);
      expect(toOptions).toContain(transfer.to);
    });

    await test.step('Enter 1000 and read the balance projections', async () => {
      // The To account has to be bKash for the second projection to
      // be the bKash one.
      await transactions.toSelect.selectOption({ label: transfer.to });
      await transactions.amountInput.fill(transfer.amount);

      await expect(
        transactions.projectionLine(transfer.expected.cashProjection),
      ).toBeVisible();
      await expect(
        transactions.projectionLine(transfer.expected.bKashProjection),
      ).toBeVisible();
    });

    await test.step('Enter a zero amount and observe Save', async () => {
      await transactions.amountInput.fill(transfer.zeroAmount);

      await expect(transactions.submitButton).toBeDisabled();
    });

    await test.step('On the single-account profile, open the transfer form and read the To dropdown', async () => {
      await reseedState(page, singleAccountState());
      await transactions.gotoForm('transfer');

      // Exactly one account exists, so the To dropdown offers none.
      await expect(transactions.toOptions).toHaveCount(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-T06 — the edit form differs from the add form
  // ─────────────────────────────────────────────────────────────────

  test('FIN-T06 The edit form differs from the add form and the type is locked', async ({ page }) => {
    const edit = data.T06_editForm;
    await seedState(page, filterState());

    await test.step('Open a transaction\'s edit form', async () => {
      await transactions.goto();
      await transactions.openTransaction('Weekly shop');

      await expect(transactions.editHeading).toBeVisible();
    });

    await test.step('The edit form has no preset chips and no projection lines', async () => {
      await expect(transactions.amountPresets).toHaveCount(0);
      await expect(transactions.projectionLines).toHaveCount(0);
    });

    await test.step('The category label reads "Category" with no "(optional)" suffix', async () => {
      await expect(transactions.editCategoryLabel).toBeVisible();
      await expect(transactions.addCategoryLabel).toHaveCount(0);
    });

    await test.step('Try to change the transaction type', async () => {
      // There is NO type selector — the type is locked.
      await expect(transactions.typeSelect).toHaveCount(0);
    });

    await test.step('Read the note field\'s label and hint', async () => {
      await expect(transactions.editNoteInput).toBeVisible();
      await expect(transactions.noteHint).toHaveText(edit.noteHint);
    });

    await test.step('Read the delete control and the cancel control', async () => {
      await expect(transactions.deleteButton).toHaveText(edit.deleteLabel);
      await expect(transactions.cancelButton).toBeVisible();
    });

    await test.step('Click "Cancel" and read where you land', async () => {
      await transactions.cancelButton.click();

      // "Cancel" on the edit form returns to the Transactions LIST.
      await transactions.editHeading.waitFor({ state: 'detached' });
      await expect(transactions.headerCount).toBeVisible();
    });

    await test.step('"Cancel" on the add form returns to the type picker instead', async () => {
      await transactions.gotoForm('expense');
      await transactions.cancelButton.click();

      await transactions.pickerHeading.waitFor({ state: 'visible' });
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-T07 — editing recalculates the balances
  // ─────────────────────────────────────────────────────────────────

  test('FIN-T07 Editing a transaction recalculates balances and totals', { tag: '@smoke' }, async ({ page }) => {
    const recalc = data.T07_editRecalculates;
    await seedState(page, editableExpenseState());

    await test.step('Open the expense for editing and change the amount to 1500', async () => {
      await transactions.goto();
      await transactions.openTransaction('Weekly shop');

      await transactions.amountInput.fill(recalc.editedAmount);
    });

    await test.step('Click "Save changes"', async () => {
      await transactions.saveButton.click();

      // The toast is raised on the edit screen, before the 600 ms
      // navigation.
      const feedback = new Feedback(page);
      await feedback.waitForToast();
      await expect(feedback.toastTitle).toHaveText(recalc.expected.toast);
      await expect(feedback.toastBody).toHaveText(recalc.expected.toastBody);

      await transactions.editHeading.waitFor({ state: 'detached' });
    });

    await test.step('Read the balance of Cash on Accounts', async () => {
      await accounts.goto();

      // 1000 − 1500 = −500 → the balance is recalculated, not
      // appended to.
      await expect(accounts.balanceValue(recalc.accountName)).toHaveText('৳ -500');
    });

    await test.step('Read the "This month" card on Home', async () => {
      const home = new HomePage(page);
      await home.goto();

      // The expense figure follows the edit — 1500, not 2500.
      await expect(home.thisMonthValue('Expenses')).toHaveText(recalc.expected.thisMonthExpenses);
    });

    await test.step('Reopen the transaction and delete it', async () => {
      await transactions.goto();
      await transactions.openTransaction('Weekly shop');

      await transactions.deleteButton.click();

      const dialog = new ConfirmDialog(page);
      await dialog.confirm('Delete');
    });

    await test.step('The delete raises the "Transaction deleted" banner', async () => {
      const feedback = new Feedback(page);
      await feedback.expectBannerText(recalc.expected.deleteBanner);
      await feedback.expectBannerText(recalc.expected.deleteBannerBody);
      await feedback.expectBannerText(recalc.expected.deleteBannerFix);
    });
    await test.step('Read the balance of Cash again', async () => {
      await accounts.goto();

      // The opening balance is restored.
      await expect(accounts.balanceValue(recalc.accountName)).toHaveText(recalc.expected.cashBalanceAfterDelete);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-T08 — deleting is confirmed and permanent
  // ─────────────────────────────────────────────────────────────────

  test('FIN-T08 Deleting a transaction is confirmed and permanent', async ({ page }) => {
    const remove = data.T08_delete;
    await seedState(page, filterState());

    // The id has to be read BEFORE the delete — afterwards the row's
    // link is gone.
    let deletedId = '';

    await test.step('Open the transaction and click "🗑 Delete"', async () => {
      await transactions.goto();

      deletedId = await transactions.rowEditId('Weekly shop');
      expect(deletedId).not.toBe('');

      await transactions.openTransaction('Weekly shop');

      await transactions.deleteButton.click();
    });

    await test.step('Read the confirmation', async () => {
      const dialog = new ConfirmDialog(page);
      await expect(dialog.heading).toHaveText(remove.confirmTitle);
      await expect(dialog.body).toHaveText(remove.confirmBody);
    });

    await test.step('Click "Delete"', async () => {
      const dialog = new ConfirmDialog(page);
      await dialog.confirm('Delete');

      // The row is gone from the Transactions list.
      await expect(transactions.row('Weekly shop')).toHaveCount(0);
    });

    await test.step('The "Transaction deleted" banner is raised', async () => {
      const feedback = new Feedback(page);
      await feedback.expectBannerText('Transaction deleted');
    });
    await test.step('Reopen the same transaction\'s URL', async () => {
      await transactions.gotoEdit(deletedId);

      // The entry is GONE, not merely hidden.
      await expect(transactions.notFoundHeading).toBeVisible();
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-T09 — linking an expense to a debt
  // ─────────────────────────────────────────────────────────────────

  test('FIN-T09 Linking an expense to a debt', { tag: '@smoke' }, async ({ page }) => {
    const link = data.T09_linkDebt;
    await seedState(page, debtPaymentState());

    await test.step('Open "+ Add transaction" and choose Expense', async () => {
      await transactions.gotoPicker();
      await transactions.typeCard('expense').click();
      await transactions.formHeading('expense').waitFor({ state: 'visible' });
    });

    await test.step('Open the "Linked debt (optional)" dropdown', async () => {
      const options = await transactions.linkedDebtOptions.allTextContents();

      // "— None —" is offered alongside the active debts.
      expect(options[0]).toBe(link.expected.noneOption);
      expect(options).toContain(link.debtName);

      await expect(transactions.linkedDebtHint).toHaveText(link.expected.hint);
    });

    await test.step('Select Loan from Rahim', async () => {
      await transactions.linkedDebtSelect.selectOption({ label: link.debtName });
    });

    await test.step('Read the line beneath the dropdown', async () => {
      await expect(transactions.linkedDebtRemaining).toHaveText(
        link.expected.remainingBefore,
      );
    });

    await test.step('Enter 2000, pick an account, and save', async () => {
      await transactions.amountInput.fill(link.amount);
      await transactions.accountSelect.selectOption({ label: 'Cash' });
      await transactions.saveAndWaitForList();

      // The transaction is tagged to the debt.
      await expect(transactions.rowTag('Groceries')).toBeVisible();
    });

    await test.step('Open the debt and read its paid figure', async () => {
      const debts = new DebtsPage(page);
      await debts.goto();

      // The paid total is derived from the linked transactions, never
      // typed by the user.
      await expect(debts.cardPaidLine(link.debtName)).toHaveText(
        link.expected.paidLine,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-T10 — linking an income to an investment
  // ─────────────────────────────────────────────────────────────────

  test('FIN-T10 Linking an income to an investment, and the payout-account mismatch warning', { tag: '@smoke' }, async ({ page }) => {
    const link = data.T10_linkInvestment;
    await seedState(page, fdrState());

    await test.step('Open "+ Add transaction" and choose Income', async () => {
      await transactions.gotoPicker();
      await transactions.typeCard('income').click();
      await transactions.formHeading('income').waitFor({ state: 'visible' });
    });

    await test.step('Open the "Linked investment (optional)" dropdown and select DBBL 1-year FDR', async () => {
      await transactions.linkedInvestmentSelect.selectOption({
        label: link.investmentName,
      });

      await expect(transactions.linkedInvestmentHint).toHaveText(link.expected.hint);
    });

    await test.step('Read the account field and the projection line', async () => {
      // The account field auto-switched to the payout account.
      await expect(transactions.accountSelect.locator('option:checked')).toHaveText(
        link.payoutAccount,
      );

      await expect(transactions.linkedInvestmentProjection).toHaveText(
        link.expected.fdrMaturityProjection,
      );
    });

    await test.step('Change the account to Cash', async () => {
      await transactions.accountSelect.selectOption({ label: link.otherAccount });
    });

    await test.step('A non-blocking amber warning headed "Heads up:" is raised', async () => {
      await expect(transactions.payoutMismatchWarning).toBeVisible();
      await expect(transactions.payoutMismatchWarning).toContainText(
        link.expected.mismatchWarningHeading,
      );
      await expect(transactions.payoutMismatchWarning).toContainText(
        link.investmentName,
      );
      await expect(transactions.payoutMismatchWarning).toContainText(
        link.payoutAccount,
      );
      await expect(transactions.payoutMismatchWarning).toContainText(
        link.otherAccount,
      );

      // The save is still permitted — but the button is only enabled
      // once the amount is a positive number, so the amount is
      // entered first.
      await transactions.amountInput.fill(link.amount);
      await expect(transactions.submitButton).toBeEnabled();
    });

    await test.step('Save', async () => {
      await transactions.saveAndWaitForList();
    });

    await test.step('Open the Add transaction form again, select a linked debt, and check the investment dropdown', async () => {
      await transactions.gotoForm('income');

      // The two links are mutually exclusive: choosing a debt clears
      // the investment.
      await transactions.linkedDebtSelect.selectOption({ label: 'Lent to Karim' });
      await expect(transactions.linkedInvestmentSelect).toHaveValue('');

      // …and choosing an investment clears the debt.
      await transactions.linkedInvestmentSelect.selectOption({
        label: link.investmentName,
      });
      await expect(transactions.linkedDebtSelect).toHaveValue('');
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-T11 — the amount format and the row anatomy
  // ─────────────────────────────────────────────────────────────────

  test('FIN-T11 Amount formatting and row anatomy', async ({ page }) => {
    const formatting = data.T11_formatting;
    await seedState(page, formattingState());

    await test.step('Open Transactions and read the two rows', async () => {
      await transactions.goto();

      await expect(transactions.rows).toHaveCount(2);
      await expect(
        transactions.amountOf(transactions.row('Weekly shop')),
      ).toHaveText(formatting.amounts[0].formatted);
      await expect(
        transactions.amountOf(transactions.row('Yearly bonus')),
      ).toHaveText(formatting.amounts[1].formatted);
    });

    await test.step('Read the day header above the rows', async () => {
      await expect(transactions.dayHeaders.first()).toHaveText(
        new RegExp(formatting.dayHeaderPattern),
      );
    });

    await test.step('Read the category and the account of each row', async () => {
      // The subtitle carries the account and the category.
      await expect(transactions.subtitleOf(transactions.row('Weekly shop'))).toHaveText(
        'Main Bank · Groceries',
      );
      await expect(transactions.subtitleOf(transactions.row('Yearly bonus'))).toHaveText(
        'Main Bank · Salary',
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-T12 — a negative balance is permitted
  // ─────────────────────────────────────────────────────────────────

  test('FIN-T12 An account may hold a negative balance', async ({ page }) => {
    const negative = accountsData.T12_negativeBalance;
    await seedState(page, negativeBalanceState());

    await test.step('Record an expense of 2500 against Cash', async () => {
      await transactions.gotoPicker();
      await transactions.typeCard('expense').click();
      await transactions.amountInput.fill(negative.expenseAmount);
      await transactions.accountSelect.selectOption({ label: negative.accountName });
      await transactions.saveAndWaitForList();
    });

    await test.step('Read the balance of Cash on Accounts', async () => {
      await accounts.goto();

      // A negative balance is permitted and displayed, not clamped to
      // zero.
      await expect(accounts.balanceValue(negative.accountName)).toHaveText(
        negative.expected.balance,
      );
    });

    await test.step('Read the balance on the Home "Cash" tile', async () => {
      const home = new HomePage(page);
      await home.goto();

      // The tile reports the same signed figure.
      await expect(home.stripValue('Cash')).toHaveText(negative.expected.balance);
    });

    await test.step('The net-worth figure on Home is correspondingly lower', async () => {
      const home = new HomePage(page);
      await home.goto();

      // The fixture has a single account, so the net worth IS the
      // signed balance — it is correspondingly lower. The hero uses
      // its own format (a minus sign BEFORE the ৳).
      await expect(home.netWorthFigure).toHaveText(negative.expected.netWorth);
    });

    await test.step('Delete the expense', async () => {
      await transactions.goto();

      // The expense was recorded with no note and no category, so its
      // row title falls back to the type name.
      await transactions.openTransaction('expense');

      await transactions.deleteButton.click();
      const dialog = new ConfirmDialog(page);
      await dialog.confirm('Delete');
    });

    await test.step(`The balance is restored to ${negative.expected.restoredBalance}`, async () => {
      await accounts.goto();

      await expect(accounts.balanceValue(negative.accountName)).toHaveText(
        negative.expected.restoredBalance,
      );
    });
  });
});
